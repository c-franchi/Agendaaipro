// Sistema desenvolvido por Dev Nei
import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { MessageCircle, ArrowLeft } from "lucide-react";

// Área do cliente para login e cadastro
export default function Cliente() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("login");
  const [notice, setNotice] = useState("");
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  function authMessage(error: unknown, fallback: string) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "invalid_credentials") return "E-mail ou senha não conferem. Verifique os dados ou solicite a recuperação de senha.";
    if (code === "email_not_confirmed") return "Confirme seu e-mail antes de entrar. Verifique também a caixa de spam.";
    if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit") return "Limite de tentativas atingido. Aguarde alguns minutos antes de tentar novamente.";
    if (code === "email_address_not_authorized") return "O envio de e-mails está restrito na configuração do sistema. Entre em contato com o salão.";
    return fallback;
  }
  
  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  
  // Signup state
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupFullName, setSignupFullName] = useState("");
  const [signupPhone, setSignupPhone] = useState("");

  // Realiza autenticação do cliente
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword,
      });

      if (error) {
        setNeedsConfirmation(error.code === "email_not_confirmed");
        throw error;
      }

      toast.success("Login realizado com sucesso!");
      const requestedPath = (location.state as { from?: string } | null)?.from;
      navigate(requestedPath || "/cliente/agendamentos", { replace: true });
    } catch (error: unknown) {
      console.error(error);
      toast.error(authMessage(error, "Não foi possível entrar. Verifique sua conexão e tente novamente."));
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordRecovery() {
    const email = loginEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Informe seu e-mail para recuperar a senha");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/cliente/perfil`,
      });
      if (error) throw error;
      setNotice("Se houver uma conta para este e-mail, você receberá as instruções de recuperação. Verifique também o spam.");
    } catch (error) {
      toast.error(authMessage(error, "Não foi possível solicitar a recuperação de senha. Tente novamente mais tarde."));
    } finally {
      setLoading(false);
    }
  }

  async function resendConfirmation() {
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: loginEmail.trim().toLowerCase(),
        options: { emailRedirectTo: `${window.location.origin}/cliente` },
      });
      if (error) throw error;
      setNotice("Solicitação de confirmação recebida. Verifique seu e-mail e a caixa de spam.");
    } catch (error) {
      toast.error(authMessage(error, "Não foi possível reenviar a confirmação. Tente novamente mais tarde."));
    } finally {
      setLoading(false);
    }
  }

  // Realiza cadastro do cliente no Supabase
  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const email = signupEmail.trim().toLowerCase();
      const { data, error } = await supabase.auth.signUp({
        email,
        password: signupPassword,
        options: {
          data: {
            full_name: signupFullName,
            phone: signupPhone,
          },
          emailRedirectTo: `${window.location.origin}/cliente`,
        },
      });

      if (error) throw error;

      // O cadastro sempre termina na aba de login, mesmo com confirmação desativada.
      if (data.session) {
        const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
        if (signOutError) throw signOutError;
      }
      setLoginEmail(email);
      setLoginPassword("");
      setSignupPassword("");
      setNeedsConfirmation(!data.session);
      setNotice(data.session
        ? "Cadastro realizado. Entre com seu e-mail e senha."
        : "Cadastro recebido. Confirme seu e-mail antes de entrar. Se você já tem uma conta, use sua senha ou solicite a recuperação.");
      setTab("login");
    } catch (error: unknown) {
      console.error(error);
      toast.error(authMessage(error, "Não foi possível concluir o cadastro. Confira seus dados e tente novamente."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Voltar ao site
        </Link>

        <Card className="p-8 bg-card">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <MessageCircle className="w-8 h-8 text-primary" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-center mb-2 text-foreground">Área do Cliente</h1>
          <p className="text-muted-foreground text-center mb-8">
            Acesse seu chat e acompanhe seus agendamentos
          </p>

          {notice && <p role="status" className="mb-5 rounded-md border border-border bg-muted p-3 text-sm">{notice}</p>}
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastrar</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="login-email">E-mail</Label>
                  <Input
                    id="login-email"
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="login-password">Senha</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
                <Button type="button" variant="link" className="w-full" disabled={loading} onClick={handlePasswordRecovery}>
                  Esqueci minha senha
                </Button>
                {needsConfirmation && <Button type="button" variant="outline" className="w-full" disabled={loading} onClick={resendConfirmation}>Reenviar confirmação de e-mail</Button>}
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <Label htmlFor="signup-name">Nome Completo</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    value={signupFullName}
                    onChange={(e) => setSignupFullName(e.target.value)}
                    placeholder="João Silva"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="signup-phone">WhatsApp</Label>
                  <Input
                    id="signup-phone"
                    type="tel"
                    value={signupPhone}
                    onChange={(e) => setSignupPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="signup-email">E-mail</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="signup-password">Senha</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Mínimo de 6 caracteres
                  </p>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Cadastrando..." : "Cadastrar"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
