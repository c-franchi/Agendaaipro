import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { generateBookingToken } from "@/utils/token";
import { scheduleNotification } from "@/utils/pwa";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function Agendar() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [services, setServices] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerWhatsapp, setCustomerWhatsapp] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadServices();
  }, []);

  useEffect(() => {
    if (selectedDate && selectedService) {
      loadAvailableSlots();
    }
  }, [selectedDate, selectedService]);

  async function loadServices() {
    const { data } = await supabase
      .from("services")
      .select("*")
      .eq("is_active", true);
    setServices(data || []);
  }

  async function loadAvailableSlots() {
    if (!selectedDate || !selectedService) return;

    const weekday = selectedDate.getDay();
    const dateStr = selectedDate.toISOString().split('T')[0];

    // Buscar regras de disponibilidade
    const { data: rules } = await supabase
      .from("availability_rules")
      .select("*")
      .eq("weekday", weekday)
      .eq("is_active", true)
      .single();

    if (!rules) {
      setAvailableSlots([]);
      return;
    }

    // Buscar agendamentos do dia
    const { data: bookings } = await supabase
      .from("bookings")
      .select("booking_time")
      .eq("booking_date", dateStr)
      .in("status", ["PENDING_PAYMENT", "CONFIRMED"]);

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
      
      // Verificar se não está ocupado
      const isBooked = bookings?.some(b => b.booking_time === timeStr);
      if (!isBooked) {
        slots.push(timeStr);
      }
      
      currentMin += rules.slot_min;
    }

    setAvailableSlots(slots);
  }

  async function handleSubmit() {
    if (!selectedService || !selectedDate || !selectedTime || !customerName || !customerWhatsapp) {
      toast.error("Preencha todos os campos");
      return;
    }

    setLoading(true);

    try {
      const token = generateBookingToken(crypto.randomUUID());
      const dateStr = selectedDate.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from("bookings")
        .insert({
          service_id: selectedService.id,
          customer_name: customerName,
          customer_whatsapp: customerWhatsapp,
          booking_date: dateStr,
          booking_time: selectedTime,
          price: selectedService.price,
          token,
          status: "PENDING_PAYMENT"
        })
        .select()
        .single();

      if (error) throw error;

      // Agendar notificação de lembrete
      scheduleNotification(dateStr, selectedTime, customerName);

      toast.success("Agendamento criado! Você receberá uma mensagem no WhatsApp.");
      
      // Redirecionar para pagamento
      navigate(`/pagar?booking=${data.id}&token=${token}`);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao criar agendamento");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container mx-auto px-4 max-w-2xl">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Link>

        <h1 className="text-4xl font-bold mb-8 text-foreground text-center">Agendar Horário</h1>

        {/* Indicador de etapas */}
        <div className="flex justify-center gap-2 mb-8">
          {[1, 2, 3, 4].map((s) => (
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
                      onClick={() => {
                        setSelectedTime(time);
                        setStep(4);
                      }}
                    >
                      {time}
                    </Button>
                  ))}
                </div>
              )}
              <Button variant="outline" className="mt-4" onClick={() => setStep(2)}>
                Voltar
              </Button>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="text-2xl font-bold mb-4 text-foreground">Seus Dados</h2>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome Completo</Label>
                  <Input
                    id="name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Seu nome"
                  />
                </div>
                <div>
                  <Label htmlFor="whatsapp">WhatsApp (com DDD)</Label>
                  <Input
                    id="whatsapp"
                    value={customerWhatsapp}
                    onChange={(e) => setCustomerWhatsapp(e.target.value)}
                    placeholder="11999999999"
                  />
                </div>

                <div className="bg-muted p-4 rounded-lg">
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

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(3)}>
                    Voltar
                  </Button>
                  <Button onClick={handleSubmit} disabled={loading} className="flex-1">
                    {loading ? "Processando..." : "Confirmar Agendamento"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
