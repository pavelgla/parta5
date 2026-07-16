import { createReadStream } from 'node:fs';
import { mkdir, open } from 'node:fs/promises';
import * as tar from 'tar';
import unzipper from 'unzipper';

const GZIP_MAGIC = [0x1f, 0x8b];
const ZIP_MAGIC = [0x50, 0x4b];

async function readMagicBytes(filePath: string): Promise<Buffer> {
  const handle = await open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(4);
    await handle.read(buffer, 0, 4, 0);
    return buffer;
  } finally {
    await handle.close();
  }
}

function matchesMagic(buffer: Buffer, magic: number[]): boolean {
  return magic.every((byte, index) => buffer[index] === byte);
}

export async function extractMbz(filePath: string, destDir: string): Promise<void> {
  await mkdir(destDir, { recursive: true });
  const magic = await readMagicBytes(filePath);

  if (matchesMagic(magic, GZIP_MAGIC)) {
    await tar.x({ file: filePath, cwd: destDir });
    return;
  }

  if (matchesMagic(magic, ZIP_MAGIC)) {
    await new Promise<void>((resolve, reject) => {
      createReadStream(filePath)
        .pipe(unzipper.Extract({ path: destDir }))
        .on('close', resolve)
        .on('error', reject);
    });
    return;
  }

  throw new Error(
    `Unrecognized .mbz format for file: ${filePath} (expected gzip or zip magic bytes)`,
  );
}
