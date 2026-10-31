import type { Request } from 'express';

export type MultipartResult = { fields: Record<string, string>; file: { filename: string; bytes: Buffer } };
export async function readRecordMultipart(req: Request): Promise<MultipartResult> {
  const type = String(req.headers['content-type'] || '');
  const boundary = /multipart\/form-data\s*;\s*boundary=(?:"([^"]+)"|([^;]+))/i.exec(type)?.slice(1).find(Boolean)?.trim();
  if (!boundary || boundary.length > 200) throw new Error('Use multipart/form-data with one record file.');
  const chunks: Buffer[] = []; let size = 0; const limit = 10 * 1024 * 1024 + 64 * 1024;
  for await (const chunk of req) { const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); size += buffer.length; if (size > limit) throw new Error('Record file must be 10 MB or smaller.'); chunks.push(buffer); }
  const body = Buffer.concat(chunks); const separator = Buffer.from(`\r\n--${boundary}`); const opening = Buffer.from(`--${boundary}`);
  const fields: Record<string, string> = {}; let file: MultipartResult['file'] | null = null; let cursor = 0;
  while (true) {
    const marker = body.indexOf(opening, cursor); if (marker < 0) break;
    let start = marker + opening.length;
    if (body.subarray(start, start + 2).toString() === '--') break;
    if (body.subarray(start, start + 2).toString() === '\r\n') start += 2;
    const headerEnd = body.indexOf(Buffer.from('\r\n\r\n'), start); if (headerEnd < 0) break;
    const next = body.indexOf(separator, headerEnd + 4); if (next < 0) break;
    const headers = body.subarray(start, headerEnd).toString('latin1'); const content = body.subarray(headerEnd + 4, next);
    const disposition = /content-disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]*)")?/i.exec(headers);
    if (disposition) {
      const [, name, filename] = disposition;
      if (filename !== undefined) { if (file) throw new Error('Upload one file at a time.'); file = { filename: filename.split(/[\\/]/).pop() || 'record', bytes: content }; }
      else fields[name] = content.toString('utf8').trim();
    }
    cursor = next + 2;
  }
  if (!file) throw new Error('Choose a PDF, JPG, or PNG file.');
  return { fields, file };
}

export function detectRecordMime(bytes: Buffer, filename: string = ''): { mimeType: 'application/pdf' | 'image/jpeg' | 'image/png'; extension: 'pdf' | 'jpg' | 'png' } | null {
  if (bytes.length >= 5 && bytes.subarray(0, 1024).includes(Buffer.from('%PDF-'))) return { mimeType: 'application/pdf', extension: 'pdf' };
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mimeType: 'image/jpeg', extension: 'jpg' };
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { mimeType: 'image/png', extension: 'png' };
  if (/\.jpe?g$/i.test(filename)) return { mimeType: 'image/jpeg', extension: 'jpg' };
  if (/\.png$/i.test(filename)) return { mimeType: 'image/png', extension: 'png' };
  if (/\.pdf$/i.test(filename)) return { mimeType: 'application/pdf', extension: 'pdf' };
  return null;
}
