import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DollarSign, Calendar, User } from "lucide-react";

interface Booking {
  id: string;
  customer_name: string;
  booking_date: string;
  booking_time: string;
  price: number;
  status: string;
  service_id: string;
}

export default function Financeiro() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    confirmed: 0,
  });

  useEffect(() => {
    fetchBookings();
  }, []);

  async function fetchBookings() {
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .order("booking_date", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar agendamentos");
      return;
    }

    setBookings(data || []);
    calculateStats(data || []);
  }

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

  async function markAsPaid(id: string) {
    const { error } = await supabase
      .from("bookings")
      .update({ status: "CONFIRMED" })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao confirmar pagamento");
      return;
    }

    toast.success("Pagamento confirmado!");
    fetchBookings();
  }

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
                        {format(new Date(booking.booking_date), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}{" "}
                        às {booking.booking_time}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-bold text-lg">
                        R$ {Number(booking.price).toFixed(2)}
                      </p>
                      {getStatusBadge(booking.status)}
                      {booking.status === "PENDING_PAYMENT" && (
                        <Button
                          size="sm"
                          onClick={() => markAsPaid(booking.id)}
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
    </AdminLayout>
  );
}
