import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface Settings {
  pix_chave?: string;
  pix_nome_recebedor?: string;
  pix_cidade?: string;
  whatsapp_business_number?: string;
  whatsapp_phone_id?: string;
  whatsapp_access_token?: string;
  min_advance_hours?: number;
  max_days_ahead?: number;
  cancel_policy_hours?: number;
}

interface BarberProfile {
  name?: string;
  bio?: string;
  avatar_url?: string;
  years_experience?: number;
  socials?: any;
  gallery?: any;
}

interface WeekdaySchedule {
  weekday: number;
  is_active: boolean;
  open_time: string;
  close_time: string;
  slot_min: number;
}

const WEEKDAY_NAMES = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

export default function Configuracoes() {
  const [settings, setSettings] = useState<Settings>({});
  const [profile, setProfile] = useState<BarberProfile>({});
  const [schedules, setSchedules] = useState<WeekdaySchedule[]>([]);

  useEffect(() => {
    fetchSettings();
    fetchProfile();
    fetchSchedules();
  }, []);

  async function fetchSettings() {
    const { data } = await supabase.from("settings").select("*").single();
    if (data) setSettings(data);
  }

  async function fetchProfile() {
    const { data } = await supabase.from("barber_profile").select("*").single();
    if (data) setProfile(data);
  }

  async function fetchSchedules() {
    const { data } = await supabase
      .from("availability_rules")
      .select("*")
      .order("weekday", { ascending: true });

    if (data && data.length > 0) {
      setSchedules(data);
    } else {
      // Inicializar com valores padrão
      const defaultSchedules: WeekdaySchedule[] = Array.from({ length: 7 }, (_, i) => ({
        weekday: i,
        is_active: i !== 0 && i !== 1, // Desativado domingo e segunda por padrão
        open_time: "09:00",
        close_time: "18:00",
        slot_min: 30,
      }));
      setSchedules(defaultSchedules);
    }
  }

  async function handleSaveSettings() {
    const { data: existing } = await supabase.from("settings").select("id").single();
    
    const { error } = existing
      ? await supabase.from("settings").update(settings).eq("id", existing.id)
      : await supabase.from("settings").insert([settings]);

    if (error) {
      toast.error("Erro ao salvar configurações");
      return;
    }

    toast.success("Configurações salvas!");
  }

  async function handleSaveProfile() {
    if (!profile.name) {
      toast.error("Nome é obrigatório");
      return;
    }
    
    const { data: existing } = await supabase.from("barber_profile").select("id").single();
    
    const { error } = existing
      ? await supabase.from("barber_profile").update(profile).eq("id", existing.id)
      : await supabase.from("barber_profile").insert([{ ...profile, name: profile.name }]);

    if (error) {
      toast.error("Erro ao salvar perfil");
      return;
    }

    toast.success("Perfil atualizado!");
  }

  async function handleSaveSchedules() {
    // Deletar todas as regras existentes
    await supabase.from("availability_rules").delete().neq("weekday", -1);

    // Inserir novas regras
    const { error } = await supabase.from("availability_rules").insert(
      schedules.map((s) => ({
        weekday: s.weekday,
        is_active: s.is_active,
        open_time: s.open_time,
        close_time: s.close_time,
        slot_min: s.slot_min,
      }))
    );

    if (error) {
      toast.error("Erro ao salvar horários");
      console.error(error);
      return;
    }

    toast.success("Horários salvos!");
  }

  function updateSchedule(weekday: number, field: keyof WeekdaySchedule, value: any) {
    setSchedules((prev) =>
      prev.map((s) => (s.weekday === weekday ? { ...s, [field]: value } : s))
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie as configurações do sistema
          </p>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile">Perfil</TabsTrigger>
            <TabsTrigger value="schedule">Horários</TabsTrigger>
            <TabsTrigger value="pix">Pix</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Perfil do Barbeiro</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={profile.name || ""}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    placeholder="Nome do barbeiro"
                  />
                </div>
                <div>
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={profile.bio || ""}
                    onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                    placeholder="Descrição profissional"
                  />
                </div>
                <div>
                  <Label htmlFor="years">Anos de Experiência</Label>
                  <Input
                    id="years"
                    type="number"
                    value={profile.years_experience || 0}
                    onChange={(e) =>
                      setProfile({ ...profile, years_experience: parseInt(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="avatar">URL do Avatar</Label>
                  <Input
                    id="avatar"
                    value={profile.avatar_url || ""}
                    onChange={(e) =>
                      setProfile({ ...profile, avatar_url: e.target.value })
                    }
                    placeholder="https://..."
                  />
                </div>
                <Button onClick={handleSaveProfile}>Salvar Perfil</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schedule">
            <Card>
              <CardHeader>
                <CardTitle>Horários de Funcionamento</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Configure os dias e horários que você trabalha
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {schedules.map((schedule) => (
                  <div
                    key={schedule.weekday}
                    className="flex flex-col md:flex-row items-start md:items-center gap-4 p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-3 min-w-[180px]">
                      <Switch
                        checked={schedule.is_active}
                        onCheckedChange={(checked) =>
                          updateSchedule(schedule.weekday, "is_active", checked)
                        }
                      />
                      <span className="font-medium text-foreground">
                        {WEEKDAY_NAMES[schedule.weekday]}
                      </span>
                    </div>

                    {schedule.is_active ? (
                      <>
                        <div className="flex items-center gap-2">
                          <Label className="text-sm text-muted-foreground">Das</Label>
                          <Input
                            type="time"
                            value={schedule.open_time}
                            onChange={(e) =>
                              updateSchedule(schedule.weekday, "open_time", e.target.value)
                            }
                            className="w-28"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <Label className="text-sm text-muted-foreground">às</Label>
                          <Input
                            type="time"
                            value={schedule.close_time}
                            onChange={(e) =>
                              updateSchedule(schedule.weekday, "close_time", e.target.value)
                            }
                            className="w-28"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <Label className="text-sm text-muted-foreground">Intervalo</Label>
                          <Input
                            type="number"
                            value={schedule.slot_min}
                            onChange={(e) =>
                              updateSchedule(
                                schedule.weekday,
                                "slot_min",
                                parseInt(e.target.value)
                              )
                            }
                            className="w-20"
                            min="15"
                            step="5"
                          />
                          <span className="text-sm text-muted-foreground">min</span>
                        </div>
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground italic">
                        Fechado
                      </span>
                    )}
                  </div>
                ))}

                <Button onClick={handleSaveSchedules} className="w-full">
                  Salvar Horários
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pix">
            <Card>
              <CardHeader>
                <CardTitle>Configurações Pix</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="pix_chave">Chave Pix</Label>
                  <Input
                    id="pix_chave"
                    value={settings.pix_chave || ""}
                    onChange={(e) =>
                      setSettings({ ...settings, pix_chave: e.target.value })
                    }
                    placeholder="email@exemplo.com ou telefone"
                  />
                </div>
                <div>
                  <Label htmlFor="pix_nome">Nome do Recebedor</Label>
                  <Input
                    id="pix_nome"
                    value={settings.pix_nome_recebedor || ""}
                    onChange={(e) =>
                      setSettings({ ...settings, pix_nome_recebedor: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="pix_cidade">Cidade</Label>
                  <Input
                    id="pix_cidade"
                    value={settings.pix_cidade || ""}
                    onChange={(e) =>
                      setSettings({ ...settings, pix_cidade: e.target.value })
                    }
                  />
                </div>
                <Button onClick={handleSaveSettings}>Salvar Pix</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="whatsapp">
            <Card>
              <CardHeader>
                <CardTitle>Integração WhatsApp Business</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="whatsapp_number">Número do WhatsApp Business</Label>
                  <Input
                    id="whatsapp_number"
                    value={settings.whatsapp_business_number || ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        whatsapp_business_number: e.target.value,
                      })
                    }
                    placeholder="5511999999999"
                  />
                </div>
                <div>
                  <Label htmlFor="phone_id">Phone Number ID</Label>
                  <Input
                    id="phone_id"
                    value={settings.whatsapp_phone_id || ""}
                    onChange={(e) =>
                      setSettings({ ...settings, whatsapp_phone_id: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="access_token">Access Token</Label>
                  <Input
                    id="access_token"
                    type="password"
                    value={settings.whatsapp_access_token || ""}
                    onChange={(e) =>
                      setSettings({ ...settings, whatsapp_access_token: e.target.value })
                    }
                  />
                </div>
                <Button onClick={handleSaveSettings}>Salvar WhatsApp</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
