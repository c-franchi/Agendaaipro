// Sistema desenvolvido por Dev Nei
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
import ClienteAgendamentos from "./pages/cliente/Agendamentos";
import ClientePerfil from "./pages/cliente/Perfil";
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
import ProtectedRoute from "./components/ProtectedRoute";

// Cliente global de cache e requisições assíncronas
const queryClient = new QueryClient();

// Componente raiz com providers e rotas do sistema
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/agendar" element={<ProtectedRoute><Agendar /></ProtectedRoute>} />
          <Route path="/pagar" element={<ProtectedRoute><Pagar /></ProtectedRoute>} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/dashboard" element={<ProtectedRoute role="admin"><Dashboard /></ProtectedRoute>} />
          <Route path="/admin/agenda" element={<ProtectedRoute role="admin"><Agenda /></ProtectedRoute>} />
          <Route path="/admin/chat" element={<ProtectedRoute role="admin"><Chat /></ProtectedRoute>} />
          <Route path="/admin/servicos" element={<ProtectedRoute role="admin"><Servicos /></ProtectedRoute>} />
          <Route path="/admin/financeiro" element={<ProtectedRoute role="admin"><Financeiro /></ProtectedRoute>} />
          <Route path="/admin/configuracoes" element={<ProtectedRoute role="admin"><Configuracoes /></ProtectedRoute>} />
          <Route path="/admin/perfil" element={<ProtectedRoute role="admin"><Perfil /></ProtectedRoute>} />
          <Route path="/admin/usuarios" element={<ProtectedRoute role="admin"><Usuarios /></ProtectedRoute>} />
          <Route path="/cliente" element={<Cliente />} />
          <Route path="/cliente/agendamentos" element={<ProtectedRoute><ClienteAgendamentos /></ProtectedRoute>} />
          <Route path="/cliente/perfil" element={<ProtectedRoute><ClientePerfil /></ProtectedRoute>} />
          <Route path="/cliente/chat" element={<ProtectedRoute><ClienteChat /></ProtectedRoute>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
