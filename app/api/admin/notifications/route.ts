import { handle, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { sheetRepo } from "@/lib/google-sheets/repository";
import { retryOne } from "@/services/notifications";
import { z } from "zod";
export const dynamic = "force-dynamic";
export const GET = handle(async (req: Request) => {
  await requireAdmin();
  const status = new URL(req.url).searchParams.get("status");
  const rows = (await sheetRepo.list("Notifications", { fresh: true })).filter((n) => !status || status === "all" || n["Notification Status"] === status);
  return ok({ notifications: rows.sort((a, b) => b["Updated At"].localeCompare(a["Updated At"])).slice(0, 500) });
});
export const POST = handle(async (req: Request) => {
  await requireAdmin();
  const { id } = z.object({ id: z.string() }).parse(await req.json());
  return ok({ result: await retryOne(id) });
});
