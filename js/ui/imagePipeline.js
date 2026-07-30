// imagePipeline.js — downscale an uploaded image via canvas to max 1024px and
// JPEG-compress it, returning a data URL. Nothing is uploaded anywhere.
export function downscaleImage(file, maxDim = 1024, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const scale = Math.min(1, maxDim / Math.max(width, height));
      width = Math.round(width * scale); height = Math.round(height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      const bytes = Math.ceil((dataUrl.length - dataUrl.indexOf(',') - 1) * 3 / 4);
      resolve({ dataUrl, bytes, width, height });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('load failed')); };
    img.src = url;
  });
}
