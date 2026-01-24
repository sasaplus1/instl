import * as path from 'node:path';
import type { RecipeEntry, SyncOptions } from '../types/index.js';
import type { Logger } from '../utils/logger.js';
import { parseMode } from '../utils/validation.js';
import { copyFile, makeDirectory, createSymlink, touchFile } from '../core/operations.js';

export function executeRecipe(
  entries: RecipeEntry[],
  recipeDir: string,
  options: SyncOptions,
  logger: Logger
): void {
  for (const entry of entries) {
    executeEntry(entry, recipeDir, options, logger);
  }
}

function executeEntry(
  entry: RecipeEntry,
  recipeDir: string,
  options: SyncOptions,
  logger: Logger
): void {
  // Resolve relative paths based on recipe directory
  const resolvePath = (p: string): string => {
    if (path.isAbsolute(p)) {
      return p;
    }
    return path.resolve(recipeDir, p);
  };

  const dest = resolvePath(entry.dest);
  const src = entry.src ? resolvePath(entry.src) : undefined;

  switch (entry.op) {
    case 'touch':
      executeTouchOp(dest, entry, options, logger);
      break;
    case 'mkdir':
      executeMkdirOp(dest, entry, options, logger);
      break;
    case 'cp':
      if (!src) {
        throw new Error('cp operation requires src');
      }
      executeCpOp(src, dest, entry, options, logger);
      break;
    case 'ln':
      if (!src) {
        throw new Error('ln operation requires src');
      }
      // For ln, src should be relative to dest location if relative
      const lnSrc = entry.src && !path.isAbsolute(entry.src)
        ? entry.src  // Keep relative for symlink target
        : src;
      executeLnOp(lnSrc!, dest, entry, options, logger);
      break;
    default:
      throw new Error(`Unknown operation: ${entry.op}`);
  }
}

function executeTouchOp(
  dest: string,
  entry: RecipeEntry,
  options: SyncOptions,
  logger: Logger
): void {
  const mode = entry.mode ? parseMode(entry.mode, 0o644) : undefined;

  touchFile(dest, {
    mode,
    owner: entry.owner,
    group: entry.group,
    dryRun: options.dryRun ?? false,
  }, logger);
}

function executeMkdirOp(
  dest: string,
  entry: RecipeEntry,
  options: SyncOptions,
  logger: Logger
): void {
  const mode = parseMode(entry.mode, 0o755);

  makeDirectory(dest, {
    mode,
    owner: entry.owner,
    group: entry.group,
    dryRun: options.dryRun ?? false,
  }, logger);
}

function executeCpOp(
  src: string,
  dest: string,
  entry: RecipeEntry,
  options: SyncOptions,
  logger: Logger
): void {
  const mode = parseMode(entry.mode, 0o644);

  copyFile(src, dest, {
    mode,
    owner: entry.owner,
    group: entry.group,
    backup: false, // Recipe doesn't support backup
    dryRun: options.dryRun ?? false,
  }, logger);
}

function executeLnOp(
  src: string,
  dest: string,
  entry: RecipeEntry,
  options: SyncOptions,
  logger: Logger
): void {
  createSymlink(src, dest, {
    owner: entry.owner,
    group: entry.group,
    dryRun: options.dryRun ?? false,
  }, logger);
}
