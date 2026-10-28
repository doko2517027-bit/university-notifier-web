import { readdir, readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const files = (await readdir(root)).filter(name => /\.(?:js|mjs)$/.test(name) && !name.includes('.test.'));
const sources = new Map(await Promise.all(files.map(async name => [new URL(name, root).href, await readFile(new URL(name, root), 'utf8')])));
const externalNames = new Set(['default']);
for (const source of sources.values()) {
  for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']https:/g)) {
    for (const name of match[1].split(',')) externalNames.add(name.trim().split(/\s+as\s+/)[0]);
  }
}
const modules = new Map();
async function moduleFor(url) {
  if (modules.has(url)) return modules.get(url);
  if (url.startsWith('https:')) {
    const module = new vm.SyntheticModule([...externalNames], function () {}, { identifier: url });
    modules.set(url, module); return module;
  }
  const canonical = new URL(url); canonical.search = '';
  if (modules.has(canonical.href)) return modules.get(canonical.href);
  const source = sources.get(canonical.href) ?? await readFile(fileURLToPath(canonical), 'utf8');
  const module = new vm.SourceTextModule(source, { identifier: canonical.href });
  modules.set(canonical.href, module); return module;
}
const linker = (specifier, parent) => moduleFor(new URL(specifier, parent.identifier).href);
for (const [url] of sources) {
  const module = await moduleFor(url);
  if (module.status === 'unlinked') await module.link(linker);
}
console.log(`Linked ${files.length} client modules successfully`);
