// The paper plane from the TanEx mark, folded in 3D (MOTION_3D_SPEC §4: "built in code, ≈ 10
// triangles"). One unit long, nose towards +Z, wings in the XZ plane with a slight dihedral and a
// keel folded underneath. Non-indexed so every face keeps its own flat normal. No DOM: safe in tests.
import { BufferGeometry, Float32BufferAttribute } from 'three';

export function paperPlaneGeometry(): BufferGeometry {
  const nose = [0, 0, 0.5];
  const tail = [0, 0, -0.5];
  const left = [-0.46, 0.07, -0.5];
  const right = [0.46, 0.07, -0.5];
  const keel = [0, -0.17, -0.44];
  // Two wings and the keel; the material is double-sided.
  const faces = [
    [nose, left, tail],
    [nose, tail, right],
    [nose, tail, keel],
  ];
  const positions = faces.flat(2);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}
