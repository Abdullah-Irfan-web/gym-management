import { handle, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { dashboard } from "@/services/stats";
export const dynamic = "force-dynamic";
export const GET = handle(async (req: Request) => {
  await requireAdmin();
  const q = new URL(req.url).searchParams;
  return ok(await dashboard(q.get("range") ?? "month", q.get("from") ?? undefined, q.get("to") ?? undefined));
});
