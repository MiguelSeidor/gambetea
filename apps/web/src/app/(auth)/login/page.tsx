"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError, setSession } from "@/lib/api";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.login({ email, password });
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
      <h1>Bienvenido</h1>
      <p className="sub">Entra y sigue gambeteando a toda la liga.</p>

      <div className="field">
        <label htmlFor="email">Correo o usuario</label>
        <input id="email" type="text" placeholder="tu@correo.com" autoComplete="username"
          value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="pass">Contraseña</label>
        <input id="pass" type="password" placeholder="••••••••" autoComplete="current-password"
          value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>

      {error && <p className="auth-error">{error}</p>}

      <button className="btn" type="submit" disabled={loading}>
        <span>{loading ? "Entrando…" : "Entrar"}</span>
      </button>
      <p className="auth-alt">¿No tienes cuenta? <Link href="/registro">Regístrate</Link></p>
    </form>
  );
}
