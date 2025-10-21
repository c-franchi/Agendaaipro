import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Users, Shield, Trash2, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Admin {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

export default function Usuarios() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addingAdmin, setAddingAdmin] = useState(false);

  useEffect(() => {
    loadAdmins();
    getCurrentUser();
  }, []);

  async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }
  }

  async function loadAdmins() {
    try {
      setLoading(true);

      // Buscar todos os admins
      const { data: adminRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (rolesError) throw rolesError;

      const adminIds = adminRoles.map(r => r.user_id);

      // Buscar perfis dos admins
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .in("id", adminIds);

      if (profilesError) throw profilesError;

      // Para cada perfil, buscar o email do auth
      const adminsData: Admin[] = [];
      
      for (const profile of profiles || []) {
        // Nota: Em produção, você precisaria de uma edge function para buscar emails
        // Por enquanto, vamos mostrar apenas os dados que temos
        adminsData.push({
          id: profile.id,
          email: "admin@example.com", // Placeholder - email não é acessível via client
          full_name: profile.full_name,
          created_at: profile.created_at
        });
      }

      setAdmins(adminsData);
    } catch (error: any) {
      console.error("Erro ao carregar admins:", error);
      toast.error("Erro ao carregar administradores");
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveAdmin(adminId: string) {
    if (adminId === currentUserId) {
      toast.error("Você não pode remover a si mesmo!");
      return;
    }

    if (!confirm("Tem certeza que deseja remover este administrador?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", adminId)
        .eq("role", "admin");

      if (error) throw error;

      toast.success("Administrador removido com sucesso!");
      loadAdmins();
    } catch (error: any) {
      console.error("Erro ao remover admin:", error);
      toast.error("Erro ao remover administrador");
    }
  }

  async function handleAddAdmin(e: React.FormEvent) {
    e.preventDefault();
    setAddingAdmin(true);

    try {
      // Criar novo usuário
      const { data, error } = await supabase.auth.signUp({
        email: newAdminEmail,
        password: newAdminPassword,
      });

      if (error) throw error;

      if (data.user) {
        // Adicionar role de admin
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({
            user_id: data.user.id,
            role: "admin",
          });

        if (roleError) throw roleError;

        toast.success("Novo administrador adicionado com sucesso!");
        setNewAdminEmail("");
        setNewAdminPassword("");
        setDialogOpen(false);
        loadAdmins();
      }
    } catch (error: any) {
      console.error("Erro ao adicionar admin:", error);
      toast.error(error.message || "Erro ao adicionar administrador");
    } finally {
      setAddingAdmin(false);
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Users className="w-8 h-8" />
              Administradores
            </h1>
            <p className="text-muted-foreground">Gerencie os usuários administradores do sistema</p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="w-4 h-4 mr-2" />
                Adicionar Admin
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Novo Administrador</DialogTitle>
                <DialogDescription>
                  Crie uma nova conta de administrador para o sistema
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleAddAdmin} className="space-y-4">
                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    placeholder="admin@example.com"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Mínimo de 6 caracteres
                  </p>
                </div>

                <Button type="submit" className="w-full" disabled={addingAdmin}>
                  {addingAdmin ? "Adicionando..." : "Adicionar Administrador"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Administradores</CardTitle>
            <CardDescription>
              Total de {admins.length} administrador(es) cadastrado(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Carregando...</p>
            ) : admins.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Nenhum administrador encontrado</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Data de Criação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {admins.map((admin) => (
                    <TableRow key={admin.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{admin.full_name || "Sem nome"}</p>
                          <p className="text-sm text-muted-foreground">{admin.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="default" className="gap-1">
                          <Shield className="w-3 h-3" />
                          Admin
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(admin.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveAdmin(admin.id)}
                          disabled={admin.id === currentUserId}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
