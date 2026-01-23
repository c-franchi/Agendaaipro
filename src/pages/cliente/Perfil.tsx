// Sistema desenvolvido por Dev Nei
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogOut, ArrowLeft, Save, Calendar, MessageCircle } from "lucide-react";
import { toast } from "sonner";

// Perfil do cliente com atualização de dados e senha
export default function ClientePerfil() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Carrega dados do cliente ao iniciar
  useEffect(() => {
    loadProfile();
  }, []);

  // Busca perfil e dados do cliente autenticado
  async function loadProfile() {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/cliente");
        return;
      }

      setUser(session.user);
      setEmail(session.user.email || "");

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (error) throw error;

      setFullName(profile?.full_name || "");
      setPhone(profile?.phone || "");
    } catch (error: any) {
      console.error("Erro ao carregar perfil:", error);
      toast.error("Erro ao carregar perfil");
    } finally {
      setLoading(false);
    }
  }

  // Salva alterações no perfil do cliente
  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          phone: phone,
        })
        .eq("id", user.id);

      if (error) throw error;

      toast.success("Perfil atualizado com sucesso!");
    } catch (error: any) {
      console.error("Erro ao salvar perfil:", error);
      toast.error("Erro ao salvar perfil");
    } finally {
      setSaving(false);
    }
  }

  // Atualiza a senha do cliente
  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast.success("Senha alterada com sucesso!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error("Erro ao alterar senha:", error);
      toast.error("Erro ao alterar senha");
    } finally {
      setSaving(false);
    }
  }

  // Realiza logout do cliente
  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/cliente");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/cliente/agendamentos">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Meu Perfil</h1>
              <p className="text-sm text-muted-foreground">{email}</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="grid gap-4 md:grid-cols-2 mb-6">
          <Link to="/cliente/chat">
            <Card className="hover:border-primary transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  Chat
                </CardTitle>
                <CardDescription>Fale com a barbearia</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link to="/cliente/agendamentos">
            <Card className="hover:border-primary transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Agendamentos
                </CardTitle>
                <CardDescription>Ver histórico</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informações Pessoais</CardTitle>
              <CardDescription>
                Atualize seus dados cadastrais
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <Label htmlFor="fullName">Nome Completo</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Seu nome completo"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Telefone/WhatsApp</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    O e-mail não pode ser alterado
                  </p>
                </div>

                <Button type="submit" disabled={saving} className="w-full">
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Alterar Senha</CardTitle>
              <CardDescription>
                Crie uma nova senha para sua conta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <Label htmlFor="newPassword">Nova Senha</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    minLength={6}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    minLength={6}
                    required
                  />
                </div>

                <Button type="submit" disabled={saving} className="w-full">
                  {saving ? "Alterando..." : "Alterar Senha"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
