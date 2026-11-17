-- Compatibility fix: the legacy admin screen MUST NOT delete the invited professional's schedule.
-- Override its private RPC implementation while preserving the public function signature.
CREATE OR REPLACE FUNCTION private.save_availability_rules(p_rules jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_rule jsonb;
  v_days integer[] := ARRAY[]::integer[];
  v_weekday integer;
  v_open time;
  v_close time;
  v_slot integer;
  v_professional uuid;
  v_business uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT private.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Acesso não autorizado';
  END IF;
  IF jsonb_typeof(p_rules) <> 'array' OR jsonb_array_length(p_rules) <> 7 THEN
    RAISE EXCEPTION 'Informe os sete dias da semana';
  END IF;
  FOR v_rule IN SELECT value FROM jsonb_array_elements(p_rules) LOOP
    v_weekday := (v_rule->>'weekday')::integer;
    v_open := (v_rule->>'open_time')::time;
    v_close := (v_rule->>'close_time')::time;
    v_slot := (v_rule->>'slot_min')::integer;
    IF v_weekday IS NULL OR v_weekday<0 OR v_weekday>6 OR v_weekday=ANY(v_days)
      OR v_slot IS NULL OR v_slot<5 OR v_slot>240
      OR (coalesce((v_rule->>'is_active')::boolean,false) AND v_open>=v_close) THEN
      RAISE EXCEPTION 'Expediente inválido';
    END IF;
    v_days := array_append(v_days,v_weekday);
  END LOOP;

  SELECT p.id,p.business_id INTO v_professional,v_business
  FROM public.professional_profiles p
  JOIN public.business_members m ON m.id=p.member_id
  JOIN public.businesses b ON b.id=p.business_id
  WHERE m.role='owner' AND m.status='active'
    AND b.owner_user_id=auth.uid()
  LIMIT 1;
  IF EXISTS (SELECT 1 FROM public.businesses) AND v_professional IS NULL THEN
    RAISE EXCEPTION 'Somente o titular pode alterar o expediente principal';
  END IF;
  IF v_professional IS NULL THEN
    -- Installation not initialized: retain v1 global rules, do not touch scoped staff.
    DELETE FROM public.availability_rules WHERE professional_id IS NULL;
    INSERT INTO public.availability_rules(weekday,is_active,open_time,close_time,slot_min)
    SELECT (value->>'weekday')::integer,
      coalesce((value->>'is_active')::boolean,false),
      (value->>'open_time')::time,(value->>'close_time')::time,
      (value->>'slot_min')::integer
    FROM jsonb_array_elements(p_rules);
  ELSE
    PERFORM 1 FROM public.professional_profiles WHERE id=v_professional FOR UPDATE;
    DELETE FROM public.availability_rules WHERE professional_id=v_professional;
    INSERT INTO public.availability_rules(business_id,professional_id,weekday,is_active,open_time,close_time,slot_min)
    SELECT v_business,v_professional,(value->>'weekday')::integer,
      coalesce((value->>'is_active')::boolean,false),
      (value->>'open_time')::time,(value->>'close_time')::time,
      (value->>'slot_min')::integer
    FROM jsonb_array_elements(p_rules);
  END IF;
  RETURN true;
END;$$;
-- Old execute grants stay intact; this replacement is used by public.save_availability_rules.
REVOKE ALL ON FUNCTION private.save_availability_rules(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.save_availability_rules(jsonb) TO authenticated,service_role;
