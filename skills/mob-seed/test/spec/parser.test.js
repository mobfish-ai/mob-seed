/**
 * Spec Parser 测试
 *
 * @module test/spec/parser
 */

const { describe, test } = require('node:test');
const assert = require('node:assert');
const specParser = require('../../lib/spec/parser');

describe('spec/parser', () => {
  const sampleSpec = `# Feature: Sample Feature

> 状态: implementing
> 版本: 1.0.0
> 优先级: P1

## 概述

这是一个示例规格。

## Requirements

### REQ-001: 基本功能

The system SHALL support basic operations.

**Acceptance Criteria**:
- [x] AC-001: 创建操作正常工作
- [ ] AC-002: 更新操作正常工作
- [ ] AC-003: 删除操作正常工作

### REQ-002: 高级功能

The system SHALL support advanced features.

- [ ] AC-004: 批量操作

## 派生产物 (Derived Outputs)

| 类型 | 路径 | 说明 |
|------|------|------|
| 代码 | lib/sample.js | 主要实现 |
| 测试 | test/sample.test.js | 单元测试 |
`;

  describe('parseSpecContent', () => {
    test('should parse spec content successfully', () => {
      const result = specParser.parseSpecContent(sampleSpec, 'sample.fspec.md');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.file, 'sample.fspec.md');
    });

    test('should extract title', () => {
      const result = specParser.parseSpecContent(sampleSpec);

      assert.strictEqual(result.title, 'Sample Feature');
    });

    test('should extract metadata', () => {
      const result = specParser.parseSpecContent(sampleSpec);

      assert.strictEqual(result.metadata['状态'], 'implementing');
      assert.strictEqual(result.metadata['版本'], '1.0.0');
      assert.strictEqual(result.metadata['优先级'], 'P1');
    });
  });

  describe('extractMetadata', () => {
    test('should extract all metadata fields', () => {
      const metadata = specParser.extractMetadata(sampleSpec);

      assert.strictEqual(metadata['状态'], 'implementing');
      assert.strictEqual(metadata['版本'], '1.0.0');
    });

    test('should handle missing metadata', () => {
      const content = '# Feature: No Metadata\n\nJust content.';
      const metadata = specParser.extractMetadata(content);

      assert.deepStrictEqual(metadata, {});
    });
  });

  describe('extractTitle', () => {
    test('should extract Feature title', () => {
      const title = specParser.extractTitle(sampleSpec);
      assert.strictEqual(title, 'Sample Feature');
    });

    test('should extract simple title', () => {
      const content = '# Simple Title\n\nContent';
      const title = specParser.extractTitle(content);
      assert.strictEqual(title, 'Simple Title');
    });
  });

  describe('extractRequirements', () => {
    test('should extract requirements', () => {
      const reqs = specParser.extractRequirements(sampleSpec);

      assert.ok(reqs.length >= 2);
      assert.ok(reqs.some(r => r.id === 'REQ-001'));
      assert.ok(reqs.some(r => r.title.includes('基本功能')));
    });

    test('should extract AC within requirements', () => {
      const reqs = specParser.extractRequirements(sampleSpec);
      const req1 = reqs.find(r => r.id === 'REQ-001');

      assert.ok(req1);
      assert.ok(req1.acceptanceCriteria.length >= 3);
      assert.ok(req1.acceptanceCriteria.some(ac => ac.completed === true));
      assert.ok(req1.acceptanceCriteria.some(ac => ac.completed === false));
    });
  });

  describe('extractAcceptanceCriteria', () => {
    test('should extract all AC', () => {
      const criteria = specParser.extractAcceptanceCriteria(sampleSpec);

      assert.ok(criteria.length >= 4);
    });

    test('should track completion status', () => {
      const criteria = specParser.extractAcceptanceCriteria(sampleSpec);

      const completed = criteria.filter(ac => ac.completed);
      const incomplete = criteria.filter(ac => !ac.completed);

      assert.ok(completed.length >= 1);
      assert.ok(incomplete.length >= 3);
    });

    test('should extract AC description', () => {
      const criteria = specParser.extractAcceptanceCriteria(sampleSpec);
      const ac1 = criteria.find(ac => ac.description.includes('创建操作'));

      assert.ok(ac1);
      assert.strictEqual(ac1.completed, true);
    });
  });

  describe('extractDerivedOutputs', () => {
    test('should extract derived outputs table', () => {
      const outputs = specParser.extractDerivedOutputs(sampleSpec);

      assert.ok(outputs.length >= 2);
      assert.ok(outputs.some(o => o.type === '代码'));
      assert.ok(outputs.some(o => o.path.includes('lib/sample.js')));
    });
  });

  describe('extractSections', () => {
    test('should extract all sections', () => {
      const sections = specParser.extractSections(sampleSpec);

      assert.ok(sections['概述']);
      assert.ok(sections['Requirements']);
      assert.ok(sections['派生产物 (Derived Outputs)']);
    });
  });

  describe('updateMetadata', () => {
    test('should update existing metadata', () => {
      const updated = specParser.updateMetadata(sampleSpec, {
        '状态': 'archived'
      });

      assert.ok(updated.includes('> 状态: archived'));
      assert.ok(!updated.includes('> 状态: implementing'));
    });
  });

  describe('updateACStatus', () => {
    test('should mark AC as completed', () => {
      const updated = specParser.updateACStatus(sampleSpec, 'AC-002', true);

      assert.ok(updated.includes('[x] AC-002'));
    });

    test('should mark AC as incomplete', () => {
      const updated = specParser.updateACStatus(sampleSpec, 'AC-001', false);

      assert.ok(updated.includes('[ ] AC-001'));
    });
  });

  describe('updateACStatuses', () => {
    test('should update multiple AC', () => {
      const updates = [
        { id: 'AC-002', completed: true },
        { id: 'AC-003', completed: true }
      ];
      const updated = specParser.updateACStatuses(sampleSpec, updates);

      assert.ok(updated.includes('[x] AC-002'));
      assert.ok(updated.includes('[x] AC-003'));
    });
  });

  describe('validateSpec', () => {
    test('should validate valid spec', () => {
      const parsed = specParser.parseSpecContent(sampleSpec);
      const validation = specParser.validateSpec(parsed);

      assert.strictEqual(validation.valid, true);
      assert.strictEqual(validation.issues.length, 0);
    });

    test('should report missing title', () => {
      const noTitle = '> 状态: draft\n\nNo title here.';
      const parsed = specParser.parseSpecContent(noTitle);
      const validation = specParser.validateSpec(parsed);

      assert.ok(validation.issues.some(i => i.includes('标题')));
    });
  });

  describe('getCompletionRate', () => {
    test('should calculate completion rate', () => {
      const parsed = specParser.parseSpecContent(sampleSpec);
      const rate = specParser.getCompletionRate(parsed);

      assert.ok(rate.total > 0);
      assert.ok(rate.completed >= 0);
      assert.ok(rate.percentage >= 0 && rate.percentage <= 100);
    });
  });
});
