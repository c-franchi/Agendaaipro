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

interface Booking {
  id: string;
  booking_date: string;
  booking_time: string;
  status: string;
  price: number;
  service_id: string;
  services: {
    name: string;
    duration_min: number;
  };
}

export default function ClienteAgendamentos() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkAuth();
    loadBookings();
  }, []);

  async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/cliente");
      return;
    }
    setUser(session.user);
  }

  async function loadBookings() {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) return;

      // Buscar perfil do usuário para pegar o WhatsApp
      const { data: profile } = await supabase
        .from("profiles")
        .select("phone")
        .eq("id", session.user.id)
        .single();

      if (!profile?.phone) {
        setBookings([]);
        return;
      }

      // Buscar agendamentos pelo WhatsApp
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          services (
            name,
            duration_min
          )
        `)
        .eq("customer_whatsapp", profile.phone)
        .order("booking_date", { ascending: false })
        .order("booking_time", { ascending: false });

      if (error) throw error;

      setBookings(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar agendamentos:", error);
      toast.error("Erro ao carregar agendamentos");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/cliente");
  }

  const [actionDialog, setActionDialog] = useState<{ open: boolean; type: "reschedule" | "cancel"; booking: Booking | null }>({
    open: false,
    type: "cancel",
    booking: null,
  });

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

  const canModifyBooking = (booking: Booking) => {
    return booking.status === "PENDING_PAYMENT" || booking.status === "CONFIRMED";
  };

  async function handleBookingAction() {
    if (!actionDialog.booking || !user) return;

    try {
      // Get or create conversation for this user
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", user.id)
        .single();

      if (!profile) {
        toast.error("Perfil não encontrado");
        return;
      }

      // Check if conversation exists
      let { data: conversation } = await supabase
        .from("conversations")
        .select("id")
        .eq("user_id", user.id)
        .single();

      // Create conversation if doesn't exist
      if (!conversation) {
        const { data: newConv, error: convError } = await supabase
          .from("conversations")
          .insert({
            user_id: user.id,
            customer_name: profile.full_name || "Cliente",
            customer_whatsapp: profile.phone || "",
          })
          .select()
          .single();

        if (convError) throw convError;
        conversation = newConv;
      }

      const booking = actionDialog.booking;
      const serviceName = booking.services?.name || "Serviço";
      const bookingDate = new Date(booking.booking_date).toLocaleDateString("pt-BR");
      const bookingTime = booking.booking_time;

      let message = "";
      if (actionDialog.type === "cancel") {
        message = `❌ Solicitação de CANCELAMENTO\n\nServiço: ${serviceName}\nData: ${bookingDate}\nHorário: ${bookingTime}\n\nPor favor, confirme o cancelamento deste agendamento.`;
      } else {
        message = `🔄 Solicitação de REAGENDAMENTO\n\nServiço: ${serviceName}\nData: ${bookingDate}\nHorário: ${bookingTime}\n\nGostaria de reagendar este horário. Por favor, entre em contato para definir uma nova data.`;
      }

      // Send message to conversation
      const { error: msgError } = await supabase.from("messages").insert({
        conversation_id: conversation.id,
        content: message,
        sender_type: "customer",
      });

      if (msgError) throw msgError;

      toast.success(
        actionDialog.type === "cancel"
          ? "Solicitação de cancelamento enviada! O profissional irá confirmar."
          : "Solicitação de reagendamento enviada! O profissional entrará em contato."
      );

      setActionDialog({ open: false, type: "cancel", booking: null });
      navigate("/cliente/chat");
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao enviar solicitação");
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
                            {getStatusBadge(booking.status)}
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

                        {canModifyBooking(booking) && (
                          <div className="flex gap-2 flex-wrap">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setActionDialog({ open: true, type: "reschedule", booking })}
                            >
                              <RefreshCw className="w-4 h-4 mr-1" />
                              Reagendar
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setActionDialog({ open: true, type: "cancel", booking })}
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

      <AlertDialog open={actionDialog.open} onOpenChange={(open) => setActionDialog({ ...actionDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionDialog.type === "cancel" ? "Cancelar Agendamento" : "Reagendar Agendamento"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionDialog.type === "cancel"
                ? "Deseja solicitar o cancelamento deste agendamento? O profissional será notificado e confirmará o cancelamento."
                : "Deseja solicitar o reagendamento? O profissional entrará em contato para definir uma nova data."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBookingAction}>
              {actionDialog.type === "cancel" ? "Solicitar Cancelamento" : "Solicitar Reagendamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
