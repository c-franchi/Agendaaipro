import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Agendar from "./pages/Agendar";
import Pagar from "./pages/Pagar";
import Admin from "./pages/Admin";
import Cliente from "./pages/Cliente";
import ClienteChat from "./pages/cliente/Chat";
import Dashboard from "./pages/admin/Dashboard";
import Agenda from "./pages/admin/Agenda";
import Chat from "./pages/admin/Chat";
import Servicos from "./pages/admin/Servicos";
import Financeiro from "./pages/admin/Financeiro";
import Configuracoes from "./pages/admin/Configuracoes";
import Perfil from "./pages/admin/Perfil";
import Usuarios from "./pages/admin/Usuarios";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/agendar" element={<Agendar />} />
          <Route path="/pagar" element={<Pagar />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/dashboard" element={<Dashboard />} />
          <Route path="/admin/agenda" element={<Agenda />} />
          <Route path="/admin/chat" element={<Chat />} />
          <Route path="/admin/servicos" element={<Servicos />} />
          <Route path="/admin/financeiro" element={<Financeiro />} />
          <Route path="/admin/configuracoes" element={<Configuracoes />} />
          <Route path="/admin/perfil" element={<Perfil />} />
          <Route path="/admin/usuarios" element={<Usuarios />} />
          <Route path="/cliente" element={<Cliente />} />
          <Route path="/cliente/chat" element={<ClienteChat />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
