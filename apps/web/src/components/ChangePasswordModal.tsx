"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";

// Modal de cambio de contraseña, disponible para cualquier usuario logueado.
export default function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [cur, setCur] = useState("");
  const [nw, setNw] = useState("");
  const [conf, setConf] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (nw.length < 8) return setError("La nueva contraseña debe tener al menos 8 caracteres.");
    if (nw !== conf) return setError("Las contraseñas no coinciden.");
    setBusy(true);
    try {
      await api.changePassword(cur, nw);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo conectar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3 className="modal-title">Cambiar contraseña</h3>
        {done ? (
          <>
            <div className="modal-body"><p>Tu contraseña se ha actualizado correctamente.</p></div>
            <div className="modal-actions"><button className="btn-sm" onClick={onClose}>Cerrar</button></div>
          </>
        ) : (
          <form onSubmit={submit}>
            <div className="field" style={{ marginTop: 4 }}>
              <label htmlFor="cur">Contraseña actual</label>
              <input id="cur" type="password" value={cur} onChange={(e) => setCur(e.target.value)} required autoComplete="current-password" />
            </div>
            <div className="field">
              <label htmlFor="nw">Nueva contraseña</label>
              <input id="nw" type="password" value={nw} onChange={(e) => setNw(e.target.value)} required autoComplete="new-password" placeholder="mínimo 8 caracteres" />
            </div>
            <div className="field">
              <label htmlFor="conf">Repite la nueva</label>
              <input id="conf" type="password" value={conf} onChange={(e) => setConf(e.target.value)} required autoComplete="new-password" />
            </div>
            {error && <p className="auth-error" style={{ marginTop: 8 }}>{error}</p>}
            <div className="modal-actions">
              <button type="button" className="btn-sm ghost" onClick={onClose} disabled={busy}>Cancelar</button>
              <button type="submit" className="btn-sm" disabled={busy}>{busy ? "…" : "Cambiar"}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
