// Sistema desenvolvido por Dev Nei
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./utils/pwa";

// Registra o aplicativo; a permissão de notificações é solicitada após uma ação do usuário.
registerServiceWorker();

// Montar a aplicação React no elemento root
createRoot(document.getElementById("root")!).render(<App />);
