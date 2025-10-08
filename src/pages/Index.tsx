import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Star, Clock, Award, Instagram, Phone } from "lucide-react";
import heroImage from "@/assets/hero-barber.jpg";
import haircut1 from "@/assets/haircut1.jpg";
import haircut2 from "@/assets/haircut2.jpg";
import haircut3 from "@/assets/haircut3.jpg";
import haircut4 from "@/assets/haircut4.jpg";
import beard1 from "@/assets/beard1.jpg";
import shave1 from "@/assets/shave1.jpg";
const Index = () => {
  const [barber, setBarber] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  useEffect(() => {
    loadData();
  }, []);
  async function loadData() {
    const {
      data: barberData
    } = await supabase.from("barber_profile").select("*").single();
    const {
      data: servicesData
    } = await supabase.from("services").select("*").eq("is_active", true);
    setBarber(barberData);
    setServices(servicesData || []);
  }
  const galleryImages = [haircut1, haircut2, haircut3, haircut4, beard1, shave1];
  return <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative h-screen">
        <div className="absolute inset-0 bg-cover bg-center" style={{
        backgroundImage: `url(${heroImage})`
      }}>
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80" />
        </div>
        
        <div className="relative z-10 container mx-auto px-4 h-full flex flex-col justify-center items-center text-center">
          <div className="flex items-center gap-2 mb-4">
            <Star className="w-6 h-6 text-primary fill-primary" />
            <Star className="w-6 h-6 text-primary fill-primary" />
            <Star className="w-6 h-6 text-primary fill-primary" />
            <Star className="w-6 h-6 text-primary fill-primary" />
            <Star className="w-6 h-6 text-primary fill-primary" />
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-4 text-foreground">
            {barber?.name || "Ricardo Silva"}
          </h1>
          
          <p className="text-xl md:text-2xl mb-8 max-w-2xl text-slate-50">
            {barber?.bio || "Barbeiro profissional especializado em cortes clássicos e modernos"}
          </p>
          
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <Card className="bg-card/80 backdrop-blur-sm p-4 flex items-center gap-3">
              <Award className="w-8 h-8 text-primary" />
              <div className="text-left">
                <p className="text-2xl font-bold text-foreground">{barber?.years_experience || 10}+</p>
                <p className="text-sm text-muted-foreground">Anos de Experiência</p>
              </div>
            </Card>
            
            <Card className="bg-card/80 backdrop-blur-sm p-4 flex items-center gap-3">
              <Clock className="w-8 h-8 text-primary" />
              <div className="text-left">
                <p className="text-2xl font-bold text-foreground">500+</p>
                <p className="text-sm text-muted-foreground">Clientes Satisfeitos</p>
              </div>
            </Card>
          </div>
          
          <Link to="/agendar">
            <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 text-lg px-8 py-6">
              Agendar Horário
            </Button>
          </Link>
        </div>
      </section>

      {/* Galeria */}
      <section className="py-20 bg-card">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-12 text-foreground">
            Nossos Trabalhos
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {galleryImages.map((img, idx) => <div key={idx} className="aspect-square overflow-hidden rounded-lg border-2 border-border hover:border-primary transition-colors cursor-pointer">
                <img src={img} alt={`Trabalho ${idx + 1}`} className="w-full h-full object-cover hover:scale-110 transition-transform duration-300" />
              </div>)}
          </div>
        </div>
      </section>

      {/* Serviços */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-12 text-foreground">
            Nossos Serviços
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {services.map(service => <Card key={service.id} className="p-6 text-center bg-card border-border hover:border-primary transition-colors">
                <h3 className="text-2xl font-bold mb-2 text-foreground">{service.name}</h3>
                <p className="text-muted-foreground mb-4">{service.description}</p>
                <p className="text-sm text-muted-foreground mb-2">{service.duration_min} minutos</p>
                <p className="text-3xl font-bold text-primary">
                  R$ {parseFloat(service.price).toFixed(2)}
                </p>
              </Card>)}
          </div>
          
          <div className="text-center mt-12">
            <Link to="/agendar">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
                Agendar Agora
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card py-8 border-t border-border">
        <div className="container mx-auto px-4 text-center">
          <div className="flex justify-center gap-4 mb-4">
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
              <Instagram className="w-6 h-6" />
            </a>
            <a href="https://wa.me/5511999999999" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
              <Phone className="w-6 h-6" />
            </a>
          </div>
          <p className="text-muted-foreground">
            © 2024 {barber?.name || "BarberPro"}. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>;
};
export default Index;