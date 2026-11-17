import { z } from "zod";

const schema = z.object({
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().email(),
  GOOGLE_PRIVATE_KEY: z.string().min(50),
  GOOGLE_SPREADSHEET_ID: z.string().min(10),
});

/** Validated lazily so `next build` doesn't need secrets. Server-only. */
export function sheetsEnv() {
  const e = schema.parse(process.env);
  return { ...e, GOOGLE_PRIVATE_KEY: e.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n") };
}
