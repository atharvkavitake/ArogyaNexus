import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const storageRoot = path.resolve(process.env.RECORDS_STORAGE_DIR || path.join(process.cwd(), '.private-records'));
export async function storeRecord(bytes: Buffer, extension: string): Promise<string> {
  await fs.mkdir(storageRoot, { recursive: true });
  const key = `${randomUUID()}.${extension}`;
  await fs.writeFile(path.join(storageRoot, key), bytes, { flag: 'wx', mode: 0o600 });
  return key;
}
export function recordPath(key: string): string {
  if (!/^[0-9a-f-]{36}\.(pdf|jpg|jpeg|png)$/i.test(key)) throw new Error('Invalid private file key.');
  return path.join(storageRoot, key);
}
export async function removeRecord(key: string): Promise<void> {
  await fs.unlink(recordPath(key)).catch((error: any) => { if (error?.code !== 'ENOENT') throw error; });
}
