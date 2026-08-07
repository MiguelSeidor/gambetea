"use client";

import { useEffect } from "react";

/** Registra el service worker (PWA) tras cargar la página. Silencioso: si falla, no molesta. */
export default function PwaRegister() {
  useEffect(() => {
    // Solo en producción: en desarrollo el SW cachearía chunks y estorbaría al hot-reload.
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const register = () => void navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);
  return null;
}
