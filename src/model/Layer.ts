export type BlendMode = GlobalCompositeOperation;

export interface LayerImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  name: string;
}

export class Layer {
  readonly id: string;
  name: string;
  visible = true;
  locked = false;
  opacity = 1;
  blendMode: BlendMode = 'source-over';
  image: LayerImage | null = null;

  x = 0;
  y = 0;
  width = 0;
  height = 0;

  constructor(name: string, id: string = crypto.randomUUID()) {
    this.id = id;
    this.name = name;
  }
}
