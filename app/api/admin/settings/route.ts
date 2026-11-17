import { handle, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { getSettings, saveSettings } from "@/services/settings";
import { settingsSchema } from "@/schemas";
import { audit } from "@/services/audit";
export const dynamic = "force-dynamic";
export const GET = handle(async () => { await requireAdmin(); return ok(await getSettings()); });
export const PUT = handle(async (req: Request) => {
  const s = await requireAdmin();
  const v = settingsSchema.parse(await req.json());
  await saveSettings(v as Record<string, string>);
  await audit(s.email, "SETTINGS_UPDATED", "Settings", "gym", v);
  return ok(await getSettings());
});
