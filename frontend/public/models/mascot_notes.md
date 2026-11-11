# mascot.glb — integration notes

**File:** ~1.2 MB · 30,582 triangles · 3 materials · 5 JPEG textures (1024²) · 0 errors in the Khronos glTF validator.
Compressed with **meshopt** (EXT_meshopt_compression + KHR_mesh_quantization) → set the decoder in three.js:

```js
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
```

Facing +Z · feet on Y=0 · height 2.70 · origin between the feet · bind pose = relaxed A-pose · transforms applied.
**Side convention:** `_R` = **+X** (screen-right seen from +Z). That is the side holding the phone in your reference art. (Flip `SR` in `mascot_geo.py` for anatomical R = −X.)

## Nodes
| Node | Type | Notes |
|---|---|---|
| `Body` | SkinnedMesh | head + torso + limbs + hands + feet, one draw call |
| `Glasses` | Mesh, child of `Head` | navy frames + gold inlay + gold diamond on the bridge |
| `Face` | Mesh, child of `Head` | eyes, pupils, highlights, mouth — **holds all morph targets** |
| `Phone` | Mesh, child of `Hand_R` | separate node: `scene.getObjectByName('Phone').visible = false` |

## Bones (22)
`Root > Hips > Spine > Chest > Neck > Head`
`Chest > Shoulder_{R,L} > UpperArm_{R,L} > LowerArm_{R,L} > Hand_{R,L}`
`Hips > UpperLeg_{R,L} > LowerLeg_{R,L} > Foot_{R,L} > Toes_{R,L}`

## Morph targets (on `Face`)
`blink`, `smile`, `surprised`, `lookLeft`, `lookRight`, plus bonus `blankLenses` (hides the pupils → plain white lenses exactly like the reference art).
```js
const face = gltf.scene.getObjectByName('Face');
face.morphTargetInfluences[face.morphTargetDictionary.smile] = 1;
```
`lookLeft` = toward −X, `lookRight` = toward +X.

## Animation clips (all loop, 30 fps, every clip keys every bone so switching never leaves a stale pose)
`idle` 3.0 s · `wave` 2.0 s · `celebrate` 1.2 s · `think` 3.0 s · `walk` 1.0 s
`idle_phone` · `wave_phone` · `celebrate_phone` · `think_phone` · `walk_phone` — right hand holds the phone in front of the chest.
`walk` is in place (no root motion): move the model forward yourself at about 1.3 units/s so the feet don't slide.
In `celebrate_phone` the phone arm stays at the chest and bounces with the jump; only the free arm goes up.
Use the plain clips when `Phone.visible = false`.

## Materials / textures
`M_Skin` (baseColor + normal + roughness maps, subtle KHR_materials_sheen for the soft-skin look; AO baked into vertex colours) ·
`M_Props` (glasses + phone + gold, one atlas) · `M_Eyes` (glossy, vertex-coloured).
No lights, cameras, background or ground in the file.

## Known limits
Procedurally generated, not hand-sculpted: expect to polish in Blender if you want film-grade topology (body is a decimated SDF surface). Fingers are rigid with the hand bone (no finger bones).

## Changes in this revision
Head ~20% smaller (whole character rescaled so height is still exactly 2.70) · feet moved apart (clear gap, 3 toes each) · walk clips added · gold inlay on the glasses · hole on the back fixed: the sampling volume was clipping the back of the torso; the body is now watertight (0 open edges, consistent winding) and the skin material is also double-sided as a safety net.
