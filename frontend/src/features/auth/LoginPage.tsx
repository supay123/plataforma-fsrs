import { zodResolver } from "@hookform/resolvers/zod";
import { GraduationCap } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { Alert, Button, Card, Field, Input } from "../../components/ui";
import { normalizeError } from "../../lib/api/errors";
import { todayInLima } from "../../lib/dates";
import type { AppRole } from "../../types/contracts";
import { useAuth } from "./AuthProvider";

const schema = z.object({ code: z.string().trim().min(1, "Ingresa tu código."), password: z.string().min(6, "Debe tener al menos 6 caracteres.") });
type Values = z.infer<typeof schema>;
const portal = {
  admin: { label: "Administrador", path: "/admin" },
  teacher: { label: "Profesor", path: "/profesor" },
  student: { label: "Estudiante", path: "/estudiante" },
} as const;

export function LoginPage({ role }: { role: AppRole }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema) });
  const studentAccessExpired = auth.profile?.role === "student" &&
    (!auth.profile.access_valid_from || !auth.profile.access_valid_until ||
      todayInLima() < auth.profile.access_valid_from || todayInLima() > auth.profile.access_valid_until);
  if (!auth.loading && auth.profile?.is_active && !studentAccessExpired) return <Navigate to={portal[auth.profile.role].path} replace />;
  const submit = handleSubmit(async (values) => {
    try { setError(""); await auth.login(values.code, values.password, role); navigate(portal[role].path, { replace: true }); }
    catch (reason) { setError((await normalizeError(reason)).message); }
  });
  return <main className="grid min-h-screen place-items-center bg-gradient-to-br from-indigo-950 via-indigo-800 to-sky-700 p-4">
    <Card className="w-full max-w-md border-0 p-7 shadow-2xl">
      <Link to="/" className="mb-7 flex items-center gap-3 text-indigo-700"><GraduationCap size={32} /><span className="font-bold">Aula FSRS</span></Link>
      <h1 className="text-2xl font-bold">Acceso de {portal[role].label}</h1>
      <p className="mt-2 text-sm text-slate-600">Ingresa con el código entregado por la institución.</p>
      <form onSubmit={submit} className="mt-6 grid gap-4">
        {(searchParams.get("acceso") === "vencido" || studentAccessExpired) &&
          <Alert tone="error">Tu periodo de acceso no está vigente. Solicita una renovación al administrador.</Alert>}
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Código" error={errors.code?.message}><Input autoComplete="username" {...register("code")} /></Field>
        <Field label={role === "student" ? "Contraseña o PIN" : "Contraseña"} error={errors.password?.message}><Input type="password" autoComplete="current-password" {...register("password")} /></Field>
        <Button disabled={isSubmitting}>{isSubmitting ? "Ingresando…" : "Ingresar"}</Button>
        {auth.session && <Button type="button" variant="secondary" onClick={() => void auth.logout()}>Cerrar sesión guardada</Button>}
      </form>
      <Link to="/" className="mt-5 block text-center text-sm text-slate-500 hover:text-indigo-700">Cambiar de portal</Link>
    </Card>
  </main>;
}
