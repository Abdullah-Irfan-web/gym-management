import { sheetRepo } from "@/lib/google-sheets/repository";
import { newId } from "@/utils/ids";
import { HttpError, isTrue, nowIso, num } from "@/utils/misc";

export interface Plan { id: string; name: string; durationValue: number; durationUnit: "day" | "month"; price: number; description: string; isActive: boolean }
const map = (r: any): Plan => ({
  id: r["Plan ID"], name: r["Plan Name"], durationValue: num(r["Duration Value"]),
  durationUnit: r["Duration Unit"] === "day" ? "day" : "month", price: num(r["Price"]), description: r["Description"], isActive: isTrue(r["Is Active"]),
});
export async function listPlans(activeOnly = false, fresh = false) {
  const all = (await sheetRepo.list("Plans", { fresh })).map(map);
  return activeOnly ? all.filter((p) => p.isActive) : all;
}
export async function getPlan(id: string, opts: { requireActive?: boolean } = {}) {
  const r = await sheetRepo.findById("Plans", id, { fresh: true });
  if (!r) throw new HttpError(400, "That membership plan no longer exists");
  const p = map(r);
  if (opts.requireActive && !p.isActive) throw new HttpError(400, "That membership plan is not available");
  return p;
}
export const durationLabel = (p: Plan) => `${p.durationValue} ${p.durationUnit}${p.durationValue > 1 ? "s" : ""}`;
export async function savePlan(input: { planId?: string; name: string; durationValue: number; durationUnit: string; price: number; description: string; isActive: boolean }) {
  const rec = {
    "Plan Name": input.name, "Duration Value": input.durationValue, "Duration Unit": input.durationUnit, Price: input.price,
    Description: input.description, "Is Active": input.isActive ? "TRUE" : "FALSE", "Updated At": nowIso(),
  };
  if (input.planId) return map(await sheetRepo.updateById("Plans", input.planId, rec as any));
  const id = newId("PLAN");
  await sheetRepo.append("Plans", { "Plan ID": id, ...rec } as any);
  return getPlan(id);
}
