import { useEffect } from "react";
import { db } from "@/lib/dexieDb";

export default function VersionMonitor() {
  const version = import.meta.env.VITE_APP_VERSION || "DEV";

  useEffect(() => {
    // Safe update check — only when idle and no pending sync
    const checkUpdate = async () => {
      if (!("serviceWorker" in navigator)) return;
      try {
        // Don't force reload if there are pending sync operations
        const pendingCount = await db.syncQueue
          .where("status")
          .equals("PENDING")
          .count();

        if (pendingCount > 0) {
          console.log(`[VER] Skipping update check: ${pendingCount} pending sync ops`);
          return;
        }

        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          await reg.update();
        }
      } catch (err) {
        console.warn("[VER] Update check error:", err);
      }
    };

    // Check every 3 hours (reduced from 5h for fresher updates, but not aggressive)
    const interval = setInterval(checkUpdate, 3 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        bottom: "4px",
        right: "4px",
        fontSize: "10px",
        color: "rgba(255,255,255,0.4)",
        zIndex: 99999,
        pointerEvents: "none",
        fontFamily: "monospace",
        fontWeight: 600,
        textShadow: "0px 1px 2px rgba(0,0,0,0.8)",
      }}
      title="Monitor de Versão"
    >
      v.{version}
    </div>
  );
}
