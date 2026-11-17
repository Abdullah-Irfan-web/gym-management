import { handle, ok } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { sheetRepo } from "@/lib/google-sheets/repository";
import { signToken, DAY } from "@/lib/auth/tokens";
import { HttpError } from "@/utils/misc";
export const dynamic = "force-dynamic";
/** Refresh-safe status for the success page. Reveals only status + a signed receipt link, no personal data. */
export const GET = handle(async (req: Request) => {
  rateLimit(req, "pay-status", 60);
  const id = new URL(req.url).searchParams.get("orderId") ?? "";
  const o = id ? await sheetRepo.findById("PendingOrders", id, { fresh: true }) : null;
  if (!o) throw new HttpError(404, "Order not found");
  const done = o["Status"] === "FINALIZED";
  return ok({
    status: o["Status"], memberId: done ? o["Member ID"] : undefined,
    receiptUrl: done && o["Payment ID"] ? `/api/receipt/${o["Payment ID"]}?t=${encodeURIComponent(signToken("receipt", o["Payment ID"], 30 * DAY))}` : undefined,
  });
});
