CREATE OR REPLACE FUNCTION private.set_booking_payment_method(p_booking_id uuid, p_access_token text, p_method text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF p_method NOT IN ('pix', 'presencial') THEN RAISE EXCEPTION 'Método inválido'; END IF;
  UPDATE public.bookings b SET payment_method = p_method, updated_at = now()
  WHERE b.id = p_booking_id
    AND b.user_id = auth.uid()
    AND b.status = 'PENDING_PAYMENT'
    AND b.access_token_hash = encode(extensions.digest(p_access_token, 'sha256'), 'hex')
    AND b.access_token_expires_at > now()
    AND (p_method = 'pix' OR EXISTS(SELECT 1 FROM public.services s WHERE s.id = b.service_id AND s.allow_in_person_payment));
  IF NOT FOUND THEN RAISE EXCEPTION 'Agendamento indisponível para pagamento'; END IF;
  RETURN true;
END
$function$;

CREATE OR REPLACE FUNCTION private.set_booking_receipt(p_booking_id uuid, p_access_token text, p_receipt_path text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR split_part(p_receipt_path, '/', 1) <> auth.uid()::text THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  UPDATE public.bookings b
  SET receipt_url = p_receipt_path, status = 'PENDING_PAYMENT', updated_at = now()
  WHERE b.id = p_booking_id
    AND b.user_id = auth.uid()
    AND b.status = 'PENDING_PAYMENT'
    AND b.access_token_hash = encode(extensions.digest(p_access_token, 'sha256'), 'hex')
    AND b.access_token_expires_at > now();
  IF NOT FOUND THEN RAISE EXCEPTION 'Agendamento indisponível para comprovante'; END IF;
  INSERT INTO public.booking_events(booking_id, actor_id, event_type, new_status, metadata)
  VALUES(p_booking_id, auth.uid(), 'RECEIPT_UPLOADED', 'PENDING_PAYMENT', jsonb_build_object('path', p_receipt_path));
  RETURN true;
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
  IF v_previous = 'CANCELED' OR v_previous = 'COMPLETED' THEN RAISE EXCEPTION 'Este agendamento já foi encerrado'; END IF;
  IF p_status NOT IN ('CONFIRMED', 'CANCELED', 'COMPLETED') THEN RAISE EXCEPTION 'Mudança de status inválida'; END IF;
  IF p_status = 'COMPLETED' AND v_previous <> 'CONFIRMED' THEN RAISE EXCEPTION 'Confirme o agendamento antes de concluí-lo'; END IF;

  UPDATE public.bookings
  SET status = p_status,
      cancellation_requested_at = CASE WHEN p_status = 'CANCELED' THEN NULL ELSE cancellation_requested_at END,
      access_token_hash = CASE WHEN p_status IN ('CANCELED', 'COMPLETED') THEN NULL ELSE access_token_hash END,
      access_token_expires_at = CASE WHEN p_status IN ('CANCELED', 'COMPLETED') THEN NULL ELSE access_token_expires_at END,
      updated_at = now()
  WHERE id = p_booking_id;

  INSERT INTO public.booking_events(booking_id, actor_id, event_type, previous_status, new_status)
  VALUES (p_booking_id, auth.uid(), 'STATUS_CHANGED', v_previous, p_status);
  RETURN true;
END
$function$;