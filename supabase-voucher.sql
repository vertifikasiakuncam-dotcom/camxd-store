-- CAMXD Store — Voucher aktif pada masing-masing produk
-- Jalankan SATU KALI di Supabase SQL Editor setelah perubahan website ini.
begin;
alter table public.products add column if not exists voucher_discount_type text not null default 'percent', add column if not exists voucher_discount_value numeric(12,2) not null default 0, add column if not exists voucher_valid_from timestamptz, add column if not exists voucher_valid_until timestamptz, add column if not exists voucher_usage_limit integer, add column if not exists voucher_usage_count integer not null default 0, add column if not exists voucher_active boolean not null default false;
alter table public.products drop constraint if exists products_voucher_discount_type_check;
alter table public.products add constraint products_voucher_discount_type_check check (voucher_discount_type in ('percent','fixed'));
alter table public.products drop constraint if exists products_voucher_discount_value_check;
alter table public.products add constraint products_voucher_discount_value_check check (voucher_discount_value >= 0 and (voucher_discount_type <> 'percent' or voucher_discount_value <= 100));
alter table public.products drop constraint if exists products_voucher_usage_limit_check;
alter table public.products add constraint products_voucher_usage_limit_check check (voucher_usage_limit is null or voucher_usage_limit > 0);
alter table public.products drop constraint if exists products_voucher_usage_count_check;
alter table public.products add constraint products_voucher_usage_count_check check (voucher_usage_count >= 0);
alter table public.orders add column if not exists voucher_code text, add column if not exists discount_amount numeric(12,2) not null default 0;

create or replace function public.check_product_voucher(p_product_key text,p_code text)
returns table(valid boolean,product_key text,code text,discount_type text,discount_value numeric,message text,remaining_uses integer)
language plpgsql security definer set search_path=''
as $$
declare p public.products%rowtype; c text := upper(trim(coalesce(p_code,'')));
begin
 select * into p from public.products where public.products.product_key=lower(trim(coalesce(p_product_key,''))) limit 1;
 if not found then return query select false,null::text,c,null::text,0::numeric,'Produk tidak ditemukan.',null::integer; return; end if;
 if c='' or upper(coalesce(p.voucher_code,''))<>c then return query select false,p.product_key,c,p.voucher_discount_type,p.voucher_discount_value,'Kode voucher tidak sesuai dengan produk ini.',case when p.voucher_usage_limit is null then null else greatest(p.voucher_usage_limit-p.voucher_usage_count,0) end; return; end if;
 if coalesce(p.voucher_active,false)=false then return query select false,p.product_key,c,p.voucher_discount_type,p.voucher_discount_value,'Voucher sedang tidak aktif.',case when p.voucher_usage_limit is null then null else greatest(p.voucher_usage_limit-p.voucher_usage_count,0) end; return; end if;
 if p.voucher_valid_from is not null and now()<p.voucher_valid_from then return query select false,p.product_key,c,p.voucher_discount_type,p.voucher_discount_value,'Voucher belum mulai berlaku.',case when p.voucher_usage_limit is null then null else greatest(p.voucher_usage_limit-p.voucher_usage_count,0) end; return; end if;
 if p.voucher_valid_until is not null and now()>p.voucher_valid_until then return query select false,p.product_key,c,p.voucher_discount_type,p.voucher_discount_value,'Voucher sudah kedaluwarsa.',case when p.voucher_usage_limit is null then null else greatest(p.voucher_usage_limit-p.voucher_usage_count,0) end; return; end if;
 if p.voucher_usage_limit is not null and p.voucher_usage_count>=p.voucher_usage_limit then return query select false,p.product_key,c,p.voucher_discount_type,p.voucher_discount_value,'Kuota voucher sudah habis.',0; return; end if;
 return query select true,p.product_key,c,p.voucher_discount_type,p.voucher_discount_value,'Voucher valid.',case when p.voucher_usage_limit is null then null else greatest(p.voucher_usage_limit-p.voucher_usage_count,0) end;
end;
$$;

create or replace function public.redeem_product_voucher(p_product_key text,p_code text)
returns table(valid boolean,product_key text,code text,discount_type text,discount_value numeric,message text,remaining_uses integer)
language plpgsql security definer set search_path=''
as $$
declare p public.products%rowtype; c text := upper(trim(coalesce(p_code,'')));
begin
 select * into p from public.products where public.products.product_key=lower(trim(coalesce(p_product_key,''))) for update;
 if not found then return query select false,null::text,c,null::text,0::numeric,'Produk tidak ditemukan.',null::integer; return; end if;
 if c='' or upper(coalesce(p.voucher_code,''))<>c then return query select false,p.product_key,c,p.voucher_discount_type,p.voucher_discount_value,'Kode voucher tidak sesuai dengan produk ini.',case when p.voucher_usage_limit is null then null else greatest(p.voucher_usage_limit-p.voucher_usage_count,0) end; return; end if;
 if coalesce(p.voucher_active,false)=false then return query select false,p.product_key,c,p.voucher_discount_type,p.voucher_discount_value,'Voucher sedang tidak aktif.',null::integer; return; end if;
 if p.voucher_valid_from is not null and now()<p.voucher_valid_from then return query select false,p.product_key,c,p.voucher_discount_type,p.voucher_discount_value,'Voucher belum mulai berlaku.',null::integer; return; end if;
 if p.voucher_valid_until is not null and now()>p.voucher_valid_until then return query select false,p.product_key,c,p.voucher_discount_type,p.voucher_discount_value,'Voucher sudah kedaluwarsa.',null::integer; return; end if;
 if p.voucher_usage_limit is not null and p.voucher_usage_count>=p.voucher_usage_limit then return query select false,p.product_key,c,p.voucher_discount_type,p.voucher_discount_value,'Kuota voucher sudah habis.',0; return; end if;
 update public.products set voucher_usage_count=voucher_usage_count+1 where id=p.id;
 return query select true,p.product_key,c,p.voucher_discount_type,p.voucher_discount_value,'Voucher berhasil digunakan.',case when p.voucher_usage_limit is null then null else greatest(p.voucher_usage_limit-(p.voucher_usage_count+1),0) end;
end;
$$;
revoke all on function public.check_product_voucher(text,text) from public;
revoke all on function public.redeem_product_voucher(text,text) from public;
grant execute on function public.check_product_voucher(text,text) to anon,authenticated;
grant execute on function public.redeem_product_voucher(text,text) to anon,authenticated;
commit;