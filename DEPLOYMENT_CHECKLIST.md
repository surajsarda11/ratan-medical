# Before going live

- [ ] Create a Supabase project and save its project URL and publishable key in a password manager.
- [ ] Run `supabase/migrations/202610180001_initial_schema.sql` in the intended project.
- [ ] Run `supabase/migrations/202610180003_whatsapp_consent.sql` after the initial schema.
- [ ] Confirm both migrations finished without SQL errors.
- [ ] Create the shopkeeper account in Supabase Authentication; disable public registration if appropriate.
- [ ] Copy `.env.example` to `.env.local` for local testing only; never commit it.
- [ ] `npm install`, `npm test`, `npm run check`, and `npm run build` succeed.
- [ ] Create one test booking with ₹0 advance and one with a variable advance.
- [ ] Test duplicate invoice upload; ensure the second identical import is blocked.
- [ ] Test two bookings competing for a small invoice quantity; confirm the same units cannot be allocated twice.
- [ ] Test a similar-name product with a different strength / pack size and leave it unmatched unless manually verified.
- [ ] Test partial receipt and confirm the booking is not fully ready until the entire requested quantity is received.
- [ ] Confirm MRP must be checked before settlement; confirm purchase rate is never used as MRP.
- [ ] Test partial pickup, balance due, excess advance and the refund-due path.
- [ ] Verify a refund is marked paid only after the customer actually receives it.
- [ ] Test Quick Booking with both "Customer agreed" and "Customer did not agree" selections.
- [ ] Confirm old bookings show "Not recorded" and can be updated from booking details.
- [ ] Confirm WhatsApp draft / mark-sent actions are blocked unless consent is "Agreed".
- [ ] Open an allowed WhatsApp draft; confirm the app never claims it was sent until manually marked sent.
- [ ] Check access with a second unrelated Supabase user; the second user must not see this shop's rows.
- [ ] Configure Vercel environment variables for the correct environments and deploy.
- [ ] Confirm the hosted app login, booking create, import, allocation and settlement flow work on both mobile and desktop.
- [ ] Set up database backups and decide who can access customer phone numbers.
- [ ] Pilot with a small, non-sensitive set of test records before recording real customer information.

## Known first-release boundaries

- Official WhatsApp Business Platform automation is not configured.
- Push notifications / scheduled reminder sending are not configured.
- Shared multi-staff shop membership and roles are not configured.
- No formal tax invoice or PDF bill is issued.
