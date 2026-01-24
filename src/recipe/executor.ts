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
      const lnSrc = entry.src !== undefined && !path.isAbsolute(entry.src)
        ? entry.src  // Keep relative for symlink target
        : src;
      executeLnOp(lnSrc, dest, entry, options, logger);
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
  touchFile(dest, {
    dryRun: options.dryRun,
    ...(entry.mode !== undefined ? { mode: parseMode(entry.mode, 0o644) } : {}),
    ...(entry.owner !== undefined ? { owner: entry.owner } : {}),
    ...(entry.group !== undefined ? { group: entry.group } : {}),
  }, logger);
}

function executeMkdirOp(
  dest: string,
  entry: RecipeEntry,
  options: SyncOptions,
  logger: Logger
): void {
  makeDirectory(dest, {
    mode: parseMode(entry.mode, 0o755),
    dryRun: options.dryRun,
    ...(entry.owner !== undefined ? { owner: entry.owner } : {}),
    ...(entry.group !== undefined ? { group: entry.group } : {}),
  }, logger);
}

function executeCpOp(
  src: string,
  dest: string,
  entry: RecipeEntry,
  options: SyncOptions,
  logger: Logger
): void {
  copyFile(src, dest, {
    mode: parseMode(entry.mode, 0o644),
    backup: false,
    dryRun: options.dryRun,
    ...(entry.owner !== undefined ? { owner: entry.owner } : {}),
    ...(entry.group !== undefined ? { group: entry.group } : {}),
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
    dryRun: options.dryRun,
    ...(entry.owner !== undefined ? { owner: entry.owner } : {}),
    ...(entry.group !== undefined ? { group: entry.group } : {}),
  }, logger);
}
