"use client";

import { useEffect } from "react";

/** Registra el service worker (PWA) y garantiza que SIEMPRE se sirva la última versión desplegada:
 *  revalida el SW en cada carga y, cuando entra un SW nuevo, refresca la página una sola vez. */
export default function PwaRegister() {
  useEffect(() => {
    // Solo en producción: en desarrollo el SW estorbaría al hot-reload.
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    let refreshing = false;
    // Cuando el SW nuevo toma el control, recargamos una vez para cargar el build fresco.
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    const register = async () => {
      try {
        // updateViaCache "none": el navegador NO cachea el propio sw.js → detecta cambios al instante.
        const reg = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
        await reg.update();
        // Si ya hay un SW esperando (nuevo build), actívalo ya.
        const waiting = reg.waiting;
        if (waiting) waiting.postMessage("SKIP_WAITING");
        reg.addEventListener("updatefound", () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener("statechange", () => {
            if (nw.state === "installed" && navigator.serviceWorker.controller) nw.postMessage("SKIP_WAITING");
          });
        });
      } catch {
        /* si falla, no molesta */
      }
    };

    if (document.readyState === "complete") void register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);
  return null;
}
