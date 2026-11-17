-- A alteração do expediente de um profissional é uma transação única.
CREATE FUNCTION public.save_professional_availability(p_rules jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_professional uuid; v_business uuid; v_rule jsonb; v_days int[]:=ARRAY[]::int[];
  v_day int; v_start time; v_end time; v_step int;
BEGIN
  v_professional:=public.my_professional_id();
  IF v_professional IS NULL THEN RAISE EXCEPTION 'Acesso profissional não autorizado'; END IF;
  SELECT business_id INTO v_business FROM public.professional_profiles WHERE id=v_professional;
  IF jsonb_typeof(p_rules)<>'array' OR jsonb_array_length(p_rules)<>7 THEN
    RAISE EXCEPTION 'Envie os sete dias da semana'; END IF;
  FOR v_rule IN SELECT value FROM jsonb_array_elements(p_rules) LOOP
    v_day:=(v_rule->>'weekday')::int;
    v_start:=(v_rule->>'open_time')::time;
    v_end:=(v_rule->>'close_time')::time;
    v_step:=(v_rule->>'slot_min')::int;
    IF v_day IS NULL OR v_day<0 OR v_day>6 OR v_day=ANY(v_days)
      OR v_step IS NULL OR v_step<5 OR v_step>240
      OR (coalesce((v_rule->>'is_active')::boolean,false) AND v_start>=v_end) THEN
      RAISE EXCEPTION 'Expediente inválido'; END IF;
    v_days:=array_append(v_days,v_day);
  END LOOP;
  PERFORM 1 FROM public.professional_profiles WHERE id=v_professional FOR UPDATE;
  DELETE FROM public.availability_rules WHERE professional_id=v_professional;
  INSERT INTO public.availability_rules(business_id,professional_id,weekday,open_time,close_time,slot_min,is_active)
  SELECT v_business,v_professional,(value->>'weekday')::int,
    (value->>'open_time')::time,(value->>'close_time')::time,
    (value->>'slot_min')::int,coalesce((value->>'is_active')::boolean,false)
  FROM jsonb_array_elements(p_rules);
  RETURN true;
END;$$;
REVOKE ALL ON FUNCTION public.save_professional_availability(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_professional_availability(jsonb) TO authenticated;
