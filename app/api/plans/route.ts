import { handle, ok } from "@/lib/api";
import { listPlans } from "@/services/plans";
import { getSettings } from "@/services/settings";
export const dynamic = "force-dynamic";
export const GET = handle(async () => {
  const [plans, s] = await Promise.all([listPlans(true), getSettings()]);
  return ok({ plans, gym: { name: s.gymName, logoUrl: s.logoUrl, phone: s.gymPhone, address: s.gymAddress, currency: s.currency } });
});
