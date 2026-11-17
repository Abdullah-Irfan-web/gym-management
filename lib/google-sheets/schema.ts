/**
 * Single definition of every worksheet. Column order here is the order
 * written by `sheets:init`, but the code always resolves columns BY HEADER NAME,
 * so the owner can reorder/add columns in the sheet without breaking the app.
 * The first column is the permanent unique key.
 */
export const SHEETS = {
  Members: [
    "Member ID", "Full Name", "Email", "Phone Number", "Address", "Gender",
    "Date of Birth", "Emergency Contact", "Enrollment Date", "Membership Start Date",
    "Membership Expiry Date", "Membership Plan", "Membership Duration",
    "Membership Amount", "Amount Paid", "Payment Status", "Membership Status",
    "Last Payment Date", "Next Renewal Date", "Created At", "Updated At",
  ],
  Payments: [
    "Payment ID", "Member ID", "Member Name", "Payment Amount", "Payment Date",
    "Payment Method", "Razorpay Order ID", "Razorpay Payment ID",
    "Razorpay Signature Verification Status", "Payment Type", "Payment Status",
    "Membership Start Date", "Membership Expiry Date", "Source", "Created At", "Plan Name",
  ],
  Plans: ["Plan ID", "Plan Name", "Duration Value", "Duration Unit", "Price", "Description", "Is Active", "Updated At"],
  Notifications: [
    "Notification ID", "Member ID", "Member Email", "Notification Type", "Scheduled Date",
    "Sent Date", "Notification Status", "Error Message", "Idempotency Key", "Attempts", "Updated At",
  ],
  Settings: ["Key", "Value", "Updated At"],
  PendingOrders: [
    "Razorpay Order ID", "Kind", "Payload JSON", "Amount", "Status", "Payment ID",
    "Member ID", "Fingerprint", "Created At", "Updated At",
  ],
  WebhookEvents: ["Event ID", "Event Type", "Received At", "Result"],
  AuditLogs: ["Log ID", "Timestamp", "Actor", "Action", "Entity", "Entity ID", "Details JSON"],
} as const;

export type SheetName = keyof typeof SHEETS;
export type Row<S extends SheetName> = Record<(typeof SHEETS)[S][number], string>;
export const keyColumn = <S extends SheetName>(s: S): string => SHEETS[s][0];

export const DEFAULT_SETTINGS: Record<string, string> = {
  "Gym Name": "My Gym", "Gym Email": "", "Gym Phone": "", "Gym Address": "",
  "Owner Email": "", "Currency": "INR", "Timezone": "Asia/Kolkata",
  "Grace Period Days": "20", "Reminder Days Before": "3", "Reminder Days After": "3",
};

export const DEFAULT_PLANS: string[][] = [
  ["PLAN-MONTHLY", "Monthly", "1", "month", "1000", "Full gym access for 1 month", "TRUE"],
  ["PLAN-QUARTERLY", "Quarterly", "3", "month", "2700", "Full gym access for 3 months", "TRUE"],
  ["PLAN-HALFYEARLY", "Half-Yearly", "6", "month", "5000", "Full gym access for 6 months", "TRUE"],
  ["PLAN-YEARLY", "Yearly", "12", "month", "9000", "Full gym access for 12 months", "TRUE"],
];
export type Input<S extends SheetName> = Partial<Record<keyof Row<S>, string | number | boolean>>;
