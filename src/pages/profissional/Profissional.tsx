import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { premiumDb, formatBRL } from "@/lib/premium-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Service = { id:string; name:string; description:string|null; duration_min:number; price:number; is_active:boolean };
type Booking = { id:string; customer_name:string; booking_date:string; booking_time:string; status:string; price:number; receipt_url:string|null; payment_method:string|null; services?:{name:string}|null };
type Rule = { weekday:number; open_time:string; close_time:string; slot_min:number; is_active:boolean };
type Block = { id:string; start_datetime:string; end_datetime:string; reason:string|null };
type Profile = { id:string; business_id:string; display_name:string; specialty:string|null };
const weekdays=["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
const defaultRules:Rule[]=weekdays.map((_,weekday)=>({weekday,open_time:"09:00",close_time:"18:00",slot_min:20,is_active:weekday!==0}));
const time=(value:string)=>value.slice(0,5);

export default function Profissional() {
  const [profile,setProfile]=useState<Profile|null>(null);
  const [services,setServices]=useState<Service[]>([]);
  const [bookings,setBookings]=useState<Booking[]>([]);
  const [rules,setRules]=useState<Rule[]>(defaultRules);
  const [blocks,setBlocks]=useState<Block[]>([]);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [newService,setNewService]=useState({name:"",description:"",duration_min:30,price:0});
  const [editingServiceId,setEditingServiceId]=useState("");
  const [block,setBlock]=useState({start_datetime:"",end_datetime:"",reason:"Indisponível"});

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const {data:auth}=await supabase.auth.getUser();
      if(!auth.user) throw new Error("Entre na sua conta para acessar a área profissional.");
      const me=await premiumDb.rpc("my_professional_id");
      if(me.error) throw me.error;
      const id=me.data as string|null;
      if(!id) throw new Error("Conta sem vínculo profissional ativo. Aceite o convite enviado pelo titular.");
      const prof=await premiumDb.from("professional_profiles").select("id,business_id,display_name,specialty").eq("id",id).single();
      if(prof.error) throw prof.error;
      const p=prof.data as Profile;
      const results=await Promise.all([
        premiumDb.from("services").select("id,name,description,duration_min,price,is_active").eq("professional_id",id).order("name"),
        premiumDb.from("bookings").select("id,customer_name,booking_date,booking_time,status,price,receipt_url,payment_method,services(name)")
          .eq("professional_id",id).gte("booking_date",new Date().toISOString().slice(0,10)).order("booking_date").order("booking_time").limit(100),
        premiumDb.from("availability_rules").select("weekday,open_time,close_time,slot_min,is_active").eq("professional_id",id).order("weekday"),
        premiumDb.from("blocks").select("id,start_datetime,end_datetime,reason").eq("professional_id",id).gte("end_datetime",new Date().toISOString()).order("start_datetime"),
      ]);
      for(const result of results) if(result.error) throw result.error;
      setProfile(p);
      setServices((results[0].data||[]) as Service[]);
      setBookings((results[1].data||[]) as unknown as Booking[]);
      const saved=(results[2].data||[]) as Rule[];
      setRules(defaultRules.map(d=>{ const matches=saved.filter(s=>s.weekday===d.weekday); return matches[matches.length-1]||d; }));
      setBlocks((results[3].data||[]) as Block[]);
      setError("");
    }catch(e){
      setError(e instanceof Error?e.message:"Erro ao carregar sua agenda.");
    }finally{setLoading(false);}
  },[]);

  useEffect(()=>{void load();},[load]);

  async function saveService(e:React.FormEvent){
    e.preventDefault();
    if(!profile) return;
    setBusy(true);
    try{
      const payload={
        name:newService.name.trim(),description:newService.description.trim()||null,
        duration_min:newService.duration_min,price:newService.price,
      };
      const {error:err}=editingServiceId
        ? await premiumDb.from("services").update(payload).eq("id",editingServiceId).eq("professional_id",profile.id)
        : await premiumDb.from("services").insert({
          ...payload,business_id:profile.business_id,professional_id:profile.id,
          is_active:true,allow_in_person_payment:false,
        });
      if(err) throw err;
      setNewService({name:"",description:"",duration_min:30,price:0});
      setEditingServiceId("");
      toast.success(editingServiceId?"Serviço atualizado":"Serviço cadastrado");
      await load();
    }catch(e){toast.error(e instanceof Error?e.message:"Não foi possível salvar o serviço");}
    finally{setBusy(false);}
  }

  async function toggleService(service:Service){
    setBusy(true);
    try{
      const {error:err}=await premiumDb.from("services").update({is_active:!service.is_active})
        .eq("id",service.id).eq("professional_id",profile!.id);
      if(err) throw err;
      await load();
    }catch(e){toast.error(e instanceof Error?e.message:"Falha ao atualizar serviço");}
    finally{setBusy(false);}
  }

  async function saveRules(){
    setBusy(true);
    try{
      const payload=rules.map(r=>({...r,open_time:time(r.open_time),close_time:time(r.close_time)}));
      const {error:err}=await premiumDb.rpc("save_professional_availability",{p_rules:payload});
      if(err) throw err;
      toast.success("Expediente salvo");
      await load();
    }catch(e){toast.error(e instanceof Error?e.message:"Erro ao salvar expediente");}
    finally{setBusy(false);}
  }

  async function createBlock(e:React.FormEvent){
    e.preventDefault();
    if(!profile) return;
    if(new Date(block.start_datetime)>=new Date(block.end_datetime)){toast.error("O início deve ser antes do término");return;}
    setBusy(true);
    try{
      const {error:err}=await premiumDb.from("blocks").insert({
        business_id:profile.business_id,professional_id:profile.id,
        start_datetime:new Date(block.start_datetime).toISOString(),
        end_datetime:new Date(block.end_datetime).toISOString(),
        reason:block.reason.trim()||"Indisponível",
      });
      if(err) throw err;
      setBlock({start_datetime:"",end_datetime:"",reason:"Indisponível"});
      toast.success("Bloqueio cadastrado");
      await load();
    }catch(e){toast.error(e instanceof Error?e.message:"Erro ao cadastrar bloqueio");}
    finally{setBusy(false);}
  }
  async function deleteBlock(id:string){
    setBusy(true);
    try{
      const {error:err}=await premiumDb.from("blocks").delete().eq("id",id).eq("professional_id",profile!.id);
      if(err) throw err;
      await load();
    }catch(e){toast.error(e instanceof Error?e.message:"Erro ao remover bloqueio");}
    finally{setBusy(false);}
  }
  async function viewReceipt(receiptPath:string){
    try{
      const {data,error:err}=await supabase.storage.from("payment-receipts").createSignedUrl(receiptPath,300);
      if(err||!data?.signedUrl)throw err||new Error("Comprovante indisponível");
      window.open(data.signedUrl,"_blank","noopener,noreferrer");
    }catch(e){toast.error(e instanceof Error?e.message:"Erro ao abrir comprovante");}
  }
  async function updateBooking(id:string,status:"CONFIRMED"|"CANCELED"|"COMPLETED"){
    setBusy(true);
    try{
      const {error:err}=await premiumDb.rpc("professional_update_booking_status",{p_booking_id:id,p_status:status});
      if(err) throw err;
      toast.success("Agendamento atualizado");
      await load();
    }catch(e){toast.error(e instanceof Error?e.message:"Não foi possível alterar o agendamento");}
    finally{setBusy(false);}
  }

  const stats=useMemo(()=>{
    const confirmed=bookings.filter(b=>b.status==="CONFIRMED");
    const completed=bookings.filter(b=>b.status==="COMPLETED");
    return {confirmed:confirmed.length,scheduledValue:confirmed.reduce((n,b)=>n+Number(b.price),0),
      completed:completed.length};
  },[bookings]);

  return <main className="min-h-screen bg-background px-4 py-8">
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-sm text-muted-foreground">AgendaAÍ Pro · Acesso individual</p>
          <h1 className="text-3xl font-bold">{profile?.display_name||"Área profissional"}</h1>
          <p className="text-sm text-muted-foreground">{profile?.specialty||"Agenda, horários, serviços e clientes dos seus atendimentos"}</p>
        </div>
        <div className="flex gap-2"><Button asChild variant="outline"><Link to="/profissional/chat">Mensagens</Link></Button><Button asChild variant="outline"><Link to="/profissional/portfolio">Portfólio</Link></Button><Button asChild variant="outline"><Link to="/profissional/gestao">Estoque e caixa</Link></Button>
          <Button variant="outline" onClick={()=>void supabase.auth.signOut().then(()=>window.location.assign("/cliente"))}>Sair</Button></div>
      </header>
      {loading&&<p role="status">Carregando…</p>}
      {error&&<Card><CardContent className="space-y-3 pt-6"><p role="alert">{error}</p><Button asChild variant="outline"><Link to="/cliente">Entrar na conta</Link></Button></CardContent></Card>}
      {profile&&!loading&&<Tabs defaultValue="agenda" className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="agenda">Agenda</TabsTrigger><TabsTrigger value="servicos">Serviços</TabsTrigger>
          <TabsTrigger value="horarios">Horários</TabsTrigger><TabsTrigger value="financeiro">Resumo</TabsTrigger>
        </TabsList>
        <TabsContent value="agenda" className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Card><CardHeader><CardDescription>Confirmados</CardDescription><CardTitle>{stats.confirmed}</CardTitle></CardHeader></Card>
            <Card><CardHeader><CardDescription>Valor agendado confirmado</CardDescription><CardTitle>{formatBRL(stats.scheduledValue)}</CardTitle></CardHeader></Card>
          </div>
          <Card><CardHeader><CardTitle>Próximos atendimentos</CardTitle></CardHeader><CardContent className="space-y-3">
            {bookings.length===0&&<p className="text-muted-foreground">Nenhum atendimento para os próximos dias.</p>}
            {bookings.map(b=><div key={b.id} className="flex flex-wrap justify-between gap-3 rounded-md border p-3">
              <div><p className="font-semibold">{b.customer_name}</p>
                <p className="text-sm text-muted-foreground">{b.services?.name||"Serviço"} · {b.booking_date.split("-").reverse().join("/")} às {time(b.booking_time)}</p>
                <p className="text-sm">{formatBRL(Number(b.price))} · <Badge variant="outline">{b.status}</Badge></p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
{b.receipt_url&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>void viewReceipt(b.receipt_url!)}>Ver comprovante</Button>}
                {b.status==="PENDING_PAYMENT"&&<Button size="sm" disabled={busy} onClick={()=>updateBooking(b.id,"CONFIRMED")}>Confirmar</Button>}
                {b.status==="CONFIRMED"&&<Button size="sm" disabled={busy} onClick={()=>updateBooking(b.id,"COMPLETED")}>Concluir</Button>}
                {["CONFIRMED","PENDING_PAYMENT"].includes(b.status)&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>updateBooking(b.id,"CANCELED")}>Cancelar</Button>}
              </div>
            </div>)}
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="servicos" className="space-y-4">
          <Card><CardHeader><CardTitle>Meus serviços</CardTitle><CardDescription>Seus preços e serviços não alteram os dos outros profissionais.</CardDescription></CardHeader>
            <CardContent className="space-y-2">{services.map(s=><div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
              <div><p className="font-medium">{s.name}</p><p className="text-sm text-muted-foreground">{s.duration_min} min · {formatBRL(Number(s.price))}</p></div>
              <div className="flex gap-2"><Button variant="outline" size="sm" disabled={busy} onClick={()=>{setEditingServiceId(s.id);setNewService({name:s.name,description:s.description||"",duration_min:s.duration_min,price:Number(s.price)});}}>Editar</Button><Button variant="outline" size="sm" disabled={busy} onClick={()=>toggleService(s)}>{s.is_active?"Desativar":"Ativar"}</Button></div>
            </div>)}</CardContent>
          </Card>
          <Card><CardHeader><CardTitle>{editingServiceId?"Editar serviço":"Adicionar serviço"}</CardTitle></CardHeader><CardContent>
            <form onSubmit={saveService} className="grid gap-3 sm:grid-cols-2">
              <div><Label htmlFor="sName">Serviço</Label><Input id="sName" required maxLength={100} value={newService.name} onChange={e=>setNewService(v=>({...v,name:e.target.value}))}/></div>
              <div><Label htmlFor="sDesc">Descrição</Label><Input id="sDesc" value={newService.description} onChange={e=>setNewService(v=>({...v,description:e.target.value}))}/></div>
              <div><Label htmlFor="sDuration">Duração (minutos)</Label><Input id="sDuration" type="number" min={5} max={720} required value={newService.duration_min} onChange={e=>setNewService(v=>({...v,duration_min:Number(e.target.value)}))}/></div>
              <div><Label htmlFor="sPrice">Preço (R$)</Label><Input id="sPrice" type="number" min={0.01} step={0.01} required value={newService.price} onChange={e=>setNewService(v=>({...v,price:Number(e.target.value)}))}/></div>
              <div className="flex flex-wrap gap-2 sm:col-span-2"><Button type="submit" disabled={busy}>{editingServiceId?"Atualizar serviço":"Salvar serviço"}</Button>{editingServiceId&&<Button type="button" variant="outline" onClick={()=>{setEditingServiceId("");setNewService({name:"",description:"",duration_min:30,price:0});}}>Cancelar edição</Button>}</div>
            </form>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="horarios" className="space-y-4">
          <Card><CardHeader><CardTitle>Meu expediente</CardTitle><CardDescription>Horários individuais. O cliente consulta apenas os seus dias disponíveis.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {rules.map((r,i)=><div key={r.weekday} className="grid grid-cols-[1fr_auto] gap-2 rounded-md border p-3 sm:grid-cols-[1fr_auto_1fr_1fr] sm:items-center">
                <span className="font-medium">{weekdays[r.weekday]}</span>
                <Switch checked={r.is_active} onCheckedChange={checked=>setRules(v=>v.map((x,j)=>j===i?{...x,is_active:checked}:x))} aria-label={`Atender ${weekdays[r.weekday]}`}/>
                <Input aria-label={`Abertura ${weekdays[r.weekday]}`} type="time" value={time(r.open_time)} onChange={e=>setRules(v=>v.map((x,j)=>j===i?{...x,open_time:e.target.value}:x))} />
                <Input aria-label={`Fechamento ${weekdays[r.weekday]}`} type="time" value={time(r.close_time)} onChange={e=>setRules(v=>v.map((x,j)=>j===i?{...x,close_time:e.target.value}:x))} />
              </div>)}
              <Button disabled={busy} onClick={saveRules}>Salvar horários da semana</Button>
            </CardContent>
          </Card>
          <Card><CardHeader><CardTitle>Folgas e bloqueios</CardTitle></CardHeader><CardContent className="space-y-3">
            <form onSubmit={createBlock} className="grid gap-3 sm:grid-cols-3">
              <div><Label htmlFor="blockStart">Início</Label><Input id="blockStart" type="datetime-local" required value={block.start_datetime} onChange={e=>setBlock(v=>({...v,start_datetime:e.target.value}))}/></div>
              <div><Label htmlFor="blockEnd">Fim</Label><Input id="blockEnd" type="datetime-local" required value={block.end_datetime} onChange={e=>setBlock(v=>({...v,end_datetime:e.target.value}))}/></div>
              <div><Label htmlFor="blockReason">Motivo</Label><Input id="blockReason" value={block.reason} onChange={e=>setBlock(v=>({...v,reason:e.target.value}))}/></div>
              <Button type="submit" disabled={busy}>Bloquear horário</Button>
            </form>
            {blocks.map(b=><div key={b.id} className="flex flex-wrap justify-between gap-2 rounded-md border p-3">
              <span>{new Date(b.start_datetime).toLocaleString("pt-BR")} — {new Date(b.end_datetime).toLocaleString("pt-BR")} · {b.reason}</span>
              <Button size="sm" variant="outline" disabled={busy} onClick={()=>deleteBlock(b.id)}>Remover</Button>
            </div>)}
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="financeiro">
          <Card><CardHeader><CardTitle>Meu resumo</CardTitle><CardDescription>Totais de agendamentos futuros, não substituem o livro-caixa e não representam recebimentos reais.</CardDescription></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div><p className="text-sm text-muted-foreground">Atendimentos futuros confirmados</p><p className="text-2xl font-bold">{stats.confirmed}</p></div>
              <div><p className="text-sm text-muted-foreground">Valor futuro confirmado</p><p className="text-2xl font-bold">{formatBRL(stats.scheduledValue)}</p></div>
              <div><p className="text-sm text-muted-foreground">Atendimentos concluídos no período consultado</p><p className="text-2xl font-bold">{stats.completed}</p></div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>}
    </div>
  </main>;
}
