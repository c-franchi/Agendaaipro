import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { generatePixPayload, generatePixQRCode, PixPayload } from "@/utils/pix";
import { validateToken } from "@/utils/token";
import { Copy, Download, ArrowLeft, CheckCircle } from "lucide-react";

export default function Pagar() {
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get("booking");
  const token = searchParams.get("token");
  
  const [booking, setBooking] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [pixCode, setPixCode] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [loading, setLoading] = useState(true);

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
        services (name)
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
    setSettings(settingsData);

    // Gerar Pix
    if (settingsData) {
      const pixPayload: PixPayload = {
        chavePix: settingsData.pix_chave || "",
        nomeRecebedor: settingsData.pix_nome_recebedor || "",
        cidade: settingsData.pix_cidade || "",
        valor: Number(bookingData.price),
        txid: bookingData.id.slice(0, 8)
      };

      const payload = generatePixPayload(pixPayload);
      setPixCode(payload);

      const qrCode = await generatePixQRCode(payload);
      setQrCodeUrl(qrCode);
    }

    setLoading(false);
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

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container mx-auto px-4 max-w-2xl">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Link>

        <h1 className="text-4xl font-bold mb-8 text-foreground text-center">Pagamento via Pix</h1>

        <Card className="p-6 bg-card mb-6">
          <h2 className="text-xl font-bold mb-4 text-foreground">Resumo do Agendamento</h2>
          <div className="space-y-2 text-muted-foreground">
            <p><strong className="text-foreground">Serviço:</strong> {booking.services?.name}</p>
            <p><strong className="text-foreground">Data:</strong> {new Date(booking.booking_date + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
            <p><strong className="text-foreground">Horário:</strong> {booking.booking_time}</p>
            <p><strong className="text-foreground">Cliente:</strong> {booking.customer_name}</p>
            <p className="text-2xl font-bold text-primary pt-2">
              R$ {parseFloat(booking.price).toFixed(2)}
            </p>
          </div>
        </Card>

        <Card className="p-6 bg-card">
          <h2 className="text-xl font-bold mb-4 text-foreground text-center">Escaneie o QR Code</h2>
          
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

            <Button
              onClick={() => {
                window.open(`https://wa.me/${settings?.whatsapp_business_number || ''}?text=Olá! Realizei o pagamento do agendamento ${booking.id}`, '_blank');
              }}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Já Paguei - Enviar Comprovante
            </Button>
          </div>

          <p className="text-sm text-muted-foreground text-center mt-4">
            Após realizar o pagamento, envie o comprovante pelo WhatsApp para confirmarmos seu agendamento.
          </p>
        </Card>
      </div>
    </div>
  );
}
