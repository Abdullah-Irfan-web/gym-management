import { sheetRepo } from "@/lib/google-sheets/repository";
import { DEFAULT_SETTINGS } from "@/lib/google-sheets/schema";
import { nowIso } from "@/utils/misc";

export interface GymSettings {
  gymName: string; gymEmail: string; gymPhone: string; gymAddress: string; ownerEmail: string; logoUrl: string;
  currency: string; timezone: string; graceDays: number; remindBefore: number; remindAfter: number;
}
export async function getSettings(): Promise<GymSettings> {
  const m = { ...DEFAULT_SETTINGS, ...(await sheetRepo.getSettings()) };
  return {
    gymName: m["Gym Name"]!, gymEmail: m["Gym Email"]!, gymPhone: m["Gym Phone"]!, gymAddress: m["Gym Address"]!,
    ownerEmail: m["Owner Email"] || process.env.ADMIN_EMAIL || "", logoUrl: m["Logo URL"] ?? "",
    currency: m["Currency"] || "INR", timezone: m["Timezone"] || "Asia/Kolkata",
    graceDays: Number(m["Grace Period Days"] ?? 20), remindBefore: Number(m["Reminder Days Before"] ?? 3), remindAfter: Number(m["Reminder Days After"] ?? 3),
  };
}
export async function saveSettings(values: Record<string, string>) {
  const existing = new Set((await sheetRepo.list("Settings", { fresh: true })).map((r) => r.Key));
  for (const [k, v] of Object.entries(values)) {
    if (existing.has(k)) await sheetRepo.updateById("Settings", k, { Value: v });
    else await sheetRepo.append("Settings", { Key: k, Value: v, "Updated At": nowIso() });
  }
}
