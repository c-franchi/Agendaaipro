import { useState, useEffect, useRef } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { generatePixPayload, generatePixQRCode, PixPayload } from "@/utils/pix";
import { validateToken } from "@/utils/token";
import { Copy, Download, ArrowLeft, CheckCircle, Upload, CreditCard, Banknote } from "lucide-react";

export default function Pagar() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const bookingId = searchParams.get("booking");
  const token = searchParams.get("token");
  
  const [booking, setBooking] = useState<any>(null);
  const [service, setService] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [pixCode, setPixCode] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "presencial" | null>(null);
  const [uploading, setUploading] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (bookingId && token) {
      loadBooking();
    }
  }, [bookingId, token]);

  async function loadBooking() {
    if (!bookingId || !token) return;

    const validation = validateToken(token);
    if (!validation.valid) {
      toast.error("Link expirado ou inválido");
      setLoading(false);
      return;
    }

    const { data: bookingData, error: bookingError } = await supabase
      .from("bookings")
      .select(`
        *,
        services (name, allow_in_person_payment)
      `)
      .eq("id", bookingId)
      .single();

    if (bookingError || !bookingData) {
      toast.error("Agendamento não encontrado");
      setLoading(false);
      return;
    }

    const { data: settingsData } = await supabase
      .from("settings")
      .select("*")
      .single();

    setBooking(bookingData);
    setService(bookingData.services);
    setSettings(settingsData);
    setReceiptUrl(bookingData.receipt_url);
    
    // Se já tem método de pagamento definido, mostrar
    if (bookingData.payment_method) {
      setPaymentMethod(bookingData.payment_method as "pix" | "presencial");
    }

    setLoading(false);
  }

  async function generatePixCode() {
    if (!settings || !booking) return;
    
    const pixPayload: PixPayload = {
      chavePix: settings.pix_chave || "",
      nomeRecebedor: settings.pix_nome_recebedor || "",
      cidade: settings.pix_cidade || "",
      valor: Number(booking.price),
      txid: booking.id.slice(0, 8)
    };

    const payload = generatePixPayload(pixPayload);
    setPixCode(payload);

    const qrCode = await generatePixQRCode(payload);
    setQrCodeUrl(qrCode);
  }

  async function selectPaymentMethod(method: "pix" | "presencial") {
    setPaymentMethod(method);
    
    // Atualizar no banco
    await supabase
      .from("bookings")
      .update({ payment_method: method })
      .eq("id", bookingId);

    if (method === "pix") {
      await generatePixCode();
    }
  }

  function copyPixCode() {
    navigator.clipboard.writeText(pixCode);
    toast.success("Código Pix copiado!");
  }

  function downloadQRCode() {
    const link = document.createElement('a');
    link.href = qrCodeUrl;
    link.download = 'qrcode-pix.png';
    link.click();
  }

  async function handleUploadReceipt(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !bookingId) return;

    setUploading(true);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${bookingId}-${Date.now()}.${fileExt}`;
      const filePath = `receipts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('payment-receipts')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('payment-receipts')
        .getPublicUrl(filePath);

      // Atualizar booking com URL do comprovante
      const { error: updateError } = await supabase
        .from("bookings")
        .update({ 
          receipt_url: filePath,
          status: 'PENDING_PAYMENT' // Aguardando confirmação do admin
        })
        .eq("id", bookingId);

      if (updateError) throw updateError;

      setReceiptUrl(filePath);
      toast.success("Comprovante enviado! Aguarde a confirmação do profissional.");
    } catch (error) {
      console.error('Erro ao enviar comprovante:', error);
      toast.error("Erro ao enviar comprovante");
    } finally {
      setUploading(false);
    }
  }

  async function confirmInPersonPayment() {
    if (!bookingId) return;

    const { error } = await supabase
      .from("bookings")
      .update({ 
        payment_method: 'presencial',
        status: 'CONFIRMED'
      })
      .eq("id", bookingId);

    if (error) {
      toast.error("Erro ao confirmar");
      return;
    }

    toast.success("Agendamento confirmado! Pagamento será realizado presencialmente.");
    navigate("/cliente/agendamentos");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-6 text-center">
          <h2 className="text-2xl font-bold mb-2 text-foreground">Agendamento não encontrado</h2>
          <p className="text-muted-foreground mb-4">Link inválido ou expirado</p>
          <Link to="/">
            <Button>Voltar ao Início</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const allowInPersonPayment = service?.allow_in_person_payment;

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

        <h1 className="text-4xl font-bold mb-8 text-foreground text-center">Pagamento</h1>

        <Card className="p-6 bg-card mb-6">
          <h2 className="text-xl font-bold mb-4 text-foreground">Resumo do Agendamento</h2>
          <div className="space-y-2 text-muted-foreground">
            <p><strong className="text-foreground">Serviço:</strong> {service?.name}</p>
            <p><strong className="text-foreground">Data:</strong> {new Date(booking.booking_date + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
            <p><strong className="text-foreground">Horário:</strong> {booking.booking_time}</p>
            <p><strong className="text-foreground">Cliente:</strong> {booking.customer_name}</p>
            <p className="text-2xl font-bold text-primary pt-2">
              R$ {parseFloat(booking.price).toFixed(2)}
            </p>
          </div>
        </Card>

        {/* Seleção de método de pagamento */}
        {!paymentMethod && (
          <Card className="p-6 bg-card mb-6">
            <h2 className="text-xl font-bold mb-4 text-foreground text-center">Como deseja pagar?</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                variant="outline"
                size="lg"
                className="h-24 flex-col gap-2"
                onClick={() => selectPaymentMethod("pix")}
              >
                <CreditCard className="w-8 h-8" />
                <span>Pagar via Pix</span>
              </Button>
              
              {allowInPersonPayment && (
                <Button
                  variant="outline"
                  size="lg"
                  className="h-24 flex-col gap-2"
                  onClick={() => selectPaymentMethod("presencial")}
                >
                  <Banknote className="w-8 h-8" />
                  <span>Pagamento Presencial</span>
                </Button>
              )}
            </div>
          </Card>
        )}

        {/* Pagamento Pix */}
        {paymentMethod === "pix" && (
          <Card className="p-6 bg-card">
            <h2 className="text-xl font-bold mb-4 text-foreground text-center">Pagamento via Pix</h2>
            
            {qrCodeUrl && (
              <div className="flex justify-center mb-6">
                <img src={qrCodeUrl} alt="QR Code Pix" className="border-4 border-border rounded-lg" />
              </div>
            )}

            <div className="space-y-3">
              <Button
                onClick={copyPixCode}
                variant="outline"
                className="w-full"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copiar Código Pix Copia e Cola
              </Button>

              <Button
                onClick={downloadQRCode}
                variant="outline"
                className="w-full"
              >
                <Download className="w-4 h-4 mr-2" />
                Baixar QR Code
              </Button>

              <div className="border-t pt-4 mt-4">
                <p className="text-sm text-muted-foreground text-center mb-3">
                  Após realizar o pagamento, envie o comprovante:
                </p>
                
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleUploadReceipt}
                  accept="image/*,.pdf"
                  className="hidden"
                />

                {receiptUrl ? (
                  <div className="text-center space-y-2">
                    <div className="bg-primary/10 text-primary p-3 rounded-lg">
                      <CheckCircle className="w-6 h-6 mx-auto mb-2" />
                      <p className="font-medium">Comprovante enviado!</p>
                      <p className="text-sm">Aguardando confirmação do profissional</p>
                    </div>
                  </div>
                ) : (
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full bg-primary hover:bg-primary/90"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploading ? "Enviando..." : "Enviar Comprovante"}
                  </Button>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Pagamento Presencial */}
        {paymentMethod === "presencial" && (
          <Card className="p-6 bg-card">
            <h2 className="text-xl font-bold mb-4 text-foreground text-center">Pagamento Presencial</h2>
            
            <div className="text-center space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <Banknote className="w-12 h-12 mx-auto mb-3 text-primary" />
                <p className="text-foreground font-medium">
                  O pagamento será realizado no dia do atendimento
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Você poderá pagar em dinheiro, cartão ou Pix presencialmente
                </p>
              </div>

              <Button
                onClick={confirmInPersonPayment}
                className="w-full"
                size="lg"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Confirmar Agendamento
              </Button>
            </div>
          </Card>
        )}

        {/* Trocar método de pagamento */}
        {paymentMethod && !receiptUrl && (
          <Button
            variant="link"
            className="w-full mt-4"
            onClick={() => setPaymentMethod(null)}
          >
            Escolher outro método de pagamento
          </Button>
        )}
      </div>
    </div>
  );
}
