-- Booking operations require an authenticated account and validate ownership server-side.
CREATE OR REPLACE FUNCTION public.create_booking(
  p_service_id uuid,
  p_customer_name text,
  p_customer_whatsapp text,
  p_booking_date date,
  p_booking_time time without time zone
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
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
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre na sua conta para agendar'; END IF;
  IF length(trim(p_customer_name)) < 2 OR length(trim(p_customer_name)) > 100 THEN RAISE EXCEPTION 'Nome inválido'; END IF;
  IF p_customer_whatsapp !~ '^[0-9]{10,13}$' THEN RAISE EXCEPTION 'WhatsApp inválido'; END IF;

  SELECT * INTO v_service FROM public.services WHERE id = p_service_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Serviço indisponível'; END IF;

  SELECT * INTO v_settings FROM public.settings ORDER BY created_at LIMIT 1;
  v_requested := p_booking_date::timestamp + p_booking_time;
  IF v_requested < v_now_local + make_interval(hours => coalesce(v_settings.min_advance_hours, 2)) THEN RAISE EXCEPTION 'Horário fora da antecedência mínima'; END IF;
  IF p_booking_date > v_now_local::date + coalesce(v_settings.max_days_ahead, 30) THEN RAISE EXCEPTION 'Data além do limite de agendamento'; END IF;

  SELECT * INTO v_rule FROM public.availability_rules WHERE weekday = extract(dow from p_booking_date)::integer AND is_active ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Estabelecimento fechado nesta data'; END IF;

  v_start_min := extract(hour from p_booking_time)::integer * 60 + extract(minute from p_booking_time)::integer;
  v_end_min := v_start_min + v_service.duration_min;
  IF p_booking_time < v_rule.open_time OR v_end_min > extract(hour from v_rule.close_time)::integer * 60 + extract(minute from v_rule.close_time)::integer THEN RAISE EXCEPTION 'Serviço não cabe no horário de funcionamento'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.blocks b
    WHERE (p_booking_date::timestamp + p_booking_time) AT TIME ZONE 'America/Sao_Paulo' < b.end_datetime
      AND ((p_booking_date::timestamp + p_booking_time) + make_interval(mins => v_service.duration_min)) AT TIME ZONE 'America/Sao_Paulo' > b.start_datetime
  ) THEN RAISE EXCEPTION 'Período bloqueado'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_booking_date::text));
  v_new_blocks := coalesce(v_service.interleaved_blocks, jsonb_build_array(jsonb_build_object('start_min', 0, 'duration_min', v_service.duration_min, 'blocked', true)));

  FOR v_existing IN
    SELECT b.booking_time, s.duration_min, s.interleaved_blocks
    FROM public.bookings b
    JOIN public.services s ON s.id = b.service_id
    WHERE b.booking_date = p_booking_date AND b.status IN ('PENDING_PAYMENT', 'CONFIRMED')
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

  INSERT INTO public.bookings(service_id, user_id, customer_name, customer_whatsapp, booking_date, booking_time, price, status, access_token_hash, access_token_expires_at)
  VALUES(v_service.id, auth.uid(), trim(p_customer_name), p_customer_whatsapp, p_booking_date, p_booking_time, v_service.price, 'PENDING_PAYMENT', encode(extensions.digest(v_token, 'sha256'), 'hex'), now() + interval '48 hours')
  RETURNING * INTO v_booking;

  INSERT INTO public.booking_events(booking_id, actor_id, event_type, new_status)
  VALUES(v_booking.id, auth.uid(), 'BOOKING_CREATED', v_booking.status);

  RETURN jsonb_build_object('booking_id', v_booking.id, 'access_token', v_token, 'requires_payment', coalesce(v_settings.require_payment_on_booking, true));
END
$function$;

CREATE OR REPLACE FUNCTION public.get_booking_by_token(p_booking_id uuid, p_access_token text)
RETURNS TABLE(id uuid, service_id uuid, customer_name text, booking_date date, booking_time time without time zone, status booking_status, price numeric, receipt_url text, payment_method text, service_name text, allow_in_person_payment boolean, pix_payload_data jsonb)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT b.id, b.service_id, b.customer_name, b.booking_date, b.booking_time, b.status, b.price, b.receipt_url, b.payment_method, s.name, s.allow_in_person_payment,
    jsonb_build_object('pix_chave', st.pix_chave, 'pix_nome_recebedor', st.pix_nome_recebedor, 'pix_cidade', st.pix_cidade)
  FROM public.bookings b
  JOIN public.services s ON s.id = b.service_id
  CROSS JOIN LATERAL (SELECT * FROM public.settings ORDER BY created_at LIMIT 1) st
  WHERE auth.uid() IS NOT NULL
    AND b.user_id = auth.uid()
    AND b.id = p_booking_id
    AND b.access_token_hash = encode(extensions.digest(p_access_token, 'sha256'), 'hex')
    AND b.access_token_expires_at > now()
$function$;

CREATE OR REPLACE FUNCTION public.set_booking_payment_method(p_booking_id uuid, p_access_token text, p_method text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF p_method NOT IN ('pix', 'presencial') THEN RAISE EXCEPTION 'Método inválido'; END IF;
  UPDATE public.bookings b SET payment_method = p_method
  WHERE b.id = p_booking_id
    AND b.user_id = auth.uid()
    AND b.access_token_hash = encode(extensions.digest(p_access_token, 'sha256'), 'hex')
    AND b.access_token_expires_at > now()
    AND (p_method = 'pix' OR EXISTS(SELECT 1 FROM public.services s WHERE s.id = b.service_id AND s.allow_in_person_payment));
  RETURN found;
END
$function$;

REVOKE ALL ON FUNCTION public.create_booking(uuid, text, text, date, time without time zone) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_booked_slots(date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_booking_by_token(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_public_booking_settings() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_booking_payment_method(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_booking_receipt(uuid, text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_booking(uuid, text, text, date, time without time zone) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_booked_slots(date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_booking_by_token(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_booking_settings() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_booking_payment_method(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_booking_receipt(uuid, text, text) TO authenticated, service_role;
