import { sheetRepo } from "@/lib/google-sheets/repository";
import { newId } from "@/utils/ids";
import { nowIso } from "@/utils/misc";

export async function audit(actor: string, action: string, entity: string, entityId: string, details: unknown = {}) {
  try {
    await sheetRepo.append("AuditLogs", {
      "Log ID": newId("LOG"), Timestamp: nowIso(), Actor: actor, Action: action, Entity: entity, "Entity ID": entityId, "Details JSON": JSON.stringify(details),
    });
  } catch (e) { console.error("[audit] failed", e); } // auditing must never block the main operation
}
