import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { sheetRepo } from "@/lib/google-sheets/repository";
import { getSettings } from "./settings";
import { HttpError, num } from "@/utils/misc";

export async function buildReceipt(paymentId: string): Promise<Buffer> {
  const p = await sheetRepo.findById("Payments", paymentId, { fresh: true });
  if (!p || p["Payment Status"] !== "Success") throw new HttpError(404, "Receipt not available");
  const g = await getSettings();
  const pdf = await PDFDocument.create(); const page = pdf.addPage([420, 560]);
  const f = await pdf.embedFont(StandardFonts.Helvetica), b = await pdf.embedFont(StandardFonts.HelveticaBold);
  page.drawRectangle({ x: 0, y: 490, width: 420, height: 70, color: rgb(0.07, 0.19, 0.23) });
  page.drawText(g.gymName, { x: 30, y: 520, size: 20, font: b, color: rgb(1, 1, 1) });
  page.drawText("Payment receipt", { x: 30, y: 500, size: 10, font: f, color: rgb(0.8, 0.9, 0.9) });
  const rows: [string, string][] = [
    ["Receipt no.", p["Payment ID"]], ["Date", p["Payment Date"]], ["Member", p["Member Name"]], ["Member ID", p["Member ID"]],
    ["Plan", p["Plan Name"] || "—"], ["Type", p["Payment Type"]], ["Valid", `${p["Membership Start Date"]} to ${p["Membership Expiry Date"]}`],
    ["Method", p["Payment Method"]], ["Transaction", p["Razorpay Payment ID"] || "Recorded by gym (offline)"],
  ];
  let y = 450;
  for (const [k, v] of rows) { page.drawText(k, { x: 30, y, size: 10, font: f, color: rgb(0.4, 0.45, 0.48) }); page.drawText(v.slice(0, 48), { x: 140, y, size: 10, font: b }); y -= 26; }
  page.drawLine({ start: { x: 30, y: y + 8 }, end: { x: 390, y: y + 8 }, thickness: 1, color: rgb(0.85, 0.88, 0.9) });
  // "Rs." because the built-in PDF font cannot render the rupee sign.
  page.drawText(`Amount paid: ${g.currency === "INR" ? "Rs." : g.currency} ${num(p["Payment Amount"]).toFixed(2)}`, { x: 30, y: y - 22, size: 14, font: b });
  page.drawText([g.gymPhone, g.gymEmail, g.gymAddress].filter(Boolean).join("  |  ").slice(0, 80), { x: 30, y: 30, size: 8, font: f, color: rgb(0.4, 0.45, 0.48) });
  return Buffer.from(await pdf.save());
}
