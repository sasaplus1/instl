import type { InstallOptions, RecipeEntry, RecipeOperation } from '../types/index.js';

export function validateMode(mode: string): number {
  // Allow 3-digit (644) or 4-digit (0644, 1755) octal mode
  const modeStr = mode.replace(/^0+/, '') || '0';
  const modeNum = parseInt(modeStr, 8);

  if (isNaN(modeNum) || modeNum < 0 || modeNum > 0o7777) {
    throw new Error(`Invalid mode: ${mode}`);
  }

  return modeNum;
}

export function parseMode(mode: string | undefined, defaultMode: number): number {
  if (!mode) {
    return defaultMode;
  }
  return validateMode(mode);
}

export function validateUid(uid: string): number {
  const uidNum = parseInt(uid, 10);
  if (isNaN(uidNum) || uidNum < 0) {
    throw new Error(`Invalid UID: ${uid}`);
  }
  return uidNum;
}

export function validateGid(gid: string): number {
  const gidNum = parseInt(gid, 10);
  if (isNaN(gidNum) || gidNum < 0) {
    throw new Error(`Invalid GID: ${gid}`);
  }
  return gidNum;
}

export function validateInstallOptions(options: InstallOptions): void {
  // -d cannot be combined with -b or -l
  if (options.directory) {
    if (options.backup) {
      throw new Error('Cannot use --backup with --directory');
    }
    if (options.symlink) {
      throw new Error('Cannot use --symlink with --directory');
    }
  }

  // -b and -l cannot be combined
  if (options.backup && options.symlink) {
    throw new Error('Cannot use --backup with --symlink');
  }
}

export function validateRecipeOperation(op: string): RecipeOperation {
  const validOps: RecipeOperation[] = ['touch', 'mkdir', 'cp', 'ln'];
  if (!validOps.includes(op as RecipeOperation)) {
    throw new Error(`Unknown operation: ${op}`);
  }
  return op as RecipeOperation;
}

export function validateRecipeEntry(entry: Record<string, string>, lineNumber: number): RecipeEntry {
  const op = entry['op'];
  if (!op) {
    throw new Error(`Line ${lineNumber}: Missing required field 'op'`);
  }

  const validOp = validateRecipeOperation(op);
  const dest = entry['dest'];

  if (!dest) {
    throw new Error(`Line ${lineNumber}: Missing required field 'dest'`);
  }

  // Validate required src for cp and ln
  if ((validOp === 'cp' || validOp === 'ln') && !entry['src']) {
    throw new Error(`Line ${lineNumber}: Operation '${validOp}' requires 'src' field`);
  }

  const result: RecipeEntry = {
    op: validOp,
    dest,
  };

  if (entry['src']) {
    result.src = entry['src'];
  }

  if (entry['mode']) {
    validateMode(entry['mode']);
    result.mode = entry['mode'];
  }

  if (entry['owner']) {
    result.owner = validateUid(entry['owner']);
  }

  if (entry['group']) {
    result.group = validateGid(entry['group']);
  }

  return result;
}

export function expandEnvVars(path: string): string {
  return path.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_, name) => {
    return process.env[name] ?? '';
  });
}
