-- Comprovantes de clientes ficam privados; o profissional vê somente os de seus agendamentos.
CREATE POLICY "Professional views receipts for own appointments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'payment-receipts'
  AND EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.receipt_url = storage.objects.name
      AND b.professional_id = public.my_professional_id()
  )
);
-- Clientes continuam vendo somente os arquivos enviados em suas próprias pastas.
