-- Operações de estoque e caixa transacionais, autorizadas pelo plano no banco.
CREATE FUNCTION private.assert_inventory_actor(p_professional_id uuid,p_feature text DEFAULT 'inventory')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_business uuid;
BEGIN
  IF auth.uid() IS NULL OR p_professional_id IS DISTINCT FROM public.my_professional_id() THEN
    RAISE EXCEPTION 'Profissional não autorizado';
  END IF;
  SELECT business_id INTO v_business FROM public.professional_profiles
  WHERE id=p_professional_id AND is_active;
  IF v_business IS NULL OR NOT public.has_business_feature(v_business,p_feature) THEN
    RAISE EXCEPTION 'Módulo indisponível para o plano ativo';
  END IF;
  RETURN v_business;
END;$$;
REVOKE ALL ON FUNCTION private.assert_inventory_actor(uuid,text) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.create_inventory_product(
  p_name text,p_unit text,p_sale_price numeric,p_unit_cost numeric,p_min_stock numeric
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_prof uuid; v_business uuid; v_id uuid;
BEGIN
  v_prof:=public.my_professional_id();
  v_business:=private.assert_inventory_actor(v_prof,'inventory');
  IF length(btrim(coalesce(p_name,''))) NOT BETWEEN 2 AND 150
    OR length(btrim(coalesce(p_unit,''))) NOT BETWEEN 1 AND 16
    OR p_sale_price IS NULL OR p_sale_price<0 OR p_unit_cost IS NULL OR p_unit_cost<0
    OR p_min_stock IS NULL OR p_min_stock<0 THEN RAISE EXCEPTION 'Dados de produto inválidos'; END IF;
  INSERT INTO public.products(business_id,professional_id,name,unit,sale_price,unit_cost,min_stock)
  VALUES(v_business,v_prof,btrim(p_name),btrim(p_unit),p_sale_price,p_unit_cost,p_min_stock)
  RETURNING id INTO v_id;
  RETURN v_id;
END;$$;

CREATE FUNCTION public.update_inventory_product(
  p_product_id uuid,p_name text,p_sale_price numeric,p_unit_cost numeric,p_min_stock numeric,p_active boolean
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_product public.products%rowtype;
BEGIN
  SELECT * INTO v_product FROM public.products WHERE id=p_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;
  PERFORM private.assert_inventory_actor(v_product.professional_id,'inventory');
  IF length(btrim(coalesce(p_name,''))) NOT BETWEEN 2 AND 150
    OR p_sale_price IS NULL OR p_sale_price<0 OR p_unit_cost IS NULL OR p_unit_cost<0
    OR p_min_stock IS NULL OR p_min_stock<0 THEN RAISE EXCEPTION 'Dados inválidos'; END IF;
  UPDATE public.products SET name=btrim(p_name),sale_price=p_sale_price,
    unit_cost=p_unit_cost,min_stock=p_min_stock,is_active=p_active
  WHERE id=p_product_id;
  RETURN true;
END;$$;

CREATE FUNCTION public.adjust_inventory(
 p_product_id uuid,p_quantity_delta numeric,p_reason text
) RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_product public.products%rowtype; v_next numeric;
BEGIN
  IF p_quantity_delta IS NULL OR p_quantity_delta=0 OR abs(p_quantity_delta)>100000
    OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 3 AND 300 THEN
    RAISE EXCEPTION 'Movimentação inválida'; END IF;
  SELECT * INTO v_product FROM public.products WHERE id=p_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;
  PERFORM private.assert_inventory_actor(v_product.professional_id,'inventory');
  v_next:=v_product.stock_quantity+p_quantity_delta;
  IF v_next<0 THEN RAISE EXCEPTION 'Estoque insuficiente'; END IF;
  UPDATE public.products SET stock_quantity=v_next WHERE id=p_product_id;
  INSERT INTO public.stock_movements(product_id,business_id,professional_id,quantity_delta,
    unit_cost_snapshot,reason,source_type,created_by)
  VALUES(v_product.id,v_product.business_id,v_product.professional_id,p_quantity_delta,
    v_product.unit_cost,btrim(p_reason),'manual',auth.uid());
  RETURN v_next;
END;$$;

CREATE FUNCTION public.register_inventory_sale(p_items jsonb,p_customer_name text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_prof uuid; v_business uuid; v_sale uuid; v_total numeric:=0;
  v_item jsonb; v_product public.products%rowtype; v_id uuid; v_qty numeric;
  v_seen uuid[]:=ARRAY[]::uuid[];
BEGIN
  v_prof:=public.my_professional_id();
  v_business:=private.assert_inventory_actor(v_prof,'inventory');
  IF jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items)<1
    OR jsonb_array_length(p_items)>50 THEN RAISE EXCEPTION 'Informe até 50 produtos'; END IF;
  INSERT INTO public.sales(business_id,professional_id,customer_name,total,created_by)
  VALUES(v_business,v_prof,nullif(btrim(coalesce(p_customer_name,'')),''),0,auth.uid())
  RETURNING id INTO v_sale;
  -- Ordem por product_id previne deadlocks durante vendas simultâneas.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
    ORDER BY (value->>'product_id') LOOP
    v_id:=(v_item->>'product_id')::uuid;
    v_qty:=(v_item->>'quantity')::numeric;
    IF v_id=ANY(v_seen) OR v_qty IS NULL OR v_qty<=0 OR v_qty>100000 THEN
      RAISE EXCEPTION 'Item duplicado ou quantidade inválida'; END IF;
    v_seen:=array_append(v_seen,v_id);
    SELECT * INTO v_product FROM public.products
      WHERE id=v_id AND professional_id=v_prof AND business_id=v_business AND is_active FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto não disponível para este profissional'; END IF;
    IF v_product.stock_quantity<v_qty THEN
      RAISE EXCEPTION 'Estoque insuficiente de %',v_product.name; END IF;
    UPDATE public.products SET stock_quantity=stock_quantity-v_qty WHERE id=v_id;
    INSERT INTO public.sale_items(sale_id,product_id,quantity,unit_sale_price,unit_cost_snapshot)
    VALUES(v_sale,v_id,v_qty,v_product.sale_price,v_product.unit_cost);
    INSERT INTO public.stock_movements(product_id,business_id,professional_id,
      quantity_delta,unit_cost_snapshot,reason,source_type,source_id,created_by)
    VALUES(v_id,v_business,v_prof,-v_qty,v_product.unit_cost,'Venda registrada','sale',v_sale,auth.uid());
    v_total:=v_total+(v_product.sale_price*v_qty);
  END LOOP;
  UPDATE public.sales SET total=round(v_total,2) WHERE id=v_sale;
  RETURN v_sale;
END;$$;

CREATE FUNCTION public.cancel_inventory_sale(p_sale_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_sale public.sales%rowtype; v_item record;
BEGIN
  SELECT * INTO v_sale FROM public.sales WHERE id=p_sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Venda não encontrada'; END IF;
  PERFORM private.assert_inventory_actor(v_sale.professional_id,'inventory');
  IF v_sale.status='canceled' THEN RETURN true; END IF;
  FOR v_item IN SELECT si.product_id,si.quantity,si.unit_cost_snapshot
    FROM public.sale_items si WHERE si.sale_id=v_sale.id ORDER BY si.product_id FOR UPDATE LOOP
    PERFORM 1 FROM public.products WHERE id=v_item.product_id FOR UPDATE;
    UPDATE public.products SET stock_quantity=stock_quantity+v_item.quantity WHERE id=v_item.product_id;
    INSERT INTO public.stock_movements(product_id,business_id,professional_id,
      quantity_delta,unit_cost_snapshot,reason,source_type,source_id,created_by)
    VALUES(v_item.product_id,v_sale.business_id,v_sale.professional_id,
      v_item.quantity,v_item.unit_cost_snapshot,'Venda cancelada','sale_reversal',v_sale.id,auth.uid());
  END LOOP;
  UPDATE public.sales SET status='canceled',canceled_at=now() WHERE id=v_sale.id;
  RETURN true;
END;$$;

CREATE FUNCTION public.record_business_expense(p_category text,p_description text,p_amount numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_prof uuid; v_business uuid; v_id uuid;
BEGIN
  v_prof:=public.my_professional_id();
  v_business:=private.assert_inventory_actor(v_prof,'inventory');
  IF length(btrim(coalesce(p_category,''))) NOT BETWEEN 2 AND 100
    OR p_amount IS NULL OR p_amount<=0 THEN RAISE EXCEPTION 'Despesa inválida'; END IF;
  INSERT INTO public.expenses(business_id,professional_id,category,description,amount,created_by)
  VALUES(v_business,v_prof,btrim(p_category),nullif(btrim(coalesce(p_description,'')),''),p_amount,auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;$$;

CREATE FUNCTION public.void_business_expense(p_expense_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_expense public.expenses%rowtype;
BEGIN
  SELECT * INTO v_expense FROM public.expenses WHERE id=p_expense_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Despesa não encontrada'; END IF;
  PERFORM private.assert_inventory_actor(v_expense.professional_id,'inventory');
  IF v_expense.voided_at IS NULL THEN
    UPDATE public.expenses SET voided_at=now() WHERE id=p_expense_id; END IF;
  RETURN true;
END;$$;

CREATE FUNCTION public.set_service_consumable(
  p_service_id uuid,p_product_id uuid,p_quantity numeric
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_service public.services%rowtype; v_product public.products%rowtype;
BEGIN
  SELECT * INTO v_service FROM public.services WHERE id=p_service_id;
  SELECT * INTO v_product FROM public.products WHERE id=p_product_id;
  IF v_service.id IS NULL OR v_product.id IS NULL
    OR v_service.professional_id<>v_product.professional_id
    OR v_service.business_id<>v_product.business_id THEN
    RAISE EXCEPTION 'Insumo e serviço devem ser do mesmo profissional'; END IF;
  PERFORM private.assert_inventory_actor(v_service.professional_id,'consumables');
  IF p_quantity IS NULL OR p_quantity<0 OR p_quantity>100000 THEN
    RAISE EXCEPTION 'Quantidade inválida'; END IF;
  IF p_quantity=0 THEN
    DELETE FROM public.service_consumables WHERE service_id=p_service_id AND product_id=p_product_id;
  ELSE
    INSERT INTO public.service_consumables(service_id,product_id,business_id,professional_id,quantity_per_service)
    VALUES(p_service_id,p_product_id,v_service.business_id,v_service.professional_id,p_quantity)
    ON CONFLICT(service_id,product_id) DO UPDATE SET quantity_per_service=excluded.quantity_per_service;
  END IF;
  RETURN true;
END;$$;

-- Dispara em qualquer conclusão autorizada, seja pelo titular ou pelo profissional.
-- Transação da reserva falha por inteiro se faltar material.
CREATE FUNCTION private.consume_materials_on_completed_booking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_material record; v_product public.products%rowtype;
BEGIN
  IF NEW.status<>'COMPLETED' OR OLD.status='COMPLETED' OR NEW.professional_id IS NULL THEN
    RETURN NEW;
  END IF;
  FOR v_material IN
    SELECT sc.product_id,sc.quantity_per_service
    FROM public.service_consumables sc
    WHERE sc.service_id=NEW.service_id AND sc.professional_id=NEW.professional_id
    ORDER BY sc.product_id
  LOOP
    SELECT * INTO v_product FROM public.products
      WHERE id=v_material.product_id AND professional_id=NEW.professional_id FOR UPDATE;
    IF NOT FOUND OR v_product.stock_quantity<v_material.quantity_per_service THEN
      RAISE EXCEPTION 'Insumo insuficiente para concluir atendimento';
    END IF;
    INSERT INTO public.booking_material_usage(
      booking_id,product_id,business_id,professional_id,quantity,unit_cost_snapshot)
    VALUES(NEW.id,v_product.id,v_product.business_id,v_product.professional_id,
      v_material.quantity_per_service,v_product.unit_cost)
    ON CONFLICT DO NOTHING;
    IF NOT FOUND THEN CONTINUE; END IF;
    UPDATE public.products SET stock_quantity=stock_quantity-v_material.quantity_per_service
      WHERE id=v_product.id;
    INSERT INTO public.stock_movements(product_id,business_id,professional_id,
      quantity_delta,unit_cost_snapshot,reason,source_type,source_id,created_by)
    VALUES(v_product.id,v_product.business_id,v_product.professional_id,
      -v_material.quantity_per_service,v_product.unit_cost,'Insumos consumidos no atendimento',
      'service',NEW.id,auth.uid());
  END LOOP;
  RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION private.consume_materials_on_completed_booking() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER consume_on_completion AFTER UPDATE OF status ON public.bookings
FOR EACH ROW WHEN (NEW.status='COMPLETED' AND OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION private.consume_materials_on_completed_booking();

-- Todas as funções públicas requerem JWT autenticado; cada uma revalida vínculo e plano.
DO $$
DECLARE f record;
BEGIN
  FOR f IN SELECT p.oid::regprocedure AS signature
           FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
           WHERE n.nspname='public' AND p.proname IN (
             'create_inventory_product','update_inventory_product','adjust_inventory',
             'register_inventory_sale','cancel_inventory_sale','record_business_expense',
             'void_business_expense','set_service_consumable'
           )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.signature);
  END LOOP;
END $$;
