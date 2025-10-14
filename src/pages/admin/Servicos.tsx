import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface InterleavedBlock {
  start_min: number;
  duration_min: number;
  blocked: boolean;
}

interface Service {
  id: string;
  name: string;
  description: string | null;
  duration_min: number;
  price: number;
  is_active: boolean;
  interleaved_blocks: InterleavedBlock[] | null;
}

export default function Servicos() {
  const [services, setServices] = useState<Service[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    duration_min: 30,
    price: 0,
    is_active: true,
    interleaved_blocks: null as InterleavedBlock[] | null,
  });
  const [enableInterleaved, setEnableInterleaved] = useState(false);

  useEffect(() => {
    fetchServices();
  }, []);

  async function fetchServices() {
    const { data, error } = await supabase
      .from("services")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar serviços");
      return;
    }

    setServices((data || []) as unknown as Service[]);
  }

  function openDialog(service?: Service) {
    if (service) {
      setEditingService(service);
      setFormData({
        name: service.name,
        description: service.description || "",
        duration_min: service.duration_min,
        price: Number(service.price),
        is_active: service.is_active,
        interleaved_blocks: service.interleaved_blocks,
      });
      setEnableInterleaved(!!service.interleaved_blocks);
    } else {
      setEditingService(null);
      setFormData({
        name: "",
        description: "",
        duration_min: 30,
        price: 0,
        is_active: true,
        interleaved_blocks: null,
      });
      setEnableInterleaved(false);
    }
    setDialogOpen(true);
  }

  function generateInterleavedBlocks() {
    const totalDuration = formData.duration_min;
    const blockSize = 30; // blocos de 30 minutos
    const blocks: InterleavedBlock[] = [];
    
    for (let i = 0; i < totalDuration; i += blockSize) {
      blocks.push({
        start_min: i,
        duration_min: Math.min(blockSize, totalDuration - i),
        blocked: true,
      });
    }
    
    setFormData({ ...formData, interleaved_blocks: blocks });
  }

  function updateBlockStatus(index: number, blocked: boolean) {
    if (!formData.interleaved_blocks) return;
    
    const updated = [...formData.interleaved_blocks];
    updated[index] = { ...updated[index], blocked };
    setFormData({ ...formData, interleaved_blocks: updated });
  }

  async function handleSaveService() {
    if (!formData.name || formData.price <= 0 || formData.duration_min <= 0) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const dataToSave = {
      name: formData.name,
      description: formData.description,
      duration_min: formData.duration_min,
      price: formData.price,
      is_active: formData.is_active,
      interleaved_blocks: enableInterleaved ? (formData.interleaved_blocks as any) : null,
    };

    if (editingService) {
      const { error } = await supabase
        .from("services")
        .update(dataToSave)
        .eq("id", editingService.id);

      if (error) {
        toast.error("Erro ao atualizar serviço");
        return;
      }

      toast.success("Serviço atualizado!");
    } else {
      const { error } = await supabase.from("services").insert(dataToSave);

      if (error) {
        toast.error("Erro ao criar serviço");
        return;
      }

      toast.success("Serviço criado!");
    }

    setDialogOpen(false);
    fetchServices();
  }

  async function handleDeleteService(id: string) {
    if (!confirm("Tem certeza que deseja excluir este serviço?")) return;

    const { error } = await supabase.from("services").delete().eq("id", id);

    if (error) {
      toast.error("Erro ao excluir serviço");
      return;
    }

    toast.success("Serviço excluído!");
    fetchServices();
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">Serviços</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => openDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Serviço
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingService ? "Editar Serviço" : "Novo Serviço"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Corte de Cabelo"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Descrição do serviço"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="duration">Duração (min) *</Label>
                    <Input
                      id="duration"
                      type="number"
                      value={formData.duration_min}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          duration_min: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="price">Preço (R$) *</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) =>
                        setFormData({ ...formData, price: Number(e.target.value) })
                      }
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_active: checked })
                    }
                  />
                  <Label htmlFor="active">Ativo</Label>
                </div>

                <div className="border-t pt-4 space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="interleaved"
                      checked={enableInterleaved}
                      onCheckedChange={(checked) => {
                        setEnableInterleaved(checked);
                        if (checked && !formData.interleaved_blocks) {
                          generateInterleavedBlocks();
                        }
                      }}
                    />
                    <Label htmlFor="interleaved">
                      Bloqueios Intercalados
                    </Label>
                  </div>
                  
                  {enableInterleaved && (
                    <div className="space-y-2 bg-muted p-4 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-3">
                        Configure os períodos em que você estará disponível para atender outros clientes durante este serviço (ex: tempo de pausa da tinta):
                      </p>
                      
                      {!formData.interleaved_blocks ? (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={generateInterleavedBlocks}
                        >
                          Gerar Blocos
                        </Button>
                      ) : (
                        <div className="space-y-2">
                          {formData.interleaved_blocks.map((block, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-background p-2 rounded">
                              <span className="text-sm">
                                {block.start_min} - {block.start_min + block.duration_min} min
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                  {block.blocked ? "Bloqueado" : "Disponível"}
                                </span>
                                <Switch
                                  checked={!block.blocked}
                                  onCheckedChange={(checked) => 
                                    updateBlockStatus(idx, !checked)
                                  }
                                />
                              </div>
                            </div>
                          ))}
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={generateInterleavedBlocks}
                            className="w-full"
                          >
                            Regenerar Blocos
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <Button onClick={handleSaveService} className="w-full">
                  {editingService ? "Salvar Alterações" : "Criar Serviço"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((service) => (
            <Card key={service.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{service.name}</span>
                  {!service.is_active && (
                    <span className="text-xs bg-muted px-2 py-1 rounded">
                      Inativo
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {service.description && (
                  <p className="text-sm text-muted-foreground">
                    {service.description}
                  </p>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Duração:</span>
                  <span className="font-medium">{service.duration_min} min</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Preço:</span>
                  <span className="font-medium">
                    R$ {Number(service.price).toFixed(2)}
                  </span>
                </div>
                {service.interleaved_blocks && (
                  <div className="bg-muted p-2 rounded text-xs space-y-1">
                    <p className="font-medium text-foreground">Bloqueios Intercalados:</p>
                    <div className="flex gap-1 flex-wrap">
                      {service.interleaved_blocks.map((block, idx) => (
                        <span
                          key={idx}
                          className={`px-2 py-1 rounded ${
                            block.blocked
                              ? "bg-destructive/20 text-destructive"
                              : "bg-primary/20 text-primary"
                          }`}
                        >
                          {block.start_min}-{block.start_min + block.duration_min}min{" "}
                          {block.blocked ? "🔒" : "✓"}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openDialog(service)}
                  >
                    <Pencil className="w-3 h-3 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteService(service.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {services.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                Nenhum serviço cadastrado. Crie o primeiro!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
