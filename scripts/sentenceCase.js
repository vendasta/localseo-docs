/*
 Converts titles and subtitles across docs to sentence case.
 - Updates frontmatter keys: title, sidebar_label
 - Updates markdown ATX headings (#, ##, ###, ...)
 - Updates HTML headings (<h1>, <h2>, <h3>, ...)
 - Updates _category_.json label fields
 - Preserves known product names and acronyms
*/

const fs = require('fs');
const path = require('path');

const workspaceRoot = path.resolve(__dirname, '..');
const docsRoot = path.join(workspaceRoot, 'docusaurus', 'docs');

/**
 * Phrases to preserve with exact casing (multi-word and single-word proper nouns).
 * Order matters: longer phrases first to avoid partial replacements.
 */
const preservePhrases = [
  'Local SEO',
  'Listing Sync Pro',
  'Listing Sync',
  'Citation Builder',
  'Keyword Tracking',
  'Business Profile',
  'My Listing',
  'Google Business Profile',
  'Apple Business',
  'Apple Business Connect',
  'Google',
  'Bing',
  'Apple',
  'Yext',
  'Facebook',
  'X',
  'Docs',
  'FAQs'
];

/**
 * Create an array of placeholder tokens for preserved phrases.
 */
function createPlaceholders(text) {
  const map = new Map();
  let result = text;
  let counter = 0;
  // Replace multi-word phrases first, case-sensitive. Use tokens with only symbols+digits.
  preservePhrases
    .sort((a, b) => b.length - a.length)
    .forEach((phrase) => {
      const token = `@@${counter++}@@`;
      const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'g');
      if (regex.test(result)) {
        result = result.replace(regex, token);
        map.set(token, phrase);
      }
    });

  // Preserve acronyms (2+ uppercase letters), unique token per occurrence
  const acronymRegex = /\b([A-Z]{2,})\b/g;
  result = result.replace(acronymRegex, (m, p1) => {
    const token = `@@${counter++}@@`;
    map.set(token, p1);
    return token;
  });

  return { textWithPlaceholders: result, placeholderMap: map };
}

/**
 * Restore placeholders to their original values.
 */
function restorePlaceholders(text, placeholderMap) {
  let result = text;
  for (const [token, value] of placeholderMap.entries()) {
    const regex = new RegExp(token, 'g');
    result = result.replace(regex, value);
  }
  return result;
}

/**
 * Convert a string to sentence case while preserving known phrases and acronyms.
 */
function toSentenceCase(raw) {
  if (!raw) return raw;

  // Skip if it contains code fences or looks like HTML-only content
  const text = raw.trim();
  if (text.length === 0) return raw;

  const { textWithPlaceholders, placeholderMap } = createPlaceholders(text);

  // Lowercase entire string first
  let lower = textWithPlaceholders.toLowerCase();

  // Capitalize first alphabetic character of the line
  lower = lower.replace(/(^\s*[#>*-]*\s*)([a-z])/, (m, p1, p2) => p1 + p2.toUpperCase());

  // Restore preserved phrases and acronyms
  const restored = restorePlaceholders(lower, placeholderMap);

  return restored;
}

/**
 * Restore legacy tokens from a previous run that used lettered tokens and got lowercased.
 */
function restoreLegacyTokens(text) {
  let result = text;
  // __phrase_#__ (case-insensitive) -> preservePhrases[#]
  result = result.replace(/__phrase_(\d+)__/gi, (m, idx) => {
    const i = parseInt(idx, 10);
    return Number.isFinite(i) && preservePhrases[i] ? preservePhrases[i] : m;
  });
  // __acro_<word>__ -> uppercase the word
  result = result.replace(/__acro_([a-z0-9]+)__/gi, (m, word) => word.toUpperCase());
  return result;
}

/**
 * Transform heading content, including inline markdown links.
 */
function transformHeadingContent(content) {
  // If heading is a single markdown link, only transform the link text, not the URL
  const linkMatch = content.match(/^\s*\[([^\]]+)\]\(([^)]+)\)\s*$/);
  if (linkMatch) {
    const linkText = linkMatch[1];
    const url = linkMatch[2];
    const newText = toSentenceCase(linkText);
    return `[${newText}](${url})`;
  }
  return toSentenceCase(content);
}

/**
 * Process a markdown/mdx file.
 */
function processMarkdownFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');
  let content = restoreLegacyTokens(original);

  // Update frontmatter title and sidebar_label
  const fmRegex = /^---\n([\s\S]*?)\n---/m;
  if (fmRegex.test(content)) {
    content = content.replace(fmRegex, (m, fmBody) => {
      let updated = fmBody
        .replace(/^(title:\s*)(.+)$/m, (mm, p1, p2) => p1 + toSentenceCase(p2.replace(/^['"]|['"]$/g, '')))
        .replace(/^(sidebar_label:\s*)(.+)$/m, (mm, p1, p2) => p1 + toSentenceCase(p2.replace(/^['"]|['"]$/g, '')));
      return `---\n${updated}\n---`;
    });
  }

  // Update ATX markdown headings
  content = content.replace(/^(\s{0,3}#{1,6}\s+)(.+)$/gm, (m, p1, p2) => {
    return p1 + transformHeadingContent(p2.trim());
  });

  // Update HTML headings
  content = content.replace(/<(h[1-6])>([\s\S]*?)<\/\1>/g, (m, tag, inner) => {
    // Avoid altering if inner contains tags; do a conservative transform only if it's plain text
    if (/[<]/.test(inner)) return m;
    return `<${tag}>${toSentenceCase(inner)}</${tag}>`;
  });

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  return false;
}

/**
 * Process a _category_.json file to update the label.
 */
function processCategoryJson(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');
  try {
    const data = JSON.parse(restoreLegacyTokens(original));
    if (data && typeof data.label === 'string') {
      const newLabel = toSentenceCase(data.label);
      if (newLabel !== data.label) {
        data.label = newLabel;
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
        return true;
      }
    }
  } catch (e) {
    // If JSON parse fails, skip
  }
  return false;
}

/**
 * Recursively walk a directory and return file paths matching extensions.
 */
function walkDir(dir, exts, collected = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, exts, collected);
    } else if (exts.includes(path.extname(entry.name).toLowerCase())) {
      collected.push(fullPath);
    }
  }
  return collected;
}

function main() {
  const mdFiles = walkDir(docsRoot, ['.md', '.mdx']);
  const jsonFiles = walkDir(docsRoot, ['.json']).filter((p) => path.basename(p) === '_category_.json');

  const changed = [];

  for (const file of mdFiles) {
    if (processMarkdownFile(file)) changed.push(file);
  }
  for (const file of jsonFiles) {
    if (processCategoryJson(file)) changed.push(file);
  }

  // Additionally scan the docs index page for HTML <h3> cards if not already covered
  // (covered by mdx processing above)

  console.log(`Updated ${changed.length} files.`);
  changed.forEach((f) => console.log(' - ' + path.relative(workspaceRoot, f)));
}

if (require.main === module) {
  main();
}

