"use client";
import { api } from "./ui";

declare global { interface Window { Razorpay?: any } }
function loadScript(): Promise<void> {
  return new Promise((res, rej) => {
    if (window.Razorpay) return res();
    const s = document.createElement("script"); s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => res(); s.onerror = () => rej(new Error("Couldn't load the payment window. Check your connection and try again.")); document.body.appendChild(s);
  });
}
export interface Order { orderId: string; amount: number; currency: string; keyId: string; planName: string; gymName: string; prefill: { name: string; email: string; contact: string } }

/** Opens Razorpay. The success callback only triggers server verification — it never marks anything paid itself. */
export async function openCheckout(o: Order, onDone: (orderId: string) => void, onDismiss: () => void, onError: (m: string) => void) {
  try { await loadScript(); } catch (e: any) { return onError(e.message); }
  const rz = new window.Razorpay({
    key: o.keyId, order_id: o.orderId, amount: Math.round(o.amount * 100), currency: o.currency, name: o.gymName, description: `${o.planName} membership`, prefill: o.prefill,
    theme: { color: "#0e7c86" }, modal: { ondismiss: onDismiss },
    handler: async (r: any) => {
      try { await api("/api/payments/verify", { method: "POST", json: r }); } catch { /* the success page keeps polling; webhook/recovery cron will finalize */ }
      onDone(o.orderId);
    },
  });
  rz.on("payment.failed", (r: any) => onError(r?.error?.description ?? "Payment failed. You haven't been charged — please try again."));
  rz.open();
}
