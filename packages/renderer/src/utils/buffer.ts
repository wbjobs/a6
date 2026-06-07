const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024;

export function isLargeFile(size: number): boolean {
  return size > LARGE_FILE_THRESHOLD;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function decodeBufferToString(buffer: SharedArrayBuffer, size: number): string {
  const view = new Uint8Array(buffer, 0, size);
  const decoder = new TextDecoder('utf-8');
  return decoder.decode(view);
}

export function encodeStringToBuffer(content: string): { buffer: SharedArrayBuffer; size: number } {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(content);
  const buffer = new SharedArrayBuffer(bytes.length);
  const view = new Uint8Array(buffer);
  view.set(bytes);
  return { buffer, size: bytes.length };
}

export async function readFileContent(filePath: string): Promise<{ content: string; size: number; usedLarge: boolean }> {
  const sizeResult = await window.vfsApi.getFileSize(filePath);
  if ('error' in sizeResult) {
    throw new Error(sizeResult.error);
  }

  const { size, isLarge } = sizeResult;

  if (isLarge) {
    const result = await window.vfsApi.readFileLarge(filePath);
    if ('error' in result) {
      throw new Error(result.error);
    }
    const content = decodeBufferToString(result.buffer, result.size);
    return { content, size: result.size, usedLarge: true };
  } else {
    const result = await window.vfsApi.readFile(filePath);
    if ('error' in result) {
      throw new Error(result.error);
    }
    return { content: result.content, size, usedLarge: false };
  }
}

export async function writeFileContent(filePath: string, content: string): Promise<{ success: boolean; usedLarge: boolean }> {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(content);
  const size = bytes.length;

  if (isLargeFile(size)) {
    const { buffer, size: encodedSize } = encodeStringToBuffer(content);
    const result = await window.vfsApi.writeFileLarge(filePath, buffer, encodedSize);
    if ('error' in result) {
      throw new Error(result.error);
    }
    return { success: result.success, usedLarge: true };
  } else {
    const result = await window.vfsApi.writeFile(filePath, content);
    if ('error' in result) {
      throw new Error(result.error);
    }
    return { success: result.success, usedLarge: false };
  }
}
