-- Adicionar campo para permitir pagamento presencial por serviço
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS allow_in_person_payment boolean DEFAULT false;

-- Criar bucket para comprovantes de pagamento
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-receipts', 'payment-receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Adicionar campo para comprovante de pagamento nos bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS receipt_url text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS payment_method text;

-- Políticas de storage para comprovantes
CREATE POLICY "Authenticated users can upload receipts"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'payment-receipts' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view receipts"
ON storage.objects FOR SELECT
USING (bucket_id = 'payment-receipts' AND auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete receipts"
ON storage.objects FOR DELETE
USING (bucket_id = 'payment-receipts' AND auth.uid() IS NOT NULL);