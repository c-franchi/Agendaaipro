// Sistema desenvolvido por Dev Nei
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, DollarSign, LogOut, MessageCircle, User, ArrowLeft, RefreshCw, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import type { User as AuthUser } from "@supabase/supabase-js";

interface Booking {
  id: string;
  booking_date: string;
  booking_time: string;
  status: string;
  cancellation_requested_at: string | null;
  price: number;
  service_id: string;
  services: {
    name: string;
    duration_min: number;
  };
}

// Área do cliente para visualizar e gerenciar agendamentos
export default function ClienteAgendamentos() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(null);
  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; booking: Booking | null }>({
    open: false,
    booking: null,
  });

  // Valida sessão e carrega agendamentos ao iniciar
  useEffect(() => {
    loadBookings();
  }, []);

  // Carrega agendamentos do cliente pelo telefone
  async function loadBookings() {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) return;

      setUser(session.user);

      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          services (
            name,
            duration_min
          )
        `)
        .eq("user_id", session.user.id)
        .order("booking_date", { ascending: false })
        .order("booking_time", { ascending: false });

      if (error) throw error;

      setBookings(data || []);
    } catch (error: unknown) {
      console.error("Erro ao carregar agendamentos:", error);
      toast.error("Erro ao carregar agendamentos");
    } finally {
      setLoading(false);
    }
  }

  // Realiza logout do cliente
  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/cliente");
  }

  // Converte status para badge amigável
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      PENDING_PAYMENT: { label: "Aguardando Pagamento", variant: "outline" },
      CONFIRMED: { label: "Confirmado", variant: "default" },
      COMPLETED: { label: "Concluído", variant: "secondary" },
      CANCELED: { label: "Cancelado", variant: "destructive" },
    };

    const statusInfo = statusMap[status] || { label: status, variant: "outline" };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  // Define se o agendamento pode ser alterado
  const canModifyBooking = (booking: Booking) => {
    return booking.status === "PENDING_PAYMENT" || booking.status === "CONFIRMED";
  };

  // Reagendamento automático - redireciona para a página de agendamento com o serviço pré-selecionado
  // Armazena agendamento para reagendamento
  function handleReschedule(booking: Booking) {
    setRescheduleBooking(booking);
  }

  // Abre o fluxo seguro de reagendamento sem cancelar o horário atual.
  async function confirmReschedule() {
    if (!rescheduleBooking) return;
    navigate(`/agendar?service=${rescheduleBooking.service_id}&reschedule=${rescheduleBooking.id}`);
  }

  // Registra a solicitação de cancelamento no servidor.
  async function handleCancelBooking() {
    if (!cancelDialog.booking || !user) return;

    try {
      const booking = cancelDialog.booking;
      const { error } = await supabase.rpc("request_booking_cancellation", { p_booking_id: booking.id });
      if (error) throw error;

      toast.success("Solicitação enviada. O profissional irá confirmar o cancelamento.");
      setCancelDialog({ open: false, booking: null });
      loadBookings();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Erro ao enviar solicitação");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/cliente">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Meus Agendamentos</h1>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
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

          <Link to="/cliente/perfil">
            <Card className="hover:border-primary transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Perfil
                </CardTitle>
                <CardDescription>Editar dados pessoais</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link to="/agendar">
            <Card className="hover:border-primary transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Novo Agendamento
                </CardTitle>
                <CardDescription>Agendar horário</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Histórico de Agendamentos</CardTitle>
            <CardDescription>
              Visualize todos os seus agendamentos anteriores e futuros
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Carregando...</p>
            ) : bookings.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">Você ainda não tem agendamentos</p>
                <Link to="/agendar">
                  <Button>
                    <Calendar className="w-4 h-4 mr-2" />
                    Fazer Primeiro Agendamento
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {bookings.map((booking) => (
                  <Card key={booking.id} className="border-border">
                    <CardContent className="pt-6">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-lg text-foreground">
                              {booking.services?.name}
                            </h3>
                            {booking.cancellation_requested_at ? <Badge variant="outline">Cancelamento solicitado</Badge> : getStatusBadge(booking.status)}
                          </div>
                          
                          <div className="space-y-1 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4" />
                              {new Date(booking.booking_date).toLocaleDateString("pt-BR", {
                                weekday: "long",
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })}
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4" />
                              {booking.booking_time} - {booking.services?.duration_min} minutos
                            </div>
                            <div className="flex items-center gap-2">
                              <DollarSign className="w-4 h-4" />
                              R$ {parseFloat(booking.price.toString()).toFixed(2)}
                            </div>
                          </div>
                        </div>

                          {canModifyBooking(booking) && !booking.cancellation_requested_at && (
                          <div className="flex gap-2 flex-wrap">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReschedule(booking)}
                            >
                              <RefreshCw className="w-4 h-4 mr-1" />
                              Reagendar
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setCancelDialog({ open: true, booking })}
                            >
                              <X className="w-4 h-4 mr-1" />
                              Cancelar
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Dialog de Reagendamento Automático */}
      <AlertDialog open={!!rescheduleBooking} onOpenChange={(open) => !open && setRescheduleBooking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reagendar Agendamento</AlertDialogTitle>
            <AlertDialogDescription>
              Escolha um novo horário para “{rescheduleBooking?.services?.name}”. O horário atual será mantido até a troca ser concluída.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReschedule}>
              Continuar para Reagendar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Cancelamento */}
      <AlertDialog open={cancelDialog.open} onOpenChange={(open) => setCancelDialog({ ...cancelDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Agendamento</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja solicitar o cancelamento deste agendamento? A solicitação respeitará o prazo configurado e aguardará a confirmação do profissional.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelBooking}>
              Solicitar Cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
