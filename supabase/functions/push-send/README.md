# Push + analytics + product ops SQL

Deploy + secret for `push-send` should already be done.

## Hook secret — do you change anything?

**No.** Run the SQL files as-is.

- `push-triggers.sql` already writes the function URL + `PUSH_HOOK_SECRET` into `app_settings_secrets`.
- `product-ops.sql` and `product-ops-v2.sql` call `enqueue_push`, which reads that row. They do **not** need a new secret pasted in.

Only re-set the secret if you rotated it in Supabase Edge Function secrets — then update `app_settings_secrets` (or re-run `push-triggers.sql` with the new value).

## In Supabase → SQL Editor (run in order)

1. `supabase/analytics-rate-limits.sql`
2. `supabase/push-triggers.sql` (re-run OK)
3. `supabase/product-ops.sql`
4. `supabase/product-ops-v2.sql`

## Redeploy Edge Function

```powershell
npx supabase functions deploy push-send --project-ref lnyozqdnxfwzgrwtcxjc
```

## Optional check

```sql
select public.run_booking_ops();
select public.booking_ops_status();
```
