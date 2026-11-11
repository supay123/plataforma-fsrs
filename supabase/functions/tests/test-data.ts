import type { SupabaseClient } from "@supabase/supabase-js";
import { TABLES } from "../_shared/database.constants.ts";

/**
 * Registra los usuarios e instituciones que crea un test y los borra al salir
 * de su bloque (`await using`), tanto si el test pasa como si falla.
 *
 * Basta con borrar estas dos raíces: en la base todo lo demás (perfiles,
 * cursos, sesiones, registros, códigos...) cuelga de ellas en cascada. Los
 * usuarios se borran de auth.users porque borrar la institución solo elimina
 * sus perfiles, no sus cuentas.
 *
 * Si la limpieza falla, el test también falla; si el test ya había fallado,
 * se reportan ambos errores (SuppressedError) y ninguno se pierde.
 */
export class TestData implements AsyncDisposable {
  readonly #userIds = new Set<string>();
  readonly #collegeIds = new Set<string>();

  // deno-lint-ignore no-explicit-any
  constructor(private readonly adminClient: SupabaseClient<any>) {}

  user(id: string): string {
    this.#userIds.add(id);
    return id;
  }

  college(id: string): string {
    this.#collegeIds.add(id);
    return id;
  }

  async [Symbol.asyncDispose](): Promise<void> {
    const failures: string[] = [];
    for (const id of this.#userIds) {
      const { error } = await this.adminClient.auth.admin.deleteUser(id);
      // El test pudo haberlo borrado ya (por ejemplo, con admin-delete-college).
      if (error && error.status !== 404) {
        failures.push(`user ${id}: ${error.message}`);
      }
    }
    for (const id of this.#collegeIds) {
      const { error } = await this.adminClient
        .from(TABLES.colleges)
        .delete()
        .eq("id", id);
      if (error) failures.push(`college ${id}: ${error.message}`);
    }
    if (failures.length > 0) {
      throw new Error(`Test data cleanup failed:\n${failures.join("\n")}`);
    }
  }
}
