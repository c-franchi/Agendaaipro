-- Reagendamento v2 preserva o profissional original, impedindo conflitos cruzados.
DROP POLICY IF EXISTS "Public can view blocks" ON public.blocks;
CREATE POLICY "Admin views blocks" ON public.blocks FOR SELECT TO authenticated
USING (private.has_role(auth.uid(),'admin'));
-- Profissionais adicionais continuam limitados à policy própria criada anteriormente.

CREATE FUNCTION public.reschedule_booking_v2(
  p_booking_id uuid,p_professional_id uuid,p_booking_date date,p_booking_time time without time zone
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_booking public.bookings%rowtype; v_service public.services%rowtype;
  v_rule public.availability_rules%rowtype; v_settings public.settings%rowtype;
  v_start int; v_end int; v_now timestamp:=timezone('America/Sao_Paulo',now());
  v_existing record; v_old_blocks jsonb; v_new_blocks jsonb; v_new jsonb; v_old jsonb;
  v_first date; v_last date;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre na sua conta'; END IF;
  SELECT * INTO v_booking FROM public.bookings
  WHERE id=p_booking_id AND user_id=auth.uid() AND professional_id=p_professional_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Agendamento não encontrado para este profissional'; END IF;
  IF v_booking.status NOT IN ('PENDING_PAYMENT','CONFIRMED') THEN
    RAISE EXCEPTION 'Agendamento não pode ser reagendado'; END IF;
  SELECT * INTO v_service FROM public.services
  WHERE id=v_booking.service_id AND professional_id=p_professional_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Serviço indisponível'; END IF;
  SELECT * INTO v_settings FROM public.settings ORDER BY created_at LIMIT 1;
  IF v_booking.booking_date::timestamp+v_booking.booking_time <
    v_now+make_interval(hours=>coalesce(v_settings.cancel_policy_hours,24)) THEN
    RAISE EXCEPTION 'Prazo para reagendamento encerrado'; END IF;
  IF p_booking_date::timestamp+p_booking_time <
     v_now+make_interval(hours=>coalesce(v_settings.min_advance_hours,2))
     OR p_booking_date > v_now::date+coalesce(v_settings.max_days_ahead,30) THEN
    RAISE EXCEPTION 'Nova data fora do período permitido'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.professional_profiles p
    JOIN public.business_members m ON m.id=p.member_id AND m.status='active'
    JOIN public.business_entitlements e ON e.business_id=p.business_id
    WHERE p.id=p_professional_id AND p.is_active
    AND (m.role='owner' OR (e.plan_key='premium' AND e.seat_limit=2
      AND e.status IN ('active','trialing') AND (e.valid_until IS NULL OR e.valid_until>now()))))
  THEN RAISE EXCEPTION 'Profissional indisponível'; END IF;
  SELECT * INTO v_rule FROM public.availability_rules
  WHERE professional_id=p_professional_id AND weekday=extract(dow from p_booking_date)::int
    AND is_active ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dia indisponível'; END IF;
  v_start:=extract(hour from p_booking_time)::int*60+extract(minute from p_booking_time)::int;
  v_end:=v_start+v_service.duration_min;
  IF p_booking_time<v_rule.open_time
    OR v_end>extract(hour from v_rule.close_time)::int*60+extract(minute from v_rule.close_time)::int
  THEN RAISE EXCEPTION 'Serviço fora do expediente'; END IF;
  IF EXISTS(SELECT 1 FROM public.blocks b
      WHERE b.business_id=v_booking.business_id
        AND (b.professional_id IS NULL OR b.professional_id=p_professional_id)
        AND (p_booking_date::timestamp+p_booking_time) AT TIME ZONE 'America/Sao_Paulo'<b.end_datetime
        AND ((p_booking_date::timestamp+p_booking_time)+make_interval(mins=>v_service.duration_min))
          AT TIME ZONE 'America/Sao_Paulo'>b.start_datetime)
  THEN RAISE EXCEPTION 'Período bloqueado'; END IF;

  -- Ordenação estável de locks evita deadlocks entre duas datas.
  v_first:=least(v_booking.booking_date,p_booking_date);
  v_last:=greatest(v_booking.booking_date,p_booking_date);
  PERFORM pg_advisory_xact_lock(hashtext(v_first::text));
  IF v_first<>v_last THEN PERFORM pg_advisory_xact_lock(hashtext(v_last::text)); END IF;
  v_new_blocks:=coalesce(v_service.interleaved_blocks,
    jsonb_build_array(jsonb_build_object('start_min',0,'duration_min',v_service.duration_min,'blocked',true)));
  FOR v_existing IN
    SELECT b.booking_time,s.duration_min,s.interleaved_blocks FROM public.bookings b
    JOIN public.services s ON s.id=b.service_id
    WHERE b.booking_date=p_booking_date AND b.professional_id=p_professional_id
      AND b.id<>p_booking_id AND b.status IN ('PENDING_PAYMENT','CONFIRMED')
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
          THEN RAISE EXCEPTION 'Horário ocupado'; END IF;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;
  UPDATE public.bookings SET booking_date=p_booking_date,booking_time=p_booking_time,
    cancellation_requested_at=NULL,updated_at=now() WHERE id=v_booking.id;
  INSERT INTO public.booking_events(booking_id,actor_id,event_type,previous_status,new_status,metadata)
  VALUES(v_booking.id,auth.uid(),'RESCHEDULED',v_booking.status,v_booking.status,
    jsonb_build_object('previous_date',v_booking.booking_date,'previous_time',v_booking.booking_time,
      'new_date',p_booking_date,'new_time',p_booking_time));
  RETURN jsonb_build_object('booking_id',v_booking.id,'status',v_booking.status);
END;$$;
REVOKE ALL ON FUNCTION public.reschedule_booking_v2(uuid,uuid,date,time without time zone)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reschedule_booking_v2(uuid,uuid,date,time without time zone)
TO authenticated;
