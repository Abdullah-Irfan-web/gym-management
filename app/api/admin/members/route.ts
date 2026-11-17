import { handle, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { loadMembers } from "@/services/members";
import { filterMembers } from "@/services/query";
import { manualAdmit } from "@/services/admin";
import { manualAdmitSchema } from "@/schemas";
export const dynamic = "force-dynamic";
export const GET = handle(async (req: Request) => {
  await requireAdmin();
  const q = Object.fromEntries(new URL(req.url).searchParams);
  const { members, today } = await loadMembers();
  return ok({ today, members: filterMembers(members, q) });
});
export const POST = handle(async (req: Request) => {
  const s = await requireAdmin();
  return ok(await manualAdmit(s.email, manualAdmitSchema.parse(await req.json())), 201);
});
