-- Privileged implementations live outside the exposed API schema.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

ALTER FUNCTION public.create_booking(uuid, text, text, date, time without time zone) SET SCHEMA private;
ALTER FUNCTION public.get_booked_slots(date) SET SCHEMA private;
ALTER FUNCTION public.get_booking_by_token(uuid, text) SET SCHEMA private;
ALTER FUNCTION public.get_public_booking_settings() SET SCHEMA private;
ALTER FUNCTION public.has_role(uuid, public.app_role) SET SCHEMA private;
ALTER FUNCTION public.set_booking_payment_method(uuid, text, text) SET SCHEMA private;
ALTER FUNCTION public.set_booking_receipt(uuid, text, text) SET SCHEMA private;

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'private'
AS $function$
  SELECT private.has_role(_user_id, _role)
$function$;

CREATE FUNCTION public.create_booking(p_service_id uuid, p_customer_name text, p_customer_whatsapp text, p_booking_date date, p_booking_time time without time zone)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path TO 'public', 'private'
AS $function$
  SELECT private.create_booking(p_service_id, p_customer_name, p_customer_whatsapp, p_booking_date, p_booking_time)
$function$;

CREATE FUNCTION public.get_booked_slots(p_booking_date date)
RETURNS TABLE(booking_time time without time zone, duration_min integer, interleaved_blocks jsonb)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'private'
AS $function$
  SELECT * FROM private.get_booked_slots(p_booking_date)
$function$;

CREATE FUNCTION public.get_booking_by_token(p_booking_id uuid, p_access_token text)
RETURNS TABLE(id uuid, service_id uuid, customer_name text, booking_date date, booking_time time without time zone, status public.booking_status, price numeric, receipt_url text, payment_method text, service_name text, allow_in_person_payment boolean, pix_payload_data jsonb)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'private'
AS $function$
  SELECT * FROM private.get_booking_by_token(p_booking_id, p_access_token)
$function$;

CREATE FUNCTION public.get_public_booking_settings()
RETURNS TABLE(min_advance_hours integer, max_days_ahead integer, cancel_policy_hours integer, require_payment_on_booking boolean)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'private'
AS $function$
  SELECT * FROM private.get_public_booking_settings()
$function$;

CREATE FUNCTION public.set_booking_payment_method(p_booking_id uuid, p_access_token text, p_method text)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path TO 'public', 'private'
AS $function$
  SELECT private.set_booking_payment_method(p_booking_id, p_access_token, p_method)
$function$;

CREATE FUNCTION public.set_booking_receipt(p_booking_id uuid, p_access_token text, p_receipt_path text)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path TO 'public', 'private'
AS $function$
  SELECT private.set_booking_receipt(p_booking_id, p_access_token, p_receipt_path)
$function$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_booking(uuid, text, text, date, time without time zone) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_booked_slots(date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_booking_by_token(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_public_booking_settings() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_booking_payment_method(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_booking_receipt(uuid, text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_booking(uuid, text, text, date, time without time zone) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_booked_slots(date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_booking_by_token(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_booking_settings() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_booking_payment_method(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_booking_receipt(uuid, text, text) TO authenticated, service_role;
