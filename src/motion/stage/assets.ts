// Stage assets by chapter (MOTION_3D_SPEC §2, §5): loaded in priority order, bike first, so the
// first chapters are ready before the later ones start downloading. Each chapter keeps its poster
// until every asset it needs is ready. glTF support (GLTFLoader) and the meshopt decoder are
// downloaded only when a real model file is in the list and that file requires them.
import type { Object3D } from 'three';
import { buildPrimitiveBike } from './bike';

export interface StageAsset {
  id: string;
  /** Chapters (MOTION §6 numbers) that need this asset. */
  chapters: readonly number[];
  /** Lower loads first. */
  priority: number;
  load: () => Promise<Object3D>;
}

export const ASSETS: readonly StageAsset[] = [
  {
    id: 'bike',
    chapters: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    priority: 0,
    // Primitives until the commissioned model (#117, H.6). The swap is this one line:
    //   load: () => loadGltf('/3d/tanex-bike.glb'),
    load: async () => buildPrimitiveBike(),
  },
];

/**
 * Loads every asset in priority order, one at a time (no competition with the page for
 * bandwidth), reporting each as it arrives. Stops early if `signal` is aborted.
 */
export async function loadAssets(
  onAsset: (asset: StageAsset, object: Object3D) => void,
  signal?: AbortSignal,
  assets: readonly StageAsset[] = ASSETS,
): Promise<void> {
  const queue = [...assets].sort((a, b) => a.priority - b.priority);
  for (const asset of queue) {
    if (signal?.aborted) return;
    const object = await asset.load();
    if (signal?.aborted) return;
    onAsset(asset, object);
  }
}

/** Chapters whose assets have all loaded. */
export function readyChapters(loaded: ReadonlySet<string>, assets: readonly StageAsset[] = ASSETS): Set<number> {
  const all = new Set(assets.flatMap((a) => a.chapters));
  const ready = new Set<number>();
  all.forEach((chapter) => {
    if (assets.every((a) => !a.chapters.includes(chapter) || loaded.has(a.id))) ready.add(chapter);
  });
  return ready;
}

/** Extensions a .glb or .gltf file declares (read from its JSON, no parsing of the meshes). */
function gltfExtensions(buffer: ArrayBuffer): string[] {
  let json: { extensionsUsed?: string[]; extensionsRequired?: string[] };
  const view = new DataView(buffer);
  if (buffer.byteLength >= 20 && view.getUint32(0, true) === 0x46546c67) {
    // GLB: 12-byte header, then the JSON chunk (length, type 'JSON', data).
    const length = view.getUint32(12, true);
    json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, length)));
  } else {
    json = JSON.parse(new TextDecoder().decode(buffer));
  }
  return [...new Set([...(json.extensionsUsed ?? []), ...(json.extensionsRequired ?? [])])];
}

/**
 * Loads a glTF model (H.6). The meshopt decoder is added only if the file uses
 * EXT_meshopt_compression. Draco is refused: compress models with meshopt (gltfpack) instead, so
 * no decoder files have to be hosted.
 */
export async function loadGltf(url: string): Promise<Object3D> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Model ${url}: HTTP ${response.status}`);
  const buffer = await response.arrayBuffer();
  const extensions = gltfExtensions(buffer);
  if (extensions.includes('KHR_draco_mesh_compression')) {
    throw new Error(`Model ${url} uses Draco; compress it with meshopt instead (gltfpack -cc)`);
  }
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const loader = new GLTFLoader();
  if (extensions.includes('EXT_meshopt_compression')) {
    const { MeshoptDecoder } = await import('three/examples/jsm/libs/meshopt_decoder.module.js');
    loader.setMeshoptDecoder(MeshoptDecoder);
  }
  const base = url.slice(0, url.lastIndexOf('/') + 1);
  const gltf = await loader.parseAsync(buffer, base);
  return gltf.scene;
}
