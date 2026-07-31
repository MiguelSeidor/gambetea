"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError, setSession } from "@/lib/api";

export default function Registro() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.register({ email, password, displayName });
      setSession(res.accessToken, res.user);
      router.push("/dashboard");
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
      <h1>Crea tu cuenta</h1>
      <p className="sub">Regístrate, entra a una liga y arma tu plantilla.</p>

      <div className="field">
        <label htmlFor="name">Tu nombre (mánager)</label>
        <input id="name" type="text" placeholder="Míster" autoComplete="nickname"
          value={displayName} onChange={(e) => setDisplayName(e.target.value)} required minLength={2} />
      </div>
      <div className="field">
        <label htmlFor="email">Correo</label>
        <input id="email" type="email" placeholder="tu@correo.com" autoComplete="email"
          value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="pass">Contraseña</label>
        <input id="pass" type="password" placeholder="••••••••" autoComplete="new-password"
          value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
      </div>

      {error && <p className="auth-error">{error}</p>}

      <button className="btn" type="submit" disabled={loading}>
        <span>{loading ? "Creando…" : "Crear cuenta"}</span>
      </button>
      <p className="auth-alt">¿Ya tienes cuenta? <Link href="/login">Entra</Link></p>
    </form>
  );
}
