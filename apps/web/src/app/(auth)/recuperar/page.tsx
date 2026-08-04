"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";

export default function Recuperar() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.requestReset(email);
    } finally {
      setSent(true); // se muestra siempre lo mismo, exista o no la cuenta
      setLoading(false);
    }
  }

  return (
    <form className="auth-card" onSubmit={onSubmit}>
      <div className="auth-brand">
        <img src="/brand/crest.webp" alt="" width={32} height={36} />
        <span className="wm">Gambetea</span>
      </div>
      <h1>Recuperar contraseña</h1>

      {sent ? (
        <>
          <p className="sub">Hemos enviado tu solicitud al administrador. Cuando la apruebe, tu contraseña pasará a ser <b>12345678</b>; entra con ella y cámbiala desde tu cuenta.</p>
          <p className="auth-alt"><Link href="/login">Volver a entrar</Link></p>
        </>
      ) : (
        <>
          <p className="sub">Escribe tu correo y enviaremos una solicitud de reseteo al administrador para que la apruebe.</p>
          <div className="field">
            <label htmlFor="email">Correo o usuario</label>
            <input id="email" type="text" placeholder="tu@correo.com" autoComplete="username"
              value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <button className="btn" type="submit" disabled={loading}>
            <span>{loading ? "Enviando…" : "Solicitar reseteo"}</span>
          </button>
          <p className="auth-alt">¿Ya la recuerdas? <Link href="/login">Entrar</Link></p>
        </>
      )}
    </form>
  );
}
