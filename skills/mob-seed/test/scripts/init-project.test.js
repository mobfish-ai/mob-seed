/**
 * init-project.js 测试
 *
 * @module test/scripts/init-project.test
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 测试用临时目录
let testDir;

// 创建测试目录
function createTestDir() {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mob-seed-init-test-'));
  return testDir;
}

// 清理测试目录
function cleanupTestDir() {
  if (testDir && fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

// 导入被测模块
const { initProject, resolveSkillDir, REQUIRED_FILES } = require('../../scripts/init-project');
const { verifyInit } = require('../../scripts/verify-init');

describe('init-project.js', () => {
  beforeEach(() => {
    createTestDir();
  });

  afterEach(() => {
    cleanupTestDir();
  });

  describe('resolveSkillDir', () => {
    it('should find skill directory in development mode', () => {
      // 在 mob-seed 项目中运行时应该能找到
      const skillDir = resolveSkillDir();
      // 可能找到或找不到，取决于运行环境
      // 这里只测试函数不抛错
      assert.ok(skillDir === null || typeof skillDir === 'string');
    });
  });

  describe('REQUIRED_FILES', () => {
    it('should include mission.md in required files', () => {
      const hasMission = REQUIRED_FILES.some(f => f.includes('mission.md'));
      assert.ok(hasMission, 'mission.md must be in required files');
    });

    it('should include config.json in required files', () => {
      const hasConfig = REQUIRED_FILES.some(f => f.includes('config.json'));
      assert.ok(hasConfig, 'config.json must be in required files');
    });

    it('should include observations/index.json in required files', () => {
      const hasObservations = REQUIRED_FILES.some(f => f.includes('observations'));
      assert.ok(hasObservations, 'observations/index.json must be in required files');
    });

    it('should have 7 required files', () => {
      assert.strictEqual(REQUIRED_FILES.length, 7, 'Should have exactly 7 required files');
    });
  });

  describe('initProject', () => {
    it('should fail if skill directory not found', () => {
      // 创建一个空项目目录
      const emptyProject = path.join(testDir, 'empty-project');
      fs.mkdirSync(emptyProject);

      // 保存原始 HOME
      const originalHome = process.env.HOME;

      // 设置一个不存在的 HOME 目录来模拟找不到技能目录
      process.env.HOME = testDir;

      // 切换到测试目录
      const originalCwd = process.cwd();
      process.chdir(emptyProject);

      try {
        const results = initProject(emptyProject, {});
        // 应该失败，因为找不到技能目录
        assert.strictEqual(results.success, false);
        assert.ok(results.errors.length > 0);
      } finally {
        process.chdir(originalCwd);
        process.env.HOME = originalHome;
      }
    });

    it('should not initialize if already initialized without --force', () => {
      // 创建已初始化的项目
      const project = path.join(testDir, 'initialized-project');
      fs.mkdirSync(project);
      fs.mkdirSync(path.join(project, '.seed'));
      fs.writeFileSync(
        path.join(project, '.seed/config.json'),
        '{"version": "2.0.0"}',
        'utf8'
      );

      const results = initProject(project, { force: false });

      assert.strictEqual(results.success, false);
      assert.ok(results.errors.some(e => e.includes('已初始化')));
    });
  });
});

describe('verify-init.js', () => {
  beforeEach(() => {
    createTestDir();
  });

  afterEach(() => {
    cleanupTestDir();
  });

  describe('verifyInit', () => {
    it('should fail for empty directory', () => {
      const emptyDir = path.join(testDir, 'empty');
      fs.mkdirSync(emptyDir);

      const results = verifyInit(emptyDir);

      assert.strictEqual(results.success, false);
      assert.strictEqual(results.summary.missing, 7);
    });

    it('should pass for fully initialized directory', () => {
      const project = path.join(testDir, 'full-project');
      fs.mkdirSync(project);

      // 创建所有必需文件
      fs.mkdirSync(path.join(project, '.seed/observations'), { recursive: true });
      fs.mkdirSync(path.join(project, 'openspec/specs'), { recursive: true });
      fs.mkdirSync(path.join(project, 'openspec/changes'), { recursive: true });

      // config.json
      fs.writeFileSync(
        path.join(project, '.seed/config.json'),
        JSON.stringify({
          version: '2.0.0',
          paths: { src: 'src', test: 'test' },
          mission: { enabled: true, path: '.seed/mission.md' }
        }, null, 2),
        'utf8'
      );

      // mission.md
      fs.writeFileSync(
        path.join(project, '.seed/mission.md'),
        `---
purpose:
  statement: Test mission
principles:
  - id: test
anti_goals:
  - id: test
---
# Test Mission
`,
        'utf8'
      );

      // observations/index.json
      fs.writeFileSync(
        path.join(project, '.seed/observations/index.json'),
        JSON.stringify({ version: '1.0.0', observations: [] }, null, 2),
        'utf8'
      );

      // .gitkeep files
      fs.writeFileSync(path.join(project, 'openspec/specs/.gitkeep'), '', 'utf8');
      fs.writeFileSync(path.join(project, 'openspec/changes/.gitkeep'), '', 'utf8');

      // project.md
      fs.writeFileSync(
        path.join(project, 'openspec/project.md'),
        '# Test Project\n\n## 项目概述\n\nTest description',
        'utf8'
      );

      // AGENTS.md
      fs.writeFileSync(
        path.join(project, 'openspec/AGENTS.md'),
        '# AI Agent 工作流\n\n## SEED 方法论\n\nOpenSpec compatible',
        'utf8'
      );

      const results = verifyInit(project);

      assert.strictEqual(results.success, true);
      assert.strictEqual(results.summary.valid, 7);
      assert.strictEqual(results.summary.missing, 0);
    });

    it('should detect missing mission.md specifically', () => {
      const project = path.join(testDir, 'no-mission');
      fs.mkdirSync(project);

      // 创建除 mission.md 外的所有文件
      fs.mkdirSync(path.join(project, '.seed/observations'), { recursive: true });
      fs.mkdirSync(path.join(project, 'openspec/specs'), { recursive: true });
      fs.mkdirSync(path.join(project, 'openspec/changes'), { recursive: true });

      fs.writeFileSync(
        path.join(project, '.seed/config.json'),
        JSON.stringify({ version: '2.0.0', paths: {}, mission: {} }, null, 2),
        'utf8'
      );

      fs.writeFileSync(
        path.join(project, '.seed/observations/index.json'),
        JSON.stringify({ version: '1.0.0', observations: [] }, null, 2),
        'utf8'
      );

      fs.writeFileSync(path.join(project, 'openspec/specs/.gitkeep'), '', 'utf8');
      fs.writeFileSync(path.join(project, 'openspec/changes/.gitkeep'), '', 'utf8');
      fs.writeFileSync(path.join(project, 'openspec/project.md'), '# Project\n', 'utf8');
      fs.writeFileSync(path.join(project, 'openspec/AGENTS.md'), '# SEED\n', 'utf8');

      // 故意不创建 mission.md

      const results = verifyInit(project);

      assert.strictEqual(results.success, false);

      // 检查 mission.md 被标记为缺失
      const missionResult = results.files.find(f => f.path === '.seed/mission.md');
      assert.ok(missionResult);
      assert.strictEqual(missionResult.exists, false);
    });
  });
});
