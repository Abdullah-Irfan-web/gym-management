import { google, sheets_v4 } from "googleapis";
import { sheetsEnv } from "@/utils/env";

let cached: sheets_v4.Sheets | null = null;

export function getSheets(): sheets_v4.Sheets {
  if (cached) return cached;
  const env = sheetsEnv();
  const auth = new google.auth.JWT({
    email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: env.GOOGLE_PRIVATE_KEY,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  cached = google.sheets({ version: "v4", auth });
  return cached;
}
export const spreadsheetId = () => sheetsEnv().GOOGLE_SPREADSHEET_ID;

export class SheetsError extends Error {
  constructor(message: string, public readonly status?: number, public readonly retryable = false) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retries 429/5xx/network errors with exponential backoff + jitter. */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: any) {
      last = err;
      const status: number | undefined = err?.code ?? err?.response?.status;
      const retryable = status === 429 || (typeof status === "number" && status >= 500) ||
        ["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN"].includes(err?.code);
      if (!retryable || i === attempts - 1) {
        throw new SheetsError(err?.message ?? "Google Sheets request failed", status, retryable);
      }
      await sleep(Math.min(8000, 400 * 2 ** i) + Math.random() * 250);
    }
  }
  throw last;
}

/** Per-key in-process mutex. Serialises writes to one entity inside one server instance. */
const tails = new Map<string, Promise<unknown>>();
export async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = tails.get(key) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(fn);
  tails.set(key, run);
  try { return await run; } finally { if (tails.get(key) === run) tails.delete(key); }
}
