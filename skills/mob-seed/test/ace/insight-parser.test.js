'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Import types module
const {
  InsightSourceTypes,
  InsightCredibilityLevels,
  InsightStatusValues,
  generateInsightId,
  isValidInsightId,
  parseInsightId,
  isValidSourceType,
  isValidCredibility,
  isValidStatus,
  validateSource,
  validateInsight,
  createDefaultInsight
} = require('../../lib/ace/insight-types');

// Import parser module
const {
  parseYamlFrontmatter,
  parseYamlValue,
  parseInsightContent,
  parseMarkdownSections,
  parseInsight,
  parseInsightFile,
  extractMetadata
} = require('../../lib/ace/insight-parser');

// Import generator module
const {
  objectToYaml,
  generateFrontmatter,
  generateInsightContent,
  generateNewInsight,
  writeInsightFile,
  updateInsightFile
} = require('../../lib/ace/insight-generator');

describe('insight-types', () => {
  describe('constants', () => {
    it('should have valid source types', () => {
      assert.ok(InsightSourceTypes.includes('expert_opinion'));
      assert.ok(InsightSourceTypes.includes('paper'));
      assert.ok(InsightSourceTypes.includes('blog'));
      assert.strictEqual(InsightSourceTypes.length, 7);
    });

    it('should have valid credibility levels', () => {
      assert.deepStrictEqual(InsightCredibilityLevels, ['high', 'medium', 'low']);
    });

    it('should have valid status values', () => {
      assert.ok(InsightStatusValues.includes('evaluating'));
      assert.ok(InsightStatusValues.includes('adopted'));
      assert.ok(InsightStatusValues.includes('obsolete'));
      assert.strictEqual(InsightStatusValues.length, 6);
    });
  });

  describe('generateInsightId', () => {
    it('should generate ID with correct format', () => {
      const date = new Date('2026-01-15');
      const id = generateInsightId(date, 'test-insight');
      assert.strictEqual(id, 'ins-20260115-test-insight');
    });

    it('should handle string date', () => {
      const id = generateInsightId('2026-03-20', 'my-slug');
      assert.strictEqual(id, 'ins-20260320-my-slug');
    });

    it('should sanitize slug', () => {
      const id = generateInsightId(new Date('2026-01-01'), 'Test With Spaces!');
      assert.ok(id.includes('test-with-spaces'));
      assert.ok(!id.includes('!'));
    });

    it('should truncate long slugs', () => {
      const longSlug = 'a'.repeat(50);
      const id = generateInsightId(new Date('2026-01-01'), longSlug);
      assert.ok(id.length <= 43); // ins-YYYYMMDD- + 30 chars
    });
  });

  describe('isValidInsightId', () => {
    it('should return true for valid IDs', () => {
      assert.strictEqual(isValidInsightId('ins-20260115-test'), true);
      assert.strictEqual(isValidInsightId('ins-20261231-my-insight-123'), true);
    });

    it('should return false for invalid IDs', () => {
      assert.strictEqual(isValidInsightId('obs-20260115-test'), false);
      assert.strictEqual(isValidInsightId('ins-2026015-test'), false);
      assert.strictEqual(isValidInsightId('ins-20260115-'), false);
      assert.strictEqual(isValidInsightId(''), false);
      assert.strictEqual(isValidInsightId(null), false);
    });
  });

  describe('parseInsightId', () => {
    it('should parse valid ID', () => {
      const result = parseInsightId('ins-20260115-test-slug');
      assert.strictEqual(result.dateStr, '2026-01-15');
      assert.strictEqual(result.slug, 'test-slug');
      assert.ok(result.date instanceof Date);
    });

    it('should return null for invalid ID', () => {
      assert.strictEqual(parseInsightId('invalid'), null);
    });
  });

  describe('validation functions', () => {
    it('isValidSourceType should validate correctly', () => {
      assert.strictEqual(isValidSourceType('expert_opinion'), true);
      assert.strictEqual(isValidSourceType('invalid'), false);
    });

    it('isValidCredibility should validate correctly', () => {
      assert.strictEqual(isValidCredibility('high'), true);
      assert.strictEqual(isValidCredibility('invalid'), false);
    });

    it('isValidStatus should validate correctly', () => {
      assert.strictEqual(isValidStatus('evaluating'), true);
      assert.strictEqual(isValidStatus('invalid'), false);
    });
  });

  describe('validateSource', () => {
    it('should validate complete source', () => {
      const source = {
        title: 'Test',
        type: 'expert_opinion',
        date: '2026-01-15',
        credibility: 'high'
      };
      const result = validateSource(source);
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it('should reject missing required fields', () => {
      const result = validateSource({});
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.length > 0);
    });

    it('should reject null source', () => {
      const result = validateSource(null);
      assert.strictEqual(result.isValid, false);
    });
  });

  describe('validateInsight', () => {
    it('should validate complete insight', () => {
      const insight = {
        id: 'ins-20260115-test',
        date: '2026-01-15',
        status: 'evaluating',
        source: {
          title: 'Test',
          type: 'expert_opinion',
          date: '2026-01-15',
          credibility: 'high'
        },
        tags: ['test']
      };
      const result = validateInsight(insight);
      assert.strictEqual(result.isValid, true);
    });

    it('should reject invalid status', () => {
      const insight = {
        id: 'ins-20260115-test',
        date: '2026-01-15',
        status: 'invalid',
        source: {
          title: 'Test',
          type: 'expert_opinion',
          date: '2026-01-15',
          credibility: 'high'
        }
      };
      const result = validateInsight(insight);
      assert.strictEqual(result.isValid, false);
    });
  });

  describe('createDefaultInsight', () => {
    it('should create insight with defaults', () => {
      const insight = createDefaultInsight();
      assert.ok(insight.id.startsWith('ins-'));
      assert.strictEqual(insight.status, 'evaluating');
      assert.ok(Array.isArray(insight.tags));
    });

    it('should allow overrides', () => {
      const insight = createDefaultInsight({
        status: 'adopted',
        tags: ['test', 'custom']
      });
      assert.strictEqual(insight.status, 'adopted');
      assert.deepStrictEqual(insight.tags, ['test', 'custom']);
    });
  });
});

describe('insight-parser', () => {
  describe('parseYamlValue', () => {
    it('should parse quoted strings', () => {
      assert.strictEqual(parseYamlValue('"hello"'), 'hello');
      assert.strictEqual(parseYamlValue("'world'"), 'world');
    });

    it('should parse booleans', () => {
      assert.strictEqual(parseYamlValue('true'), true);
      assert.strictEqual(parseYamlValue('false'), false);
    });

    it('should parse numbers', () => {
      assert.strictEqual(parseYamlValue('42'), 42);
      assert.strictEqual(parseYamlValue('3.14'), 3.14);
    });

    it('should return plain strings as-is', () => {
      assert.strictEqual(parseYamlValue('hello'), 'hello');
    });
  });

  describe('parseYamlFrontmatter', () => {
    it('should parse simple key-value pairs', () => {
      const yaml = `id: test-123
status: evaluating`;
      const result = parseYamlFrontmatter(yaml);
      assert.strictEqual(result.id, 'test-123');
      assert.strictEqual(result.status, 'evaluating');
    });

    it('should parse nested objects', () => {
      const yaml = `source:
  title: Test
  type: blog`;
      const result = parseYamlFrontmatter(yaml);
      assert.strictEqual(result.source.title, 'Test');
      assert.strictEqual(result.source.type, 'blog');
    });

    it('should parse inline arrays', () => {
      const yaml = `tags: [a, b, c]`;
      const result = parseYamlFrontmatter(yaml);
      assert.deepStrictEqual(result.tags, ['a', 'b', 'c']);
    });
  });

  describe('parseMarkdownSections', () => {
    it('should parse sections by ## headings', () => {
      const body = `## Section One

Content one

## Section Two

Content two`;
      const result = parseMarkdownSections(body);
      assert.strictEqual(result['Section One'], 'Content one');
      assert.strictEqual(result['Section Two'], 'Content two');
    });
  });

  describe('parseInsight', () => {
    it('should parse complete insight file', () => {
      const content = `---
id: ins-20260115-test
source:
  title: Test Insight
  type: expert_opinion
  date: 2026-01-15
  credibility: high
date: 2026-01-15
status: evaluating
model_era: claude-opus-4.5
tags: [test, example]
---

## 原始洞见

This is the insight content.

## 评估笔记

| 观点 | 适用性 | 理由 |
|------|--------|------|
| Good | High | Because |

## 采纳决策

- ✅ 采纳：This part
`;
      const result = parseInsight(content);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.insight.id, 'ins-20260115-test');
      assert.strictEqual(result.insight.source.title, 'Test Insight');
      assert.ok(result.insight.content.includes('This is the insight content'));
    });

    it('should return error for missing frontmatter', () => {
      const result = parseInsight('No frontmatter here');
      assert.strictEqual(result.success, false);
      assert.ok(result.errors.includes('No YAML frontmatter found'));
    });
  });

  describe('extractMetadata', () => {
    it('should extract summary metadata', () => {
      const insight = {
        id: 'ins-20260115-test',
        source: { title: 'Test', type: 'blog', author: 'John' },
        status: 'evaluating',
        modelEra: 'claude-opus-4.5',
        tags: ['a', 'b'],
        date: '2026-01-15'
      };
      const meta = extractMetadata(insight);
      assert.strictEqual(meta.id, 'ins-20260115-test');
      assert.strictEqual(meta.source, 'Test');
      assert.strictEqual(meta.sourceType, 'blog');
      assert.deepStrictEqual(meta.tags, ['a', 'b']);
    });
  });
});

describe('insight-generator', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insight-gen-test-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('objectToYaml', () => {
    it('should convert simple object', () => {
      const obj = { key: 'value', num: 42 };
      const yaml = objectToYaml(obj);
      assert.ok(yaml.includes('key: value'));
      assert.ok(yaml.includes('num: 42'));
    });

    it('should handle arrays', () => {
      const obj = { tags: ['a', 'b'] };
      const yaml = objectToYaml(obj);
      assert.ok(yaml.includes('tags: [a, b]'));
    });

    it('should handle nested objects', () => {
      const obj = { parent: { child: 'value' } };
      const yaml = objectToYaml(obj);
      assert.ok(yaml.includes('parent:'));
      assert.ok(yaml.includes('child: value'));
    });
  });

  describe('generateNewInsight', () => {
    it('should generate insight with valid content', () => {
      const result = generateNewInsight({
        source: {
          title: 'Test Insight',
          type: 'blog',
          date: '2026-01-15',
          credibility: 'medium'
        },
        tags: ['test']
      });
      assert.strictEqual(result.success, true);
      assert.ok(result.insight.id.startsWith('ins-'));
      assert.ok(result.content.includes('---'));
      assert.ok(result.content.includes('## 原始洞见'));
    });

    it('should use provided slug', () => {
      const result = generateNewInsight({
        slug: 'custom-slug',
        source: {
          title: 'Test',
          type: 'blog',
          date: '2026-01-15',
          credibility: 'medium'
        }
      });
      assert.ok(result.insight.id.includes('custom-slug'));
    });
  });

  describe('writeInsightFile', () => {
    it('should write file to disk', () => {
      const result = writeInsightFile(tempDir, {
        source: {
          title: 'Test',
          type: 'blog',
          date: '2026-01-15',
          credibility: 'medium'
        }
      });
      assert.strictEqual(result.success, true);
      assert.ok(fs.existsSync(result.filePath));
    });

    it('should create directory if not exists', () => {
      const subDir = path.join(tempDir, 'nested', 'dir');
      const result = writeInsightFile(subDir, {
        source: {
          title: 'Test',
          type: 'blog',
          date: '2026-01-15',
          credibility: 'medium'
        }
      });
      assert.strictEqual(result.success, true);
      assert.ok(fs.existsSync(subDir));
    });
  });

  describe('updateInsightFile', () => {
    it('should update existing file', () => {
      // First create a file
      const writeResult = writeInsightFile(tempDir, {
        source: {
          title: 'Original',
          type: 'blog',
          date: '2026-01-15',
          credibility: 'medium'
        },
        status: 'evaluating'
      });
      assert.strictEqual(writeResult.success, true);

      // Then update it
      const updateResult = updateInsightFile(writeResult.filePath, {
        status: 'adopted'
      });
      assert.strictEqual(updateResult.success, true);
      assert.strictEqual(updateResult.insight.status, 'adopted');

      // Verify file content
      const content = fs.readFileSync(writeResult.filePath, 'utf-8');
      assert.ok(content.includes('status: adopted'));
    });

    it('should return error for non-existent file', () => {
      const result = updateInsightFile('/nonexistent/path.md', {});
      assert.strictEqual(result.success, false);
    });
  });
});
