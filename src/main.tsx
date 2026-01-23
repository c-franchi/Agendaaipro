// Sistema desenvolvido por Dev Nei
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker, requestNotificationPermission } from "./utils/pwa";

// Registrar Service Worker e solicitar permissão para notificações
registerServiceWorker();
requestNotificationPermission();

// Montar a aplicação React no elemento root
createRoot(document.getElementById("root")!).render(<App />);
