-- Chat por profissional, com clientes autenticados e histórico preservado.
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id),
  ADD COLUMN IF NOT EXISTS professional_id uuid REFERENCES public.professional_profiles(id);
CREATE INDEX conversations_professional_idx ON public.conversations(professional_id,last_message_at DESC);

-- Associação inicial de conversas antigas ao titular já provisionado.
UPDATE public.conversations c
SET business_id=p.business_id,professional_id=p.id
FROM public.professional_profiles p
JOIN public.business_members m ON m.id=p.member_id AND m.role='owner'
WHERE c.business_id IS NULL AND c.professional_id IS NULL;

CREATE FUNCTION private.scope_conversation_professional()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_business uuid; v_professional uuid;
BEGIN
  IF TG_OP='UPDATE' THEN
    IF auth.uid() IS NOT NULL AND
      (NEW.business_id IS DISTINCT FROM OLD.business_id
        OR NEW.professional_id IS DISTINCT FROM OLD.professional_id
        OR NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
      RAISE EXCEPTION 'Não é permitido transferir conversa diretamente';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.professional_id IS NOT NULL THEN
    SELECT p.business_id,p.id INTO v_business,v_professional
    FROM public.professional_profiles p
    JOIN public.business_members m ON m.id=p.member_id AND m.status='active'
    WHERE p.id=NEW.professional_id AND p.is_active
      AND (m.role='owner' OR public.is_active_business_member(p.business_id));
    IF v_professional IS NULL THEN RAISE EXCEPTION 'Profissional indisponível'; END IF;
  ELSE
    SELECT p.business_id,p.id INTO v_business,v_professional
    FROM public.professional_profiles p
    JOIN public.business_members m ON m.id=p.member_id AND m.role='owner' AND m.status='active'
    LIMIT 1;
  END IF;
  IF v_business IS NOT NULL THEN
    IF NEW.business_id IS NOT NULL AND NEW.business_id<>v_business THEN
      RAISE EXCEPTION 'Negócio não corresponde ao profissional'; END IF;
    NEW.business_id:=v_business;
    NEW.professional_id:=v_professional;
  END IF;
  RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION private.scope_conversation_professional() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER scope_conversation_before_write
BEFORE INSERT OR UPDATE OF business_id,professional_id,user_id
ON public.conversations FOR EACH ROW
EXECUTE FUNCTION private.scope_conversation_professional();

-- Quando o titular inicializa o negócio depois de aplicar as migrations,
-- atribuir as conversas legadas à conta dele automaticamente.
CREATE FUNCTION private.assign_owner_chats()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.business_members m
      WHERE m.id=NEW.member_id AND m.role='owner') THEN
    UPDATE public.conversations
      SET business_id=NEW.business_id,professional_id=NEW.id
    WHERE business_id IS NULL AND professional_id IS NULL;
  END IF;
  RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION private.assign_owner_chats() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER owner_professional_backfills_chat
AFTER INSERT ON public.professional_profiles FOR EACH ROW
EXECUTE FUNCTION private.assign_owner_chats();

CREATE POLICY "Professional views own conversations"
ON public.conversations FOR SELECT TO authenticated
USING(professional_id=public.my_professional_id());
CREATE POLICY "Professional updates own conversation counters"
ON public.conversations FOR UPDATE TO authenticated
USING(professional_id=public.my_professional_id())
WITH CHECK(professional_id=public.my_professional_id());
CREATE POLICY "Professional reads own conversation messages"
ON public.messages FOR SELECT TO authenticated
USING(EXISTS(SELECT 1 FROM public.conversations c
  WHERE c.id=conversation_id AND c.professional_id=public.my_professional_id()));
CREATE POLICY "Professional replies to own clients"
ON public.messages FOR INSERT TO authenticated
WITH CHECK(sender_type='admin' AND EXISTS(SELECT 1 FROM public.conversations c
  WHERE c.id=conversation_id AND c.professional_id=public.my_professional_id()));

CREATE FUNCTION public.start_professional_conversation(p_professional_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_profile public.profiles%rowtype; v_business uuid; v_conversation uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre na sua conta'; END IF;
  SELECT p.business_id INTO v_business
    FROM public.professional_profiles p
    JOIN public.business_members m ON m.id=p.member_id AND m.status='active'
    JOIN public.business_entitlements e ON e.business_id=p.business_id
    WHERE p.id=p_professional_id AND p.is_active
      AND (m.role='owner' OR (e.plan_key='premium' AND e.seat_limit=2
          AND e.status IN ('active','trialing') AND (e.valid_until IS NULL OR e.valid_until>now())));
  IF v_business IS NULL THEN RAISE EXCEPTION 'Profissional indisponível'; END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id=auth.uid();
  IF NOT FOUND OR length(btrim(coalesce(v_profile.full_name,'')))<2 THEN
    RAISE EXCEPTION 'Complete seu perfil antes de iniciar uma conversa'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(auth.uid()::text),hashtext(p_professional_id::text));
  SELECT id INTO v_conversation FROM public.conversations c
  WHERE c.user_id=auth.uid() AND c.professional_id=p_professional_id
  ORDER BY created_at LIMIT 1;
  IF v_conversation IS NOT NULL THEN RETURN v_conversation; END IF;
  INSERT INTO public.conversations(user_id,customer_name,customer_whatsapp,
    business_id,professional_id)
  VALUES(auth.uid(),v_profile.full_name,coalesce(v_profile.phone,''),
    v_business,p_professional_id)
  RETURNING id INTO v_conversation;
  RETURN v_conversation;
END;$$;
REVOKE ALL ON FUNCTION public.start_professional_conversation(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.start_professional_conversation(uuid) TO authenticated;
