import { handle, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { manualRenew } from "@/services/admin";
import { manualRenewSchema } from "@/schemas";
export const POST = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const s = await requireAdmin();
  return ok(await manualRenew(s.email, params.id, manualRenewSchema.parse(await req.json())));
});
