export function convertToGLTF(data, inputFormat) {
  switch (inputFormat) {
    case 'obj':
      return convertOBJToGLTF(data);
    case 'stl':
      return convertSTLToGLTF(data);
    case 'fbx':
      return convertFBXToGLTF(data);
    default:
      throw new Error(`Conversion from ${inputFormat} to GLTF not supported`);
  }
}

function convertOBJToGLTF(objData) {
  const gltf = {
    asset: { version: '2.0', generator: 'model-viewer-converter' },
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{
      primitives: [{
        attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
        indices: 3,
      }],
    }],
    accessors: [],
    bufferViews: [],
    buffers: [],
  };
  return gltf;
}

function convertSTLToGLTF(stlData) {
  const gltf = {
    asset: { version: '2.0', generator: 'model-viewer-converter' },
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{
      primitives: [{
        attributes: { POSITION: 0 },
        indices: 3,
      }],
    }],
    accessors: [],
    bufferViews: [],
    buffers: [],
  };
  return gltf;
}

function convertFBXToGLTF(fbxData) {
  throw new Error('FBX to GLTF conversion requires external library');
}

export function convertColorSpace(color, fromSpace, toSpace) {
  if (fromSpace === toSpace) return color;
  if (fromSpace === 'sRGB' && toSpace === 'linear') {
    return color.map(c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  }
  if (fromSpace === 'linear' && toSpace === 'sRGB') {
    return color.map(c => c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
  }
  return color;
}
