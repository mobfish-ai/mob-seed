/**
 * fspec-linter 测试
 * @see openspec/changes/v2.0-seed-complete/specs/quality/fspec-linter.fspec.md
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  detectFuzzyWords,
  validateRequiredFields,
  validateIdFormat,
  validateScenarioFormat,
  lintFile,
  lintContent,
  FUZZY_WORDS,
  REQUIRED_FIELDS
} = require('../../lib/quality/fspec-linter.js');

describe('fspec-linter', () => {
  // =============================================================
  // REQ-001: 模糊词汇检测
  // =============================================================

  describe('detectFuzzyWords', () => {
    it('should detect Chinese fuzzy words', () => {
      const content = '系统应该尽快响应用户请求';
      const matches = detectFuzzyWords(content);

      assert.ok(matches.length > 0, 'Should find fuzzy words');
      assert.ok(matches.some(m => m.word === '尽快'), 'Should detect "尽快"');
    });

    it('should detect English fuzzy words', () => {
      const content = 'The system should respond soon';
      const matches = detectFuzzyWords(content);

      assert.ok(matches.length > 0, 'Should find fuzzy words');
      assert.ok(matches.some(m => m.word === 'soon'), 'Should detect "soon"');
    });

    it('should detect multiple fuzzy words', () => {
      const content = '处理若干类型的输入，系统大概需要一些时间';
      const matches = detectFuzzyWords(content);

      assert.ok(matches.length >= 3, 'Should find at least 3 fuzzy words');
    });

    it('should return empty array for clean content', () => {
      const content = '系统在 200ms 内响应用户请求';
      const matches = detectFuzzyWords(content);

      assert.strictEqual(matches.length, 0, 'Should find no fuzzy words');
    });

    it('should include line number in matches', () => {
      const content = '第一行\n系统应该尽快响应\n第三行';
      const matches = detectFuzzyWords(content);

      assert.ok(matches.length > 0);
      assert.strictEqual(matches[0].line, 2, 'Should be on line 2');
    });

    it('should include category in matches', () => {
      const content = '系统应该尽快响应';
      const matches = detectFuzzyWords(content);

      assert.ok(matches.length > 0);
      assert.strictEqual(matches[0].category, 'time', 'Should be in time category');
    });
  });

  // =============================================================
  // REQ-002: 格式验证 - 必需字段检查
  // =============================================================

  describe('validateRequiredFields', () => {
    const validFspec = `# Feature: Test Feature

> 状态: draft
> 版本: 1.0.0
> 技术栈: JavaScript
> 派生路径: lib/test/

## 概述

这是一个测试功能。

## ADDED Requirements

### REQ-001: 测试需求

The system SHALL do something.
`;

    it('should pass for valid fspec', () => {
      const errors = validateRequiredFields(validFspec);
      assert.strictEqual(errors.length, 0, 'Should have no errors');
    });

    it('should detect missing status field', () => {
      const content = `# Feature: Test

> 版本: 1.0.0
> 技术栈: JavaScript
> 派生路径: lib/test/

## 概述

Test.
`;
      const errors = validateRequiredFields(content);
      assert.ok(errors.some(e => e.field === '状态'), 'Should detect missing 状态');
    });

    it('should detect missing version field', () => {
      const content = `# Feature: Test

> 状态: draft
> 技术栈: JavaScript
> 派生路径: lib/test/

## 概述

Test.
`;
      const errors = validateRequiredFields(content);
      assert.ok(errors.some(e => e.field === '版本'), 'Should detect missing 版本');
    });

    it('should detect missing overview section', () => {
      const content = `# Feature: Test

> 状态: draft
> 版本: 1.0.0
> 技术栈: JavaScript
> 派生路径: lib/test/

## ADDED Requirements

### REQ-001: Test
`;
      const errors = validateRequiredFields(content);
      assert.ok(errors.some(e => e.field === '概述'), 'Should detect missing 概述');
    });

    it('should detect missing requirements section', () => {
      const content = `# Feature: Test

> 状态: draft
> 版本: 1.0.0
> 技术栈: JavaScript
> 派生路径: lib/test/

## 概述

Test.
`;
      const errors = validateRequiredFields(content);
      assert.ok(
        errors.some(e => e.field === 'Requirements'),
        'Should detect missing Requirements section'
      );
    });
  });

  // =============================================================
  // REQ-003: 需求结构验证
  // =============================================================

  describe('validateScenarioFormat', () => {
    it('should pass for valid scenario', () => {
      const content = `
**Scenario: 测试场景**
- WHEN 用户点击按钮
- THEN 显示对话框
`;
      const errors = validateScenarioFormat(content);
      assert.strictEqual(errors.length, 0, 'Should have no errors');
    });

    it('should detect scenario without WHEN', () => {
      const content = `
**Scenario: 测试场景**
- THEN 显示对话框
`;
      const errors = validateScenarioFormat(content);
      assert.ok(errors.length > 0, 'Should detect missing WHEN');
    });

    it('should detect scenario without THEN', () => {
      const content = `
**Scenario: 测试场景**
- WHEN 用户点击按钮
`;
      const errors = validateScenarioFormat(content);
      assert.ok(errors.length > 0, 'Should detect missing THEN');
    });

    it('should allow AND in scenarios', () => {
      const content = `
**Scenario: 测试场景**
- WHEN 用户点击按钮
- AND 用户已登录
- THEN 显示对话框
- AND 记录日志
`;
      const errors = validateScenarioFormat(content);
      assert.strictEqual(errors.length, 0, 'Should allow AND');
    });
  });

  // =============================================================
  // REQ-004: ID 唯一性验证
  // =============================================================

  describe('validateIdFormat', () => {
    it('should pass for unique IDs', () => {
      const content = `
### REQ-001: First
**Acceptance Criteria:**
- [ ] AC-001: First AC

### REQ-002: Second
**Acceptance Criteria:**
- [ ] AC-002: Second AC
`;
      const errors = validateIdFormat(content);
      assert.strictEqual(errors.length, 0, 'Should have no errors');
    });

    it('should detect duplicate REQ IDs', () => {
      const content = `
### REQ-001: First
### REQ-001: Duplicate
`;
      const errors = validateIdFormat(content);
      assert.ok(errors.length > 0, 'Should detect duplicate REQ-001');
      assert.ok(errors[0].id === 'REQ-001', 'Should report REQ-001 as duplicate');
    });

    it('should detect duplicate AC IDs', () => {
      const content = `
- [ ] AC-001: First
- [ ] AC-001: Duplicate
`;
      const errors = validateIdFormat(content);
      assert.ok(errors.length > 0, 'Should detect duplicate AC-001');
    });
  });

  // =============================================================
  // REQ-006: 综合检查
  // =============================================================

  describe('lintContent', () => {
    it('should return all issues', () => {
      const content = `# Feature: Test

> 状态: draft
> 版本: 1.0.0
> 技术栈: JavaScript
> 派生路径: lib/test/

## 概述

系统应该尽快处理若干请求。

## ADDED Requirements

### REQ-001: Test

The system SHALL test.

**Scenario: 测试**
- WHEN 测试
- THEN 通过

**Acceptance Criteria:**
- [ ] AC-001: 测试
`;
      const result = lintContent(content);

      assert.ok(result.warnings.length > 0, 'Should have warnings for fuzzy words');
      assert.strictEqual(result.errors.length, 0, 'Should have no errors');
    });

    it('should separate errors and warnings', () => {
      const content = `# Feature: Test

## ADDED Requirements

### REQ-001: Test
`;
      const result = lintContent(content);

      // Missing required fields should be errors
      assert.ok(result.errors.length > 0, 'Should have errors for missing fields');
    });
  });
});
