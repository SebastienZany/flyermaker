export class RulerRenderer {
  draw(
    horizontal: CanvasRenderingContext2D,
    vertical: CanvasRenderingContext2D,
    zoom: number,
    panX: number,
    panY: number,
    viewportWidth: number,
    viewportHeight: number,
    documentWidth: number,
    documentHeight: number
  ): void {
    const baseX = (viewportWidth - documentWidth * zoom) / 2 + panX;
    const baseY = (viewportHeight - documentHeight * zoom) / 2 + panY;

    this.drawHorizontal(horizontal, zoom, baseX, viewportWidth, documentWidth);
    this.drawVertical(vertical, zoom, baseY, viewportHeight, documentHeight);

    horizontal.canvas.dataset.originX = `${baseX}`;
    horizontal.canvas.dataset.endX = `${baseX + documentWidth * zoom}`;
    vertical.canvas.dataset.originY = `${baseY}`;
    vertical.canvas.dataset.endY = `${baseY + documentHeight * zoom}`;
  }

  private tickStep(zoom: number): number {
    const steps = [5, 10, 20, 50, 100, 200, 500];
    for (const step of steps) {
      if (step * zoom >= 40) return step;
    }
    return 500;
  }

  private drawHorizontal(ctx: CanvasRenderingContext2D, zoom: number, baseX: number, width: number, documentWidth: number): void {
    const height = ctx.canvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#2a2a2e';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#44444e';
    ctx.fillStyle = '#77778a';
    ctx.font = "8px 'SF Mono', Menlo, monospace";

    const step = this.tickStep(zoom);
    const startWorld = Math.floor((-baseX / zoom) / step) * step;
    const endWorld = Math.ceil((width - baseX) / zoom / step) * step;

    for (let world = startWorld; world <= endWorld; world += step) {
      const x = Math.round(baseX + world * zoom);
      if (x < 0 || x > width) continue;
      const major = world % (step * 2) === 0;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, height);
      ctx.lineTo(x + 0.5, major ? 0 : height - 6);
      ctx.stroke();
      if (major) ctx.fillText(`${world}`, x + 2, 8);
    }

    this.drawBoundsX(ctx, baseX, documentWidth * zoom, height);
  }

  private drawVertical(ctx: CanvasRenderingContext2D, zoom: number, baseY: number, height: number, documentHeight: number): void {
    const width = ctx.canvas.width;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#2a2a2e';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#44444e';
    ctx.fillStyle = '#77778a';
    ctx.font = "8px 'SF Mono', Menlo, monospace";

    const step = this.tickStep(zoom);
    const startWorld = Math.floor((-baseY / zoom) / step) * step;
    const endWorld = Math.ceil((height - baseY) / zoom / step) * step;

    for (let world = startWorld; world <= endWorld; world += step) {
      const y = Math.round(baseY + world * zoom);
      if (y < 0 || y > height) continue;
      const major = world % (step * 2) === 0;
      ctx.beginPath();
      ctx.moveTo(width, y + 0.5);
      ctx.lineTo(major ? 0 : width - 6, y + 0.5);
      ctx.stroke();
      if (major) {
        ctx.save();
        ctx.translate(2, y + 8);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(`${world}`, 0, 0);
        ctx.restore();
      }
    }

    this.drawBoundsY(ctx, baseY, documentHeight * zoom, width);
  }

  private drawBoundsX(ctx: CanvasRenderingContext2D, start: number, length: number, height: number): void {
    ctx.strokeStyle = '#4a9eff';
    for (const x of [Math.round(start), Math.round(start + length)]) {
      if (x < 0 || x > ctx.canvas.width) continue;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, height);
      ctx.lineTo(x + 0.5, 0);
      ctx.stroke();
    }
  }

  private drawBoundsY(ctx: CanvasRenderingContext2D, start: number, length: number, width: number): void {
    ctx.strokeStyle = '#4a9eff';
    for (const y of [Math.round(start), Math.round(start + length)]) {
      if (y < 0 || y > ctx.canvas.height) continue;
      ctx.beginPath();
      ctx.moveTo(width, y + 0.5);
      ctx.lineTo(0, y + 0.5);
      ctx.stroke();
    }
  }
}
