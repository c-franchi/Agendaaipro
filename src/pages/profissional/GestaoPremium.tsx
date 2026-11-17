import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { premiumDb, formatBRL, type EntitlementRow } from "@/lib/premium-api";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Product={id:string;professional_id:string;name:string;unit:string;stock_quantity:number;min_stock:number;sale_price:number;unit_cost:number;is_active:boolean};
type Sale={id:string;professional_id:string;status:string;total:number;created_at:string};
type Expense={id:string;professional_id:string;category:string;description:string|null;amount:number;paid_at:string;voided_at:string|null};
type Service={id:string;professional_id:string|null;name:string};
type Consumable={service_id:string;product_id:string;quantity_per_service:number};
type Booking={id:string;price:number;status:string};
type Usage={booking_id:string;quantity:number;unit_cost_snapshot:number};
type Movement={id:string;product_id:string;quantity_delta:number;reason:string;created_at:string};
type Professional={id:string;display_name:string};
const decimal=(v:number)=>Number(v||0);

function GestaoPremiumContent({owner=false}:{owner?:boolean}){
  const [businessId,setBusinessId]=useState("");
  const [professionalId,setProfessionalId]=useState("");
  const [entitlement,setEntitlement]=useState<EntitlementRow|null>(null);
  const [products,setProducts]=useState<Product[]>([]);
  const [sales,setSales]=useState<Sale[]>([]);
  const [expenses,setExpenses]=useState<Expense[]>([]);
  const [services,setServices]=useState<Service[]>([]);
  const [consumables,setConsumables]=useState<Consumable[]>([]);
  const [bookings,setBookings]=useState<Booking[]>([]);
  const [usage,setUsage]=useState<Usage[]>([]);
  const [movements,setMovements]=useState<Movement[]>([]);
  const [professionals,setProfessionals]=useState<Professional[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [productForm,setProductForm]=useState({name:"",unit:"un",sale_price:0,unit_cost:0,min_stock:0,initial_stock:0});
  const [movement,setMovement]=useState({productId:"",quantity_delta:1,reason:"Reposição de estoque"});
  const [sale,setSale]=useState({productId:"",quantity:1,customer_name:""});
  const [expense,setExpense]=useState({category:"Materiais",description:"",amount:0});
  const [recipe,setRecipe]=useState({serviceId:"",productId:"",quantity:1});

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const auth=await supabase.auth.getUser();
      if(!auth.data.user) throw new Error("Faça login para entrar na gestão.");
      const myId=await premiumDb.rpc("my_professional_id");
      if(myId.error) throw myId.error;
      if(!myId.data) throw new Error("A conta não tem vínculo profissional ativo.");
      const professionalId=String(myId.data);
      const prof=await premiumDb.from("professional_profiles").select("business_id").eq("id",professionalId).single();
      if(prof.error) throw prof.error;
      const businessId=String(prof.data.business_id);
      const [ent,p,s,e,svc,cons,b,used,m,people]=await Promise.all([
        premiumDb.rpc("my_business_entitlement"),
        premiumDb.from("products").select("id,professional_id,name,unit,stock_quantity,min_stock,sale_price,unit_cost,is_active").eq("business_id",businessId).order("name"),
        premiumDb.from("sales").select("id,professional_id,status,total,created_at").eq("business_id",businessId).order("created_at",{ascending:false}).limit(100),
        premiumDb.from("expenses").select("id,professional_id,category,description,amount,paid_at,voided_at").eq("business_id",businessId).order("paid_at",{ascending:false}).limit(100),
        premiumDb.from("services").select("id,professional_id,name").eq("professional_id",professionalId),
        premiumDb.from("service_consumables").select("service_id,product_id,quantity_per_service").eq("business_id",businessId),
        premiumDb.from("bookings").select("id,price,status").eq("business_id",businessId).eq("status","COMPLETED").limit(100),
        premiumDb.from("booking_material_usage").select("booking_id,quantity,unit_cost_snapshot").eq("business_id",businessId).limit(1000),
        premiumDb.from("stock_movements").select("id,product_id,quantity_delta,reason,created_at").eq("business_id",businessId).order("created_at",{ascending:false}).limit(100),
        premiumDb.from("professional_profiles").select("id,display_name").eq("business_id",businessId),
      ]);
      for(const response of [ent,p,s,e,svc,cons,b,used,m,people]) if(response.error) throw response.error;
      // Professional não vê assinatura comercial alheia: somente o titular pode consultá-la.
      setEntitlement((Array.isArray(ent.data)?ent.data[0]:null) as EntitlementRow|null);
      setBusinessId(businessId);setProfessionalId(professionalId);
      setProducts((p.data||[]) as Product[]);setSales((s.data||[]) as Sale[]);
      setExpenses((e.data||[]) as Expense[]);setServices((svc.data||[]) as Service[]);
      setConsumables((cons.data||[]) as Consumable[]);setBookings((b.data||[]) as Booking[]);
      setUsage((used.data||[]) as Usage[]);setMovements((m.data||[]) as Movement[]);
      setProfessionals((people.data||[]) as Professional[]);setError("");
    }catch(err){setError(err instanceof Error?err.message:"Erro ao carregar a gestão");}
    finally{setLoading(false);}
  },[]);

  useEffect(()=>{void load();},[load]);
  async function run(action:()=>PromiseLike<{error:Error|null}|{error:unknown}>|Promise<void>,message:string){
    setBusy(true);
    try{
      await action();
      toast.success(message);
      await load();
    }catch(e){toast.error(e instanceof Error?e.message:"Não foi possível salvar");}
    finally{setBusy(false);}
  }
  const rpc=async (name:string,args:Record<string,unknown>)=>{
    const {error:e}=await premiumDb.rpc(name,args);
    if(e) throw e;
  };
  const owns=(id:string)=>id===professionalId;
  const inventoryEnabled=Boolean(entitlement&&["pro","premium"].includes(entitlement.plan_key)
    &&["active","trialing"].includes(entitlement.status)
    &&(!entitlement.valid_until||new Date(entitlement.valid_until)>new Date()));
  const premiumEnabled=inventoryEnabled&&entitlement?.plan_key==="premium";
  const stats=useMemo(()=>{
    const paidSales=sales.filter(s=>s.status==="paid").reduce((v,s)=>v+decimal(s.total),0);
    const activeExpenses=expenses.filter(e=>!e.voided_at).reduce((v,e)=>v+decimal(e.amount),0);
    const serviceValue=bookings.reduce((v,b)=>v+decimal(b.price),0);
    const usedCost=usage.reduce((v,u)=>v+decimal(u.quantity)*decimal(u.unit_cost_snapshot),0);
    return {paidSales,activeExpenses,serviceValue,usedCost,margin:serviceValue-usedCost};
  },[sales,expenses,bookings,usage]);

  const ownProducts=products.filter(p=>owns(p.professional_id));
  const labelFor=(id:string)=>professionals.find(p=>p.id===id)?.display_name||"Profissional";
  return <div className="mx-auto max-w-5xl space-y-5 pb-12">
    <div className="flex flex-wrap justify-between gap-3">
      <div><h1 className="text-3xl font-bold">Gestão e estoque</h1><p className="text-muted-foreground">Produtos, movimentações, vendas, despesas e insumos por atendimento</p></div>
      <Button asChild variant="outline"><Link to={owner?"/admin/equipe":"/profissional"}>Voltar</Link></Button>
    </div>
    {loading&&<p role="status">Carregando dados…</p>}
    {error&&<p role="alert" className="text-destructive">{error}</p>}
    {!loading&&professionalId&&<div className="space-y-5">
      {!inventoryEnabled&&<p className="rounded-lg border p-4">O acesso à gestão requer assinatura Gestão ou Premium ativa. Os dados cadastrados permanecem preservados.</p>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardHeader><CardDescription>Vendas registradas</CardDescription><CardTitle>{formatBRL(stats.paidSales)}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Despesas lançadas</CardDescription><CardTitle>{formatBRL(stats.activeExpenses)}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Atendimentos concluídos</CardDescription><CardTitle>{formatBRL(stats.serviceValue)}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Margem estimada de serviços*</CardDescription><CardTitle>{formatBRL(stats.margin)}</CardTitle></CardHeader></Card>
      </div>
      <p className="text-xs text-muted-foreground">* Valores baseados nos registros carregados (vendas/despesas: até 100; consumos: até 1.000). Margem desconta apenas insumos informados, não é lucro líquido nem saldo bancário.</p>
      <Tabs defaultValue="produtos" className="space-y-4">
        <TabsList className="h-auto flex-wrap gap-1 justify-start">
          <TabsTrigger value="produtos">Produtos</TabsTrigger><TabsTrigger value="vendas">Vendas</TabsTrigger>
          <TabsTrigger value="despesas">Despesas</TabsTrigger><TabsTrigger value="insumos">Insumos</TabsTrigger>
          <TabsTrigger value="historico">Movimentações</TabsTrigger>
        </TabsList>
        <TabsContent value="produtos" className="space-y-4">
          <Card><CardHeader><CardTitle>Estoque</CardTitle></CardHeader><CardContent className="space-y-2">
            {products.length===0&&<p className="text-muted-foreground">Nenhum produto cadastrado.</p>}
            {products.map(p=><div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <div><p className="font-medium">{p.name} {decimal(p.stock_quantity)<=decimal(p.min_stock)&&<Badge variant="destructive">Estoque baixo</Badge>}</p>
                <p className="text-sm text-muted-foreground">{labelFor(p.professional_id)} · {p.stock_quantity} {p.unit} · Venda {formatBRL(Number(p.sale_price))} · Custo {formatBRL(Number(p.unit_cost))}</p>
              </div><Badge variant="outline">{p.is_active?"Ativo":"Inativo"}</Badge>
            </div>)}
          </CardContent></Card>
          <Card><CardHeader><CardTitle>Novo produto</CardTitle></CardHeader><CardContent>
            <form className="grid gap-3 sm:grid-cols-3" onSubmit={e=>{e.preventDefault();void run(async()=>{
              const {data,error:err}=await premiumDb.rpc("create_inventory_product",{
                p_name:productForm.name,p_unit:productForm.unit,p_sale_price:productForm.sale_price,
                p_unit_cost:productForm.unit_cost,p_min_stock:productForm.min_stock});
              if(err)throw err;
              if(productForm.initial_stock>0)await rpc("adjust_inventory",{p_product_id:data,p_quantity_delta:productForm.initial_stock,p_reason:"Estoque inicial"});
              setProductForm({name:"",unit:"un",sale_price:0,unit_cost:0,min_stock:0,initial_stock:0});
            },"Produto cadastrado");}}>
              <div><Label htmlFor="pName">Nome</Label><Input id="pName" required minLength={2} value={productForm.name} onChange={e=>setProductForm(v=>({...v,name:e.target.value}))}/></div>
              <div><Label htmlFor="pUnit">Unidade (un/ml/g)</Label><Input id="pUnit" required value={productForm.unit} onChange={e=>setProductForm(v=>({...v,unit:e.target.value}))}/></div>
              <div><Label htmlFor="pPrice">Preço de venda</Label><Input id="pPrice" type="number" min={0} step={0.01} value={productForm.sale_price} onChange={e=>setProductForm(v=>({...v,sale_price:Number(e.target.value)}))}/></div>
              <div><Label htmlFor="pCost">Custo unitário</Label><Input id="pCost" type="number" min={0} step={0.0001} value={productForm.unit_cost} onChange={e=>setProductForm(v=>({...v,unit_cost:Number(e.target.value)}))}/></div>
              <div><Label htmlFor="pMin">Estoque mínimo</Label><Input id="pMin" type="number" min={0} step={0.001} value={productForm.min_stock} onChange={e=>setProductForm(v=>({...v,min_stock:Number(e.target.value)}))}/></div>
              <div><Label htmlFor="pInitial">Quantidade inicial</Label><Input id="pInitial" type="number" min={0} step={0.001} value={productForm.initial_stock} onChange={e=>setProductForm(v=>({...v,initial_stock:Number(e.target.value)}))}/></div>
              <Button disabled={busy||!inventoryEnabled} type="submit" className="sm:col-span-3">Cadastrar</Button>
            </form>
          </CardContent></Card>
          <Card><CardHeader><CardTitle>Entrada, baixa ou ajuste manual</CardTitle></CardHeader><CardContent>
            <form className="grid gap-3 sm:grid-cols-3" onSubmit={e=>{e.preventDefault();void run(()=>rpc("adjust_inventory",{p_product_id:movement.productId,p_quantity_delta:movement.quantity_delta,p_reason:movement.reason}),"Estoque atualizado");}}>
              <div><Label htmlFor="moveProduct">Produto próprio</Label><select id="moveProduct" required className="w-full rounded-md border bg-background p-2" value={movement.productId} onChange={e=>setMovement(v=>({...v,productId:e.target.value}))}>
                <option value="">Selecione</option>{ownProducts.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div><Label htmlFor="delta">Quantidade (+ entrada / - baixa)</Label><Input id="delta" type="number" step={0.001} required value={movement.quantity_delta} onChange={e=>setMovement(v=>({...v,quantity_delta:Number(e.target.value)}))}/></div>
              <div><Label htmlFor="moveReason">Motivo</Label><Input id="moveReason" required minLength={3} value={movement.reason} onChange={e=>setMovement(v=>({...v,reason:e.target.value}))}/></div>
              <Button disabled={busy||!inventoryEnabled} type="submit">Registrar movimentação</Button>
            </form>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="vendas" className="space-y-4">
          <Card><CardHeader><CardTitle>Registrar venda de produto</CardTitle></CardHeader><CardContent>
            <form className="grid gap-3 sm:grid-cols-3" onSubmit={e=>{e.preventDefault();void run(()=>rpc("register_inventory_sale",{p_items:[{product_id:sale.productId,quantity:sale.quantity}],p_customer_name:sale.customer_name||null}),"Venda lançada e estoque atualizado");}}>
              <div><Label htmlFor="saleProduct">Produto</Label><select id="saleProduct" required className="w-full rounded-md border bg-background p-2" value={sale.productId} onChange={e=>setSale(v=>({...v,productId:e.target.value}))}><option value="">Selecione</option>{ownProducts.filter(p=>p.is_active).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div><Label htmlFor="saleQty">Quantidade</Label><Input id="saleQty" type="number" min={0.001} step={0.001} value={sale.quantity} onChange={e=>setSale(v=>({...v,quantity:Number(e.target.value)}))}/></div>
              <div><Label htmlFor="saleCustomer">Cliente (opcional)</Label><Input id="saleCustomer" value={sale.customer_name} onChange={e=>setSale(v=>({...v,customer_name:e.target.value}))}/></div>
              <Button type="submit" disabled={busy||!inventoryEnabled}>Registrar venda</Button>
            </form>
          </CardContent></Card>
          <Card><CardHeader><CardTitle>Últimas vendas</CardTitle></CardHeader><CardContent className="space-y-2">
            {sales.map(s=><div key={s.id} className="flex flex-wrap justify-between gap-3 rounded-md border p-3">
              <div><p className="font-semibold">{formatBRL(Number(s.total))} · {s.status==="paid"?"Venda":"Cancelada"}</p>
                <p className="text-sm text-muted-foreground">{labelFor(s.professional_id)} · {new Date(s.created_at).toLocaleString("pt-BR")}</p></div>
              {s.status==="paid"&&owns(s.professional_id)&&<Button size="sm" variant="outline" disabled={busy||!inventoryEnabled} onClick={()=>{if(window.confirm("Cancelar venda e devolver produtos ao estoque?"))void run(()=>rpc("cancel_inventory_sale",{p_sale_id:s.id}),"Venda cancelada e estoque restaurado");}}>Estornar venda</Button>}
            </div>)}
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="despesas" className="space-y-4">
          <Card><CardHeader><CardTitle>Registrar despesa</CardTitle></CardHeader><CardContent>
            <form className="grid gap-3 sm:grid-cols-3" onSubmit={e=>{e.preventDefault();void run(()=>rpc("record_business_expense",{p_category:expense.category,p_description:expense.description,p_amount:expense.amount}),"Despesa registrada");}}>
              <div><Label htmlFor="expenseCategory">Categoria</Label><Input id="expenseCategory" required minLength={2} value={expense.category} onChange={e=>setExpense(v=>({...v,category:e.target.value}))}/></div>
              <div><Label htmlFor="expenseDescription">Descrição</Label><Input id="expenseDescription" value={expense.description} onChange={e=>setExpense(v=>({...v,description:e.target.value}))}/></div>
              <div><Label htmlFor="expenseValue">Valor (R$)</Label><Input id="expenseValue" type="number" step={0.01} min={0.01} required value={expense.amount} onChange={e=>setExpense(v=>({...v,amount:Number(e.target.value)}))}/></div>
              <Button type="submit" disabled={busy||!inventoryEnabled}>Registrar despesa</Button>
            </form>
          </CardContent></Card>
          <Card><CardHeader><CardTitle>Despesas lançadas</CardTitle></CardHeader><CardContent className="space-y-2">
            {expenses.map(e=><div key={e.id} className="flex flex-wrap justify-between gap-3 rounded-md border p-3">
              <div><p className="font-medium">{e.category} · {formatBRL(Number(e.amount))} {e.voided_at&&<Badge variant="outline">Anulada</Badge>}</p>
                <p className="text-sm text-muted-foreground">{labelFor(e.professional_id)} · {e.description||"Sem descrição"}</p></div>
              {!e.voided_at&&owns(e.professional_id)&&<Button size="sm" variant="outline" disabled={busy||!inventoryEnabled} onClick={()=>{if(window.confirm("Anular este lançamento?"))void run(()=>rpc("void_business_expense",{p_expense_id:e.id}),"Despesa anulada");}}>Anular</Button>}
            </div>)}
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="insumos" className="space-y-4">
          <Card><CardHeader><CardTitle>Materiais consumidos por serviço</CardTitle>
            <CardDescription>Premium: a baixa será automática uma única vez quando o atendimento for concluído. O custo fica registrado na data da conclusão.</CardDescription></CardHeader><CardContent className="space-y-3">
            <form className="grid gap-3 sm:grid-cols-3" onSubmit={e=>{e.preventDefault();void run(()=>rpc("set_service_consumable",{p_service_id:recipe.serviceId,p_product_id:recipe.productId,p_quantity:recipe.quantity}),"Ficha de consumo atualizada");}}>
              <div><Label htmlFor="recipeService">Serviço</Label><select id="recipeService" required className="w-full rounded-md border bg-background p-2" value={recipe.serviceId} onChange={e=>setRecipe(v=>({...v,serviceId:e.target.value}))}><option value="">Selecione</option>{services.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></div>
              <div><Label htmlFor="recipeProduct">Insumo</Label><select id="recipeProduct" required className="w-full rounded-md border bg-background p-2" value={recipe.productId} onChange={e=>setRecipe(v=>({...v,productId:e.target.value}))}><option value="">Selecione</option>{ownProducts.map(p=><option value={p.id} key={p.id}>{p.name} ({p.unit})</option>)}</select></div>
              <div><Label htmlFor="recipeQty">Qtd por atendimento (0 remove)</Label><Input id="recipeQty" type="number" min={0} step={0.001} required value={recipe.quantity} onChange={e=>setRecipe(v=>({...v,quantity:Number(e.target.value)}))}/></div>
              <Button type="submit" disabled={busy||!inventoryEnabled||!premiumEnabled}>Salvar consumo</Button>
            </form>
            {consumables.length===0&&<p className="text-sm text-muted-foreground">Nenhuma ficha de consumo cadastrada.</p>}
            {consumables.map(c=><div key={c.service_id+":"+c.product_id} className="rounded-md border p-3 text-sm">
              {services.find(s=>s.id===c.service_id)?.name||"Serviço de outro profissional"} · {products.find(p=>p.id===c.product_id)?.name||"Insumo"} · {c.quantity_per_service} unidades
            </div>)}
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="historico">
          <Card><CardHeader><CardTitle>Livro de movimentações</CardTitle><CardDescription>Os lançamentos não são apagados nem sobrescritos, inclusive em estornos.</CardDescription></CardHeader>
            <CardContent className="space-y-2">{movements.map(m=><div key={m.id} className="rounded-md border p-3 text-sm">
              <strong>{m.quantity_delta>0?"+":""}{m.quantity_delta} {products.find(p=>p.id===m.product_id)?.unit||""}</strong> · {products.find(p=>p.id===m.product_id)?.name||"Produto"} · {m.reason}
              <p className="text-muted-foreground">{new Date(m.created_at).toLocaleString("pt-BR")}</p>
            </div>)}</CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>}
  </div>;
}

export default function GestaoPremium({admin=false}:{admin?:boolean}){
  const content=<GestaoPremiumContent owner={admin}/>;
  return admin?<AdminLayout>{content}</AdminLayout>:<main className="min-h-screen bg-background px-4 py-8">{content}</main>;
}
