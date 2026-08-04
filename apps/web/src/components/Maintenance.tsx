// Página de mantenimiento. Se muestra cuando la variable de entorno MAINTENANCE está activa
// (se lee en el servidor en tiempo de ejecución: se enciende/apaga sin reconstruir el build).
export default function Maintenance() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, textAlign: "center", background: "var(--bg, #08070b)", color: "var(--ink, #f3f0f7)" }}>
      <div style={{ maxWidth: 440 }}>
        <img src="/brand/crest.webp" alt="Gambetea" width={56} height={64} style={{ marginBottom: 20 }} />
        <h1 style={{ fontFamily: "var(--font-display), sans-serif", fontSize: "2.4rem", textTransform: "uppercase", lineHeight: 1.05, margin: "0 0 12px" }}>
          Volvemos enseguida
        </h1>
        <p style={{ color: "var(--muted, #a29db0)", fontSize: "1rem", lineHeight: 1.6, margin: 0 }}>
          Estamos haciendo tareas de mantenimiento para mejorar Gambetea. En unos minutos podrás
          volver a gambetear. Gracias por la paciencia.
        </p>
      </div>
    </div>
  );
}
