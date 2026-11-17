# Gym Membership Platform

Next.js 14 + TypeScript + Tailwind. **Google Sheets is the only datastore.** Razorpay payments, Resend email, Vercel cron.

## Local setup
    npm install
    cp .env.example .env.local        # fill in values (below)
    npm run sheets:init               # creates tabs, headers, default plans/settings (safe to re-run)
    npm run dev                       # http://localhost:3000   (owner login: /admin/login)
    npm test                          # date, status, renewal and token unit tests
    npm run typecheck && npm run build

## 1. Google Sheets
1. console.cloud.google.com → new project → enable **Google Sheets API**.
2. IAM → Service Accounts → create → Keys → Add key → JSON.
3. `GOOGLE_SERVICE_ACCOUNT_EMAIL` = `client_email`; `GOOGLE_PRIVATE_KEY` = `private_key` (in quotes, keep the `\n`s).
4. Create a blank Google Sheet; copy the ID from its URL into `GOOGLE_SPREADSHEET_ID`.
5. **Share** the sheet with the service-account email as **Editor**.
6. `npm run sheets:init`. Then edit plan prices in the **Plans** tab (or the Plans page).

Rules: don't reorder the first (ID) column, don't delete rows by hand. Other columns can be reordered; the app reads by header name.

## 2. Owner login
    npm run hash-password -- "your-long-password"      # paste into ADMIN_PASSWORD_HASH
    openssl rand -base64 32                            # use for AUTH_SECRET, CRON_SECRET, RENEWAL_LINK_SECRET (three different values)
Forgot password: generate a new hash and update `ADMIN_PASSWORD_HASH` in Vercel, then redeploy.

## 3. Razorpay
1. Dashboard → Settings → API Keys → `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (use Test keys first).
2. Settings → Webhooks → Add: URL `https://YOUR-DOMAIN/api/webhooks/razorpay`, secret = `RAZORPAY_WEBHOOK_SECRET`, events: **payment.captured, payment.failed, order.paid**.
3. Test with card `4111 1111 1111 1111`; use Razorpay's failure-test cards/UPI for failed payments.

## 4. Resend
Add and verify your sending domain (DNS records SPF/DKIM) at resend.com/domains, create an API key, set `EMAIL_FROM="Gym Name <no-reply@yourdomain.com>"`.

## 5. Deploy to Vercel
1. Push to GitHub → Import in Vercel (framework: Next.js).
2. Add every variable from `.env.example`; set `NEXT_PUBLIC_APP_URL` to the production URL (https).
3. Deploy. Crons are read from `vercel.json`; Vercel sends `Authorization: Bearer $CRON_SECRET` automatically when `CRON_SECRET` is set.
4. **Vercel Hobby only allows daily crons.** `retry-finalize` (every 15 min, recovers late webhooks and retries failed emails) needs Pro; on Hobby change it to `0 5 * * *` or trigger it from a free external scheduler with the bearer header.
5. Cron times are UTC and tuned for IST: status update 00:00 IST, reminders ~08:30 IST, monthly report 09:30 IST on the 1st. Dates themselves are computed in the gym's configured timezone.

## How the money flow stays safe
- Price is read from the Plans sheet on the server; the browser never sends an amount.
- `POST /api/admission/order` stores the form in **PendingOrders** and creates the Razorpay order; retries within 30 min reuse the same order.
- The browser callback and the webhook both call `finalizeOrder`, which asks Razorpay directly whether the payment is captured and the amount matches, then creates the member and payment through unique-key appends. Any step can be repeated safely.
- If Sheets fails after money is captured, the order stays `PAID_UNFINALIZED`; the recovery cron completes it. The success page polls the server, so refreshing is safe.

## Cron endpoints (all need `Authorization: Bearer $CRON_SECRET`)
update-statuses · reminders-before · reminders-after · reminders-inactive · retry-finalize · monthly-report.
Reminder idempotency key = `TYPE:memberId:expiryDate`; renewing changes the expiry so old keys never block the next cycle.

## Known limits
- Sheets has no transactions. Duplicate prevention is append-then-verify (first row wins) plus per-instance locks. Fine for a single gym's traffic; not for thousands of concurrent writes.
- Sheets API quota is ~60 requests/min/user. Reads are cached for 5 s; large member lists will get slower.
- Rate limiting is per serverless instance (best effort). Use Upstash Redis for strict global limits.
- Logo is a URL (no file upload). Password reset is via env var, not an email flow.
- No Shadcn components were generated; UI uses Tailwind with shared components in `components/ui.tsx`.
