import { handle, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { sheetRepo } from "@/lib/google-sheets/repository";
export const dynamic = "force-dynamic";
export const GET = handle(async () => {
  await requireAdmin();
  return ok({ logs: (await sheetRepo.list("AuditLogs", { fresh: true })).sort((a, b) => b["Timestamp"].localeCompare(a["Timestamp"])).slice(0, 300) });
});
