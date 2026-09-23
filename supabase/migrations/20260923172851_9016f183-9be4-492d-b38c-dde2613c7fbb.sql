CREATE OR REPLACE FUNCTION private.save_availability_rules(p_rules jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rule jsonb;
  v_seen integer[] := ARRAY[]::integer[];
  v_weekday integer;
  v_open time;
  v_close time;
  v_slot integer;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
  IF jsonb_typeof(p_rules) <> 'array' OR jsonb_array_length(p_rules) <> 7 THEN RAISE EXCEPTION 'Informe os sete dias da semana'; END IF;

  FOR v_rule IN SELECT value FROM jsonb_array_elements(p_rules) LOOP
    v_weekday := (v_rule->>'weekday')::integer;
    v_open := (v_rule->>'open_time')::time;
    v_close := (v_rule->>'close_time')::time;
    v_slot := (v_rule->>'slot_min')::integer;
    IF v_weekday < 0 OR v_weekday > 6 OR v_weekday = ANY(v_seen) THEN RAISE EXCEPTION 'Dias da semana inválidos'; END IF;
    IF v_slot < 5 OR v_slot > 240 THEN RAISE EXCEPTION 'Intervalo de horários inválido'; END IF;
    IF coalesce((v_rule->>'is_active')::boolean, false) AND v_open >= v_close THEN RAISE EXCEPTION 'O fechamento precisa ser depois da abertura'; END IF;
    v_seen := array_append(v_seen, v_weekday);
  END LOOP;

  DELETE FROM public.availability_rules WHERE weekday BETWEEN 0 AND 6;
  INSERT INTO public.availability_rules(weekday, is_active, open_time, close_time, slot_min)
  SELECT (value->>'weekday')::integer,
         coalesce((value->>'is_active')::boolean, false),
         (value->>'open_time')::time,
         (value->>'close_time')::time,
         (value->>'slot_min')::integer
  FROM jsonb_array_elements(p_rules);
  RETURN true;
END
$function$;

CREATE OR REPLACE FUNCTION private.admin_reject_booking_receipt(p_booking_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status public.booking_status;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
  SELECT status INTO v_status FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Agendamento não encontrado'; END IF;
  IF v_status <> 'PENDING_PAYMENT' THEN RAISE EXCEPTION 'Este comprovante não pode mais ser rejeitado'; END IF;
  UPDATE public.bookings SET receipt_url = NULL, updated_at = now() WHERE id = p_booking_id;
  INSERT INTO public.booking_events(booking_id, actor_id, event_type, previous_status, new_status)
  VALUES (p_booking_id, auth.uid(), 'RECEIPT_REJECTED', v_status, v_status);
  RETURN true;
END
$function$;

CREATE OR REPLACE FUNCTION public.save_availability_rules(p_rules jsonb)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path TO 'public', 'private'
AS $function$ SELECT private.save_availability_rules(p_rules) $function$;

CREATE OR REPLACE FUNCTION public.admin_reject_booking_receipt(p_booking_id uuid)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path TO 'public', 'private'
AS $function$ SELECT private.admin_reject_booking_receipt(p_booking_id) $function$;

REVOKE ALL ON FUNCTION private.save_availability_rules(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.admin_reject_booking_receipt(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.save_availability_rules(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.admin_reject_booking_receipt(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.save_availability_rules(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_reject_booking_receipt(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_availability_rules(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_reject_booking_receipt(uuid) TO authenticated, service_role;