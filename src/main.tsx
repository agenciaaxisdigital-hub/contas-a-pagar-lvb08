import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Startup performance marker
if (typeof performance !== 'undefined') {
  performance.mark('app-init-start');
}

// Guard: não registrar SW em iframe ou preview do Lovable
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if (isPreviewHost || isInIframe) {
  navigator.serviceWorker?.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister());
  });
} else if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        console.log('[SW] Registrado com sucesso, scope:', reg.scope);
        // Check for updates every hour
        setInterval(() => reg.update(), 60 * 60 * 1000);
      })
      .catch((err) => console.warn("[SW] Falha no registro:", err));
  });
}

createRoot(document.getElementById("root")!).render(<App />);

// Startup performance measurement
if (typeof performance !== 'undefined') {
  window.addEventListener('load', () => {
    performance.mark('app-load-complete');
    try {
      const measure = performance.measure('app-startup', 'app-init-start', 'app-load-complete');
      console.log(`[PERF] Startup total: ${Math.round(measure.duration)}ms`);
    } catch { /* ignore */ }
  });
}
