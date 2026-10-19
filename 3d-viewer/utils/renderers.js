export function createRenderer(canvas, options = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: options.antialias ?? true,
    alpha: options.alpha ?? false,
    ...options,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

export function createScene(options = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(options.backgroundColor ?? 0x1a1a2e);
  return scene;
}

export function createCamera(options = {}) {
  const { fov = 45, aspect = 1, near = 0.1, far = 1000 } = options;
  const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  camera.position.set(3, 2, 5);
  camera.lookAt(0, 0, 0);
  return camera;
}

export function createControls(camera, domElement, options = {}) {
  const controls = new THREE.OrbitControls(camera, domElement);
  controls.enableDamping = options.enableDamping ?? true;
  controls.dampingFactor = options.dampingFactor ?? 0.05;
  controls.rotateSpeed = options.rotateSpeed ?? 1.0;
  controls.zoomSpeed = options.zoomSpeed ?? 1.2;
  controls.panSpeed = options.panSpeed ?? 0.8;
  controls.minDistance = options.minDistance ?? 0.5;
  controls.maxDistance = options.maxDistance ?? 50;
  controls.target.set(0, 0, 0);
  return controls;
}

export function setupLighting(scene, preset = 'studio') {
  const presets = {
    studio: { ambient: 0x404060, directional: 0xffffff, hemi: { sky: 0xffffff, ground: 0x444444, intensity: 0.4 } },
    outdoor: { ambient: 0x606080, directional: 0xffffff, hemi: { sky: 0x87ceeb, ground: 0x3a7d44, intensity: 0.6 } },
    dramatic: { ambient: 0x202040, directional: 0xffeedd, hemi: { sky: 0x202040, ground: 0x000000, intensity: 0.2 } },
  };
  const p = presets[preset] || presets.studio;
  const ambientLight = new THREE.AmbientLight(p.ambient);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(p.directional, 1);
  dirLight.position.set(5, 10, 7);
  scene.add(dirLight);
  const hemiLight = new THREE.HemisphereLight(p.hemi.sky, p.hemi.ground, p.hemi.intensity);
  scene.add(hemiLight);
  return { ambientLight, dirLight, hemiLight };
}
