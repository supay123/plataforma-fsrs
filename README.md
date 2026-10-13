# Chancón

Aplicación web académica para evaluar a estudiantes con preguntas de opción
múltiple y programar su repaso mediante el algoritmo de repetición espaciada
**FSRS**.

Una sola plataforma atiende a varios colegios. Cada colegio tiene sus propios
profesores, estudiantes, cursos y resultados, y el aislamiento entre ellos se
aplica en la base de datos mediante políticas de seguridad (RLS).

| Rol | Ruta | Qué puede hacer |
|---|---|---|
| Administrador | `/admin` | Gestionar colegios, profesores y estudiantes; credenciales; vigencia de acceso; asignaciones. |
| Profesor | `/profesor` | Gestionar sus cursos y temas, importar preguntas desde Excel, ver resultados y exportar CSV. |
| Estudiante | `/estudiante` | Rendir sesiones de hasta 20 preguntas por tema, revisar resultados y ver su progreso. |

Todos los usuarios inician sesión con un **código** y una contraseña. Las
preguntas admiten expresiones matemáticas en LaTeX, renderizadas con KaTeX.

## Stack

- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS, TanStack Query,
  React Router, React Hook Form y Zod. Se despliega en **Netlify**.
- **Backend:** **Supabase**: PostgreSQL con RLS, Auth y Edge Functions en
  Deno. La lógica FSRS usa `ts-fsrs`.
- **Tests:** Vitest y Playwright (frontend); Deno test (Edge Functions).

## Requisitos

- **Node.js 22** o superior.
- **pnpm**: el proyecto fija la versión 11.17.0, y pnpm la descarga sola si
  tienes otra instalada.
  ```sh
  npm install -g pnpm        # o: corepack enable (como administrador en Windows)
  ```
- **Docker Desktop**, abierto y con el motor corriendo. Supabase local se
  ejecuta en contenedores.
- **Deno**, solo para correr los tests de las Edge Functions.
- **Git Bash**, solo en Windows y para `pnpm test:integration` y
  `pnpm check:functions`.

## Puesta en marcha local

Ejecuta todos los comandos desde la raíz del repositorio.

### 1. Instalar dependencias
Solo la primera vez o cuando las dependecias cambien

```sh
pnpm install
```

### 2. Levantar Supabase local

```sh
pnpm exec supabase start
```

La primera vez descarga las imágenes de Docker y aplica todas las migraciones.
Se excluyen analytics (`vector`, `logflare`), que en Windows falla sin
configuración extra, y storage (`storage-api`, `imgproxy`), que la aplicación no
usa.

Al terminar, el comando muestra las URLs y claves locales. Puedes verlas de
nuevo con:

```sh
pnpm exec supabase status
```

| Servicio | URL |
|---|---|
| API | http://127.0.0.1:54321 |
| Studio (panel web) | http://127.0.0.1:54323 |
| Base de datos | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |

### 3. Servir las Edge Functions

En otra terminal:

```sh
pnpm exec supabase functions serve
```

Sin esto no funciona el inicio de sesión ni las sesiones de preguntas. Las
variables que usan las funciones en local van en `supabase/functions/.env`, que
no se sube al repositorio.

### 4. Configurar y levantar el frontend

Copia `frontend/.env.example` a `frontend/.env.local` y completa los valores con
la salida de `supabase status`:

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=<Publishable key>
```

> Nunca pongas una clave secreta ni la `service_role` en una variable `VITE_`:
> todo lo que empieza con `VITE_` queda expuesto en el navegador.

```sh
pnpm --filter frontend dev
```

La aplicación queda disponible en http://localhost:5173.

## Documentación

- [Requerimientos](docs/Documentacion_requerimientos.md): alcance, roles y
  reglas del producto.
- [Base de datos](docs/Documentacion_Base_De_Datos.md): tablas, relaciones y
  políticas RLS.
- [Edge Functions](docs/Edge_Functions.md): catálogo de funciones, contratos y
  reglas de negocio.
- [Frontend](frontend/README.md): notas específicas de la SPA.
- [Componentes reutilizables](docs/Componentes_Reutilizables.md): componentes,
  hooks y utilidades del frontend que ya existen; revísalo antes de crear uno nuevo.
