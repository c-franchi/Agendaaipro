-- Premium multiprofissional — FASE 1 (schema isolado, não ativa UI nem altera agendamentos legados).
-- Provisionamento deve ser feito apenas pelo backend confiável, nunca pelo navegador.
-- Não distribuir user_roles.admin aos profissionais adicionais.
-- Migração aditiva: preserva os dados existentes e não insere membros automaticamente.

CREATE TABLE public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 120),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.business_entitlements (
  business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  plan_key text NOT NULL CHECK (plan_key IN ('essencial','pro','premium')),
  status text NOT NULL CHECK (status IN ('inactive','trialing','active','past_due','canceled')),
  seat_limit integer NOT NULL DEFAULT 1 CHECK (seat_limit BETWEEN 1 AND 2),
  valid_until timestamptz,
  source_ref text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT premium_seat_limit_only CHECK (seat_limit = 1 OR plan_key = 'premium')
);

CREATE TABLE public.business_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','professional')),
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','active','revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, user_id),
  UNIQUE (id, business_id)
);
CREATE UNIQUE INDEX one_owner_per_business ON public.business_members(business_id)
WHERE role = 'owner';
CREATE INDEX business_members_user_idx ON public.business_members(user_id, status);

CREATE TABLE public.professional_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  member_id uuid NOT NULL UNIQUE,
  display_name text NOT NULL CHECK (char_length(btrim(display_name)) BETWEEN 2 AND 100),
  specialty text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (member_id, business_id)
    REFERENCES public.business_members(id, business_id) ON DELETE CASCADE,
  UNIQUE (id, business_id)
);
CREATE INDEX professional_profiles_business_idx ON public.professional_profiles(business_id);

-- SECURITY DEFINER utilizado unicamente para consultar o próprio vínculo, sem
-- parametrização de usuário ou exposição de registros de terceiros.
CREATE FUNCTION public.is_active_business_member(p_business_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.business_members m
    LEFT JOIN public.business_entitlements e ON e.business_id = m.business_id
    WHERE m.business_id = p_business_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'
      AND (
        m.role = 'owner'
        OR (
          m.role = 'professional'
          AND e.plan_key = 'premium'
          AND e.status IN ('active', 'trialing')
          AND e.seat_limit = 2
          AND (e.valid_until IS NULL OR e.valid_until > now())
        )
      )
  );
$$;
REVOKE ALL ON FUNCTION public.is_active_business_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_business_member(uuid) TO authenticated, service_role;

-- Capacidade conferida no servidor mesmo quando o provisionador usa service_role.
-- A linha do negócio é bloqueada para serializar aceitações de convite concorrentes.
CREATE FUNCTION private.enforce_business_seats()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_owner uuid;
  v_limit integer := 1;
  v_existing integer;
BEGIN
  SELECT b.owner_user_id INTO v_owner
  FROM public.businesses b
  WHERE b.id = NEW.business_id FOR UPDATE;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Negócio inexistente';
  END IF;

  IF (NEW.role = 'owner' AND NEW.user_id <> v_owner)
     OR (NEW.role = 'professional' AND NEW.user_id = v_owner) THEN
    RAISE EXCEPTION 'Papel incompatível com o titular';
  END IF;
  IF NEW.role = 'owner' AND NEW.status <> 'active' THEN
    RAISE EXCEPTION 'O titular deve permanecer ativo';
  END IF;

  IF NEW.status = 'active' THEN
    SELECT e.seat_limit INTO v_limit
    FROM public.business_entitlements e
    WHERE e.business_id = NEW.business_id
      AND e.plan_key = 'premium'
      AND e.status IN ('active','trialing')
      AND (e.valid_until IS NULL OR e.valid_until > now());
    v_limit := COALESCE(v_limit, 1);

    SELECT count(*) INTO v_existing
    FROM public.business_members m
    WHERE m.business_id = NEW.business_id
      AND m.status = 'active'
      AND m.id IS DISTINCT FROM NEW.id;

    IF v_existing >= v_limit THEN
      RAISE EXCEPTION 'Limite de profissionais ativos do plano atingido';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.enforce_business_seats() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER enforce_business_seats_before_write
BEFORE INSERT OR UPDATE OF business_id, user_id, role, status ON public.business_members
FOR EACH ROW EXECUTE FUNCTION private.enforce_business_seats();

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_profiles ENABLE ROW LEVEL SECURITY;

-- Nenhuma destas tabelas aceita edição pelo navegador nesta fase.
REVOKE ALL ON public.businesses, public.business_entitlements, public.business_members,
  public.professional_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.businesses, public.business_entitlements, public.business_members,
  public.professional_profiles TO authenticated;
GRANT ALL ON public.businesses, public.business_entitlements, public.business_members,
  public.professional_profiles TO service_role;

CREATE POLICY "Business owner and entitled active member read business"
ON public.businesses FOR SELECT TO authenticated
USING (owner_user_id = auth.uid() OR public.is_active_business_member(id));

CREATE POLICY "Only business owner reads entitlement"
ON public.business_entitlements FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.businesses b
  WHERE b.id = business_id AND b.owner_user_id = auth.uid()
));

CREATE POLICY "Owner reads members, professional reads own membership"
ON public.business_members FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = business_id AND b.owner_user_id = auth.uid()
  )
);

CREATE POLICY "Owner reads team profiles, member reads own profile"
ON public.professional_profiles FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = business_id AND b.owner_user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.business_members m
    WHERE m.id = member_id AND m.user_id = auth.uid() AND m.status = 'active'
  )
);

COMMENT ON TABLE public.businesses IS 'Nova base isolada para evolução multiprofissional; registros legados ainda não migrados.';
COMMENT ON TABLE public.business_entitlements IS 'Direitos por instalação; escrita exclusiva por serviço de provisionamento verificado.';
COMMENT ON TABLE public.professional_profiles IS 'Perfis de profissionais; ainda não conectados a bookings/services.';
