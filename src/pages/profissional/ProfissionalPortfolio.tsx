import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { premiumDb } from "@/lib/premium-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload } from "lucide-react";

type Item={id:string;title:string;category:string;image_url:string;alt_text:string;is_active:boolean};
export default function ProfissionalPortfolio(){
  const [id,setId]=useState("");
  const [businessId,setBusinessId]=useState("");
  const [items,setItems]=useState<Item[]>([]);
  const [images,setImages]=useState<Record<string,string>>({});
  const [title,setTitle]=useState("");
  const [category,setCategory]=useState("Meus trabalhos");
  const [alt,setAlt]=useState("");
  const [file,setFile]=useState<File|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  async function load(){
    try{
      const {data,error:err}=await premiumDb.rpc("my_professional_id");
      if(err)throw err;
      if(!data)throw Error("Acesso profissional não autorizado");
      const id=String(data);
      const profile=await premiumDb.from("professional_profiles").select("business_id").eq("id",id).single();
      if(profile.error)throw profile.error;
      const list=await premiumDb.from("portfolio_items")
        .select("id,title,category,image_url,alt_text,is_active")
        .eq("professional_id",id).order("created_at",{ascending:false});
      if(list.error)throw list.error;
      const items=(list.data||[]) as Item[];
      const preview=await Promise.all(items.map(async item=>{
        if(item.image_url.startsWith("/")||item.image_url.startsWith("http"))return [item.id,item.image_url] as const;
        const {data:signed}=await supabase.storage.from("portfolio").createSignedUrl(item.image_url,3600);
        return [item.id,signed?.signedUrl||""] as const;
      }));
      setId(id);setBusinessId(String(profile.data.business_id));
      setItems(items);setImages(Object.fromEntries(preview));setError("");
    }catch(e){setError(e instanceof Error?e.message:"Não foi possível carregar portfólio");}
  }
  useEffect(()=>{void load();},[]);
  async function create(e:React.FormEvent){
    e.preventDefault();
    if(!id||!file)return;
    if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>10*1024*1024){
      toast.error("Envie JPG, PNG ou WebP até 10 MB");return;
    }
    setBusy(true);
    let uploaded="";
    try{
      const extension=file.type==="image/png"?"png":file.type==="image/jpeg"?"jpg":"webp";
      uploaded=`${id}/${crypto.randomUUID()}.${extension}`;
      const upload=await supabase.storage.from("portfolio").upload(uploaded,file,{contentType:file.type,upsert:false});
      if(upload.error)throw upload.error;
      const {error:err}=await premiumDb.from("portfolio_items").insert({
        business_id:businessId,professional_id:id,title:title.trim(),category:category.trim(),
        image_url:uploaded,alt_text:alt.trim()||title.trim(),sort_order:0,is_active:true
      });
      if(err)throw err;
      setTitle("");setAlt("");setFile(null);
      toast.success("Trabalho publicado no seu portfólio");
      await load();
    }catch(e){
      if(uploaded)await supabase.storage.from("portfolio").remove([uploaded]);
      toast.error(e instanceof Error?e.message:"Não foi possível publicar a imagem");
    }finally{setBusy(false);}
  }
  async function toggle(item:Item){
    setBusy(true);
    try{
      const {error:err}=await premiumDb.from("portfolio_items").update({is_active:!item.is_active})
        .eq("id",item.id).eq("professional_id",id);
      if(err)throw err;
      await load();
    }catch(e){toast.error(e instanceof Error?e.message:"Erro ao atualizar trabalho");}
    finally{setBusy(false);}
  }
  async function remove(item:Item){
    if(!window.confirm("Remover este trabalho do site?"))return;
    setBusy(true);
    try{
      const {error:err}=await premiumDb.from("portfolio_items").delete().eq("id",item.id).eq("professional_id",id);
      if(err)throw err;
      if(item.image_url.startsWith(id+"/"))await supabase.storage.from("portfolio").remove([item.image_url]);
      toast.success("Trabalho removido");
      await load();
    }catch(e){toast.error(e instanceof Error?e.message:"Falha ao remover trabalho");}
    finally{setBusy(false);}
  }
  return <main className="min-h-screen bg-background px-4 py-8">
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div><h1 className="text-3xl font-bold">Meu portfólio</h1>
          <p className="text-muted-foreground">Suas próprias fotos de trabalhos, sem afetar o portfólio dos colegas.</p></div>
        <Button asChild variant="outline"><Link to="/profissional">Voltar</Link></Button>
      </div>
      {error&&<p role="alert" className="text-destructive">{error}</p>}
      <Card><CardHeader><CardTitle>Adicionar um trabalho</CardTitle></CardHeader><CardContent>
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
          <div><Label htmlFor="workTitle">Título</Label><Input id="workTitle" required minLength={2} value={title} onChange={e=>setTitle(e.target.value)}/></div>
          <div><Label htmlFor="workCategory">Categoria</Label><Input id="workCategory" required value={category} onChange={e=>setCategory(e.target.value)}/></div>
          <div><Label htmlFor="workAlt">Descrição da imagem</Label><Input id="workAlt" value={alt} onChange={e=>setAlt(e.target.value)}/></div>
          <div><Label htmlFor="workFile">Imagem JPG/PNG/WebP</Label><Input id="workFile" type="file" required accept="image/jpeg,image/png,image/webp" onChange={e=>setFile(e.target.files?.[0]||null)}/></div>
          <Button className="sm:col-span-2" type="submit" disabled={busy||!id||!file}><Upload className="mr-2 h-4 w-4"/>Publicar meu trabalho</Button>
        </form>
      </CardContent></Card>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map(item=><Card key={item.id} className="overflow-hidden">
          <div className="aspect-[4/3] bg-muted">{images[item.id]&&<img src={images[item.id]} alt={item.alt_text} loading="lazy" className="h-full w-full object-cover"/>}</div>
          <CardContent className="space-y-2 p-4">
            <p className="font-semibold">{item.title}</p><p className="text-sm text-muted-foreground">{item.category} · {item.is_active?"Publicado":"Oculto"}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={busy} onClick={()=>toggle(item)}>{item.is_active?"Ocultar":"Exibir"}</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={()=>remove(item)}>Remover</Button>
            </div>
          </CardContent>
        </Card>)}
      </div>
    </div>
  </main>;
}
