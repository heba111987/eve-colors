export const FLOWER_SIZE = 40;

// Flower coordinates are stored as 0–100 percentages of the garden scene.
// Normally they spread across the whole (non-square) scene; flowers the API
// marks as in the center (a user's first ones) are instead squeezed into a
// centered circle whose diameter is the scene's shorter side, keeping their
// relative arrangement. Returns the flower's center in pixels.
export function flowerPosition(
  flowerX: number,
  flowerY: number,
  inCenter: boolean,
  width: number,
  height: number,
): { x: number; y: number } {
  if (!inCenter) {
    return { x: (flowerX / 100) * width, y: (flowerY / 100) * height };
  }

  // Square [-1, 1]² → unit disk (elliptical grid mapping): smooth, and keeps
  // the square's spacing roughly even across the disk.
  const u = flowerX / 50 - 1;
  const v = flowerY / 50 - 1;
  const du = u * Math.sqrt(1 - (v * v) / 2);
  const dv = v * Math.sqrt(1 - (u * u) / 2);

  // Inset by half a flower so each icon stays fully inside the circle.
  const radius = Math.max(0, Math.min(width, height) / 2 - FLOWER_SIZE / 2);
  return { x: width / 2 + du * radius, y: height / 2 + dv * radius };
}
