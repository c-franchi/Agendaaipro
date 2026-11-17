-- Cadastro manual de atendimento para o profissional autenticado.
-- Reutiliza as regras de serviço/expediente/bloqueio/conflitos da RPC v2.
-- Não produz cobranças, links Pix ou comprovantes em nome do profissional.
CREATE FUNCTION public.professional_create_manual_booking(
  p_service_id uuid,
  p_customer_name text,
  p_customer_whatsapp text,
  p_booking_date date,
  p_booking_time time without time zone
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_professional_id uuid;
  v_booking_result jsonb;
  v_booking_id uuid;
BEGIN
  v_professional_id := public.my_professional_id();
  IF v_professional_id IS NULL THEN
    RAISE EXCEPTION 'Acesso profissional não autorizado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.services s
    WHERE s.id=p_service_id
      AND s.professional_id=v_professional_id
      AND s.is_active
  ) THEN
    RAISE EXCEPTION 'Escolha um serviço da sua própria agenda';
  END IF;

  -- Reaproveita lock transacional, validações de antecedência, disponibilidade
  -- e conflito por profissional. A conversão a CONFIRMED é atômica.
  v_booking_result := public.create_booking_v2(
    p_service_id,v_professional_id,p_customer_name,p_customer_whatsapp,
    p_booking_date,p_booking_time
  );
  v_booking_id := (v_booking_result->>'booking_id')::uuid;

  UPDATE public.bookings b
  SET user_id=NULL,
      status='CONFIRMED',
      payment_method='presencial',
      access_token_hash=NULL,
      access_token_expires_at=NULL,
      updated_at=now()
  WHERE b.id=v_booking_id
    AND b.professional_id=v_professional_id
    AND b.user_id=auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Não foi possível confirmar o atendimento manual';
  END IF;

  INSERT INTO public.booking_events(
    booking_id,actor_id,event_type,previous_status,new_status,metadata
  ) VALUES (
    v_booking_id,auth.uid(),'MANUAL_BOOKING_CONFIRMED',
    'PENDING_PAYMENT','CONFIRMED',
    jsonb_build_object('source','professional_dashboard')
  );
  RETURN v_booking_id;
END;
$$;
REVOKE ALL ON FUNCTION public.professional_create_manual_booking(uuid,text,text,date,time without time zone)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.professional_create_manual_booking(uuid,text,text,date,time without time zone)
TO authenticated;
