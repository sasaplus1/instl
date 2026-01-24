import { Command } from 'commander';
import { registerInstallCommand } from './install.js';
import { registerSyncCommand } from './sync.js';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('instl')
    .description('A CLI tool for installing files with LTSV recipe support')
    .version('1.0.0');

  registerInstallCommand(program);
  registerSyncCommand(program);

  return program;
}
