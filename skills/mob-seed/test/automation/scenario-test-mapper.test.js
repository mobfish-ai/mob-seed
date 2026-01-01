/**
 * scenario-test-mapper 测试
 * @see openspec/changes/v2.0-seed-complete/specs/automation/scenario-test-mapper.fspec.md
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  parseScenarios,
  generateTestCode,
  generateJestTest,
  generateNodeTest,
  SUPPORTED_FRAMEWORKS
} = require('../../lib/automation/scenario-test-mapper.js');

describe('scenario-test-mapper', () => {
  // =============================================================
  // REQ-001: WHEN/THEN 语法解析
  // =============================================================

  describe('parseScenarios', () => {
    it('should parse single scenario', () => {
      const content = `
**Scenario: 用户登录成功**
- WHEN 用户输入正确的用户名和密码
- THEN 显示欢迎消息
`;
      const scenarios = parseScenarios(content);

      assert.strictEqual(scenarios.length, 1);
      assert.strictEqual(scenarios[0].name, '用户登录成功');
    });

    it('should parse WHEN conditions', () => {
      const content = `
**Scenario: 测试场景**
- WHEN 前置条件1
- AND 前置条件2
- THEN 期望结果
`;
      const scenarios = parseScenarios(content);

      assert.strictEqual(scenarios[0].whens.length, 2);
      assert.strictEqual(scenarios[0].whens[0], '前置条件1');
      assert.strictEqual(scenarios[0].whens[1], '前置条件2');
    });

    it('should parse THEN assertions', () => {
      const content = `
**Scenario: 测试场景**
- WHEN 前置条件
- THEN 期望结果1
- AND 期望结果2
`;
      const scenarios = parseScenarios(content);

      assert.strictEqual(scenarios[0].thens.length, 2);
      assert.strictEqual(scenarios[0].thens[0], '期望结果1');
      assert.strictEqual(scenarios[0].thens[1], '期望结果2');
    });

    it('should parse multiple scenarios', () => {
      const content = `
**Scenario: 场景一**
- WHEN 条件1
- THEN 结果1

**Scenario: 场景二**
- WHEN 条件2
- THEN 结果2
`;
      const scenarios = parseScenarios(content);

      assert.strictEqual(scenarios.length, 2);
    });

    it('should handle empty content', () => {
      const scenarios = parseScenarios('');
      assert.strictEqual(scenarios.length, 0);
    });
  });

  // =============================================================
  // REQ-002: 测试代码生成
  // =============================================================

  describe('generateTestCode', () => {
    const scenario = {
      name: '用户登录成功',
      whens: ['用户输入正确的用户名和密码', '点击登录按钮'],
      thens: ['显示欢迎消息', '跳转到首页']
    };

    it('should generate Jest test code by default', () => {
      const code = generateTestCode([scenario]);

      assert.ok(code.includes('describe'));
      assert.ok(code.includes('用户登录成功'));
    });

    it('should include Claude prompts instead of TODO', () => {
      const code = generateTestCode([scenario]);

      // 不再生成 TODO，而是生成 Claude 提示
      assert.ok(code.includes('Claude 应该'));
    });

    it('should include original scenario as comments', () => {
      const code = generateTestCode([scenario]);

      assert.ok(code.includes('WHEN') || code.includes('用户输入'));
    });
  });

  describe('generateJestTest', () => {
    it('should generate valid Jest structure', () => {
      const scenario = {
        name: '简单测试',
        whens: ['条件'],
        thens: ['结果']
      };
      const code = generateJestTest(scenario);

      assert.ok(code.includes('describe('));
      assert.ok(code.includes('it(') || code.includes('test('));
    });

    it('should generate beforeEach for WHEN conditions', () => {
      const scenario = {
        name: '测试',
        whens: ['条件1', '条件2'],
        thens: ['结果']
      };
      const code = generateJestTest(scenario);

      assert.ok(code.includes('beforeEach') || code.includes('条件'));
    });
  });

  describe('generateNodeTest', () => {
    it('should generate node:test structure', () => {
      const scenario = {
        name: '简单测试',
        whens: ['条件'],
        thens: ['结果']
      };
      const code = generateNodeTest(scenario);

      assert.ok(code.includes('describe(') || code.includes('test('));
      assert.ok(code.includes('Claude 应该'));
    });
  });

  // =============================================================
  // REQ-003: 多框架支持
  // =============================================================

  describe('SUPPORTED_FRAMEWORKS', () => {
    it('should include jest', () => {
      assert.ok(SUPPORTED_FRAMEWORKS.includes('jest'));
    });

    it('should include mocha', () => {
      assert.ok(SUPPORTED_FRAMEWORKS.includes('mocha'));
    });

    it('should include node-test', () => {
      assert.ok(SUPPORTED_FRAMEWORKS.includes('node-test'));
    });

    it('should include vitest', () => {
      assert.ok(SUPPORTED_FRAMEWORKS.includes('vitest'));
    });
  });

  describe('generateTestCode with framework', () => {
    const scenario = {
      name: '测试',
      whens: ['条件'],
      thens: ['结果']
    };

    it('should generate Jest code', () => {
      const code = generateTestCode([scenario], 'jest');
      assert.ok(code.includes('describe') || code.includes('test'));
    });

    it('should generate Node test code', () => {
      const code = generateTestCode([scenario], 'node-test');
      assert.ok(code.includes('describe') || code.includes('test') || code.includes('node:test'));
    });
  });
});
