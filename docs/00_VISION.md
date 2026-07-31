# 00 — Visión del proyecto (La Constitución)

> Documento fundacional. Define **qué es** el proyecto, **qué no es**, su filosofía y sus
> restricciones. Cualquier decisión posterior debe ser coherente con este documento.

---

## 1. Qué es

Una plataforma de **Fantasy Football** de nueva generación. Mantiene la **simplicidad de un
Fantasy clásico** (al estilo Comunio) y añade mecánicas nuevas propias.

Se inspira en **Comunio**, **Biwenger** y **Futmondo**, pero **no copia** ninguna.

### Los tres pilares

1. **Jugadores** — Funcionan como en Comunio: aparecen en el mercado, se compran/venden y
   puntúan según su rendimiento real en los partidos.
2. **Entrenadores** — Aparecen en el mercado y puntúan mediante un **algoritmo propio**.
   Es una mecánica diferencial que ningún Fantasy clásico tiene.
3. **Estadio propio** — Completamente **ficticio**. Es una mecánica de **progresión**: se
   mejora con el tiempo y las mejoras generan **modificadores pasivos** sobre el rendimiento
   del equipo Fantasy del usuario.

## 2. Qué NO es

- **No es un clon** de Comunio, Biwenger ni Futmondo. Nos inspiramos en su simplicidad; no
  replicamos sus mecánicas ni su producto.
- **No es un Football Manager.** No hay:
  - tácticas ni esquemas complejos
  - contratos, salarios ni cláusulas realistas
  - entrenamientos ni evolución deportiva simulada
  - gestión deportiva avanzada

  La complejidad del producto vive en las **mecánicas Fantasy** (mercado, entrenadores,
  estadio), no en simular la realidad de un club.

## 3. Filosofía técnica

1. **Datos propios siempre.** La aplicación **nunca** consulta un proveedor externo en
   tiempo real para servir al usuario. Todo se sincroniza previamente a nuestra base de
   datos. → Patrón **Football Data Hub** (sección 4).
2. **Desacoplamiento del proveedor.** Debe ser posible **cambiar de proveedor de datos sin
   modificar el resto del sistema**. El proveedor es un detalle reemplazable.
3. **IDs internos.** Todas las entidades (jugadores, equipos, partidos…) tienen un ID
   propio. Los IDs externos de cada proveedor se guardan solo como referencia de mapeo.
4. **Portabilidad.** La arquitectura no se diseña para ningún hosting concreto. Debe poder
   desplegarse en local, en Railway o en cualquier proveedor equivalente sin reescrituras.
5. **Escalabilidad desde el diseño.** Se piensa para años, no para un MVP desechable. No se
   toman atajos que impidan crecer.

## 4. Arquitectura objetivo: Football Data Hub

El corazón del sistema es un **hub de datos** que aísla al producto de las fuentes externas:

```
  Proveedor(es) externos
          │
          ▼
   Ingesta + Normalización        ← traduce cada proveedor a NUESTRO modelo e IDs internos
          │
          ▼
   Base de datos propia           ← única fuente de verdad para la aplicación
          │
          ▼
   Backend Fantasy                ← lógica de juego: mercado, puntuaciones, entrenadores, estadio
          │
          ▼
   Frontend                       ← solo habla con nuestro backend, jamás con proveedores
```

**Regla derivada:** ningún componente aguas abajo (backend Fantasy, frontend) sabe ni le
importa de dónde vinieron los datos. Solo el módulo de ingesta conoce a los proveedores.

## 5. Restricciones

- **No diseñar para Hostinger.** No usar Hostinger ni condicionar la arquitectura a él.
- **No depender de una única API.** La estrategia de datos debe contemplar redundancia y
  reemplazo de proveedores.
- **No copiar Comunio.** Ni producto, ni mecánicas, ni economía tal cual.
- **No derivar hacia un Football Manager.** Ver sección 2.
- **No empezar a programar** hasta cerrar investigación y arquitectura. Ver roadmap.

## 6. Objetivos de negocio (alto nivel)

- Ofrecer un Fantasy sencillo de jugar pero con **profundidad diferencial** vía entrenadores
  y estadio.
- Soportar **múltiples ligas** desde el diseño (no atarse a una sola competición).
- Construir una base técnica reutilizable y mantenible a largo plazo.

## 7. Alcance de datos a cubrir (para múltiples ligas)

La estrategia de datos debe, idealmente, cubrir: jugadores, entrenadores, lesiones,
sanciones, alineaciones, sustituciones, resultados, eventos de partido, fotografías,
calendario, estadísticas y cambios de entrenador.

> El grado en que cada uno es alcanzable/costeable se decide en la investigación
> (`research/`) y se cierra en ADRs.
