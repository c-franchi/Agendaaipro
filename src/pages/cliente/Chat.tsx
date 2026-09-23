// Sistema desenvolvido por Dev Nei
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Send, LogOut, MessageCircle } from "lucide-react";

interface Message {
  id: string;
  content: string;
  sender_type: string;
  created_at: string;
}

interface Conversation {
  id: string;
  customer_name: string;
}

// Chat do cliente para atendimento com o profissional
export default function ClienteChat() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Verifica sessão e carrega conversa ao iniciar
  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  // Valida autenticação e carrega conversa do cliente
  async function checkAuthAndLoadData() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      toast.error("Você precisa estar logado");
      navigate("/cliente");
      return;
    }

    setUserId(session.user.id);
    await loadConversation(session.user.id);
    setLoading(false);
  }

  // Busca conversa e mensagens do cliente
  async function loadConversation(userId: string) {
    // Get conversation for this user
    const { data: convData } = await supabase
      .from("conversations")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!convData) {
      toast.info("Nenhuma conversa encontrada. Faça um agendamento para iniciar!");
      return;
    }

    setConversation(convData);

    // Load messages
    const { data: messagesData } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", convData.id)
      .order("created_at", { ascending: true });

    setMessages(messagesData || []);

    // Subscribe to new messages
    const channel = supabase
      .channel(`conversation-${convData.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${convData.id}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  // Envia mensagem do cliente para o admin
  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !conversation || sending) return;

    setSending(true);
    try {
      const { error } = await supabase.from("messages").insert({
        conversation_id: conversation.id,
        content: newMessage,
        sender_type: "customer",
      });

      if (error) throw error;

      setNewMessage("");
      toast.success("Mensagem enviada!");
    } catch (error: unknown) {
      console.error(error);
      toast.error("Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  }

  // Realiza logout do cliente
  async function handleLogout() {
    await supabase.auth.signOut();
    toast.success("Logout realizado");
    navigate("/cliente");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto"></div>
        </div>
      </div>
    );
  }

  // Cria uma nova conversa caso não exista
  async function startConversation() {
    if (!userId) return;

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", userId)
        .single();

      if (!profile) {
        toast.error("Complete seu perfil antes de iniciar uma conversa");
        navigate("/cliente/perfil");
        return;
      }

      const { data: newConv, error } = await supabase
        .from("conversations")
        .insert({
          user_id: userId,
          customer_name: profile.full_name || "Cliente",
          customer_whatsapp: profile.phone || "",
        })
        .select()
        .single();

      if (error) throw error;

      setConversation(newConv);
      toast.success("Conversa iniciada!");
    } catch (error: unknown) {
      console.error(error);
      toast.error("Erro ao iniciar conversa");
    }
  }

  if (!conversation) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center">
          <MessageCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Chat com o Profissional</h2>
          <p className="text-muted-foreground mb-6">
            Inicie uma conversa para tirar dúvidas, solicitar reagendamentos ou obter informações.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button onClick={startConversation}>
              <MessageCircle className="w-4 h-4 mr-2" />
              Iniciar Conversa
            </Button>
            <Button variant="outline" onClick={() => navigate("/cliente/agendamentos")}>
              Voltar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback className="bg-primary text-primary-foreground">
              {conversation.customer_name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="font-semibold text-foreground">{conversation.customer_name}</h1>
            <p className="text-sm text-muted-foreground">Chat com o barbeiro</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-2" />
          Sair
        </Button>
      </header>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.sender_type === "customer" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[70%] rounded-lg p-3 ${
                  message.sender_type === "customer"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                <p className="text-sm">{message.content}</p>
                <p className="text-xs mt-1 opacity-70">
                  {new Date(message.created_at).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="border-t border-border bg-card p-4">
        <div className="max-w-4xl mx-auto flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Digite sua mensagem..."
            disabled={sending}
            className="flex-1"
          />
          <Button type="submit" disabled={sending || !newMessage.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
