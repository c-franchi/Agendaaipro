
-- Tabela de perfil do barbeiro
CREATE TABLE public.barber_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  bio TEXT,
  years_experience INTEGER DEFAULT 0,
  avatar_url TEXT,
  gallery JSONB DEFAULT '[]'::jsonb,
  socials JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de serviços
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  duration_min INTEGER NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de regras de disponibilidade
CREATE TABLE public.availability_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  weekday INTEGER NOT NULL CHECK (weekday >= 0 AND weekday <= 6),
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  slot_min INTEGER DEFAULT 20,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de bloqueios (férias, folgas)
CREATE TABLE public.blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_datetime TIMESTAMPTZ NOT NULL,
  end_datetime TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de agendamentos
CREATE TYPE booking_status AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'CANCELED', 'COMPLETED');

CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_whatsapp TEXT NOT NULL,
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  status booking_status DEFAULT 'PENDING_PAYMENT',
  price NUMERIC(10,2) NOT NULL,
  token TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de configurações
CREATE TABLE public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_access_token TEXT,
  whatsapp_phone_id TEXT,
  whatsapp_business_number TEXT,
  pix_chave TEXT,
  pix_nome_recebedor TEXT,
  pix_cidade TEXT,
  cancel_policy_hours INTEGER DEFAULT 24,
  min_advance_hours INTEGER DEFAULT 2,
  max_days_ahead INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.barber_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Perfil do barbeiro: leitura pública, admin edita
CREATE POLICY "Public can view barber profile" ON public.barber_profile FOR SELECT USING (true);
CREATE POLICY "Admin can update barber profile" ON public.barber_profile FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin can insert barber profile" ON public.barber_profile FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Serviços: leitura pública, admin gerencia
CREATE POLICY "Public can view active services" ON public.services FOR SELECT USING (is_active = true);
CREATE POLICY "Admin can manage services" ON public.services FOR ALL USING (auth.uid() IS NOT NULL);

-- Regras de disponibilidade: leitura pública, admin gerencia
CREATE POLICY "Public can view availability rules" ON public.availability_rules FOR SELECT USING (is_active = true);
CREATE POLICY "Admin can manage availability" ON public.availability_rules FOR ALL USING (auth.uid() IS NOT NULL);

-- Bloqueios: leitura pública, admin gerencia
CREATE POLICY "Public can view blocks" ON public.blocks FOR SELECT USING (true);
CREATE POLICY "Admin can manage blocks" ON public.blocks FOR ALL USING (auth.uid() IS NOT NULL);

-- Agendamentos: clientes podem criar, admin gerencia tudo
CREATE POLICY "Anyone can create bookings" ON public.bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view their bookings with token" ON public.bookings FOR SELECT USING (true);
CREATE POLICY "Admin can manage all bookings" ON public.bookings FOR ALL USING (auth.uid() IS NOT NULL);

-- Configurações: apenas admin
CREATE POLICY "Admin can view settings" ON public.settings FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin can update settings" ON public.settings FOR ALL USING (auth.uid() IS NOT NULL);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_barber_profile_updated_at BEFORE UPDATE ON public.barber_profile
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed data inicial
INSERT INTO public.barber_profile (name, bio, years_experience, avatar_url, gallery, socials) VALUES (
  'Ricardo Silva',
  'Barbeiro profissional especializado em cortes clássicos e modernos. Atendimento personalizado com mais de 10 anos de experiência.',
  10,
  NULL,
  '[]'::jsonb,
  '{"instagram": "@barberricardo", "whatsapp": "5511999999999"}'::jsonb
);

INSERT INTO public.services (name, duration_min, price, description, is_active) VALUES
  ('Corte de Cabelo', 30, 50.00, 'Corte masculino tradicional ou moderno com finalização', true),
  ('Barba', 20, 35.00, 'Aparar e modelar barba com navalha', true),
  ('Combo Cabelo + Barba', 50, 80.00, 'Pacote completo: corte e barba com desconto', true);

INSERT INTO public.availability_rules (weekday, open_time, close_time, slot_min, is_active) VALUES
  (1, '09:00', '19:00', 20, true),
  (2, '09:00', '19:00', 20, true),
  (3, '09:00', '19:00', 20, true),
  (4, '09:00', '19:00', 20, true),
  (5, '09:00', '19:00', 20, true),
  (6, '09:00', '18:00', 20, true);

INSERT INTO public.blocks (start_datetime, end_datetime, reason) VALUES
  (CURRENT_DATE + INTERVAL '0 days', CURRENT_DATE + INTERVAL '1 day', 'Domingo - Fechado');

INSERT INTO public.settings (
  pix_chave,
  pix_nome_recebedor,
  pix_cidade,
  cancel_policy_hours,
  min_advance_hours,
  max_days_ahead
) VALUES (
  '11999999999',
  'Ricardo Silva',
  'Sao Paulo',
  24,
  2,
  30
);
