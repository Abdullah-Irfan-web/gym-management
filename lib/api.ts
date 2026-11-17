import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "@/utils/misc";
import { SheetsError } from "@/lib/google-sheets/client";

export const ok = (data: unknown = { ok: true }, status = 200) => NextResponse.json(data, { status });

/** Wrap a handler: converts thrown errors to safe JSON; never leaks internals. */
export function handle<A extends unknown[]>(fn: (...a: A) => Promise<Response>) {
  return async (...a: A): Promise<Response> => {
    try { return await fn(...a); }
    catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input", fields: e.flatten().fieldErrors }, { status: 400 });
      if (e instanceof SheetsError) {
        console.error("[sheets]", e.message);
        return NextResponse.json({ error: "Our records are temporarily unavailable. Please try again in a moment." }, { status: e.status === 409 ? 409 : 503 });
      }
      console.error("[api]", e);
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
  };
}
export function cronAuth(req: Request) {
  const h = req.headers.get("authorization");
  const s = process.env.CRON_SECRET;
  if (!s || h !== `Bearer ${s}`) throw new HttpError(401, "Unauthorized");
}
