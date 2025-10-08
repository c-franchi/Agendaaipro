import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Save } from "lucide-react";

interface Settings {
  pix_chave: string;
  pix_nome_recebedor: string;
  pix_cidade: string;
  whatsapp_phone_id: string;
  whatsapp_access_token: string;
  whatsapp_business_number: string;
  cancel_policy_hours: number;
  min_advance_hours: number;
  max_days_ahead: number;
}

interface BarberProfile {
  name: string;
  bio: string;
  years_experience: number;
  avatar_url: string;
}

export default function Configuracoes() {
  const [settings, setSettings] = useState<Settings>({
    pix_chave: "",
    pix_nome_recebedor: "",
    pix_cidade: "",
    whatsapp_phone_id: "",
    whatsapp_access_token: "",
    whatsapp_business_number: "",
    cancel_policy_hours: 24,
    min_advance_hours: 2,
    max_days_ahead: 30,
  });

  const [profile, setProfile] = useState<BarberProfile>({
    name: "",
    bio: "",
    years_experience: 0,
    avatar_url: "",
  });

  useEffect(() => {
    fetchSettings();
    fetchProfile();
  }, []);

  async function fetchSettings() {
    const { data, error } = await supabase
      .from("settings")
      .select("*")
      .single();

    if (error && error.code !== "PGRST116") {
      toast.error("Erro ao carregar configurações");
      return;
    }

    if (data) {
      setSettings({
        pix_chave: data.pix_chave || "",
        pix_nome_recebedor: data.pix_nome_recebedor || "",
        pix_cidade: data.pix_cidade || "",
        whatsapp_phone_id: data.whatsapp_phone_id || "",
        whatsapp_access_token: data.whatsapp_access_token || "",
        whatsapp_business_number: data.whatsapp_business_number || "",
        cancel_policy_hours: data.cancel_policy_hours || 24,
        min_advance_hours: data.min_advance_hours || 2,
        max_days_ahead: data.max_days_ahead || 30,
      });
    }
  }

  async function fetchProfile() {
    const { data, error } = await supabase
      .from("barber_profile")
      .select("*")
      .single();

    if (error && error.code !== "PGRST116") {
      toast.error("Erro ao carregar perfil");
      return;
    }

    if (data) {
      setProfile({
        name: data.name || "",
        bio: data.bio || "",
        years_experience: data.years_experience || 0,
        avatar_url: data.avatar_url || "",
      });
    }
  }

  async function handleSaveSettings() {
    const { data: existing } = await supabase
      .from("settings")
      .select("id")
      .single();

    let error;

    if (existing) {
      ({ error } = await supabase
        .from("settings")
        .update(settings)
        .eq("id", existing.id));
    } else {
      ({ error } = await supabase.from("settings").insert(settings));
    }

    if (error) {
      toast.error("Erro ao salvar configurações");
      return;
    }

    toast.success("Configurações salvas!");
  }

  async function handleSaveProfile() {
    const { data: existing } = await supabase
      .from("barber_profile")
      .select("id")
      .single();

    let error;

    if (existing) {
      ({ error } = await supabase
        .from("barber_profile")
        .update(profile)
        .eq("id", existing.id));
    } else {
      ({ error } = await supabase.from("barber_profile").insert(profile));
    }

    if (error) {
      toast.error("Erro ao salvar perfil");
      return;
    }

    toast.success("Perfil atualizado!");
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-foreground">Configurações</h1>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile">Perfil</TabsTrigger>
            <TabsTrigger value="pix">Pix</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
            <TabsTrigger value="schedule">Agenda</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Perfil do Barbeiro</CardTitle>
                <CardDescription>
                  Informações exibidas na página pública
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={profile.name}
                    onChange={(e) =>
                      setProfile({ ...profile, name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="bio">Biografia</Label>
                  <Textarea
                    id="bio"
                    value={profile.bio}
                    onChange={(e) =>
                      setProfile({ ...profile, bio: e.target.value })
                    }
                    rows={4}
                  />
                </div>
                <div>
                  <Label htmlFor="experience">Anos de Experiência</Label>
                  <Input
                    id="experience"
                    type="number"
                    value={profile.years_experience}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        years_experience: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="avatar">URL da Foto</Label>
                  <Input
                    id="avatar"
                    value={profile.avatar_url}
                    onChange={(e) =>
                      setProfile({ ...profile, avatar_url: e.target.value })
                    }
                    placeholder="https://..."
                  />
                </div>
                <Button onClick={handleSaveProfile}>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Perfil
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pix" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Configurações Pix</CardTitle>
                <CardDescription>
                  Dados para geração do QR Code e Pix Copia e Cola
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="pix_chave">Chave Pix</Label>
                  <Input
                    id="pix_chave"
                    value={settings.pix_chave}
                    onChange={(e) =>
                      setSettings({ ...settings, pix_chave: e.target.value })
                    }
                    placeholder="CPF, CNPJ, email, telefone ou chave aleatória"
                  />
                </div>
                <div>
                  <Label htmlFor="pix_nome">Nome do Recebedor</Label>
                  <Input
                    id="pix_nome"
                    value={settings.pix_nome_recebedor}
                    onChange={(e) =>
                      setSettings({ ...settings, pix_nome_recebedor: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="pix_cidade">Cidade</Label>
                  <Input
                    id="pix_cidade"
                    value={settings.pix_cidade}
                    onChange={(e) =>
                      setSettings({ ...settings, pix_cidade: e.target.value })
                    }
                  />
                </div>
                <Button onClick={handleSaveSettings}>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Pix
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="whatsapp" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>WhatsApp Cloud API</CardTitle>
                <CardDescription>
                  Configurações para envio automático de mensagens
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="wa_phone_id">Phone Number ID</Label>
                  <Input
                    id="wa_phone_id"
                    value={settings.whatsapp_phone_id}
                    onChange={(e) =>
                      setSettings({ ...settings, whatsapp_phone_id: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="wa_token">Access Token</Label>
                  <Input
                    id="wa_token"
                    type="password"
                    value={settings.whatsapp_access_token}
                    onChange={(e) =>
                      setSettings({ ...settings, whatsapp_access_token: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="wa_number">Número do Negócio</Label>
                  <Input
                    id="wa_number"
                    value={settings.whatsapp_business_number}
                    onChange={(e) =>
                      setSettings({ ...settings, whatsapp_business_number: e.target.value })
                    }
                    placeholder="5511999999999"
                  />
                </div>
                <Button onClick={handleSaveSettings}>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar WhatsApp
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schedule" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Regras de Agendamento</CardTitle>
                <CardDescription>
                  Políticas e limitações para clientes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="min_advance">Antecedência Mínima (horas)</Label>
                  <Input
                    id="min_advance"
                    type="number"
                    value={settings.min_advance_hours}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        min_advance_hours: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="max_days">Máximo de Dias Adiante</Label>
                  <Input
                    id="max_days"
                    type="number"
                    value={settings.max_days_ahead}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        max_days_ahead: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="cancel_policy">
                    Política de Cancelamento (horas antes)
                  </Label>
                  <Input
                    id="cancel_policy"
                    type="number"
                    value={settings.cancel_policy_hours}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        cancel_policy_hours: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <Button onClick={handleSaveSettings}>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Regras
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
