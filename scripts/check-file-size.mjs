import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const MAX_LINES = 1000;
const ROOT = process.cwd();
const TARGETS = ['src', 'tests', 'supabase/migrations', 'scripts'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.css', '.sql']);
const EXEMPT = new Set(['src/types/database.types.ts']);
const IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  'coverage',
  'playwright-report',
  'test-results',
  '.git',
]);

function walk(dir) {
  const files = [];

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      if (!IGNORED_DIRS.has(entry)) {
        files.push(...walk(fullPath));
      }
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

const violations = [];

for (const target of TARGETS) {
  const targetPath = join(ROOT, target);

  try {
    statSync(targetPath);
  } catch {
    continue;
  }

  for (const file of walk(targetPath)) {
    const relativePath = relative(ROOT, file).replaceAll('\\', '/');

    if (EXEMPT.has(relativePath)) {
      continue;
    }

    const extension = file.slice(file.lastIndexOf('.'));

    if (!EXTENSIONS.has(extension)) {
      continue;
    }

    const lineCount = readFileSync(file, 'utf8').split(/\r?\n/).length;

    if (lineCount > MAX_LINES) {
      violations.push({ relativePath, lineCount });
    }
  }
}

if (violations.length > 0) {
  console.error(`File size limit exceeded (${MAX_LINES} lines):`);

  for (const violation of violations) {
    console.error(`  ${violation.lineCount}  ${violation.relativePath}`);
  }

  process.exit(1);
}

console.log(`File size check passed (max ${MAX_LINES} lines).`);
