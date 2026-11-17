import { handle } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { buildExport } from "@/services/reports";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const GET = handle(async (req: Request) => {
  await requireAdmin();
  const q = Object.fromEntries(new URL(req.url).searchParams) as any;
  const { buffer, filename } = await buildExport({ ...q, type: q.type ?? "members" });
  return new Response(new Uint8Array(buffer), { headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${filename}"` } });
});
