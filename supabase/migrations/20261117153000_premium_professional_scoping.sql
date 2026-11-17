-- Fase 2: ativação explícita e reversível da estrutura multiprofissional.
-- Executar somente após a migration 20261117150000. Nada é provisionado automaticamente.
-- O banco do aplicativo-base tem uma instalação por negócio.

ALTER TABLE public.services ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS professional_id uuid REFERENCES public.professional_profiles(id);
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS professional_id uuid REFERENCES public.professional_profiles(id);
ALTER TABLE public.availability_rules ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.availability_rules ADD COLUMN IF NOT EXISTS professional_id uuid REFERENCES public.professional_profiles(id);
ALTER TABLE public.blocks ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.blocks ADD COLUMN IF NOT EXISTS professional_id uuid REFERENCES public.professional_profiles(id);
ALTER TABLE public.portfolio_items ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.portfolio_items ADD COLUMN IF NOT EXISTS professional_id uuid REFERENCES public.professional_profiles(id);
CREATE INDEX IF NOT EXISTS services_professional_idx ON public.services(professional_id);
CREATE INDEX IF NOT EXISTS bookings_professional_date_idx ON public.bookings(professional_id,booking_date,booking_time);
CREATE INDEX IF NOT EXISTS rules_professional_weekday_idx ON public.availability_rules(professional_id,weekday);
CREATE INDEX IF NOT EXISTS blocks_professional_idx ON public.blocks(professional_id,start_datetime);

-- Apenas admins legados podem inicializar o negócio; nunca deriva do e-mail informado pelo browser.
-- O perfil antigo é preservado e passa a pertencer ao titular.
CREATE FUNCTION public.initialize_business(p_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_business uuid; v_professional uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT private.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Acesso restrito ao titular administrador';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('agendai:bootstrap-business'));
  SELECT b.id INTO v_business FROM public.businesses b LIMIT 1;
  IF v_business IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.businesses WHERE id=v_business AND owner_user_id=auth.uid()) THEN
      RAISE EXCEPTION 'O negócio já possui titular definido';
    END IF;
    RETURN v_business;
  END IF;
  IF char_length(btrim(coalesce(p_name,''))) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'Nome do negócio inválido';
  END IF;
  INSERT INTO public.businesses(owner_user_id,name)
  VALUES(auth.uid(),btrim(p_name)) RETURNING id INTO v_business;
  INSERT INTO public.business_entitlements(business_id,plan_key,status,seat_limit)
  VALUES(v_business,'essencial','active',1);
  INSERT INTO public.business_members(business_id,user_id,role,status)
  VALUES(v_business,auth.uid(),'owner','active');
  INSERT INTO public.professional_profiles(business_id,member_id,display_name,specialty)
  SELECT v_business,m.id,p_name,'Profissional titular' FROM public.business_members m
  WHERE m.business_id=v_business AND m.role='owner'
  RETURNING id INTO v_professional;
  -- Migra apenas linhas sem escopo; não apaga nem reescreve valores da agenda.
  UPDATE public.services SET business_id=v_business,professional_id=v_professional WHERE business_id IS NULL;
  UPDATE public.bookings SET business_id=v_business,professional_id=v_professional WHERE business_id IS NULL;
  UPDATE public.availability_rules SET business_id=v_business,professional_id=v_professional WHERE business_id IS NULL;
  UPDATE public.blocks SET business_id=v_business,professional_id=v_professional WHERE business_id IS NULL;
  UPDATE public.portfolio_items SET business_id=v_business,professional_id=v_professional WHERE business_id IS NULL;
  RETURN v_business;
END;$$;
REVOKE ALL ON FUNCTION public.initialize_business(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.initialize_business(text) TO authenticated;

-- Completa o escopo para as escritas antigas sem alterar as RPCs legadas.
CREATE FUNCTION private.scope_professional_record()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_business uuid; v_professional uuid;
BEGIN
  IF TG_TABLE_NAME = 'bookings' AND NEW.service_id IS NOT NULL THEN
    SELECT s.business_id,s.professional_id INTO v_business,v_professional
    FROM public.services s WHERE s.id=NEW.service_id;
  ELSIF NEW.professional_id IS NOT NULL THEN
    SELECT p.business_id,p.id INTO v_business,v_professional
    FROM public.professional_profiles p WHERE p.id=NEW.professional_id;
  ELSIF auth.uid() IS NOT NULL THEN
    SELECT p.business_id,p.id INTO v_business,v_professional
    FROM public.professional_profiles p
    JOIN public.business_members m ON m.id=p.member_id
    WHERE m.user_id=auth.uid() AND m.status='active'
    ORDER BY (m.role='owner') DESC LIMIT 1;
  END IF;
  IF v_business IS NOT NULL THEN
    IF NEW.business_id IS NOT NULL AND NEW.business_id<>v_business THEN
      RAISE EXCEPTION 'Registro pertence a outro negócio';
    END IF;
    IF NEW.professional_id IS NOT NULL AND NEW.professional_id<>v_professional THEN
      RAISE EXCEPTION 'Profissional não corresponde ao serviço/usuário';
    END IF;
    NEW.business_id:=v_business;
    NEW.professional_id:=v_professional;
  ELSIF NEW.professional_id IS NOT NULL THEN
    RAISE EXCEPTION 'Profissional inválido';
  END IF;
  RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION private.scope_professional_record() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER scope_services BEFORE INSERT OR UPDATE OF business_id,professional_id ON public.services
FOR EACH ROW EXECUTE FUNCTION private.scope_professional_record();
CREATE TRIGGER scope_rules BEFORE INSERT OR UPDATE OF business_id,professional_id ON public.availability_rules
FOR EACH ROW EXECUTE FUNCTION private.scope_professional_record();
CREATE TRIGGER scope_blocks BEFORE INSERT OR UPDATE OF business_id,professional_id ON public.blocks
FOR EACH ROW EXECUTE FUNCTION private.scope_professional_record();
CREATE TRIGGER scope_bookings BEFORE INSERT OR UPDATE OF business_id,professional_id,service_id ON public.bookings
FOR EACH ROW EXECUTE FUNCTION private.scope_professional_record();
CREATE TRIGGER scope_portfolio BEFORE INSERT OR UPDATE OF business_id,professional_id ON public.portfolio_items
FOR EACH ROW EXECUTE FUNCTION private.scope_professional_record();

-- Proteger usuário profissional sem dar poderes de admin.
CREATE FUNCTION public.my_professional_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT p.id FROM public.professional_profiles p
  JOIN public.business_members m ON m.id=p.member_id AND m.business_id=p.business_id
  WHERE m.user_id=auth.uid() AND m.status='active'
    AND public.is_active_business_member(m.business_id)
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.my_professional_id() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.my_professional_id() TO authenticated;

CREATE POLICY "Professionals read own inactive and active services"
ON public.services FOR SELECT TO authenticated
USING (professional_id IS NOT NULL AND professional_id=public.my_professional_id());
CREATE POLICY "Professionals add own services"
ON public.services FOR INSERT TO authenticated
WITH CHECK (professional_id=public.my_professional_id() AND business_id IN (
 SELECT b.business_id FROM public.business_members b WHERE b.user_id=auth.uid() AND b.status='active'
));
CREATE POLICY "Professionals update own services"
ON public.services FOR UPDATE TO authenticated
USING (professional_id=public.my_professional_id())
WITH CHECK (professional_id=public.my_professional_id());
CREATE POLICY "Professionals remove own services"
ON public.services FOR DELETE TO authenticated
USING (professional_id=public.my_professional_id());

CREATE POLICY "Professionals read own bookings"
ON public.bookings FOR SELECT TO authenticated
USING (professional_id=public.my_professional_id());
CREATE POLICY "Professionals read own rules" ON public.availability_rules
FOR SELECT TO authenticated USING (professional_id=public.my_professional_id());
CREATE POLICY "Professionals add own rules" ON public.availability_rules
FOR INSERT TO authenticated WITH CHECK (professional_id=public.my_professional_id());
CREATE POLICY "Professionals update own rules" ON public.availability_rules
FOR UPDATE TO authenticated USING (professional_id=public.my_professional_id())
WITH CHECK (professional_id=public.my_professional_id());
CREATE POLICY "Professionals delete own rules" ON public.availability_rules
FOR DELETE TO authenticated USING (professional_id=public.my_professional_id());
CREATE POLICY "Professionals read own blocks" ON public.blocks
FOR SELECT TO authenticated USING (professional_id=public.my_professional_id());
CREATE POLICY "Professionals add own blocks" ON public.blocks
FOR INSERT TO authenticated WITH CHECK (professional_id=public.my_professional_id());
CREATE POLICY "Professionals delete own blocks" ON public.blocks
FOR DELETE TO authenticated USING (professional_id=public.my_professional_id());

-- Nunca retornar informações de contato dos membros ao público.
CREATE FUNCTION public.list_booking_professionals()
RETURNS TABLE(id uuid,display_name text,specialty text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
 SELECT p.id,p.display_name,p.specialty
 FROM public.professional_profiles p
 JOIN public.business_members m ON m.id=p.member_id
 JOIN public.business_entitlements e ON e.business_id=p.business_id
 WHERE p.is_active AND m.status='active'
   AND (m.role='owner' OR
     (e.plan_key='premium' AND e.seat_limit=2
       AND e.status IN ('active','trialing') AND
       (e.valid_until IS NULL OR e.valid_until>now())))
 ORDER BY p.display_name;
$$;
REVOKE ALL ON FUNCTION public.list_booking_professionals() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_booking_professionals() TO authenticated;

-- O app preserva o contrato v1 até que as telas v2 estejam prontas.
-- O cliente não pode alterar o próprio professional_id, inclusive por API.
