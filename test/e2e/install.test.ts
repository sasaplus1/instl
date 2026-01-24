import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  createTempDir,
  cleanupTempDir,
  createTestFile,
  fileExists,
  readFile,
  getFileMode,
  isSymlink,
  getSymlinkTarget,
  isDirectory,
  runInstl,
} from '../setup.js';

describe('instl install', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe('file copy', () => {
    it('should copy a single file', () => {
      const src = createTestFile(tempDir, 'source.txt', 'hello world');
      const dest = path.join(tempDir, 'dest.txt');

      const result = runInstl(`install ${src} ${dest}`);
      expect(result.exitCode).toBe(0);
      expect(fileExists(dest)).toBe(true);
      expect(readFile(dest)).toBe('hello world');
    });

    it('should copy a single file to a directory', () => {
      const src = createTestFile(tempDir, 'source.txt', 'hello');
      const destDir = path.join(tempDir, 'destdir');
      fs.mkdirSync(destDir);

      const result = runInstl(`install ${src} ${destDir}`);
      expect(result.exitCode).toBe(0);
      expect(fileExists(path.join(destDir, 'source.txt'))).toBe(true);
    });

    it('should copy multiple files to a directory', () => {
      const src1 = createTestFile(tempDir, 'file1.txt', 'one');
      const src2 = createTestFile(tempDir, 'file2.txt', 'two');
      const destDir = path.join(tempDir, 'destdir');
      fs.mkdirSync(destDir);

      const result = runInstl(`install ${src1} ${src2} ${destDir}`);
      expect(result.exitCode).toBe(0);
      expect(readFile(path.join(destDir, 'file1.txt'))).toBe('one');
      expect(readFile(path.join(destDir, 'file2.txt'))).toBe('two');
    });

    it('should fail when copying multiple files to non-directory', () => {
      const src1 = createTestFile(tempDir, 'file1.txt', 'one');
      const src2 = createTestFile(tempDir, 'file2.txt', 'two');
      const dest = path.join(tempDir, 'notexist');

      const result = runInstl(`install ${src1} ${src2} ${dest}`);
      expect(result.exitCode).toBe(1);
    });

    it('should fail when source does not exist', () => {
      const src = path.join(tempDir, 'notexist.txt');
      const dest = path.join(tempDir, 'dest.txt');

      const result = runInstl(`install ${src} ${dest}`);
      expect(result.exitCode).toBe(1);
    });
  });

  describe('mode option', () => {
    it('should set file mode with -m option (3 digit)', () => {
      const src = createTestFile(tempDir, 'source.txt', 'content');
      const dest = path.join(tempDir, 'dest.txt');

      runInstl(`install -m 600 ${src} ${dest}`);
      expect(getFileMode(dest)).toBe(0o600);
    });

    it('should set file mode with -m option (4 digit)', () => {
      const src = createTestFile(tempDir, 'source.txt', 'content');
      const dest = path.join(tempDir, 'dest.txt');

      runInstl(`install -m 0755 ${src} ${dest}`);
      expect(getFileMode(dest)).toBe(0o755);
    });

    it('should default to 644 for files', () => {
      const src = createTestFile(tempDir, 'source.txt', 'content');
      const dest = path.join(tempDir, 'dest.txt');

      runInstl(`install ${src} ${dest}`);
      expect(getFileMode(dest)).toBe(0o644);
    });
  });

  describe('directory mode (-d)', () => {
    it('should create a single directory', () => {
      const dir = path.join(tempDir, 'newdir');

      const result = runInstl(`install -d ${dir}`);
      expect(result.exitCode).toBe(0);
      expect(isDirectory(dir)).toBe(true);
    });

    it('should create multiple directories', () => {
      const dir1 = path.join(tempDir, 'dir1');
      const dir2 = path.join(tempDir, 'dir2');

      const result = runInstl(`install -d ${dir1} ${dir2}`);
      expect(result.exitCode).toBe(0);
      expect(isDirectory(dir1)).toBe(true);
      expect(isDirectory(dir2)).toBe(true);
    });

    it('should create nested directories', () => {
      const dir = path.join(tempDir, 'a/b/c');

      const result = runInstl(`install -d ${dir}`);
      expect(result.exitCode).toBe(0);
      expect(isDirectory(dir)).toBe(true);
    });

    it('should set directory mode with -m option', () => {
      const dir = path.join(tempDir, 'newdir');

      runInstl(`install -d -m 700 ${dir}`);
      expect(getFileMode(dir)).toBe(0o700);
    });

    it('should default to 755 for directories', () => {
      const dir = path.join(tempDir, 'newdir');

      runInstl(`install -d ${dir}`);
      expect(getFileMode(dir)).toBe(0o755);
    });

    it('should fail when combining -d with -b', () => {
      const dir = path.join(tempDir, 'newdir');
      const result = runInstl(`install -d -b ${dir}`);
      expect(result.exitCode).toBe(1);
    });

    it('should fail when combining -d with -l', () => {
      const dir = path.join(tempDir, 'newdir');
      const result = runInstl(`install -d -l ${dir}`);
      expect(result.exitCode).toBe(1);
    });
  });

  describe('symlink mode (-l)', () => {
    it('should create a symbolic link', () => {
      const src = createTestFile(tempDir, 'source.txt', 'content');
      const dest = path.join(tempDir, 'link');

      const result = runInstl(`install -l ${src} ${dest}`);
      expect(result.exitCode).toBe(0);
      expect(isSymlink(dest)).toBe(true);
      expect(getSymlinkTarget(dest)).toBe(src);
    });

    it('should replace existing file with symlink', () => {
      const src = createTestFile(tempDir, 'source.txt', 'content');
      const dest = createTestFile(tempDir, 'existing.txt', 'old');

      const result = runInstl(`install -l ${src} ${dest}`);
      expect(result.exitCode).toBe(0);
      expect(isSymlink(dest)).toBe(true);
    });

    it('should replace existing symlink', () => {
      const src1 = createTestFile(tempDir, 'source1.txt', 'one');
      const src2 = createTestFile(tempDir, 'source2.txt', 'two');
      const dest = path.join(tempDir, 'link');
      fs.symlinkSync(src1, dest);

      const result = runInstl(`install -l ${src2} ${dest}`);
      expect(result.exitCode).toBe(0);
      expect(getSymlinkTarget(dest)).toBe(src2);
    });

    it('should fail when dest is a directory', () => {
      const src = createTestFile(tempDir, 'source.txt', 'content');
      const dest = path.join(tempDir, 'existingdir');
      fs.mkdirSync(dest);

      const result = runInstl(`install -l ${src} ${dest}`);
      expect(result.exitCode).toBe(1);
    });

    it('should fail with multiple sources', () => {
      const src1 = createTestFile(tempDir, 'source1.txt', 'one');
      const src2 = createTestFile(tempDir, 'source2.txt', 'two');
      const dest = path.join(tempDir, 'link');

      const result = runInstl(`install -l ${src1} ${src2} ${dest}`);
      expect(result.exitCode).toBe(1);
    });

    it('should fail when combining -l with -b', () => {
      const src = createTestFile(tempDir, 'source.txt', 'content');
      const dest = path.join(tempDir, 'link');
      const result = runInstl(`install -l -b ${src} ${dest}`);
      expect(result.exitCode).toBe(1);
    });
  });

  describe('backup mode (-b)', () => {
    it('should create backup when dest exists', () => {
      const src = createTestFile(tempDir, 'source.txt', 'new content');
      const dest = createTestFile(tempDir, 'dest.txt', 'old content');
      const backupPath = dest + '.old';

      const result = runInstl(`install -b ${src} ${dest}`);
      expect(result.exitCode).toBe(0);
      expect(fileExists(backupPath)).toBe(true);
      expect(readFile(backupPath)).toBe('old content');
      expect(readFile(dest)).toBe('new content');
    });

    it('should not create backup when dest does not exist', () => {
      const src = createTestFile(tempDir, 'source.txt', 'content');
      const dest = path.join(tempDir, 'newdest.txt');
      const backupPath = dest + '.old';

      const result = runInstl(`install -b ${src} ${dest}`);
      expect(result.exitCode).toBe(0);
      expect(fileExists(backupPath)).toBe(false);
      expect(readFile(dest)).toBe('content');
    });

    it('should overwrite existing .old file', () => {
      const src = createTestFile(tempDir, 'source.txt', 'newest');
      const dest = createTestFile(tempDir, 'dest.txt', 'current');
      const backupPath = dest + '.old';
      createTestFile(tempDir, 'dest.txt.old', 'oldest');

      const result = runInstl(`install -b ${src} ${dest}`);
      expect(result.exitCode).toBe(0);
      expect(readFile(backupPath)).toBe('current');
      expect(readFile(dest)).toBe('newest');
    });
  });

  describe('dry-run', () => {
    it('should not create file in dry-run mode', () => {
      const src = createTestFile(tempDir, 'source.txt', 'content');
      const dest = path.join(tempDir, 'dest.txt');

      const result = runInstl(`install --dry-run ${src} ${dest}`);
      expect(result.exitCode).toBe(0);
      expect(fileExists(dest)).toBe(false);
    });

    it('should not create directory in dry-run mode', () => {
      const dir = path.join(tempDir, 'newdir');

      const result = runInstl(`install -d --dry-run ${dir}`);
      expect(result.exitCode).toBe(0);
      expect(fileExists(dir)).toBe(false);
    });

    it('should not create symlink in dry-run mode', () => {
      const src = createTestFile(tempDir, 'source.txt', 'content');
      const dest = path.join(tempDir, 'link');

      const result = runInstl(`install -l --dry-run ${src} ${dest}`);
      expect(result.exitCode).toBe(0);
      expect(fileExists(dest)).toBe(false);
    });
  });

  describe('verbose', () => {
    it('should show output in verbose mode', () => {
      const src = createTestFile(tempDir, 'source.txt', 'content');
      const dest = path.join(tempDir, 'dest.txt');

      const result = runInstl(`install --verbose ${src} ${dest}`);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('[COPY]');
    });
  });
});
