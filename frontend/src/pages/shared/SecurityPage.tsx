import { useState } from "react";
import { Alert, Button, Card, Field, Input, PageHeader } from "../../components/ui";
import { saveRecoveryQuestion, resetOwnCredentials } from "../../features/auth/api";
import { useAuth } from "../../features/auth/AuthProvider";
import { normalizeError } from "../../lib/api/errors";
import type { Credentials } from "../../types/contracts";

export function SecurityPage() {
  const { profile } = useAuth();
  const [question, setQuestion] = useState(profile?.security_question ?? "");
  const [answer, setAnswer] = useState("");
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const save = async () => {
    try {
      setSaving(true); setError(""); setMessage("");
      await saveRecoveryQuestion(question, answer);
      setAnswer(""); setMessage("Pregunta y respuesta de seguridad guardadas.");
    } catch (reason) { setError((await normalizeError(reason)).message); }
    finally { setSaving(false); }
  };
  const reset = async () => {
    try {
      setResetting(true); setError(""); setMessage("");
      const result = await resetOwnCredentials();
      setCredentials(result.credentials);
    } catch (reason) { setError((await normalizeError(reason)).message); }
    finally { setResetting(false); }
  };

  return <>
    <PageHeader title="Configuración de seguridad" description="Administra la recuperación de tu cuenta y tus credenciales." />
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <h2 className="font-bold">Pregunta de seguridad</h2>
        <p className="mt-1 text-sm text-slate-600">La respuesta se guarda protegida y no podrá consultarse después.</p>
        <div className="mt-4 grid gap-4">
          {message && <Alert tone="success">{message}</Alert>}
          {error && <Alert tone="error">{error}</Alert>}
          <Field label="Pregunta"><Input value={question} maxLength={200} onChange={(event) => setQuestion(event.target.value)} placeholder="Ej. ¿Cuál era el nombre de tu primera mascota?" /></Field>
          <Field label={profile?.security_question ? "Nueva respuesta" : "Respuesta"}><Input type="password" value={answer} maxLength={200} autoComplete="off" onChange={(event) => setAnswer(event.target.value)} /></Field>
          <Button type="button" disabled={saving || question.trim().length < 5 || answer.trim().length < 2} onClick={() => void save()}>{saving ? "Guardando…" : "Guardar recuperación"}</Button>
        </div>
      </Card>
      <Card>
        <h2 className="font-bold">Restablecer credenciales</h2>
        <p className="mt-1 text-sm text-slate-600">Genera una nueva {profile?.role === "student" ? "contraseña o PIN" : "contraseña"}. Se mostrará una sola vez.</p>
        {credentials && <Alert tone="success"><strong>Nueva credencial</strong><br />{credentials.user_code} / {credentials.temporary_password}<Button type="button" variant="ghost" className="mt-2" onClick={() => void navigator.clipboard.writeText(`${credentials.user_code}\n${credentials.temporary_password ?? ""}`)}>Copiar</Button></Alert>}
        <Button className="mt-4" type="button" variant="secondary" disabled={resetting} onClick={() => void reset()}>{resetting ? "Restableciendo…" : "Restablecer credenciales"}</Button>
      </Card>
    </div>
  </>;
}
