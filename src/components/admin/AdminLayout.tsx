import { ReactNode, useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Calendar, Scissors, DollarSign, Settings, LogOut, Menu, MessageCircle, User, Users } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/admin");
      return;
    }

    // Check if user has admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      await supabase.auth.signOut();
      toast.error("Acesso negado. Apenas administradores podem acessar.");
      navigate("/admin");
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    toast.success("Logout realizado");
    navigate("/admin");
  }

  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/admin/dashboard" },
    { icon: Calendar, label: "Agenda", path: "/admin/agenda" },
    { icon: MessageCircle, label: "Chat", path: "/admin/chat" },
    { icon: Scissors, label: "Serviços", path: "/admin/servicos" },
    { icon: DollarSign, label: "Financeiro", path: "/admin/financeiro" },
    { icon: Settings, label: "Configurações", path: "/admin/configuracoes" },
  ];

  const MenuContent = () => (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-sidebar-foreground">BarberPro</h1>
        <p className="text-sm text-sidebar-foreground/60">Admin</p>
      </div>

      <nav className="space-y-2 flex-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path} onClick={() => setMobileMenuOpen(false)}>
              <Button
                variant={isActive ? "default" : "ghost"}
                className={`w-full justify-start ${
                  isActive ? "bg-sidebar-accent" : ""
                }`}
              >
                <Icon className="w-4 h-4 mr-2" />
                {item.label}
              </Button>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-4 border-t border-sidebar-border space-y-2">
        <Link to="/admin/perfil">
          <Button
            variant="ghost"
            className="w-full justify-start"
          >
            <User className="w-4 h-4 mr-2" />
            Meu Perfil
          </Button>
        </Link>
        <Link to="/admin/usuarios">
          <Button
            variant="ghost"
            className="w-full justify-start"
          >
            <Users className="w-4 h-4 mr-2" />
            Administradores
          </Button>
        </Link>
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sair
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Mobile Header */}
      <header className="lg:hidden flex items-center justify-between p-4 border-b border-sidebar-border bg-sidebar">
        <div>
          <h1 className="text-xl font-bold text-sidebar-foreground">BarberPro</h1>
          <p className="text-xs text-sidebar-foreground/60">Admin</p>
        </div>
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-4 bg-sidebar flex flex-col">
            <MenuContent />
          </SheetContent>
        </Sheet>
      </header>

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex flex-col w-64 bg-sidebar border-r border-sidebar-border p-4 min-h-screen">
          <MenuContent />
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-8 overflow-x-hidden overflow-y-auto max-w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
