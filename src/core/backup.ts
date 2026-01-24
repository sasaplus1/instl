import * as fs from 'node:fs';
import type { Logger } from '../utils/logger.js';

const BACKUP_EXTENSION = '.old';

export function createBackup(filePath: string, logger: Logger, dryRun: boolean): void {
  const backupPath = filePath + BACKUP_EXTENSION;

  if (!fs.existsSync(filePath)) {
    return;
  }

  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    throw new Error(`Cannot backup directory: ${filePath}`);
  }

  logger.logAction('BACKUP', `${filePath} -> ${backupPath}`);

  if (!dryRun) {
    // If backup already exists, it will be overwritten (BSD install behavior)
    fs.renameSync(filePath, backupPath);
  }
}

export function getBackupPath(filePath: string): string {
  return filePath + BACKUP_EXTENSION;
}
