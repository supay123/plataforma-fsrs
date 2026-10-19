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
  `_shared/` (auth, errores, router, FSRS, validación, Gmail, Kuti, planes).
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
- Antes de crear UI reutilizable, revisar y actualizar
  [docs/Componentes_Reutilizables.md](docs/Componentes_Reutilizables.md).
- Solo `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` en `.env.local`;
  todo lo `VITE_` es público.
- Tests junto al archivo (`*.test.ts(x)`), Vitest + Testing Library.

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
