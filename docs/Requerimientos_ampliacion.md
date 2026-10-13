---
title: "Ampliación de requerimientos de la plataforma académica FSRS"
document_type: "Especificación funcional de cambios posteriores al alcance original"
base_document: "Documentacion_requerimientos.md"
status: "Borrador"
date: "2026-10-08"
language: "es"
---

# Ampliación de requerimientos de la plataforma académica FSRS

Este documento registra los cambios de la plataforma posteriores al alcance
descrito en [Documentacion_requerimientos.md](Documentacion_requerimientos.md)
(en adelante, el **documento original**).

- El documento original no se modifica y sigue vigente en todo lo que este
  documento no cambie.
- Cuando ambos documentos se contradigan, prevalece este.
- Este documento describe solo el comportamiento funcional. Plazos, costos y
  condiciones comerciales de cada ampliación se acuerdan por separado.

## Tabla de contenido

- [1. Resumen de cambios](#1-resumen-de-cambios)
- [2. Cambios ya implementados](#2-cambios-ya-implementados)
  - [2.1 Límite de temas por curso](#21-límite-de-temas-por-curso)
  - [2.2 Recuperación de contraseña con pregunta de seguridad](#22-recuperación-de-contraseña-con-pregunta-de-seguridad)
  - [2.3 Asignación de estudiantes a un profesor](#23-asignación-de-estudiantes-a-un-profesor)
  - [2.4 Eliminación de usuarios y colegios](#24-eliminación-de-usuarios-y-colegios)
- [3. Retroalimentación inmediata por pregunta](#3-retroalimentación-inmediata-por-pregunta)
- [4. Perfil de usuario (por definir)](#4-perfil-de-usuario-por-definir)
- [5. Pagos con Culqi (por definir)](#5-pagos-con-culqi-por-definir)
- [6. Secciones del documento original afectadas](#6-secciones-del-documento-original-afectadas)

---

## 1. Resumen de cambios

| ID | Cambio | Estado |
|---|---|---|
| C-01 | Límite de temas por curso ampliado de 10 a 25. | Implementado |
| C-02 | Recuperación de contraseña por el propio usuario mediante pregunta de seguridad. | Implementado |
| C-03 | Asignación de estudiantes a un profesor desde una sola operación. | Implementado |
| C-04 | Eliminación definitiva de usuarios y colegios por el administrador. | Implementado |
| C-05 | Retroalimentación inmediata después de responder cada pregunta. | En desarrollo |
| C-06 | Perfil de usuario. | Por definir |
| C-07 | Pagos en línea con Culqi. | Por definir |

## 2. Cambios ya implementados

Estos cambios ya están en la plataforma. Se documentan aquí porque modifican
reglas del documento original.

### 2.1 Límite de temas por curso

Un curso puede tener hasta **25 temas** no archivados (antes: 10). Los demás
límites no cambian: 8 cursos por profesor, 50 preguntas por tema y 20 preguntas
por sesión.

### 2.2 Recuperación de contraseña con pregunta de seguridad

- Cada usuario puede configurar una pregunta y una respuesta de seguridad desde
  su pantalla de seguridad.
- Si olvida su contraseña, puede definir una nueva desde la pantalla de inicio
  de sesión respondiendo esa pregunta, sin intervención del administrador.
- Tras **5 intentos fallidos**, la recuperación queda bloqueada durante
  **15 minutos**.
- La respuesta se almacena cifrada mediante hash y nunca en texto plano. Ni
  siquiera el administrador puede consultarla.
- El administrador conserva la facultad de restablecer credenciales.

### 2.3 Asignación de estudiantes a un profesor

- El administrador selecciona un profesor y marca los estudiantes de su mismo
  colegio que le corresponden.
- La plataforma matricula a esos estudiantes en todos los cursos no archivados
  del profesor y retira a los que se desmarquen.
- Los cursos que el profesor cree después incluyen automáticamente a sus
  estudiantes asignados.
- El profesor debe tener al menos un curso antes de recibir estudiantes.

### 2.4 Eliminación de usuarios y colegios

Además de activar o desactivar, el administrador puede **eliminar
definitivamente** profesores, estudiantes y colegios.

La eliminación borra en cascada todos los datos asociados: cursos, matrículas,
sesiones, respuestas e historial FSRS. No se puede deshacer, por lo que la
desactivación sigue siendo la opción recomendada cuando se quiera conservar el
historial.

## 3. Retroalimentación inmediata por pregunta

### 3.1 Objetivo

Que el estudiante sepa si acertó en el momento en que responde cada pregunta,
sin esperar al final del examen, y que vea la explicación del profesor mientras
el razonamiento sigue fresco.

### 3.2 Alcance

Se aplica a **todas las sesiones de todos los cursos**. No es configurable por
curso, profesor ni estudiante.

### 3.3 Flujo del estudiante

1. El estudiante selecciona una alternativa y pulsa **Confirmar respuesta**.
2. La plataforma registra la respuesta en el servidor. Desde ese momento la
   respuesta es definitiva y no puede cambiarse.
3. Se muestra de inmediato:
   - si la respuesta fue **correcta** o **incorrecta**;
   - la alternativa seleccionada y la alternativa correcta, diferenciadas
     visualmente;
   - la explicación del profesor, con soporte LaTeX. Si la pregunta no tiene
     explicación, este bloque no se muestra.
4. El estudiante pulsa **Siguiente** para continuar con la próxima pregunta.
5. Tras responder la última pregunta, pulsa **Finalizar examen** y ve el
   dashboard del examen descrito en la sección 8.1 del documento original, sin
   cambios.

### 3.4 Continuidad de la sesión

- Si el estudiante recarga la página, cierra el navegador o vuelve más tarde a
  una sesión en curso, las preguntas ya respondidas conservan su respuesta y
  muestran su corrección. La sesión continúa desde la primera pregunta
  pendiente.
- Como cada respuesta queda guardada en el servidor al confirmarla, el progreso
  no depende del navegador ni del dispositivo.

### 3.5 Protección de respuestas

Esta regla reemplaza la nota **Protección de respuestas** de la sección 8.1 del
documento original:

> La corrección se realiza en el backend. La respuesta correcta y la
> explicación de una pregunta se envían al navegador únicamente después de que
> el servidor haya registrado la respuesta del estudiante a esa misma pregunta.
> Las preguntas pendientes de la sesión nunca exponen su respuesta correcta ni
> su explicación.

### 3.6 FSRS

No cambian las reglas de la sección 7 del documento original: una respuesta
correcta se califica como `Good` y una incorrecta como `Again`. La tarjeta FSRS
de cada pregunta se actualiza en el momento en que se responde.

### 3.7 Errores de conexión

- Mientras se corrige la respuesta, la pantalla muestra un indicador de espera.
- Si falla la conexión, se informa al estudiante y se le permite reintentar.
- Reintentar es seguro: una misma pregunta nunca se registra dos veces.

### 3.8 Plantilla de Excel

No cambia la estructura de la plantilla. Solo cambia el momento en que se
muestra la columna `explicacion`: al estudiante, **inmediatamente después de
responder la pregunta** y nuevamente en la revisión final del examen.

### 3.9 Criterios de aceptación

1. Al confirmar una respuesta, el estudiante ve si acertó, la alternativa
   correcta y la explicación antes de pasar a la siguiente pregunta.
2. Una respuesta confirmada no puede modificarse.
3. Antes de responder una pregunta, el navegador no recibe su respuesta
   correcta ni su explicación.
4. Al recargar una sesión en curso, las preguntas respondidas muestran su
   corrección y la sesión continúa en la primera pregunta pendiente.
5. El dashboard y la revisión al finalizar el examen muestran los mismos datos
   que antes.
6. Los porcentajes por tema y por curso, y la programación FSRS, se calculan
   igual que antes.
7. Las sesiones que estaban en curso cuando se publicó el cambio pueden
   completarse con normalidad.

## 4. Perfil de usuario (por definir)

Pendiente de confirmar con el cliente qué se espera:

- **Edición del propio perfil**: que cada usuario modifique algunos de sus
  datos (por ejemplo, nombre o contraseña).
- **Autorregistro de estudiantes**: que un estudiante cree su propia cuenta sin
  que lo haga el administrador.
- Ambas.

Cualquiera de las dos opciones modifica la sección 4 del documento original, que
establece que el administrador registra a todos los usuarios. El autorregistro
debe definir además a qué colegio se asigna el estudiante y con qué vigencia de
acceso.

## 5. Pagos con Culqi (por definir)

Esta ampliación deja sin efecto, para lo que se defina aquí, la exclusión de
**pagos en línea** de la sección 16 del documento original y la nota **Acceso
temporal del estudiante** de la sección 4.3, que indica que no se incluyen
pagos.

Pendiente de definir con el cliente:

- Qué se adquiere con el pago. La opción más probable es extender la fecha de
  fin de acceso del estudiante.
- Precio, y si es un pago único o por periodo.
- Quién paga: el estudiante, un apoderado o el colegio.

Para publicar en producción se requerirán las llaves de producción de Culqi y
el registro de la URL del webhook en el panel de Culqi.

## 6. Secciones del documento original afectadas

| Sección original | Cambio | Referencia |
|---|---|---|
| 2. Resumen del alcance | Temas por curso: hasta 25. | C-01 |
| 4. Acceso y perfiles | Recuperación de contraseña por el propio usuario. | C-02 |
| 4.1 Vista del administrador | Eliminación definitiva de usuarios y colegios; asignación de estudiantes a un profesor. | C-03, C-04 |
| 4.2 Vista del profesor | Hasta 25 temas por curso. | C-01 |
| 4.3 Vista del estudiante | Corrección y explicación inmediatamente después de cada respuesta. | C-05 |
| 5. Gestión de cursos y temas | Temas por curso: máximo 25. | C-01 |
| 6. Importación por Excel | La explicación también se muestra tras responder cada pregunta. | C-05 |
| 8.1 Dashboard posterior al examen | Nueva regla de protección de respuestas. | C-05 |
| 12. Criterios de aceptación, punto 8 | Se complementa con los criterios de la sección 3.9. | C-05 |
| 16. Exclusiones expresas | Pagos en línea, según se defina en C-07. | C-07 |
