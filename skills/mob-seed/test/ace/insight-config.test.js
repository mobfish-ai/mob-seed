'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  ACE_DIRS,
  expandTilde,
  loadConfigFile,
  getOutputDir,
  getInsightsDir,
  getAllOutputDirs,
  ensureDir,
  ensureInsightsDir,
  getInsightConfig,
  isValidSourceType
} = require('../../lib/ace/insight-config');

describe('insight-config', () => {
  let tempDir;
  let originalEnv;

  beforeEach(() => {
    // Create temp directory for tests
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insight-config-test-'));
    // Save original env
    originalEnv = { ...process.env };
    // Clean env vars
    delete process.env.ACE_OUTPUT_DIR;
    delete process.env.INSIGHTS_OUTPUT_DIR;
    delete process.env.OBSERVATIONS_OUTPUT_DIR;
    delete process.env.REFLECTIONS_OUTPUT_DIR;
    delete process.env.LEARNING_OUTPUT_DIR;
  });

  afterEach(() => {
    // Restore env
    process.env = originalEnv;
    // Cleanup temp dir
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('expandTilde', () => {
    it('should expand ~ to home directory', () => {
      const result = expandTilde('~/test/path');
      assert.strictEqual(result, path.join(os.homedir(), 'test/path'));
    });

    it('should expand ~ alone to home directory', () => {
      const result = expandTilde('~');
      assert.strictEqual(result, os.homedir());
    });

    it('should not modify paths without ~', () => {
      const result = expandTilde('/absolute/path');
      assert.strictEqual(result, '/absolute/path');
    });

    it('should not modify relative paths', () => {
      const result = expandTilde('relative/path');
      assert.strictEqual(result, 'relative/path');
    });

    it('should return null/undefined as-is', () => {
      assert.strictEqual(expandTilde(null), null);
      assert.strictEqual(expandTilde(undefined), undefined);
    });
  });

  describe('loadConfigFile', () => {
    it('should load valid JSON config', () => {
      const configPath = path.join(tempDir, 'config.json');
      fs.writeFileSync(configPath, JSON.stringify({ test: 'value' }));

      const result = loadConfigFile(configPath);
      assert.deepStrictEqual(result, { test: 'value' });
    });

    it('should return null for non-existent file', () => {
      const result = loadConfigFile(path.join(tempDir, 'nonexistent.json'));
      assert.strictEqual(result, null);
    });

    it('should return null for invalid JSON', () => {
      const configPath = path.join(tempDir, 'invalid.json');
      fs.writeFileSync(configPath, 'not valid json');

      const result = loadConfigFile(configPath);
      assert.strictEqual(result, null);
    });
  });

  describe('getOutputDir', () => {
    it('should return default path when no config', () => {
      const result = getOutputDir(tempDir, 'insights');
      assert.strictEqual(result, path.join(tempDir, '.seed', 'insights'));
    });

    it('should throw for invalid directory type', () => {
      assert.throws(() => {
        getOutputDir(tempDir, 'invalid');
      }, /Invalid ACE directory type/);
    });

    it('should use specific environment variable first', () => {
      const customPath = '/custom/insights/path';
      const result = getOutputDir(tempDir, 'insights', {
        env: { INSIGHTS_OUTPUT_DIR: customPath }
      });
      assert.strictEqual(result, customPath);
    });

    it('should use ACE_OUTPUT_DIR and append dir type', () => {
      const result = getOutputDir(tempDir, 'insights', {
        env: { ACE_OUTPUT_DIR: '/ace/output' }
      });
      assert.strictEqual(result, '/ace/output/insights');
    });

    it('should expand tilde in environment variable', () => {
      const result = getOutputDir(tempDir, 'insights', {
        env: { ACE_OUTPUT_DIR: '~/knowledge' }
      });
      assert.strictEqual(result, path.join(os.homedir(), 'knowledge', 'insights'));
    });

    it('should use config.local.json over config.json', () => {
      // Create .seed directory
      const seedDir = path.join(tempDir, '.seed');
      fs.mkdirSync(seedDir, { recursive: true });

      // Create config.json
      fs.writeFileSync(
        path.join(seedDir, 'config.json'),
        JSON.stringify({ ace: { output_dir: '/from/config' } })
      );

      // Create config.local.json
      fs.writeFileSync(
        path.join(seedDir, 'config.local.json'),
        JSON.stringify({ ace: { output_dir: '/from/local' } })
      );

      const result = getOutputDir(tempDir, 'insights', { env: {} });
      assert.strictEqual(result, '/from/local/insights');
    });

    it('should use specific dir config over output_dir', () => {
      const seedDir = path.join(tempDir, '.seed');
      fs.mkdirSync(seedDir, { recursive: true });

      fs.writeFileSync(
        path.join(seedDir, 'config.local.json'),
        JSON.stringify({
          ace: {
            output_dir: '/unified',
            insights_dir: '/specific/insights'
          }
        })
      );

      const result = getOutputDir(tempDir, 'insights', { env: {} });
      assert.strictEqual(result, '/specific/insights');
    });

    it('should expand tilde in config paths', () => {
      const seedDir = path.join(tempDir, '.seed');
      fs.mkdirSync(seedDir, { recursive: true });

      fs.writeFileSync(
        path.join(seedDir, 'config.json'),
        JSON.stringify({ ace: { output_dir: '~/knowledge/project' } })
      );

      const result = getOutputDir(tempDir, 'insights', { env: {} });
      assert.strictEqual(result, path.join(os.homedir(), 'knowledge/project', 'insights'));
    });
  });

  describe('getInsightsDir', () => {
    it('should return insights directory path', () => {
      const result = getInsightsDir(tempDir);
      assert.strictEqual(result, path.join(tempDir, '.seed', 'insights'));
    });
  });

  describe('getAllOutputDirs', () => {
    it('should return all ACE directory paths', () => {
      const result = getAllOutputDirs(tempDir);

      assert.strictEqual(result.observations, path.join(tempDir, '.seed', 'observations'));
      assert.strictEqual(result.reflections, path.join(tempDir, '.seed', 'reflections'));
      assert.strictEqual(result.insights, path.join(tempDir, '.seed', 'insights'));
      assert.strictEqual(result.learning, path.join(tempDir, '.seed', 'learning'));
    });
  });

  describe('ensureDir', () => {
    it('should create directory if not exists', () => {
      const dirPath = path.join(tempDir, 'new', 'nested', 'dir');
      const result = ensureDir(dirPath);

      assert.strictEqual(result, true);
      assert.strictEqual(fs.existsSync(dirPath), true);
    });

    it('should return true if directory already exists', () => {
      const dirPath = path.join(tempDir, 'existing');
      fs.mkdirSync(dirPath);

      const result = ensureDir(dirPath);
      assert.strictEqual(result, true);
    });
  });

  describe('ensureInsightsDir', () => {
    it('should create insights directory if not exists', () => {
      const result = ensureInsightsDir(tempDir);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.isSymlink, false);
      assert.strictEqual(fs.existsSync(result.path), true);
    });

    it('should detect symlink and verify target exists', () => {
      // Create target directory
      const targetDir = path.join(tempDir, 'external', 'insights');
      fs.mkdirSync(targetDir, { recursive: true });

      // Create .seed directory with symlink
      const seedDir = path.join(tempDir, '.seed');
      fs.mkdirSync(seedDir, { recursive: true });
      const symlinkPath = path.join(seedDir, 'insights');
      fs.symlinkSync(targetDir, symlinkPath);

      const result = ensureInsightsDir(tempDir, { env: {} });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.isSymlink, true);
      assert.strictEqual(result.target, targetDir);
    });

    it('should report error when symlink target does not exist', () => {
      // Create .seed directory with broken symlink
      const seedDir = path.join(tempDir, '.seed');
      fs.mkdirSync(seedDir, { recursive: true });
      const symlinkPath = path.join(seedDir, 'insights');
      fs.symlinkSync('/nonexistent/path', symlinkPath);

      const result = ensureInsightsDir(tempDir, { env: {} });

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.isSymlink, true);
      assert.ok(result.error.includes('Symlink target does not exist'));
    });
  });

  describe('getInsightConfig', () => {
    it('should return default config when no config files', () => {
      const result = getInsightConfig(tempDir);

      assert.strictEqual(result.enabled, true);
      assert.ok(Array.isArray(result.source_types));
      assert.ok(result.source_types.includes('expert_opinion'));
      assert.strictEqual(result.auto_review_on_model_upgrade, true);
      assert.strictEqual(result.review_interval_days, 90);
    });

    it('should merge config.json values', () => {
      const seedDir = path.join(tempDir, '.seed');
      fs.mkdirSync(seedDir, { recursive: true });

      fs.writeFileSync(
        path.join(seedDir, 'config.json'),
        JSON.stringify({
          insights: {
            review_interval_days: 30
          }
        })
      );

      const result = getInsightConfig(tempDir);
      assert.strictEqual(result.review_interval_days, 30);
      assert.strictEqual(result.enabled, true); // Still has default
    });

    it('should prefer config.local.json over config.json', () => {
      const seedDir = path.join(tempDir, '.seed');
      fs.mkdirSync(seedDir, { recursive: true });

      fs.writeFileSync(
        path.join(seedDir, 'config.json'),
        JSON.stringify({
          insights: { review_interval_days: 30 }
        })
      );

      fs.writeFileSync(
        path.join(seedDir, 'config.local.json'),
        JSON.stringify({
          insights: { review_interval_days: 60 }
        })
      );

      const result = getInsightConfig(tempDir);
      assert.strictEqual(result.review_interval_days, 60);
    });
  });

  describe('isValidSourceType', () => {
    it('should return true for valid source types', () => {
      assert.strictEqual(isValidSourceType('expert_opinion', tempDir), true);
      assert.strictEqual(isValidSourceType('paper', tempDir), true);
      assert.strictEqual(isValidSourceType('blog', tempDir), true);
    });

    it('should return false for invalid source types', () => {
      assert.strictEqual(isValidSourceType('invalid_type', tempDir), false);
      assert.strictEqual(isValidSourceType('', tempDir), false);
    });
  });

  describe('ACE_DIRS constant', () => {
    it('should contain all ACE directory types', () => {
      assert.deepStrictEqual(ACE_DIRS, ['observations', 'reflections', 'insights', 'learning']);
    });
  });
});
