// PasswordCredential no está en los tipos DOM de TypeScript: solo existe en
// navegadores Chromium (Chrome, Edge, Opera).
type PasswordCredentialConstructor = new (data: { id: string; password: string; name?: string }) => Credential;

/**
 * Pide al navegador que ofrezca guardar el correo y la contraseña para
 * autocompletar el login. Donde no hay soporte (Firefox, Safari) no hace nada y
 * queda la detección propia del navegador. Nunca lanza.
 */
export async function saveCredentials(email: string, password: string) {
  try {
    const PasswordCredential = (window as unknown as { PasswordCredential?: PasswordCredentialConstructor }).PasswordCredential;
    if (!PasswordCredential || !navigator.credentials?.store) return;
    await navigator.credentials.store(new PasswordCredential({ id: email, password }));
  } catch {
    // El usuario puede cerrar el aviso o el navegador bloquearlo: no afecta el registro.
  }
}
