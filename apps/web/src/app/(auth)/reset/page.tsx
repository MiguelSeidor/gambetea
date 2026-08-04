"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";

export default function ResetPassword() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token");
    setToken(t);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (password !== confirm) return setError("Las contraseñas no coinciden.");
    if (!token) return setError("Falta el token del enlace.");
    setLoading(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
      setTimeout(() => router.push("/login"), 2200);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo conectar");
      setLoading(false);
    }
  }

  return (
    <form className="auth-card" onSubmit={onSubmit}>
      <div className="auth-brand">
        <img src="/brand/crest.webp" alt="" width={32} height={36} />
        <span className="wm">Gambetea</span>
      </div>
      <h1>Nueva contraseña</h1>

      {done ? (
        <>
          <p className="sub">¡Listo! Tu contraseña se ha cambiado. Te llevamos a la pantalla de entrada…</p>
          <p className="auth-alt"><Link href="/login">Entrar ahora</Link></p>
        </>
      ) : token === null ? (
        <p className="sub">Cargando…</p>
      ) : (
        <>
          <p className="sub">Elige una contraseña nueva para tu cuenta.</p>
          <div className="field">
            <label htmlFor="pass">Contraseña nueva</label>
            <input id="pass" type="password" placeholder="mínimo 8 caracteres" autoComplete="new-password"
              value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="conf">Repite la contraseña</label>
            <input id="conf" type="password" placeholder="repítela" autoComplete="new-password"
              value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          {error && <p className="auth-error">{error}</p>}
          <button className="btn" type="submit" disabled={loading}>
            <span>{loading ? "Guardando…" : "Cambiar contraseña"}</span>
          </button>
          <p className="auth-alt"><Link href="/login">Volver a entrar</Link></p>
        </>
      )}
    </form>
  );
}
