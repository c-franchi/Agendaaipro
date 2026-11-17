import { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { premiumDb } from "@/lib/premium-api";
import { supabase } from "@/integrations/supabase/client";

export default function AceitarConvite() {
  const location=useLocation();
  const navigate=useNavigate();
  const [token,setToken]=useState("");
  const [name,setName]=useState("");
  const [specialty,setSpecialty]=useState("");
  const [loading,setLoading]=useState(false);
  const [logged,setLogged]=useState(false);
  useEffect(()=>{
    const params=new URLSearchParams(location.hash.replace(/^#/,""));
    setToken(params.get("token")||"");
    void supabase.auth.getUser().then(({data})=>setLogged(Boolean(data.user)));
  },[location.hash]);

  async function accept(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const {error}=await premiumDb.rpc("accept_business_invitation",{
        p_token:token,p_display_name:name.trim(),p_specialty:specialty.trim()||null,
      });
      if(error) throw error;
      toast.success("Convite aceito! Sua área profissional está pronta para configurar.");
      navigate("/profissional",{replace:true});
    } catch(e) {
      toast.error(e instanceof Error?e.message:"Não foi possível aceitar o convite");
    } finally {setLoading(false);}
  }
  return <main className="min-h-screen bg-background px-4 py-12">
    <Card className="mx-auto max-w-lg">
      <CardHeader><CardTitle>Entrar para a equipe</CardTitle>
        <CardDescription>Convite individual para o AgendaAÍ Pro. A pessoa convidada terá acesso apenas aos próprios atendimentos. Use sua própria conta com e-mail confirmado.</CardDescription></CardHeader>
      <CardContent>
        {!token?<p role="alert">O link de convite está incompleto. Solicite um novo link ao titular.</p>:
        !logged?<div className="space-y-3"><p>Faça login com o e-mail que recebeu o convite. Depois, volte a abrir o mesmo link.</p>
          <Button asChild><Link to="/cliente">Entrar na minha conta</Link></Button></div>:
        <form onSubmit={accept} className="space-y-4">
          <div><Label htmlFor="professionalName">Nome exibido aos clientes</Label><Input id="professionalName" minLength={2} maxLength={100} required value={name} onChange={e=>setName(e.target.value)} /></div>
          <div><Label htmlFor="specialty">Especialidade (opcional)</Label><Input id="specialty" maxLength={100} value={specialty} onChange={e=>setSpecialty(e.target.value)} placeholder="Ex.: manicure e pedicure" /></div>
          <Button type="submit" disabled={loading} className="w-full">{loading?"Validando…":"Aceitar convite e abrir minha área"}</Button>
        </form>}
      </CardContent>
    </Card>
  </main>;
}
