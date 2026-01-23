# ✂️ AgendAÍ Pro

Sistema completo de gerenciamento para barbearias com agendamento online, pagamentos PIX e comunicação integrada.

## 🚀 Funcionalidades

### Para Clientes
- 📱 **PWA Instalável** - Funciona como app nativo no celular
- 📅 **Agendamento Online** - Escolha serviço, data e horário disponível
- 💳 **Pagamento PIX** - QR Code para pagamento antecipado ou presencial
- 💬 **Chat Integrado** - Comunicação direta com o profissional
- 🔔 **Notificações** - Lembretes de agendamentos
- 📋 **Histórico** - Visualize e gerencie seus agendamentos

### Para Administradores
- 📊 **Dashboard** - Visão geral do negócio
- 📆 **Agenda Completa** - Gerencie todos os agendamentos
- 💰 **Gestão Financeira** - Controle de receitas e pagamentos
- ✂️ **Serviços** - CRUD completo com preços e duração
- 👥 **Clientes** - Base de dados com histórico
- ⚙️ **Configurações** - Horários, PIX, políticas de cancelamento

## 🛠️ Tecnologias

- **Frontend:** React 18 + TypeScript
- **Build:** Vite
- **Estilização:** Tailwind CSS + shadcn/ui
- **Backend:** Cloud Database com autenticação JWT
- **Realtime:** WebSockets para chat em tempo real
- **PWA:** Service Worker para instalação e cache

## 📦 Instalação Local

```bash
# Clone o repositório
git clone <seu-repositorio>

# Acesse a pasta
cd agendaaipro

# Instale as dependências
npm install

# Inicie o servidor de desenvolvimento
npm run dev
```

## 🏗️ Build para Produção

```bash
npm run build
```

## 📱 PWA

O app é totalmente instalável em dispositivos móveis:
1. Acesse o site pelo navegador
2. Clique em "Adicionar à tela inicial"
3. Use como um app nativo

## 🔐 Segurança

- Autenticação JWT
- Row Level Security (RLS) no banco de dados
- Proteção de rotas administrativas
- Criptografia de dados sensíveis

## 📄 Licença

Proprietário - Todos os direitos reservados.

---

**AgendAÍ Pro** - Seu estilo começa aqui! 💈
