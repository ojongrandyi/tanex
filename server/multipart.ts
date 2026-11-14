// Minimal multipart/form-data reader for the few routes that take files as real form uploads
// (the courier app's proof of delivery, DISPATCH_SPEC §6/§11). Reads the whole body into memory
// under a hard size cap, so it is only for small, already-compressed uploads. Text fields come
// back as strings, file parts as bytes; callers still validate the bytes (detectImageType).
import type { Request } from 'express';

export interface MultipartFile {
  filename: string;
  contentType: string;
  data: Buffer;
}

export interface MultipartBody {
  fields: Record<string, string>;
  files: Record<string, MultipartFile>;
}

export type MultipartResult = { ok: true; body: MultipartBody } | { ok: false; status: number; code: string; error: string };

export interface MultipartLimits {
  /** Total body size. */
  maxBytes: number;
  /** Number of parts (fields + files). */
  maxParts?: number;
  /** Size of one text field. */
  maxFieldBytes?: number;
}

const tooLarge = { ok: false as const, status: 413, code: 'PAYLOAD_TOO_LARGE', error: 'The upload is too large.' };
const malformed = { ok: false as const, status: 400, code: 'INVALID_UPLOAD', error: 'The upload could not be read.' };

/** The boundary from a multipart/form-data Content-Type, or null. */
export function multipartBoundary(contentType: string | undefined): string | null {
  if (!contentType || contentType.split(';')[0].trim().toLowerCase() !== 'multipart/form-data') return null;
  const m = /;\s*boundary=(?:"([^"]{1,70})"|([^\s;]{1,70}))/i.exec(contentType);
  return m ? (m[1] ?? m[2]) : null;
}

function readBody(req: Request, maxBytes: number): Promise<Buffer | 'too_large'> {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length'] || 0);
    if (declared > maxBytes) {
      req.resume();
      resolve('too_large');
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    let done = false;
    req.on('data', (chunk: Buffer) => {
      if (done) return;
      size += chunk.length;
      if (size > maxBytes) {
        done = true;
        chunks.length = 0;
        req.resume();
        resolve('too_large');
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => { if (!done) { done = true; resolve(Buffer.concat(chunks)); } });
    req.on('error', (err) => { if (!done) { done = true; reject(err); } });
  });
}

/** Parses a buffered multipart body. Exported for tests. */
export function parseMultipart(buf: Buffer, boundary: string, limits: Omit<MultipartLimits, 'maxBytes'> = {}): MultipartBody | null {
  const maxParts = limits.maxParts ?? 10;
  const maxFieldBytes = limits.maxFieldBytes ?? 2000;
  const delimiter = Buffer.from(`--${boundary}`);
  const fields: Record<string, string> = {};
  const files: Record<string, MultipartFile> = {};
  let pos = buf.indexOf(delimiter);
  if (pos < 0) return null;
  let parts = 0;
  for (;;) {
    pos += delimiter.length;
    // "--" right after a delimiter closes the body.
    if (buf[pos] === 0x2d && buf[pos + 1] === 0x2d) break;
    if (buf[pos] === 0x0d && buf[pos + 1] === 0x0a) pos += 2; else return null;
    const headerEnd = buf.indexOf('\r\n\r\n', pos);
    if (headerEnd < 0) return null;
    const headers = buf.subarray(pos, headerEnd).toString('utf8').split('\r\n');
    const next = buf.indexOf(Buffer.concat([Buffer.from('\r\n'), delimiter]), headerEnd + 4);
    if (next < 0) return null;
    const data = buf.subarray(headerEnd + 4, next);
    if (++parts > maxParts) return null;

    let name = '';
    let filename: string | null = null;
    let contentType = 'text/plain';
    for (const line of headers) {
      const colon = line.indexOf(':');
      if (colon < 0) continue;
      const key = line.slice(0, colon).trim().toLowerCase();
      const value = line.slice(colon + 1).trim();
      if (key === 'content-disposition') {
        const n = /;\s*name="([^"]*)"/i.exec(value);
        const f = /;\s*filename="([^"]*)"/i.exec(value);
        name = n ? n[1] : '';
        filename = f ? f[1] : null;
      } else if (key === 'content-type') {
        contentType = value.toLowerCase();
      }
    }
    if (!name || name === '__proto__' || name === 'constructor' || name === 'prototype') return null;
    if (filename !== null) {
      files[name] = { filename, contentType, data: Buffer.from(data) };
    } else {
      if (data.length > maxFieldBytes) return null;
      fields[name] = data.toString('utf8');
    }
    pos = next + 2;
  }
  return { fields, files };
}

/** Reads and parses a multipart/form-data request. 415 when it isn't one; 413 over the cap. */
export async function readMultipart(req: Request, limits: MultipartLimits): Promise<MultipartResult> {
  const boundary = multipartBoundary(req.headers['content-type']);
  if (!boundary) return { ok: false, status: 415, code: 'UNSUPPORTED_MEDIA_TYPE', error: 'Send the upload as multipart/form-data.' };
  const buf = await readBody(req, limits.maxBytes);
  if (buf === 'too_large') return tooLarge;
  const body = parseMultipart(buf, boundary, limits);
  return body ? { ok: true, body } : malformed;
}
