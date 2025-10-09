-- Adicionar coluna para armazenar configurações de horários por dia da semana
ALTER TABLE availability_rules DROP CONSTRAINT IF EXISTS availability_rules_weekday_key;

-- Criar tabela para notificações de agendamentos
CREATE TABLE IF NOT EXISTS booking_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE NOT NULL,
  notification_type TEXT NOT NULL, -- 'reminder_1h', 'reminder_24h', 'confirmation'
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE booking_notifications ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admin can manage notifications"
ON booking_notifications
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Public can view their notifications"
ON booking_notifications
FOR SELECT
USING (true);

-- Adicionar índices
CREATE INDEX idx_booking_notifications_booking ON booking_notifications(booking_id);
CREATE INDEX idx_booking_notifications_scheduled ON booking_notifications(scheduled_for);
