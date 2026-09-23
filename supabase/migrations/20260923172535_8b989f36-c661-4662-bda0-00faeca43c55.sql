CREATE OR REPLACE FUNCTION private.request_booking_cancellation(p_booking_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_booking public.bookings%rowtype;
  v_cancel_hours integer;
  v_now_local timestamp := timezone('America/Sao_Paulo', now());
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre na sua conta para cancelar'; END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Agendamento não encontrado'; END IF;
  IF v_booking.status NOT IN ('PENDING_PAYMENT', 'CONFIRMED') THEN RAISE EXCEPTION 'Este agendamento não pode ser cancelado'; END IF;
  IF v_booking.cancellation_requested_at IS NOT NULL THEN RETURN true; END IF;

  SELECT coalesce(cancel_policy_hours, 24) INTO v_cancel_hours
  FROM public.settings ORDER BY created_at LIMIT 1;

  IF (v_booking.booking_date::timestamp + v_booking.booking_time) < v_now_local + make_interval(hours => coalesce(v_cancel_hours, 24)) THEN
    RAISE EXCEPTION 'O prazo para solicitar cancelamento terminou';
  END IF;

  UPDATE public.bookings
  SET cancellation_requested_at = now(), updated_at = now()
  WHERE id = p_booking_id;

  INSERT INTO public.booking_events(booking_id, actor_id, event_type, previous_status, new_status)
  VALUES (p_booking_id, auth.uid(), 'CANCELLATION_REQUESTED', v_booking.status, v_booking.status);

  RETURN true;
END
$function$;

CREATE OR REPLACE FUNCTION private.reschedule_booking(
  p_booking_id uuid,
  p_booking_date date,
  p_booking_time time without time zone
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_booking public.bookings%rowtype;
  v_service public.services%rowtype;
  v_rule public.availability_rules%rowtype;
  v_settings public.settings%rowtype;
  v_start_min integer;
  v_end_min integer;
  v_existing record;
  v_new_block jsonb;
  v_old_block jsonb;
  v_new_blocks jsonb;
  v_old_blocks jsonb;
  v_now_local timestamp := timezone('America/Sao_Paulo', now());
  v_requested timestamp;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre na sua conta para reagendar'; END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Agendamento não encontrado'; END IF;
  IF v_booking.status NOT IN ('PENDING_PAYMENT', 'CONFIRMED') THEN RAISE EXCEPTION 'Este agendamento não pode ser reagendado'; END IF;

  SELECT * INTO v_settings FROM public.settings ORDER BY created_at LIMIT 1;
  IF (v_booking.booking_date::timestamp + v_booking.booking_time) < v_now_local + make_interval(hours => coalesce(v_settings.cancel_policy_hours, 24)) THEN
    RAISE EXCEPTION 'O prazo para reagendar terminou';
  END IF;

  SELECT * INTO v_service FROM public.services WHERE id = v_booking.service_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Serviço indisponível'; END IF;

  v_requested := p_booking_date::timestamp + p_booking_time;
  IF v_requested < v_now_local + make_interval(hours => coalesce(v_settings.min_advance_hours, 2)) THEN RAISE EXCEPTION 'Horário fora da antecedência mínima'; END IF;
  IF p_booking_date > v_now_local::date + coalesce(v_settings.max_days_ahead, 30) THEN RAISE EXCEPTION 'Data além do limite de agendamento'; END IF;

  SELECT * INTO v_rule FROM public.availability_rules
  WHERE weekday = extract(dow from p_booking_date)::integer AND is_active
  ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Estabelecimento fechado nesta data'; END IF;

  v_start_min := extract(hour from p_booking_time)::integer * 60 + extract(minute from p_booking_time)::integer;
  v_end_min := v_start_min + v_service.duration_min;
  IF p_booking_time < v_rule.open_time OR v_end_min > extract(hour from v_rule.close_time)::integer * 60 + extract(minute from v_rule.close_time)::integer THEN
    RAISE EXCEPTION 'Serviço não cabe no horário de funcionamento';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.blocks b
    WHERE (p_booking_date::timestamp + p_booking_time) AT TIME ZONE 'America/Sao_Paulo' < b.end_datetime
      AND ((p_booking_date::timestamp + p_booking_time) + make_interval(mins => v_service.duration_min)) AT TIME ZONE 'America/Sao_Paulo' > b.start_datetime
  ) THEN RAISE EXCEPTION 'Período bloqueado'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext(least(v_booking.booking_date, p_booking_date)::text));
  IF v_booking.booking_date <> p_booking_date THEN
    PERFORM pg_advisory_xact_lock(hashtext(greatest(v_booking.booking_date, p_booking_date)::text));
  END IF;

  v_new_blocks := coalesce(v_service.interleaved_blocks, jsonb_build_array(jsonb_build_object('start_min', 0, 'duration_min', v_service.duration_min, 'blocked', true)));
  FOR v_existing IN
    SELECT b.booking_time, s.duration_min, s.interleaved_blocks
    FROM public.bookings b
    JOIN public.services s ON s.id = b.service_id
    WHERE b.booking_date = p_booking_date
      AND b.id <> p_booking_id
      AND b.status IN ('PENDING_PAYMENT', 'CONFIRMED')
  LOOP
    v_old_blocks := coalesce(v_existing.interleaved_blocks, jsonb_build_array(jsonb_build_object('start_min', 0, 'duration_min', v_existing.duration_min, 'blocked', true)));
    FOR v_new_block IN SELECT value FROM jsonb_array_elements(v_new_blocks) LOOP
      IF coalesce((v_new_block->>'blocked')::boolean, true) THEN
        FOR v_old_block IN SELECT value FROM jsonb_array_elements(v_old_blocks) LOOP
          IF coalesce((v_old_block->>'blocked')::boolean, true)
            AND v_start_min + (v_new_block->>'start_min')::integer < extract(hour from v_existing.booking_time)::integer * 60 + extract(minute from v_existing.booking_time)::integer + (v_old_block->>'start_min')::integer + (v_old_block->>'duration_min')::integer
            AND extract(hour from v_existing.booking_time)::integer * 60 + extract(minute from v_existing.booking_time)::integer + (v_old_block->>'start_min')::integer < v_start_min + (v_new_block->>'start_min')::integer + (v_new_block->>'duration_min')::integer
          THEN RAISE EXCEPTION 'Horário acabou de ser reservado'; END IF;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;

  UPDATE public.bookings
  SET booking_date = p_booking_date,
      booking_time = p_booking_time,
      cancellation_requested_at = NULL,
      updated_at = now()
  WHERE id = p_booking_id;

  INSERT INTO public.booking_events(booking_id, actor_id, event_type, previous_status, new_status, metadata)
  VALUES (p_booking_id, auth.uid(), 'RESCHEDULED', v_booking.status, v_booking.status,
    jsonb_build_object('previous_date', v_booking.booking_date, 'previous_time', v_booking.booking_time, 'new_date', p_booking_date, 'new_time', p_booking_time));

  RETURN jsonb_build_object('booking_id', p_booking_id, 'status', v_booking.status);
END
$function$;

CREATE OR REPLACE FUNCTION private.admin_update_booking_status(p_booking_id uuid, p_status public.booking_status)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_previous public.booking_status;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;

  SELECT status INTO v_previous FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Agendamento não encontrado'; END IF;
  IF p_status = v_previous THEN RETURN true; END IF;

  UPDATE public.bookings
  SET status = p_status,
      cancellation_requested_at = CASE WHEN p_status = 'CANCELED' THEN NULL ELSE cancellation_requested_at END,
      updated_at = now()
  WHERE id = p_booking_id;

  INSERT INTO public.booking_events(booking_id, actor_id, event_type, previous_status, new_status)
  VALUES (p_booking_id, auth.uid(), 'STATUS_CHANGED', v_previous, p_status);

  RETURN true;
END
$function$;

CREATE OR REPLACE FUNCTION public.request_booking_cancellation(p_booking_id uuid)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path TO 'public', 'private'
AS $function$ SELECT private.request_booking_cancellation(p_booking_id) $function$;

CREATE OR REPLACE FUNCTION public.reschedule_booking(p_booking_id uuid, p_booking_date date, p_booking_time time without time zone)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path TO 'public', 'private'
AS $function$ SELECT private.reschedule_booking(p_booking_id, p_booking_date, p_booking_time) $function$;

CREATE OR REPLACE FUNCTION public.admin_update_booking_status(p_booking_id uuid, p_status public.booking_status)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path TO 'public', 'private'
AS $function$ SELECT private.admin_update_booking_status(p_booking_id, p_status) $function$;

REVOKE ALL ON FUNCTION private.request_booking_cancellation(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.reschedule_booking(uuid, date, time without time zone) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.admin_update_booking_status(uuid, public.booking_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.request_booking_cancellation(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.reschedule_booking(uuid, date, time without time zone) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.admin_update_booking_status(uuid, public.booking_status) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.request_booking_cancellation(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reschedule_booking(uuid, date, time without time zone) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_booking_status(uuid, public.booking_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_booking_cancellation(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reschedule_booking(uuid, date, time without time zone) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_booking_status(uuid, public.booking_status) TO authenticated, service_role;