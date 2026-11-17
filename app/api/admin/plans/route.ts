import { handle, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { listPlans, savePlan } from "@/services/plans";
import { planSchema } from "@/schemas";
import { audit } from "@/services/audit";
export const dynamic = "force-dynamic";
export const GET = handle(async () => { await requireAdmin(); return ok({ plans: await listPlans(false, true) }); });
export const POST = handle(async (req: Request) => {
  const s = await requireAdmin();
  const plan = await savePlan(planSchema.parse(await req.json()) as any);
  await audit(s.email, "PLAN_SAVED", "Plan", plan.id, plan);
  return ok(plan);
});
