import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { premiumDb, type BusinessRow, type EntitlementRow, type MemberRow } from "@/lib/premium-api";

type Invitation = { id: string; invited_email: string; expires_at: string; accepted_at: string | null; revoked_at: string | null };
type Professional = { id: string; member_id: string; display_name: string; specialty: string | null };

export default function Equipe() {
  const [busy, setBusy] = useState(false);
  const [business, setBusiness] = useState<BusinessRow | null>(null);
  const [entitlement, setEntitlement] = useState<EntitlementRow | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [profiles, setProfiles] = useState<Professional[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [email, setEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [newInvitationUrl, setNewInvitationUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Entre no sistema para gerenciar a equipe.");
      const { data: b, error: e } = await premiumDb.from("businesses").select("id,name,owner_user_id")
        .eq("owner_user_id", auth.user.id).maybeSingle();
      if (e) throw e;
      setBusiness((b || null) as BusinessRow | null);
      if (!b) {
        setEntitlement(null); setMembers([]); setProfiles([]); setInvites([]); setError(""); return;
      }
      const [ent, team, persons, invitations] = await Promise.all([
        premiumDb.from("business_entitlements").select("plan_key,status,seat_limit,valid_until").eq("business_id",b.id).maybeSingle(),
        premiumDb.from("business_members").select("id,user_id,role,status").eq("business_id",b.id),
        premiumDb.from("professional_profiles").select("id,member_id,display_name,specialty").eq("business_id",b.id),
        premiumDb.from("business_invites").select("id,invited_email,expires_at,accepted_at,revoked_at").eq("business_id",b.id).order("created_at",{ascending:false}),
      ]);
      for (const x of [ent,team,persons,invitations]) if (x.error) throw x.error;
      setEntitlement((ent.data || null) as EntitlementRow | null);
      setMembers((team.data || []) as MemberRow[]);
      setProfiles((persons.data || []) as Professional[]);
      setInvites((invitations.data || []) as Invitation[]);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar a equipe.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  async function bootstrap() {
    if (businessName.trim().length < 2) { toast.error("Informe o nome do negócio"); return; }
    setBusy(true);
    try {
      const { error: e } = await premiumDb.rpc("initialize_business",{p_name:businessName.trim()});
      if (e) throw e;
      toast.success("Negócio vinculado ao titular. Os agendamentos anteriores foram preservados.");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao preparar o negócio");
    } finally { setBusy(false); }
  }

  async function invite() {
    setBusy(true);
    try {
      const { data, error: e } = await premiumDb.rpc("invite_business_professional",{p_email:email.trim()});
      if (e) throw e;
      const payload = data as { token: string };
      const link = `${window.location.origin}/profissional/convite#token=${encodeURIComponent(payload.token)}`;
      setNewInvitationUrl(link);
      setEmail("");
      toast.success("Convite criado. Compartilhe o link somente com a pessoa convidada.");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar convite");
    } finally { setBusy(false); }
  }

  async function revokeInvite(id: string) {
    if (!window.confirm("Deseja cancelar este convite?")) return;
    setBusy(true);
    try {
      const { error: e } = await premiumDb.rpc("revoke_business_invitation",{p_invite_id:id});
      if (e) throw e;
      toast.success("Convite revogado");
      await reload();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao revogar convite"); }
    finally { setBusy(false); }
  }

  async function revokeMember(id: string) {
    if (!window.confirm("Remover acesso deste profissional? Histórico e clientes serão preservados. Não é permitido remover com agendamentos futuros.")) return;
    setBusy(true);
    try {
      const { error: e } = await premiumDb.rpc("revoke_business_professional",{p_member_id:id});
      if (e) throw e;
      toast.success("Acesso do profissional revogado");
      await reload();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao remover acesso"); }
    finally { setBusy(false); }
  }

  const canInvite = entitlement?.plan_key === "premium" &&
    ["active","trialing"].includes(entitlement.status) &&
    entitlement.seat_limit >= 2 &&
    (!entitlement.valid_until || new Date(entitlement.valid_until)>new Date());
  const professional = members.find(m=>m.role==="professional"&&m.status==="active");
  const openInvite = invites.find(i=>!i.accepted_at&&!i.revoked_at&&new Date(i.expires_at)>new Date());
  return <AdminLayout>
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <div><h1 className="text-3xl font-bold">Minha equipe</h1>
        <p className="mt-2 text-muted-foreground">Premium: titular + um profissional com agenda e acesso próprios. Nunca compartilhe a senha do titular.</p>
      </div>
      {loading && <p role="status">Carregando equipe…</p>}
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {!loading && !business && <Card><CardHeader><CardTitle>Preparar seu negócio</CardTitle>
        <CardDescription>Vincula os serviços e agendamentos existentes ao titular. Esse passo não contrata nem ativa o Premium.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="businessName">Nome do estabelecimento</Label>
          <Input id="businessName" value={businessName} maxLength={120} onChange={e=>setBusinessName(e.target.value)} />
          <Button disabled={busy} onClick={bootstrap}>Preparar meu negócio</Button>
        </CardContent></Card>}
      {business && <Card><CardHeader><CardTitle>{business.name}</CardTitle><CardDescription>
        Assinatura de gestão do aplicativo. A cobrança comercial permanece fora deste painel.
      </CardDescription></CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Badge>{entitlement?.plan_key?.toUpperCase() || "Sem concessão"}</Badge>
          <span className="text-sm text-muted-foreground">Estado: {entitlement?.status || "não informado"}</span>
          <span className="text-sm text-muted-foreground">Capacidade: {entitlement?.seat_limit || 1} pessoa(s)</span>
        </CardContent></Card>}
      {business && <Card><CardHeader><CardTitle>Profissionais cadastrados</CardTitle>
        <CardDescription>O titular consulta o negócio todo; o convidado gerencia somente a área dele.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {members.filter(m=>m.status==="active").map(m=>{
            const profile=profiles.find(p=>p.member_id===m.id);
            return <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <div><p className="font-semibold">{profile?.display_name || "Profissional"}</p>
                <p className="text-sm text-muted-foreground">{m.role==="owner"?"Titular":"Profissional adicional"}{profile?.specialty?` · ${profile.specialty}`:""}</p>
              </div>
              {m.role==="professional"&&<Button variant="outline" size="sm" onClick={()=>revokeMember(m.id)} disabled={busy}>Revogar acesso</Button>}
            </div>;
          })}
        </CardContent></Card>}
      {business && <Card><CardHeader><CardTitle>Convidar segunda pessoa</CardTitle>
        <CardDescription>{canInvite?"O convite expira em 72 horas e exige que o convidado entre com o próprio e-mail confirmado.":"Disponível após a ativação do Premium (2 assentos) pelo provisionamento comercial."}</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="inviteEmail">E-mail da pessoa convidada</Label>
          <Input id="inviteEmail" inputMode="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="profissional@exemplo.com" disabled={!canInvite||Boolean(professional)||Boolean(openInvite)||busy} />
          <Button onClick={invite} disabled={!canInvite||Boolean(professional)||Boolean(openInvite)||busy||!email.includes("@")}>Gerar convite seguro</Button>
          {newInvitationUrl && <div className="space-y-2 rounded-md border p-3">
            <Label htmlFor="invitationLink">Link (aparece uma única vez; compartilhe em privado)</Label>
            <Input id="invitationLink" readOnly value={newInvitationUrl} />
            <Button variant="outline" onClick={()=>void navigator.clipboard.writeText(newInvitationUrl).then(()=>toast.success("Link copiado")).catch(()=>toast.error("Selecione e copie o link manualmente"))}>Copiar link</Button>
          </div>}
          {invites.filter(i=>!i.accepted_at&&!i.revoked_at).map(i=><div key={i.id} className="flex flex-wrap justify-between gap-2 rounded-md border p-3 text-sm">
            <span>{i.invited_email} — {new Date(i.expires_at)>new Date()?"Pendente":"Expirado"}</span>
            <Button size="sm" variant="outline" onClick={()=>revokeInvite(i.id)} disabled={busy}>Revogar convite</Button>
          </div>)}
        </CardContent></Card>}
    </div>
  </AdminLayout>;
}
