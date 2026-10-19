export const SUPPORTED_FORMATS = ['glb', 'gltf', 'obj', 'fbx', 'stl', 'ply', '3ds', 'dae'];
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const DEFAULT_MODEL_COLOR = '#2196f3';
export const CAMERA_PRESETS = {
  front: { position: [0, 0, 5], target: [0, 0, 0] },
  top: { position: [0, 5, 0], target: [0, 0, 0] },
  side: { position: [5, 0, 0], target: [0, 0, 0] },
  perspective: { position: [3, 2, 5], target: [0, 0, 0] },
};
export const ANIMATION_TYPES = ['idle', 'walk', 'run', 'jump', 'attack', 'dance'];
export const TEXTURE_TYPES = ['albedo', 'normal', 'roughness', 'metalness', 'ao', 'emissive'];
export const RENDER_MODES = ['solid', 'wireframe', 'points', 'transparent'];
export const LIGHT_PRESETS = {
  studio: { ambient: 0.4, directional: 0.8, hemisphere: 0.3 },
  outdoor: { ambient: 0.6, directional: 1.0, hemisphere: 0.5 },
  dramatic: { ambient: 0.1, directional: 1.2, hemisphere: 0.2 },
};
