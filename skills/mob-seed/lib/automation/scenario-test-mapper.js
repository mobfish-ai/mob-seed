/**
 * Scenario → Test Mapper (场景测试映射器)
 *
 * 从 fspec 文件中的 WHEN/THEN 场景描述自动生成测试代码骨架。
 *
 * @see openspec/changes/v2.0-seed-complete/specs/automation/scenario-test-mapper.fspec.md
 * @module lib/automation/scenario-test-mapper
 * @version 1.0.0
 */

'use strict';

/**
 * 支持的测试框架
 */
const SUPPORTED_FRAMEWORKS = ['jest', 'mocha', 'node-test', 'vitest'];

/**
 * 解析 WHEN/THEN 场景语法
 *
 * @see REQ-001 AC-001: 识别 **Scenario:** 标记
 * @see REQ-001 AC-002: 解析 WHEN/AND/THEN 行
 *
 * @param {string} content - fspec 文件内容
 * @returns {Array<Object>} 场景对象列表
 */
function parseScenarios(content) {
  if (!content || !content.trim()) {
    return [];
  }

  const scenarios = [];
  const lines = content.split('\n');

  let currentScenario = null;
  let lastKeyword = null; // 'WHEN' or 'THEN'

  for (const line of lines) {
    // 检测 Scenario 标记
    const scenarioMatch = line.match(/\*\*Scenario:\s*(.+?)\*\*/);
    if (scenarioMatch) {
      // 保存上一个场景
      if (currentScenario) {
        scenarios.push(currentScenario);
      }
      currentScenario = {
        name: scenarioMatch[1].trim(),
        whens: [],
        thens: []
      };
      lastKeyword = null;
      continue;
    }

    if (!currentScenario) continue;

    // 解析 WHEN 行
    const whenMatch = line.match(/^-\s*WHEN\s+(.+)$/);
    if (whenMatch) {
      currentScenario.whens.push(whenMatch[1].trim());
      lastKeyword = 'WHEN';
      continue;
    }

    // 解析 THEN 行
    const thenMatch = line.match(/^-\s*THEN\s+(.+)$/);
    if (thenMatch) {
      currentScenario.thens.push(thenMatch[1].trim());
      lastKeyword = 'THEN';
      continue;
    }

    // 解析 AND 行（根据上下文添加到 WHEN 或 THEN）
    const andMatch = line.match(/^-\s*AND\s+(.+)$/);
    if (andMatch) {
      if (lastKeyword === 'WHEN') {
        currentScenario.whens.push(andMatch[1].trim());
      } else if (lastKeyword === 'THEN') {
        currentScenario.thens.push(andMatch[1].trim());
      }
      continue;
    }
  }

  // 保存最后一个场景
  if (currentScenario) {
    scenarios.push(currentScenario);
  }

  return scenarios;
}

/**
 * 生成测试代码
 *
 * @see REQ-002: 测试代码生成
 *
 * @param {Array<Object>} scenarios - 场景列表
 * @param {string} framework - 测试框架 (jest/mocha/node-test/vitest)
 * @returns {string} 生成的测试代码
 */
function generateTestCode(scenarios, framework = 'jest') {
  if (!scenarios || scenarios.length === 0) {
    return '';
  }

  const parts = [];

  for (const scenario of scenarios) {
    switch (framework) {
      case 'node-test':
        parts.push(generateNodeTest(scenario));
        break;
      case 'mocha':
      case 'vitest':
      case 'jest':
      default:
        parts.push(generateJestTest(scenario));
        break;
    }
  }

  return parts.join('\n\n');
}

/**
 * 生成 Jest 测试代码
 *
 * @param {Object} scenario - 场景对象
 * @returns {string} Jest 测试代码
 */
function generateJestTest(scenario) {
  const lines = [];

  lines.push(`describe('${scenario.name}', () => {`);

  // 生成 beforeEach 用于 WHEN 条件
  if (scenario.whens && scenario.whens.length > 0) {
    lines.push('  beforeEach(() => {');
    for (const when of scenario.whens) {
      lines.push(`    // WHEN: ${when}`);
      lines.push(`    // TODO: 实现前置条件 - ${when}`);
    }
    lines.push('  });');
    lines.push('');
  }

  // 生成 test/it 用于 THEN 断言
  if (scenario.thens && scenario.thens.length > 0) {
    for (const then of scenario.thens) {
      lines.push(`  it('should ${then}', () => {`);
      lines.push(`    // THEN: ${then}`);
      lines.push(`    // TODO: 实现断言 - ${then}`);
      lines.push('  });');
    }
  } else {
    lines.push('  it(\'should pass\', () => {');
    lines.push('    // TODO: 添加断言');
    lines.push('  });');
  }

  lines.push('});');

  return lines.join('\n');
}

/**
 * 生成 Node.js test 代码
 *
 * @param {Object} scenario - 场景对象
 * @returns {string} Node.js test 代码
 */
function generateNodeTest(scenario) {
  const lines = [];

  lines.push(`describe('${scenario.name}', () => {`);

  // 生成 beforeEach 用于 WHEN 条件
  if (scenario.whens && scenario.whens.length > 0) {
    lines.push('  beforeEach(() => {');
    for (const when of scenario.whens) {
      lines.push(`    // WHEN: ${when}`);
      lines.push(`    // TODO: 实现前置条件 - ${when}`);
    }
    lines.push('  });');
    lines.push('');
  }

  // 生成 test 用于 THEN 断言
  if (scenario.thens && scenario.thens.length > 0) {
    for (const then of scenario.thens) {
      lines.push(`  it('should ${then}', () => {`);
      lines.push(`    // THEN: ${then}`);
      lines.push(`    // TODO: 实现断言`);
      lines.push(`    assert.ok(true); // placeholder`);
      lines.push('  });');
    }
  } else {
    lines.push('  it(\'should pass\', () => {');
    lines.push('    // TODO: 添加断言');
    lines.push('    assert.ok(true); // placeholder');
    lines.push('  });');
  }

  lines.push('});');

  return lines.join('\n');
}

/**
 * 从 fspec 文件生成测试文件
 *
 * @param {string} fspecPath - fspec 文件路径
 * @param {string} outputPath - 输出测试文件路径
 * @param {Object} options - 配置选项
 * @returns {Object} 生成结果
 */
function generateTestFile(fspecPath, outputPath, options = {}) {
  // TODO: 完整的测试文件生成流程
  throw new Error('Not implemented: generateTestFile');
}

/**
 * 更新现有测试文件
 *
 * @param {string} testPath - 测试文件路径
 * @param {Array<Object>} newScenarios - 新场景列表
 * @returns {Object} 更新结果
 */
function updateTestFile(testPath, newScenarios) {
  // TODO: 增量更新测试文件
  throw new Error('Not implemented: updateTestFile');
}

module.exports = {
  // 解析
  parseScenarios,

  // 生成
  generateTestCode,
  generateJestTest,
  generateNodeTest,
  generateTestFile,

  // 更新
  updateTestFile,

  // 常量
  SUPPORTED_FRAMEWORKS
};
