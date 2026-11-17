-- TESTE SOMENTE LEITURA: execute no banco de HOMOLOGAÇÃO depois de aplicar
-- migrations 20261117*. Não insere, altera nem exclui dados.
-- Este teste não substitui testes funcionais com JWT diferentes.
-- Exemplo: psql -v ON_ERROR_STOP=1 -f supabase/tests/premium_schema_smoke.sql

DO $test$
DECLARE
  required_table text;
  required_function text;
  rls_is_enabled boolean;
BEGIN
  FOREACH required_table IN ARRAY ARRAY[
    'businesses','business_entitlements','business_members','professional_profiles',
    'business_invites','products','stock_movements','sales','sale_items','expenses',
    'service_consumables','booking_material_usage','services','bookings',
    'availability_rules','blocks','portfolio_items','conversations','messages'
  ] LOOP
    SELECT c.relrowsecurity INTO rls_is_enabled
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname=required_table AND c.relkind IN ('r','p');
    IF rls_is_enabled IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'RLS faltando em public.%',required_table;
    END IF;
  END LOOP;

  FOREACH required_function IN ARRAY ARRAY[
    'public.initialize_business(text)',
    'public.invite_business_professional(text)',
    'public.accept_business_invitation(text,text,text)',
    'public.revoke_business_invitation(uuid)',
    'public.revoke_business_professional(uuid)',
    'public.my_professional_id()',
    'public.my_business_entitlement()',
    'public.create_booking_v2(uuid,uuid,text,text,date,time without time zone)',
    'public.get_booked_slots_v2(date,uuid)',
    'public.reschedule_booking_v2(uuid,uuid,date,time without time zone)',
    'public.professional_create_manual_booking(uuid,text,text,date,time without time zone)',
    'public.professional_update_booking_status(uuid,public.booking_status)',
    'public.save_professional_availability(jsonb)',
    'public.create_inventory_product(text,text,numeric,numeric,numeric)',
    'public.adjust_inventory(uuid,numeric,text)',
    'public.register_inventory_sale(jsonb,text)',
    'public.cancel_inventory_sale(uuid)',
    'public.record_business_expense(text,text,numeric)',
    'public.void_business_expense(uuid)',
    'public.set_service_consumable(uuid,uuid,numeric)',
    'public.start_professional_conversation(uuid)',
    'public.update_my_professional_profile(text,text)'
  ] LOOP
    IF to_regprocedure(required_function) IS NULL THEN
      RAISE EXCEPTION 'RPC ausente: %',required_function;
    END IF;
    IF has_function_privilege('anon',required_function,'EXECUTE') THEN
      RAISE EXCEPTION 'RPC sensível executável por anon: %',required_function;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON c.oid=t.tgrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='bookings'
      AND t.tgname='consume_on_completion' AND t.tgenabled <> 'D'
  ) THEN
    RAISE EXCEPTION 'Gatilho de baixa automática de insumos ausente';
  END IF;

  IF EXISTS(
    SELECT 1 FROM public.business_entitlements e
    WHERE e.seat_limit>1 AND e.plan_key<>'premium'
  ) THEN
    RAISE EXCEPTION 'Assentos adicionais concedidos fora do Premium';
  END IF;

  RAISE NOTICE 'Smoke SQL estrutural: PASS. Execute testes JWT, concorrência e estoque em homologação.';
END $test$;

-- Dado legados sem vínculo após inicialização indicam backfill incompleto.
SELECT
  'services' AS relation,
  count(*) FILTER (WHERE business_id IS NULL OR professional_id IS NULL) AS unscoped_records
FROM public.services
UNION ALL
SELECT 'bookings',count(*) FILTER (WHERE business_id IS NULL OR professional_id IS NULL)
FROM public.bookings
UNION ALL
SELECT 'conversations',count(*) FILTER (WHERE business_id IS NULL OR professional_id IS NULL)
FROM public.conversations;
