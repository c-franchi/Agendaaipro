-- Agendamento v2: horários e conflitos separados por profissional.
-- Mantém as funções v1 para clientes PWA legados; ambos compartilham o lock por data.

CREATE FUNCTION public.get_booked_slots_v2(p_booking_date date,p_professional_id uuid)
RETURNS TABLE(booking_time time without time zone,duration_min integer,interleaved_blocks jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT b.booking_time,s.duration_min,s.interleaved_blocks
  FROM public.bookings b JOIN public.services s ON s.id=b.service_id
  JOIN public.professional_profiles p ON p.id=b.professional_id
  JOIN public.business_members m ON m.id=p.member_id AND m.status='active'
  JOIN public.business_entitlements e ON e.business_id=p.business_id
  WHERE b.booking_date=p_booking_date AND b.professional_id=p_professional_id
    AND b.status IN ('PENDING_PAYMENT','CONFIRMED')
    AND (m.role='owner' OR (e.plan_key='premium' AND e.seat_limit=2
      AND e.status IN ('active','trialing') AND (e.valid_until IS NULL OR e.valid_until>now())))
  ORDER BY b.booking_time;
$$;
REVOKE ALL ON FUNCTION public.get_booked_slots_v2(date,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_booked_slots_v2(date,uuid) TO authenticated;

CREATE FUNCTION public.create_booking_v2(
  p_service_id uuid,p_professional_id uuid,p_customer_name text,
  p_customer_whatsapp text,p_booking_date date,p_booking_time time without time zone
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_service public.services%rowtype;
  v_rule public.availability_rules%rowtype;
  v_settings public.settings%rowtype;
  v_booking public.bookings%rowtype;
  v_token text:=encode(extensions.gen_random_bytes(32),'hex');
  v_start int; v_end int;
  v_existing record;
  v_new jsonb; v_old jsonb; v_new_blocks jsonb; v_old_blocks jsonb;
  v_now timestamp:=timezone('America/Sao_Paulo',now());
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre na sua conta para agendar'; END IF;
  IF p_professional_id IS NULL OR length(btrim(coalesce(p_customer_name,''))) NOT BETWEEN 2 AND 100
    OR p_customer_whatsapp !~ '^[0-9]{10,13}$' THEN
    RAISE EXCEPTION 'Dados do agendamento inválidos'; END IF;
  SELECT * INTO v_service FROM public.services
  WHERE id=p_service_id AND professional_id=p_professional_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Serviço indisponível para este profissional'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.professional_profiles p
    JOIN public.business_members m ON m.id=p.member_id AND m.status='active'
    JOIN public.business_entitlements e ON e.business_id=p.business_id
    WHERE p.id=p_professional_id AND p.is_active AND p.business_id=v_service.business_id
      AND (m.role='owner' OR
         (e.plan_key='premium' AND e.seat_limit=2 AND e.status IN ('active','trialing')
           AND (e.valid_until IS NULL OR e.valid_until>now())))
  ) THEN RAISE EXCEPTION 'Profissional não está disponível'; END IF;
  SELECT * INTO v_settings FROM public.settings ORDER BY created_at LIMIT 1;
  IF p_booking_date::timestamp+p_booking_time < v_now + make_interval(hours=>coalesce(v_settings.min_advance_hours,2)) THEN
    RAISE EXCEPTION 'Horário fora da antecedência mínima'; END IF;
  IF p_booking_date > v_now::date+coalesce(v_settings.max_days_ahead,30) THEN
    RAISE EXCEPTION 'Data além do limite de agendamento'; END IF;
  SELECT * INTO v_rule FROM public.availability_rules
  WHERE professional_id=p_professional_id
    AND weekday=extract(dow from p_booking_date)::integer AND is_active
  ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profissional indisponível nesta data'; END IF;
  v_start:=extract(hour from p_booking_time)::integer*60+extract(minute from p_booking_time)::integer;
  v_end:=v_start+v_service.duration_min;
  IF v_service.duration_min<=0 OR p_booking_time<v_rule.open_time
     OR v_end>extract(hour from v_rule.close_time)::integer*60+extract(minute from v_rule.close_time)::integer THEN
     RAISE EXCEPTION 'Serviço não cabe no expediente'; END IF;
  IF EXISTS(SELECT 1 FROM public.blocks b
    WHERE b.business_id=v_service.business_id
      AND (b.professional_id=p_professional_id OR b.professional_id IS NULL)
      AND (p_booking_date::timestamp+p_booking_time) AT TIME ZONE 'America/Sao_Paulo' < b.end_datetime
      AND ((p_booking_date::timestamp+p_booking_time)+make_interval(mins=>v_service.duration_min))
        AT TIME ZONE 'America/Sao_Paulo' > b.start_datetime)
  THEN RAISE EXCEPTION 'Horário bloqueado'; END IF;

  -- Lock v1 global protege contra clientes em cache e requisições paralelas.
  PERFORM pg_advisory_xact_lock(hashtext(p_booking_date::text));
  v_new_blocks:=coalesce(v_service.interleaved_blocks,
    jsonb_build_array(jsonb_build_object('start_min',0,'duration_min',v_service.duration_min,'blocked',true)));
  FOR v_existing IN
    SELECT b.booking_time,s.duration_min,s.interleaved_blocks
    FROM public.bookings b JOIN public.services s ON s.id=b.service_id
    WHERE b.professional_id=p_professional_id AND b.booking_date=p_booking_date
      AND b.status IN ('PENDING_PAYMENT','CONFIRMED')
  LOOP
    v_old_blocks:=coalesce(v_existing.interleaved_blocks,
      jsonb_build_array(jsonb_build_object('start_min',0,'duration_min',v_existing.duration_min,'blocked',true)));
    FOR v_new IN SELECT value FROM jsonb_array_elements(v_new_blocks) LOOP
      IF coalesce((v_new->>'blocked')::boolean,true) THEN
        FOR v_old IN SELECT value FROM jsonb_array_elements(v_old_blocks) LOOP
          IF coalesce((v_old->>'blocked')::boolean,true)
            AND v_start+(v_new->>'start_min')::int <
              extract(hour from v_existing.booking_time)::int*60+extract(minute from v_existing.booking_time)::int+
              (v_old->>'start_min')::int+(v_old->>'duration_min')::int
            AND extract(hour from v_existing.booking_time)::int*60+extract(minute from v_existing.booking_time)::int+
              (v_old->>'start_min')::int <
              v_start+(v_new->>'start_min')::int+(v_new->>'duration_min')::int
          THEN RAISE EXCEPTION 'Horário acabou de ser reservado'; END IF;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;
  INSERT INTO public.bookings(service_id,user_id,customer_name,customer_whatsapp,
    booking_date,booking_time,price,status,access_token_hash,access_token_expires_at,
    business_id,professional_id)
  VALUES(v_service.id,auth.uid(),btrim(p_customer_name),p_customer_whatsapp,
    p_booking_date,p_booking_time,v_service.price,'PENDING_PAYMENT',
    encode(extensions.digest(v_token,'sha256'),'hex'),now()+interval '48 hours',
    v_service.business_id,p_professional_id)
  RETURNING * INTO v_booking;
  INSERT INTO public.booking_events(booking_id,actor_id,event_type,new_status)
    VALUES(v_booking.id,auth.uid(),'BOOKING_CREATED',v_booking.status);
  RETURN jsonb_build_object('booking_id',v_booking.id,'access_token',v_token,
    'requires_payment',coalesce(v_settings.require_payment_on_booking,true));
END;$$;
REVOKE ALL ON FUNCTION public.create_booking_v2(uuid,uuid,text,text,date,time without time zone)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_booking_v2(uuid,uuid,text,text,date,time without time zone)
  TO authenticated;

CREATE FUNCTION public.professional_update_booking_status(p_booking_id uuid,p_status public.booking_status)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_previous public.booking_status;
BEGIN
  SELECT b.status INTO v_previous
  FROM public.bookings b
  WHERE b.id=p_booking_id AND b.professional_id=public.my_professional_id()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Agendamento não autorizado'; END IF;
  IF v_previous=p_status THEN RETURN true; END IF;
  IF v_previous IN ('CANCELED','COMPLETED')
    OR p_status NOT IN ('CONFIRMED','CANCELED','COMPLETED')
    OR (p_status='COMPLETED' AND v_previous<>'CONFIRMED') THEN
    RAISE EXCEPTION 'Mudança de status inválida'; END IF;
  UPDATE public.bookings
  SET status=p_status,
    cancellation_requested_at=CASE WHEN p_status='CANCELED' THEN NULL ELSE cancellation_requested_at END,
    access_token_hash=CASE WHEN p_status IN ('CANCELED','COMPLETED') THEN NULL ELSE access_token_hash END,
    access_token_expires_at=CASE WHEN p_status IN ('CANCELED','COMPLETED') THEN NULL ELSE access_token_expires_at END,
    updated_at=now()
  WHERE id=p_booking_id;
  INSERT INTO public.booking_events(booking_id,actor_id,event_type,previous_status,new_status)
  VALUES(p_booking_id,auth.uid(),'STATUS_CHANGED',v_previous,p_status);
  RETURN true;
END;$$;
REVOKE ALL ON FUNCTION public.professional_update_booking_status(uuid,public.booking_status)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.professional_update_booking_status(uuid,public.booking_status)
  TO authenticated;
