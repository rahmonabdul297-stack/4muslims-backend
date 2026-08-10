declare module "arabic-persian-reshaper" {
  export interface ReshaperOptions {
    convertUnshaped?: boolean;
    convertHarakat?: boolean;
  }

  export class ArabicReshaper {
    constructor(options?: ReshaperOptions);
    static convertArabic(text: string): string;
    convertArabic(text: string): string;
  }

  const defaultExport: {
    ArabicReshaper: typeof ArabicReshaper;
  };

  export default defaultExport;
}

declare module "bidi-js" {
  export interface BidiEmbeddingLevels {
    levels: Uint8Array;
    paragraphs: Array<{ start: number; end: number; level: number }>;
  }

  export interface BidiFactory {
    getEmbeddingLevels(text: string, implicitDirection?: string): BidiEmbeddingLevels;
    getReorderedString(text: string, embeddingLevels: BidiEmbeddingLevels): string;
  }

  export default function bidiFactory(): BidiFactory;
}