import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { premiumDb } from "@/lib/premium-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Send } from "lucide-react";
type Conversation={id:string;customer_name:string;customer_whatsapp:string;last_message_at:string|null;unread_count:number|null};
type Message={id:string;conversation_id:string;sender_type:string;content:string;created_at:string};
export default function ProfissionalChat(){
  const [profId,setProfId]=useState("");
  const [conversations,setConversations]=useState<Conversation[]>([]);
  const [selectedId,setSelectedId]=useState("");
  const [messages,setMessages]=useState<Message[]>([]);
  const [draft,setDraft]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const load=useCallback(async()=>{
    try{
      const {data,error:err}=await premiumDb.rpc("my_professional_id");
      if(err)throw err;
      if(!data)throw Error("Vínculo profissional não encontrado");
      const id=String(data);
      const conv=await premiumDb.from("conversations")
        .select("id,customer_name,customer_whatsapp,last_message_at,unread_count")
        .eq("professional_id",id).eq("archived",false).order("last_message_at",{ascending:false});
      if(conv.error)throw conv.error;
      setProfId(id);setConversations((conv.data||[]) as Conversation[]);setError("");
    }catch(e){setError(e instanceof Error?e.message:"Erro ao buscar conversas");}
  },[]);
  useEffect(()=>{void load();},[load]);
  useEffect(()=>{
    if(!selectedId)return;
    let active=true;
    const refresh=async()=>{
      const {data,error:err}=await premiumDb.from("messages")
        .select("id,conversation_id,sender_type,content,created_at")
        .eq("conversation_id",selectedId).order("created_at",{ascending:true}).limit(200);
      if(!err&&active)setMessages((data||[]) as Message[]);
    };
    void refresh();
    const ch=supabase.channel(`profissional-chat-${selectedId}`)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:`conversation_id=eq.${selectedId}`},()=>void refresh())
      .subscribe();
    return()=>{active=false;void supabase.removeChannel(ch);};
  },[selectedId]);
  async function send(e:React.FormEvent){
    e.preventDefault();if(!draft.trim()||!selectedId)return;
    setBusy(true);
    try{
      const {error:err}=await premiumDb.from("messages").insert({
        conversation_id:selectedId,sender_type:"admin",content:draft.trim(),status:"sent"
      });
      if(err)throw err;
      setDraft("");
      const {data}=await premiumDb.from("messages")
        .select("id,conversation_id,sender_type,content,created_at")
        .eq("conversation_id",selectedId).order("created_at",{ascending:true}).limit(200);
      setMessages((data||[]) as Message[]);
      await load();
    }catch(e){toast.error(e instanceof Error?e.message:"Erro ao enviar resposta");}
    finally{setBusy(false);}
  }
  return <main className="min-h-screen bg-background px-4 py-8">
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h1 className="text-3xl font-bold">Minhas conversas</h1><p className="text-muted-foreground">Somente mensagens dos clientes vinculados à sua área.</p></div>
        <Button asChild variant="outline"><Link to="/profissional">Voltar</Link></Button>
      </div>
      {error&&<p role="alert" className="text-destructive">{error}</p>}
      {profId&&<div className="grid gap-4 md:grid-cols-[280px_1fr]">
        <Card><CardHeader><CardTitle>Clientes</CardTitle><CardDescription>{conversations.length} conversa(s)</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {conversations.length===0&&<p className="text-sm text-muted-foreground">Sem conversas por enquanto.</p>}
            {conversations.map(c=><Button key={c.id} className="w-full justify-between" variant={selectedId===c.id?"default":"outline"} onClick={()=>setSelectedId(c.id)}>
              <span className="truncate">{c.customer_name}</span>
              {(c.unread_count||0)>0&&<span className="ml-1 rounded-full bg-background px-2 text-xs text-foreground">{c.unread_count}</span>}
            </Button>)}
          </CardContent></Card>
        <Card className="flex min-h-[500px] flex-col"><CardHeader><CardTitle>{conversations.find(c=>c.id===selectedId)?.customer_name||"Selecione um cliente"}</CardTitle></CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3">
            <ScrollArea className="h-[370px] rounded-lg border p-3">{messages.map(m=><div key={m.id} className={`mb-2 flex ${m.sender_type==="admin"?"justify-end":"justify-start"}`}>
              <div className={`max-w-[85%] rounded-lg p-3 text-sm ${m.sender_type==="admin"?"bg-primary text-primary-foreground":"bg-muted"}`}>
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                <small className="opacity-70">{new Date(m.created_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</small>
              </div>
            </div>)}</ScrollArea>
            <form onSubmit={send} className="flex gap-2">
              <Input value={draft} onChange={e=>setDraft(e.target.value)} disabled={!selectedId||busy} aria-label="Resposta" placeholder="Responda ao cliente" maxLength={2000}/>
              <Button type="submit" disabled={busy||!selectedId||!draft.trim()} aria-label="Enviar"><Send className="h-4 w-4"/></Button>
            </form>
          </CardContent>
        </Card>
      </div>}
    </div>
  </main>;
}
