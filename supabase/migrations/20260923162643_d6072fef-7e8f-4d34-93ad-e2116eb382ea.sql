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
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
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
          if coalesce((v_old_block->>'blocked')::boolean, true) and v_start_min+(v_new_block->>'start_min')::integer < extract(hour from v_existing.booking_time)::integer*60+extract(minute from v_existing.booking_time)::integer+(v_old_block->>'start_min')::integer+(v_old_block->>'duration_min')::integer and extract(hour from v_existing.booking_time)::integer*60+extract(minute from v_existing.booking_time)::integer+(v_old_block->>'start_min')::integer < v_start_min+(v_new_block->>'start_min')::integer+(v_new_block->>'duration_min')::integer then raise exception 'Horário acabou de ser reservado'; end if;
        end loop;
      end if;
    end loop;
  end loop;
  insert into public.bookings(service_id,user_id,customer_name,customer_whatsapp,booking_date,booking_time,price,status,access_token_hash,access_token_expires_at)
  values(v_service.id,auth.uid(),trim(p_customer_name),p_customer_whatsapp,p_booking_date,p_booking_time,v_service.price,'PENDING_PAYMENT',encode(extensions.digest(v_token,'sha256'),'hex'),now()+interval '48 hours') returning * into v_booking;
  insert into public.booking_events(booking_id,actor_id,event_type,new_status) values(v_booking.id,auth.uid(),'CREATED',v_booking.status);
  return jsonb_build_object('booking_id',v_booking.id,'access_token',v_token,'requires_payment',coalesce(v_settings.require_payment_on_booking,true));
end $$;
revoke all on function public.create_booking(uuid,text,text,date,time) from public;
grant execute on function public.create_booking(uuid,text,text,date,time) to anon,authenticated;

create or replace function public.get_booked_slots(p_booking_date date)
returns table(booking_time time, duration_min integer, interleaved_blocks jsonb)
language sql stable security definer set search_path=public
as $$ select b.booking_time,s.duration_min,s.interleaved_blocks from public.bookings b join public.services s on s.id=b.service_id where b.booking_date=p_booking_date and b.status in ('PENDING_PAYMENT','CONFIRMED') $$;
revoke all on function public.get_booked_slots(date) from public;
grant execute on function public.get_booked_slots(date) to anon,authenticated;

create or replace function public.set_booking_receipt(p_booking_id uuid,p_access_token text,p_receipt_path text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or split_part(p_receipt_path,'/',1) <> auth.uid()::text then raise exception 'Acesso negado'; end if;
  update public.bookings b set receipt_url=p_receipt_path,status='PENDING_PAYMENT'
  where b.id=p_booking_id and b.user_id=auth.uid() and b.access_token_hash=encode(extensions.digest(p_access_token,'sha256'),'hex') and b.access_token_expires_at>now();
  if found then insert into public.booking_events(booking_id,actor_id,event_type,new_status,metadata) values(p_booking_id,auth.uid(),'RECEIPT_UPLOADED','PENDING_PAYMENT',jsonb_build_object('path',p_receipt_path)); end if;
  return found;
end $$;
revoke all on function public.set_booking_receipt(uuid,text,text) from public,anon;
grant execute on function public.set_booking_receipt(uuid,text,text) to authenticated;