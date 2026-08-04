import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const outputDir = path.join(root, 'build');

if (fs.existsSync(outputDir)) {
  fs.rmSync(outputDir, { recursive: true, force: true });
  console.log(`[ok] removed: ${outputDir}`);
} else {
  console.log(`[ok] nothing to clean: ${outputDir} does not exist`);
}
