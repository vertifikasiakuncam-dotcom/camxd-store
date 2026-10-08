# CAMXD Admin Web Push

This module is isolated from the dashboard UI/business logic.

## One-time Supabase setup
1. Apply `supabase/admin_push_subscriptions.sql`.
2. Deploy Edge Function `supabase/functions/send-admin-order-push/index.ts`.
3. Set these Edge Function secrets:
   - `CAMXD_VAPID_PUBLIC_KEY`
   - `CAMXD_VAPID_PRIVATE_KEY`
   - `CAMXD_ORDER_WEBHOOK_SECRET`
4. Create a Supabase Database Webhook for INSERT on `public.orders` pointing to the Edge Function URL, with header `x-camxd-webhook-secret` matching the secret.
5. In Admin, tap **Izinkan Notifikasi** once.

The private VAPID key must never be committed to GitHub.
