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

Estilo **Chancón**: oscuro sobrio, redondeado, con botones y tarjetas de borde inferior
grueso, jade como color de marca y dorado como acento. Debe sentirse como un juego
para adultos, nunca infantil, y conservar la seriedad de un SaaS. Referencia visual
(solo en desarrollo): `/textura/chancon` (`src/pages/style-guide/ChanconStylePage.tsx`).

- **Portales (estudiante, profesor y admin)**: **aplicado** (variante `portal:`,
  tokens en `styles.css`, paleta en `src/lib/theme/palette.ts`). Detalle de tokens,
  utilidades y layout en
  [docs/Componentes_Reutilizables.md](docs/Componentes_Reutilizables.md).
- **Login y registro** (`AuthLayout dark`): usan Chancón con los colores centralizados
  (`bg-base`, `bg-blocks`, `primary`), así que cambian con el tema de la institución y
  con el interruptor claro/oscuro.
- **Home y páginas públicas**: colores **fijos** (SaaS oscuro con `slate`/`emerald`; no siguen
  el tema). Ya usan las fuentes nuevas (Archivo + Plus Jakarta Sans). Invitación, nueva
  contraseña y renovación siguen con su aspecto claro actual, pendientes de indicación.

**El estilo es universal.** Todos los componentes de una zona usan el mismo estilo; no se
inventa otro marco. Cualquier excepción a esta regla se conversa con el usuario antes de
aplicarla; no se decide sola.

Excepciones aprobadas (no hay otras):

- **Impresión y PDF** (libro de reclamaciones impreso, hoja de reclamos en PDF)
  mantienen su estilo claro de siempre; no usan el tema.
- **Imágenes con fondo propio** (QR y pantalla de Yape, logo de Yape, imagen del
  Libro de reclamaciones) conservan su fondo; todo lo que no es imagen sigue el estilo.
- **Correos HTML** (`supabase/functions/_shared/email.ts`): cambio sutil a la marca
  (botón verde jade con texto oscuro, en lugar del índigo `#4f46e5`). Colores fijos: no
  siguen el tema que edite el admin.
- **Advertencias** (alertas, botón y modal `warning`): amarillo (`warning`), nunca el
  acento dorado.

**Colores (centralizados y editables por institución):** cada institución elige solo
**4 colores por modo** (claro y oscuro): `primary` (Primario), `secondary` (Secundario) y
los fondos `base` (Fondo base) y `blocks` (Fondo bloques). El texto **no se elige**: sobre
cada fondo es blanco o negro según el contraste, calculado por separado (`text-on-base`
sobre `bg-base`, `text-on-blocks` sobre `bg-blocks`); el resto se deriva. Los estados son
fijos y no siguen el tema: correcto = `success`, error = `danger`, advertencia = `warning`.
"Correcto" nunca usa `primary`. No validar ni limitar el color que elija el admin: el
diseño se adapta. Los valores por defecto (claro y oscuro) viven en `palette.ts`
(`DEFAULT_PALETTES`) y el oscuro también en `styles.css` (respaldo).

**Tema por institución** (flujo completo):
- BD: `college_themes` (colegio + modo + 4 colores `#rrggbb`). Sin filas = colores por
  defecto (así funcionan los colegios anteriores). Restablecer = borrar las filas.
- Endpoint público `GET /public/theme?inst=<code del colegio>`: `{ theme: null }` (200, no es
  error) si no hay colores; si hay, `{ theme: { light, dark } }` (cada uno puede ser null).
- `instId` = `colleges.code` (único sin importar mayúsculas, `colleges_code_unique_ci`).
  Se guarda en `localStorage` (`instId`) y llega por la URL (`?instId=`) en los links de
  invitación y de restablecer contraseña, o del perfil tras iniciar sesión
  (`InstitutionThemeSync`). Los colores devueltos se cachean en `localStorage`
  (`instTheme`) y se aplican antes de pintar (`bootstrapTheme`).
- Modo claro/oscuro: interruptor (`ThemeToggle`); se guarda en `localStorage`
  (`themeMode`) y sobrevive al logout; sin elección usa el del navegador. Los portales
  usan los colores de su institución en el modo elegido.
- En Configuración del admin (`features/settings/AdminSettings.tsx`) el selector de institución va sobre las
  pestañas y es la referencia de lo que se guarda en Colores y Puntos (Seguridad es de la cuenta).
- El admin edita los colores en Configuración → Colores (`features/theme/ThemeSettings.tsx`),
  con modal de aviso al guardar y al restablecer (afecta a toda la institución).
- El logo es una imagen clara: con un fondo de bloques claro se muestra sobre un fondo
  oscuro propio (`Logo onLight`); una variante del logo para fondos claros sigue pendiente.

**Tipografía:** Archivo para títulos y cifras (`type-display` para títulos de página,
`type-heading` dentro de tarjetas) y Plus Jakarta Sans para el cuerpo. Sin cursivas.

**Reglas de layout** (evitan desbordes horizontales): los portales usan una cuadrícula
`menú | contenido` (`minmax(0, 1fr)`); toda cuadrícula debe poder encogerse (los textos
largos se recortan con "…" en vez de ensanchar la página) y las columnas responden al
ancho del contenedor (`@container`, variantes `@xl:`), no al de la ventana. En móvil el
menú es una barra inferior de iconos.

**Modo oscuro por clase.** Los componentes compartidos (`components/ui`,
`PasswordChecklist`, `PlanPicker`, `PaymentPanel`) llevan variantes `dark:` junto a su
aspecto claro (para las páginas públicas) y `portal:` para los portales. `PortalLayout`
pone `dark` y `portal` en su contenedor y en `<html>`, para que toasts y modales
(montados fuera de la pantalla) también las hereden.

No restilizar pantallas sueltas a medias: se migra por pantalla completa.

## Reglas de trabajo

- Los cambios deben ser aditivos y no romper la app; trabajo abandonado sin
  commitear debe poder descartarse limpiamente.
- No inventar casos especiales ni segmentos de usuario no pedidos; preguntar antes.
- Textos de UI y documentación en español.

## Código y comentarios

- **Nombres claros y completos**: cada variable, función, parámetro y archivo dice qué es
  o qué hace sin necesidad de un comentario, aunque el nombre resulte largo. Sin
  abreviaturas (`numero` y no `nro`, `parametro` y no `p`, `respuesta` y no `res`) salvo que
  el usuario lo indique. Las siglas estándar del dominio (`id`, `url`, `xp`, `fsrs`) están bien.
- **Comentar poco**: solo lo que explica *por qué* una función o un comando funciona como
  funciona cuando eso no se deduce leyéndolo (una restricción oculta, un caso límite, una
  decisión no evidente). "Complicado" es por su funcionamiento, no porque quien lee no
  conozca el lenguaje. No comentar lo que el código ya dice, ni línea por línea, ni
  repetir el nombre de lo que viene debajo.
- Un comentario que se vuelve falso al cambiar el código se corrige o se borra en el mismo cambio.
- **Quitar un comportamiento es borrar el código que lo produce**, no añadir código nuevo que
  lo contrarreste o lo tape (clases que anulan a otras, estados que desactivan lo anterior).
  Si algo ya no hace falta, se elimina de raíz junto con su comentario.

## Documentación

- [docs/Documentacion_requerimientos.md](docs/Documentacion_requerimientos.md) y
  [docs/Requerimientos_ampliacion.md](docs/Requerimientos_ampliacion.md) — alcance y reglas.
- [docs/Documentacion_Base_De_Datos.md](docs/Documentacion_Base_De_Datos.md) — tablas y RLS.
- [docs/Edge_Functions.md](docs/Edge_Functions.md) — catálogo y contratos de funciones.
