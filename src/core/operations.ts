import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Logger } from '../utils/logger.js';
import { createBackup } from './backup.js';
import { setOwner } from './permissions.js';

export interface CopyOptions {
  mode: number;
  owner?: number;
  group?: number;
  backup: boolean;
  dryRun: boolean;
}

export interface MkdirOptions {
  mode: number;
  owner?: number;
  group?: number;
  dryRun: boolean;
}

export interface SymlinkOptions {
  owner?: number;
  group?: number;
  dryRun: boolean;
}

export interface TouchOptions {
  mode?: number;
  owner?: number;
  group?: number;
  dryRun: boolean;
}

export function copyFile(
  src: string,
  dest: string,
  options: CopyOptions,
  logger: Logger
): void {
  // Check if source exists
  if (!fs.existsSync(src)) {
    throw new Error(`Source file not found: ${src}`);
  }

  const srcStat = fs.statSync(src);
  if (srcStat.isDirectory()) {
    throw new Error(`Source is a directory: ${src}`);
  }

  // Check if dest is a directory
  if (fs.existsSync(dest)) {
    const destStat = fs.statSync(dest);
    if (destStat.isDirectory()) {
      throw new Error(`Destination is a directory: ${dest}`);
    }
  }

  // Create backup if needed
  if (options.backup && fs.existsSync(dest)) {
    createBackup(dest, logger, options.dryRun);
  }

  const modeStr = options.mode.toString(8).padStart(4, '0');
  logger.logAction('COPY', `${src} -> ${dest} (mode: ${modeStr})`);

  if (!options.dryRun) {
    // Ensure parent directory exists
    const parentDir = path.dirname(dest);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true, mode: 0o755 });
    }

    fs.copyFileSync(src, dest);
    fs.chmodSync(dest, options.mode);
  }

  // Set owner/group after copy
  if (!options.dryRun && (options.owner !== undefined || options.group !== undefined)) {
    setOwner(dest, options.owner, options.group, logger, options.dryRun);
  } else if (options.dryRun && (options.owner !== undefined || options.group !== undefined)) {
    setOwner(dest, options.owner, options.group, logger, options.dryRun);
  }
}

export function makeDirectory(
  dirPath: string,
  options: MkdirOptions,
  logger: Logger
): void {
  const modeStr = options.mode.toString(8).padStart(4, '0');
  logger.logAction('MKDIR', `${dirPath} (mode: ${modeStr})`);

  if (!options.dryRun) {
    fs.mkdirSync(dirPath, { recursive: true, mode: options.mode });
  }

  // Set owner/group after mkdir
  if (!options.dryRun && (options.owner !== undefined || options.group !== undefined)) {
    setOwner(dirPath, options.owner, options.group, logger, options.dryRun);
  } else if (options.dryRun && (options.owner !== undefined || options.group !== undefined)) {
    setOwner(dirPath, options.owner, options.group, logger, options.dryRun);
  }
}

export function createSymlink(
  src: string,
  dest: string,
  options: SymlinkOptions,
  logger: Logger
): void {
  // Check if dest exists
  if (fs.existsSync(dest) || fs.lstatSync(dest, { throwIfNoEntry: false })) {
    const stat = fs.lstatSync(dest);
    if (stat.isDirectory()) {
      throw new Error(`Destination is a directory: ${dest}`);
    }

    // Remove existing file or symlink
    logger.logAction('DELETE', dest);
    if (!options.dryRun) {
      fs.unlinkSync(dest);
    }
  }

  logger.logAction('LINK', `${src} -> ${dest}`);

  if (!options.dryRun) {
    // Ensure parent directory exists
    const parentDir = path.dirname(dest);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true, mode: 0o755 });
    }

    fs.symlinkSync(src, dest);
  }

  // Set owner/group using lchown for symlinks
  if (!options.dryRun && (options.owner !== undefined || options.group !== undefined)) {
    setOwner(dest, options.owner, options.group, logger, options.dryRun, true);
  } else if (options.dryRun && (options.owner !== undefined || options.group !== undefined)) {
    setOwner(dest, options.owner, options.group, logger, options.dryRun, true);
  }
}

export function touchFile(
  filePath: string,
  options: TouchOptions,
  logger: Logger
): void {
  const exists = fs.existsSync(filePath);

  if (exists) {
    // Update timestamp
    const modeInfo = options.mode !== undefined
      ? ` (mode: ${options.mode.toString(8).padStart(4, '0')})`
      : '';
    logger.logAction('TOUCH', `${filePath}${modeInfo}`);

    if (!options.dryRun) {
      const now = new Date();
      fs.utimesSync(filePath, now, now);

      // Only change mode if explicitly specified
      if (options.mode !== undefined) {
        fs.chmodSync(filePath, options.mode);
      }
    }
  } else {
    // Create empty file
    const mode = options.mode ?? 0o644;
    const modeStr = mode.toString(8).padStart(4, '0');
    logger.logAction('TOUCH', `${filePath} (mode: ${modeStr})`);

    if (!options.dryRun) {
      // Ensure parent directory exists
      const parentDir = path.dirname(filePath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true, mode: 0o755 });
      }

      fs.writeFileSync(filePath, '');
      fs.chmodSync(filePath, mode);
    }
  }

  // Set owner/group
  if (!options.dryRun && (options.owner !== undefined || options.group !== undefined)) {
    setOwner(filePath, options.owner, options.group, logger, options.dryRun);
  } else if (options.dryRun && (options.owner !== undefined || options.group !== undefined)) {
    setOwner(filePath, options.owner, options.group, logger, options.dryRun);
  }
}
