# Evolução segura do sistema Eric Zambonini

## Objetivo
Evoluir o sistema existente sem recriação, perda de dados ou publicação automática. A implementação preservará os serviços, preços, horários, agendamentos, contas, conversas e configurações atuais, corrigindo primeiro os riscos de segurança e depois modernizando a experiência pública, do cliente e administrativa.

## Situação confirmada
- O banco está saudável e contém os dados em uso.
- O site atual funciona em desktop e celular sem rolagem horizontal na tela inicial, mas ainda usa imagens genéricas, números fictícios e identidade antiga.
- Existem 19 alertas de segurança, incluindo acesso indevido a agendamentos, mensagens e comprovantes.
- Qualquer usuário autenticado consegue alterar áreas administrativas como serviços, agenda e configurações; isso será corrigido por função real de administrador.
- Os comprovantes estão em armazenamento privado, mas o site tenta abri-los como públicos.
- O agendamento e o pagamento dependem de validações no navegador, permitindo concorrência de horários e manipulação de dados.
- O cadastro público de “Primeiro Acesso” administrativo ainda existe.
- As notificações atuais só funcionam enquanto a página permanece aberta; não são push confiável.
- O PWA armazena caminhos de desenvolvimento que não existem na versão publicada.
- Há dependências com vulnerabilidades conhecidas que precisam ser atualizadas com validação de regressão.

## Implementação

### 1. Segurança e preservação dos dados
- Criar migrations incrementais, sem remover tabelas nem apagar linhas existentes.
- Adicionar `user_id` opcional aos agendamentos para vincular clientes autenticados, preservando agendamentos antigos e convidados.
- Substituir políticas permissivas por regras explícitas:
  - público: somente perfil profissional, serviços ativos e disponibilidade necessária;
  - cliente: somente seu perfil, seus agendamentos, sua conversa, suas mensagens e seus comprovantes;
  - administrador: acesso operacional validado por `has_role(..., 'admin')`;
  - service role: acesso reservado às funções internas.
- Restringir `user_roles` para impedir autoatribuição de administrador.
- Restringir comprovantes por pasta do proprietário e permitir ao administrador URLs assinadas temporárias.
- Remover leitura pública de tokens, nomes, telefones, mensagens e notificações.
- Revogar execução pública desnecessária das funções privilegiadas e manter `has_role` apenas onde exigido pelas políticas.
- Ativar proteção contra senhas vazadas e exigir senha atual para trocas de senha.
- Remover do navegador os campos secretos de WhatsApp; dados secretos futuros serão armazenados apenas como segredo do sistema.

### 2. Operações críticas no servidor
- Criar uma função segura de agendamento que valide nome, WhatsApp, serviço ativo, preço real, data local brasileira, antecedência, limite futuro, horário de funcionamento, bloqueios, duração total e blocos intercalados.
- Impedir dois agendamentos concorrentes no mesmo período usando trava e validação atômicas no banco.
- Gerar no servidor o identificador de acesso ao pagamento, com hash armazenado e validade definida; nenhum token será montado ou validado apenas no navegador.
- Criar funções seguras para consultar agendamento pelo token, escolher pagamento, enviar comprovante, cancelar e reagendar.
- Reagendar de forma atômica: o horário antigo só será liberado depois que o novo horário for reservado com sucesso.
- Aplicar `cancel_policy_hours` nas ações do cliente e registrar solicitações/alterações de status.
- Manter Pix manual inicialmente, mas gerar o payload no servidor e nunca expor credenciais privadas. Gateway e confirmação automática ficarão preparados para integração posterior com o provedor escolhido.
- Corrigir `create-admin` com validação Zod, CORS limitado ao próprio site, respostas consistentes e rollback da conta caso a atribuição de função falhe.

### 3. Autenticação e rotas
- Remover “Primeiro Acesso” da tela pública administrativa.
- Criar proteção centralizada para rotas de cliente e administrador, aguardando a sessão antes de renderizar conteúdo.
- Manter login administrativo separado do login do cliente.
- Adicionar recuperação de senha e tratamento correto de confirmação de e-mail.
- Exigir validação administrativa real em todas as ações do painel, não apenas esconder telas.
- Corrigir a gestão de administradores para mostrar e-mails reais e criar/remover permissões somente pela função segura.

### 4. Agendamento e área do cliente
- Manter o fluxo em etapas, permitindo nome + WhatsApp para convidado e preenchimento automático para cliente autenticado.
- Usar calendário local `pt-BR`, sem `toISOString()` para datas civis.
- Desabilitar dias a partir das regras reais do banco, não por domingo fixo.
- Mostrar estados distintos para dia fechado, limite de antecedência, bloqueio e erro de conexão.
- Respeitar encerramento do expediente considerando a duração completa do serviço.
- Exibir resumo, método de pagamento e estado de confirmação com linguagem clara.
- Modernizar “Meus agendamentos” com próximos horários, histórico, status e ações permitidas.
- Preservar o chat interno e limitar mensagens à conversa do próprio cliente.
- Usar atualizações em tempo real para status e mensagens dentro da plataforma.

### 5. Site público e identidade visual
- Substituir a imagem principal genérica por `hero_eric.webp` e usar `hero_eric.png` apenas como fonte de alta qualidade quando necessário.
- Substituir progressivamente a galeria genérica por `corte2.webp` a `corte7.webp` e `corte5.png`, com miniaturas otimizadas, carregamento tardio e textos descritivos.
- Criar uma home profissional com:
  - cabeçalho responsivo e acesso separado para cliente e administrador;
  - “Eric Zambonini” como sinal principal e “Atuando desde 2001”;
  - serviços masculinos e femininos vindos do banco;
  - portfólio por categoria com visualização ampliada;
  - seção profissional “Sobre”;
  - avaliações sem depoimentos ou notas inventadas, usando o link real do Google;
  - Instagram e Facebook informados pelo usuário.
- Remover “500+ clientes”, cinco estrelas fixas e qualquer métrica não comprovada.
- Não exibir endereço, mapa, telefone ou WhatsApp até existirem valores reais confirmados no painel.

### 6. Conteúdo administrável
- Criar área de portfólio no painel para cadastrar, ordenar, categorizar, descrever, ativar e remover imagens.
- Criar armazenamento dedicado para portfólio com regras seguras; os arquivos enviados serão preservados como origem e versões otimizadas serão usadas no site.
- Ampliar o perfil profissional com redes sociais, link de avaliações e informações públicas opcionais.
- Manter serviços, preços, durações, pagamento presencial e bloqueios intercalados já existentes.
- Salvar horários sem apagar todas as regras antes da confirmação; usar atualização transacional.
- Substituir exclusões definitivas de serviços por desativação quando houver histórico relacionado.

### 7. Painel administrativo
- Reorganizar a navegação com identidade Eric Zambonini e estados de carregamento/autorização.
- Corrigir os indicadores do dashboard para hoje, próximos sete dias, pendências, confirmados, cancelados e receita realizada, sem contar cancelados como receita.
- Melhorar a agenda mensal e a lista diária, incluindo filtros por status/data e ações de confirmação, conclusão e cancelamento.
- Corrigir Financeiro para mostrar comprovantes privados por URL temporária e registrar confirmação/rejeição com feedback ao cliente.
- Tornar Configurações utilizável em telas pequenas, sem abas comprimidas.

### 8. PWA, notificações e atualizações
- Rebatizar manifest, ícones, atalhos e notificações para Eric Zambonini.
- Remover o cache manual inseguro de arquivos de desenvolvimento e instalar a estratégia PWA compatível com Vite, desativada no ambiente de edição.
- Não pedir permissão de notificação ao abrir o site; solicitar somente após ação explícita do usuário.
- Implementar notificações dentro da plataforma imediatamente.
- Preparar push real com assinaturas por dispositivo, preferências e função de envio. A ativação externa dependerá das chaves de push, que serão solicitadas somente quando necessárias.

### 9. SEO, privacidade, performance e acessibilidade
- Atualizar `lang` para `pt-BR`, título, descrição, Open Graph e Twitter com a identidade real.
- Adicionar canonical para `https://ericzambonini.lovable.app`, `LocalBusiness` sem inventar endereço/telefone/horários e sitemap da página pública.
- Manter áreas administrativas e do cliente fora do sitemap e orientar robôs a não indexá-las.
- Criar páginas de Privacidade e Termos com texto inicial claro e campos pendentes identificados, sem inventar CNPJ/endereço.
- Preparar GA4 sem ID fictício e só carregar após consentimento quando um ID real for informado.
- Atualizar dependências vulneráveis uma a uma e validar regressões.
- Garantir foco visível, navegação por teclado, rótulos, contraste, alvos de toque e `prefers-reduced-motion`.

## Detalhes técnicos
- As mudanças de banco serão incrementais e aplicadas pela ferramenta de migration; nenhum dado existente será apagado.
- O modelo manterá convidados (`bookings.user_id = NULL`) e clientes autenticados (`bookings.user_id = auth.uid()`).
- As funções de reserva, reagendamento, pagamento e cancelamento serão as únicas responsáveis por operações sensíveis.
- A consulta pública de disponibilidade retornará somente ocupação agregada, nunca nomes, telefones ou tokens.
- O portfólio usará tabela própria e armazenamento público somente para imagens aprovadas; comprovantes continuarão privados.
- O endereço e WhatsApp públicos permanecerão ocultos até serem informados com exatidão.

## Validação antes de concluir
- Executar lint, build e testes das regras de horário, duração, intercalação, antecedência, cancelamento e concorrência.
- Testar como visitante, cliente e administrador, incluindo tentativas negadas entre contas.
- Validar criação de administrador, recuperação de senha, chat, upload/leitura privada de comprovante e atualização de status.
- Testar home, agendamento, cliente e painel em 360, 390, 768, 1280, 1440 e 1920 px, sem rolagem horizontal ou sobreposição.
- Rodar novamente scanner de segurança, linter do banco e auditoria de dependências.
- Comparar dados antes/depois das migrations e entregar relatório final com arquivos, migrations, políticas, testes, pendências externas e nível real de prontidão.
- Não publicar automaticamente.

## Dependências que não bloqueiam o início
- Endereço/localização real, telefone/WhatsApp público e horários finais podem ser informados depois; não serão inventados.
- Push real exigirá chaves próprias no momento da ativação.
- Confirmação Pix automática exigirá escolha e credenciais de um provedor; até lá, o fluxo manual seguro continuará disponível.
