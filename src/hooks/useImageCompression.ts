/**
 * Hook para compressão de imagem antes do upload
 * Otimizado para dispositivos Android com pouca RAM
 */

import imageCompression from 'browser-image-compression';

interface CompressOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
  fileType?: string;
  initialQuality?: number;
}

const DEFAULT_OPTIONS: CompressOptions = {
  maxSizeMB: 0.8,
  maxWidthOrHeight: 1024,    // Reduzido de 1280 para economizar memória
  useWebWorker: true,
  fileType: 'image/jpeg',
  initialQuality: 0.7,
};

/**
 * Comprime uma imagem com timeout e fallback automático
 */
async function compressWithTimeout(
  file: File,
  options: CompressOptions,
  timeoutMs: number = 15000
): Promise<File> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('COMPRESSION_TIMEOUT'));
    }, timeoutMs);

    imageCompression(file, options)
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<File> {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  
  console.log(`📸 [COMPRESS] Iniciando: ${(file.size / 1024).toFixed(0)}KB`);

  try {
    // Tentar com Web Worker primeiro
    const compressedFile = await compressWithTimeout(file, mergedOptions);
    console.log(`📸 [COMPRESS] OK: ${(file.size / 1024).toFixed(0)}KB → ${(compressedFile.size / 1024).toFixed(0)}KB`);
    return compressedFile;
  } catch (error) {
    console.warn('📸 [COMPRESS] Falha com WebWorker, tentando sem...', error);
    
    // Fallback: tentar sem Web Worker
    try {
      const fallbackOptions = { ...mergedOptions, useWebWorker: false };
      const compressedFile = await compressWithTimeout(file, fallbackOptions, 20000);
      console.log(`📸 [COMPRESS] OK (sem Worker): ${(file.size / 1024).toFixed(0)}KB → ${(compressedFile.size / 1024).toFixed(0)}KB`);
      return compressedFile;
    } catch (fallbackError) {
      console.warn('📸 [COMPRESS] Fallback também falhou:', fallbackError);
      throw fallbackError;
    }
  }
}

/**
 * Hook simplificado para uso em componentes React
 */
export function useImageCompression() {
  const compress = async (file: File, options?: CompressOptions): Promise<File> => {
    if (!file.type.startsWith('image/')) {
      return file;
    }

    // Threshold aumentado: arquivos < 800KB não precisam de compressão
    if (file.size < 800 * 1024) {
      console.log('📸 [COMPRESS] Arquivo já pequeno, pulando compressão');
      return file;
    }

    try {
      return await compressImage(file, options);
    } catch (error) {
      console.error('📸 [COMPRESS] Erro na compressão:', error);
      
      // Fallback: retornar original se arquivo não for muito grande
      if (file.size < 5 * 1024 * 1024) {
        console.log('📸 [COMPRESS] Fallback: usando arquivo original (< 5MB)');
        return file;
      }
      
      throw new Error('Foto muito grande para processar. Tente tirar novamente mais próximo do objeto.');
    }
  };

  return { compress };
}
