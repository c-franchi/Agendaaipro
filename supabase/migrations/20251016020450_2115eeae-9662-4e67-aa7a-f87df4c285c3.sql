-- Fase 1: Chat Interno
-- Tabela de conversas
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  customer_whatsapp TEXT NOT NULL,
  customer_email TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  unread_count INTEGER DEFAULT 0,
  archived BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de mensagens
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('admin', 'customer')),
  content TEXT NOT NULL,
  image_url TEXT,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela para notificações de agendamento
CREATE TABLE public.scheduled_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('reminder_1h', 'reminder_1d', 'confirmation', 'payment_received')),
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies para conversations
CREATE POLICY "Admin can view all conversations"
ON public.conversations FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can insert conversations"
ON public.conversations FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can update conversations"
ON public.conversations FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Customers can view their conversation by whatsapp"
ON public.conversations FOR SELECT
USING (true);

-- RLS Policies para messages
CREATE POLICY "Admin can view all messages"
ON public.messages FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can insert messages"
ON public.messages FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Customers can view their messages"
ON public.messages FOR SELECT
USING (true);

CREATE POLICY "Customers can send messages"
ON public.messages FOR INSERT
WITH CHECK (sender_type = 'customer');

-- RLS Policies para scheduled_notifications
CREATE POLICY "Admin can manage notifications"
ON public.scheduled_notifications FOR ALL
USING (auth.uid() IS NOT NULL);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_conversations_updated_at
BEFORE UPDATE ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para atualizar last_message_at quando nova mensagem
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at,
      unread_count = CASE 
        WHEN NEW.sender_type = 'customer' THEN unread_count + 1
        ELSE unread_count
      END
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_new_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_last_message();

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;