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
  no se puede deshacer.
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

Ventana de confirmación con título y cuerpo. Tiene tres variantes:

| Método | Botón principal | Uso |
| --- | --- | --- |
| `modal.delete(opciones)` | Rojo, "Eliminar" | Acciones destructivas. |
| `modal.create(opciones)` | Morado, "Crear" | Crear o confirmar algo. |
| `modal.warning(opciones)` | Ámbar, "Confirmar" (con ícono de advertencia) | Acciones que afectan directamente a otro usuario (cambiar sus datos, su credencial o su vigencia). |

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
- Se cierra sin ejecutar nada con "Cancelar", Escape o un clic fuera.

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
`AssignmentsPage.tsx` y `UserAccountPage.tsx` (variante `warning`). En tests, envuelve el componente con `<ModalProvider>`.

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
`border-`, reemplaza el fondo o el borde por defecto.

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

- `Spinner`: indicador de carga centrado.
- `EmptyState`: recuadro para listas vacías, con el texto como hijo.

---

## Estructura de páginas (`components/layout/`)

| Componente | Descripción |
| --- | --- |
| `PortalLayout` | Menú lateral, usuario y botón "Salir" de los portales. Se usa en `app/router.tsx` con `role="admin" \| "teacher" \| "student"`. |
| `AuthLayout` | Fondo degradado con una tarjeta y el logo, sin encabezado ni pie. Para pantallas de acceso: login, registro y nueva contraseña. Usa `wide` para formularios de dos columnas y `action` para mostrar algo a la derecha del logo (p. ej. el botón "Iniciar sesión" del registro). |
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

Cobros con Kuti para el registro y la renovación. El monto lo fija el servidor
según el plan; el navegador solo dice qué plan eligió.

| Archivo | Qué ofrece |
| --- | --- |
| `PlanPicker.tsx` | Selector del plan (mensual o semestral) con su precio. |
| `PlanCards.tsx` | Tarjetas grandes de los dos planes con sus beneficios y el botón «Elegir …» que lleva al registro con ese plan. Se usan en el home y en `/precios`; acepta `className` para el margen. |
| `PaymentPanel.tsx` | Cobro de un plan: QR, código de pago de servicios (si el monto lo permite), cuenta regresiva y espera de la confirmación. Recibe `createPayment`, `fetchStatus`, `simulatePayment` y `onPaid`, así sirve para el registro y la renovación. En modo prueba muestra el botón «Simular pago». Sin Kuti configurado muestra el contacto por WhatsApp. |
| `PlanExpiryBanner.tsx` | Aviso en el portal del estudiante cuando a su plan le quedan `RENEWAL_NOTICE_DAYS` días o menos. |
| `PaymentsToReview.tsx` | Tarjeta del administrador con los pagos que Kuti confirmó pero no se pudieron aplicar. Solo aparece si hay alguno. |
| `api.ts` | `createRenewalPayment`, `getRenewalPaymentStatus`, `listPaymentsToReview`, `resolvePayment` y los tipos `PlanPayment` y `PlanPaymentStatus`. Los cobros del registro están en `features/registration/api.ts`. |

Los planes y precios están en `config/business.ts` (`PLANS`, `findPlan`,
`planPriceLabel`) y deben coincidir con `supabase/functions/_shared/plans.ts`.

## Utilidades (`lib/`)

| Utilidad | Archivo | Descripción |
| --- | --- | --- |
| `invokeFunction(nombre, cuerpo, { method })` | `lib/api/functions.ts` | Llama a una Edge Function (`GET`, `POST`, `PUT` o `DELETE`) y lanza un `AppError` si falla. Las páginas no la usan directamente: cada dominio la envuelve en su `api.ts`. |
| `normalizeError(error)` y `AppError` | `lib/api/errors.ts` | Convierte cualquier error en un `AppError` con `code`, `message` en español y `details`. Los textos en español de cada código de error están en `translatedMessages`. |
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

## Sesión y usuario

`useAuth()` (`features/auth/AuthProvider.tsx`) da la sesión, el perfil, `login`,
`logout` y `refreshProfile`. No leas la sesión de Supabase directamente desde
una página.
