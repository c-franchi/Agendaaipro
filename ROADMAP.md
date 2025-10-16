# 🚀 Roadmap - Barber-On: Plataforma Completa de Gerenciamento

## 📋 Status Atual
- ✅ PWA instalável
- ✅ Sistema de agendamento com bloqueios intercalados
- ✅ Painel administrativo básico
- ✅ Geração de PIX QR Code
- ✅ Autenticação de administrador

---

## 🎯 Fase 1: Chat Interno e Comunicação em Tempo Real

### Objetivo
Substituir WhatsApp por chat interno integrado com notificações push.

### Funcionalidades
- [ ] **Chat em tempo real (WebSocket via Supabase Realtime)**
  - Mensagens de texto
  - Envio de imagens
  - Status de mensagem (enviado/entregue/lido)
  - Indicador de "digitando..."
  
- [ ] **Sistema de Notificações**
  - Push notifications via PWA
  - Notificações automáticas:
    - "✅ Agendamento confirmado"
    - "⏰ Lembrete: seu horário é em 1 hora"
    - "💰 Pagamento recebido"
  
- [ ] **Histórico de Conversas**
  - Listagem de chats por cliente
  - Busca em conversas
  - Arquivar conversas antigas

### Stack Técnica
```
- Frontend: React + Supabase Realtime
- Backend: Supabase Database (tabela: messages, conversations)
- Notificações: Service Worker + Push API
- Storage: Supabase Storage (para imagens)
```

### Banco de Dados
```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  customer_name TEXT,
  customer_whatsapp TEXT,
  last_message_at TIMESTAMP,
  unread_count INTEGER
);

CREATE TABLE messages (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id),
  sender_type TEXT, -- 'admin' ou 'customer'
  content TEXT,
  image_url TEXT,
  status TEXT, -- 'sent', 'delivered', 'read'
  created_at TIMESTAMP
);
```

---

## 🎯 Fase 2: Agendamento Inteligente

### Objetivo
Melhorar o sistema de agendamento com visualização de calendário e sincronizações.

### Funcionalidades
- [ ] **Visualização de Calendário**
  - Vista diária, semanal e mensal
  - Drag & drop para reagendar
  - Cores por tipo de serviço
  
- [ ] **Automações**
  - Bloqueio automático de horários ocupados
  - Sincronização com Google Calendar (opcional)
  - Lembretes automáticos (1h antes, 1 dia antes)
  - Confirmação automática via chat
  
- [ ] **Gestão de Conflitos**
  - Alertas de sobreposição
  - Sugestão de horários alternativos
  - Fila de espera para cancelamentos

### Stack Técnica
```
- Biblioteca: react-big-calendar ou FullCalendar
- Sync: Google Calendar API (opcional)
- Automações: Supabase Edge Functions + Cron Jobs
```

---

## 🎯 Fase 3: Pagamentos Integrados

### Objetivo
Integrar geração e verificação de pagamentos PIX diretamente no chat.

### Funcionalidades
- [ ] **Integração PIX**
  - Geração de QR Code dinâmico via gateway (Gerencianet/MercadoPago)
  - Webhook para confirmar pagamento automaticamente
  - Envio de QR Code direto no chat
  
- [ ] **Gestão Financeira**
  - Status de pagamento por agendamento
  - Relatório de receitas
  - Histórico de transações
  - Exportação de relatórios (PDF/Excel)

### Stack Técnica
```
- Gateway: Gerencianet API ou MercadoPago
- Webhook: Supabase Edge Function
- QR Code: biblioteca qrcode (já instalada)
```

### Fluxo
```
1. Cliente agenda → Sistema gera PIX
2. QR Code enviado no chat
3. Cliente paga
4. Webhook atualiza status → Notificação automática
5. Agendamento confirmado
```

---

## 🎯 Fase 4: Painel Administrativo Avançado

### Objetivo
Dashboard completo com métricas e insights.

### Funcionalidades
- [ ] **Dashboard**
  - Agendamentos do dia/semana
  - Receita diária/mensal
  - Taxa de ocupação
  - Serviços mais vendidos
  - Clientes frequentes
  
- [ ] **Gestão de Clientes**
  - Histórico completo de atendimentos
  - Notas sobre o cliente
  - Preferências de serviço
  - Aniversários (para campanhas)
  
- [ ] **Relatórios**
  - Horários de pico
  - Análise de receita
  - Taxa de cancelamento
  - Serviços mais rentáveis

### Stack Técnica
```
- Gráficos: recharts (já instalada)
- Exportação: jsPDF + xlsx
- Análise: Queries SQL customizadas
```

---

## 🎯 Fase 5: Sistema de Fidelidade e Expansão

### Objetivo
Aumentar retenção de clientes e preparar para múltiplos profissionais.

### Funcionalidades
- [ ] **Programa de Fidelidade**
  - Pontos por agendamento
  - Recompensas automáticas
  - Cupons de desconto
  
- [ ] **Automações Inteligentes**
  - Sugestão de retorno (ex: "Faz 30 dias do seu último corte!")
  - Campanhas de aniversário
  - Notificações personalizadas
  
- [ ] **Multi-profissionais**
  - Cadastro de múltiplos barbeiros
  - Agendamento por profissional
  - Comissões e relatórios individuais

---

## 🔐 Requisitos de Segurança

- ✅ Autenticação JWT (já implementado)
- [ ] Criptografia de mensagens sensíveis (E2E)
- [ ] Logs de auditoria
- [ ] LGPD compliance (política de privacidade)
- [ ] Backup automático de dados

---

## 📊 Métricas de Sucesso

- Taxa de adoção do chat interno
- Redução no tempo de confirmação de agendamentos
- Aumento na taxa de pagamentos confirmados
- Redução na taxa de no-show
- Crescimento de clientes recorrentes

---

## 🛠️ Próximos Passos Imediatos

1. ✅ Melhorar UI dos bloqueios intercalados
2. [ ] Implementar tabelas do chat no banco
3. [ ] Criar componente de chat com Supabase Realtime
4. [ ] Implementar notificações push
5. [ ] Integrar gateway de pagamento PIX

---

**Observação**: Este roadmap é flexível e pode ser ajustado conforme feedback dos usuários e necessidades do negócio.
