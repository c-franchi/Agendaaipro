// Sistema desenvolvido por Dev Nei
import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DollarSign, Calendar, User, Eye, CheckCircle, XCircle } from "lucide-react";

interface Booking {
  id: string;
  customer_name: string;
  customer_whatsapp: string;
  booking_date: string;
  booking_time: string;
  price: number;
  status: string;
  service_id: string;
  payment_method: string | null;
  receipt_url: string | null;
  services?: {
    name: string;
  };
}

// Painel financeiro com transações e comprovantes
export default function Financeiro() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    confirmed: 0,
  });
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [receiptImageUrl, setReceiptImageUrl] = useState<string | null>(null);

  // Carrega transações ao iniciar
  useEffect(() => {
    fetchBookings();
  }, []);

  // Busca agendamentos e calcula estatísticas
  async function fetchBookings() {
    const { data, error } = await supabase
      .from("bookings")
      .select(`
        *,
        services (name)
      `)
      .order("booking_date", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar agendamentos");
      return;
    }

    setBookings((data || []) as Booking[]);
    calculateStats((data || []) as Booking[]);
  }

  // Calcula totais e pendências financeiras
  function calculateStats(bookings: Booking[]) {
    const total = bookings
      .filter((b) => b.status === "CONFIRMED" || b.status === "COMPLETED")
      .reduce((sum, b) => sum + Number(b.price), 0);

    const pending = bookings
      .filter((b) => b.status === "PENDING_PAYMENT")
      .reduce((sum, b) => sum + Number(b.price), 0);

    const confirmed = bookings
      .filter((b) => b.status === "CONFIRMED")
      .reduce((sum, b) => sum + Number(b.price), 0);

    setStats({ total, pending, confirmed });
  }

  // Abre modal do comprovante e carrega imagem
  async function openReceiptDialog(booking: Booking) {
    setSelectedBooking(booking);
    
    if (booking.receipt_url) {
      const { data, error } = await supabase.storage
        .from('payment-receipts')
        .createSignedUrl(booking.receipt_url, 120);
      if (error) {
        toast.error("Não foi possível abrir o comprovante");
        return;
      }
      setReceiptImageUrl(data.signedUrl);
    }
    
    setReceiptDialogOpen(true);
  }

  // Confirma pagamento após validação do comprovante
  async function confirmPayment(id: string) {
    const { error } = await supabase.rpc("admin_update_booking_status", { p_booking_id: id, p_status: "CONFIRMED" });

    if (error) {
      toast.error("Erro ao confirmar pagamento");
      return;
    }

    toast.success("Pagamento confirmado!");
    setReceiptDialogOpen(false);
    fetchBookings();
  }

  // Rejeita comprovante e retorna status pendente
  async function rejectPayment(id: string) {
    const { error } = await supabase
      .from("bookings")
      .update({ 
        status: "PENDING_PAYMENT",
        receipt_url: null 
      })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao rejeitar pagamento");
      return;
    }

    toast.info("Pagamento rejeitado. Cliente será notificado.");
    setReceiptDialogOpen(false);
    fetchBookings();
  }

  // Retorna badge com rótulo de status
  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      PENDING_PAYMENT: "outline",
      CONFIRMED: "default",
      CANCELED: "destructive",
      COMPLETED: "secondary",
    };

    const labels: Record<string, string> = {
      PENDING_PAYMENT: "Pendente",
      CONFIRMED: "Confirmado",
      CANCELED: "Cancelado",
      COMPLETED: "Concluído",
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {labels[status] || status}
      </Badge>
    );
  };

  // Converte método de pagamento para rótulo exibível
  const getPaymentMethodLabel = (method: string | null) => {
    if (!method) return "-";
    return method === "pix" ? "Pix" : "Presencial";
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-foreground">Financeiro</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Recebido</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ {stats.total.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendente</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ {stats.pending.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Confirmado</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ {stats.confirmed.toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Transações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {bookings.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhuma transação encontrada
                </p>
              ) : (
                bookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg gap-3"
                  >
                    <div className="flex-1 space-y-1">
                      <p className="font-medium">{booking.customer_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {booking.services?.name} • {format(new Date(booking.booking_date), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}{" "}
                        às {booking.booking_time}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Pagamento: {getPaymentMethodLabel(booking.payment_method)}
                        {booking.receipt_url && " • Comprovante enviado"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="font-bold text-lg">
                        R$ {Number(booking.price).toFixed(2)}
                      </p>
                      {getStatusBadge(booking.status)}
                      
                      {booking.status === "PENDING_PAYMENT" && booking.receipt_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openReceiptDialog(booking)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Ver Comprovante
                        </Button>
                      )}
                      
                      {booking.status === "PENDING_PAYMENT" && !booking.receipt_url && (
                        <Button
                          size="sm"
                          onClick={() => confirmPayment(booking.id)}
                        >
                          Confirmar
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog para ver comprovante */}
      <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Comprovante de Pagamento</DialogTitle>
          </DialogHeader>
          
          {selectedBooking && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <p><strong>Cliente:</strong> {selectedBooking.customer_name}</p>
                <p><strong>WhatsApp:</strong> {selectedBooking.customer_whatsapp}</p>
                <p><strong>Serviço:</strong> {selectedBooking.services?.name}</p>
                <p><strong>Valor:</strong> R$ {Number(selectedBooking.price).toFixed(2)}</p>
                <p><strong>Data:</strong> {format(new Date(selectedBooking.booking_date), "dd/MM/yyyy", { locale: ptBR })} às {selectedBooking.booking_time}</p>
              </div>

              {receiptImageUrl && (
                <div className="border rounded-lg overflow-hidden">
                  <img 
                    src={receiptImageUrl} 
                    alt="Comprovante" 
                    className="w-full max-h-96 object-contain"
                  />
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  onClick={() => confirmPayment(selectedBooking.id)}
                  className="flex-1"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Confirmar Pagamento
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => rejectPayment(selectedBooking.id)}
                  className="flex-1"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Rejeitar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
