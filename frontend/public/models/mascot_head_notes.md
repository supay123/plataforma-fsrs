# mascot_head.glb — notas de integración

**Archivo:** 75,7 KB (77 552 bytes) · 3 188 triángulos · 1 736 vértices · 4 materiales · 0 texturas · 4 draw calls · 10 clips.
Validador Khronos glTF: **0 errores, 0 avisos** (validado sobre la variante sin comprimir, `NO_MESHOPT=1`; el validador no
conoce `EXT_meshopt_compression`, por eso en el archivo final solo informa de esa extensión como "no soportada").
Comprimido con **meshopt** (EXT_meshopt_compression + KHR_mesh_quantization) → decodificador en three.js:

```js
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
```

Mira hacia +Z · origen en el **centro de la cabeza** · altura 1,00 (Y de −0,5 a +0,5) · transformaciones aplicadas.
Caja total (con gafas y patillas): X ±0,556 · Y ±0,500 · Z −0,480 … +0,584.
**Convención de lado:** `_R` = **+X**. `lookLeft` = hacia −X, `lookRight` = hacia +X.

## Nodos
| Nodo | Tipo | Notas |
|---|---|---|
| `Root` | Object3D | **Solo se traslada** (saltos, sacudida lateral). |
| `Head` | Mesh, hijo de `Root` | Piel. **Rota y se escala** (giros, aplastar y estirar). |
| `Glasses` | Mesh, hija de `Head` | Montura azul marino + filete dorado + rombo dorado del puente + patillas. 2 primitivas (M_Frame, M_Accent). |
| `Face` | Mesh, hija de `Head` | Ojos, pupilas, brillos, cejas y boca. **Una sola primitiva** (M_Eyes) con **todos los morph targets**. |

Los tres nodos de malla tienen transformación identidad (no hay escalas de cuantización en los nodos: las posiciones van en
int16 normalizado dentro de [−1, 1]). Por eso es seguro animar `Head.scale` y `Head.quaternion`.
No hay huesos, luces, cámaras, fondo ni suelo.

```js
const face = gltf.scene.getObjectByName('Face');
face.morphTargetInfluences[face.morphTargetDictionary.smile] = 1;
```

## Morph targets (en `Face`) — todos combinables y con influencia 0…1
Los 6 originales conservan nombre y orden: `blink`, `smile`, `surprised`, `lookLeft`, `lookRight`, `blankLenses`.
Nuevos: `lookUp`, `lookDown`, `happyEyes`, `worried`, `squint`, `sleepy`.

| Morph | Efecto |
|---|---|
| `blink` | Cierra los ojos (el blanco colapsa y deja ver la piel; las pupilas se aplastan y bajan). |
| `smile` | Sonrisa ancha; sube un poco los párpados inferiores y las cejas. |
| `surprised` | Boca en "o", cejas arriba, pupilas algo más pequeñas. |
| `lookLeft` / `lookRight` | Pupilas y brillos ±0,11 en X. |
| `lookUp` / `lookDown` | Pupilas y brillos ±0,075 en Y. |
| `blankLenses` | Oculta las pupilas → lentes blancas lisas, como el arte de referencia. |
| `happyEyes` | Ojos en arco ^ ^ (el blanco colapsa y aparece el arco). |
| `worried` | Cejas inclinadas (interior arriba) y boca algo caída. Alentador, no de llanto. |
| `squint` | Entrecierra: cierra desde arriba (30 %) y desde abajo (22 %) y baja las cejas. |
| `sleepy` | Párpado superior a medias, pupilas bajas y algo aplastadas, cejas algo más bajas. |

Los morphs son aditivos y están diseñados para no romperse al sumarlos: cuando el cierre de párpado pasa de 1 (p. ej.
`blink` + `sleepy` + `happyEyes`) los triángulos del blanco se invierten y se ocultan por culling (`M_Eyes` es de una sola cara).
Único caso a evitar: `blankLenses` junto con muchos otros cierres (queda como mucho un punto casi invisible).

## Clips de animación (30 fps; claves en múltiplos de 1/30 s)
Todos animan `Root` (traslación), `Head` (rotación y escala) y los 12 morphs de `Face`, así que cambiar de clip nunca deja una pose a medias.
La base de la cabeza se mantiene en el suelo al aplastar/estirar (la compensación va en `Root.y`).

| Clip | Duración | Tipo | Descripción |
|---|---|---|---|
| `idle` | 3,0 s | bucle | Respiración (escala +1,5 % en Y), un parpadeo (~1,35 s), balanceo de ±1,2–1,4°. |
| `think` | 2,4 s | bucle | `lookUp` + `lookLeft`, inclinación de ~5° y giro de ~6°, un parpadeo. |
| `correct` | 0,7 s | una vez | Saltito (0,22) con aplastar y estirar; `happyEyes` + `smile`. |
| `wrong` | 0,7 s | una vez | Sacudida lateral corta y amortiguada; `worried` + `squint`. Sin burla. |
| `celebrate` | 1,4 s | una vez | Se agacha, salta (0,9) con **voltereta vertical de 360° sobre X hacia atrás**, aterriza aplastando y **queda con `smile` + `happyEyes` = 1**. |
| `levelUp` | 1,6 s | una vez | Salto más alto (1,25) con **giro de 360° sobre Y**, aterrizaje con rebote corto; `smile` + `happyEyes`. |
| `finish` | 1,8 s | una vez | Dos saltitos (0,24 y 0,30) con inclinación alterna y sonrisa; vuelve a reposo. |
| `sleep` | 4,0 s | bucle | `sleepy`, respiración lenta, cabeza caída (~11° hacia delante), un parpadeo lento. |
| `appear` | 0,4 s | una vez | Escala 0 → 1 con rebote pequeño (1,10 → 1,0). |
| `disappear` | 0,4 s | una vez | Pequeño inflado (1,08) y escala → 0. |

Los clips de una vez empiezan y terminan con `Root` y `Head` en la pose exacta de `idle` (t=0) y morphs a 0,
salvo: `celebrate` termina con `smile`/`happyEyes` en 1 (lo pedido; suelta la expresión con un `crossFadeTo(idle, 0.2)`), y
`appear`/`disappear` empiezan/terminan en escala 0,001 (no 0, para no generar matrices singulares).
Los bucles (`idle`, `think`, `sleep`) cierran con la primera clave igual a la última. Giro máximo entre claves: 35° (cabe en slerp sin ambigüedad).

```js
const mixer = new THREE.AnimationMixer(gltf.scene);
const play = (name, loopOnce) => { const a = mixer.clipAction(THREE.AnimationClip.findByName(gltf.animations, name));
  a.reset(); a.setLoop(loopOnce ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = true; return a.fadeIn(0.15).play(); };
```
Si encadenas con `crossFadeTo`, hazlo desde un clip de una vez hacia `idle` (el cambio queda sin saltos).
Si controlas morphs a mano (p. ej. `lookLeft` según el cursor) mientras corre un clip, el clip los sobrescribe cada frame:
detén el clip o aplica tus valores después de `mixer.update()`.

## Materiales (sin texturas)
| Material | Color | Notas |
|---|---|---|
| `M_Skin` | `baseColorFactor` = **#3fb97c**, rugosidad 0,62 | Sin textura ni color de vértice: `material.color.set('#…')` tiñe toda la piel. |
| `M_Frame` | #16233a, rugosidad 0,65 | Montura y patillas. |
| `M_Accent` | #c9a961, rugosidad 0,35, metalicidad 0,5 | Filete dorado y rombo. |
| `M_Eyes` | blanco; pupilas, cejas, boca y arcos #16233a por **color de vértice** (COLOR_0) | Brillante (rugosidad 0,16), una sola cara. |

```js
gltf.scene.traverse(o => { if (o.material?.name === 'M_Skin') o.material.color.set('#e4572e'); });
```
Nota: si clonas el material para varios colegios, clónalo (`material.clone()`) antes de cambiar el color.

## Presupuesto
| | Pedido | Resultado |
|---|---|---|
| Peso .glb | ≤ 150 KB (máx. 250) | **75,7 KB** (el original: 1,2 MB) |
| Triángulos | ≤ 8 000 | **3 188** (Head 1 728 · Glasses 1 188 · Face 272) |
| Texturas | preferir ninguna | **0** |
| Validador Khronos | 0 errores | **0 errores, 0 avisos** |
Legibilidad: ver `previews/legibilidad_256_y_48px.png` y `legibilidad_48px_nativo.png` (fondos #141414 y #ffffff).

## Fuente y regeneración
No hay Blender en el entorno de trabajo, así que el archivo fuente es el **script** `source/build_mascot_head.mjs`
(Node + glTF-Transform + meshoptimizer; geometría 100 % procedural). Para regenerar:
`cd source && npm i && npm run build && npm run check`. Todos los parámetros (tamaño de cabeza, gafas, posiciones de ojos,
cantidades de cada morph, curvas de cada clip) están en constantes y en el objeto `CLIPS` al inicio/final del script.
`previews.mjs` + `compose.py` regeneran las vistas previas (Playwright + Pillow).

## Límites conocidos
- Generada por código, no esculpida: la cabeza es una caja redondeada (radio 0,2) cerrada, sin cuello.
- Cuando el ojo se cierra, el "párpado" es la piel de la cabeza que se ve a través de la lente; no hay línea de pestañas en `blink`.
- Las lentes no tienen cristal: la luz y el reflejo de entorno solo actúan sobre los blancos del ojo.
- Con `M_Frame`/`M_Accent` el aspecto depende del entorno/luces de la escena; las vistas previas usan RoomEnvironment (intensidad 0,55) y una luz direccional.
