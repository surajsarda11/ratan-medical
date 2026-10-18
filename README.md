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
- Server-side settlement calculation without a discount field, advance-applied ledger, balance payable / refund due and an editable itemized text bill. Refund payments are explicitly allocated between settlement refunds and unused advances to avoid double-counting.
- Manual WhatsApp Messenger / WhatsApp Web click-to-chat for booking, pickup and delivery-completed bill drafts. Copy, download and print are also available for settlement text. Opening a draft is logged separately from the shopkeeper manually confirming that it was sent.
- Follow-up reminders, reminder history, editable shop footer and settings.
- Tests for settlement arithmetic, conservative matching and invoice fingerprints.

## Not live / requires setup

The production app is deployed at https://ratan-medical.vercel.app/. This repository does not contain production secrets or customer records. A separate local or hosted copy needs its own Supabase project and Vercel configuration as described below.

- WhatsApp uses ordinary click-to-chat only: the app opens a prefilled draft in WhatsApp Messenger / WhatsApp Web and the shopkeeper sends it manually. No WhatsApp API credentials, automatic sending or delivery webhooks are used.
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

   Then run the follow-up migration:

   `supabase/migrations/202610180003_whatsapp_consent.sql`

   This adds an explicit WhatsApp consent field, consent-update history and consent-aware booking creation. Existing bookings remain **Not recorded** until staff asks the customer and saves a choice. Review the SQL before applying it to any production database.

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

Open the booking and verify every MRP to be sold. Choose **Record pickup / settlement**, enter the collected quantity for each item, how much existing advance to apply, and any additional payment received now. The sale total is calculated from the recorded quantities and verified MRP; there is no discount field. The database checks quantities and prices again before saving. If money is overpaid, the result is a **refund due**; record a refund payment from the booking ledger only after refunding the customer.

### WhatsApp Messenger

The app uses ordinary WhatsApp Messenger / WhatsApp Web click-to-chat links. The shopkeeper reviews and sends the prefilled message manually; the app does not send automatically or connect to a WhatsApp API. Booking, order-ready and settlement-bill drafts are available only when the customer is recorded as having agreed to receive WhatsApp messages. A **Not agreed** or **Not recorded** choice blocks outbound draft and manual-send-confirmation actions. Opening a draft is recorded separately from **Mark sent**, which is only the shopkeeper's confirmation and not proof of delivery. Settlement pages also offer **Copy text bill**, **Download .txt** and **Print bill**.
## Sample data and tests

- Sample invoice: `public/samples/purchase-invoice-sample.csv`
- Automated tests: `tests/finance.test.ts`, `tests/matching.test.ts`, `tests/fingerprint.test.ts`

Commands:

```bash
npm test
npm run check
npm run build
```

The unit tests cover the pure financial calculation, matching rules and fingerprint behavior. Before real use, also test database authorization with two different Supabase users, booking creation with zero / variable advance, duplicate CSV import, partial receipt allocation, strength / pack mismatches, manual MRP verification, partial pickup, settlement refunds, and manual WhatsApp draft opening and consent gating. The SQL functions enforce the critical stock and settlement constraints, but the first live deployment still requires owner configuration and a controlled pilot.

## Deployment cost caveat

Vercel and Supabase offer free tiers, but quotas and commercial terms can change and may differ by account / region. Check current provider pricing and usage limits before relying on a free plan for a business workflow. This app intentionally avoids a paid WhatsApp provider in the first release.
