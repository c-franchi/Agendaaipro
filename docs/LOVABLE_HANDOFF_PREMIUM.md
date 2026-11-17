# Entrega para Lovable — Premium multiprofissional

**Status:** Código implementado em branch/PR, não homologado no banco. **Não fazer merge/publicação automática.**

## Repositórios e PRs
- Sistema profissional: `c-franchi/Agendaaipro` PR **#5** (`feature/premium-multiprofissional-foundation-20261117`).
- Site de planos/checkout: `c-franchi/agendaaipro-4cd26344` PR **#25** (`feature/premium-multiprofissional-rollout-20261117`), recurso comercial **desligado**.
- Escopo de produto: **uma empresa, titular + um profissional**, dois logins independentes, agendas, serviços, chat, portfólio e controle financeiro isolados; o titular vê consolidado.

## O que foi desenvolvido no sistema-base
1. Esquema de negócios, permissões e assinaturas, profissionais e convites por e-mail confirmado com token aleatório e validade, limite de vagas no Postgres.
2. RPCs de horários/agendamentos/reagendamentos v2, conflitos por pessoa, gravação de horários por profissional, bloqueios e serviços individuais.
3. Área `/admin/equipe` para o titular; `/profissional/convite`, `/profissional`, `/profissional/chat`, `/profissional/portfolio`, `/profissional/gestao`; integração do agendamento público com o profissional responsável; inclusão de agendamento manual pela RPC `professional_create_manual_booking` (não lança cobrança).
4. Tabelas e RPCs de estoque, movimentações, vendas, despesas, insumos por serviço, baixa após conclusão e custo histórico. Cálculos apresentados como **estimativa**, não lucro líquido.
5. Chat e portfólio independentes; acesso aos comprovantes do próprio profissional. Mantidos fluxos legados por compatibilidade.
6. Workflow GitHub Actions de lint estático/TypeScript/Vite; **`package-lock.json` original não satisfaz `npm ci`** e fallback temporário permite diagnóstico. Precisa reconciliar e fixar lockfile.

## Checklist técnico — ordem segura e obrigatória

- [ ] Revisar todas as migrations `20261117*` e as dependências de funções `private` existentes. **Aplicar apenas em cópia sanitizada/homologação** e gerar migração corrigida se houver erro de execução, não rodar direto em produção.
- [ ] Executar projeto `npx tsc --noEmit -p tsconfig.app.json`, `npm run build`, ESLint, validar relógio de São Paulo, estoque e checkouts existentes.
- [ ] Gerar `supabase/types.ts` atualizado após esquema real: eliminar a conversão temporária `premiumDb as SupabaseClient` gradualmente. Verificar exposição Data API, concessões e RLS em cada tabela.
- [ ] Criar teste de isolamento com **três JWT reais** (titular, profissional convidado, cliente), rodando API REST, RPC, Storage e Realtime. Testar RLS de SELECT/INSERT/UPDATE/DELETE, inclusive tentativas manuais de alterar IDs.
- [ ] Agendar em duas agendas às **14:00** sem conflito; agendar duas reservas concorrentes às 14:00 para **a mesma pessoa** (apenas uma pode vencer). Testar reagendamentos v1/v2, serviço com blocos intercalados, domingo e bloqueios.
- [ ] Verificar que salvar horários do titular no painel antigo **não altera** horários do convidado; confirmar filtros públicos e backfill dos agendamentos, chats e imagens antigos.
- [ ] Testar convite de 72 horas, e-mail diferente, e-mail não confirmado, token repetido, 2º convite simultâneo, premium expirado, revogação com atendimentos futuros e sem, contas inativas.
- [ ] Testar quantitativos financeiros, estoque insuficiente, venda cancelada com reposição, dupla conclusão do atendimento (uma única baixa), ficha de insumos/estornos, despesas anuladas.
- [ ] Revisar comprovantes de Pix e demais credenciais; nunca retornar chave de serviço no cliente. Verificar limites, índices, grants, Postgres security advisors.
- [ ] Garantir que `business_entitlements` é provisionado **somente** depois de validar assinatura/pedido no backend comercial; iniciar o titular por `initialize_business`, depois provisionar Premium e 2 assentos. Não confiar em `plan_type` enviado pelo browser.
- [ ] Revisar contrato versionado do comercial antes de ativar a flag da oferta; manter contratos antigos intactos e alterar a versão de contrato no backend do checkout. Não alterar Stripe/preços atuais.
- [ ] Se tudo aprovado, merge da PR base e deploy migratório controlado (com backup e plano rollback); só então PR comercial e ativação coordenada `PREMIUM_TEAM_ROLLOUT.enabled=true` em PR separada após homologação ponta a ponta.

## Restrições importantes
- Banco da instalação analisada é de **um estabelecimento por aplicação**. O schema não equivale a multiempresa compartilhando um mesmo Supabase.
- `business_entitlements` é cadastrado inicialmente como **Agenda/1 assento**, portanto o segundo profissional **não ficará ativo** sem provisionamento servidor-servidor. Isso é intencional para evitar concessões gratuitas indevidas.
- Dashboard financeiro atual é um resumo parcial, não conciliação bancária; alguns relatórios listam até 100 registros para evitar consultas ilimitadas. Escalabilidade e paginação são pendências da revisão.
- O chat de cliente foi expandido para múltiplos profissionais; testar PWA/cache e fluxo de autenticação para não perder conversas.
- Não copiar ou migrar dados de clientes entre instalações diferentes, não executar migração destrutiva.

## Critério para concluir

**Aprovação somente após**: CI verde, migrações em homologação, testes de segurança com JWT, preview mobile desktop, provisionamento assinado no backend, contrato versionado correto, sem regressões nas reservas e pagamento já publicado. Um PR com apenas build frontend verde não demonstra segurança do banco.
