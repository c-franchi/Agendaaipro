// Sistema desenvolvido por Dev Nei
import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format, isSameDay, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Trash2, ChevronLeft, ChevronRight, Calendar as CalendarIcon, X, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

interface Block {
  id: string;
  start_datetime: string;
  end_datetime: string;
  reason: string;
}

interface Booking {
  id: string;
  booking_date: string;
  booking_time: string;
  customer_name: string;
  customer_whatsapp: string;
  status: string;
  cancellation_requested_at: string | null;
  service_id: string;
  services?: {
    name: string;
  };
}

// Agenda administrativa para bloqueios e gestão de agendamentos
export default function Agenda() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; booking: Booking | null }>({
    open: false,
    booking: null,
  });
  const [newBlock, setNewBlock] = useState({
    start_datetime: "",
    end_datetime: "",
    reason: "",
  });

  // Atualiza dados quando o mês muda
  useEffect(() => {
    fetchBlocks();
    fetchBookings();
  }, [currentMonth]);

  // Carrega bloqueios de agenda
  async function fetchBlocks() {
    const { data, error } = await supabase
      .from("blocks")
      .select("*")
      .order("start_datetime", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar bloqueios");
      return;
    }

    setBlocks(data || []);
  }

  // Carrega agendamentos do mês selecionado
  async function fetchBookings() {
    const startDate = startOfMonth(currentMonth);
    const endDate = endOfMonth(currentMonth);

    const { data, error } = await supabase
      .from("bookings")
      .select(`
        *,
        services(name)
      `)
      .gte("booking_date", format(startDate, "yyyy-MM-dd"))
      .lte("booking_date", format(endDate, "yyyy-MM-dd"))
      .order("booking_date", { ascending: true })
      .order("booking_time", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar agendamentos");
      return;
    }

    setBookings(data || []);
  }

  // Cria um novo bloqueio de horário
  async function handleCreateBlock() {
    if (!newBlock.start_datetime || !newBlock.end_datetime) {
      toast.error("Preencha as datas de início e fim");
      return;
    }

    const { error } = await supabase.from("blocks").insert({
      start_datetime: newBlock.start_datetime,
      end_datetime: newBlock.end_datetime,
      reason: newBlock.reason || "Indisponível",
    });

    if (error) {
      toast.error("Erro ao criar bloqueio");
      return;
    }

    toast.success("Bloqueio criado com sucesso!");
    setDialogOpen(false);
    setNewBlock({ start_datetime: "", end_datetime: "", reason: "" });
    fetchBlocks();
  }

  // Remove um bloqueio existente
  async function handleDeleteBlock(id: string) {
    const { error } = await supabase.from("blocks").delete().eq("id", id);

    if (error) {
      toast.error("Erro ao remover bloqueio");
      return;
    }

    toast.success("Bloqueio removido!");
    fetchBlocks();
  }

  // Cancela um agendamento selecionado
  async function handleCancelBooking() {
    if (!cancelDialog.booking) return;

    try {
      const { error } = await supabase.rpc("admin_update_booking_status", { p_booking_id: cancelDialog.booking.id, p_status: "CANCELED" });

      if (error) throw error;

      toast.success("Agendamento cancelado com sucesso!");
      setCancelDialog({ open: false, booking: null });
      fetchBookings();
    } catch (error) {
      toast.error("Erro ao cancelar agendamento");
    }
  }

  // Confirma um agendamento pendente
  async function handleConfirmBooking(bookingId: string) {
    try {
      const { error } = await supabase.rpc("admin_update_booking_status", { p_booking_id: bookingId, p_status: "CONFIRMED" });

      if (error) throw error;

      toast.success("Agendamento confirmado!");
      fetchBookings();
    } catch (error) {
      toast.error("Erro ao confirmar agendamento");
    }
  }

  // Retorna badge de status para a tabela
  function getStatusBadge(status: string) {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      PENDING_PAYMENT: { variant: "outline", label: "Pendente" },
      CONFIRMED: { variant: "default", label: "Confirmado" },
      COMPLETED: { variant: "secondary", label: "Concluído" },
      CANCELED: { variant: "destructive", label: "Cancelado" },
    };
    const config = variants[status] || { variant: "outline" as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  }

  // Filtra agendamentos por dia
  function getBookingsForDate(date: Date) {
    return bookings.filter((booking) =>
      isSameDay(new Date(booking.booking_date), date)
    );
  }

  // Retorna dias do mês que possuem agendamentos
  function getDaysWithBookings() {
    return bookings.map((booking) => new Date(booking.booking_date));
  }

  const selectedDateBookings = getBookingsForDate(selectedDate);

  function handlePreviousMonth() {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() - 1);
    setCurrentMonth(newDate);
  }

  function handleNextMonth() {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + 1);
    setCurrentMonth(newDate);
  }

  function handleToday() {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(today);
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Agenda</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie seus agendamentos e bloqueios
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Bloquear Período
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Bloqueio</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="start">Data/Hora Início</Label>
                  <Input
                    id="start"
                    type="datetime-local"
                    value={newBlock.start_datetime}
                    onChange={(e) =>
                      setNewBlock({ ...newBlock, start_datetime: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="end">Data/Hora Fim</Label>
                  <Input
                    id="end"
                    type="datetime-local"
                    value={newBlock.end_datetime}
                    onChange={(e) =>
                      setNewBlock({ ...newBlock, end_datetime: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="reason">Motivo</Label>
                  <Textarea
                    id="reason"
                    placeholder="Férias, folga, etc."
                    value={newBlock.reason}
                    onChange={(e) =>
                      setNewBlock({ ...newBlock, reason: e.target.value })
                    }
                  />
                </div>
                <Button onClick={handleCreateBlock} className="w-full">
                  Criar Bloqueio
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar View */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5" />
                  {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleToday}>
                    Hoje
                  </Button>
                  <Button variant="ghost" size="icon" onClick={handlePreviousMonth}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={handleNextMonth}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                locale={ptBR}
                month={currentMonth}
                onMonthChange={setCurrentMonth}
                className="rounded-md border w-full"
                modifiers={{
                  booked: getDaysWithBookings(),
                }}
                modifiersClassNames={{
                  booked: "bg-primary/10 font-bold",
                }}
              />
              <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary/10 border border-primary/20" />
                  <span>Dias com agendamentos</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Selected Day Bookings */}
          <Card>
            <CardHeader>
              <CardTitle>
                {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {selectedDateBookings.length} agendamento(s)
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {selectedDateBookings.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8 text-sm">
                    Nenhum agendamento neste dia
                  </p>
                ) : (
                  selectedDateBookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {booking.booking_time.slice(0, 5)}
                          </span>
                          {getStatusBadge(booking.status)}
                        </div>
                      </div>
                      <p className="font-medium">{booking.customer_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {booking.services?.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {booking.customer_whatsapp}
                      </p>
                      {booking.cancellation_requested_at && (
                        <p className="mt-2 text-xs font-medium text-destructive">Cancelamento solicitado pelo cliente</p>
                      )}
                      
                      {/* Ações do Admin */}
                      {booking.status !== "CANCELED" && booking.status !== "COMPLETED" && (
                        <div className="flex gap-2 mt-3">
                          {booking.status === "PENDING_PAYMENT" && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleConfirmBooking(booking.id)}
                            >
                              <Check className="w-3 h-3 mr-1" />
                              Confirmar
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setCancelDialog({ open: true, booking })}
                          >
                            <X className="w-3 h-3 mr-1" />
                            Cancelar
                          </Button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Blocks Section */}
        <Card>
          <CardHeader>
            <CardTitle>Bloqueios Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {blocks.length === 0 ? (
                <p className="text-muted-foreground text-center py-4 col-span-full">
                  Nenhum bloqueio ativo
                </p>
              ) : (
                blocks.map((block) => (
                  <div
                    key={block.id}
                    className="flex items-start justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{block.reason}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {format(new Date(block.start_datetime), "dd/MM/yyyy HH:mm", {
                          locale: ptBR,
                        })}{" "}
                        até{" "}
                        {format(new Date(block.end_datetime), "dd/MM/yyyy HH:mm", {
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteBlock(block.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Cancelamento */}
      <AlertDialog open={cancelDialog.open} onOpenChange={(open) => setCancelDialog({ ...cancelDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Agendamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar o agendamento de "{cancelDialog.booking?.customer_name}" 
              para {cancelDialog.booking?.services?.name}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelBooking} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Cancelar Agendamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
