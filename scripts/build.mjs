import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const sourceFiles = ['manifest.json'];
const sourceDirs = ['html', 'js', 'icons'];
const outputDir = path.join(root, 'build');

function rmrf(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function main() {
  rmrf(outputDir);
  fs.mkdirSync(outputDir, { recursive: true });

  for (const file of sourceFiles) {
    const src = path.join(root, file);
    const dest = path.join(outputDir, file);
    if (!fs.existsSync(src)) {
      console.warn(`[warn] missing source file: ${file}`);
      continue;
    }
    copyFile(src, dest);
  }

  for (const dir of sourceDirs) {
    const src = path.join(root, dir);
    const dest = path.join(outputDir, dir);
    if (!fs.existsSync(src)) {
      console.warn(`[warn] missing source directory: ${dir}`);
      continue;
    }
    copyDir(src, dest);
  }

  console.log(`[ok] build completed: ${outputDir}`);
  console.log(`     contents:`);
  printTree(outputDir, '  ');
}

function printTree(dir, prefix = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const isDir = entry.isDirectory();
    console.log(`${prefix}${entry.name}${isDir ? '/' : ''}`);
    if (isDir) {
      printTree(fullPath, prefix + '  ');
    }
  }
}

main();
