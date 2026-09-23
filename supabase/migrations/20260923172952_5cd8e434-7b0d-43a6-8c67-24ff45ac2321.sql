UPDATE public.barber_profile
SET years_experience = GREATEST(COALESCE(years_experience, 0), 25), updated_at = now();

INSERT INTO public.portfolio_items (title, category, image_url, alt_text, sort_order, is_active)
SELECT item.title, item.category, item.image_url, item.alt_text, item.sort_order, true
FROM (VALUES
  ('Corte masculino clássico', 'Masculino', '/images/corte2.webp', 'Corte masculino com topete e degradê lateral', 1),
  ('Corte texturizado', 'Masculino', '/images/corte3.webp', 'Corte masculino texturizado com barba alinhada', 2),
  ('Degradê moderno', 'Masculino', '/images/corte6.webp', 'Corte masculino moderno com degradê baixo', 3),
  ('Corte social', 'Masculino', '/images/corte7.webp', 'Corte social masculino com acabamento lateral', 4),
  ('Alisamento e finalização', 'Feminino', '/images/corte4.webp', 'Cabelo feminino longo, liso e finalizado', 5),
  ('Design de sobrancelhas', 'Feminino', '/images/corte5.webp', 'Resultado de design de sobrancelhas feminino', 6)
) AS item(title, category, image_url, alt_text, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.portfolio_items);