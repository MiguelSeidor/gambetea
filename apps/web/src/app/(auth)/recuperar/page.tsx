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
      await api.forgotPassword(email);
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
          <p className="sub">Si existe una cuenta con ese correo, te hemos enviado un enlace para restablecer la contraseña. Revisa tu bandeja (y el spam). El enlace caduca en 1 hora.</p>
          <p className="auth-alt"><Link href="/login">Volver a entrar</Link></p>
        </>
      ) : (
        <>
          <p className="sub">Escribe tu correo y te enviaremos un enlace para elegir una nueva contraseña.</p>
          <div className="field">
            <label htmlFor="email">Correo</label>
            <input id="email" type="email" placeholder="tu@correo.com" autoComplete="email"
              value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <button className="btn" type="submit" disabled={loading}>
            <span>{loading ? "Enviando…" : "Enviar enlace"}</span>
          </button>
          <p className="auth-alt">¿Ya la recuerdas? <Link href="/login">Entrar</Link></p>
        </>
      )}
    </form>
  );
}
