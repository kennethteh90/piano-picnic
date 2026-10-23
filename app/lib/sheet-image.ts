import type { RasterImage } from "./sheet-recognition.ts";

/** Keeps OMR fast on multi‑megapixel phone photos. */
const MAX_OMR_EDGE = 1280;

function limitRasterForOmr(image: RasterImage): RasterImage {
  const maxEdge = Math.max(image.width, image.height);
  if (maxEdge <= MAX_OMR_EDGE) return image;
  const scale = MAX_OMR_EDGE / maxEdge;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return image;
  const source = document.createElement("canvas");
  source.width = image.width;
  source.height = image.height;
  source.getContext("2d", { willReadFrequently: true })?.putImageData(
    new ImageData(new Uint8ClampedArray(image.data), image.width, image.height),
    0,
    0,
  );
  context.drawImage(source, 0, 0, width, height);
  const frame = context.getImageData(0, 0, width, height);
  return { data: frame.data, width: frame.width, height: frame.height };
}

export async function rasterFromImageFile(file: File): Promise<RasterImage> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Could not load that image."));
      element.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Could not read the image.");
    context.drawImage(image, 0, 0);
    const frame = context.getImageData(0, 0, canvas.width, canvas.height);
    return limitRasterForOmr({ data: frame.data, width: frame.width, height: frame.height });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function rasterFromVideoFrame(video: HTMLVideoElement): Promise<RasterImage> {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Could not read the camera image.");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const frame = context.getImageData(0, 0, canvas.width, canvas.height);
  return limitRasterForOmr({ data: frame.data, width: frame.width, height: frame.height });
}

export async function rasterToJpegBase64(image: RasterImage, quality = 0.82) {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not encode the image.");
  const source = document.createElement("canvas");
  source.width = image.width;
  source.height = image.height;
  source.getContext("2d", { willReadFrequently: true })?.putImageData(
    new ImageData(new Uint8ClampedArray(image.data), image.width, image.height),
    0,
    0,
  );
  context.drawImage(source, 0, 0);
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  const base64 = dataUrl.split(",")[1];
  if (!base64) throw new Error("Could not encode the image.");
  return { base64, mime: "image/jpeg" as const };
}
