-- CAMXD Store — Product features: voucher, stock, sales count, transaction proof
-- Jalankan SATU KALI di Supabase SQL Editor.
-- Fitur ini menambah metadata produk tanpa mengubah alur checkout/pembayaran yang sudah stabil.

begin;

alter table public.products
  add column if not exists stock_quantity integer,
  add column if not exists voucher_code text,
  add column if not exists transaction_proof_url text;

alter table public.products
  drop constraint if exists products_stock_quantity_nonnegative;

alter table public.products
  add constraint products_stock_quantity_nonnegative
  check (stock_quantity is null or stock_quantity >= 0);

-- Product images bucket is already used by the existing admin product editor.
-- Keep it public for existing catalog images and allow admins to upload proof images
-- under the same bucket without exposing any service_role key.
drop policy if exists "CAMXD admin product image upload" on storage.objects;
create policy "CAMXD admin product image upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and public.is_admin()
);

-- Public, aggregate-only sales statistics.
-- It exposes product_key + completed quantity only; no customer/order details.
create or replace function public.get_product_sales_stats()
returns table (
  product_key text,
  sold_count bigint
)
language sql
security definer
set search_path = public
as $$
  select
    item->>'product_id' as product_key,
    coalesce(sum(greatest(coalesce((item->>'qty')::integer, 1), 0)), 0)::bigint as sold_count
  from public.orders o
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(o.items) = 'array' then o.items
      else '[]'::jsonb
    end
  ) item
  where o.status = 'Selesai'
    and item->>'product_id' is not null
  group by item->>'product_id';
$$;

revoke all on function public.get_product_sales_stats() from public;
grant execute on function public.get_product_sales_stats() to anon, authenticated;

commit;

-- Existing products intentionally keep stock_quantity NULL until the admin sets
-- the real available stock. The storefront will show "Stok belum diatur" rather
-- than inventing a stock number.
