import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync, type ExecSyncOptions } from 'node:child_process';

export function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'instl-test-'));
}

export function cleanupTempDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

export function createTestFile(dir: string, name: string, content: string = ''): string {
  const filePath = path.join(dir, name);
  const parentDir = path.dirname(filePath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }
  fs.writeFileSync(filePath, content);
  return filePath;
}

export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

export function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

export function getFileMode(filePath: string): number {
  const stat = fs.statSync(filePath);
  return stat.mode & 0o7777;
}

export function isSymlink(filePath: string): boolean {
  try {
    const stat = fs.lstatSync(filePath);
    return stat.isSymbolicLink();
  } catch {
    return false;
  }
}

export function getSymlinkTarget(filePath: string): string {
  return fs.readlinkSync(filePath);
}

export function isDirectory(filePath: string): boolean {
  try {
    const stat = fs.statSync(filePath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

export function getInstlBin(): string {
  const envBin = process.env['INSTL_BIN'];
  if (envBin) {
    return path.resolve(envBin);
  }
  return 'npx tsx src/index.ts';
}

export function runInstl(args: string, cwd?: string): { stdout: string; stderr: string; exitCode: number } {
  const bin = getInstlBin();
  const cmd = `${bin} ${args}`;
  const options: ExecSyncOptions = {
    cwd: cwd ?? path.join(__dirname, '..'),
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  };

  try {
    const stdout = execSync(cmd, options) as string;
    return { stdout, stderr: '', exitCode: 0 };
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: execError.stdout ?? '',
      stderr: execError.stderr ?? '',
      exitCode: execError.status ?? 1,
    };
  }
}
