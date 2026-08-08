# Aula FSRS — frontend

El producto se llama Aula Repaso
SPA responsive para los portales de administrador, profesor y estudiante.

## Configuración

Copia `.env.example` a `.env.local` y configura únicamente:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Nunca incluyas una clave secreta o `service_role` en Vite.

## Desarrollo

Desde la raíz del repositorio:

```sh
pnpm --filter frontend dev
pnpm --filter frontend lint
pnpm --filter frontend test
pnpm --filter frontend test:e2e
pnpm --filter frontend build
```

La aplicación usa React Router, TanStack Query, Tailwind CSS, React Hook Form,
Zod, KaTeX y el cliente tipado de Supabase. Las páginas no llaman a Supabase
directamente: cada dominio concentra sus consultas y mutaciones en su módulo
`api.ts`.

El archivo `public/_redirects` configura el fallback de SPA para Netlify. La
plantilla oficial de importación está disponible en
`public/templates/plantilla-preguntas.xlsx`.
