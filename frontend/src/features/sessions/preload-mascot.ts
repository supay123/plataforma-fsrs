/** Baja el código 3D y el modelo en segundo plano para que la práctica arranque con la mascota ya lista. */
export function preloadMascot(): void {
  void Promise.all([import("../../components/ui/mascot-scene"), import("../../components/ui/mascot-model")])
    .then(([, model]) => model.preloadMascotModel())
    .catch(() => undefined);
}
