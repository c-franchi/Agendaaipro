import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type LegalProps = { page: "privacy" | "terms" };

const content = {
  privacy: {
    title: "Política de Privacidade",
    updated: "Atualizada em 23 de setembro de 2026",
    sections: [
      ["Dados utilizados", "Utilizamos os dados informados por você, como nome, e-mail, telefone, agendamentos, mensagens e comprovantes, somente para prestar e administrar os serviços solicitados."],
      ["Finalidades", "Os dados são usados para autenticação, agendamento, comunicação, pagamento, atendimento ao cliente e segurança da plataforma."],
      ["Armazenamento e proteção", "As informações pessoais e os comprovantes são protegidos por controles de acesso. Cada cliente acessa apenas seus próprios dados, enquanto a administração possui acesso operacional restrito."],
      ["Compartilhamento", "Não vendemos dados pessoais. Informações podem ser processadas por serviços essenciais de hospedagem, autenticação e pagamento, dentro da finalidade necessária ao funcionamento da plataforma."],
      ["Seus direitos", "Você pode solicitar confirmação de tratamento, correção, portabilidade ou exclusão de dados, observadas as obrigações legais de conservação."],
      ["Contato", "Solicitações de privacidade podem ser enviadas pelo chat da área do cliente. Dados jurídicos e canal formal de contato serão complementados quando disponibilizados pelo responsável."],
    ],
  },
  terms: {
    title: "Termos de Uso",
    updated: "Atualizados em 23 de setembro de 2026",
    sections: [
      ["Uso da plataforma", "A plataforma permite consultar serviços, solicitar horários, acompanhar agendamentos, enviar comprovantes e conversar com o profissional."],
      ["Conta do cliente", "Você é responsável por manter seus dados corretos e proteger o acesso à sua conta. O uso indevido ou fraudulento poderá resultar em restrição de acesso."],
      ["Agendamentos", "A solicitação está sujeita à disponibilidade e às regras de antecedência exibidas no sistema. A confirmação final é realizada pelo profissional."],
      ["Cancelamento e reagendamento", "As alterações devem respeitar o prazo configurado pelo profissional. Fora desse prazo, entre em contato pelo chat para análise individual."],
      ["Pagamentos", "Cada serviço pode permitir Pix antecipado ou pagamento presencial. Comprovantes enviados ficam pendentes até a validação do profissional."],
      ["Responsabilidades", "Indisponibilidades temporárias podem ocorrer por manutenção ou serviços externos. Estes termos não limitam direitos garantidos pela legislação brasileira."],
    ],
  },
} as const;

export default function Legal({ page }: LegalProps) {
  const document = content[page];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto flex h-16 max-w-4xl items-center px-4">
          <Button asChild variant="ghost" size="icon">
            <Link to="/" aria-label="Voltar para o início"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <Link to="/" className="ml-3 font-semibold text-foreground">Eric Zambonini</Link>
        </div>
      </header>
      <main className="container mx-auto max-w-4xl px-4 py-12 md:py-20">
        <p className="text-sm font-semibold uppercase text-primary">Informações legais</p>
        <h1 className="mt-2 text-3xl font-bold text-foreground md:text-5xl">{document.title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{document.updated}</p>
        <div className="mt-10 space-y-8">
          {document.sections.map(([title, body]) => (
            <section key={title}>
              <h2 className="text-xl font-semibold text-foreground">{title}</h2>
              <p className="mt-2 leading-7 text-muted-foreground">{body}</p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}