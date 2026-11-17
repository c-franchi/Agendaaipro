# Premium multiprofissional — arquitetura e critérios de implementação

> Primeira entrega técnica nesta branch: `supabase/migrations/20261117150000_premium_business_team_foundation.sql` cria tabelas isoladas de negócio, direitos de assinatura, membros e perfis profissionais, RLS de leitura e trava de assentos no banco. **Não faz backfill, não libera convites, não altera agendamentos e não foi aplicada no banco de produção.** Executar testes SQL/RLS antes de merge.

Status: **proposta técnica / implementação pendente**. Este documento não habilita funcionalidades no sistema publicado. Base analisada: `main` em 17/11/2026.

## Contexto verificado

- O aplicativo de atendimento deste repositório foi construído para uma instalação com um administrador global (`user_roles.role = admin`). `ProtectedRoute`, `AdminLayout` e `Admin.tsx` conferem somente esse papel.
- Serviços, bloqueios, regras de disponibilidade, agendamentos e configurações não têm escopo de profissional. `Agendar.tsx` lê `get_booked_slots(date)`, e a função `create_booking(service_id,...)` verifica conflito na agenda única.
- O financeiro atual (`src/pages/admin/Financeiro.tsx`) calcula totais a partir de `bookings`; não é um livro-caixa completo.
- O repositório comercial é `c-franchi/agendaaipro-4cd26344`, separado do sistema-base. Em `docs/oferta-comercial.md`, módulos de produtos, estoque, vendas, fluxo de caixa e insumos constam como em preparação. O contrato/textos atuais mencionam **uma agenda por instalação**; não anunciar dois profissionais antes da entrega e atualização contratual.
- Nunca usar `admin` para o segundo profissional: as atuais políticas RLS de administrador dão acesso amplo à instalação.

## Objetivo do produto proposto

**Plano Premium: até dois profissionais ativos no mesmo negócio (titular + um adicional), com uma assinatura, um site, dois logins, duas agendas e gestão operacional individual.** A visão de gestão consolidada é exclusiva do titular. A inclusão do segundo profissional não inicia segunda assinatura e não compartilha credenciais.

Exemplo: cabeleireiro com manicure. Cada um configura serviços, preços, duração, horários, bloqueios, clientes vinculados aos seus atendimentos, mensagens, produtos/insumos, vendas e relatórios financeiros. Um cliente escolhe serviço e profissional antes do horário. Os dois podem atender às 14h sem conflito, enquanto um único profissional não pode ocupar dois horários sobrepostos.

**Escopo inicial:** 2 assentos no Premium, incluindo titular. Não presumir ilimitado nem cobrança por profissional adicional. Capacidade e vigência devem vir de concessão verificada no servidor; não de parâmetro de URL, localStorage, flag no frontend ou e-mail fornecido pelo cliente.

## Modelo proposto (migrar gradualmente, sem apagar registros)

1. `businesses(id, owner_user_id, name, ...)`: uma identidade de negócio por instalação; `owner_user_id` não pode ser modificado por membros.
2. `business_members(id, business_id, user_id, role [owner|professional], status [invited|active|revoked], ...)`: índice único para impedir duplicidade de identidade ativa. **Não reutilizar `user_roles.admin`** para membros.
3. `professional_profiles(id, business_id, member_id, display_name, specialty, is_active, ...)`: cada assento ativo tem um perfil de agenda. Garantir FK/constraints que previnam referências cruzadas entre negócios.
4. `business_entitlements(business_id, plan, seat_limit, status, valid_until, source_ref, ...)`: tabela ou consulta backend somente de leitura por usuários; gravação apenas por serviço de provisionamento confiável após validação do pedido/assinatura. Não expor segredo da Stripe.
5. Evoluir `services`, `availability_rules`, `blocks`, `bookings`, `conversations`, `messages`, `portfolio_items` e operações financeiras com `business_id` e `professional_id` onde necessário; realizar backfill para o profissional titular. Primeiro colunas opcionais + backfill, depois constraints `NOT NULL` após validação. Preservar `user_id` dos clientes.
6. Premium: `products`, `stock_movements` (razão imutável por entrada/saída/ajuste), `sales`, `sale_items`, `expenses`, `service_consumables`, `service_consumption_events` / lançamentos de custo. Todos com escopo de negócio e profissional, FK composta adequada e trilha de auditoria.
7. Não duplicar fichas de clientes desnecessariamente: informações pessoais visíveis ao profissional somente quando houver relação legítima com o atendimento; titular obtém visão consolidada autorizada.

## Permissões obrigatórias (no banco, nunca só na interface)

| Ação | Titular | Profissional adicional | Cliente |
| --- | --- | --- | --- |
| Configurar assinatura, convites e membros | Sim | Não | Não |
| Consultar painel consolidado | Sim | Não | Não |
| Gerenciar agenda/serviços/horários próprios | Sim | Sim | Não |
| Ler agenda/financeiro do outro | Sim | Não | Não |
| Ajustar estoque/insumos/caixa próprios | Sim | Sim | Não |
| Agendar e consultar atendimento próprio | Conforme vínculo | Conforme vínculo | Sim, apenas o próprio |
| Alterar permissões/assentos | Sim, respeitando limite | Não | Não |

- Políticas RLS de SELECT/INSERT/UPDATE/DELETE precisam verificar `business_id`, vínculo ativo do membro e `professional_id` do usuário autenticado. Um filtro React `.eq('professional_id', ...)` é UX, **não** proteção.
- Funções `SECURITY DEFINER` devem ter `search_path` fixo, revogação de `PUBLIC`, validação interna de autenticação/papel/escopo e autorização por recurso. Rever todas as RPC administrativas existentes (`admin_update_booking_status`, `admin_reject_booking_receipt`, `save_availability_rules`, etc.) antes de liberar o perfil profissional.
- Convite por e-mail: criado apenas pelo titular, token aleatório de uso único com hash, validade curta, aceite pela conta autenticada que confirmou o e-mail correspondente, revogação e auditoria; sem inserção direta de `user_roles` pelo navegador.
- Remover membro não apaga histórico nem agendamentos. Definir redistribuição de horários futuros e bloqueio de login antes de efetivar.
- Armazenamento, comprovantes, imagens e chat também precisam de escopo e de regras RLS de Storage.

## Agendamento v2 (concomitância real)

Fluxo: serviço → profissional elegível (ou profissional primeiro) → data → horários daquela agenda → confirmação. `get_booked_slots_v2(date, professional_id)` e `create_booking_v2(service_id, professional_id, ...)` devem aplicar elegibilidade e conflito no **servidor**.

O limite de conflito é `(professional_id, intervalo efetivamente ocupado)`; permitir mesma hora em agendas diferentes. A transação deve impedir corrida entre dois agendamentos simultâneos (serialização/advisory lock por profissional e data ou constraint apropriada), inclusive para blocos intercalados. O serviço precisa pertencer ao profissional escolhido. Horários de funcionamento da empresa podem coexistir com a disponibilidade individual. Preservar assinaturas v1 durante a migração até atualizar todos os consumidores.

## Gestão Premium

**Gestão:** produtos, custo e preço, estoque mínimo, entradas, saídas, perdas, vendas, recebimentos, despesas, fluxo de caixa e relatórios mensais. Lançamentos financeiros devem diferenciar pago, pendente e cancelado; estornos precisam de lançamento reverso, não sobrescrita invisível.

**Premium:** ficha de insumos por serviço (quantidade, unidade, custo histórico), baixa **uma vez** na transição autorizada para `COMPLETED`, controle contra estoque negativo conforme regra configurada, movimentos de estorno para cancelamentos/reversões e cálculo de margem **estimada** (receita menos insumos consumidos; não chamar lucro líquido). Disparar consumo via transação/RPC backend idempotente; nunca apenas no `onClick` do frontend.

## Entregas em sequência

- [ ] **Fase 1 — Segurança/assinatura:** confirmar como a plataforma comercial provisiona cada instalação, preparar migração de negócio/membros/entitlements, backfill, isolamento e testes de RLS; **nenhuma liberação do novo papel sem isso**.
- [ ] **Fase 2 — Equipe:** convite, aceite, revogação, interface `Equipe`, login individual e perfil do segundo profissional.
- [ ] **Fase 3 — Agenda:** serviços, horários e bloqueios por profissional; seleção pública; RPC v2 com conflito isolado e concorrência segura; dashboard e chat escopados.
- [ ] **Fase 4 — Gestão:** catálogo, estoque com livro de movimentos, vendas, receitas, despesas, fluxo de caixa e relatórios.
- [ ] **Fase 5 — Premium:** consumo de insumos, baixa idempotente no atendimento concluído, custo/margem histórica, reversões e relatórios por pessoa + consolidado.
- [ ] **Fase 6 — Comercial:** atualizar o site, `PLANS` e comparação, contrato versionado (sem sobrescrever aceites históricos), FAQ e provisionamento dos assentos **somente após aceite de produto e testes**. Preservar preços e assinaturas existentes. 

## Testes mínimos de aceitação

1. Duas contas profissionais com senhas próprias; titular convida e revoga, limite de um adicional ativo no Premium verificado no backend.
2. Profissional A não consegue consultar, alterar nem exportar clientes, agendas, recebimentos, imagens/comprovantes ou mensagens do B usando chamadas REST/RPC diretas (testar com JWT real de ambos).
3. Dois atendimentos às 14:00, um por profissional, são aceitos; dois atendimentos conflitantes para o mesmo profissional não são aceitos, inclusive requisições concorrentes.
4. Cliente só consegue agendar serviço oferecido pelo profissional selecionado, respeitando regras e bloqueios.
5. Concluir serviço duas vezes não gera duas baixas de insumos nem duas receitas; cancelamento/estorno deixa rastreabilidade.
6. Estoque, receita, despesas e margem dos dois profissionais ficam isolados; titular enxerga consolidação sem soma duplicada.
7. Premium suspenso/revogado não concede novo assento; preserva registros e atende à política de acesso definida sem excluir dados.
8. Testar migrações com cópia sanitizada do banco e rollback planejado; executar `npm run build`, lint e testes SQL/RLS antes do merge.
9. Nenhum checkout, cobrança Stripe, credencial do Google ou publicação de produção é alterado nesta etapa documental.

## Referências de implementação

- Aplicativo: `src/components/ProtectedRoute.tsx`, `src/components/admin/AdminLayout.tsx`, `src/pages/Agendar.tsx`, `src/pages/admin/{Agenda,Financeiro,Servicos,Configuracoes}.tsx`, `supabase/migrations/20260923174500_secure_authenticated_booking_functions.sql`.
- Comercial: `c-franchi/agendaaipro-4cd26344/docs/oferta-comercial.md`, `src/lib/constants.ts`, `src/components/landing/PricingSection.tsx`, templates de contrato versionados e webhooks de cobrança.

**Observação de entrega:** não foram executadas migrações, testes de banco ou publicação; este documento define o escopo auditável para a implementação de código nas próximas fases.
