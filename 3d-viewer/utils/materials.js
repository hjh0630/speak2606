export function createBasicMaterial(color = '#2196f3', options = {}) {
  return new THREE.MeshBasicMaterial({
    color,
    wireframe: options.wireframe ?? false,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    ...options,
  });
}

export function createStandardMaterial(color = '#2196f3', options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.5,
    metalness: options.metalness ?? 0.1,
    wireframe: options.wireframe ?? false,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    map: options.map ?? null,
    normalMap: options.normalMap ?? null,
    roughnessMap: options.roughnessMap ?? null,
    metalnessMap: options.metalnessMap ?? null,
    aoMap: options.aoMap ?? null,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
    side: options.side ?? THREE.FrontSide,
    ...options,
  });
}

export function createPhysicalMaterial(color = '#2196f3', options = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: options.roughness ?? 0.3,
    metalness: options.metalness ?? 0.0,
    clearcoat: options.clearcoat ?? 0,
    clearcoatRoughness: options.clearcoatRoughness ?? 0.25,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    ior: options.ior ?? 1.5,
    reflectivity: options.reflectivity ?? 0.5,
    envMap: options.envMap ?? null,
    envMapIntensity: options.envMapIntensity ?? 1,
    map: options.map ?? null,
    normalMap: options.normalMap ?? null,
    roughnessMap: options.roughnessMap ?? null,
    metalnessMap: options.metalnessMap ?? null,
    aoMap: options.aoMap ?? null,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
    side: options.side ?? THREE.DoubleSide,
    ...options,
  });
}

export function createPBRMaterial(config = {}) {
  return createPhysicalMaterial(config.color, config);
}

export function createWireframeMaterial(color = '#00ff00', options = {}) {
  return new THREE.MeshBasicMaterial({
    color,
    wireframe: true,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
  });
}

export function createTransparentMaterial(color = '#2196f3', opacity = 0.5) {
  return createStandardMaterial(color, { transparent: true, opacity });
}

export function createEmissiveMaterial(color = '#ff6600', intensity = 1) {
  return createStandardMaterial('#ffffff', {
    emissive: color,
    emissiveIntensity: intensity,
  });
}

export function createMatcapMaterial(matcapTexture, options = {}) {
  return new THREE.MeshMatcapMaterial({
    matcap: matcapTexture,
    color: options.color ?? 0xffffff,
    ...options,
  });
}

export function createDepthMaterial(options = {}) {
  return new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    ...options,
  });
}

export function createNormalMaterial(options = {}) {
  return new THREE.MeshNormalMaterial({
    flatShading: options.flatShading ?? false,
    ...options,
  });
}
