import { handle } from "@/lib/api";
import { verifyToken } from "@/lib/auth/tokens";
import { getSession } from "@/lib/auth/session";
import { buildReceipt } from "@/services/receipt";
import { HttpError } from "@/utils/misc";
export const dynamic = "force-dynamic";
export const GET = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const t = new URL(req.url).searchParams.get("t");
  const allowed = (t && verifyToken("receipt", t) === params.id) || !!(await getSession());
  if (!allowed) throw new HttpError(403, "Receipt link is invalid or expired");
  const pdf = await buildReceipt(params.id);
  return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="receipt-${params.id}.pdf"` } });
});
