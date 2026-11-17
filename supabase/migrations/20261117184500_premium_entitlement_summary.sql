-- Leitura segura de benefícios do plano pela própria conta, sem expor source_ref.
CREATE FUNCTION public.my_business_entitlement()
RETURNS TABLE(plan_key text,status text,seat_limit integer,valid_until timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
 SELECT e.plan_key,e.status,e.seat_limit,e.valid_until
 FROM public.business_members m
 JOIN public.business_entitlements e ON e.business_id=m.business_id
 WHERE m.user_id=auth.uid() AND m.status='active'
 LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.my_business_entitlement() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.my_business_entitlement() TO authenticated;
