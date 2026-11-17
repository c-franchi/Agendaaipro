-- Gestão/Premium: estoque transacional, caixa e consumo por serviço.
-- Todas as escritas sensíveis serão feitas por RPC/trigger; tabelas autenticadas têm SELECT.
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  professional_id uuid NOT NULL REFERENCES public.professional_profiles(id),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 150),
  unit text NOT NULL DEFAULT 'un' CHECK (length(unit) BETWEEN 1 AND 16),
  sku text,
  sale_price numeric(12,2) NOT NULL DEFAULT 0 CHECK(sale_price>=0),
  unit_cost numeric(12,4) NOT NULL DEFAULT 0 CHECK(unit_cost>=0),
  stock_quantity numeric(12,3) NOT NULL DEFAULT 0 CHECK(stock_quantity>=0),
  min_stock numeric(12,3) NOT NULL DEFAULT 0 CHECK(min_stock>=0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,professional_id),
  FOREIGN KEY(professional_id,business_id) REFERENCES public.professional_profiles(id,business_id)
);
CREATE INDEX products_by_professional ON public.products(professional_id,name);

CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id),
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  professional_id uuid NOT NULL REFERENCES public.professional_profiles(id),
  quantity_delta numeric(12,3) NOT NULL CHECK(quantity_delta<>0),
  unit_cost_snapshot numeric(12,4) NOT NULL CHECK(unit_cost_snapshot>=0),
  reason text NOT NULL,
  source_type text NOT NULL CHECK(source_type IN ('manual','sale','sale_reversal','service')),
  source_id uuid,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(product_id,professional_id) REFERENCES public.products(id,professional_id)
);
CREATE UNIQUE INDEX unique_source_stock_movement ON public.stock_movements(product_id,source_type,source_id)
  WHERE source_id IS NOT NULL;
CREATE INDEX stock_movements_by_professional ON public.stock_movements(professional_id,created_at DESC);

CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  professional_id uuid NOT NULL REFERENCES public.professional_profiles(id),
  customer_name text,
  status text NOT NULL DEFAULT 'paid' CHECK(status IN ('paid','canceled')),
  total numeric(12,2) NOT NULL CHECK(total>=0),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  canceled_at timestamptz,
  FOREIGN KEY(professional_id,business_id) REFERENCES public.professional_profiles(id,business_id)
);
CREATE TABLE public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity numeric(12,3) NOT NULL CHECK(quantity>0),
  unit_sale_price numeric(12,2) NOT NULL CHECK(unit_sale_price>=0),
  unit_cost_snapshot numeric(12,4) NOT NULL CHECK(unit_cost_snapshot>=0),
  UNIQUE(sale_id,product_id)
);

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  professional_id uuid NOT NULL REFERENCES public.professional_profiles(id),
  category text NOT NULL CHECK(length(btrim(category)) BETWEEN 2 AND 100),
  description text,
  amount numeric(12,2) NOT NULL CHECK(amount>0),
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  voided_at timestamptz,
  FOREIGN KEY(professional_id,business_id) REFERENCES public.professional_profiles(id,business_id)
);

CREATE TABLE public.service_consumables (
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  professional_id uuid NOT NULL REFERENCES public.professional_profiles(id),
  quantity_per_service numeric(12,3) NOT NULL CHECK(quantity_per_service>0),
  PRIMARY KEY(service_id,product_id)
);
CREATE TABLE public.booking_material_usage (
  booking_id uuid NOT NULL REFERENCES public.bookings(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  professional_id uuid NOT NULL REFERENCES public.professional_profiles(id),
  quantity numeric(12,3) NOT NULL CHECK(quantity>0),
  unit_cost_snapshot numeric(12,4) NOT NULL CHECK(unit_cost_snapshot>=0),
  consumed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(booking_id,product_id)
);

CREATE FUNCTION public.has_business_feature(p_business_id uuid,p_feature text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
 SELECT EXISTS(SELECT 1 FROM public.business_entitlements e
 WHERE e.business_id=p_business_id
 AND e.status IN ('active','trialing')
 AND (e.valid_until IS NULL OR e.valid_until>now())
 AND ((p_feature='inventory' AND e.plan_key IN ('pro','premium'))
   OR (p_feature='consumables' AND e.plan_key='premium')));
$$;
REVOKE ALL ON FUNCTION public.has_business_feature(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.has_business_feature(uuid,text) TO authenticated;

CREATE FUNCTION public.can_read_professional_data(p_business_id uuid,p_professional_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
 SELECT auth.uid() IS NOT NULL AND
   (EXISTS(SELECT 1 FROM public.businesses b
     WHERE b.id=p_business_id AND b.owner_user_id=auth.uid())
    OR (p_professional_id=public.my_professional_id()
      AND EXISTS(SELECT 1 FROM public.professional_profiles p
        WHERE p.id=p_professional_id AND p.business_id=p_business_id)));
$$;
REVOKE ALL ON FUNCTION public.can_read_professional_data(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_read_professional_data(uuid,uuid) TO authenticated;

DO $$
DECLARE t text;
BEGIN
 FOR t IN SELECT unnest(ARRAY['products','stock_movements','sales','sale_items','expenses','service_consumables','booking_material_usage']) LOOP
   EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
   EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
   EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
   EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;
END $$;
CREATE POLICY "View own or consolidated inventory" ON public.products FOR SELECT TO authenticated
USING (public.can_read_professional_data(business_id,professional_id));
CREATE POLICY "View own or consolidated stock ledger" ON public.stock_movements FOR SELECT TO authenticated
USING (public.can_read_professional_data(business_id,professional_id));
CREATE POLICY "View own or consolidated sales" ON public.sales FOR SELECT TO authenticated
USING (public.can_read_professional_data(business_id,professional_id));
CREATE POLICY "View sale items for authorized sale" ON public.sale_items FOR SELECT TO authenticated
USING (EXISTS(SELECT 1 FROM public.sales s WHERE s.id=sale_id
  AND public.can_read_professional_data(s.business_id,s.professional_id)));
CREATE POLICY "View own or consolidated expenses" ON public.expenses FOR SELECT TO authenticated
USING (public.can_read_professional_data(business_id,professional_id));
CREATE POLICY "View own or consolidated service recipe" ON public.service_consumables FOR SELECT TO authenticated
USING (public.can_read_professional_data(business_id,professional_id));
CREATE POLICY "View own or consolidated material costs" ON public.booking_material_usage FOR SELECT TO authenticated
USING (public.can_read_professional_data(business_id,professional_id));

-- Imutabilidade dos movimentos e dos custos históricos: não há UPDATE/DELETE para cliente.
-- Apenas RPCs de negócio e service_role podem escrever.
