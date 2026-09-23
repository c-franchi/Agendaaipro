create extension if not exists pgcrypto;

alter table public.bookings
  add column if not exists user_id uuid,
  add column if not exists access_token_hash text,
  add column if not exists access_token_expires_at timestamptz,
  add column if not exists cancellation_requested_at timestamptz,
  add column if not exists rescheduled_from uuid references public.bookings(id) on delete set null;

create index if not exists bookings_user_id_idx on public.bookings(user_id);
create index if not exists bookings_active_date_idx on public.bookings(booking_date, booking_time)
  where status in ('PENDING_PAYMENT', 'CONFIRMED');

alter table public.barber_profile
  add column if not exists review_url text,
  add column if not exists facebook_url text,
  add column if not exists instagram_url text,
  add column if not exists public_whatsapp text,
  add column if not exists address_text text;

create table if not exists public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text not null default 'Outros',
  image_url text not null,
  alt_text text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.portfolio_items to anon, authenticated;
grant insert, update, delete on public.portfolio_items to authenticated;
grant all on public.portfolio_items to service_role;
alter table public.portfolio_items enable row level security;

create table if not exists public.booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  actor_id uuid,
  event_type text not null,
  previous_status public.booking_status,
  new_status public.booking_status,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select on public.booking_events to authenticated;
grant all on public.booking_events to service_role;
alter table public.booking_events enable row level security;

drop policy if exists "Admin can update barber profile" on public.barber_profile;
drop policy if exists "Admin can insert barber profile" on public.barber_profile;
create policy "Admins can insert barber profile" on public.barber_profile for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins can update barber profile" on public.barber_profile for update to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admin can manage services" on public.services;
create policy "Admins can manage services" on public.services for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admin can manage availability" on public.availability_rules;
create policy "Admins can manage availability" on public.availability_rules for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admin can manage blocks" on public.blocks;
create policy "Admins can manage blocks" on public.blocks for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admin can view settings" on public.settings;
drop policy if exists "Admin can update settings" on public.settings;
create policy "Admins can read settings" on public.settings for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));
create policy "Admins can insert settings" on public.settings for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins can update settings" on public.settings for update to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admin can manage all bookings" on public.bookings;
drop policy if exists "Anyone can view their bookings with token" on public.bookings;
drop policy if exists "Anyone can create bookings" on public.bookings;
create policy "Admins can manage bookings" on public.bookings for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Customers can read own bookings" on public.bookings for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Admin can manage notifications" on public.booking_notifications;
drop policy if exists "Public can view their notifications" on public.booking_notifications;
create policy "Admins can manage booking notifications" on public.booking_notifications for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Customers can read own booking notifications" on public.booking_notifications for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id and b.user_id = auth.uid()));

drop policy if exists "Admin can manage notifications" on public.scheduled_notifications;
create policy "Admins can manage scheduled notifications" on public.scheduled_notifications for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admin can view all conversations" on public.conversations;
drop policy if exists "Admin can insert conversations" on public.conversations;
drop policy if exists "Admin can update conversations" on public.conversations;
drop policy if exists "Customers can view their conversation by whatsapp" on public.conversations;
drop policy if exists "Customers can view their own conversations" on public.conversations;
create policy "Admins can manage conversations" on public.conversations for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Customers can read own conversations" on public.conversations for select to authenticated
  using (user_id = auth.uid());
create policy "Customers can create own conversations" on public.conversations for insert to authenticated
  with check (user_id = auth.uid());
create policy "Customers can update own conversations" on public.conversations for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Admin can view all messages" on public.messages;
drop policy if exists "Admin can insert messages" on public.messages;
drop policy if exists "Customers can view their messages" on public.messages;
drop policy if exists "Customers can send messages" on public.messages;
create policy "Admins can manage messages" on public.messages for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Customers can read own messages" on public.messages for select to authenticated
  using (exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid()));
create policy "Customers can send own messages" on public.messages for insert to authenticated
  with check (sender_type = 'customer' and exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid()));

create policy "Public can read active portfolio" on public.portfolio_items for select to anon, authenticated using (is_active);
create policy "Admins can manage portfolio" on public.portfolio_items for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins can read booking events" on public.booking_events for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));
create policy "Customers can read own booking events" on public.booking_events for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id and b.user_id = auth.uid()));

drop policy if exists "Authenticated users can upload receipts" on storage.objects;
drop policy if exists "Authenticated users can view receipts" on storage.objects;
drop policy if exists "Admins can delete receipts" on storage.objects;
create policy "Customers upload own receipts" on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Customers read own receipts" on storage.objects for select to authenticated
  using (bucket_id = 'payment-receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Admins read receipts" on storage.objects for select to authenticated
  using (bucket_id = 'payment-receipts' and public.has_role(auth.uid(), 'admin'));
create policy "Admins delete receipts" on storage.objects for delete to authenticated
  using (bucket_id = 'payment-receipts' and public.has_role(auth.uid(), 'admin'));

create policy "Public reads portfolio media" on storage.objects for select to anon, authenticated
  using (bucket_id = 'portfolio');
create policy "Admins upload portfolio media" on storage.objects for insert to authenticated
  with check (bucket_id = 'portfolio' and public.has_role(auth.uid(), 'admin'));
create policy "Admins update portfolio media" on storage.objects for update to authenticated
  using (bucket_id = 'portfolio' and public.has_role(auth.uid(), 'admin'))
  with check (bucket_id = 'portfolio' and public.has_role(auth.uid(), 'admin'));
create policy "Admins delete portfolio media" on storage.objects for delete to authenticated
  using (bucket_id = 'portfolio' and public.has_role(auth.uid(), 'admin'));

create or replace function public.get_public_booking_settings()
returns table(min_advance_hours integer, max_days_ahead integer, cancel_policy_hours integer, require_payment_on_booking boolean)
language sql stable security definer set search_path = public
as $$
  select coalesce(s.min_advance_hours, 2), coalesce(s.max_days_ahead, 30), coalesce(s.cancel_policy_hours, 24), coalesce(s.require_payment_on_booking, true)
  from public.settings s order by s.created_at limit 1
$$;
revoke all on function public.get_public_booking_settings() from public;
grant execute on function public.get_public_booking_settings() to anon, authenticated;

create or replace function public.create_booking(
  p_service_id uuid,
  p_customer_name text,
  p_customer_whatsapp text,
  p_booking_date date,
  p_booking_time time
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_service public.services%rowtype;
  v_rule public.availability_rules%rowtype;
  v_settings public.settings%rowtype;
  v_booking public.bookings%rowtype;
  v_token text := encode(gen_random_bytes(32), 'hex');
  v_start_min integer;
  v_end_min integer;
  v_existing record;
  v_new_block jsonb;
  v_old_block jsonb;
  v_new_blocks jsonb;
  v_old_blocks jsonb;
  v_now_local timestamp := timezone('America/Sao_Paulo', now());
  v_requested timestamp;
begin
  if length(trim(p_customer_name)) < 2 or length(trim(p_customer_name)) > 100 then raise exception 'Nome inválido'; end if;
  if p_customer_whatsapp !~ '^[0-9]{10,13}$' then raise exception 'WhatsApp inválido'; end if;
  select * into v_service from public.services where id = p_service_id and is_active;
  if not found then raise exception 'Serviço indisponível'; end if;
  select * into v_settings from public.settings order by created_at limit 1;
  v_requested := p_booking_date::timestamp + p_booking_time;
  if v_requested < v_now_local + make_interval(hours => coalesce(v_settings.min_advance_hours, 2)) then raise exception 'Horário fora da antecedência mínima'; end if;
  if p_booking_date > v_now_local::date + coalesce(v_settings.max_days_ahead, 30) then raise exception 'Data além do limite de agendamento'; end if;
  select * into v_rule from public.availability_rules where weekday = extract(dow from p_booking_date)::integer and is_active order by created_at desc limit 1;
  if not found then raise exception 'Estabelecimento fechado nesta data'; end if;
  v_start_min := extract(hour from p_booking_time)::integer * 60 + extract(minute from p_booking_time)::integer;
  v_end_min := v_start_min + v_service.duration_min;
  if p_booking_time < v_rule.open_time or v_end_min > extract(hour from v_rule.close_time)::integer * 60 + extract(minute from v_rule.close_time)::integer then raise exception 'Serviço não cabe no horário de funcionamento'; end if;
  if exists (select 1 from public.blocks b where (p_booking_date::timestamp + p_booking_time) at time zone 'America/Sao_Paulo' < b.end_datetime and ((p_booking_date::timestamp + p_booking_time) + make_interval(mins => v_service.duration_min)) at time zone 'America/Sao_Paulo' > b.start_datetime) then raise exception 'Período bloqueado'; end if;

  perform pg_advisory_xact_lock(hashtext(p_booking_date::text));
  v_new_blocks := coalesce(v_service.interleaved_blocks, jsonb_build_array(jsonb_build_object('start_min',0,'duration_min',v_service.duration_min,'blocked',true)));
  for v_existing in select b.booking_time, s.duration_min, s.interleaved_blocks from public.bookings b join public.services s on s.id=b.service_id where b.booking_date=p_booking_date and b.status in ('PENDING_PAYMENT','CONFIRMED') loop
    v_old_blocks := coalesce(v_existing.interleaved_blocks, jsonb_build_array(jsonb_build_object('start_min',0,'duration_min',v_existing.duration_min,'blocked',true)));
    for v_new_block in select value from jsonb_array_elements(v_new_blocks) loop
      if coalesce((v_new_block->>'blocked')::boolean, true) then
        for v_old_block in select value from jsonb_array_elements(v_old_blocks) loop
          if coalesce((v_old_block->>'blocked')::boolean, true) and
             v_start_min + (v_new_block->>'start_min')::integer < extract(hour from v_existing.booking_time)::integer*60 + extract(minute from v_existing.booking_time)::integer + (v_old_block->>'start_min')::integer + (v_old_block->>'duration_min')::integer and
             extract(hour from v_existing.booking_time)::integer*60 + extract(minute from v_existing.booking_time)::integer + (v_old_block->>'start_min')::integer < v_start_min + (v_new_block->>'start_min')::integer + (v_new_block->>'duration_min')::integer
          then raise exception 'Horário acabou de ser reservado'; end if;
        end loop;
      end if;
    end loop;
  end loop;

  insert into public.bookings(service_id, user_id, customer_name, customer_whatsapp, booking_date, booking_time, price, status, access_token_hash, access_token_expires_at)
  values(v_service.id, auth.uid(), trim(p_customer_name), p_customer_whatsapp, p_booking_date, p_booking_time, v_service.price, 'PENDING_PAYMENT', encode(digest(v_token,'sha256'),'hex'), now()+interval '48 hours') returning * into v_booking;
  insert into public.booking_events(booking_id, actor_id, event_type, new_status) values(v_booking.id, auth.uid(), 'CREATED', v_booking.status);
  return jsonb_build_object('booking_id',v_booking.id,'access_token',v_token,'requires_payment',coalesce(v_settings.require_payment_on_booking,true));
end
$$;
revoke all on function public.create_booking(uuid,text,text,date,time) from public;
grant execute on function public.create_booking(uuid,text,text,date,time) to anon, authenticated;

create or replace function public.get_booking_by_token(p_booking_id uuid, p_access_token text)
returns table(id uuid, service_id uuid, customer_name text, booking_date date, booking_time time, status public.booking_status, price numeric, receipt_url text, payment_method text, service_name text, allow_in_person_payment boolean, pix_payload_data jsonb)
language sql stable security definer set search_path = public
as $$
  select b.id,b.service_id,b.customer_name,b.booking_date,b.booking_time,b.status,b.price,b.receipt_url,b.payment_method,s.name,s.allow_in_person_payment,
    jsonb_build_object('pix_chave',st.pix_chave,'pix_nome_recebedor',st.pix_nome_recebedor,'pix_cidade',st.pix_cidade)
  from public.bookings b join public.services s on s.id=b.service_id cross join lateral (select * from public.settings order by created_at limit 1) st
  where b.id=p_booking_id and b.access_token_hash=encode(extensions.digest(p_access_token,'sha256'),'hex') and b.access_token_expires_at>now()
$$;
revoke all on function public.get_booking_by_token(uuid,text) from public;
grant execute on function public.get_booking_by_token(uuid,text) to anon, authenticated;

create or replace function public.set_booking_payment_method(p_booking_id uuid,p_access_token text,p_method text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if p_method not in ('pix','presencial') then raise exception 'Método inválido'; end if;
  update public.bookings b set payment_method=p_method
  where b.id=p_booking_id and b.access_token_hash=encode(extensions.digest(p_access_token,'sha256'),'hex') and b.access_token_expires_at>now()
    and (p_method='pix' or exists(select 1 from public.services s where s.id=b.service_id and s.allow_in_person_payment));
  return found;
end $$;
revoke all on function public.set_booking_payment_method(uuid,text,text) from public;
grant execute on function public.set_booking_payment_method(uuid,text,text) to anon,authenticated;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.update_conversation_last_message() from public, anon, authenticated;
revoke all on function public.update_updated_at_column() from public, anon, authenticated;
grant execute on function public.handle_new_user() to service_role;
grant execute on function public.update_conversation_last_message() to service_role;
grant execute on function public.update_updated_at_column() to service_role;