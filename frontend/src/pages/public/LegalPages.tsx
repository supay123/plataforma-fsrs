import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicLayout";
import { BUSINESS, PLANS, PRICE_CHANGE_NOTICE_DAYS, SEMESTER_PLAN, planPriceLabel } from "../../config/business";
import { EXPIRED_REVIEW_DAYS, RENEWAL_NOTICE_DAYS } from "../../lib/student-access";

const UPDATED_AT = "12 de octubre de 2026";

function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return <PublicPage>
    <article className="mx-auto max-w-3xl px-4 py-14 text-slate-300 [&_a]:text-indigo-300 [&_a:hover]:text-indigo-200 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-white [&_li]:mt-2 [&_p]:mt-4 [&_p]:leading-7 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:leading-7">
      <h1 className="text-3xl font-bold text-white sm:text-4xl">{title}</h1>
      <p className="text-sm text-slate-400">Última actualización: {UPDATED_AT}</p>
      {children}
    </article>
  </PublicPage>;
}

function Contact() {
  return <>por teléfono o WhatsApp al <a href={`https://wa.me/${BUSINESS.whatsapp}`} target="_blank" rel="noreferrer">{BUSINESS.phone}</a> o al correo <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a></>;
}

const owner = `${BUSINESS.legalName}, con RUC ${BUSINESS.ruc} y domicilio fiscal en ${BUSINESS.address}`;

export function TermsPage() {
  return <LegalPage title="Términos y condiciones">
    <p>Estos términos regulan el uso de la plataforma {BUSINESS.tradeName} (en adelante, «{BUSINESS.brand}» o «la plataforma»), de titularidad de {owner}. Al crear una cuenta o pagar un plan aceptas estos términos.</p>
    <h2>1. El servicio</h2>
    <p>{BUSINESS.brand} es una plataforma web de práctica académica preuniversitaria. Ofrece sesiones de preguntas sobre los cursos y temas asignados a cada estudiante, programa los repasos mediante un algoritmo de repetición espaciada y muestra el progreso y los resultados de cada sesión.</p>
    <h2>2. Cuentas</h2>
    <ul>
      <li>Tu cuenta es personal e intransferible. Eres responsable de mantener la confidencialidad de tu código y contraseña.</li>
      <li>Si el estudiante es menor de edad, la cuenta debe crearla y el plan pagarlo su padre, madre o apoderado, quien acepta estos términos en su nombre.</li>
      <li>Debes proporcionar información veraz y mantenerla actualizada.</li>
    </ul>
    <h2>3. Planes y pagos</h2>
    <ul>
      {PLANS.map((plan) => <li key={plan.id}>El {plan.name} cuesta {planPriceLabel(plan)} de acceso.</li>)}
      <li>Los precios se expresan en soles. Los pagos se procesan a través de Kuti (kuti.pe): pagas escaneando un código QR con Yape, Plin u otra billetera. El {SEMESTER_PLAN.name} también puede pagarse con un código de pago de servicios desde la app de tu banco o de Yape (institución KUTI).</li>
      <li>Cada pago es único. No hay débitos ni renovaciones automáticas: solo pagas cuando decides seguir usando la plataforma.</li>
      <li>Tu acceso empieza el día en que se confirma el pago y dura los meses del plan que pagaste.</li>
      <li>{BUSINESS.brand} no tiene acceso a las claves de tus aplicaciones de pago ni las almacena.</li>
      <li>Si el precio cambia, te avisaremos con al menos {PRICE_CHANGE_NOTICE_DAYS} días calendario de anticipación. El nuevo precio se aplicará a los pagos que hagas desde que entre en vigencia y no afecta el periodo que ya pagaste.</li>
    </ul>
    <h2>4. Renovación y vencimiento</h2>
    <ul>
      <li>Desde {RENEWAL_NOTICE_DAYS} días antes de que venza tu plan, verás un aviso en la plataforma para renovarlo.</li>
      <li>Si renuevas antes del vencimiento, los meses que pagues se suman al final de tu plan vigente: no pierdes días.</li>
      <li>Si tu plan vence, solo podrás entrar a la plataforma para renovarlo. Al pagar, tu acceso vuelve a empezar el día del pago y conservas tu progreso.</li>
      <li>Si tu plan lleva más de {EXPIRED_REVIEW_DAYS} días vencido, podemos eliminar tu cuenta y tu progreso. En ese caso, para volver deberás crear una cuenta nueva.</li>
    </ul>
    <h2>5. Reembolsos</h2>
    <p>Los pagos no son reembolsables, ni total ni proporcionalmente, salvo los casos excepcionales descritos en la <Link to="/reembolsos">política de reembolsos</Link>.</p>
    <h2>6. Soporte</h2>
    <p>Si tienes problemas para acceder a tu cuenta o con cualquier función de la plataforma, comunícate con nosotros <Contact />. Te ayudaremos hasta resolverlo.</p>
    <h2>7. Uso aceptable</h2>
    <p>No está permitido compartir tu cuenta con terceros, copiar o distribuir el contenido de la plataforma, intentar acceder a cuentas o datos ajenos, ni interferir con el funcionamiento o la seguridad del servicio. El incumplimiento puede dar lugar a la suspensión de la cuenta.</p>
    <h2>8. Propiedad intelectual</h2>
    <p>El software, el diseño y la marca {BUSINESS.brand} pertenecen a su titular. Las preguntas y materiales de estudio pertenecen a sus respectivos autores. Tu plan te otorga una licencia personal y no exclusiva para usarlos dentro de la plataforma.</p>
    <h2>9. Disponibilidad y responsabilidad</h2>
    <p>Trabajamos para que la plataforma esté disponible de forma continua, pero puede haber interrupciones por mantenimiento o causas ajenas a nuestro control. La plataforma es una herramienta de apoyo al estudio y no garantiza un resultado académico determinado.</p>
    <h2>10. Cambios en estos términos</h2>
    <p>Podemos actualizar estos términos. Publicaremos la nueva versión en esta página con su fecha de actualización y, si el cambio es relevante, te lo comunicaremos con anticipación.</p>
    <h2>11. Ley aplicable y reclamos</h2>
    <p>Estos términos se rigen por las leyes de la República del Perú, incluido el Código de Protección y Defensa del Consumidor (Ley N.° 29571). Puedes registrar un reclamo o queja en nuestro <Link to="/libro-reclamaciones">Libro de reclamaciones</Link>, sin perjuicio de acudir al INDECOPI.</p>
    <h2>12. Contacto</h2>
    <p>Para cualquier consulta sobre estos términos, comunícate con nosotros <Contact />.</p>
  </LegalPage>;
}

export function PrivacyPage() {
  return <LegalPage title="Política de privacidad">
    <p>Esta política explica cómo {owner} (en adelante, «{BUSINESS.brand}») trata tus datos personales, conforme a la Ley N.° 29733, Ley de Protección de Datos Personales, y su reglamento.</p>
    <h2>1. Datos que tratamos</h2>
    <ul>
      <li><strong>Identificación y contacto:</strong> nombres, apellidos, correo electrónico, teléfono, tipo y número de documento de identidad, colegio y código de usuario.</li>
      <li><strong>Uso académico:</strong> cursos asignados, respuestas, resultados, tiempos de respuesta y progreso.</li>
      <li><strong>Pagos:</strong> los procesa Kuti (QR con Yape, Plin u otra billetera, o pago de servicios). Solo recibimos la información necesaria para identificar el pago, como el plan, la fecha, el monto y el número de operación. Nunca recibimos las claves de tus aplicaciones de pago.</li>
      <li><strong>Reclamos:</strong> los datos que registres en el Libro de reclamaciones, que se envían a nuestro correo electrónico.</li>
    </ul>
    <h2>2. Para qué los usamos</h2>
    <ul>
      <li>Crear y administrar tu cuenta y prestarte el servicio.</li>
      <li>Programar tus repasos y mostrarte tu progreso.</li>
      <li>Procesar los pagos de tu plan y avisarte cuando esté por vencer.</li>
      <li>Atender consultas, reclamos y quejas.</li>
      <li>Mantener la seguridad de la plataforma y mejorarla.</li>
    </ul>
    <p>No vendemos ni alquilamos tus datos personales.</p>
    <h2>3. Con quién los compartimos</h2>
    <ul>
      <li>Los profesores y la institución a la que perteneces pueden ver tus resultados y progreso en los cursos que te asignan.</li>
      <li>Proveedores que nos ayudan a operar el servicio: Kuti (pagos), Supabase (base de datos y autenticación), Netlify (alojamiento web), Google (envío de correos de verificación mediante Gmail) y FormSubmit (envío del Libro de reclamaciones a nuestro correo). Algunos de ellos almacenan la información en servidores fuera del Perú, con medidas de seguridad adecuadas.</li>
      <li>Autoridades competentes, cuando la ley lo exija.</li>
    </ul>
    <h2>4. Menores de edad</h2>
    <p>Para tratar los datos de menores de 14 años necesitamos el consentimiento de su padre, madre o apoderado, que se otorga al crear la cuenta o pagar el plan.</p>
    <h2>5. Conservación</h2>
    <ul>
      <li>Si te registras y no completas el pago, eliminamos tus datos a las 24 horas. Si generaste un cobro, esperamos además 24 horas desde ese cobro, por si el pago se confirma tarde.</li>
      <li>Mientras tu plan esté vigente, conservamos tus datos y tu progreso.</li>
      <li>Si tu plan lleva más de {EXPIRED_REVIEW_DAYS} días vencido sin renovarse, podemos eliminar tu cuenta, tu progreso y tus datos personales. Si eso ocurre y vuelves, empiezas con una cuenta nueva.</li>
    </ul>
    <p>Además, conservamos la información necesaria para cumplir obligaciones legales. Los reclamos se conservan por al menos dos años, como exige la normativa de protección al consumidor.</p>
    <h2>6. Seguridad</h2>
    <p>Toda la comunicación con la plataforma viaja cifrada (HTTPS). Las contraseñas y respuestas de seguridad se guardan cifradas mediante funciones hash, y el acceso a los datos está restringido según el rol de cada usuario.</p>
    <h2>7. Almacenamiento en tu navegador</h2>
    <p>Usamos el almacenamiento local de tu navegador solo para mantener tu sesión iniciada y guardar avances de práctica. No usamos cookies publicitarias.</p>
    <h2>8. Tus derechos</h2>
    <p>Puedes ejercer tus derechos de acceso, rectificación, cancelación y oposición comunicándote con nosotros <Contact />. Si consideras que no fueron atendidos, puedes acudir a la Autoridad Nacional de Protección de Datos Personales.</p>
    <h2>9. Cambios en esta política</h2>
    <p>Publicaremos cualquier cambio en esta página con su fecha de actualización.</p>
  </LegalPage>;
}

export function RefundPolicyPage() {
  return <LegalPage title="Política de reembolsos">
    <p>{BUSINESS.brand} ofrece un servicio digital prepagado. Al pagar un plan obtienes acceso inmediato a la plataforma durante todo el periodo pagado ({PLANS.map((plan) => planPriceLabel(plan)).join(" o ")}), por lo que los pagos no son reembolsables.</p>
    <h2>1. Pagos no reembolsables</h2>
    <p>No realizamos devoluciones totales ni parciales de los pagos, incluidos los periodos no usados o usados parcialmente. Esto también aplica si dejas de usar la plataforma antes de que termine el {SEMESTER_PLAN.name}.</p>
    <h2>2. Sin renovación automática</h2>
    <ul>
      <li>No realizamos cobros automáticos, así que no necesitas cancelar nada.</li>
      <li>Si no renuevas tu plan, tu acceso termina el último día del periodo que pagaste.</li>
    </ul>
    <h2>3. Te ayudamos con cualquier problema</h2>
    <p>Si tienes problemas para acceder a tu cuenta o con cualquier función de la plataforma, comunícate con nosotros <Contact />. Te acompañaremos hasta resolverlo para que aproveches el periodo que pagaste.</p>
    <h2>4. Casos excepcionales</h2>
    <p>Solo evaluaremos una devolución cuando exista una razón grave y debidamente justificada; por ejemplo, si pagaste dos veces el mismo plan, si se realizó un cobro por un error de nuestra parte o si tu pago llegó cuando ya no era posible aplicarlo a tu cuenta. Para solicitarla, escríbenos indicando tu nombre, la fecha, el monto y el número de operación. Responderemos en un plazo máximo de 15 días hábiles.</p>
    <h2>5. Tus derechos como consumidor</h2>
    <p>Esta política no limita los derechos que te reconoce el Código de Protección y Defensa del Consumidor. Puedes presentar un reclamo o queja en nuestro <Link to="/libro-reclamaciones">Libro de reclamaciones</Link>.</p>
  </LegalPage>;
}
