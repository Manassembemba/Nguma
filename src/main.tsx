import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from 'virtual:pwa-register';

// Register service worker for PWA functionality
const updateSW = registerSW({
    onNeedRefresh() {
        if (confirm('Une nouvelle version est disponible. Recharger maintenant ?')) {
            updateSW(true);
        }
    },
    onOfflineReady() {
        console.log('✅ Application prête pour le mode offline');
    },
});

createRoot(document.getElementById("root")!).render(<App />);
