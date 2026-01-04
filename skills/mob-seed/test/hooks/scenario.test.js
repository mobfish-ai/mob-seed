/**
 * Scenario Detection Module Tests
 *
 * 测试场景检测模块的核心功能
 */

const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

// 模块路径
const scenarioPath = path.join(__dirname, '../../lib/hooks/scenario.js');

describe('Scenario Detection Module', () => {
  let scenario;
  let tempDir;
  let originalCwd;
  let originalHome;

  beforeEach(() => {
    // 清除模块缓存以便每次测试重新加载
    delete require.cache[require.resolve(scenarioPath)];
    scenario = require(scenarioPath);

    // 保存原始环境
    originalCwd = process.cwd();
    originalHome = process.env.HOME;

    // 创建临时目录
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scenario-test-'));
  });

  afterEach(() => {
    // 恢复环境
    process.chdir(originalCwd);
    process.env.HOME = originalHome;
    delete process.env.SEED_PLUGIN_PATH;

    // 清理临时目录
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('SCENARIOS constants', () => {
    it('should define all five scenarios', () => {
      assert.ok(scenario.SCENARIOS.DOGFOODING);
      assert.ok(scenario.SCENARIOS.USER_ENV);
      assert.ok(scenario.SCENARIOS.USER_PLUGIN);
      assert.ok(scenario.SCENARIOS.COMPAT);
      assert.ok(scenario.SCENARIOS.MISSING);
    });

    it('should have correct scenario codes', () => {
      assert.strictEqual(scenario.SCENARIOS.DOGFOODING.code, 'dogfooding');
      assert.strictEqual(scenario.SCENARIOS.USER_ENV.code, 'user-env');
      assert.strictEqual(scenario.SCENARIOS.USER_PLUGIN.code, 'user-plugin');
      assert.strictEqual(scenario.SCENARIOS.COMPAT.code, 'compat');
      assert.strictEqual(scenario.SCENARIOS.MISSING.code, 'missing');
    });

    it('should have labels for all scenarios', () => {
      assert.ok(scenario.SCENARIOS.DOGFOODING.label.includes('开发模式'));
      assert.ok(scenario.SCENARIOS.USER_ENV.label.includes('用户项目'));
      assert.ok(scenario.SCENARIOS.USER_PLUGIN.label.includes('用户项目'));
      assert.ok(scenario.SCENARIOS.COMPAT.label.includes('兼容模式'));
      assert.ok(scenario.SCENARIOS.MISSING.label.includes('错误'));
    });
  });

  describe('detectScenario', () => {
    it('should detect dogfooding mode when skills/mob-seed/lib/hooks exists', () => {
      // 创建 dogfooding 目录结构
      const dogfoodingPath = path.join(tempDir, 'skills/mob-seed/lib/hooks');
      fs.mkdirSync(dogfoodingPath, { recursive: true });
      fs.writeFileSync(path.join(dogfoodingPath, 'quick-defender.js'), '');

      const result = scenario.detectScenario(tempDir);

      assert.strictEqual(result.scenario.code, 'dogfooding');
      assert.ok(result.pluginPath.includes('skills/mob-seed'));
    });

    it('should detect user-env mode when SEED_PLUGIN_PATH is set', () => {
      // 创建环境变量指定的路径
      const envPath = path.join(tempDir, 'custom-plugin');
      const hooksPath = path.join(envPath, 'lib/hooks');
      fs.mkdirSync(hooksPath, { recursive: true });
      fs.writeFileSync(path.join(hooksPath, 'quick-defender.js'), '');

      process.env.SEED_PLUGIN_PATH = envPath;

      const result = scenario.detectScenario(tempDir);

      assert.strictEqual(result.scenario.code, 'user-env');
      assert.strictEqual(result.pluginPath, envPath);
    });

    it('should detect compat mode when .seed/scripts exists', () => {
      // 创建兼容模式目录结构
      const compatPath = path.join(tempDir, '.seed/scripts');
      fs.mkdirSync(compatPath, { recursive: true });
      fs.writeFileSync(path.join(compatPath, 'quick-defender.js'), '');

      const result = scenario.detectScenario(tempDir);

      assert.strictEqual(result.scenario.code, 'compat');
    });

    it('should return MISSING when no paths found', () => {
      // 空目录，没有任何 hook 路径
      const emptyDir = path.join(tempDir, 'empty');
      fs.mkdirSync(emptyDir, { recursive: true });

      // 设置不存在的 HOME 以避免找到真实的插件目录
      process.env.HOME = emptyDir;

      const result = scenario.detectScenario(emptyDir);

      assert.strictEqual(result.scenario.code, 'missing');
      assert.strictEqual(result.pluginPath, null);
    });
  });

  describe('formatLabel', () => {
    it('should format dogfooding label with description', () => {
      const label = scenario.formatLabel(scenario.SCENARIOS.DOGFOODING);
      assert.ok(label.includes('[开发模式]'));
      assert.ok(label.includes('mob-seed dogfooding'));
    });

    it('should format user-env label', () => {
      const label = scenario.formatLabel(scenario.SCENARIOS.USER_ENV);
      assert.ok(label.includes('[用户项目]'));
      assert.ok(label.includes('环境变量配置'));
    });

    it('should format user-plugin label', () => {
      const label = scenario.formatLabel(scenario.SCENARIOS.USER_PLUGIN);
      assert.ok(label.includes('[用户项目]'));
      assert.ok(label.includes('Claude Code 插件'));
    });

    it('should format compat label', () => {
      const label = scenario.formatLabel(scenario.SCENARIOS.COMPAT);
      assert.ok(label.includes('[兼容模式]'));
    });

    it('should format missing label', () => {
      const label = scenario.formatLabel(scenario.SCENARIOS.MISSING);
      assert.ok(label.includes('[错误]'));
    });
  });

  describe('isDevelopment', () => {
    it('should return true for dogfooding scenario', () => {
      assert.strictEqual(scenario.isDevelopment(scenario.SCENARIOS.DOGFOODING), true);
    });

    it('should return false for user scenarios', () => {
      assert.strictEqual(scenario.isDevelopment(scenario.SCENARIOS.USER_ENV), false);
      assert.strictEqual(scenario.isDevelopment(scenario.SCENARIOS.USER_PLUGIN), false);
    });

    it('should return false for compat and missing', () => {
      assert.strictEqual(scenario.isDevelopment(scenario.SCENARIOS.COMPAT), false);
      assert.strictEqual(scenario.isDevelopment(scenario.SCENARIOS.MISSING), false);
    });
  });

  describe('isUserProject', () => {
    it('should return true for user-env scenario', () => {
      assert.strictEqual(scenario.isUserProject(scenario.SCENARIOS.USER_ENV), true);
    });

    it('should return true for user-plugin scenario', () => {
      assert.strictEqual(scenario.isUserProject(scenario.SCENARIOS.USER_PLUGIN), true);
    });

    it('should return false for dogfooding', () => {
      assert.strictEqual(scenario.isUserProject(scenario.SCENARIOS.DOGFOODING), false);
    });

    it('should return false for compat and missing', () => {
      assert.strictEqual(scenario.isUserProject(scenario.SCENARIOS.COMPAT), false);
      assert.strictEqual(scenario.isUserProject(scenario.SCENARIOS.MISSING), false);
    });
  });

  describe('Layer priority', () => {
    it('should prefer Layer 0 (env var) over Layer 1 (dogfooding)', () => {
      // 创建两个路径
      const envPath = path.join(tempDir, 'env-plugin');
      const dogfoodingPath = path.join(tempDir, 'skills/mob-seed/lib/hooks');

      fs.mkdirSync(path.join(envPath, 'lib/hooks'), { recursive: true });
      fs.writeFileSync(path.join(envPath, 'lib/hooks/quick-defender.js'), '');

      fs.mkdirSync(dogfoodingPath, { recursive: true });
      fs.writeFileSync(path.join(dogfoodingPath, 'quick-defender.js'), '');

      process.env.SEED_PLUGIN_PATH = envPath;

      const result = scenario.detectScenario(tempDir);

      // 环境变量应该优先于 dogfooding
      assert.strictEqual(result.scenario.code, 'user-env');
    });

    it('should prefer Layer 1 (dogfooding) over Layer 2 (compat)', () => {
      // 创建两个路径
      const dogfoodingPath = path.join(tempDir, 'skills/mob-seed/lib/hooks');
      const compatPath = path.join(tempDir, '.seed/scripts');

      fs.mkdirSync(dogfoodingPath, { recursive: true });
      fs.writeFileSync(path.join(dogfoodingPath, 'quick-defender.js'), '');

      fs.mkdirSync(compatPath, { recursive: true });
      fs.writeFileSync(path.join(compatPath, 'quick-defender.js'), '');

      const result = scenario.detectScenario(tempDir);

      // dogfooding 应该优先于 compat
      assert.strictEqual(result.scenario.code, 'dogfooding');
    });
  });
});
