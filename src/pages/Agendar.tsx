// Sistema desenvolvido por Dev Nei
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { scheduleNotification } from "@/utils/pwa";
import { ArrowLeft } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type TimeBlock = { start_min: number; duration_min: number; blocked: boolean };
type Service = { id: string; name: string; description: string | null; duration_min: number; price: number; interleaved_blocks: TimeBlock[] | null; allow_in_person_payment: boolean | null };

// Fluxo de agendamento de serviços
export default function Agendar() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<{ full_name: string; phone: string } | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Carrega serviços e dados do cliente ao iniciar
  useEffect(() => {
    loadServices();
    loadUserProfile();
  }, []);

  // Busca perfil do usuário autenticado
  async function loadUserProfile() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", session.user.id)
        .single();
      
      setUserProfile(profile);
    }
  }

  // Atualiza horários disponíveis ao mudar data/serviço
  useEffect(() => {
    if (selectedDate && selectedService) {
      loadAvailableSlots();
    }
  }, [selectedDate, selectedService]);

  // Carrega serviços ativos para o agendamento
  async function loadServices() {
    const { data } = await supabase
      .from("services")
      .select("*")
      .eq("is_active", true);
    setServices(data || []);
  }

  // Calcula horários disponíveis com base nas regras e agendamentos
  async function loadAvailableSlots() {
    if (!selectedDate || !selectedService) return;

    const weekday = selectedDate.getDay();
    const dateStr = formatLocalDate(selectedDate);

    // Buscar regras de disponibilidade
    const { data: rules, error: rulesError } = await supabase
      .from("availability_rules")
      .select("*")
      .eq("weekday", weekday)
      .eq("is_active", true)
      .maybeSingle();

    if (rulesError) {
      console.error("Erro ao buscar regras:", rulesError);
      toast.error("Erro ao carregar horários disponíveis");
      setAvailableSlots([]);
      return;
    }

    if (!rules) {
      console.log("Nenhuma regra encontrada para o dia:", weekday);
      setAvailableSlots([]);
      return;
    }

    // Buscar agendamentos do dia com informações do serviço
    const { data: bookings } = await supabase.rpc("get_booked_slots", { p_booking_date: dateStr });

    // Função auxiliar para verificar conflito entre horários
    // Verifica se um horário conflita com agendamentos existentes
    function hasConflict(newTime: string, newService: Pick<Service, "duration_min" | "interleaved_blocks">): boolean {
      if (!bookings) return false;

      const newTimeMin = timeToMinutes(newTime);
      const newBlocks = getOccupiedBlocks(newTimeMin, newService);

      for (const booking of bookings) {
        const bookingTimeMin = timeToMinutes(booking.booking_time);
        const bookingService = booking;
        const bookingBlocks = getOccupiedBlocks(bookingTimeMin, bookingService);

        // Verificar sobreposição entre blocos ocupados
        for (const newBlock of newBlocks) {
          for (const existingBlock of bookingBlocks) {
            if (blocksOverlap(newBlock, existingBlock)) {
              return true;
            }
          }
        }
      }

      return false;
    }

    // Converter string de tempo para minutos desde meia-noite
    // Converte HH:mm para minutos desde meia-noite
    function timeToMinutes(time: string): number {
      const [hour, min] = time.split(':').map(Number);
      return hour * 60 + min;
    }

    // Obter blocos de tempo ocupados para um agendamento
    // Retorna blocos ocupados conforme duração/intercalação do serviço
    function getOccupiedBlocks(startMin: number, service: Pick<Service, "duration_min" | "interleaved_blocks">): Array<{start: number, end: number}> {
      const blocks: Array<{start: number, end: number}> = [];
      
      if (service?.interleaved_blocks) {
        // Serviço com bloqueios intercalados
        const interleavedBlocks = service.interleaved_blocks;
        for (const block of interleavedBlocks) {
          if (block.blocked) {
            blocks.push({
              start: startMin + block.start_min,
              end: startMin + block.start_min + block.duration_min
            });
          }
        }
      } else {
        // Serviço normal - ocupa todo o tempo
        blocks.push({
          start: startMin,
          end: startMin + (service?.duration_min || 0)
        });
      }
      
      return blocks;
    }

    // Verificar se dois blocos se sobrepõem
    // Determina se dois blocos de tempo se sobrepõem
    function blocksOverlap(block1: {start: number, end: number}, block2: {start: number, end: number}): boolean {
      return block1.start < block2.end && block2.start < block1.end;
    }

    // Gerar slots
    const slots: string[] = [];
    const [openHour, openMin] = rules.open_time.split(':').map(Number);
    const [closeHour, closeMin] = rules.close_time.split(':').map(Number);
    
    let currentMin = openHour * 60 + openMin;
    const endMin = closeHour * 60 + closeMin;
    
    while (currentMin < endMin) {
      const hour = Math.floor(currentMin / 60);
      const min = currentMin % 60;
      const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      
      // Verificar se não há conflito
      if (currentMin + selectedService.duration_min <= endMin && !hasConflict(timeStr, selectedService)) {
        slots.push(timeStr);
      }
      
      currentMin += rules.slot_min;
    }

    setAvailableSlots(slots);
  }

  // Valida dados antes de abrir o modal de confirmação
  async function handleConfirmBooking() {
    if (!selectedService || !selectedDate || !selectedTime) {
      toast.error("Selecione o serviço, data e horário");
      return;
    }

    if (!userProfile?.full_name || !userProfile?.phone) {
      toast.error("Complete seu perfil antes de agendar");
      navigate("/cliente/perfil");
      return;
    }

    setShowConfirmDialog(true);
  }

  // Persiste o agendamento e dispara notificações
  async function handleSubmit() {
    setShowConfirmDialog(false);
    setLoading(true);

    try {
      if (!selectedDate || !selectedService || !userProfile) throw new Error("Dados incompletos");
      const dateStr = formatLocalDate(selectedDate);

      const phone = userProfile.phone.replace(/\D/g, "");
      const { data, error } = await supabase.rpc("create_booking", {
        p_service_id: selectedService.id,
        p_customer_name: userProfile.full_name,
        p_customer_whatsapp: phone,
        p_booking_date: dateStr,
        p_booking_time: selectedTime,
      });

      if (error) throw error;
      const result = data as { booking_id: string; access_token: string; requires_payment: boolean };

      scheduleNotification(dateStr, selectedTime, userProfile.full_name);

      toast.success("Solicitação criada. Escolha a forma de pagamento.");
      navigate(`/pagar?booking=${result.booking_id}&token=${result.access_token}`);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Erro ao criar agendamento");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container mx-auto px-4 max-w-2xl">
        <button 
          onClick={() => navigate(-1)} 
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        <h1 className="text-4xl font-bold mb-8 text-foreground text-center">Agendar Horário</h1>

        <div className="flex justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`w-3 h-3 rounded-full ${
                s === step ? "bg-primary" : s < step ? "bg-primary/50" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <Card className="p-6 bg-card">
          {step === 1 && (
            <div>
              <h2 className="text-2xl font-bold mb-4 text-foreground">Escolha o Serviço</h2>
              <div className="space-y-3">
                {services.map((service) => (
                  <Card
                    key={service.id}
                    className={`p-4 cursor-pointer border-2 transition-colors ${
                      selectedService?.id === service.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => {
                      setSelectedService(service);
                      setStep(2);
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-bold text-foreground">{service.name}</h3>
                        <p className="text-sm text-muted-foreground">{service.duration_min} minutos</p>
                      </div>
                      <p className="text-xl font-bold text-primary">R$ {parseFloat(service.price).toFixed(2)}</p>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-2xl font-bold mb-4 text-foreground">Escolha a Data</h2>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  setSelectedDate(date);
                  if (date) setStep(3);
                }}
                disabled={(date) => date < new Date() || date.getDay() === 0}
                className="rounded-md border border-border"
              />
              <Button variant="outline" className="mt-4" onClick={() => setStep(1)}>
                Voltar
              </Button>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-2xl font-bold mb-4 text-foreground">Escolha o Horário</h2>
              {availableSlots.length === 0 ? (
                <p className="text-muted-foreground">Nenhum horário disponível para esta data.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {availableSlots.map((time) => (
                    <Button
                      key={time}
                      variant={selectedTime === time ? "default" : "outline"}
                      onClick={() => setSelectedTime(time)}
                    >
                      {time}
                    </Button>
                  ))}
                </div>
              )}
              
              {selectedTime && (
                <div className="mt-6 bg-muted p-4 rounded-lg">
                  <h3 className="font-bold mb-2 text-foreground">Resumo do Agendamento</h3>
                  <p className="text-sm text-muted-foreground">
                    <strong>Serviço:</strong> {selectedService?.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <strong>Data:</strong> {selectedDate?.toLocaleDateString('pt-BR')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <strong>Horário:</strong> {selectedTime}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <strong>Valor:</strong> R$ {parseFloat(selectedService?.price || 0).toFixed(2)}
                  </p>
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={() => setStep(2)}>
                  Voltar
                </Button>
                {selectedTime && (
                  <Button onClick={handleConfirmBooking} className="flex-1">
                    Confirmar Agendamento
                  </Button>
                )}
              </div>
            </div>
          )}
        </Card>

        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Agendamento</AlertDialogTitle>
              <AlertDialogDescription>
                <div className="space-y-2 mt-4">
                  <p><strong>Serviço:</strong> {selectedService?.name}</p>
                  <p><strong>Data:</strong> {selectedDate?.toLocaleDateString('pt-BR')}</p>
                  <p><strong>Horário:</strong> {selectedTime}</p>
                  <p><strong>Valor:</strong> R$ {parseFloat(selectedService?.price || 0).toFixed(2)}</p>
                  <p className="mt-4"><strong>Cliente:</strong> {userProfile?.full_name}</p>
                  <p><strong>WhatsApp:</strong> {userProfile?.phone}</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleSubmit} disabled={loading}>
                {loading ? "Processando..." : "Confirmar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
