import { handle, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { sheetRepo } from "@/lib/google-sheets/repository";
export const dynamic = "force-dynamic";
export const GET = handle(async (req: Request) => {
  await requireAdmin();
  const q = new URL(req.url).searchParams, s = (q.get("q") ?? "").toLowerCase();
  const status = q.get("status"), type = q.get("type"), from = q.get("from"), to = q.get("to");
  const rows = (await sheetRepo.list("Payments", { fresh: true })).filter((p) =>
    (!s || p["Member ID"].toLowerCase().includes(s) || p["Member Name"].toLowerCase().includes(s)) && (!status || status === "all" || p["Payment Status"] === status) &&
    (!type || type === "all" || p["Payment Type"] === type) && (!from || p["Payment Date"] >= from) && (!to || p["Payment Date"] <= to));
  return ok({ payments: rows.sort((a, b) => b["Created At"].localeCompare(a["Created At"])) });
});
