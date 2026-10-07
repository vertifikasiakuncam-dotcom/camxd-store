-- CAMXD Store payment proof setup
alter table public.orders
  add column if not exists payment_proof_path text,
  add column if not exists payment_proof_uploaded_at timestamptz;

insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do update set public = false;

drop policy if exists "CAMXD payment proof upload" on storage.objects;
create policy "CAMXD payment proof upload"
on storage.objects for insert
to anon, authenticated
with check (
  bucket_id = 'payment-proofs'
  and (storage.foldername(name))[1] ~ '^CX[0-9]{8}$'
);

drop policy if exists "CAMXD payment proof admin read" on storage.objects;
create policy "CAMXD payment proof admin read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'payment-proofs'
  and public.is_admin()
);