// Sistema desenvolvido por Dev Nei
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AdminLayout from "@/components/admin/AdminLayout";
import { Calendar, Clock, DollarSign, Users } from "lucide-react";
import { toast } from "sonner";

// Dashboard administrativo com estatísticas e agendamentos recentes
export default function Dashboard() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [stats, setStats] = useState({
    today: 0,
    week: 0,
    pending: 0,
    confirmed: 0
  });

  // Carrega agendamentos ao iniciar a tela
  useEffect(() => {
    loadBookings();
  }, []);

  // Busca agendamentos e calcula estatísticas
  async function loadBookings() {
    const { data, error } = await supabase
      .from("bookings")
      .select(`
        *,
        services (name)
      `)
      .order("booking_date", { ascending: true })
      .order("booking_time", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar agendamentos");
      return;
    }

    setBookings(data || []);

    // Calcular estatísticas
    const today = new Date().toISOString().split('T')[0];
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    const todayCount = data?.filter(b => b.booking_date === today).length || 0;
    const weekCount = data?.filter(b => new Date(b.booking_date) >= weekStart).length || 0;
    const pendingCount = data?.filter(b => b.status === 'PENDING_PAYMENT').length || 0;
    const confirmedCount = data?.filter(b => b.status === 'CONFIRMED').length || 0;

    setStats({
      today: todayCount,
      week: weekCount,
      pending: pendingCount,
      confirmed: confirmedCount
    });
  }

  // Atualiza o status do agendamento
  async function updateBookingStatus(bookingId: string, status: "PENDING_PAYMENT" | "CONFIRMED" | "CANCELED" | "COMPLETED") {
    const { error } = await supabase
      .from("bookings")
      .update({ status })
      .eq("id", bookingId);

    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }

    toast.success("Status atualizado!");
    loadBookings();
  }

  // Retorna badge de status com estilo apropriado
  function getStatusBadge(status: string) {
    const variants: any = {
      PENDING_PAYMENT: "secondary",
      CONFIRMED: "default",
      CANCELED: "destructive",
      COMPLETED: "outline"
    };

    const labels: any = {
      PENDING_PAYMENT: "Pendente",
      CONFIRMED: "Confirmado",
      CANCELED: "Cancelado",
      COMPLETED: "Concluído"
    };

    return <Badge variant={variants[status]}>{labels[status]}</Badge>;
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>

        {/* Cards de Estatísticas */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card className="p-6 bg-card">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 text-primary" />
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.today}</p>
                <p className="text-sm text-muted-foreground">Hoje</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-card">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-primary" />
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.week}</p>
                <p className="text-sm text-muted-foreground">Esta Semana</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-card">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-primary" />
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.pending}</p>
                <p className="text-sm text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-card">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-primary" />
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.confirmed}</p>
                <p className="text-sm text-muted-foreground">Confirmados</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabela de Agendamentos */}
        <Card className="p-6 bg-card">
          <h2 className="text-xl font-bold mb-4 text-foreground">Agendamentos Recentes</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">Data</th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">Horário</th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">Cliente</th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">Serviço</th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">Status</th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {bookings.slice(0, 10).map((booking) => (
                  <tr key={booking.id} className="border-b border-border">
                    <td className="py-3 px-2 text-foreground">
                      {new Date(booking.booking_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-3 px-2 text-foreground">{booking.booking_time}</td>
                    <td className="py-3 px-2 text-foreground">{booking.customer_name}</td>
                    <td className="py-3 px-2 text-foreground">{booking.services?.name}</td>
                    <td className="py-3 px-2">{getStatusBadge(booking.status)}</td>
                    <td className="py-3 px-2">
                      <div className="flex gap-2">
                        {booking.status === 'PENDING_PAYMENT' && (
                          <Button
                            size="sm"
                            onClick={() => updateBookingStatus(booking.id, 'CONFIRMED')}
                          >
                            Confirmar
                          </Button>
                        )}
                        {booking.status === 'CONFIRMED' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateBookingStatus(booking.id, 'COMPLETED')}
                          >
                            Concluir
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}
