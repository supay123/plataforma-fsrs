import { zodResolver } from "@hookform/resolvers/zod";
import { LockKeyhole, Mail, User } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { AuthLayout, type AuthCover } from "../../components/layout/AuthLayout";
import { Alert, Button, Field, Input, PasswordInput } from "../../components/ui";
import { useToast } from "../../components/ui/use-toast";
import { requestPasswordResetLink } from "../account/api";
import { EMAIL_PATTERN } from "../registration/rules";
import { normalizeError } from "../../lib/api/errors";
import { studentAccess } from "../../lib/student-access";
import type { AppRole, Credentials } from "../../types/contracts";
import { PracticeMascot } from "../sessions/PracticeMascot";
import { getRecoveryQuestion, recoverPassword } from "./api";
import { useAuth } from "./AuthProvider";

const schema = z.object({ code: z.string().trim().min(1, "Completa este campo."), password: z.string().min(6, "Debe tener al menos 6 caracteres.") });
type Values = z.infer<typeof schema>;
const portal = {
  admin: { label: "Administrador", path: "/admin" },
  teacher: { label: "Profesor", path: "/profesor" },
  student: { label: "Estudiante", path: "/estudiante" },
} as const;
const covers: Record<AppRole, AuthCover> = {
  admin: { title: "Todo tu colegio en un solo lugar", description: "Gestiona colegios, profesores y estudiantes desde un mismo panel." },
  teacher: { title: "Enseña con datos, no con suposiciones", description: "Arma tus cursos, importa tus preguntas y sigue el avance de cada estudiante." },
  student: { title: "Repasa justo antes de olvidar", description: "Chancón programa cada pregunta con repaso espaciado para que estudies menos y recuerdes más." },
};

// La mascota mira hacia el campo que se está llenando (el de arriba a un lado, el de abajo al otro).
const CODE_FIELD_GAZE = { x: -0.6, y: -0.4 };
const PASSWORD_FIELD_GAZE = { x: 0.6, y: -0.8 };

export function LoginPage({ role }: { role: AppRole }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [recovering, setRecovering] = useState(false);
  const [error, setError] = useState("");
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema) });
  const access = auth.profile?.role === "student" ? studentAccess(auth.profile).state : "active";
  if (!auth.loading && auth.profile?.is_active && access === "expired") return <Navigate to="/estudiante/renovar" replace />;
  if (!auth.loading && auth.profile?.is_active && access === "active") return <Navigate to={portal[auth.profile.role].path} replace />;
  const submit = handleSubmit(async (values) => {
    try { setError(""); await auth.login(values.code, values.password, role); navigate(portal[role].path, { replace: true }); }
    catch (reason) { setError((await normalizeError(reason)).message); }
  });
  return <AuthLayout dark cover={covers[role]}>
      {recovering
        ? role === "student"
          ? <EmailRecoveryForm onBack={() => setRecovering(false)} />
          : <RecoveryForm role={role} onBack={() => setRecovering(false)} />
        : <>
          {role === "student" && <PracticeMascot size={72} className="mb-3"
            event={error ? "wrong" : searchParams.get("pago") === "confirmado" || searchParams.get("invitacion") === "aceptada" ? "streak" : "rest"}
            gaze={focusedField === "code" ? CODE_FIELD_GAZE : focusedField === "password" ? PASSWORD_FIELD_GAZE : null} />}
          <h1 className="type-display text-2xl">Acceso de {portal[role].label}</h1>
          <p className="mt-2 text-sm text-fg-muted">{role === "student" ? "Ingresa con tu correo, o con el código que te dio tu institución." : "Ingresa con el código entregado por la institución."}</p>
          <form onSubmit={submit} onFocus={(event) => setFocusedField(event.target.getAttribute("name"))} onBlur={() => setFocusedField(null)} className="mt-6 grid gap-4">
            {(searchParams.get("acceso") === "vencido" || access === "not_started") &&
              <Alert tone="error">Tu periodo de acceso todavía no empieza. Consulta con tu institución.</Alert>}
            {searchParams.get("password") === "actualizada" && !error &&
              <Alert tone="success">Tu contraseña se actualizó. Ingresa con tu nueva contraseña.</Alert>}
            {searchParams.get("pago") === "confirmado" && !error &&
              <Alert tone="success">¡Pago confirmado! Tu cuenta está lista. Ingresa con tu correo y tu contraseña.</Alert>}
            {searchParams.get("invitacion") === "aceptada" && !error &&
              <Alert tone="success">Tu cuenta está lista. Ingresa con tu correo y tu contraseña.</Alert>}
            {error && <Alert tone="error">{error}</Alert>}
            <Field label={role === "student" ? "Correo" : "Código"} error={errors.code?.message}><Input autoComplete="username" icon={role === "student" ? <Mail size={20} /> : <User size={20} />} placeholder={role === "student" ? "tu@correo.com" : "Tu código"} {...register("code")} /></Field>
            <Field label="Contraseña" error={errors.password?.message}><PasswordInput autoComplete="current-password" icon={<LockKeyhole size={20} />} placeholder="Contraseña" {...register("password")} /></Field>
            <Button disabled={isSubmitting}>{isSubmitting ? "Ingresando…" : "Ingresar"}</Button>
            <button type="button" className="text-sm font-semibold text-primary-text hover:text-fg" onClick={() => { setError(""); setRecovering(true); }}>¿Olvidaste tu contraseña?</button>
            {role === "student" && <p className="text-center text-sm text-fg-muted">¿No tienes una cuenta? <Link className="font-semibold text-primary-text hover:text-fg" to="/estudiante/sign-up">Regístrate</Link></p>}          </form>
        </>}
  </AuthLayout>;
}

function BackToLogin({ onBack }: { onBack: () => void }) {
  return <p className="text-center text-sm text-fg-muted">¿Ya recordaste tu contraseña? <button type="button" className="font-semibold text-primary-text hover:text-fg" onClick={onBack}>Inicia sesión</button></p>;
}

/** Estudiantes: reciben en su correo un link para crear una nueva contraseña. */
function EmailRecoveryForm({ onBack }: { onBack: () => void }) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const value = email.trim();
    if (!EMAIL_PATTERN.test(value)) return setError("Ingresa un correo válido.");
    try {
      setBusy(true); setError("");
      await requestPasswordResetLink(value);
      setSentTo(value);
    } catch (reason) { toast.error((await normalizeError(reason)).message); }
    finally { setBusy(false); }
  };

  return <>
    <h1 className="type-display text-2xl">Recuperar contraseña</h1>
    <p className="mt-2 text-sm text-fg-muted">Escribe el correo de tu cuenta y te enviaremos un link para crear una nueva contraseña.</p>
    <form onSubmit={(event) => void send(event)} className="mt-6 grid gap-4" noValidate>
      {sentTo
        ? <Alert tone="success">Te enviamos a <strong>{sentTo}</strong> un link para crear una nueva contraseña. Vence en 1 hora; si no lo ves, revisa la carpeta de spam.</Alert>
        : <>
          <Field label="Correo" error={error}><Input type="email" autoComplete="email" icon={<Mail size={20} />} placeholder="tu@correo.com" value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
          <Button disabled={busy}>{busy ? "Enviando…" : "Enviar link"}</Button>
        </>}
      <BackToLogin onBack={onBack} />
    </form>
  </>;
}

/** Administradores y profesores: recuperan su credencial con la pregunta de seguridad. */
function RecoveryForm({ role, onBack }: { role: AppRole; onBack: () => void }) {
  const [code, setCode] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const findQuestion = async () => {
    try {
      setBusy(true); setError("");
      const result = await getRecoveryQuestion(code, role);
      setQuestion(result.security_question);
    } catch (reason) { setError((await normalizeError(reason)).message); }
    finally { setBusy(false); }
  };
  const reset = async () => {
    try {
      setBusy(true); setError("");
      const result = await recoverPassword(code, role, answer);
      setCredentials(result.credentials);
    } catch (reason) { setError((await normalizeError(reason)).message); }
    finally { setBusy(false); }
  };

  return <>
    <h1 className="type-display text-2xl">Restablecer contraseña</h1>
    <p className="mt-2 text-sm text-fg-muted">Confirma tu respuesta de seguridad para generar una nueva credencial.</p>
    <div className="mt-6 grid gap-4">
      {error && <Alert tone="error">{error}</Alert>}
      {credentials
        ? <Alert tone="success"><strong>Nueva credencial</strong><br />{credentials.user_code} / {credentials.temporary_password}<Button type="button" variant="ghost" className="mt-2" onClick={() => void navigator.clipboard.writeText(`${credentials.user_code}\n${credentials.temporary_password ?? ""}`)}>Copiar</Button></Alert>
        : <>
          <Field label="Código"><Input value={code} disabled={Boolean(question)} onChange={(event) => setCode(event.target.value)} autoComplete="username" /></Field>
          {question
            ? <><div className="rounded-lg bg-sunken p-3 text-sm font-medium text-fg">{question}</div><Field label="Respuesta"><Input type="password" value={answer} onChange={(event) => setAnswer(event.target.value)} autoComplete="off" /></Field><Button type="button" disabled={busy || answer.trim().length < 2} onClick={() => void reset()}>{busy ? "Restableciendo…" : "Generar nueva credencial"}</Button></>
            : <Button type="button" disabled={busy || !code.trim()} onClick={() => void findQuestion()}>{busy ? "Consultando…" : "Continuar"}</Button>}
        </>}
      <BackToLogin onBack={onBack} />
    </div>
  </>;
}
