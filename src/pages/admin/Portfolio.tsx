import { useEffect, useState } from "react";
import { Image, Pencil, Plus, Trash2, Upload } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type PortfolioItem = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  image_url: string;
  alt_text: string;
  sort_order: number;
  is_active: boolean;
};

const emptyForm = { title: "", description: "", category: "Outros", image_url: "", alt_text: "", sort_order: 0, is_active: true };

export default function Portfolio() {
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PortfolioItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { void loadItems(); }, []);

  async function loadItems() {
    const { data, error } = await supabase.from("portfolio_items").select("*").order("sort_order").order("created_at");
    if (error) { toast.error("Não foi possível carregar o portfólio"); return; }
    const nextItems = (data || []) as PortfolioItem[];
    setItems(nextItems);
    const signedEntries = await Promise.all(nextItems.map(async (item) => {
      if (item.image_url.startsWith("/") || item.image_url.startsWith("http")) return [item.id, item.image_url] as const;
      const { data: signed } = await supabase.storage.from("portfolio").createSignedUrl(item.image_url, 3600);
      return [item.id, signed?.signedUrl || ""] as const;
    }));
    setPreviews(Object.fromEntries(signedEntries));
  }

  function openForm(item?: PortfolioItem) {
    setEditing(item || null);
    setForm(item ? { title: item.title, description: item.description || "", category: item.category, image_url: item.image_url, alt_text: item.alt_text, sort_order: item.sort_order, is_active: item.is_active } : emptyForm);
    setFile(null);
    setDialogOpen(true);
  }

  async function saveItem() {
    if (!form.title.trim() || !form.category.trim() || (!form.image_url && !file)) {
      toast.error("Informe título, categoria e imagem"); return;
    }
    if (file && (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024)) {
      toast.error("Selecione uma imagem de até 10 MB"); return;
    }
    setSaving(true);
    try {
      let imagePath = form.image_url;
      if (file) {
        const extension = file.name.split(".").pop()?.toLowerCase() || "webp";
        imagePath = `${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from("portfolio").upload(imagePath, file, { contentType: file.type });
        if (uploadError) throw uploadError;
      }
      const payload = { ...form, title: form.title.trim(), category: form.category.trim(), alt_text: form.alt_text.trim() || form.title.trim(), image_url: imagePath };
      const result = editing
        ? await supabase.from("portfolio_items").update(payload).eq("id", editing.id)
        : await supabase.from("portfolio_items").insert(payload);
      if (result.error) throw result.error;
      if (file && editing?.image_url && !editing.image_url.startsWith("/") && !editing.image_url.startsWith("http")) {
        await supabase.storage.from("portfolio").remove([editing.image_url]);
      }
      toast.success(editing ? "Trabalho atualizado" : "Trabalho adicionado");
      setDialogOpen(false);
      await loadItems();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar");
    } finally { setSaving(false); }
  }

  async function removeItem(item: PortfolioItem) {
    if (!window.confirm(`Remover “${item.title}” do portfólio?`)) return;
    const { error } = await supabase.from("portfolio_items").delete().eq("id", item.id);
    if (error) { toast.error("Não foi possível remover"); return; }
    if (!item.image_url.startsWith("/") && !item.image_url.startsWith("http")) await supabase.storage.from("portfolio").remove([item.image_url]);
    toast.success("Trabalho removido");
    await loadItems();
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h1 className="text-3xl font-bold text-foreground">Portfólio</h1><p className="mt-1 text-muted-foreground">Gerencie os trabalhos exibidos no site</p></div>
          <Button onClick={() => openForm()}><Plus className="mr-2 h-4 w-4" />Novo trabalho</Button>
        </div>
        {items.length === 0 ? <Card><CardContent className="py-12 text-center text-muted-foreground"><Image className="mx-auto mb-3 h-8 w-8" />Nenhum trabalho cadastrado</CardContent></Card> :
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <div className="aspect-[4/3] bg-muted"><img src={previews[item.id] || item.image_url} alt={item.alt_text} className="h-full w-full object-cover" /></div>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-foreground">{item.title}</h2><p className="text-sm text-muted-foreground">{item.category} · ordem {item.sort_order}</p></div><span className="text-xs text-muted-foreground">{item.is_active ? "Visível" : "Oculto"}</span></div>
                <div className="flex gap-2"><Button variant="outline" size="sm" className="flex-1" onClick={() => openForm(item)}><Pencil className="mr-2 h-4 w-4" />Editar</Button><Button variant="destructive" size="icon" onClick={() => void removeItem(item)} aria-label={`Remover ${item.title}`}><Trash2 className="h-4 w-4" /></Button></div>
              </CardContent>
            </Card>
          ))}</div>}
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle>{editing ? "Editar trabalho" : "Novo trabalho"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label htmlFor="portfolio-title">Título</Label><Input id="portfolio-title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></div>
            <div><Label htmlFor="portfolio-description">Descrição</Label><Textarea id="portfolio-description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></div>
            <div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="portfolio-category">Categoria</Label><Input id="portfolio-category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></div><div><Label htmlFor="portfolio-order">Ordem</Label><Input id="portfolio-order" type="number" value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: Number(event.target.value) })} /></div></div>
            <div><Label htmlFor="portfolio-alt">Descrição da imagem</Label><Input id="portfolio-alt" value={form.alt_text} onChange={(event) => setForm({ ...form, alt_text: event.target.value })} placeholder="Ex.: corte masculino com degradê" /></div>
            <div><Label htmlFor="portfolio-file">Imagem</Label><Input id="portfolio-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] || null)} /><p className="mt-1 text-xs text-muted-foreground">JPG, PNG ou WebP, até 10 MB.</p></div>
            <div className="flex items-center justify-between rounded-md border border-border p-3"><Label htmlFor="portfolio-active">Exibir no site</Label><Switch id="portfolio-active" checked={form.is_active} onCheckedChange={(checked) => setForm({ ...form, is_active: checked })} /></div>
            <Button onClick={() => void saveItem()} disabled={saving} className="w-full"><Upload className="mr-2 h-4 w-4" />{saving ? "Salvando..." : "Salvar trabalho"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}