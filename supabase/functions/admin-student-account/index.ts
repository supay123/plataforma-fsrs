import "@supabase/functions-js/edge-runtime.d.ts";
import { withAppSupabase } from "../_shared/server.ts";
import { handle } from "../_shared/errors.ts";
import { routeRequest } from "../_shared/router.ts";
import {
  cancelStudentPasswordReset,
  requestStudentPasswordReset,
} from "./password-reset.ts";
import { updateStudentEmail } from "./email.ts";
import { updateStudentGroup } from "./group.ts";
import { getStudentProfile, updateStudentProfile } from "./profile.ts";

// Cuenta de un estudiante vista por el administrador. Cada endpoint tiene una
// sola tarea:
//   GET    /admin-student-account/profile?user_id=  datos del perfil
//   PUT    /admin-student-account/profile           actualiza los datos editables
//   PUT    /admin-student-account/email             cambia el correo (sin verificación)
//   PUT    /admin-student-account/group             lo mueve al grupo de otro profesor
//   POST   /admin-student-account/password-reset    envía el link para restablecer la contraseña
//   DELETE /admin-student-account/password-reset?user_id=  anula el link enviado
export default {
  fetch: withAppSupabase(
    { auth: "user" },
    (request, context) =>
      handle(() =>
        routeRequest(request, context, "admin-student-account", {
          "GET /profile": getStudentProfile,
          "PUT /profile": updateStudentProfile,
          "PUT /email": updateStudentEmail,
          "PUT /group": updateStudentGroup,
          "POST /password-reset": requestStudentPasswordReset,
          "DELETE /password-reset": cancelStudentPasswordReset,
        })
      ),
  ),
};
