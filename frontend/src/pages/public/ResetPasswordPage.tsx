import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { LockKeyhole, ShieldX } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { AuthLayout } from "../../components/layout/AuthLayout";
import { Button, Field, PasswordInput, Spinner } from "../../components/ui";
import { useToast } from "../../components/ui/use-toast";
import { checkPasswordResetCode, resetPassword } from "../../features/account/api";
import { useAuth } from "../../features/auth/AuthProvider";
import { passwordFields, passwordMismatchIssue, passwordsMatch } from "../../features/registration/fields";
import { PasswordChecklist } from "../../features/registration/PasswordChecklist";
import { normalizeError, type AppError } from "../../lib/api/errors";

const schema = z.object(passwordFields).refine(passwordsMatch, passwordMismatchIssue);
type Values = z.infer<typeof schema>;

function AccessDenied() {
  return <div className="grid justify-items-center gap-3 text-center">
    <ShieldX className="text-rose-500" size={40} aria-hidden="true" />
    <h1 className="text-2xl font-bold">No tienes acceso a esta página</h1>
    <p className="text-sm text-slate-600">El link no es válido, ya se usó o venció. Si necesitas cambiar tu contraseña, pide un link nuevo desde tu perfil.</p>
    <Link to="/estudiante/login" className="mt-2 font-semibold text-indigo-600 hover:text-indigo-800">Ir al inicio de sesión</Link>
  </div>;
}

function NewPasswordForm({ code, onInvalidCode }: { code: string; onInvalidCode: () => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { session, logout } = useAuth();
  const { register, handleSubmit, control, setError, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema), mode: "onTouched", defaultValues: { password: "", password_confirmation: "" },
  });
  const password = useWatch({ control, name: "password" });
  const passwordConfirmation = useWatch({ control, name: "password_confirmation" });

  const submit = handleSubmit(async (values) => {
    try {
      await resetPassword(code, values.password);
      // El backend cerró todas sus sesiones; se limpia también la de este navegador.
      if (session) await logout();
      navigate("/estudiante/login?password=actualizada", { replace: true });
    } catch (reason) {
      const error = await normalizeError(reason);
      if (error.code === "invalid_reset_code") onInvalidCode();
      else if (error.code === "weak_password") setError("password", { message: error.message }, { shouldFocus: true });
      else toast.error(error.message);
    }
  });

  return <>
    <h1 className="text-2xl font-bold">Crea tu nueva contraseña</h1>
    <p className="mt-2 text-sm text-slate-600">Al guardarla, se cerrará tu sesión en todos tus dispositivos y podrás ingresar con la nueva contraseña.</p>
    <form onSubmit={submit} className="mt-6 grid gap-4" noValidate>
      <Field label="Nueva contraseña" hideLabel error={errors.password?.message}><PasswordInput variant="soft" icon={<LockKeyhole size={20} />} placeholder="Nueva contraseña" autoComplete="new-password" {...register("password")} /></Field>
      <Field label="Repite tu contraseña" hideLabel error={errors.password_confirmation?.message}><PasswordInput variant="soft" icon={<LockKeyhole size={20} />} placeholder="Repite tu contraseña" autoComplete="new-password" {...register("password_confirmation")} /></Field>
      {(password || passwordConfirmation) && <PasswordChecklist password={password} />}
      <Button disabled={isSubmitting}>{isSubmitting ? "Guardando…" : "Guardar contraseña"}</Button>
    </form>
  </>;
}

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code") ?? "";
  const [usedOrInvalid, setUsedOrInvalid] = useState(false);
  const check = useQuery({
    queryKey: ["password-reset", code],
    queryFn: () => checkPasswordResetCode(code),
    enabled: Boolean(code),
    retry: false,
    staleTime: Infinity,
  });
  const toast = useToast();
  const denied = !code || usedOrInvalid || (check.error as AppError | null)?.code === "invalid_reset_code";
  // Otro error (por ejemplo, sin conexión) no significa que el link sea inválido.
  const failed = check.isError && !denied;

  useEffect(() => {
    if (failed) toast.error(check.error.message);
  }, [failed, check.error, toast]);

  return <AuthLayout cover={{ title: "Vuelve a tu práctica", description: "Crea una nueva contraseña y sigue donde te quedaste." }}>
      {denied
        ? <AccessDenied />
        : failed
          ? <Button type="button" className="w-full" onClick={() => void check.refetch()}>Reintentar</Button>
          : check.isPending ? <Spinner /> : <NewPasswordForm code={code} onInvalidCode={() => setUsedOrInvalid(true)} />}
  </AuthLayout>;
}
