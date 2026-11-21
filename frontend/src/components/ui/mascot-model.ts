import { useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

/** Cabeza de la mascota (75 KB). Notas del modelo: `public/models/mascot_head_notes.md`. */
export const MASCOT_MODEL_URL = "/models/mascot_head.glb";

/** El modelo viene comprimido con meshopt. */
export const withMeshopt = (loader: GLTFLoader): void => { loader.setMeshoptDecoder(MeshoptDecoder); };

/** Descarga el modelo con antelación (queda en la caché de `useLoader`). */
export function preloadMascotModel(): void {
  useLoader.preload(GLTFLoader, MASCOT_MODEL_URL, withMeshopt);
}
