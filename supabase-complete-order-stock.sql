-- CAMXD Store — Complete order, deduct stock, close customer checkout
-- Jalankan SATU KALI di Supabase SQL Editor setelah file ini masuk ke GitHub.
-- RPC hanya dapat dipanggil oleh admin yang sudah login.

begin;

create table if not exists public.order_stock_deductions (
  order_id bigint primary key references public.orders(id) on delete cascade,
  deducted_at timestamptz not null default now()
);

alter table public.order_stock_deductions enable row level security;
revoke all on table public.order_stock_deductions from anon, authenticated;

create or replace function public.complete_order_delivery(p_order_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders%rowtype;
  item jsonb;
  product_key text;
  qty integer;
  p public.products%rowtype;
  stock_updates jsonb := '[]'::jsonb;
  already_deducted boolean := false;
begin
  if not public.is_admin() then
    raise exception 'Akses ditolak.';
  end if;

  select *
    into o
    from public.orders
   where id = p_order_id
   for update;

  if not found then
    raise exception 'Pesanan tidak ditemukan.';
  end if;

  if o.status = 'Selesai' then
    return jsonb_build_object(
      'ok', true,
      'already_completed', true,
      'stock_updates', stock_updates
    );
  end if;

  if o.status not in ('Sudah Dibayar', 'Sedang Diproses') then
    raise exception 'Pesanan belum siap diselesaikan. Status saat ini: %.', coalesce(o.status, '-');
  end if;

  select exists(
    select 1
      from public.order_stock_deductions d
     where d.order_id = o.id
  ) into already_deducted;

  if not already_deducted then
    for item in
      select value
        from jsonb_array_elements(
          case
            when jsonb_typeof(o.items) = 'array' then o.items
            else '[]'::jsonb
          end
        )
    loop
      product_key := lower(trim(coalesce(item->>'product_id', '')));
      qty := greatest(coalesce((item->>'qty')::integer, 1), 1);

      if product_key = '' then
        continue;
      end if;

      select *
        into p
        from public.products
       where public.products.product_key = product_key
       for update;

      if not found then
        continue;
      end if;

      -- NULL means stock has not been configured for this product yet.
      -- Such products remain compatible with the existing store.
      if p.stock_quantity is not null then
        if p.stock_quantity < qty then
          raise exception 'Stok % tidak cukup. Tersedia: %, diminta: %.',
            coalesce(p.name, product_key), p.stock_quantity, qty;
        end if;

        update public.products
           set stock_quantity = stock_quantity - qty
         where id = p.id;

        stock_updates := stock_updates || jsonb_build_array(
          jsonb_build_object(
            'product_key', p.product_key,
            'product_name', p.name,
            'quantity', qty,
            'stock_after', p.stock_quantity - qty
          )
        );
      end if;
    end loop;

    insert into public.order_stock_deductions(order_id)
    values (o.id);
  end if;

  update public.orders
     set status = 'Selesai'
   where id = o.id;

  return jsonb_build_object(
    'ok', true,
    'already_completed', false,
    'already_deducted', already_deducted,
    'stock_updates', stock_updates
  );
end;
$$;

revoke all on function public.complete_order_delivery(bigint) from public;
revoke all on function public.complete_order_delivery(bigint) from anon;
grant execute on function public.complete_order_delivery(bigint) to authenticated;

commit;
