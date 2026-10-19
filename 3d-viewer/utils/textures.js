export function createCheckerTexture(size = 512, color1 = '#ffffff', color2 = '#cccccc') {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cellSize = size / 8;
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      ctx.fillStyle = (i + j) % 2 === 0 ? color1 : color2;
      ctx.fillRect(i * cellSize, j * cellSize, cellSize, cellSize);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function createGradientTexture(colorStops) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 256, 256);
  for (const [pos, color] of colorStops) {
    gradient.addColorStop(pos, color);
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

export function loadTexture(url) {
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.load(url, resolve, undefined, reject);
  });
}

export function createEnvironmentMap(scene, renderer) {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  return pmremGenerator;
}

export function generateNormalMapFromHeight(heightMap, strength = 1) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = heightMap.width;
  canvas.height = heightMap.height;
  ctx.drawImage(heightMap, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const output = ctx.createImageData(canvas.width, canvas.height);
  const outData = output.data;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const idx = (y * canvas.width + x) * 4;
      const left = data[((y) * canvas.width + Math.max(x - 1, 0)) * 4];
      const right = data[((y) * canvas.width + Math.min(x + 1, canvas.width - 1)) * 4];
      const up = data[(Math.max(y - 1, 0) * canvas.width + x) * 4];
      const down = data[(Math.min(y + 1, canvas.height - 1) * canvas.width + x) * 4];
      const dx = (left - right) / 255 * strength;
      const dy = (up - down) / 255 * strength;
      const len = Math.sqrt(dx * dx + dy * dy + 1);
      outData[idx] = (dx / len * 0.5 + 0.5) * 255;
      outData[idx + 1] = (dy / len * 0.5 + 0.5) * 255;
      outData[idx + 2] = (1 / len) * 255;
      outData[idx + 3] = 255;
    }
  }
  ctx.putImageData(output, 0, 0);
  return new THREE.CanvasTexture(canvas);
}
