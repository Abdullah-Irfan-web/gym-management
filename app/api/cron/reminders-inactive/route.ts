import { handle, ok, cronAuth } from "@/lib/api";
import { updateStatuses, sendReminders } from "@/services/cron";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const GET = handle(async (req: Request) => { cronAuth(req); void sendReminders; void updateStatuses; return ok(await sendReminders('INACTIVE')); });
