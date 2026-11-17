import { z } from "zod";

const phone = z.string().trim().refine((v) => v.replace(/\D/g, "").length >= 10 && v.replace(/\D/g, "").length <= 13, "Enter a valid mobile number");
const optional = z.string().trim().max(200).optional().default("");
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const memberDetails = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone,
  address: optional,
  gender: z.enum(["Male", "Female", "Other", ""]).optional().default(""),
  dateOfBirth: dateStr.or(z.literal("")).optional().default(""),
  emergencyContact: optional,
});
/** Note: price/amount is deliberately NOT accepted from the client. */
export const admissionSchema = memberDetails.extend({ planId: z.string().min(1) });
export const renewLookupSchema = z.object({
  email: z.string().trim().toLowerCase().email().optional(),
  phone: phone.optional(),
  token: z.string().optional(),
}).refine((v) => v.token || (v.email && v.phone), "Enter your email and mobile number");
export const renewOrderSchema = z.object({ session: z.string().min(10), planId: z.string().min(1) });
export const verifySchema = z.object({
  razorpay_order_id: z.string(), razorpay_payment_id: z.string(), razorpay_signature: z.string(),
});
export const planSchema = z.object({
  planId: z.string().optional(),
  name: z.string().trim().min(2).max(60),
  durationValue: z.coerce.number().int().min(1).max(120),
  durationUnit: z.enum(["day", "month"]),
  price: z.coerce.number().positive().max(10_000_000),
  description: z.string().trim().max(300).optional().default(""),
  isActive: z.boolean().optional().default(true),
});
export const manualAdmitSchema = memberDetails.extend({
  planId: z.string().min(1),
  amountPaid: z.coerce.number().min(0),
  paymentMethod: z.enum(["Cash", "UPI", "Bank Transfer", "Card", "Other"]),
  startDate: dateStr.optional(),
});
export const manualRenewSchema = z.object({
  planId: z.string().min(1),
  amountPaid: z.coerce.number().min(0),
  paymentMethod: z.enum(["Cash", "UPI", "Bank Transfer", "Card", "Other"]),
});
export const memberPatchSchema = z.object({
  fullName: z.string().trim().min(2).max(100).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  phone: phone.optional(),
  address: z.string().max(200).optional(),
  gender: z.enum(["Male", "Female", "Other", ""]).optional(),
  dateOfBirth: dateStr.or(z.literal("")).optional(),
  emergencyContact: z.string().max(200).optional(),
  membershipStartDate: dateStr.optional(),
  membershipExpiryDate: dateStr.optional(),
  membershipPlan: z.string().max(60).optional(),
  reason: z.string().trim().min(3, "Give a reason for the change").max(300).optional(),
});
export const settingsSchema = z.object({
  "Gym Name": z.string().trim().min(1).max(80),
  "Gym Email": z.string().trim().email().or(z.literal("")),
  "Gym Phone": z.string().trim().max(30),
  "Gym Address": z.string().trim().max(200),
  "Owner Email": z.string().trim().email(),
  "Logo URL": z.string().trim().url().or(z.literal("")),
  "Currency": z.string().trim().length(3),
  "Timezone": z.string().trim().min(3),
  "Grace Period Days": z.coerce.number().int().min(0).max(365).transform(String),
  "Reminder Days Before": z.coerce.number().int().min(1).max(30).transform(String),
  "Reminder Days After": z.coerce.number().int().min(1).max(30).transform(String),
});
export const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(200) });
