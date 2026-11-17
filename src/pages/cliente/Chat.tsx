import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { premiumDb, type ProfessionalPublic } from "@/lib/premium-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Send, ArrowLeft, LogOut } from "lucide-react";

type Message={id:string;conversation_id:string;content:string;sender_type:string;created_at:string};
type Conversation={id:string;customer_name:string;professional_id:string|null;last_message_at:string|null};

export default function ClienteChat() {
  const navigate=useNavigate();
  const [userId,setUserId]=useState("");
  const [loading,setLoading]=useState(true);
  const [conversations,setConversations]=useState<Conversation[]>([]);
  const [professionals,setProfessionals]=useState<ProfessionalPublic[]>([]);
  const [selectedId,setSelectedId]=useState("");
  const [selectedProfessional,setSelectedProfessional]=useState("");
  const [messages,setMessages]=useState<Message[]>([]);
  const [text,setText]=useState("");
  const [sending,setSending]=useState(false);
  const [error,setError]=useState("");

  const loadConversations=useCallback(async(uid:string)=>{
    const [list,people]=await Promise.all([
      premiumDb.from("conversations").select("id,customer_name,professional_id,last_message_at").eq("user_id",uid).order("last_message_at",{ascending:false}),
      premiumDb.rpc("list_booking_professionals")
    ]);
    if(list.error)throw list.error;
    setConversations((list.data||[]) as Conversation[]);
    if(!people.error)setProfessionals((people.data||[]) as ProfessionalPublic[]);
  },[]);
  useEffect(()=>{
    let active=true;
    void (async()=>{
      const {data:{user}}=await supabase.auth.getUser();
      if(!user){navigate("/cliente");return;}
      if(!active)return;
      setUserId(user.id);
      try{await loadConversations(user.id);}catch(e){if(active)setError(e instanceof Error?e.message:"Não foi possível carregar conversas");}
      finally{if(active)setLoading(false);}
    })();
    return()=>{active=false;};
  },[navigate,loadConversations]);

  useEffect(()=>{
    if(!selectedId)return;
    let active=true;
    const refresh=async()=>{
      const {data,error:err}=await premiumDb.from("messages")
        .select("id,conversation_id,content,sender_type,created_at")
        .eq("conversation_id",selectedId).order("created_at",{ascending:true}).limit(200);
      if(err){if(active)toast.error("Não foi possível carregar as mensagens");return;}
      if(active)setMessages((data||[]) as Message[]);
    };
    void refresh();
    const ch=supabase.channel(`cliente-chat-${selectedId}`)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:`conversation_id=eq.${selectedId}`},()=>void refresh())
      .subscribe();
    return()=>{active=false;void supabase.removeChannel(ch);};
  },[selectedId]);

  async function startChat(){
    setSending(true);
    try{
      let conversationId:string;
      if(selectedProfessional){
        const {data,error:err}=await premiumDb.rpc("start_professional_conversation",{p_professional_id:selectedProfessional});
        if(err)throw err;
        conversationId=String(data);
      }else{
        // Compatibilidade com a instalação antiga, ainda sem equipe inicializada.
        const {data:profile,error:profErr}=await supabase.from("profiles")
          .select("full_name,phone").eq("id",userId).single();
        if(profErr||!profile?.full_name)throw new Error("Complete seu perfil antes de iniciar conversa.");
        const {data,error:err}=await premiumDb.from("conversations")
          .insert({user_id:userId,customer_name:profile.full_name,customer_whatsapp:profile.phone||""})
          .select("id").single();
        if(err)throw err;
        conversationId=String(data.id);
      }
      await loadConversations(userId);
      setSelectedId(conversationId);
    }catch(e){
      toast.error(e instanceof Error?e.message:"Não foi possível iniciar conversa");
    }finally{setSending(false);}
  }

  async function send(e:React.FormEvent){
    e.preventDefault();
    if(!text.trim()||!selectedId)return;
    setSending(true);
    try{
      const {error:err}=await premiumDb.from("messages").insert({
        conversation_id:selectedId,sender_type:"customer",content:text.trim(),status:"sent"
      });
      if(err)throw err;
      setText("");
      const {data}=await premiumDb.from("messages").select("id,conversation_id,content,sender_type,created_at")
        .eq("conversation_id",selectedId).order("created_at",{ascending:true}).limit(200);
      setMessages((data||[]) as Message[]);
    }catch(e){toast.error(e instanceof Error?e.message:"Mensagem não enviada");}
    finally{setSending(false);}
  }

  const professionalName=(id:string|null)=>professionals.find(p=>p.id===id)?.display_name||"Atendimento";
  return <main className="min-h-screen bg-background px-4 py-8">
    <div className="mx-auto max-w-4xl space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div><h1 className="text-3xl font-bold">Mensagens</h1>
          <p className="text-sm text-muted-foreground">Converse separadamente com o profissional responsável.</p></div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={()=>navigate("/cliente")}><ArrowLeft className="mr-1 h-4 w-4"/>Voltar</Button>
          <Button variant="ghost" size="sm" onClick={()=>void supabase.auth.signOut().then(()=>navigate("/cliente"))}><LogOut className="mr-1 h-4 w-4"/>Sair</Button>
        </div>
      </header>
      {loading&&<p role="status">Carregando…</p>}
      {error&&<p role="alert" className="text-destructive">{error}</p>}
      {!loading&&<div className="grid gap-4 md:grid-cols-[250px_1fr]">
        <Card><CardHeader><CardTitle className="text-lg">Atendimentos</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {conversations.length===0&&<p className="text-sm text-muted-foreground">Nenhuma conversa iniciada.</p>}
            {conversations.map(c=><Button key={c.id} variant={selectedId===c.id?"default":"outline"} className="w-full justify-start" onClick={()=>setSelectedId(c.id)}>
              {professionalName(c.professional_id)}</Button>)}
            <div className="space-y-2 border-t pt-3">
              <Label htmlFor="newProfessional">Nova conversa</Label>
              {professionals.length>0&&<select id="newProfessional" className="w-full rounded-md border bg-background p-2" value={selectedProfessional} onChange={e=>setSelectedProfessional(e.target.value)}>
                <option value="">Selecione o profissional</option>
                {professionals.map(p=><option key={p.id} value={p.id}>{p.display_name}</option>)}
              </select>}
              <Button className="w-full" onClick={startChat} disabled={sending||(professionals.length>0&&!selectedProfessional)}>Iniciar conversa</Button>
            </div>
          </CardContent>
        </Card>
        <Card className="flex min-h-[460px] flex-col"><CardHeader><CardTitle className="text-lg">{selectedId?professionalName(conversations.find(c=>c.id===selectedId)?.professional_id||null):"Selecione uma conversa"}</CardTitle></CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3">
            <ScrollArea className="h-[360px] rounded-md border p-3">
              {messages.map(m=><div key={m.id} className={`mb-3 flex ${m.sender_type==="customer"?"justify-end":"justify-start"}`}>
                <div className={`max-w-[85%] rounded-lg p-3 text-sm ${m.sender_type==="customer"?"bg-primary text-primary-foreground":"bg-muted"}`}>
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  <p className="mt-1 text-right text-xs opacity-70">{new Date(m.created_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</p>
                </div>
              </div>)}
              {selectedId&&messages.length===0&&<p className="text-sm text-muted-foreground">Inicie a conversa enviando uma mensagem.</p>}
            </ScrollArea>
            <form onSubmit={send} className="flex gap-2">
              <Input aria-label="Mensagem" value={text} onChange={e=>setText(e.target.value)} placeholder="Escreva sua mensagem..." disabled={!selectedId||sending} maxLength={2000} />
              <Button type="submit" disabled={!selectedId||sending||!text.trim()} aria-label="Enviar mensagem"><Send className="h-4 w-4"/></Button>
            </form>
          </CardContent>
        </Card>
      </div>}
    </div>
  </main>;
}
