# CLAUDE.md

Chancón: plataforma web multi-colegio de preguntas de opción múltiple con repaso
espaciado **FSRS** (`ts-fsrs`). Roles: admin (`/admin`), profesor (`/profesor`),
estudiante (`/estudiante`). El aislamiento entre colegios se aplica con RLS en
PostgreSQL. Detalle funcional en [README.md](README.md) y `docs/`.

## Stack y estructura

- `frontend/` — SPA React 19 + Vite + TypeScript, Tailwind 4, TanStack Query,
  React Router, React Hook Form + Zod, KaTeX. Despliegue en Netlify
  (`netlify.toml`).
- `supabase/functions/` — Edge Functions en Deno. Lógica compartida en
  `_shared/` (auth, errores, router, FSRS, validación, Gmail, Mercado Pago, planes).
- `supabase/migrations/` — esquema SQL (RLS, RPCs). Nombres de tablas/vistas/RPCs
  centralizados en `_shared/database.constants.ts`.
- Monorepo pnpm (workspace solo incluye `frontend`). Siempre ejecutar desde la raíz.

## Comandos

```sh
pnpm install
pnpm exec supabase start              # Supabase local (Docker)
pnpm exec supabase functions serve    # Edge Functions (env en supabase/functions/.env)
pnpm --filter frontend dev            # http://localhost:5173

pnpm --filter frontend lint | test | test:e2e | build
pnpm test:unit            # deno test de supabase/functions/_shared
pnpm test:integration     # requiere Git Bash y Supabase local
pnpm check:functions      # deno check de cada función + deno lint
pnpm format:functions     # deno fmt

# Tras cambiar el esquema:
pnpm exec supabase gen types --local --schema public > supabase/functions/_shared/database.types.ts
```

## Convenciones del backend (Edge Functions)

- Cada función tiene su propio `deno.json` + `deno.lock`, `index.ts` e
  `interfaces.ts` (contratos de request junto al handler).
- `index.ts` envuelve con `withAppSupabase({ auth: ... })` → `handle()` →
  `routeRequest()` de `_shared/router.ts`.
- **Un endpoint = una responsabilidad**: sub-rutas + verbos HTTP
  (`"POST /payment/simulate": handler`), nunca un switch por campo `action`.
  Ejemplo de referencia: `supabase/functions/account/index.ts`.
- Errores con `AppError(status, code, message)` de `_shared/errors.ts`.
- Al crear una función nueva: añadirla a `scripts/check-edge-functions.sh`, y si
  es pública, `verify_jwt = false` en `supabase/config.toml`.
- Nunca exponer `service_role` ni secretos al cliente. Evitar nuevas variables de
  entorno; los secretos de producción van en Supabase Vault.

## Convenciones del frontend

- Organización por dominio en `src/features/<dominio>/` con un `api.ts` que
  concentra las llamadas; las páginas (`src/pages/<rol>/`) no llaman a Supabase
  directamente.
- Edge Functions se invocan con `invokeFunction()` de `src/lib/api/functions.ts`
  (ej. `"account/payment"`, con `method` para GET/PUT/DELETE).
- Los errores de endpoints se muestran con toast (`components/ui/toast.tsx`).
- **Estados de carga: siempre `Skeleton`** (`components/ui/skeleton.tsx`) con la
  forma del contenido (tarjetas, filas, títulos), no `Spinner` ni textos
  "Cargando…". Única excepción: la carga de las 20 preguntas de la práctica del
  estudiante, que conserva su indicador propio. Cualquier otra excepción la
  indica el usuario.
- Antes de crear UI reutilizable, revisar y actualizar
  [docs/Componentes_Reutilizables.md](docs/Componentes_Reutilizables.md).
- Solo `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` en `.env.local`;
  todo lo `VITE_` es público.
- Tests junto al archivo (`*.test.ts(x)`), Vitest + Testing Library.

## Estilo visual

Fantasía oscura sobria ("Elden Ring" atenuado) con los colores de la marca:
debe sentirse como un juego para adultos, nunca infantil, y conservar la
seriedad de un SaaS. Hay dos variantes, cada una con su referencia visual
(guía de estilo en `src/pages/style-guide/`, solo disponible en desarrollo):

- **Portales (estudiante, profesor y admin): estilo 1.5**, descrito abajo.
  Referencia: `/textura/elden-ring-1-5` (`EldenHalfPage.tsx`). **En
  migración**: aplicado en `components/ui`, `PortalLayout` y las pantallas del
  estudiante, profesor y admin (variante `portal:` y tokens en `styles.css`);
  falta revisar cada pantalla a la vista.
- **Home y páginas públicas: estilo SaaS**, más sobrio: Inter en todo, sin
  esquinas ni grano; Cinzel solo en los títulos (`font-display`); acento
  verde sin dorado; botón principal verde sólido con texto oscuro. Referencia:
  `/textura/elden-ring-saas` (`EldenSaasPage.tsx`). **Aplicado** en la home,
  `PlanCards`, el pie de `PublicLayout`, el login y el registro (con colores
  `emerald` de Tailwind hasta tener los tokens). Pendiente: invitación, nueva
  contraseña, renovación (`AuthLayout` sin `dark`), páginas legales (sus
  enlaces siguen en índigo) y libro de reclamaciones.

**El estilo es universal.** Todos los componentes de una zona usan el mismo
estilo. Si algo no se ve bien dentro de un recuadro con esquinas (p. ej. un
formulario largo), se quita el recuadro; no se inventa otro marco. Las
esquinas doradas van en contenedores (tarjetas, paneles, modales), no en
controles (botones, inputs, filas de tabla). Cualquier excepción a esta regla
se conversa con el usuario antes de aplicarla; no se decide sola.

Excepciones aprobadas (no hay otras):

- **Impresión y PDF** (libro de reclamaciones impreso, hoja de reclamos en PDF)
  mantienen su estilo claro de siempre; no usan el tema.
- **Imágenes con fondo propio** (QR y pantalla de Yape, logo de Yape, imagen del
  Libro de reclamaciones) conservan su fondo; todo lo que no es imagen sigue el
  estilo.
- **Correos HTML** (`supabase/functions/_shared/email.ts`): cambio sutil a la
  marca (botón verde jade con texto oscuro, en lugar del índigo `#4f46e5`).
  Colores fijos: no siguen el tema que edite el admin.
- **Advertencias** (alertas, botón y modal `warning`): amarillo (`yellow-400`),
  nunca el dorado `#c9a961`, que es solo ornamento.
- **Login, registro y todas las páginas públicas**: estilo SaaS (el de la home),
  no el 1.5, y en oscuro (el formulario del login deja de ser blanco).
- **Secciones claras de la home** ("Cómo funciona" y "Preguntas frecuentes"):
  se quedan claras, con colores fijos que no editan el tema. Solo el verde
  principal las alcanza, mediante una variante oscura calculada para que se lea
  sobre fondo claro.

Tema editable por el admin (aún no implementado): un solo tema global para toda
la plataforma, legible sin iniciar sesión (el login lo necesita). La fuente de
verdad es la base de datos; `localStorage` solo lo guarda como caché para
aplicarlo antes de pintar. Los colores del tema por defecto siempre quedan
definidos en `styles.css` como respaldo. El verde principal es de elección
libre (sin limitar el tono); solo se valida que se lea sobre el fondo.

No restilizar pantallas sueltas a medias: se migra por pantalla completa. La
fuente Cinzel se carga en `index.html` y está disponible como `font-display`
(`@theme` de `src/styles.css`).

**Modo oscuro por clase.** Los componentes compartidos (`components/ui`,
`PasswordChecklist`, `PlanPicker`, `PaymentPanel`) llevan variantes `dark:`
junto a su aspecto claro; se activan con la clase `dark` (variante definida en
`styles.css`). `<AuthLayout dark>` la pone en su contenedor y en `<html>`, para
que toasts y modales (montados fuera de la pantalla) también la hereden. Así
cada pantalla migra sin tocar las que no. Al migrar un portal, activar `dark`
en su layout; cuando ya no quede ninguna pantalla clara, retirar los estilos
claros. Las pantallas que solo existen en oscuro (login, registro) llevan
colores oscuros directos, sin `dark:`.

Lo siguiente describe el estilo 1.5.

- **Paleta** (sale de la mascota y el logo):
  - Fondo marino casi negro `#070b12`, menú `#050810`, tarjetas con degradado
    `#0e1621 → #0a1019`, bordes `#1e2a38`.
  - Principal verde jade `#3fb97c` (botones, barras, activo, correcto); claro
    `#9fe3bf` (cifras, enlaces); pálido `#d5eee1` (títulos).
  - Dorado `#c9a961` **solo en ornamentos**: esquinas, rombos, líneas y
    etiquetas pequeñas. Nunca como fondo ni en botones.
  - Error `#c4544a` / texto `#e58276`. Texto `slate-200`, secundario `slate-400`.
  - **Colores de estado fijos** (no los edita el admin ni siguen al tema): correcto/éxito
    verde (`success`, `#3fb97c`), error rojo (`danger`) y advertencia amarillo
    (`warning`). "Correcto" nunca usa `primary`, que sí es editable.
  - Sin índigo, violeta ni degradados morados.
- **Tipografía**: Cinzel para títulos de página, nombres de curso, títulos de
  pregunta y cifras grandes; Inter para todo lo demás (menú, botones, cuerpo,
  porcentajes de tarjeta con `tabular-nums`). Sin cursivas.
- **Ornamentos**: esquinas doradas de 10 px en todas las tarjetas; bordes
  rectos (sin `rounded`); separador con rombo bajo el título de página
  (alineado a la izquierda) y centrado en el menú; rombo dorado en el ítem
  activo del menú; números romanos para listas ordenadas cortas (temas).
- **Textos**: encabezados alineados a la izquierda; etiquetas en mayúsculas
  pequeñas doradas (`text-[11px] font-semibold tracking-[0.18em]`); botones en
  minúscula, Inter semibold, borde jade con fondo jade al 10 %.
- **Efectos**: brillo jade sutil en los paneles principales, grano de película
  al 3,5 %, viñeta. Animaciones cortas sin rebotes; respetar
  `prefers-reduced-motion`.
- **Colores centralizados**: al migrar, definirlos como tokens semánticos en
  `@theme` de `src/styles.css` (p. ej. `primary`, `ornament`, `surface`,
  `danger`) y usar esos nombres en las clases; no escribir hex ni colores de
  Tailwind sueltos en componentes nuevos.

## Reglas de trabajo

- Los cambios deben ser aditivos y no romper la app; trabajo abandonado sin
  commitear debe poder descartarse limpiamente.
- No inventar casos especiales ni segmentos de usuario no pedidos; preguntar antes.
- Textos de UI y documentación en español.

## Documentación

- [docs/Documentacion_requerimientos.md](docs/Documentacion_requerimientos.md) y
  [docs/Requerimientos_ampliacion.md](docs/Requerimientos_ampliacion.md) — alcance y reglas.
- [docs/Documentacion_Base_De_Datos.md](docs/Documentacion_Base_De_Datos.md) — tablas y RLS.
- [docs/Edge_Functions.md](docs/Edge_Functions.md) — catálogo y contratos de funciones.
