/**
 * Applies Supabase Image Transformation parameters to storage URLs
 * Converts public object URLs to render URLs with resize/quality options
 * @param url - Original Supabase Storage URL
 * @param options - Transformation options (width, quality)
 * @returns Optimized URL with transformation parameters
 */
export function getOptimizedPresetUrl(
  url: string | null | undefined,
  options: { width?: number; quality?: number } = {}
): string {
  if (!url) return '/placeholder.svg';
  
  // If not a Supabase Storage URL, return original
  if (!url.includes('supabase.co/storage')) {
    return url;
  }
  
  const { width = 400, quality = 70 } = options;
  
  // Remove existing query params
  const baseUrl = url.split('?')[0];
  
  // Convert public object URL to render URL with transformations
  // From: /storage/v1/object/public/bucket/path
  // To:   /storage/v1/render/image/public/bucket/path?width=X&quality=Y&resize=contain
  // Using resize=contain to prevent Supabase from cropping widescreen images
  const transformedUrl = baseUrl
    .replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')
    + `?width=${width}&quality=${quality}&resize=contain`;
  
  return transformedUrl;
}

/**
 * Compress and resize an image to reduce file size
 * @param file - Original file
 * @param maxSizeMB - Maximum size in MB (default 4MB)
 * @param maxDimension - Maximum width/height (default 2048px)
 * @returns Compressed file
 */
export async function compressImage(
  file: File,
  maxSizeMB: number = 4,
  maxDimension: number = 2048
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    img.onload = () => {
      // Calculate new dimensions maintaining aspect ratio
      let { width, height } = img;
      
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = (height / width) * maxDimension;
          width = maxDimension;
        } else {
          width = (width / height) * maxDimension;
          height = maxDimension;
        }
      }

      canvas.width = width;
      canvas.height = height;

      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);

      // Start with high quality and reduce if needed
      let quality = 0.92;
      const minQuality = 0.5;
      const targetBytes = maxSizeMB * 1024 * 1024;

      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }

            if (blob.size > targetBytes && quality > minQuality) {
              quality -= 0.1;
              tryCompress();
              return;
            }

            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });

            console.log(`Image compressed: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);
            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };

      tryCompress();
    };

    img.onerror = () => reject(new Error('Failed to load image'));

    // Read file as data URL
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Convert a base64 data URL to a compressed base64 string
 */
export async function compressBase64Image(
  base64: string,
  maxSizeMB: number = 4,
  maxDimension: number = 2048
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    img.onload = () => {
      let { width, height } = img;
      
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = (height / width) * maxDimension;
          width = maxDimension;
        } else {
          width = (width / height) * maxDimension;
          height = maxDimension;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      let quality = 0.92;
      const minQuality = 0.5;
      const targetBytes = maxSizeMB * 1024 * 1024;

      const tryCompress = () => {
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const sizeBytes = (dataUrl.length * 3) / 4; // Approximate base64 size

        if (sizeBytes > targetBytes && quality > minQuality) {
          quality -= 0.1;
          tryCompress();
          return;
        }

        resolve(dataUrl);
      };

      tryCompress();
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = base64;
  });
}

/**
 * Calculate days remaining until expiration
 * @param createdAt - Creation date ISO string
 * @param expirationDays - Days until expiration (default 30)
 * @returns Days remaining (can be negative if expired)
 */
export function getDaysUntilExpiration(createdAt: string, expirationDays: number = 30): number {
  const createdDate = new Date(createdAt);
  const expirationDate = new Date(createdDate.getTime() + expirationDays * 24 * 60 * 60 * 1000);
  const now = new Date();
  const diffMs = expirationDate.getTime() - now.getTime();
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

/**
 * Format expiration text for display
 */
export function formatExpirationText(createdAt: string, expirationDays: number = 30): string {
  const daysLeft = getDaysUntilExpiration(createdAt, expirationDays);
  
  if (daysLeft <= 0) {
    return 'Expirado';
  } else if (daysLeft === 1) {
    return 'Expira em 1 dia';
  } else {
    return `Expira em ${daysLeft} dias`;
  }
}

/**
 * Check if content is expired
 */
export function isExpired(createdAt: string, expirationDays: number = 30): boolean {
  return getDaysUntilExpiration(createdAt, expirationDays) <= 0;
}
