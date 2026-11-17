-- Portfólio próprio do segundo profissional, sem permitir edição de imagens de colegas.
CREATE POLICY "Professional reads own unpublished portfolio"
ON public.portfolio_items FOR SELECT TO authenticated
USING(professional_id=public.my_professional_id());
CREATE POLICY "Professional inserts own portfolio"
ON public.portfolio_items FOR INSERT TO authenticated
WITH CHECK(professional_id=public.my_professional_id());
CREATE POLICY "Professional updates own portfolio"
ON public.portfolio_items FOR UPDATE TO authenticated
USING(professional_id=public.my_professional_id())
WITH CHECK(professional_id=public.my_professional_id());
CREATE POLICY "Professional deletes own portfolio"
ON public.portfolio_items FOR DELETE TO authenticated
USING(professional_id=public.my_professional_id());

-- Cada arquivo do profissional usa o prefixo exclusivo <professional-uuid>/.
-- Arquivos criados pelo titular permanecem nos caminhos anteriores.
CREATE POLICY "Professional uploads own portfolio files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK(bucket_id='portfolio' AND (storage.foldername(name))[1]=public.my_professional_id()::text);
CREATE POLICY "Professional updates own portfolio files"
ON storage.objects FOR UPDATE TO authenticated
USING(bucket_id='portfolio' AND (storage.foldername(name))[1]=public.my_professional_id()::text)
WITH CHECK(bucket_id='portfolio' AND (storage.foldername(name))[1]=public.my_professional_id()::text);
CREATE POLICY "Professional deletes own portfolio files"
ON storage.objects FOR DELETE TO authenticated
USING(bucket_id='portfolio' AND (storage.foldername(name))[1]=public.my_professional_id()::text);
