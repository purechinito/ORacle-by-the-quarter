// Builds a static study site from docs/**/*.md into dist/. No dependencies.
// Markdown is rendered in the browser (marked + mermaid from jsDelivr).
import { readdirSync, statSync, mkdirSync, copyFileSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const src = join(root, 'docs');
const out = join(root, 'dist');

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : name.endsWith('.md') ? [path] : [];
  });
}

function titleOf(path) {
  const heading = readFileSync(path, 'utf8').match(/^#\s+(.+)$/m);
  return heading ? heading[1].trim() : relative(src, path);
}

rmSync(out, { recursive: true, force: true });
// README first within each folder, then alphabetical.
const sortKey = (path) => path.replace(/README\.md$/, '!README.md');
const pages = walk(src).sort((a, b) => sortKey(a).localeCompare(sortKey(b))).map((path) => {
  const rel = relative(src, path);
  mkdirSync(join(out, 'docs', dirname(rel)), { recursive: true });
  copyFileSync(path, join(out, 'docs', rel));
  return { path: rel, title: titleOf(path), group: dirname(rel) };
});

writeFileSync(join(out, 'pages.json'), JSON.stringify(pages, null, 2));
copyFileSync(join(root, 'scripts', 'docs-site.html'), join(out, 'index.html'));
console.log(`Built ${pages.length} pages into dist/`);
