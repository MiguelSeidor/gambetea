import Interactions from "@/components/Interactions";

export default function Home() {
  return (
    <>
      <div className="grain" aria-hidden="true" />
      <div className="cursor" aria-hidden="true" />
      <div className="cursor-dot" aria-hidden="true" />

      <header className="nav" id="nav">
        <div className="wrap nav-in">
          <a className="brand" href="#top" aria-label="Gambetea, inicio">
            <img src="/brand/crest.webp" alt="" width={34} height={38} />
            <span className="wm">Gambetea</span>
          </a>
          <div className="nav-r">
            <a className="link" href="#pilares">
              Cómo se juega
            </a>
            <a className="link" href="#filosofia">
              Filosofía
            </a>
            <a className="link" href="/login">
              Entrar
            </a>
            <a className="btn" data-mag href="/registro">
              <span>Quiero jugar</span>
            </a>
          </div>
        </div>
      </header>

      <main id="top">
        {/* HERO */}
        <section className="hero">
          <div className="hero-media" data-par="0.16" aria-hidden="true" />
          <div className="hero-scrim" aria-hidden="true" />
          <div className="side-label" aria-hidden="true">
            Gambetea — Est. 2026
          </div>
          <div className="wrap hero-in">
            <div className="eyebrow label tick fadeup" style={{ transitionDelay: ".05s" }}>
              Fantasy de fútbol · Nueva generación
            </div>
            <h1 className="big">
              <span className="ln">
                <span className="rise">Regatea</span>
              </span>
              <span className="ln">
                <span className="rise" style={{ transitionDelay: ".08s" }}>
                  a toda
                </span>
              </span>
              <span className="ln">
                <span className="rise go" style={{ transitionDelay: ".16s" }}>
                  la liga
                </span>
              </span>
            </h1>
            <p className="lead fadeup" style={{ transitionDelay: ".3s" }}>
              El Fantasy de siempre, con una gambeta nueva: no solo fichas <b>jugadores</b>. Fichas{" "}
              <b>entrenadores</b> y construyes tu <b>propio estadio</b>.
            </p>
            <div className="cta-row fadeup" style={{ transitionDelay: ".4s" }}>
              <a className="btn" data-mag href="/registro">
                <span>Crear cuenta gratis</span>
              </a>
              <a className="link" href="/login" style={{ marginLeft: "1.1rem", alignSelf: "center" }}>
                ¿Ya juegas? Entrar
              </a>
            </div>
          </div>
          <div className="scrollcue" aria-hidden="true">
            Scroll <i />
          </div>
        </section>

        {/* MARQUEE */}
        <div className="marquee" aria-hidden="true">
          <div className="mq-track" id="mqTrack" />
        </div>

        {/* INTRO / FILOSOFÍA */}
        <section className="intro wrap" id="filosofia">
          <div className="label tick rv">La filosofía</div>
          <p className="stmt rv" style={{ transitionDelay: ".05s" }}>
            La simplicidad del clásico. <span className="dim">La audacia de</span> <em>algo nuevo.</em>
          </p>
          <div className="intro-grid">
            <p className="rv" style={{ transitionDelay: ".1s" }}>
              Fácil de jugar desde el primer minuto, con la profundidad justa para que no puedas soltarlo.{" "}
              <b>Sin tácticas imposibles, sin contratos, sin menús infinitos.</b> Lo complicado lo dejamos
              fuera.
            </p>
            <p className="rv" style={{ transitionDelay: ".16s" }}>
              Nos inspiramos en Comunio, Biwenger y Futmondo — pero no copiamos a nadie. Añadimos lo que a
              todos les falta.
            </p>
          </div>
        </section>

        {/* PINNED PILLARS */}
        <section className="pin-wrap" id="pilares">
          <div className="pin-stage">
            <div className="pin-head label" aria-hidden="true">
              Tres formas de ganar el partido
            </div>

            <div className="panel on" data-i="0">
              <div className="panel-media m0" />
              <div className="panel-body">
                <div className="idx">01</div>
                <div className="ptag label tick">Jugadores</div>
                <h3>
                  El mercado
                  <br />
                  de siempre
                </h3>
                <p>
                  Compra, vende y alinea. Puntúan por lo que hacen de verdad sobre el césped, jornada a
                  jornada. Sin curvas de aprendizaje.
                </p>
              </div>
            </div>

            <div className="panel" data-i="1">
              <div className="panel-media m1" />
              <div className="panel-body">
                <div className="idx">02</div>
                <div className="ptag label tick">Entrenadores</div>
                <h3>
                  La pieza que
                  <br />
                  nadie tiene
                </h3>
                <p>
                  Fíchalos en el mercado como a un jugador. Puntúan con un algoritmo propio: tu banquillo
                  también juega el partido.
                </p>
              </div>
            </div>

            <div className="panel" data-i="2">
              <div className="panel-media m2" />
              <div className="panel-body">
                <div className="idx">03</div>
                <div className="ptag label tick">Estadio</div>
                <h3>
                  Tu casa,
                  <br />
                  tu ventaja
                </h3>
                <p>
                  Un estadio de verdad tuyo. Mejóralo temporada a temporada y desbloquea ventajas pasivas que
                  trabajan por ti.
                </p>
              </div>
            </div>

            <div className="pin-rail" id="pinRail">
              <button data-go="0" className="on">
                <span>01</span>
                <i />
              </button>
              <button data-go="1">
                <span>02</span>
                <i />
              </button>
              <button data-go="2">
                <span>03</span>
                <i />
              </button>
            </div>
          </div>
        </section>

        {/* STATS */}
        <section className="stats">
          <div className="wrap stats-in">
            <div className="stat rv">
              <div className="n" data-count="3">
                0
              </div>
              <div className="l">pilares de juego en uno</div>
            </div>
            <div className="stat rv" style={{ transitionDelay: ".1s" }}>
              <div className="n" data-count="0">
                0
              </div>
              <div className="l">menús de Football Manager</div>
            </div>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="access-sec wrap" id="acceso">
          <div className="access rv">
            <div className="access-in">
              <span className="label tick">Empieza ya</span>
              <h2>
                Monta tu equipo
                <br />
                y a gambetear
              </h2>
              <p>Crea tu cuenta, ficha jugadores y entrenadores, construye tu estadio y compite.</p>
              <div className="signup">
                <a className="btn" data-mag href="/registro">
                  <span>Crear cuenta gratis</span>
                </a>
                <a className="link" href="/login" style={{ marginLeft: "1.1rem", alignSelf: "center" }}>
                  Ya tengo cuenta
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap">
          <h2 className="foot-word" aria-label="Gambetea">
            Gambetea
          </h2>
          <div className="foot-meta">
            <p className="tag">Hecho para los que juegan distinto.</p>
            <nav className="foot-links" aria-label="Pie">
              <a href="#pilares">Cómo se juega</a>
              <a href="#filosofia">Filosofía</a>
              <a href="/login">Entrar</a>
              <a href="/registro">Crear cuenta</a>
            </nav>
            <p className="tag" style={{ fontFamily: "var(--mono)", letterSpacing: ".1em" }}>
              © 2026 · Prototipo
            </p>
          </div>
        </div>
      </footer>

      <Interactions />
    </>
  );
}
