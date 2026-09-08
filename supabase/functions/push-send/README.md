# Push + analytics + product ops SQL

Deploy + secret for `push-send` should already be done.

## In Supabase → SQL Editor (run in order)

1. `supabase/analytics-rate-limits.sql`
2. `supabase/push-triggers.sql` (re-run OK — Arabic + deep-link data)
3. `supabase/product-ops.sql` (search-alert push, booking SLA/auto-complete/review nudge, owner insights, report close push, review replies, chat images)

## Redeploy Edge Function (after SQL)

```powershell
npx supabase functions deploy push-send --project-ref lnyozqdnxfwzgrwtcxjc
```

Needed so push payloads include `data` for deep links.

## Optional check

```sql
select public.run_booking_ops();
```
