import { useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

export const MASCOT_MODEL_URL = "/models/mascot.glb";

/** El modelo viene comprimido con meshopt. */
export const withMeshopt = (loader: GLTFLoader): void => { loader.setMeshoptDecoder(MeshoptDecoder); };

/** Descarga el modelo con antelación (queda en la caché de `useLoader`). */
export function preloadMascotModel(): void {
  useLoader.preload(GLTFLoader, MASCOT_MODEL_URL, withMeshopt);
}
