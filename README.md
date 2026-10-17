# Ratan Medical Hall — Booking & Settlement Manager

A mobile-responsive internal web app for a physical pharmacy. Built with Next.js 16, React 19, TypeScript, Tailwind CSS and Supabase. It is not an e-commerce site, prescription consultation platform, or formal tax-invoice generator.

## Included in this first release

- Supabase email/password authentication and user-scoped Row Level Security (RLS).
- Dashboard with exact counts and amounts calculated server-side from saved records.
- New booking form, variable advance payment, multiple medicine lines and audit timeline.
- Booking search, filters, status and receipt-progress tracking.
- Supplier invoice CSV upload, column mapping and preview.
- Exact / possible / no-safe-match suggestions, manual row review, duplicate-file detection and explicit receipt allocation.
- Atomic receipt allocation that prevents the same invoice quantity from being allocated twice, locks records to avoid concurrent over-allocation, and caps allocation at the booking's remaining request.
- Verified-MRP gate before settlement. Purchase rate is never used as MRP.
- Server-side settlement calculation, advance-applied ledger, balance payable / refund due and an editable WhatsApp text draft. Refund payments are explicitly allocated between settlement refunds and unused advances to avoid double-counting.
- WhatsApp click-to-chat for booking, pickup and settlement messages. Opening a draft is logged separately from the shopkeeper manually confirming that it was sent.
- Follow-up reminders, reminder history, editable shop footer and settings.
- Tests for settlement arithmetic, conservative matching and invoice fingerprints.

## Not live / requires setup

This repository is a source project, **not an already deployed website**. It is not connected to a Supabase project and has no secrets or customer data. You need to create the Supabase project and Vercel deployment as described below.

- Fully automatic WhatsApp messaging is not implemented. Official WhatsApp Business Platform integration needs a Meta business setup, approved templates / consent as required, a phone number ID, access token, webhook configuration and may incur provider charges. Ordinary click-to-chat only opens a prefilled draft.
- Reminders are stored in the app but are not delivered as push notifications or automatically messaged. There is no background scheduler in this release.
- This first release is one-account / one-data-owner oriented. Extra staff sharing one shop's data would need an explicit membership/roles table and corresponding RLS policies; do not simply give every staff member a separate login and expect the data to be shared.
- CSV import preview is limited to 2.5 MB and 5,000 rows per file; it only allocates incoming invoice units to existing bookings. It is not a complete inventory / batch-expiry stock ledger for products that have not been booked.
- The app does not prescribe, recommend substitutions or provide dosage advice. The prescription checkbox is a shopkeeper workflow marker, not a clinical validation service.
- It does not issue a statutory tax invoice or PDF bill. The shop remains responsible for sale, pricing, prescription checks and applicable billing requirements. Full post-sale returns / sale reversals are not implemented; the app blocks marking an already-picked-up sale as returned. It does support refunds of unused advances for uncollected bookings.

## Requirements

- Node.js 20.9+ (Node 22 LTS recommended)
- npm
- A Supabase project
- A Vercel account (or any compatible Next.js host)
- Git / GitHub for the easiest deploy flow

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in the public browser-safe Supabase values from **Supabase → Project Settings → API**:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

   Use the Supabase **publishable** key (or legacy anon key if that is what the project provides). Do not put a service-role / secret key in a `NEXT_PUBLIC_` variable or commit any real key to Git.

3. In Supabase, open **SQL Editor** and run the entire file:

   `supabase/migrations/202610180001_initial_schema.sql`

   This creates the tables, indexes, RLS policies, limited API grants and server-side functions used for atomic booking creation, receipt allocation and settlement. Review the SQL before applying it to any production database.

4. In **Supabase → Authentication → Users**, create an authorized shopkeeper user. In Authentication settings, disable public sign-up if this is to remain an internal-only workspace. Use the dashboard/admin path to add staff only after a shared-shop access model is implemented.

5. Start the app:

   ```bash
   npm run dev
   ```

6. Open `http://localhost:3000`, sign in with the account you created, and test the supplied sample invoice at `public/samples/purchase-invoice-sample.csv`.

## Deploy to Vercel

### Method A — GitHub import (recommended)

1. Create an empty GitHub repository, then from this folder run:

   ```bash
   git init
   git add .
   git commit -m "Initial Ratan Medical Hall app"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
   git push -u origin main
   ```

   Replace the example GitHub URL with your own. Do not add `.env.local` to Git; it is ignored already.

2. Open [Vercel](https://vercel.com/), choose **Add New → Project**, import the repository, and keep the detected Next.js framework defaults.

3. Before deploying, add these variables under **Project → Settings → Environment Variables** for Production (and Preview if you use preview deployments):

   - `NEXT_PUBLIC_SUPABASE_URL` — your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — your Supabase publishable/anon key

4. Click **Deploy**. The generated `*.vercel.app` domain will be your web app address. Visit it and sign in with the Supabase shopkeeper user.

5. If you change environment variables, redeploy; existing deployments do not automatically inherit later changes.

### Method B — Vercel CLI

With the Vercel CLI installed and logged in:

```bash
npm install
npm run check
npm test
npm run build
npx vercel link
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
npx vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY production
npx vercel deploy --prod
```

The CLI prompts for the project, organization and variable values. You can also configure environment variables through the Vercel web UI. For a first deployment, GitHub import is usually simpler.

## Database / security notes

- Every shop data row has `owner_id`; RLS policies restrict access to `auth.uid()`.
- Composite foreign keys keep booking, import and receipt rows within the same data owner.
- The app never uses a Supabase service-role key in the browser.
- Settlement totals are recomputed by `finalize_settlement` from saved requested quantities, received quantities and verified MRP, not from client-provided prices.
- Critical stock, booking-status, MRP, payment, refund-allocation, and settlement writes go through owner-checked database functions. Column-level grants prevent ordinary web sessions from directly editing receipt quantities or settlement amounts. `allocate_invoice_receipt` locks invoice/booking records, checks remaining invoice units and demand, and writes an allocation/audit event in one database transaction.
- The dashboard totals are computed by an owner-scoped database function so they are not silently truncated to the most recent page of rows.
- Financial and audit tables do not receive delete privileges through the Supabase Data API. Corrections should be recorded as additional payment/refund/adjustment events, not by deleting history.
- The shopkeeper has to verify MRP against the pack. A CSV MRP is not automatically trusted. Purchase rate is never used as MRP.
- Only collect the minimum customer data needed for the booking and follow-ups. Avoid diagnoses, medical history, Aadhaar and other unnecessary sensitive data.

## Key workflows

### New booking

Open **New Booking**, enter the phone number and medicine identity, add requested quantities and record the advance if any. The initial state is **Awaiting Stock**. The app saves the advance separately from any eventual sale and creates an expected-arrival reminder when a date is provided.

### Purchase invoice CSV

Open **Purchase CSV Import**, upload the file, map the columns, inspect the preview, then open the draft. A suggested medicine match is not yet a stock update. Choose the booking line, enter the quantity to allocate and confirm the MRP only after checking the physical pack. The database prevents allocating a row's incoming quantity more than once or receiving more than the booking still needs. Repeat allocations are allowed only for remaining units.

A duplicate invoice file with the same mapped contents, supplier, invoice number and date is blocked using a content fingerprint and unique database constraint. If a supplier corrects an invoice, review the differences and use a separate, auditable process rather than silently overwriting the first import.

### Pickup and settlement

Open the booking and verify every MRP to be sold. Choose **Record pickup / settlement**, enter the collected quantity for each item, the authorized discount, how much existing advance to apply, and any additional payment received now. The database checks quantities and prices again before saving. If money is overpaid, the result is a **refund due**; record a refund payment from the booking ledger only after refunding the customer.

### WhatsApp

Use **Open WhatsApp draft** to open WhatsApp / WhatsApp Web with prefilled text. You must review and send it in WhatsApp yourself. The app records that a draft was opened separately from the **Mark sent (manual confirmation)** action. That latter record means the shopkeeper confirmed it manually; it is not a provider delivery receipt.

## Sample data and tests

- Sample invoice: `public/samples/purchase-invoice-sample.csv`
- Automated tests: `tests/finance.test.ts`, `tests/matching.test.ts`, `tests/fingerprint.test.ts`

Commands:

```bash
npm test
npm run check
npm run build
```

The unit tests cover the pure financial calculation, matching rules and fingerprint behavior. Before real use, also test database authorization with two different Supabase users, booking creation with zero / variable advance, duplicate CSV import, partial receipt allocation, strength / pack mismatches, manual MRP verification, partial pickup, settlement refunds, and WhatsApp provider failure/fallback. The SQL functions enforce the critical stock and settlement constraints, but the first live deployment still requires owner configuration and a controlled pilot.

## Deployment cost caveat

Vercel and Supabase offer free tiers, but quotas and commercial terms can change and may differ by account / region. Check current provider pricing and usage limits before relying on a free plan for a business workflow. This app intentionally avoids a paid WhatsApp provider in the first release.


## Optional staff quick-booking mode

To enable staff accounts without exposing the owner workspace:

1. Run `supabase/migrations/202610180002_staff_quick_booking.sql` in the Supabase SQL Editor.
2. In Vercel Project Settings → Environment Variables, add `SUPABASE_SERVICE_ROLE_KEY` for Production and Preview. Use the Supabase **service-role secret** only in this server-side variable; never use a `NEXT_PUBLIC_` prefix and never commit the key to Git.
3. In Supabase Authentication → URL Configuration, allow `https://ratan-medical.vercel.app/auth/callback` as a redirect URL (and confirm the site URL is set to the deployed application domain). Email delivery/SMTP must be configured to deliver invitations.
4. Sign in with the owner account, open **Staff Members**, and invite each staff member by email. Staff set their own password from the invitation email.
6. Staff sign in with that email/password and land on **Quick Booking**. Their form requires customer mobile number, medicine name and quantity; all other details are optional. Staff can see only their own bookings and cannot access stock allocation, verified MRP, settlement/refund, invoice import, settings or staff management.

The migration keeps existing owner-scoped records in place. Staff-created bookings are saved under the shop owner's data scope and are tagged with the staff user's ID. Disabling a staff membership blocks access on the next request. Test using sample data before using the feature with live customer records.
