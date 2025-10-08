import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Trash2 } from "lucide-react";

interface Block {
  id: string;
  start_datetime: string;
  end_datetime: string;
  reason: string;
}

export default function Agenda() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newBlock, setNewBlock] = useState({
    start_datetime: "",
    end_datetime: "",
    reason: "",
  });

  useEffect(() => {
    fetchBlocks();
  }, []);

  async function fetchBlocks() {
    const { data, error } = await supabase
      .from("blocks")
      .select("*")
      .order("start_datetime", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar bloqueios");
      return;
    }

    setBlocks(data || []);
  }

  async function handleCreateBlock() {
    if (!newBlock.start_datetime || !newBlock.end_datetime) {
      toast.error("Preencha as datas de início e fim");
      return;
    }

    const { error } = await supabase.from("blocks").insert({
      start_datetime: newBlock.start_datetime,
      end_datetime: newBlock.end_datetime,
      reason: newBlock.reason || "Indisponível",
    });

    if (error) {
      toast.error("Erro ao criar bloqueio");
      return;
    }

    toast.success("Bloqueio criado com sucesso!");
    setDialogOpen(false);
    setNewBlock({ start_datetime: "", end_datetime: "", reason: "" });
    fetchBlocks();
  }

  async function handleDeleteBlock(id: string) {
    const { error } = await supabase.from("blocks").delete().eq("id", id);

    if (error) {
      toast.error("Erro ao remover bloqueio");
      return;
    }

    toast.success("Bloqueio removido!");
    fetchBlocks();
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">Agenda</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Bloquear Período
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Bloqueio</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="start">Data/Hora Início</Label>
                  <Input
                    id="start"
                    type="datetime-local"
                    value={newBlock.start_datetime}
                    onChange={(e) =>
                      setNewBlock({ ...newBlock, start_datetime: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="end">Data/Hora Fim</Label>
                  <Input
                    id="end"
                    type="datetime-local"
                    value={newBlock.end_datetime}
                    onChange={(e) =>
                      setNewBlock({ ...newBlock, end_datetime: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="reason">Motivo</Label>
                  <Textarea
                    id="reason"
                    placeholder="Férias, folga, etc."
                    value={newBlock.reason}
                    onChange={(e) =>
                      setNewBlock({ ...newBlock, reason: e.target.value })
                    }
                  />
                </div>
                <Button onClick={handleCreateBlock} className="w-full">
                  Criar Bloqueio
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Calendário</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                locale={ptBR}
                className="rounded-md border"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bloqueios Ativos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {blocks.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    Nenhum bloqueio ativo
                  </p>
                ) : (
                  blocks.map((block) => (
                    <div
                      key={block.id}
                      className="flex items-start justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{block.reason}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {format(new Date(block.start_datetime), "dd/MM/yyyy HH:mm", {
                            locale: ptBR,
                          })}{" "}
                          até{" "}
                          {format(new Date(block.end_datetime), "dd/MM/yyyy HH:mm", {
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteBlock(block.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
