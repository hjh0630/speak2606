export function generateCube(size = 1) {
  const h = size / 2;
  const vertices = [
    [-h, -h, -h], [ h, -h, -h], [ h,  h, -h], [-h,  h, -h],
    [-h, -h,  h], [ h, -h,  h], [ h,  h,  h], [-h,  h,  h],
  ];
  const indices = [
    0,1,2, 0,2,3, 4,5,6, 4,6,7, 0,1,5, 0,5,4,
    2,3,7, 2,7,6, 0,3,7, 0,7,4, 1,2,6, 1,6,5,
  ];
  return { vertices, indices };
}

export function generateSphere(radius = 1, segments = 16) {
  const vertices = [];
  const indices = [];
  for (let i = 0; i <= segments; i++) {
    const phi = (i / segments) * Math.PI;
    for (let j = 0; j <= segments; j++) {
      const theta = (j / segments) * 2 * Math.PI;
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.cos(phi);
      const z = radius * Math.sin(phi) * Math.sin(theta);
      vertices.push([x, y, z]);
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * (segments + 1) + j;
      const b = a + segments + 1;
      indices.push(a, b, a + 1);
      indices.push(b, b + 1, a + 1);
    }
  }
  return { vertices, indices };
}

export function generateCylinder(radius = 1, height = 2, segments = 16) {
  const vertices = [];
  const indices = [];
  const h = height / 2;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * 2 * Math.PI;
    const x = radius * Math.cos(theta);
    const z = radius * Math.sin(theta);
    vertices.push([x, -h, z]);
    vertices.push([x,  h, z]);
  }
  vertices.push([0, -h, 0]);
  vertices.push([0,  h, 0]);
  const topCenter = vertices.length - 1;
  const bottomCenter = vertices.length - 2;
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    const b = i * 2 + 1;
    const c = (i + 1) * 2 % (segments * 2);
    const d = ((i + 1) * 2 + 1) % (segments * 2);
    indices.push(a, c, b);
    indices.push(b, c, d);
    indices.push(bottomCenter, a, c);
    indices.push(topCenter, d, b);
  }
  return { vertices, indices };
}
