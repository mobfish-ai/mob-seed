/**
 * cache-updater 模块测试
 */
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  hashFile,
  loadCache,
  saveCache,
  updateCache
} = require('../../lib/hooks/cache-updater');

describe('Cache Updater Module', () => {
  let testDir;
  let originalCwd;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-updater-test-'));
    originalCwd = process.cwd();
    process.chdir(testDir);
    fs.mkdirSync('.seed', { recursive: true });
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('hashFile', () => {
    it('should return prefixed SHA256 hash for existing file', () => {
      const testFile = 'test.js';
      fs.writeFileSync(testFile, 'console.log("hello")');

      const hash = hashFile(testFile);

      assert.ok(hash);
      assert.ok(hash.startsWith('sha256:'));
      assert.strictEqual(hash.length, 7 + 16); // 'sha256:' + 16 hex chars
    });

    it('should return null for non-existent file', () => {
      const hash = hashFile('non-existent.js');

      assert.strictEqual(hash, null);
    });

    it('should return same hash for same content', () => {
      fs.writeFileSync('file1.js', 'same content');
      fs.writeFileSync('file2.js', 'same content');

      const hash1 = hashFile('file1.js');
      const hash2 = hashFile('file2.js');

      assert.strictEqual(hash1, hash2);
    });
  });

  describe('loadCache', () => {
    it('should return default cache when file does not exist', () => {
      const cache = loadCache();

      assert.deepStrictEqual(cache, { version: '1.0.0', entries: {} });
    });

    it('should load existing cache file', () => {
      const testCache = {
        version: '1.0.0',
        entries: {
          'test.fspec.md': { specHash: 'sha256:abc123', checkedAt: '2024-01-01T00:00:00Z' }
        }
      };
      fs.writeFileSync('.seed/check-cache.json', JSON.stringify(testCache));

      const cache = loadCache();

      assert.deepStrictEqual(cache, testCache);
    });
  });

  describe('saveCache', () => {
    it('should save cache to file', () => {
      const testCache = {
        version: '1.0.0',
        entries: { 'test.js': { specHash: 'sha256:abc' } }
      };

      saveCache(testCache);

      const saved = JSON.parse(fs.readFileSync('.seed/check-cache.json', 'utf8'));
      assert.deepStrictEqual(saved, testCache);
    });

    it('should format JSON with indentation', () => {
      const testCache = { version: '1.0.0', entries: {} };

      saveCache(testCache);

      const content = fs.readFileSync('.seed/check-cache.json', 'utf8');
      assert.ok(content.includes('\n')); // Has newlines (formatted)
    });
  });

  describe('updateCache', () => {
    it('should update cache for spec file', () => {
      const specFile = 'test.fspec.md';
      fs.writeFileSync(specFile, '# Test Spec\n## Functional Requirements');

      updateCache(specFile);

      const cache = loadCache();
      assert.ok(cache.entries[specFile]);
      assert.ok(cache.entries[specFile].specHash);
      assert.ok(cache.entries[specFile].checkedAt);
      assert.deepStrictEqual(cache.entries[specFile].result, {
        syncStatus: 'pass',
        principleScore: 1.0,
        antiGoalViolations: []
      });
    });

    it('should update cache for code file', () => {
      // First create a spec entry
      const specFile = 'test.fspec.md';
      fs.writeFileSync(specFile, '# Test Spec');
      updateCache(specFile);

      // Then update with code file
      const codeFile = 'test.js';
      fs.writeFileSync(codeFile, 'console.log("test")');
      updateCache(codeFile);

      const cache = loadCache();
      // Code file should be added to codeHashes of existing spec entries
      assert.ok(cache.entries[specFile].codeHashes);
      assert.ok(cache.entries[specFile].codeHashes[codeFile]);
    });

    it('should accept custom result', () => {
      const specFile = 'test.fspec.md';
      fs.writeFileSync(specFile, '# Test Spec');
      const customResult = {
        syncStatus: 'fail',
        principleScore: 0.5,
        antiGoalViolations: ['feature_creep']
      };

      updateCache(specFile, customResult);

      const cache = loadCache();
      assert.deepStrictEqual(cache.entries[specFile].result, customResult);
    });

    it('should handle multiple files', () => {
      fs.writeFileSync('spec1.fspec.md', '# Spec 1');
      fs.writeFileSync('spec2.fspec.md', '# Spec 2');

      updateCache('spec1.fspec.md\nspec2.fspec.md');

      const cache = loadCache();
      assert.ok(cache.entries['spec1.fspec.md']);
      assert.ok(cache.entries['spec2.fspec.md']);
    });

    it('should skip files that cannot be read', () => {
      // Try to update with non-existent file
      updateCache('non-existent.fspec.md');

      const cache = loadCache();
      assert.ok(!cache.entries['non-existent.fspec.md']);
    });

    it('should update checkedAt timestamp', () => {
      const specFile = 'test.fspec.md';
      fs.writeFileSync(specFile, '# Test Spec');

      const before = new Date();
      updateCache(specFile);
      const after = new Date();

      const cache = loadCache();
      const checkedAt = new Date(cache.entries[specFile].checkedAt);
      assert.ok(checkedAt >= before);
      assert.ok(checkedAt <= after);
    });
  });
});
