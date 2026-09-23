// Sistema desenvolvido por Dev Nei
// Configuração do Vite para o frontend
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Eric Zambonini — atendimento e agendamento online.
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
