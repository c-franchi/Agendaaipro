-- Perfil profissional independente da configuração do titular e da assinatura.
CREATE FUNCTION public.update_my_professional_profile(
  p_display_name text,
  p_specialty text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_professional uuid;
BEGIN
  v_professional := public.my_professional_id();
  IF v_professional IS NULL THEN
    RAISE EXCEPTION 'Acesso profissional não autorizado';
  END IF;
  IF length(btrim(coalesce(p_display_name,''))) NOT BETWEEN 2 AND 100 THEN
    RAISE EXCEPTION 'Nome deve conter de 2 a 100 caracteres';
  END IF;
  IF length(coalesce(p_specialty,'')) > 120 THEN
    RAISE EXCEPTION 'Especialidade muito longa';
  END IF;

  UPDATE public.professional_profiles p
  SET display_name=btrim(p_display_name),
      specialty=NULLIF(btrim(coalesce(p_specialty,'')),'')
  WHERE p.id=v_professional AND p.is_active;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado ou desativado';
  END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.update_my_professional_profile(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_my_professional_profile(text,text) TO authenticated;
