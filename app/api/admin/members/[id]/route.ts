import { handle, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { getMember } from "@/services/members";
import { updateMember } from "@/services/admin";
import { memberPatchSchema } from "@/schemas";
import { sheetRepo } from "@/lib/google-sheets/repository";
import { HttpError } from "@/utils/misc";
export const dynamic = "force-dynamic";
export const GET = handle(async (_r: Request, { params }: { params: { id: string } }) => {
  await requireAdmin();
  const member = await getMember(params.id);
  if (!member) throw new HttpError(404, "Member not found");
  const [payments, notifications, audits] = await Promise.all([
    sheetRepo.search("Payments", (p) => p["Member ID"] === params.id, { fresh: true }),
    sheetRepo.search("Notifications", (n) => n["Member ID"] === params.id, { fresh: true }),
    sheetRepo.search("AuditLogs", (a) => a["Entity ID"] === params.id, { fresh: true }),
  ]);
  const by = <T extends Record<string, string>>(k: string) => (a: T, b: T) => (b[k] ?? "").localeCompare(a[k] ?? "");
  return ok({ member, payments: payments.sort(by("Created At")), notifications: notifications.sort(by("Updated At")), audits: audits.sort(by("Timestamp")) });
});
export const PATCH = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const s = await requireAdmin();
  await updateMember(s.email, params.id, memberPatchSchema.parse(await req.json()));
  return ok(await getMember(params.id));
});
