/**
 * Creates any missing worksheets, writes header rows, formats them, and seeds
 * default Plans/Settings. Safe to run repeatedly (never overwrites data).
 * Usage: npm run sheets:init
 */
import { getSheets, spreadsheetId, withRetry } from "../lib/google-sheets/client";
import { SHEETS, DEFAULT_PLANS, DEFAULT_SETTINGS, SheetName } from "../lib/google-sheets/schema";

async function main() {
  const sheets = getSheets();
  const id = spreadsheetId();
  const meta = await withRetry(() => sheets.spreadsheets.get({ spreadsheetId: id }));
  const existing = new Map((meta.data.sheets ?? []).map((s) => [s.properties!.title!, s.properties!.sheetId!]));

  const names = Object.keys(SHEETS) as SheetName[];
  const toAdd = names.filter((n) => !existing.has(n));
  if (toAdd.length) {
    await withRetry(() => sheets.spreadsheets.batchUpdate({
      spreadsheetId: id,
      requestBody: { requests: toAdd.map((title) => ({ addSheet: { properties: { title, gridProperties: { frozenRowCount: 1 } } } })) },
    }));
    console.log("Created tabs:", toAdd.join(", "));
  }

  for (const name of names) {
    const hdr = await withRetry(() => sheets.spreadsheets.values.get({ spreadsheetId: id, range: `${name}!1:1` }));
    if (!hdr.data.values?.[0]?.length) {
      await withRetry(() => sheets.spreadsheets.values.update({
        spreadsheetId: id, range: `${name}!A1`, valueInputOption: "RAW",
        requestBody: { values: [[...SHEETS[name]]] },
      }));
      console.log("Wrote headers:", name);
    }
  }

  const plans = await withRetry(() => sheets.spreadsheets.values.get({ spreadsheetId: id, range: "Plans!A2:A" }));
  if (!plans.data.values?.length) {
    const now = new Date().toISOString();
    await withRetry(() => sheets.spreadsheets.values.append({
      spreadsheetId: id, range: "Plans!A:A", valueInputOption: "RAW",
      requestBody: { values: DEFAULT_PLANS.map((p) => [...p, now]) },
    }));
    console.log("Seeded default plans (edit prices in the Plans tab or the dashboard).");
  }

  const settings = await withRetry(() => sheets.spreadsheets.values.get({ spreadsheetId: id, range: "Settings!A2:A" }));
  const have = new Set((settings.data.values ?? []).map((r) => r[0]));
  const missing = Object.entries(DEFAULT_SETTINGS).filter(([k]) => !have.has(k));
  if (missing.length) {
    const now = new Date().toISOString();
    await withRetry(() => sheets.spreadsheets.values.append({
      spreadsheetId: id, range: "Settings!A:A", valueInputOption: "RAW",
      requestBody: { values: missing.map(([k, v]) => [k, v, now]) },
    }));
    console.log("Seeded settings:", missing.map(([k]) => k).join(", "));
  }

  // Bold + grey header row on every tab
  const refreshed = await withRetry(() => sheets.spreadsheets.get({ spreadsheetId: id }));
  await withRetry(() => sheets.spreadsheets.batchUpdate({
    spreadsheetId: id,
    requestBody: {
      requests: (refreshed.data.sheets ?? []).filter((s) => names.includes(s.properties!.title as SheetName)).map((s) => ({
        repeatCell: {
          range: { sheetId: s.properties!.sheetId!, startRowIndex: 0, endRowIndex: 1 },
          cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.92, green: 0.92, blue: 0.92 } } },
          fields: "userEnteredFormat(textFormat,backgroundColor)",
        },
      })),
    },
  }));
  console.log("Spreadsheet ready.");
}
main().catch((e) => { console.error("Init failed:", e.message); process.exit(1); });
