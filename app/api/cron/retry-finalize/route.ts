import { handle, ok, cronAuth } from "@/lib/api";
import { recoverOrders } from "@/services/payments";
import { retryFailed } from "@/services/notifications";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const GET = handle(async (req: Request) => { cronAuth(req); return ok({ orders: await recoverOrders(), emails: await retryFailed() }); });
