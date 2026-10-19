export function parseOBJ(data) {
  const vertices = [];
  const normals = [];
  const uvs = [];
  const faces = [];
  const lines = data.split('\n');
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length === 0) continue;
    switch (parts[0]) {
      case 'v':
        vertices.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
        break;
      case 'vn':
        normals.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
        break;
      case 'vt':
        uvs.push([parseFloat(parts[1]), parseFloat(parts[2])]);
        break;
      case 'f':
        const face = [];
        for (let i = 1; i < parts.length; i++) {
          const indices = parts[i].split('/');
          face.push({
            vertex: parseInt(indices[0]) - 1,
            uv: indices[1] ? parseInt(indices[1]) - 1 : -1,
            normal: indices[2] ? parseInt(indices[2]) - 1 : -1,
          });
        }
        faces.push(face);
        break;
    }
  }
  return { vertices, normals, uvs, faces };
}

export function parseGLTF(json) {
  return JSON.parse(json);
}

export function parseSTL(data) {
  const isBinary = data instanceof ArrayBuffer;
  if (isBinary) {
    return parseBinarySTL(data);
  }
  return parseAsciiSTL(data);
}

function parseAsciiSTL(data) {
  const vertices = [];
  const normals = [];
  const regex = /vertex\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)/g;
  let match;
  while ((match = regex.exec(data)) !== null) {
    vertices.push([parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3])]);
  }
  return { vertices, normals };
}

function parseBinarySTL(data) {
  const view = new DataView(data);
  const count = view.getUint32(80, true);
  const vertices = [];
  for (let i = 0; i < count; i++) {
    const offset = 84 + i * 50;
    for (let j = 0; j < 3; j++) {
      const voffset = offset + 12 + j * 12;
      vertices.push([
        view.getFloat32(voffset, true),
        view.getFloat32(voffset + 4, true),
        view.getFloat32(voffset + 8, true),
      ]);
    }
  }
  return { vertices, normals: [] };
}
