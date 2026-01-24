import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Command } from 'commander';
import type { InstallOptions } from '../types/index.js';
import { createLogger } from '../utils/logger.js';
import {
  validateInstallOptions,
  parseMode,
  validateUid,
  validateGid,
} from '../utils/validation.js';
import { copyFile, makeDirectory, createSymlink } from '../core/operations.js';

export function registerInstallCommand(program: Command): void {
  program
    .command('install')
    .description('Install files or directories')
    .argument('<sources...>', 'Source files or directories (last argument is DEST unless -d is used)')
    .option('-m, --mode <mode>', 'Set permission mode (octal: 644, 0644, 1755)')
    .option('-o, --owner <uid>', 'Set owner UID')
    .option('-g, --group <gid>', 'Set group GID')
    .option('-d, --directory', 'Create directories (mkdir -p equivalent)')
    .option('-b, --backup', 'Create backup of existing files (.old extension)')
    .option('-l, --symlink', 'Create symbolic link instead of copy')
    .option('--verbose', 'Enable verbose output')
    .option('--dry-run', 'Show what would be done without executing')
    .action(executeInstall);
}

interface InstallCliOptions {
  mode?: string;
  owner?: string;
  group?: string;
  directory?: boolean;
  backup?: boolean;
  symlink?: boolean;
  verbose?: boolean;
  dryRun?: boolean;
}

function executeInstall(args: string[], cliOptions: InstallCliOptions): void {
  try {
    const options: InstallOptions = {
      mode: cliOptions.mode,
      owner: cliOptions.owner ? validateUid(cliOptions.owner) : undefined,
      group: cliOptions.group ? validateGid(cliOptions.group) : undefined,
      directory: cliOptions.directory ?? false,
      backup: cliOptions.backup ?? false,
      symlink: cliOptions.symlink ?? false,
      verbose: cliOptions.verbose ?? false,
      dryRun: cliOptions.dryRun ?? false,
    };

    validateInstallOptions(options);

    const logger = createLogger({
      verbose: options.verbose,
      dryRun: options.dryRun,
    });

    if (options.directory) {
      executeDirectoryMode(args, options, logger);
    } else if (options.symlink) {
      executeSymlinkMode(args, options, logger);
    } else {
      executeCopyMode(args, options, logger);
    }
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exit(1);
  }
}

function executeDirectoryMode(
  dirs: string[],
  options: InstallOptions,
  logger: ReturnType<typeof createLogger>
): void {
  if (dirs.length === 0) {
    throw new Error('No directories specified');
  }

  const mode = parseMode(options.mode, 0o755);

  for (const dir of dirs) {
    makeDirectory(dir, {
      mode,
      owner: options.owner,
      group: options.group,
      dryRun: options.dryRun ?? false,
    }, logger);
  }
}

function executeSymlinkMode(
  args: string[],
  options: InstallOptions,
  logger: ReturnType<typeof createLogger>
): void {
  if (args.length < 2) {
    throw new Error('Requires SOURCE and DEST arguments');
  }

  if (args.length > 2) {
    throw new Error('Symlink mode does not support multiple sources');
  }

  const [src, dest] = args;

  createSymlink(src, dest, {
    owner: options.owner,
    group: options.group,
    dryRun: options.dryRun ?? false,
  }, logger);
}

function executeCopyMode(
  args: string[],
  options: InstallOptions,
  logger: ReturnType<typeof createLogger>
): void {
  if (args.length < 2) {
    throw new Error('Requires SOURCE and DEST arguments');
  }

  const sources = args.slice(0, -1);
  const dest = args[args.length - 1];
  const mode = parseMode(options.mode, 0o644);

  if (sources.length === 1) {
    // Single source: copy to dest (file or dir/filename)
    const src = sources[0];
    let finalDest = dest;

    if (fs.existsSync(dest)) {
      const destStat = fs.statSync(dest);
      if (destStat.isDirectory()) {
        finalDest = path.join(dest, path.basename(src));
      }
    }

    copyFile(src, finalDest, {
      mode,
      owner: options.owner,
      group: options.group,
      backup: options.backup ?? false,
      dryRun: options.dryRun ?? false,
    }, logger);
  } else {
    // Multiple sources: dest must be existing directory
    if (!fs.existsSync(dest)) {
      throw new Error(`Destination directory does not exist: ${dest}`);
    }

    const destStat = fs.statSync(dest);
    if (!destStat.isDirectory()) {
      throw new Error(`Destination is not a directory: ${dest}`);
    }

    for (const src of sources) {
      const finalDest = path.join(dest, path.basename(src));
      copyFile(src, finalDest, {
        mode,
        owner: options.owner,
        group: options.group,
        backup: options.backup ?? false,
        dryRun: options.dryRun ?? false,
      }, logger);
    }
  }
}
