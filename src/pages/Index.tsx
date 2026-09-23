// Página institucional e de agendamento de Eric Zambonini.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Award, CalendarDays, Clock3, Facebook, Instagram, Menu, Phone, Scissors, X } from "lucide-react";
import heroAsset from "@/assets/hero_eric.webp.asset.json";
import corte2 from "@/assets/corte2.webp.asset.json";
import corte3 from "@/assets/corte3.webp.asset.json";
import corte4 from "@/assets/corte4.webp.asset.json";
import corte5 from "@/assets/corte5.png.asset.json";
import corte6 from "@/assets/corte6.webp.asset.json";
import corte7 from "@/assets/corte7.webp.asset.json";

type BarberProfile = {
  name: string;
  bio: string | null;
  years_experience: number | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  review_url?: string | null;
  public_whatsapp?: string | null;
  address_text?: string | null;
};

type Service = { id: string; name: string; description: string | null; duration_min: number; price: number };
type PortfolioItem = { id: string; title: string; category: string; image_url: string; alt_text: string };

const fallbackPortfolio: PortfolioItem[] = [
  { id: "corte-2", title: "Corte masculino clássico", category: "Masculino", image_url: corte2.url, alt_text: "Corte masculino com topete e degradê lateral" },
  { id: "corte-3", title: "Corte texturizado", category: "Masculino", image_url: corte3.url, alt_text: "Corte masculino texturizado com barba alinhada" },
  { id: "corte-6", title: "Degradê moderno", category: "Masculino", image_url: corte6.url, alt_text: "Corte masculino moderno com degradê baixo" },
  { id: "corte-7", title: "Corte social", category: "Masculino", image_url: corte7.url, alt_text: "Corte social masculino com acabamento lateral" },
  { id: "corte-4", title: "Alisamento e finalização", category: "Feminino", image_url: corte4.url, alt_text: "Cabelo feminino longo, liso e finalizado" },
  { id: "corte-5", title: "Design de sobrancelhas", category: "Feminino", image_url: corte5.url, alt_text: "Resultado de design de sobrancelhas feminino" },
];

const Index = () => {
  const [barber, setBarber] = useState<BarberProfile | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>(fallbackPortfolio);
  const [category, setCategory] = useState("Todos");
  const [selectedImage, setSelectedImage] = useState<PortfolioItem | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const [profileResult, servicesResult, portfolioResult] = await Promise.all([
        supabase.from("barber_profile").select("*").maybeSingle(),
        supabase.from("services").select("id,name,description,duration_min,price").eq("is_active", true).order("name"),
        supabase.from("portfolio_items").select("id,title,category,image_url,alt_text").eq("is_active", true).order("sort_order"),
      ]);
      if (profileResult.data) setBarber(profileResult.data as BarberProfile);
      setServices((servicesResult.data as Service[]) || []);
      if (portfolioResult.data?.length) setPortfolio(portfolioResult.data as PortfolioItem[]);
    };
    loadData();
  }, []);

  const filteredPortfolio = useMemo(
    () => category === "Todos" ? portfolio : portfolio.filter((item) => item.category === category),
    [category, portfolio],
  );
  const categories = ["Todos", ...Array.from(new Set(portfolio.map((item) => item.category)))];
  const name = barber?.name || "Eric Zambonini";
  const experience = barber?.years_experience || new Date().getFullYear() - 2001;
  const instagram = barber?.instagram_url || "https://www.instagram.com/zamboninieric?stkn=ZTJ0ZmJ2bGRnYmNx";
  const facebook = barber?.facebook_url || "https://www.facebook.com/eric.zambonini.2025";
  const reviews = barber?.review_url || "https://g.page/r/CWECIhz8246XECE/review";
  const whatsapp = barber?.public_whatsapp?.replace(/\D/g, "");

  return <div className="min-h-screen bg-background overflow-x-hidden">
    <header className="fixed inset-x-0 top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-xl">
      <nav className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4" aria-label="Navegação principal">
        <a href="#inicio" className="font-semibold text-lg text-foreground">Eric <span className="text-primary">Zambonini</span></a>
        <div className="hidden items-center gap-7 md:flex">
          <a href="#servicos" className="text-sm text-muted-foreground hover:text-foreground">Serviços</a>
          <a href="#portfolio" className="text-sm text-muted-foreground hover:text-foreground">Trabalhos</a>
          <a href="#sobre" className="text-sm text-muted-foreground hover:text-foreground">Sobre</a>
          <Link to="/cliente" className="text-sm text-muted-foreground hover:text-foreground">Área do cliente</Link>
          <Button asChild><Link to="/agendar">Agendar</Link></Button>
        </div>
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}>
          {menuOpen ? <X /> : <Menu />}
        </Button>
      </nav>
      {menuOpen && <div className="border-t border-border bg-background px-4 py-4 md:hidden">
        <div className="flex flex-col gap-1">
          {[['Serviços','#servicos'],['Trabalhos','#portfolio'],['Sobre','#sobre']].map(([label, href]) => <a key={href} href={href} onClick={() => setMenuOpen(false)} className="py-3 text-foreground">{label}</a>)}
          <Link to="/cliente" className="py-3 text-foreground">Área do cliente</Link>
          <Button asChild className="mt-2 w-full"><Link to="/agendar">Agendar horário</Link></Button>
        </div>
      </div>}
    </header>

    <main>
      <section id="inicio" className="relative flex min-h-[92svh] items-end overflow-hidden pt-16">
        <img src={heroAsset.url} alt="Espaço de atendimento Eric Zambonini" className="absolute inset-0 h-full w-full object-cover" fetchPriority="high" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/45 to-background/15" />
        <div className="container relative z-10 mx-auto max-w-7xl px-4 pb-16 pt-28 md:pb-24">
          <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-primary">Beleza masculina e feminina · Desde 2001</p>
          <h1 className="max-w-4xl text-5xl font-bold leading-tight text-foreground md:text-7xl">{name}</h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-foreground/85 md:text-xl">
            {barber?.bio || "Cuidado, técnica e atendimento personalizado para valorizar o seu estilo."}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 px-7"><Link to="/agendar"><CalendarDays className="mr-2 h-5 w-5" />Agendar horário</Link></Button>
            <Button asChild size="lg" variant="outline" className="h-12 border-foreground/40 bg-background/70 px-7 backdrop-blur"><a href="#portfolio">Conhecer trabalhos</a></Button>
          </div>
        </div>
      </section>

      <section id="servicos" className="py-20 md:py-28">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="mb-10 max-w-2xl">
            <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-primary">Atendimento personalizado</p>
            <h2 className="text-3xl font-bold md:text-5xl">Serviços</h2>
            <p className="mt-4 text-muted-foreground">Escolha o serviço e consulte os horários disponíveis na agenda.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => <Card key={service.id} className="flex min-h-56 flex-col border-border bg-card p-6">
              <Scissors className="mb-6 h-6 w-6 text-primary" />
              <h3 className="text-xl font-semibold">{service.name}</h3>
              {service.description && <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{service.description}</p>}
              <div className="mt-6 flex items-end justify-between gap-4 border-t border-border pt-4">
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground"><Clock3 className="h-4 w-4" />{service.duration_min} min</span>
                <strong className="text-xl text-primary">{Number(service.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
              </div>
            </Card>)}
          </div>
          <Button asChild size="lg" className="mt-10"><Link to="/agendar">Ver horários disponíveis</Link></Button>
        </div>
      </section>

      <section id="portfolio" className="border-y border-border bg-card py-20 md:py-28">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div><p className="mb-2 text-sm font-semibold uppercase tracking-widest text-primary">Portfólio real</p><h2 className="text-3xl font-bold md:text-5xl">Trabalhos realizados</h2></div>
            <div className="flex max-w-full gap-2 overflow-x-auto pb-1" aria-label="Filtrar trabalhos">
              {categories.map((item) => <Button key={item} variant={category === item ? "default" : "outline"} size="sm" onClick={() => setCategory(item)}>{item}</Button>)}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
            {filteredPortfolio.map((item) => <button key={item.id} type="button" onClick={() => setSelectedImage(item)} className="group relative aspect-[4/5] overflow-hidden rounded-md bg-muted text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <img src={item.image_url} alt={item.alt_text} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 to-transparent p-4 pt-12 text-sm font-medium text-foreground">{item.title}</span>
            </button>)}
          </div>
        </div>
      </section>

      <section id="sobre" className="py-20 md:py-28">
        <div className="container mx-auto grid max-w-7xl gap-10 px-4 md:grid-cols-[1fr_1.2fr] md:items-center">
          <div className="border-l-2 border-primary pl-6">
            <Award className="mb-5 h-9 w-9 text-primary" />
            <p className="text-5xl font-bold text-foreground">{experience}+</p>
            <p className="mt-2 text-muted-foreground">anos de experiência desde 2001</p>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-primary">Sobre o profissional</p>
            <h2 className="text-3xl font-bold md:text-5xl">Experiência que acompanha o seu estilo</h2>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">Eric Zambonini atua desde 2001 com serviços masculinos e femininos, unindo técnica, atenção aos detalhes e uma experiência acolhedora.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild variant="outline"><a href={reviews} target="_blank" rel="noreferrer">Avaliar no Google</a></Button>
              <Button asChild><Link to="/agendar">Agendar atendimento</Link></Button>
            </div>
          </div>
        </div>
      </section>
    </main>

    <footer className="border-t border-border bg-card py-12">
      <div className="container mx-auto grid max-w-7xl gap-8 px-4 md:grid-cols-3">
        <div><p className="text-lg font-semibold">{name}</p><p className="mt-2 text-sm text-muted-foreground">Beleza masculina e feminina desde 2001.</p></div>
        <div>{barber?.address_text && <><p className="font-medium">Localização</p><p className="mt-2 text-sm text-muted-foreground">{barber.address_text}</p></>}</div>
        <div className="md:text-right"><p className="mb-3 font-medium">Acompanhe</p><div className="flex gap-2 md:justify-end">
          <Button asChild variant="outline" size="icon"><a href={instagram} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram /></a></Button>
          <Button asChild variant="outline" size="icon"><a href={facebook} target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook /></a></Button>
          {whatsapp && <Button asChild variant="outline" size="icon"><a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" aria-label="WhatsApp"><Phone /></a></Button>}
        </div></div>
      </div>
      <div className="container mx-auto mt-10 flex max-w-7xl flex-col gap-3 border-t border-border px-4 pt-6 text-xs text-muted-foreground sm:flex-row sm:justify-between">
        <span>© 2025 {name}. Todos os direitos reservados.</span><Link to="/admin" className="hover:text-foreground">Acesso administrativo</Link>
      </div>
    </footer>

    <Dialog open={Boolean(selectedImage)} onOpenChange={(open) => !open && setSelectedImage(null)}>
      <DialogContent className="max-w-4xl border-border bg-card p-2 sm:p-3">
        {selectedImage && <img src={selectedImage.image_url} alt={selectedImage.alt_text} className="max-h-[82vh] w-full rounded object-contain" />}
      </DialogContent>
    </Dialog>
  </div>;
};

export default Index;