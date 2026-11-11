# Componentes reutilizables del frontend

Antes de crear un componente, hook o función nueva, revisa esta lista: si algo
parecido ya existe, úsalo o extiéndelo en lugar de duplicarlo. Si agregas algo
reutilizable, documéntalo aquí en el mismo cambio.

## Dónde vive cada cosa

| Carpeta | Qué guarda |
| --- | --- |
| `frontend/src/components/ui/` | Piezas genéricas de interfaz: botones, campos, tarjetas, avisos, toast y modal. |
| `frontend/src/components/layout/` | Estructura de las páginas: portal, páginas públicas y logo. |
| `frontend/src/lib/` | Utilidades sin interfaz: llamadas a Edge Functions, errores, fechas, fórmulas y temporizadores. |
| `frontend/src/features/<dominio>/` | Lo propio de un dominio (su `api.ts`, reglas y componentes). Si algo de aquí lo empieza a usar otro dominio, muévelo a `components/` o `lib/`. |

Todo lo de `components/ui` se importa desde `../../components/ui`, salvo el
toast y el modal, que tienen archivos propios (ver abajo).

## Avisos al usuario: ¿toast, Alert o modal?

- **Toast** (`useToast`): resultado de una acción que llamó a un endpoint
  (guardado, error del servidor, sesión terminada). Desaparece solo.
- **Alert**: información que debe quedarse visible dentro de la página o el
  formulario (por ejemplo, "Agrega un correo a tu perfil...").
- **Modal** (`useModal`): confirmar una acción antes de hacerla, sobre todo si
  no se puede deshacer. La variante `info` muestra indicaciones o ayuda que no
  caben en la página (por ejemplo, dónde encontrar el código de Yape).
- Los errores de un campo concreto van debajo del campo, con la prop `error`
  de `Field`.

---

## Toast

Notificación flotante de éxito o de error. Dura **3,5 segundos**, se detiene
mientras el mouse o el foco están encima y tiene un botón para cerrarla. Una
barra en el borde inferior se llena de izquierda a derecha en proporción al
tiempo transcurrido (también se pausa). Un mismo mensaje repetido no se apila.

- Archivos: `components/ui/toast.tsx` (`ToastProvider`) y
  `components/ui/use-toast.ts` (`useToast`).
- `ToastProvider` ya está montado en `app/App.tsx`.

```tsx
import { useToast } from "../../components/ui/use-toast";

const toast = useToast();
toast.success("Guardamos correctamente tus datos");
toast.error("Hubo un error al guardar tus datos");
toast.error("Mensaje largo", 6000); // duración opcional en milisegundos
```

En tests, envuelve el componente con `<ToastProvider>`.

## Modal

Ventana con título y cuerpo. Tiene cuatro variantes:

| Método | Botón principal | Uso |
| --- | --- | --- |
| `modal.delete(opciones)` | Rojo, "Eliminar" | Acciones destructivas. |
| `modal.create(opciones)` | Morado, "Crear" | Crear o confirmar algo. |
| `modal.warning(opciones)` | Ámbar, "Confirmar" (con ícono de advertencia) | Acciones que afectan directamente a otro usuario (cambiar sus datos, su credencial o su vigencia). |
| `modal.info({ title, body, confirmLabel? })` | Morado, "Entendido" (sin "Cancelar") | Indicaciones o ayuda; no ejecuta ninguna acción, solo se cierra. |

- Archivos: `components/ui/modal.tsx` (`ModalProvider`) y
  `components/ui/use-modal.ts` (`useModal`).
- `ModalProvider` ya está montado en `app/App.tsx`.

Opciones:

| Opción | Tipo | Descripción |
| --- | --- | --- |
| `title` | `string` | Título del modal. |
| `body` | `ReactNode` | Texto o contenido del cuerpo. |
| `onConfirm` | `() => unknown` | Acción del botón principal. Puede devolver una promesa. |
| `confirmLabel` | `string` (opcional) | Cambia el texto del botón principal. |

Comportamiento:

- Mientras la promesa de `onConfirm` está pendiente, los botones se desactivan
  y muestran "Eliminando…", "Creando…" o "Aplicando…"; no se puede cerrar con Escape ni con
  un clic fuera.
- Si la promesa se resuelve, el modal se cierra solo. Si falla, sigue abierto
  para reintentar o cancelar; quien lo llama muestra el error (por ejemplo, con
  un toast).
- Se cierra sin ejecutar nada con "Cancelar", Escape, la "X" de la esquina
  superior derecha o un clic fuera.

```tsx
import { useModal } from "../../components/ui/use-modal";

const modal = useModal();
modal.delete({
  title: "Eliminar colegio",
  confirmLabel: "Eliminar definitivamente",
  body: <p>Esta acción no se puede deshacer.</p>,
  onConfirm: () => remove.mutateAsync(college.id),
});
```

Ejemplos reales: `pages/admin/CollegesPage.tsx`, `UsersPage.tsx`,
`AssignmentsPage.tsx`, `UserAccountPage.tsx` (variante `warning`) y
`features/payments/PaymentPanel.tsx` (variante `info`). En tests, envuelve el componente con `<ModalProvider>`.

### ModalForm (modales con formulario)

Cuando la acción necesita datos, usa `ModalForm` en lugar de `useModal()`.
Renderiza el formulario, un botón "Cancelar", una "X" de cierre en la esquina
superior derecha y un botón principal con el texto que indiques; el botón
principal es `type="submit"`, así que también se envía con Enter.

- Archivo: `components/ui/modal-form.tsx` (`ModalForm`).
- Se controla desde el componente padre: se muestra solo cuando su estado está
  abierto (`{open && <ModalForm …>}`), no necesita provider.

| Prop | Tipo | Descripción |
| --- | --- | --- |
| `title` | `string` | Título del modal. |
| `confirmLabel` | `string` | Texto del botón principal. |
| `pendingLabel` | `string` (opcional) | Texto mientras se ejecuta la acción ("Guardando…" por defecto). |
| `pending` | `boolean` (opcional) | Desactiva los botones y el cierre mientras la acción corre. |
| `onCancel` | `() => void` | Cerrar sin ejecutar (botón, "X", Escape o clic fuera). |
| `onSubmit` | `() => void` | Acción del botón principal y del submit del formulario. |
| `error` | `ReactNode` (opcional) | Error de la acción; se muestra dentro del modal. |
| `children` | `ReactNode` | Campos del formulario. |

Ejemplo real: `features/courses/CoursesView.tsx` lo usa para crear y editar
cursos. Los campos compartidos están en `CourseFormFields` dentro del mismo
archivo. La eliminación de un curso usa `modal.delete` para advertir que la
acción es permanente antes de confirmarla.

---

## Componentes de `components/ui/index.tsx`

### Button

Botón con estilos de la aplicación. Acepta todas las props de `<button>`.

| Prop | Valores |
| --- | --- |
| `variant` | `"primary"` (por defecto), `"secondary"`, `"danger"`, `"ghost"` |

Convención para que todos los botones se vean igual en toda la app:

| Acción | Cómo se escribe |
| --- | --- |
| Principal del formulario o paso (Guardar, Continuar, Verificar) | `<Button>` (primary) |
| Acción secundaria (Restablecer contraseña, Reenviar link) | `<Button variant="secondary">` |
| Destructiva (Eliminar) | `<Button variant="danger">`, normalmente a través de `modal.delete` |
| **Cancelar** o deshacer algo en curso | `<Button type="button" variant="ghost">Cancelar</Button>` |

No uses un `<button>` con estilo de enlace para "Cancelar".

### Field

Envuelve un control con su etiqueta, una ayuda y un error.

| Prop | Descripción |
| --- | --- |
| `label` | Texto de la etiqueta (obligatorio, también para lectores de pantalla). |
| `error` | Mensaje de error debajo del control. |
| `hint` | Texto de ayuda debajo del control. |
| `hideLabel` | Oculta la etiqueta visualmente (el control muestra un placeholder); los lectores de pantalla la siguen leyendo. |

### Input, PasswordInput, Select y Textarea

Controles de formulario. Aceptan todas las props del elemento HTML.
`Input`, `PasswordInput` y `Select` además aceptan:

| Prop | Descripción |
| --- | --- |
| `variant="soft"` | Estilo de placeholder con fondo suave y bordes redondeados (registro y perfil del estudiante). Por defecto, estilo normal. |
| `icon` | Ícono a la izquierda del control, por ejemplo `<Mail size={20} />` de `lucide-react`. |

`PasswordInput` incluye el botón del "ojito" para mostrar u ocultar la
contraseña.

Para un dato que se muestra pero no se edita (por ejemplo, la institución en el
perfil del estudiante), usa `Input` con `readOnly` y `value`.

```tsx
<Field label="Correo electrónico" hideLabel error={errors.email?.message}>
  <Input variant="soft" icon={<Mail size={20} />} placeholder="tu@correo.com" {...register("email")} />
</Field>
```

### Card

Contenedor blanco con borde y sombra. Si pasas un `className` con `bg-` o
`border-`, reemplaza el fondo o el borde por defecto. Dentro de un portal
(clase `portal`) se ve como `Frame`: degradado, borde recto y esquinas doradas.
`glow` añade el brillo jade de los paneles principales.

### PageHeader

Encabezado de página del portal: `title`, `description` opcional y `actions`
opcionales (botones a la derecha).

### Alert

Aviso dentro de la página. `tone`: `"info"` (por defecto), `"success"` o
`"error"`.

### Badge

Etiqueta pequeña de estado. `tone`: `"neutral"` (por defecto), `"success"`,
`"warning"` o `"danger"` (por ejemplo, el plan vencido de un estudiante).

### Spinner y EmptyState

- `Spinner`: indicador de carga centrado. **No se usa para cargar datos**: la
  carga siempre es con `Skeleton` (la única excepción es la carga de las
  preguntas de la práctica del estudiante).
- `EmptyState`: recuadro para listas vacías, con el texto como hijo.

### Mascota 3D con consejos (`MascotTips`, `ui/mascot-scene.tsx`)

`features/sessions/MascotTips.tsx` muestra la mascota (`public/models/mascot.glb`,
con `three` + `@react-three/fiber`) y rota consejos cortos de
`features/sessions/practice-tips.ts` cada 5 s, sin repetir ninguno hasta mostrar
todos. Saluda (`wave`) al cambiar de consejo y respeta `prefers-reduced-motion`.
La escena se carga con `lazy` para no meter `three` en el paquete principal, y
sin WebGL se ve la cabeza 2D. Se usa en la carga de la práctica del estudiante.

Junto a la mascota, `features/sessions/LoadingProgress.tsx` muestra una
`ProgressBar` por etapas reales (`loading-progress.ts`): avanza despacio dentro
de cada etapa y salta cuando termina de verdad la descarga o el descifrado. A
los 20 s avisa "Esto a veces puede tardar"; al minuto pide contactar al negocio
(WhatsApp) y ofrece "Reintentar". Al terminar, la barra se queda al 100 % ("¡Listo!") ~0,8 s antes de mostrar la primera pregunta. `PortalLayout` precarga el modelo 3D (`preloadMascot`) para el estudiante, y la cabeza 2D cubre el tiempo hasta que el modelo esté listo.

### Skeleton

Marcador de carga gris con un destello que cruza de izquierda a derecha (se
detiene con "reducir movimiento"). Archivo: `components/ui/skeleton.tsx`.

- `height` y `width`: número (px) o medida CSS. Por defecto `16` y `"100%"`.
- `rounded`: `"none" | "sm" | "md" | "lg"` (por defecto) `| "xl" | "2xl" | "3xl" | "full"`.
- Acepta `className` y el resto de atributos de un `div`; es decorativo (`aria-hidden`).

```tsx
import { Skeleton } from "../../components/ui/skeleton";

<Skeleton height={48} width={48} rounded="full" />
<Skeleton height={20} width="60%" />
```

`PageSkeleton` (mismo archivo) es el esqueleto de una página completa: título,
descripción y `rows` filas de `rowHeight` px, en `columns` columnas (1 a 3).
Es lo que se devuelve mientras `isLoading` en las páginas de los portales.

### Estilo 1.5 de los portales (`styles.css` y `components/ui/ornaments.tsx`)

- **Variante `portal:`** (como `dark:`): aplica solo dentro de un elemento con la
  clase `portal`. `PortalLayout` la pone junto con `dark` en su contenedor y en
  `<html>` (para toasts y modales). Los componentes compartidos llevan
  `portal:` solo donde el 1.5 difiere del SaaS; las pantallas que solo existen
  en un portal usan directamente los tokens.
- **Tokens de color** (`@theme` de `styles.css`): `primary`, `ornament`, `canvas`
  (los tres editables), `primary-light`, `primary-pale`, `primary-ink`,
  `sidebar`, `surface`, `surface-deep`, `line`, `line-strong`, `track`, `fg-strong`,
  `fg`, `fg-muted`, `fg-faint` y `atmosphere`. **Estados fijos** (no siguen el tema
  del admin): `success`/`success-light` (correcto, éxito), `danger`/`danger-light`
  (error) y `warning` (advertencia). Lo "correcto" usa `success`, nunca `primary`. Uso: `bg-primary/10`, `text-primary-light`, `border-line`. No
  escribir hex ni colores de Tailwind sueltos en pantallas de portal.
- **Ornamentos** (`ornaments.tsx`, reexportados por `components/ui`): `Frame`
  (tarjeta con esquinas; `glow`, `interactive`), `Corners`, `Divider` (rombo a
  la izquierda), `CenteredDivider` (rombo al centro), `Eyebrow` (etiqueta dorada
  en mayúsculas) y `ProgressBar` (barra jade, 0–100).

---

## Estructura de páginas (`components/layout/`)

| Componente | Descripción |
| --- | --- |
| `PortalLayout` | Menú lateral, usuario y botón "Salir" de los portales. En escritorio se puede reducir a solo iconos (la cabeza de la mascota lo vuelve a expandir; el estado se recuerda en `localStorage`); en móvil es una hamburguesa que abre el menú desde la izquierda. Se usa en `app/router.tsx` con `role="admin" \| "teacher" \| "student"`. Las páginas internas pueden activar el modo práctica con los hooks de `portal-mode.ts` (ver abajo). |
| `AuthLayout` | Pantalla partida para el acceso (login, registro, invitación, nueva contraseña y renovación): fondo blanco con el logo y el formulario a la izquierda, y a la derecha una portada en índigo con la vista previa `public/image/preview.webp` (en móvil aparece debajo del formulario). Usa `wide` para formularios de dos columnas, `action` para mostrar algo a la derecha del logo (p. ej. el botón "Iniciar sesión" del registro) y `cover` (`{ title, description }`) para el texto de la portada. |
| `PublicPage` | Página pública con el logo arriba y el pie de página legal. |
| `PublicFooter` | Pie de página con enlaces legales y datos de la empresa (ya incluido en `PublicPage`). |
| `ComplaintsBookIcon` | Ícono del Libro de Reclamaciones. |
| `Logo` | Logo de la marca. Usa `onLight` cuando va sobre fondo claro. |

## Formularios del estudiante (`features/registration/`)

Reglas compartidas por el registro, el perfil y la nueva contraseña. Coinciden
con las validaciones del backend: si cambias una, cambia la otra.

- **Celular:** por ahora solo de Perú: 9 dígitos que empiezan con 9. Se acepta
  con o sin `+51` y el backend lo guarda sin el prefijo.
- **Contraseña:** mínimo 6 caracteres, con una minúscula, una mayúscula y un
  número.

| Archivo | Qué ofrece |
| --- | --- |
| `fields.ts` | Campos zod listos: `studentFields` (nombres, apellidos, correo, celular y documento) y `passwordFields` (contraseña y confirmación); validaciones entre campos `documentIsValid`/`documentIssue` y `passwordsMatch`/`passwordMismatchIssue`; `SERVER_FIELD_MESSAGES` para traducir errores de campo del backend. |
| `rules.ts` | Reglas sueltas: `isValidPassword`, `passwordChecks`, `isValidPhone`, `isValidIdentityDocument`, `normalizeIdentityDocument` y los límites de la contraseña. |
| `PasswordChecklist.tsx` | Lista de reglas de la contraseña que se marcan a medida que se cumplen. |

Los tipos de documento (`DNI`, `CE`, `PASAPORTE`, `RUC`) están en
`features/complaints/model.ts` (`DOCUMENT_TYPES`).

## Pagos de planes (`features/payments/`)

Pagos con Yape a través de Mercado Pago para el registro y la renovación. El
monto lo fija el servidor según el plan; el navegador solo dice qué plan eligió
y envía el token de Yape.

| Archivo | Qué ofrece |
| --- | --- |
| `PlanPicker.tsx` | Selector del plan (mensual o semestral) con su precio. El semestral lleva siempre borde dorado, igual que su tarjeta en el home. |
| `PlanCards.tsx` | Tarjetas grandes de los dos planes con sus beneficios y el botón «Elegir …» (con destello y leve crecimiento al pasar el mouse por el botón) que lleva al registro con ese plan. El semestral tiene borde dorado animado (`animate-orbit`), repite los beneficios del Plan Estudiante y resalta aparte sus extras. Se usan en el home (sección «Elige tu plan»); acepta `className` para el margen. |
| `PaymentPanel.tsx` | Pago de un plan con Yape: pide el celular y el código de aprobación de la app de Yape, genera el token, cobra y espera a que se aplique. Explica los rechazos de Mercado Pago y deja reintentar con un código nuevo. Recibe `createPayment(plan, { token, phone })`, `fetchStatus` y `onPaid`, así sirve para el registro y la renovación. Sin Mercado Pago configurado muestra el contacto por WhatsApp. |
| `PlanExpiryBanner.tsx` | Aviso en el portal del estudiante cuando a su plan le quedan `RENEWAL_NOTICE_DAYS` días o menos. |
| `PaymentsToReview.tsx` | Tarjeta del administrador con los pagos confirmados que no se pudieron aplicar (de Mercado Pago o, los antiguos, de Kuti). Solo aparece si hay alguno. |
| `yape.ts` | `createYapeToken(publicKey, celular, otp)`: carga el SDK de Mercado Pago y devuelve el token de un solo uso. |
| `api.ts` | `getPaymentConfig` (Public Key), `createRenewalPayment`, `getRenewalPaymentStatus`, `listPaymentsToReview`, `resolvePayment` y los tipos `PlanPaymentState` y `PlanPaymentStatus`. Los cobros del registro están en `features/registration/api.ts`. |

Los planes y precios están en `config/business.ts` (`PLANS`, `findPlan`,
`planPriceLabel`) y deben coincidir con `supabase/functions/_shared/plans.ts`.

## Cursos (`features/courses/`)

La lista de cursos es un solo componente compartido por el profesor y el
administrador:

| Archivo | Qué ofrece |
| --- | --- |
| `CoursesView.tsx` | Vista única de cursos. Con rol `admin` muestra todos los cursos agrupados por profesor, con buscador y filtro por profesor; con rol `teacher` muestra solo los del profesor y permite crearlos, editarlos, activarlos/desactivarlos y archivarlos. El alcance de los datos lo decide RLS, no la interfaz. |
| `api.ts` | `listCourses` (todos los campos + colegio + nombre del profesor), `createCourse`, `updateCourse`, `archiveCourse`, `listTopics`, `createTopic`, `updateTopic`, `listStudentCourses` y `enrollStudent`. |

Las páginas `pages/teacher/CoursesPage.tsx` y `pages/admin/CoursesPage.tsx`
solo reexportan `CoursesView`. Si agregas una funcionalidad de cursos, hazlo en
`CoursesView.tsx` (o en sus piezas dentro de `features/courses/`) para que se
refleje en ambos roles; no crees una copia por rol.

El detalle del curso (`TopicsPage`) y la importación de preguntas (`ImportPage`)
también se reutilizan: las rutas son `/admin/cursos/:courseId` y
`/admin/temas/:topicId/importar` para el admin, y `/profesor/...` para el
profesor. Los enlaces internos se arman con `lib/portal-paths.ts`
(`courseTopicsPath` e `importQuestionsPath`), así no se repiten rutas por rol.

## Utilidades (`lib/`)

| Utilidad | Archivo | Descripción |
| --- | --- | --- |
| `invokeFunction(nombre, cuerpo, { method })` | `lib/api/functions.ts` | Llama a una Edge Function (`GET`, `POST`, `PUT` o `DELETE`) y lanza un `AppError` si falla. Las páginas no la usan directamente: cada dominio la envuelve en su `api.ts`. |
| `normalizeError(error)` y `AppError` | `lib/api/errors.ts` | Convierte cualquier error en un `AppError` con `code`, `message` en español y `details`. Los textos en español de cada código de error están en `translatedMessages`. |
| `translateDatabaseError(error)` | `lib/api/errors.ts` | Traduce al español las reglas de la base de datos que PostgREST devuelve crudas (índice único de nombre de curso, límites de 8 cursos, 25 temas y 50 preguntas, mismo colegio) y devuelve un `AppError` con código `database_rule`. Si no reconoce el error, lo devuelve igual. Se aplica en el `api.ts` del dominio (ejemplo: `features/courses/api.ts`); para una regla nueva, agrégala a `databaseMessages`. |
| `useNow()` y `secondsUntil(fecha, ahora)` | `lib/use-now.ts` | Hora actual que se actualiza cada segundo y segundos que faltan para una fecha (cuentas regresivas como "Reenviar en 45 s"). |
| `formatDate(valor)` y `todayInLima()` | `lib/dates.ts` | Fecha y hora legible en español (para fechas con hora, como `created_at`) y fecha de hoy en Lima (`AAAA-MM-DD`). |
| `studentAccess(perfil)` | `lib/student-access.ts` | Situación del plan del estudiante hoy en Lima: `active` (con `daysLeft`), `expired` (con `daysSinceExpiry`) o `not_started`. Úsala en lugar de comparar fechas a mano. También exporta `RENEWAL_NOTICE_DAYS` (3) y `EXPIRED_REVIEW_DAYS` (7). |
| `formatDay(valor)` | `lib/dates.ts` | Fecha sin hora (`AAAA-MM-DD`, como las vigencias de acceso) en `DD/MM/AAAA`. Úsala en lugar de `formatDate` para esas fechas: `formatDate` las mostraría un día antes. |
| `loadYouTubeApi()` y `YouTubePlayer` | `lib/youtube.ts` | Carga una sola vez la API del reproductor de YouTube (falla si el script está bloqueado) y tipa lo que usa la app: reproducir, silenciar, activar el sonido y su estado. La usa el video del home. |
| `MathText` | `lib/math.tsx` | Muestra texto con fórmulas LaTeX (`$...$` y `$$...$$`) usando KaTeX. |
| `roleLabel(rol)` | `features/users/api.ts` | Nombre en español del nivel de acceso: "Administrador", "Profesor" o "Estudiante". |

## Íconos

Los íconos vienen de la librería [lucide-react](https://lucide.dev/icons/):
`import { Mail } from "lucide-react"` y `<Mail size={20} />`. No dibujes SVG a
mano ni agregues otra librería de íconos; busca primero en lucide. El único
gráfico propio es el del Libro de Reclamaciones (`ComplaintsBookIcon`, una
imagen PNG).

### Modo práctica (`components/layout/portal-mode.ts`)

Hooks para páginas dentro de `PortalLayout`; fuera de él no hacen nada.

- `usePortalFocus()`: mientras la página está montada, el menú de escritorio
  se reduce a iconos sin cambiar la preferencia guardada del usuario. Si lo
  expande, vuelve a reducirse en la próxima práctica.
- `useLeaveWarning(warning)`: mientras `warning` (`{ title, body,
  confirmLabel? }`) no sea `null`, los enlaces del menú y "Salir" abren un
  modal de advertencia (`useModal().warning`) antes de navegar o cerrar sesión.
  Pasa una constante del módulo para que no se reinstale en cada render.

```tsx
const LEAVE_WARNING: LeaveWarning = { title: "¿Salir de la práctica?", body: "Perderás tu progreso.", confirmLabel: "Salir y perder progreso" };

usePortalFocus();
useLeaveWarning(enCurso ? LEAVE_WARNING : null);
```

Ejemplo: `pages/student/SessionPage.tsx`.

## Sesión y usuario

`useAuth()` (`features/auth/AuthProvider.tsx`) da la sesión, el perfil, `login`,
`logout` y `refreshProfile`. No leas la sesión de Supabase directamente desde
una página.
