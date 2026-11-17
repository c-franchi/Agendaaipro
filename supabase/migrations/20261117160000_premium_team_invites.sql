-- Fase 3: convites por token de uso único, associados a e-mail confirmado.
-- Apenas o titular pode convidar/revogar; aceitação requer conta própria autenticada.

CREATE TABLE public.business_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  invited_email text NOT NULL CHECK (length(invited_email) BETWEEN 5 AND 254),
  token_hash text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX business_invites_business_idx ON public.business_invites(business_id,expires_at);
ALTER TABLE public.business_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_invites FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.business_invites TO service_role;
GRANT SELECT ON public.business_invites TO authenticated;
CREATE POLICY "Owner sees invitation status" ON public.business_invites FOR SELECT TO authenticated
USING (EXISTS(SELECT 1 FROM public.businesses b
  WHERE b.id=business_id AND b.owner_user_id=auth.uid()));

CREATE FUNCTION public.invite_business_professional(p_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_business uuid; v_secret text; v_invite uuid; v_email text;
BEGIN
  v_email:=lower(btrim(coalesce(p_email,'')));
  IF v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    OR char_length(v_email)>254 THEN RAISE EXCEPTION 'E-mail inválido'; END IF;
  SELECT id INTO v_business FROM public.businesses
  WHERE owner_user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Apenas o titular pode adicionar profissionais'; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.business_entitlements e
    WHERE e.business_id=v_business AND e.plan_key='premium'
    AND e.status IN ('active','trialing') AND e.seat_limit>=2
    AND (e.valid_until IS NULL OR e.valid_until>now())
  ) THEN RAISE EXCEPTION 'Segundo profissional disponível somente no Premium ativo'; END IF;
  IF EXISTS(
    SELECT 1 FROM public.business_members m
    WHERE m.business_id=v_business AND m.role='professional' AND m.status='active'
  ) THEN RAISE EXCEPTION 'O Premium já tem dois profissionais ativos'; END IF;
  -- Apenas um convite aberto para não ultrapassar o limite de assentos.
  IF EXISTS(
    SELECT 1 FROM public.business_invites i
    WHERE i.business_id=v_business AND i.accepted_at IS NULL
      AND i.revoked_at IS NULL AND i.expires_at>now()
  ) THEN RAISE EXCEPTION 'Revogue ou aguarde expirar o convite pendente'; END IF;
  IF EXISTS(SELECT 1 FROM auth.users u
      WHERE lower(u.email)=v_email AND u.id=auth.uid()) THEN
    RAISE EXCEPTION 'O titular já possui acesso'; END IF;
  v_secret:=encode(extensions.gen_random_bytes(32),'hex');
  INSERT INTO public.business_invites(business_id,invited_email,token_hash,created_by,expires_at)
  VALUES(v_business,v_email,encode(extensions.digest(v_secret,'sha256'),'hex'),auth.uid(),now()+interval '72 hours')
  RETURNING id INTO v_invite;
  RETURN jsonb_build_object('invite_id',v_invite,'token',v_secret,
    'expires_at',(now()+interval '72 hours'),'email',v_email);
END;$$;
REVOKE ALL ON FUNCTION public.invite_business_professional(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.invite_business_professional(text) TO authenticated;

CREATE FUNCTION public.accept_business_invitation(p_token text,p_display_name text,p_specialty text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_invite public.business_invites%rowtype; v_user_email text; v_member uuid; v_professional uuid;
BEGIN
  IF auth.uid() IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Convite inválido'; END IF;
  IF length(btrim(coalesce(p_display_name,''))) NOT BETWEEN 2 AND 100 THEN
    RAISE EXCEPTION 'Informe o nome profissional'; END IF;
  SELECT lower(u.email) INTO v_user_email FROM auth.users u
  WHERE u.id=auth.uid() AND u.email_confirmed_at IS NOT NULL;
  IF v_user_email IS NULL THEN RAISE EXCEPTION 'Confirme seu e-mail para aceitar o convite'; END IF;
  -- Lock é repetido por negócio: aceites simultâneos não ultrapassam o limite.
  SELECT * INTO v_invite FROM public.business_invites i
  WHERE i.token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
    AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>now();
  IF NOT FOUND OR v_invite.invited_email<>v_user_email THEN
    RAISE EXCEPTION 'Convite inválido, vencido ou para outro e-mail'; END IF;
  PERFORM 1 FROM public.businesses WHERE id=v_invite.business_id FOR UPDATE;
  SELECT * INTO v_invite FROM public.business_invites i
  WHERE i.id=v_invite.id FOR UPDATE;
  IF v_invite.accepted_at IS NOT NULL OR v_invite.revoked_at IS NOT NULL OR v_invite.expires_at<=now()
     OR v_invite.invited_email<>v_user_email THEN
    RAISE EXCEPTION 'Convite indisponível'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.business_entitlements e
    WHERE e.business_id=v_invite.business_id AND e.plan_key='premium'
      AND e.status IN ('active','trialing') AND e.seat_limit=2
      AND (e.valid_until IS NULL OR e.valid_until>now())) THEN
    RAISE EXCEPTION 'Assinatura Premium sem vagas ativas'; END IF;
  IF EXISTS(SELECT 1 FROM public.business_members m
      WHERE m.business_id=v_invite.business_id AND m.user_id=auth.uid()
        AND m.role<>'professional') THEN
    RAISE EXCEPTION 'Este usuário já é titular'; END IF;
  INSERT INTO public.business_members(business_id,user_id,role,status)
  VALUES(v_invite.business_id,auth.uid(),'professional','active')
  ON CONFLICT(business_id,user_id)
  DO UPDATE SET role='professional',status='active',updated_at=now()
  RETURNING id INTO v_member;
  INSERT INTO public.professional_profiles(business_id,member_id,display_name,specialty,is_active)
  VALUES(v_invite.business_id,v_member,btrim(p_display_name),
    nullif(btrim(coalesce(p_specialty,'')),''),true)
  ON CONFLICT(member_id) DO UPDATE SET
    display_name=excluded.display_name,specialty=excluded.specialty,is_active=true
  RETURNING id INTO v_professional;
  UPDATE public.business_invites SET accepted_at=now() WHERE id=v_invite.id;
  RETURN jsonb_build_object('business_id',v_invite.business_id,'professional_id',v_professional);
END;$$;
REVOKE ALL ON FUNCTION public.accept_business_invitation(text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.accept_business_invitation(text,text,text) TO authenticated;

CREATE FUNCTION public.revoke_business_invitation(p_invite_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_business uuid;
BEGIN
  SELECT b.id INTO v_business FROM public.businesses b
  WHERE b.owner_user_id=auth.uid();
  IF v_business IS NULL THEN RAISE EXCEPTION 'Acesso restrito ao titular'; END IF;
  UPDATE public.business_invites SET revoked_at=now()
  WHERE id=p_invite_id AND business_id=v_business AND accepted_at IS NULL AND revoked_at IS NULL;
  RETURN FOUND;
END;$$;
REVOKE ALL ON FUNCTION public.revoke_business_invitation(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.revoke_business_invitation(uuid) TO authenticated;

CREATE FUNCTION public.revoke_business_professional(p_member_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_business uuid; v_pending integer;
BEGIN
  SELECT id INTO v_business FROM public.businesses
  WHERE owner_user_id=auth.uid() FOR UPDATE;
  IF v_business IS NULL THEN RAISE EXCEPTION 'Acesso restrito ao titular'; END IF;
  -- Nunca apaga históricos; bloquear caso existam atendimentos futuros.
  SELECT count(*) INTO v_pending FROM public.bookings b
  JOIN public.professional_profiles p ON p.id=b.professional_id
  WHERE p.member_id=p_member_id AND b.business_id=v_business
    AND b.status IN ('PENDING_PAYMENT','CONFIRMED')
    AND b.booking_date >= timezone('America/Sao_Paulo',now())::date;
  IF v_pending>0 THEN
    RAISE EXCEPTION 'Reatribua ou cancele os agendamentos futuros antes de remover o acesso';
  END IF;
  UPDATE public.business_members SET status='revoked',updated_at=now()
  WHERE id=p_member_id AND business_id=v_business
    AND role='professional' AND status='active';
  IF FOUND THEN
    UPDATE public.professional_profiles SET is_active=false
    WHERE member_id=p_member_id;
    RETURN true;
  END IF;
  RETURN false;
END;$$;
REVOKE ALL ON FUNCTION public.revoke_business_professional(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.revoke_business_professional(uuid) TO authenticated;
