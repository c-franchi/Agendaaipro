-- Adicionar campo para controlar se pagamento é obrigatório no agendamento
ALTER TABLE settings ADD COLUMN IF NOT EXISTS require_payment_on_booking boolean DEFAULT true;

COMMENT ON COLUMN settings.require_payment_on_booking IS 'Se true, o cliente deve pagar no ato do agendamento. Se false, pagamento presencial';