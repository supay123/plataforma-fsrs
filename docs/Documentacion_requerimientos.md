---
title: "Plataforma web académica con repaso espaciado mediante FSRS"
document_type: "Especificación funcional, técnica y acuerdo de prestación de servicios"
source: "contrato.pdf"
status: "Conversión estructurada del documento fuente"
start_date: "2026-07-23"
end_date: "2026-08-07"
duration: "2 semanas"
total_price: "S/ 400"
provider: "Oriol Fernando Palacios Durand"
client: "Miguel Angel Llacta Pereira"
client_document: "DNI 77417257"
language: "es"
---

# Desarrollo de plataforma web académica con repaso espaciado mediante FSRS

**Alcance técnico, cronograma, condiciones económicas y aceptación**

| Campo | Detalle |
|---|---|
| Duración | 2 semanas |
| Periodo | 23 de julio al 7 de agosto de 2026 |
| Precio total | S/ 400 |
| Fecha de inicio | 23 de julio de 2026 |

## Partes del acuerdo

- **Prestador:** Oriol Fernando Palacios Durand.
- **Cliente:** Miguel Angel Llacta Pereira, DNI 77417257.

La firma de este documento confirma la aceptación del alcance, las condiciones económicas, el cronograma y las exclusiones aquí descritas.

## Tabla de contenido

- [Desarrollo de plataforma web académica con repaso espaciado mediante FSRS](#desarrollo-de-plataforma-web-académica-con-repaso-espaciado-mediante-fsrs)
  - [Partes del acuerdo](#partes-del-acuerdo)
  - [Tabla de contenido](#tabla-de-contenido)
  - [1. Objeto y naturaleza del proyecto](#1-objeto-y-naturaleza-del-proyecto)
  - [2. Resumen del alcance contratado](#2-resumen-del-alcance-contratado)
  - [3. Organización de datos por colegio](#3-organización-de-datos-por-colegio)
  - [4. Acceso y perfiles de usuario](#4-acceso-y-perfiles-de-usuario)
    - [4.1 Vista del administrador](#41-vista-del-administrador)
    - [4.2 Vista del profesor](#42-vista-del-profesor)
    - [4.3 Vista del estudiante](#43-vista-del-estudiante)
  - [5. Gestión de cursos, temas y bloqueo](#5-gestión-de-cursos-temas-y-bloqueo)
  - [6. Importación de preguntas mediante Excel](#6-importación-de-preguntas-mediante-excel)
    - [6.1 Validación y previsualización](#61-validación-y-previsualización)
    - [6.2 Ecuaciones matemáticas mediante LaTeX](#62-ecuaciones-matemáticas-mediante-latex)
  - [7. Sesiones y lógica FSRS](#7-sesiones-y-lógica-fsrs)
  - [8. Resultados, dashboard y porcentajes](#8-resultados-dashboard-y-porcentajes)
    - [8.1 Dashboard posterior a cada examen](#81-dashboard-posterior-a-cada-examen)
    - [8.2 Porcentaje del examen](#82-porcentaje-del-examen)
    - [8.3 Porcentaje acumulado del tema](#83-porcentaje-acumulado-del-tema)
    - [8.4 Porcentaje general del curso](#84-porcentaje-general-del-curso)
  - [9. Arquitectura e infraestructura](#9-arquitectura-e-infraestructura)
  - [10. Cronograma y fases](#10-cronograma-y-fases)
  - [11. Entregables](#11-entregables)
  - [12. Validación y criterios de aceptación](#12-validación-y-criterios-de-aceptación)
  - [13. Precio y forma de pago](#13-precio-y-forma-de-pago)
  - [14. Responsabilidades del cliente](#14-responsabilidades-del-cliente)
  - [15. Responsabilidades del prestador](#15-responsabilidades-del-prestador)
  - [16. Exclusiones expresas](#16-exclusiones-expresas)
  - [17. Control de cambios](#17-control-de-cambios)
  - [18. Entrega de código y continuidad](#18-entrega-de-código-y-continuidad)

---

## 1. Objeto y naturaleza del proyecto

El presente documento formaliza la prestación del servicio de diseño, desarrollo, configuración, despliegue y validación de una aplicación web académica orientada a la evaluación mediante preguntas de opción múltiple y al repaso espaciado mediante FSRS.

La solución será un piloto funcional para la administración de colegios, profesores, estudiantes, cursos, temas, preguntas, sesiones, resultados y acceso temporal. La aplicación no constituye una plataforma comercial de suscripciones ni un sistema de análisis estadístico de tesis.

> **Regla de alcance**
>
> Únicamente forman parte del servicio las funcionalidades, límites, entregables y criterios de aceptación expresamente incluidos en este documento. Todo elemento no contemplado queda fuera del contrato y no será exigible ni afectará el cumplimiento del servicio.

## 2. Resumen del alcance contratado

| Área | Alcance contratado |
|---|---|
| Modalidad | Aplicación web responsive, tipo SPA/CSR, para celular, tablet y computadora. |
| Instituciones | Hasta 4 colegios dentro de una única plataforma y base de datos. |
| Usuarios | Hasta 150 estudiantes en total, además de profesores y un administrador. |
| Cursos | Hasta 8 cursos por profesor. |
| Temas | Hasta 10 temas por curso. |
| Preguntas | Hasta 50 preguntas por tema, con cuatro alternativas, una respuesta correcta, una explicación y soporte de expresiones LaTeX. |
| Sesiones | Máximo 20 preguntas por sesión, asociadas a un único tema. |
| Acceso | Códigos y contraseñas/PIN con rango de vigencia configurable para estudiantes. |
| Algoritmo | FSRS con versión y parámetros globales fijos durante el piloto. |
| Resultados | Dashboard posterior a cada examen, progreso por tema y promedio por curso. |

## 3. Organización de datos por colegio

Se utilizará una arquitectura multiinstitución simple: todos los colegios compartirán la misma aplicación y base de datos, y cada registro quedará asociado internamente a un identificador único de colegio. No se crearán bases de datos o proyectos independientes por institución.

El aislamiento de información se aplicará mediante relaciones de base de datos, autenticación, roles y políticas de seguridad. Un profesor solo podrá consultar los datos que le correspondan y un estudiante solo podrá ver sus propios cursos, sesiones y resultados.

## 4. Acceso y perfiles de usuario

Todos los usuarios ingresarán mediante un código y una contraseña o PIN. Las rutas separadas facilitan la navegación, pero la seguridad real se aplicará validando la identidad, el rol y los permisos en el backend.

| Perfil | Ruta | Forma de acceso |
|---|---|---|
| Administrador | `/admin` | Código administrativo + contraseña |
| Profesor | `/profesor` | Código de profesor + contraseña |
| Estudiante | `/estudiante` | Código individual + contraseña o PIN vigente |

### 4.1 Vista del administrador

- Iniciar sesión exclusivamente desde la ruta `/admin`.
- Crear, editar, activar o desactivar colegios.
- Registrar y administrar profesores y estudiantes.
- Asignar profesores y estudiantes a su colegio y vincular estudiantes con un profesor.
- Consultar profesores y abrir, desde la vista del profesor, la lista de estudiantes asignados.
- Generar, restablecer, activar o desactivar códigos y contraseñas/PIN.
- Definir mediante un selector la fecha de inicio y la fecha de vencimiento del acceso de cada estudiante.
- Bloquear o desbloquear temas para impedir o permitir el acceso de los estudiantes sin eliminar el contenido ni su historial.

No se incluye un dashboard administrativo general de métricas, rankings o estadísticas avanzadas.

### 4.2 Vista del profesor

- Iniciar sesión desde la ruta `/profesor`.
- Crear, editar, activar o desactivar hasta 8 cursos propios.
- Crear, editar, ordenar, activar o desactivar hasta 10 temas por curso.
- Bloquear o desbloquear un tema para sus estudiantes.
- Registrar un enlace externo de Google Drive por tema; el profesor será responsable del archivo, contenido y permisos del enlace.
- Descargar y cargar la plantilla oficial de preguntas en Excel.
- Previsualizar, validar y confirmar las preguntas antes de su importación.
- Incluir expresiones matemáticas en formato LaTeX dentro del enunciado, las alternativas y la explicación de cada pregunta mediante la plantilla oficial de Excel.
- Consultar a los estudiantes asignados y sus resultados por examen, tema y curso.
- Exportar los datos disponibles en formato CSV para análisis externo.

### 4.3 Vista del estudiante

- Iniciar sesión desde la ruta `/estudiante` con un código y contraseña o PIN dentro del rango de vigencia asignado.
- Ver los cursos a los que esté vinculado y los temas habilitados de cada curso.
- No acceder a temas bloqueados por el profesor o administrador.
- Abrir el material externo de Google Drive asociado al tema.
- Iniciar y continuar sesiones de hasta 20 preguntas de un único tema.
- Responder preguntas de opción múltiple y visualizar correctamente las ecuaciones matemáticas escritas en LaTeX cuando existan.
- Recibir, al finalizar el examen, un dashboard con cantidad y porcentaje de aciertos y errores.
- Revisar cada pregunta del examen, la respuesta seleccionada, la respuesta correcta y la explicación proporcionada por el profesor.
- Consultar el porcentaje acumulado por tema y el promedio general del curso.

> **Acceso temporal del estudiante**
>
> La vigencia será determinada mediante fecha de inicio y fecha final. Al vencer el rango, el estudiante perderá acceso a la plataforma, pero su historial y resultados permanecerán almacenados. La renovación será manual; no se incluyen pagos, cobros ni renovaciones automáticas.

## 5. Gestión de cursos, temas y bloqueo

Cada profesor podrá crear hasta ocho cursos y organizar temas dentro de cada uno. La plataforma permitirá activar, desactivar, bloquear y desbloquear temas. El bloqueo impedirá que el estudiante acceda al contenido y a nuevas sesiones del tema, sin eliminar preguntas, respuestas, porcentajes o historial previo.

| Límite o estado | Valor |
|---|---|
| Cursos por profesor | Máximo 8 |
| Temas por curso | Máximo 10 |
| Preguntas por tema | Máximo 50 |
| Sesión por tema | Máximo 20 preguntas |
| Estado de tema | Activo, bloqueado o inactivo |

## 6. Importación de preguntas mediante Excel

La carga masiva utilizará una única plantilla oficial. El profesor deberá seleccionar previamente el curso y el tema. No se ofrecerá compatibilidad abierta con archivos de estructura diferente.

| Columna | Contenido |
|---|---|
| `pregunta` | Enunciado de la pregunta; puede incluir sintaxis LaTeX. |
| `respuesta_a` | Primera alternativa; puede incluir sintaxis LaTeX. |
| `respuesta_b` | Segunda alternativa; puede incluir sintaxis LaTeX. |
| `respuesta_c` | Tercera alternativa; puede incluir sintaxis LaTeX. |
| `respuesta_d` | Cuarta alternativa; puede incluir sintaxis LaTeX. |
| `respuesta_correcta` | Letra A, B, C o D. |
| `explicacion` | Explicación que se mostrará al estudiante después de finalizar el examen; puede incluir sintaxis LaTeX. |

### 6.1 Validación y previsualización

- Verificación de todas las columnas obligatorias.
- Validación de pregunta, cuatro alternativas, respuesta correcta y explicación.
- Detección de filas vacías, duplicadas o con formato incorrecto.
- Verificación del límite de 50 preguntas por tema.
- Previsualización del total válido, rechazado y duplicado antes de confirmar.

### 6.2 Ecuaciones matemáticas mediante LaTeX

Las ecuaciones matemáticas se escribirán directamente en la plantilla oficial de Excel utilizando sintaxis LaTeX dentro de los campos de pregunta, alternativas o explicación. La plataforma almacenará el texto original y lo renderizará en la interfaz web mediante una librería compatible con LaTeX.

| Aspecto | Especificación |
|---|---|
| Entrada | Sintaxis LaTeX incluida directamente en las celdas de pregunta, alternativas o explicación de la plantilla Excel. |
| Renderizado | Las expresiones se mostrarán en la aplicación web mediante una librería compatible con LaTeX, como KaTeX. |
| Delimitadores | Se admitirán expresiones en línea con `$...$` y expresiones destacadas con `$$...$$`, según la sintaxis acordada en la plantilla. |
| Limitaciones | No habrá imágenes, editor visual de ecuaciones, OCR matemático ni conversión automática desde Word, PDF u otros formatos. |

No se incluirán imágenes en las preguntas. Tampoco se incluye un editor visual de ecuaciones tipo Word, conversión automática desde documentos o PDF, OCR matemático ni corrección académica o automática de la sintaxis LaTeX proporcionada por el profesor.

## 7. Sesiones y lógica FSRS

Cada combinación `estudiante + pregunta` tendrá una tarjeta FSRS independiente. La misma pregunta podrá ser programada para fechas distintas según el historial de cada estudiante.

| Regla | Comportamiento |
|---|---|
| Primera sesión | Hasta 20 preguntas nuevas, sin repetición. |
| Sesiones posteriores | Primero preguntas vencidas según FSRS y luego preguntas nuevas. |
| Cantidad insuficiente | La sesión podrá contener menos de 20 preguntas. |
| Orden | Las preguntas seleccionadas podrán mezclarse visualmente. |
| Respuesta incorrecta | Rating `Again`. |
| Respuesta correcta | Rating `Good`. |
| Configuración | Versión y parámetros globales fijos; no editables desde la interfaz. |

No se incluyen fine-tuning, optimización con historiales, comparación con SM-2, edición de parámetros, repetición inmediata del examen ni un modo separado para responder solo errores.

## 8. Resultados, dashboard y porcentajes

### 8.1 Dashboard posterior a cada examen

Después de completar una sesión, el estudiante visualizará un resumen específico del examen y una revisión de sus respuestas.

- Curso, tema y fecha del examen.
- Cantidad total de preguntas respondidas.
- Cantidad y porcentaje de respuestas correctas.
- Cantidad y porcentaje de respuestas incorrectas.
- Listado de preguntas del examen.
- Respuesta seleccionada por el estudiante.
- Respuesta correcta.
- Explicación académica proporcionada por el profesor en la plantilla Excel.

> **Protección de respuestas**
>
> La respuesta correcta y la explicación no se enviarán al navegador antes de finalizar el examen. La corrección se realizará en el backend y la revisión detallada se habilitará únicamente después del cierre de la sesión.

### 8.2 Porcentaje del examen

El porcentaje de aciertos se calculará dividiendo las respuestas correctas entre el total de preguntas respondidas. El porcentaje de errores será el complemento correspondiente.

**Ejemplo:** 14 respuestas correctas y 6 incorrectas de 20 preguntas: 70 % de aciertos y 30 % de errores.

### 8.3 Porcentaje acumulado del tema

Como regla metodológica inicial, el porcentaje del tema será el total acumulado de respuestas correctas del estudiante dividido entre el total de respuestas registradas en ese tema. Las preguntas del banco que no hayan sido presentadas no se considerarán incorrectas.

La tarjeta del tema mostrará nombre, porcentaje de acierto, barra visual y cantidad de sesiones realizadas. Sin actividad, se mostrará **“Sin datos”**.

### 8.4 Porcentaje general del curso

El porcentaje del curso será el promedio simple de los porcentajes de los temas que tengan actividad. Los temas sin datos no participarán en el promedio.

**Ejemplo:** Fracciones 60 %, Multiplicaciones 80 % y Ecuaciones 70 %: porcentaje del curso = 70 %.

Estos porcentajes representan aciertos observados y no equivalen a la recuperabilidad estimada internamente por FSRS.

## 9. Arquitectura e infraestructura

| Componente | Tecnología o condición |
|---|---|
| Frontend | React + TypeScript + Vite, desplegado en Netlify como SPA/CSR. |
| Datos y autenticación | Supabase Authentication y PostgreSQL. |
| Seguridad | Row Level Security y validación de roles. |
| Fórmulas | Renderizado de ecuaciones LaTeX en el frontend mediante una librería especializada. |
| Lógica crítica | Supabase Edge Functions para sesiones, corrección y FSRS. |
| Código | Repositorio o paquete de código fuente, migraciones y documentación básica. |

> **Uso de planes gratuitos**
>
> La solución se desplegará inicialmente en los niveles gratuitos disponibles de las herramientas seleccionadas. Cualquier costo adicional derivado de exceder límites de usuarios, almacenamiento, transferencia, ejecuciones, dominio, continuidad u otros recursos será asumido directamente por el cliente.

## 10. Cronograma y fases

El proyecto se ejecutará desde el 23 de julio de 2026 hasta el 7 de agosto de 2026. La duración total acordada es de dos semanas de trabajo, organizadas en una fase de MVP y una fase de validación.

| Fase / hito | Fecha | Actividad principal | Resultado |
|---|---|---|---|
| Inicio | 23 jul. 2026 | Reunión de inicio, recepción de insumos y configuración del proyecto. | Inicio formal del servicio. |
| Pago intermedio | 24 jul. 2026 | Continuidad de implementación. | Segundo pago recibido. |
| Semana 1 | 23-30 jul. 2026 | Desarrollo del núcleo funcional y despliegue de prueba. | Entrega de MVP para revisión. |
| Semana 2 | 31 jul.-7 ago. 2026 | Validación con el cliente, pruebas y correcciones dentro del alcance. | Entrega final y código fuente. |

Después del 7 de agosto de 2026, las partes coordinarán una reunión para presentar formalmente el trabajo realizado al cliente. La fecha y hora serán acordadas de manera independiente.

## 11. Entregables

- Aplicación web desplegada y accesible para validación.
- Tres vistas operativas: administrador, profesor y estudiante.
- Base de datos, autenticación, políticas de acceso y Edge Functions configuradas.
- Integración funcional con FSRS bajo parámetros fijos.
- Plantilla oficial de Excel con campo de explicación.
- Procesamiento y renderizado de ecuaciones matemáticas en formato LaTeX incluidas en la plantilla Excel.
- Dashboard posterior a cada examen y porcentajes por tema y curso.
- Control de vigencia de acceso de estudiantes mediante rango de fechas.
- Función de bloqueo y desbloqueo de temas.
- Exportación de datos en CSV para tratamiento externo.
- Código fuente, estructura de base de datos, migraciones y documentación básica de ejecución o despliegue.

## 12. Validación y criterios de aceptación

La segunda semana estará destinada a la validación conjunta. El cliente verificará los flujos y comunicará las observaciones relacionadas con el alcance aprobado. El prestador corregirá durante esta fase los defectos que impidan cumplir una funcionalidad expresamente contratada.

1. El administrador accede por `/admin`, crea colegios, gestiona usuarios, asigna relaciones y configura la vigencia del acceso estudiantil.
2. El profesor crea cursos y temas dentro de los límites acordados y puede bloquear o desbloquear temas.
3. La plantilla Excel se valida, previsualiza e importa, incluyendo respuesta correcta y explicación.
4. Las ecuaciones LaTeX incluidas en la plantilla Excel se almacenan y renderizan correctamente en preguntas, alternativas y explicaciones.
5. El estudiante accede solo cuando su código se encuentra dentro del rango de vigencia.
6. El estudiante realiza sesiones por tema, con un máximo de 20 preguntas.
7. La corrección y FSRS se ejecutan en el backend y el historial se conserva.
8. Al finalizar, el estudiante ve aciertos, errores, porcentajes, respuesta correcta y explicación.
9. El estudiante y el profesor consultan porcentajes por tema y promedio por curso.
10. Los datos pueden exportarse en CSV.
11. Los permisos impiden el acceso no autorizado a datos de otros usuarios o colegios.
12. El código fuente y los archivos técnicos acordados son entregados al cliente al cierre del proyecto.

> **Aceptación del producto**
>
> La aceptación podrá constar mediante firma, correo electrónico o mensaje escrito del cliente. Después de que el cliente verifique y acepte el producto, cualquier trabajo, cambio, soporte, ampliación o nueva fase será conversado y negociado de forma independiente a este acuerdo.

## 13. Precio y forma de pago

El precio total acordado por el alcance descrito es de cuatrocientos soles (S/ 400). El pago se realizará en tres partes:

| Pago | Monto | Fecha / condición | Comprobante |
|---|---:|---|---|
| Primer pago | S/ 100 | 23 de julio de 2026, al inicio del proyecto. | Recibo por Honorarios Electrónico. |
| Segundo pago | S/ 100 | Viernes 24 de julio de 2026. | Recibo por Honorarios Electrónico. |
| Pago final | S/ 200 | Al término del proyecto y entrega final, el 7 de agosto de 2026. | Recibo por Honorarios Electrónico. |

Oriol Fernando Palacios Durand emitirá un Recibo por Honorarios Electrónico por cada pago efectivamente recibido del cliente.

## 14. Responsabilidades del cliente

- Realizar los pagos en las fechas y condiciones acordadas.
- Entregar oportunamente preguntas, explicaciones, enlaces, criterios metodológicos, accesos y demás insumos necesarios.
- Revisar el MVP y participar en la validación durante la segunda semana.
- Responder con oportunidad a las consultas funcionales que puedan impedir el avance.
- Asumir los costos de proveedores o servicios cuando se superen los límites gratuitos o se soliciten recursos de pago.
- Garantizar que tiene derecho a utilizar los contenidos, documentos y datos proporcionados.
- Realizar la validación académica de preguntas, respuestas y explicaciones; el prestador no responde por la exactitud del contenido educativo.

## 15. Responsabilidades del prestador

- Implementar las funcionalidades expresamente descritas en este acuerdo.
- Mantener comunicación razonable durante el periodo del proyecto.
- Entregar el MVP en la primera semana y destinar la segunda a validación y ajustes dentro del alcance.
- Entregar el producto final y el código fuente al cierre del proyecto.
- Emitir los comprobantes electrónicos correspondientes a cada pago recibido.

## 16. Exclusiones expresas

- Reporte estadístico interno, alfa de Cronbach, correlaciones, pruebas de hipótesis, análisis inferencial o interpretación para la tesis.
- Generación automática de informes académicos en PDF o integración directa con SPSS, Jamovi o R.
- Gamificación, insignias, retos, logro general, rankings o métrica de esfuerzo total.
- Sesiones combinadas con preguntas aleatorias de todos los temas del curso.
- Repetición inmediata del examen o modo para responder únicamente errores.
- Fine-tuning, optimización, comparación de algoritmos o panel editable de parámetros FSRS.
- Sistema comercial de suscripciones, pagos en línea, renovación automática, facturación a estudiantes o planes de membresía.
- Aplicación móvil nativa, publicación en tiendas, SSR, ISR o migración a Next.js.
- Dominio personalizado, correo transaccional, notificaciones push o SMS.
- Editor visual avanzado de ecuaciones o contenido; conversión automática desde Word o PDF; OCR matemático; generación de preguntas con inteligencia artificial.
- Carga, redacción, corrección o validación manual de todos los bancos de preguntas por parte del prestador.
- Diseño gráfico de marca, animaciones avanzadas, ilustraciones personalizadas, réplica exacta de los drafts o rediseños completos.
- Soporte, mantenimiento, cambios o nuevas funciones posteriores a la aceptación final, salvo nuevo acuerdo.

## 17. Control de cambios

Se considera **corrección** la solución de un comportamiento defectuoso que impida cumplir una funcionalidad descrita en este documento. Se considera **cambio de alcance** cualquier nueva pantalla, regla, módulo, integración, cálculo, límite, flujo, diseño o comportamiento no incluido de forma expresa.

> **Condición vinculante**
>
> Todo lo que no se encuentre contemplado en este contrato no deberá ser desarrollado ni entregado y no afectará el cumplimiento del contrato. Cualquier ampliación requerirá una evaluación técnica, un plazo y una cotización independiente aceptada por ambas partes.

## 18. Entrega de código y continuidad

Al finalizar la segunda semana y realizarse el pago final, el prestador entregará al cliente el código fuente y los archivos técnicos incluidos. Las librerías, servicios y componentes de terceros conservarán sus respectivas licencias y condiciones.

Después de la verificación y aceptación del producto, todo servicio, soporte, ajuste, mejora, despliegue adicional o nueva fase será conversado y negociado independientemente de los acuerdos contenidos en este contrato.