import Tesseract from "tesseract.js";

let workerInstance: Tesseract.Worker | null = null;

async function getWorker(): Promise<Tesseract.Worker> {
  if (workerInstance) return workerInstance;
  workerInstance = await Tesseract.createWorker("eng", 1, {
    logger: () => {},
  });
  await workerInstance.setParameters({
    tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz/:.-  ",
    tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
  });
  return workerInstance;
}

function preprocessForOCR(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.max(1, 1500 / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, w, h);

      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;

      // Grayscale
      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }

      // Increase contrast
      const contrast = 80;
      const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128));
        data[i + 1] = data[i];
        data[i + 2] = data[i];
      }

      // Adaptive threshold for sharp black/white text
      const threshold = 140;
      for (let i = 0; i < data.length; i += 4) {
        const v = data[i] > threshold ? 255 : 0;
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
      }

      ctx.putImageData(imageData, 0, 0);
      URL.revokeObjectURL(img.src);
      resolve(canvas);
    };
    img.src = URL.createObjectURL(file);
  });
}

export async function extractText(
  imageSource: File | HTMLCanvasElement,
  onProgress?: (progress: string) => void
): Promise<string> {
  onProgress?.("Initializing OCR engine...");
  const worker = await getWorker();

  onProgress?.("Preprocessing image...");
  let input: HTMLCanvasElement | string;
  if (imageSource instanceof File) {
    input = await preprocessForOCR(imageSource);
  } else {
    input = imageSource;
  }

  onProgress?.("Recognizing text...");
  const result = await worker.recognize(input);

  onProgress?.("Done");
  return result.data.text;
}

export async function terminateWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.terminate();
    workerInstance = null;
  }
}
