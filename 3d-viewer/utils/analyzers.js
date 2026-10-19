export function analyzeGeometry(geometry) {
  const vertexCount = geometry.attributes.position?.count || 0;
  const indexCount = geometry.index?.count || 0;
  const hasNormals = !!geometry.attributes.normal;
  const hasUVs = !!geometry.attributes.uv;
  const hasColors = !!geometry.attributes.color;
  return {
    vertexCount,
    indexCount,
    triangleCount: indexCount / 3,
    hasNormals,
    hasUVs,
    hasColors,
    boundingBox: computeBoundingBox(geometry),
  };
}

function computeBoundingBox(geometry) {
  const positions = geometry.attributes.position;
  if (!positions) return null;
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  }
  return {
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ],
    size: [maxX - minX, maxY - minY, maxZ - minZ],
    center: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2],
  };
}

export function analyzePerformance(fps, frameTime, drawCalls, triangles) {
  return {
    fps: Math.round(fps),
    frameTime: `${frameTime.toFixed(2)}ms`,
    drawCalls,
    triangles,
    memoryUsage: performance.memory?.usedJSHeapSize
      ? `${(performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`
      : 'N/A',
  };
}
