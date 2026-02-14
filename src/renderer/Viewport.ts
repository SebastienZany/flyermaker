export class Viewport {
  zoom = 1;
  panX = 0;
  panY = 0;

  zoomBy(
    delta: number,
    centerX: number,
    centerY: number,
    viewportWidth: number,
    viewportHeight: number,
    documentWidth: number,
    documentHeight: number
  ): void {
    const previousZoom = this.zoom;
    const nextZoom = Math.min(4, Math.max(0.2, Number((previousZoom + delta).toFixed(2))));
    if (nextZoom === previousZoom) return;

    const baseXBefore = (viewportWidth - documentWidth * previousZoom) / 2;
    const baseYBefore = (viewportHeight - documentHeight * previousZoom) / 2;
    const worldX = (centerX - baseXBefore - this.panX) / previousZoom;
    const worldY = (centerY - baseYBefore - this.panY) / previousZoom;

    const baseXAfter = (viewportWidth - documentWidth * nextZoom) / 2;
    const baseYAfter = (viewportHeight - documentHeight * nextZoom) / 2;
    this.panX = centerX - baseXAfter - worldX * nextZoom;
    this.panY = centerY - baseYAfter - worldY * nextZoom;
    this.zoom = nextZoom;
  }

  panBy(dx: number, dy: number): void {
    this.panX += dx;
    this.panY += dy;
  }
}
