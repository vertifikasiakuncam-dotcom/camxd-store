-- CAMXD Store — Supabase Security Hardening
-- Jalankan SATU KALI di Supabase SQL Editor setelah versi ini masuk GitHub.
-- Tujuan: customer tidak lagi bisa mengubah status/order langsung dari browser.
-- Customer hanya boleh mengirim bukti melalui RPC yang memeriksa ID Pesanan + WhatsApp.

begin;

-- 1) Pastikan customer anonim tetap boleh membuat pesanan,
--    tetapi TIDAK boleh melakukan UPDATE langsung ke orders.
revoke update on table public.orders from anon;

-- 2) RPC khusus customer untuk mengirim bukti pembayaran.
--    SECURITY DEFINER diperlukan karena anon tidak lagi memiliki UPDATE.
create or replace function public.submit_payment_proof(
  p_order_id text,
  p_customer_wa text,
  p_payment_proof_path text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_wa text;
begin
  if coalesce(trim(p_order_id), '') = '' then
    raise exception 'ID pesanan tidak boleh kosong';
  end if;

  if coalesce(trim(p_customer_wa), '') = '' then
    raise exception 'Nomor WhatsApp tidak boleh kosong';
  end if;

  if coalesce(trim(p_payment_proof_path), '') = '' then
    raise exception 'Bukti pembayaran tidak boleh kosong';
  end if;

  -- Bukti harus berada di folder ID pesanan.
  if p_payment_proof_path !~ ('^' || regexp_replace(p_order_id, '[^A-Za-z0-9_-]', '', 'g') || '/')
  then
    raise exception 'Lokasi bukti pembayaran tidak valid';
  end if;

  select *
    into v_order
    from public.orders
   where order_id = p_order_id
     and customer_wa = p_customer_wa
   limit 1
   for update;

  if not found then
    raise exception 'Pesanan tidak ditemukan atau data pelanggan tidak cocok';
  end if;

  if v_order.status in ('Sudah Dibayar', 'Sedang Diproses', 'Selesai', 'Dibatalkan') then
    raise exception 'Status pesanan tidak dapat menerima bukti pembayaran lagi';
  end if;

  v_wa := regexp_replace(p_customer_wa, '\\D', '', 'g');
  if length(v_wa) < 8 then
    raise exception 'Nomor WhatsApp tidak valid';
  end if;

  update public.orders
     set payment_proof_path = p_payment_proof_path,
         payment_proof_uploaded_at = now(),
         status = 'Menunggu Verifikasi'
   where id = v_order.id;

  return true;
end;
$$;

-- 3) RPC ini hanya untuk customer anonim/authenticated.
revoke all on function public.submit_payment_proof(text, text, text) from public;
grant execute on function public.submit_payment_proof(text, text, text) to anon, authenticated;

commit;

-- CATATAN:
-- Jangan memberikan service_role key ke browser.
-- Admin tetap menggunakan Supabase Auth + tabel admin_users.
