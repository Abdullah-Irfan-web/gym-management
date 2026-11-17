import { handle, ok, cronAuth } from "@/lib/api";
import { sendMonthlyReport } from "@/services/reports";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const GET = handle(async (req: Request) => { cronAuth(req); return ok({ result: await sendMonthlyReport() }); });
