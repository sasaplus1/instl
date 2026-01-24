import type { LogAction, LoggerOptions } from '../types/index.js';

export class Logger {
  private verbose: boolean;
  private dryRun: boolean;

  constructor(options: LoggerOptions) {
    this.verbose = options.verbose;
    this.dryRun = options.dryRun;
  }

  log(action: LogAction, message: string): void {
    if (!this.verbose && !this.dryRun) {
      return;
    }

    const prefix = this.dryRun ? '[DRY-RUN]' : `[${action}]`;
    console.log(`${prefix} ${action === 'COPY' || this.dryRun ? action + ' ' : ''}${message}`);
  }

  logAction(action: LogAction, details: string): void {
    if (!this.verbose && !this.dryRun) {
      return;
    }

    if (this.dryRun) {
      console.log(`[DRY-RUN] ${action} ${details}`);
    } else {
      console.log(`[${action}] ${details}`);
    }
  }

  error(message: string): void {
    console.error(`Error: ${message}`);
  }
}

export function createLogger(options: Partial<LoggerOptions>): Logger {
  return new Logger({
    verbose: options.verbose ?? false,
    dryRun: options.dryRun ?? false,
  });
}
