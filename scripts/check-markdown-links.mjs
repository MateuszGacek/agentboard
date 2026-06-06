import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const ignoredDirs = new Set([".git", "node_modules", "dist"]);
const markdownLinkPattern = /\[[^\]]+\]\(([^)]+)\)/g;
const headingPattern = /^#{1,6}\s+(.+)$/gm;

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        files.push(...walk(path.join(dir, entry.name)));
      }
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(path.join(dir, entry.name));
    }
  }

  return files;
}

function slugifyHeading(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
    .replace(/\s+/g, "-");
}

function getHeadingSlugs(content) {
  const slugs = new Set();
  let match;

  while ((match = headingPattern.exec(content))) {
    slugs.add(slugifyHeading(match[1]));
  }

  return slugs;
}

function isExternalTarget(target) {
  return /^(https?:|mailto:|tel:|#)/.test(target);
}

const markdownFiles = walk(root);
const headingCache = new Map();
const failures = [];

for (const filePath of markdownFiles) {
  const content = fs.readFileSync(filePath, "utf8");
  let match;

  while ((match = markdownLinkPattern.exec(content))) {
    const rawTarget = match[1].trim();

    if (!rawTarget || isExternalTarget(rawTarget)) {
      continue;
    }

    const [targetPath, anchor] = rawTarget.split("#");

    if (!targetPath || targetPath.startsWith("file:")) {
      continue;
    }

    const decodedTarget = decodeURIComponent(targetPath);
    const resolvedPath = path.resolve(path.dirname(filePath), decodedTarget);

    if (!fs.existsSync(resolvedPath)) {
      failures.push(`${path.relative(root, filePath)} -> missing ${rawTarget}`);
      continue;
    }

    if (anchor && resolvedPath.endsWith(".md")) {
      const cached =
        headingCache.get(resolvedPath) ?? getHeadingSlugs(fs.readFileSync(resolvedPath, "utf8"));
      headingCache.set(resolvedPath, cached);

      if (!cached.has(anchor.toLowerCase())) {
        failures.push(`${path.relative(root, filePath)} -> missing anchor ${rawTarget}`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error(`Markdown link check FAIL: ${failures.length} broken internal links.`);
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.info(`Markdown link check PASS: ${markdownFiles.length} markdown files scanned.`);
