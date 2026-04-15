/**
 * File upload conversion helpers for AI draft attachments.
 *
 * Supports images, PDFs, and other document types.
 * Ported from 1code's use-agents-file-upload.ts
 */
import type { UploadedFile } from '../../infrastructure/ai/types';
import { getPathForFile } from '../../lib/sftpFileUtils';

export type { UploadedFile } from '../../infrastructure/ai/types';

/** Reject only known binary blobs that AI models can't process */
const REJECTED_MIME_PREFIXES = ['video/', 'audio/'];

function isSupportedFile(file: File): boolean {
  // Allow files with empty MIME (common in Electron for .sh, .yaml, etc.)
  if (!file.type) return true;
  return !REJECTED_MIME_PREFIXES.some(prefix => file.type.startsWith(prefix));
}

async function fileToDataUrl(file: File): Promise<{ dataUrl: string; base64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] || '';
      resolve({ dataUrl, base64 });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function convertFilesToUploads(inputFiles: File[]): Promise<UploadedFile[]> {
  const supported = inputFiles.filter(isSupportedFile);
  if (supported.length === 0) return [];

  const uploads: Array<UploadedFile | null> = await Promise.all(
    supported.map(async (file) => {
      const id = crypto.randomUUID();
      const filename = file.name || `file-${Date.now()}`;
      const mediaType = file.type || 'application/octet-stream';
      try {
        const result = await fileToDataUrl(file);
        const filePath = getPathForFile(file);
        return {
          id,
          filename,
          dataUrl: result.dataUrl,
          base64Data: result.base64,
          mediaType,
          filePath,
        };
      } catch (err) {
        console.error('[useFileUpload] Failed to convert:', err);
        return null;
      }
    }),
  );

  return uploads.filter((upload): upload is UploadedFile => upload !== null);
}
