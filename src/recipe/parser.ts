import * as fs from 'node:fs';
import { parse as parseLtsv } from 'ltsv';
import type { RecipeEntry } from '../types/index.js';
import { validateRecipeEntry, expandEnvVars } from '../utils/validation.js';

export function parseRecipeFile(filePath: string): RecipeEntry[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Recipe file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return parseRecipeContent(content);
}

export function parseRecipeContent(content: string): RecipeEntry[] {
  const lines = content.split('\n');
  const entries: RecipeEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNumber = i + 1;

    // Skip empty lines
    if (line === '') {
      continue;
    }

    // Skip comment lines
    if (line.startsWith('#')) {
      continue;
    }

    // Parse LTSV line
    const parsed = parseLtsv(line);
    if (parsed.length === 0) {
      continue;
    }

    // ltsv package returns array, get first record
    const record = parsed[0] as Record<string, string>;

    // Validate and create entry
    const entry = validateRecipeEntry(record, lineNumber);

    // Expand environment variables in paths
    entry.dest = expandEnvVars(entry.dest);
    if (entry.src) {
      entry.src = expandEnvVars(entry.src);
    }

    entries.push(entry);
  }

  return entries;
}
