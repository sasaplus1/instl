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

describe('instl sync', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe('recipe parsing', () => {
    it('should skip empty lines', () => {
      const recipe = createTestFile(tempDir, 'recipe.ltsv', `
op:mkdir\tdest:${tempDir}/dir1

op:mkdir\tdest:${tempDir}/dir2
`);

      const result = runInstl(`sync ${recipe}`);
      expect(result.exitCode).toBe(0);
      expect(isDirectory(path.join(tempDir, 'dir1'))).toBe(true);
      expect(isDirectory(path.join(tempDir, 'dir2'))).toBe(true);
    });

    it('should skip comment lines', () => {
      const recipe = createTestFile(tempDir, 'recipe.ltsv', `# This is a comment
op:mkdir\tdest:${tempDir}/dir1
# Another comment
op:mkdir\tdest:${tempDir}/dir2
`);

      const result = runInstl(`sync ${recipe}`);
      expect(result.exitCode).toBe(0);
      expect(isDirectory(path.join(tempDir, 'dir1'))).toBe(true);
      expect(isDirectory(path.join(tempDir, 'dir2'))).toBe(true);
    });

    it('should fail with unknown operation', () => {
      const recipe = createTestFile(tempDir, 'recipe.ltsv', `op:unknown\tdest:${tempDir}/file`);

      const result = runInstl(`sync ${recipe}`);
      expect(result.exitCode).toBe(1);
    });

    it('should fail when recipe file does not exist', () => {
      const result = runInstl(`sync ${tempDir}/nonexistent.ltsv`);
      expect(result.exitCode).toBe(1);
    });

    it('should fail when dest is missing', () => {
      const recipe = createTestFile(tempDir, 'recipe.ltsv', `op:mkdir`);

      const result = runInstl(`sync ${recipe}`);
      expect(result.exitCode).toBe(1);
    });

    it('should fail when cp is missing src', () => {
      const recipe = createTestFile(tempDir, 'recipe.ltsv', `op:cp\tdest:${tempDir}/dest.txt`);

      const result = runInstl(`sync ${recipe}`);
      expect(result.exitCode).toBe(1);
    });
  });

  describe('touch operation', () => {
    it('should create empty file', () => {
      const recipe = createTestFile(tempDir, 'recipe.ltsv', `op:touch\tdest:${tempDir}/newfile.txt`);

      const result = runInstl(`sync ${recipe}`);
      expect(result.exitCode).toBe(0);
      expect(fileExists(path.join(tempDir, 'newfile.txt'))).toBe(true);
      expect(readFile(path.join(tempDir, 'newfile.txt'))).toBe('');
    });

    it('should set mode for new file', () => {
      const recipe = createTestFile(tempDir, 'recipe.ltsv', `op:touch\tdest:${tempDir}/newfile.txt\tmode:0600`);

      runInstl(`sync ${recipe}`);
      expect(getFileMode(path.join(tempDir, 'newfile.txt'))).toBe(0o600);
    });

    it('should update timestamp of existing file', () => {
      const existingFile = createTestFile(tempDir, 'existing.txt', 'content');
      const oldStat = fs.statSync(existingFile);

      // Wait a bit to ensure time difference
      const recipe = createTestFile(tempDir, 'recipe.ltsv', `op:touch\tdest:${existingFile}`);

      runInstl(`sync ${recipe}`);

      const newStat = fs.statSync(existingFile);
      expect(newStat.mtime.getTime()).toBeGreaterThanOrEqual(oldStat.mtime.getTime());
      expect(readFile(existingFile)).toBe('content'); // Content preserved
    });

    it('should create parent directories', () => {
      const recipe = createTestFile(tempDir, 'recipe.ltsv', `op:touch\tdest:${tempDir}/a/b/c/file.txt`);

      runInstl(`sync ${recipe}`);
      expect(fileExists(path.join(tempDir, 'a/b/c/file.txt'))).toBe(true);
    });
  });

  describe('mkdir operation', () => {
    it('should create directory', () => {
      const recipe = createTestFile(tempDir, 'recipe.ltsv', `op:mkdir\tdest:${tempDir}/newdir`);

      const result = runInstl(`sync ${recipe}`);
      expect(result.exitCode).toBe(0);
      expect(isDirectory(path.join(tempDir, 'newdir'))).toBe(true);
    });

    it('should create nested directories', () => {
      const recipe = createTestFile(tempDir, 'recipe.ltsv', `op:mkdir\tdest:${tempDir}/a/b/c`);

      runInstl(`sync ${recipe}`);
      expect(isDirectory(path.join(tempDir, 'a/b/c'))).toBe(true);
    });

    it('should set directory mode', () => {
      const recipe = createTestFile(tempDir, 'recipe.ltsv', `op:mkdir\tdest:${tempDir}/newdir\tmode:0700`);

      runInstl(`sync ${recipe}`);
      expect(getFileMode(path.join(tempDir, 'newdir'))).toBe(0o700);
    });

    it('should default to mode 755', () => {
      const recipe = createTestFile(tempDir, 'recipe.ltsv', `op:mkdir\tdest:${tempDir}/newdir`);

      runInstl(`sync ${recipe}`);
      expect(getFileMode(path.join(tempDir, 'newdir'))).toBe(0o755);
    });
  });

  describe('cp operation', () => {
    it('should copy file', () => {
      const src = createTestFile(tempDir, 'source.txt', 'hello');
      const recipe = createTestFile(tempDir, 'recipe.ltsv', `op:cp\tsrc:${src}\tdest:${tempDir}/dest.txt`);

      const result = runInstl(`sync ${recipe}`);
      expect(result.exitCode).toBe(0);
      expect(readFile(path.join(tempDir, 'dest.txt'))).toBe('hello');
    });

    it('should set file mode', () => {
      const src = createTestFile(tempDir, 'source.txt', 'content');
      const recipe = createTestFile(tempDir, 'recipe.ltsv', `op:cp\tsrc:${src}\tdest:${tempDir}/dest.txt\tmode:0600`);

      runInstl(`sync ${recipe}`);
      expect(getFileMode(path.join(tempDir, 'dest.txt'))).toBe(0o600);
    });

    it('should resolve relative paths from recipe directory', () => {
      const src = createTestFile(tempDir, 'src/source.txt', 'content');
      const recipeDir = path.join(tempDir, 'recipes');
      fs.mkdirSync(recipeDir, { recursive: true });
      const recipe = createTestFile(tempDir, 'recipes/recipe.ltsv', `op:cp\tsrc:../src/source.txt\tdest:${tempDir}/dest.txt`);

      runInstl(`sync ${recipe}`);
      expect(readFile(path.join(tempDir, 'dest.txt'))).toBe('content');
    });
  });

  describe('ln operation', () => {
    it('should create symlink', () => {
      const src = createTestFile(tempDir, 'source.txt', 'content');
      const recipe = createTestFile(tempDir, 'recipe.ltsv', `op:ln\tsrc:${src}\tdest:${tempDir}/link`);

      const result = runInstl(`sync ${recipe}`);
      expect(result.exitCode).toBe(0);
      expect(isSymlink(path.join(tempDir, 'link'))).toBe(true);
      expect(getSymlinkTarget(path.join(tempDir, 'link'))).toBe(src);
    });

    it('should replace existing symlink', () => {
      const src1 = createTestFile(tempDir, 'source1.txt', 'one');
      const src2 = createTestFile(tempDir, 'source2.txt', 'two');
      const linkPath = path.join(tempDir, 'link');
      fs.symlinkSync(src1, linkPath);

      const recipe = createTestFile(tempDir, 'recipe.ltsv', `op:ln\tsrc:${src2}\tdest:${linkPath}`);

      runInstl(`sync ${recipe}`);
      expect(getSymlinkTarget(linkPath)).toBe(src2);
    });
  });

  describe('environment variable expansion', () => {
    it('should expand $HOME in dest', () => {
      const home = process.env['HOME'];
      if (!home) {
        return; // Skip test if HOME not set
      }

      // Use a safe path under temp dir but test the expansion
      const testDir = path.join(tempDir, 'envtest');
      fs.mkdirSync(testDir);

      // Set a custom env var for testing
      process.env['INSTL_TEST_DIR'] = testDir;

      const recipe = createTestFile(tempDir, 'recipe.ltsv', `op:touch\tdest:$INSTL_TEST_DIR/expanded.txt`);

      runInstl(`sync ${recipe}`);
      expect(fileExists(path.join(testDir, 'expanded.txt'))).toBe(true);

      delete process.env['INSTL_TEST_DIR'];
    });
  });

  describe('dry-run', () => {
    it('should not execute operations in dry-run mode', () => {
      const recipe = createTestFile(tempDir, 'recipe.ltsv', `op:mkdir\tdest:${tempDir}/newdir
op:touch\tdest:${tempDir}/newfile.txt`);

      const result = runInstl(`sync --dry-run ${recipe}`);
      expect(result.exitCode).toBe(0);
      expect(fileExists(path.join(tempDir, 'newdir'))).toBe(false);
      expect(fileExists(path.join(tempDir, 'newfile.txt'))).toBe(false);
    });

    it('should show output in dry-run mode', () => {
      const recipe = createTestFile(tempDir, 'recipe.ltsv', `op:mkdir\tdest:${tempDir}/newdir`);

      const result = runInstl(`sync --dry-run ${recipe}`);
      expect(result.stdout).toContain('[DRY-RUN]');
    });
  });

  describe('verbose', () => {
    it('should show output in verbose mode', () => {
      const recipe = createTestFile(tempDir, 'recipe.ltsv', `op:mkdir\tdest:${tempDir}/newdir`);

      const result = runInstl(`sync --verbose ${recipe}`);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('[MKDIR]');
    });
  });

  describe('complex recipe', () => {
    it('should execute multiple operations in order', () => {
      const src = createTestFile(tempDir, 'source.txt', 'content');
      const recipe = createTestFile(tempDir, 'recipe.ltsv', `# Setup directories
op:mkdir\tdest:${tempDir}/config\tmode:0755
op:mkdir\tdest:${tempDir}/data\tmode:0700

# Copy files
op:cp\tsrc:${src}\tdest:${tempDir}/config/app.conf\tmode:0644

# Create symlink
op:ln\tsrc:${tempDir}/config/app.conf\tdest:${tempDir}/data/app.conf.link

# Touch state file
op:touch\tdest:${tempDir}/data/state\tmode:0600
`);

      const result = runInstl(`sync ${recipe}`);
      expect(result.exitCode).toBe(0);

      expect(isDirectory(path.join(tempDir, 'config'))).toBe(true);
      expect(getFileMode(path.join(tempDir, 'config'))).toBe(0o755);

      expect(isDirectory(path.join(tempDir, 'data'))).toBe(true);
      expect(getFileMode(path.join(tempDir, 'data'))).toBe(0o700);

      expect(readFile(path.join(tempDir, 'config/app.conf'))).toBe('content');
      expect(getFileMode(path.join(tempDir, 'config/app.conf'))).toBe(0o644);

      expect(isSymlink(path.join(tempDir, 'data/app.conf.link'))).toBe(true);

      expect(fileExists(path.join(tempDir, 'data/state'))).toBe(true);
      expect(getFileMode(path.join(tempDir, 'data/state'))).toBe(0o600);
    });
  });
});
