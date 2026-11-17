import { getSheets, spreadsheetId, withRetry, withLock, SheetsError } from "./client";
import { SHEETS, SheetName, Row, Input, keyColumn } from "./schema";

/** Column index -> A1 letter (0 -> A, 26 -> AA). */
function colLetter(i: number): string {
  let s = ""; i++;
  while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
  return s;
}

// Short read cache: cuts API calls on dashboards. Invalidated on every write to that sheet.
const CACHE_TTL_MS = 5_000;
const cache = new Map<string, { at: number; headers: string[]; values: string[][] }>();

async function readRaw(sheet: SheetName, fresh = false) {
  const hit = cache.get(sheet);
  if (!fresh && hit && Date.now() - hit.at < CACHE_TTL_MS) return hit;
  const res = await withRetry(() =>
    getSheets().spreadsheets.values.get({
      spreadsheetId: spreadsheetId(), range: `${sheet}!A:ZZ`, valueRenderOption: "UNFORMATTED_VALUE",
    }));
  const rows = (res.data.values ?? []).map((r) => r.map((c) => (c == null ? "" : String(c))));
  const headers = rows[0] ?? [];
  if (!headers.length) throw new SheetsError(`Sheet "${sheet}" has no header row. Run: npm run sheets:init`);
  const entry = { at: Date.now(), headers, values: rows.slice(1) };
  cache.set(sheet, entry);
  return entry;
}
const invalidate = (sheet: SheetName) => cache.delete(sheet);

function toRecord<S extends SheetName>(headers: string[], row: string[]): Row<S> {
  const o: Record<string, string> = {};
  headers.forEach((h, i) => { o[h] = row[i] ?? ""; });
  return o as Row<S>;
}
function toRow(headers: string[], rec: Record<string, string | number | boolean | undefined>): string[] {
  return headers.map((h) => { const v = rec[h]; return v === undefined || v === null ? "" : String(v); });
}

export const sheetRepo = {
  /** All records. Rows with an empty key (e.g. cleared duplicates) are skipped. */
  async list<S extends SheetName>(sheet: S, opts?: { fresh?: boolean }): Promise<Row<S>[]> {
    const { headers, values } = await readRaw(sheet, opts?.fresh);
    const k = headers.indexOf(keyColumn(sheet));
    return values.filter((r) => (r[k] ?? "") !== "").map((r) => toRecord<S>(headers, r));
  },

  async findById<S extends SheetName>(sheet: S, id: string, opts?: { fresh?: boolean }) {
    const all = await this.list(sheet, opts);
    const k = keyColumn(sheet) as keyof Row<S>;
    return all.find((r) => r[k] === id) ?? null;
  },

  async search<S extends SheetName>(sheet: S, predicate: (r: Row<S>) => boolean, opts?: { fresh?: boolean }) {
    return (await this.list(sheet, opts)).filter(predicate);
  },

  /** Plain append (no uniqueness guarantee). Use for logs. */
  async append<S extends SheetName>(sheet: S, rec: Input<S>): Promise<void> {
    await this.appendMany(sheet, [rec]);
  },

  async appendMany<S extends SheetName>(sheet: S, recs: Input<S>[]): Promise<void> {
    if (!recs.length) return;
    const headers = SHEETS[sheet] as readonly string[];
    const live = (await readRaw(sheet, true)).headers;
    void headers;
    await withRetry(() => getSheets().spreadsheets.values.append({
      spreadsheetId: spreadsheetId(), range: `${sheet}!A:A`,
      valueInputOption: "RAW", insertDataOption: "INSERT_ROWS",
      requestBody: { values: recs.map((r) => toRow(live, r as any)) },
    }));
    invalidate(sheet);
  },

  /**
   * Insert only if no row already has this key value. Sheets has no unique
   * constraint, so: check -> append -> re-read -> the FIRST row with the key
   * wins; a losing writer clears its own row. Returns {created:false} on loss.
   */
  async appendUnique<S extends SheetName>(
    sheet: S, uniqueColumn: string, rec: Input<S>,
  ): Promise<{ created: boolean }> {
    const value = String((rec as any)[uniqueColumn] ?? "");
    if (!value) throw new SheetsError(`appendUnique requires a value for "${uniqueColumn}"`);
    return withLock(`${sheet}:${uniqueColumn}:${value}`, async () => {
      const before = await readRaw(sheet, true);
      const ci = before.headers.indexOf(uniqueColumn);
      if (before.values.some((r) => r[ci] === value)) return { created: false };

      const res = await withRetry(() => getSheets().spreadsheets.values.append({
        spreadsheetId: spreadsheetId(), range: `${sheet}!A:A`,
        valueInputOption: "RAW", insertDataOption: "INSERT_ROWS",
        requestBody: { values: [toRow(before.headers, rec as any)] },
      }));
      invalidate(sheet);
      const updated = res.data.updates?.updatedRange ?? "";           // e.g. Members!A12:U12
      const myRow = Number(/!A?(\d+)/.exec(updated)?.[1] ?? 0);

      const after = await readRaw(sheet, true);
      const firstIdx = after.values.findIndex((r) => r[ci] === value);
      const firstRow = firstIdx + 2; // header is row 1
      if (myRow && firstRow !== myRow) {
        await withRetry(() => getSheets().spreadsheets.values.clear({
          spreadsheetId: spreadsheetId(), range: `${sheet}!A${myRow}:${colLetter(after.headers.length - 1)}${myRow}`,
        }));
        invalidate(sheet);
        return { created: false };
      }
      return { created: true };
    });
  },

  /**
   * Update ONE record by ID. Only the supplied fields are written (the rest of
   * the row is untouched). If `expectUpdatedAt` is given and the row changed
   * since, throws a retryable conflict so the caller can re-read and retry.
   */
  async updateById<S extends SheetName>(
    sheet: S, id: string, patch: Input<S>, opts?: { expectUpdatedAt?: string },
  ): Promise<Row<S>> {
    return withLock(`${sheet}:${id}`, async () => {
      const { headers, values } = await readRaw(sheet, true);
      const k = headers.indexOf(keyColumn(sheet));
      const idx = values.findIndex((r) => r[k] === id);
      if (idx < 0) throw new SheetsError(`${sheet}: record ${id} not found`, 404);
      const row = values[idx]!;
      const u = headers.indexOf("Updated At");
      if (opts?.expectUpdatedAt !== undefined && u >= 0 && (row[u] ?? "") !== opts.expectUpdatedAt) {
        throw new SheetsError(`${sheet}: ${id} was modified concurrently`, 409, true);
      }
      const next = [...row];
      while (next.length < headers.length) next.push("");
      const patchRec = { ...(patch as Record<string, unknown>) };
      if (u >= 0 && patchRec["Updated At"] === undefined) patchRec["Updated At"] = new Date().toISOString();
      for (const [h, v] of Object.entries(patchRec)) {
        const ci = headers.indexOf(h);
        if (ci >= 0) next[ci] = v == null ? "" : String(v);
      }
      const rowNo = idx + 2;
      await withRetry(() => getSheets().spreadsheets.values.update({
        spreadsheetId: spreadsheetId(),
        range: `${sheet}!A${rowNo}:${colLetter(headers.length - 1)}${rowNo}`,
        valueInputOption: "RAW", requestBody: { values: [next] },
      }));
      invalidate(sheet);
      return toRecord<S>(headers, next);
    });
  },

  /** Many single-cell patches in ONE API call (only the named cells are written). */
  async batchPatch<S extends SheetName>(sheet: S, updates: { id: string; patch: Input<S> }[]): Promise<number> {
    if (!updates.length) return 0;
    const { headers, values } = await readRaw(sheet, true);
    const k = headers.indexOf(keyColumn(sheet));
    const rowOf = new Map(values.map((r, i) => [r[k], i + 2] as const));
    const data: { range: string; values: string[][] }[] = [];
    for (const u of updates) {
      const row = rowOf.get(u.id);
      if (!row) continue;
      const p = { ...(u.patch as Record<string, unknown>), "Updated At": new Date().toISOString() };
      for (const [h, v] of Object.entries(p)) {
        const ci = headers.indexOf(h);
        if (ci >= 0) data.push({ range: `${sheet}!${colLetter(ci)}${row}`, values: [[v == null ? "" : String(v)]] });
      }
    }
    if (!data.length) return 0;
    await withRetry(() => getSheets().spreadsheets.values.batchUpdate({
      spreadsheetId: spreadsheetId(), requestBody: { valueInputOption: "RAW", data },
    }));
    invalidate(sheet);
    return updates.length;
  },

  /** Key/value helpers for the Settings tab. */
  async getSettings(): Promise<Record<string, string>> {
    const rows = await this.list("Settings");
    return Object.fromEntries(rows.map((r) => [r.Key, r.Value]));
  },
};
