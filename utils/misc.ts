export const normEmail = (s: string) => s.trim().toLowerCase();
/** Compare phones on the last 10 digits so "+91 98765-43210" == "9876543210". */
export const normPhone = (s: string) => s.replace(/\D/g, "").slice(-10);
export const nowIso = () => new Date().toISOString();
export const money = (n: number | string, cur = "INR") =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: cur, maximumFractionDigits: 2 }).format(Number(n) || 0);
export const num = (s: string | undefined) => Number(s) || 0;
export const isTrue = (s: string | undefined) => String(s).toLowerCase() === "true";
export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
