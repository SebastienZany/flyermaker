export type BlendMode = GlobalCompositeOperation;

export interface ImageContent {
  type: 'image';
  source: CanvasImageSource;
  naturalWidth: number;
  naturalHeight: number;
  name: string;
}

export type LayerContent = ImageContent;

export type LayerEffect = never; // placeholder for future effects

export class Layer {
  readonly id: string;
  name: string;
  visible = true;
  locked = false;
  opacity = 1;
  blendMode: BlendMode = 'source-over';
  content: LayerContent;
  effects: LayerEffect[] = [];

  x = 0;
  y = 0;
  width = 0;
  height = 0;

  constructor(name: string, content: LayerContent, id: string = crypto.randomUUID()) {
    this.id = id;
    this.name = name;
    this.content = content;
  }
}
