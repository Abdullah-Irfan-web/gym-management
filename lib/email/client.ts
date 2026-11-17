import { Resend } from "resend";
let r: Resend | null = null;
export async function sendEmail(opts: { to: string; subject: string; html: string; attachments?: { filename: string; content: Buffer }[] }) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) throw new Error("Email is not configured (RESEND_API_KEY / EMAIL_FROM)");
  r ??= new Resend(process.env.RESEND_API_KEY);
  const { error } = await r.emails.send({ from: process.env.EMAIL_FROM, to: opts.to, subject: opts.subject, html: opts.html, attachments: opts.attachments });
  if (error) throw new Error(error.message);
}
