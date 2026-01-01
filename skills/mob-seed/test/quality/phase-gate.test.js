/**
 * phase-gate 测试
 * @see openspec/changes/v2.0-seed-complete/specs/quality/phase-gate.fspec.md
 */

'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const {
  executeGate,
  executeRule,
  validateFileExists,
  validateFileContent,
  validateCommandSuccess,
  combineRules,
  registerGate,
  getGateConfig,
  RULE_TYPES,
  DEFAULT_GATES
} = require('../../lib/quality/phase-gate.js');

describe('phase-gate', () => {
  const testDir = '/tmp/phase-gate-test';

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  // =============================================================
  // Constants
  // =============================================================

  describe('RULE_TYPES', () => {
    it('should define FILE_EXISTS type', () => {
      assert.strictEqual(RULE_TYPES.FILE_EXISTS, 'file_exists');
    });

    it('should define FILE_CONTENT type', () => {
      assert.strictEqual(RULE_TYPES.FILE_CONTENT, 'file_content');
    });

    it('should define COMMAND_SUCCESS type', () => {
      assert.strictEqual(RULE_TYPES.COMMAND_SUCCESS, 'command_success');
    });

    it('should define METRIC_THRESHOLD type', () => {
      assert.strictEqual(RULE_TYPES.METRIC_THRESHOLD, 'metric_threshold');
    });

    it('should define HUMAN_APPROVAL type', () => {
      assert.strictEqual(RULE_TYPES.HUMAN_APPROVAL, 'human_approval');
    });
  });

  describe('DEFAULT_GATES', () => {
    it('should define gate-analysis', () => {
      assert.ok(DEFAULT_GATES['gate-analysis']);
    });

    it('should define gate-design', () => {
      assert.ok(DEFAULT_GATES['gate-design']);
    });

    it('should define gate-implement', () => {
      assert.ok(DEFAULT_GATES['gate-implement']);
    });

    it('should define gate-test', () => {
      assert.ok(DEFAULT_GATES['gate-test']);
    });
  });

  // =============================================================
  // REQ-002: 验证规则引擎
  // =============================================================

  describe('validateFileExists', () => {
    it('should return passed for existing file', () => {
      const filePath = path.join(testDir, 'exists.txt');
      fs.writeFileSync(filePath, 'content');

      const result = validateFileExists(filePath);
      assert.strictEqual(result.passed, true);
    });

    it('should return failed for missing file', () => {
      const filePath = path.join(testDir, 'missing.txt');

      const result = validateFileExists(filePath);
      assert.strictEqual(result.passed, false);
    });

    it('should include message in result', () => {
      const filePath = path.join(testDir, 'test.txt');
      const result = validateFileExists(filePath);
      assert.ok(typeof result.message === 'string');
    });
  });

  describe('validateFileContent', () => {
    it('should return passed when pattern matches', () => {
      const filePath = path.join(testDir, 'content.md');
      fs.writeFileSync(filePath, '## 技术方案\n内容');

      const result = validateFileContent(filePath, /## 技术方案/);
      assert.strictEqual(result.passed, true);
    });

    it('should return failed when pattern not found', () => {
      const filePath = path.join(testDir, 'content.md');
      fs.writeFileSync(filePath, '没有匹配内容');

      const result = validateFileContent(filePath, /## 技术方案/);
      assert.strictEqual(result.passed, false);
    });

    it('should return failed for missing file', () => {
      const result = validateFileContent('/nonexistent/file.md', /pattern/);
      assert.strictEqual(result.passed, false);
    });
  });

  describe('validateCommandSuccess', () => {
    it('should return passed for successful command', async () => {
      const result = await validateCommandSuccess('echo hello');
      assert.strictEqual(result.passed, true);
    });

    it('should return failed for failed command', async () => {
      const result = await validateCommandSuccess('exit 1');
      assert.strictEqual(result.passed, false);
    });

    it('should include output in result', async () => {
      const result = await validateCommandSuccess('echo test');
      assert.ok(result.output !== undefined);
    });
  });

  describe('executeRule', () => {
    it('should execute file_exists rule', async () => {
      const filePath = path.join(testDir, 'rule-test.txt');
      fs.writeFileSync(filePath, 'content');

      const result = await executeRule({
        type: 'file_exists',
        path: filePath
      });

      assert.strictEqual(result.passed, true);
    });

    it('should execute file_content rule', async () => {
      const filePath = path.join(testDir, 'rule-content.md');
      fs.writeFileSync(filePath, 'Hello World');

      const result = await executeRule({
        type: 'file_content',
        path: filePath,
        pattern: 'Hello'
      });

      assert.strictEqual(result.passed, true);
    });

    it('should execute command_success rule', async () => {
      const result = await executeRule({
        type: 'command_success',
        cmd: 'echo success'
      });

      assert.strictEqual(result.passed, true);
    });

    it('should handle unknown rule type', async () => {
      const result = await executeRule({
        type: 'unknown_type'
      });

      assert.strictEqual(result.passed, false);
    });
  });

  // =============================================================
  // REQ-002 AC-005: 规则可组合
  // =============================================================

  describe('combineRules', () => {
    it('should return passed when all AND rules pass', async () => {
      const filePath = path.join(testDir, 'combine.txt');
      fs.writeFileSync(filePath, 'content');

      const rules = [
        { type: 'file_exists', path: filePath },
        { type: 'command_success', cmd: 'echo ok' }
      ];

      const result = await combineRules(rules, 'and', {});
      assert.strictEqual(result.passed, true);
    });

    it('should return failed when any AND rule fails', async () => {
      const rules = [
        { type: 'file_exists', path: '/nonexistent' },
        { type: 'command_success', cmd: 'echo ok' }
      ];

      const result = await combineRules(rules, 'and', {});
      assert.strictEqual(result.passed, false);
    });

    it('should return passed when any OR rule passes', async () => {
      const rules = [
        { type: 'file_exists', path: '/nonexistent' },
        { type: 'command_success', cmd: 'echo ok' }
      ];

      const result = await combineRules(rules, 'or', {});
      assert.strictEqual(result.passed, true);
    });

    it('should return failed when all OR rules fail', async () => {
      const rules = [
        { type: 'file_exists', path: '/nonexistent1' },
        { type: 'file_exists', path: '/nonexistent2' }
      ];

      const result = await combineRules(rules, 'or', {});
      assert.strictEqual(result.passed, false);
    });
  });

  // =============================================================
  // REQ-001 AC-003: 支持自定义门禁
  // =============================================================

  describe('registerGate / getGateConfig', () => {
    it('should register custom gate', () => {
      registerGate('custom-gate', {
        name: 'Custom Gate',
        rules: [{ type: 'file_exists', path: 'custom.txt' }]
      });

      const config = getGateConfig('custom-gate');
      assert.ok(config);
      assert.strictEqual(config.name, 'Custom Gate');
    });

    it('should get default gate config', () => {
      const config = getGateConfig('gate-analysis');
      assert.ok(config);
    });

    it('should return null for unknown gate', () => {
      const config = getGateConfig('unknown-gate');
      assert.strictEqual(config, null);
    });
  });

  // =============================================================
  // REQ-003: 门禁执行
  // =============================================================

  describe('executeGate', () => {
    it('should execute gate and return result', async () => {
      const filePath = path.join(testDir, 'tasks.md');
      fs.writeFileSync(filePath, '# Tasks');

      registerGate('test-gate', {
        name: 'Test Gate',
        rules: [{ type: 'file_exists', path: filePath }]
      });

      const result = await executeGate('test-gate', { baseDir: testDir });
      assert.ok(result);
      assert.ok(typeof result.passed === 'boolean');
    });

    it('should return passed when all rules pass', async () => {
      const filePath = path.join(testDir, 'all-pass.txt');
      fs.writeFileSync(filePath, 'content');

      registerGate('all-pass-gate', {
        name: 'All Pass Gate',
        rules: [
          { type: 'file_exists', path: filePath },
          { type: 'command_success', cmd: 'echo ok' }
        ]
      });

      const result = await executeGate('all-pass-gate');
      assert.strictEqual(result.passed, true);
    });

    it('should return failed when any rule fails', async () => {
      registerGate('fail-gate', {
        name: 'Fail Gate',
        rules: [
          { type: 'file_exists', path: '/nonexistent' }
        ]
      });

      const result = await executeGate('fail-gate');
      assert.strictEqual(result.passed, false);
    });

    it('should return failed for unknown gate', async () => {
      const result = await executeGate('nonexistent-gate');
      assert.strictEqual(result.passed, false);
    });

    it('should include rule results', async () => {
      const filePath = path.join(testDir, 'rules.txt');
      fs.writeFileSync(filePath, 'content');

      registerGate('results-gate', {
        name: 'Results Gate',
        rules: [{ type: 'file_exists', path: filePath }]
      });

      const result = await executeGate('results-gate');
      assert.ok(Array.isArray(result.results));
    });
  });
});
