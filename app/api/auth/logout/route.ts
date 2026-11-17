import { handle, ok } from "@/lib/api";
import { destroySession } from "@/lib/auth/session";
export const POST = handle(async () => { destroySession(); return ok(); });
