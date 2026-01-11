'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  objectToYaml,
  generateFrontmatter,
  generateInsightContent,
  generateNewInsight,
  writeInsightFile
} = require('../../lib/ace/insight-generator');

describe('insight-generator', () => {
  describe('objectToYaml', () => {
    it('should convert simple object to YAML', () => {
      const obj = { key: 'value', num: 42 };
      const yaml = objectToYaml(obj);
      assert.ok(yaml.includes('key: value'));
      assert.ok(yaml.includes('num: 42'));
    });

    it('should handle nested objects', () => {
      const obj = { parent: { child: 'value' } };
      const yaml = objectToYaml(obj);
      assert.ok(yaml.includes('parent:'));
      assert.ok(yaml.includes('child: value'));
    });

    it('should handle arrays', () => {
      const obj = { tags: ['a', 'b', 'c'] };
      const yaml = objectToYaml(obj);
      assert.ok(yaml.includes('tags: [a, b, c]'));
    });

    it('should handle empty arrays', () => {
      const obj = { empty: [] };
      const yaml = objectToYaml(obj);
      assert.ok(yaml.includes('empty: []'));
    });

    it('should handle null/undefined/empty values', () => {
      const obj = { empty: '', nullable: null };
      const yaml = objectToYaml(obj);
      assert.ok(yaml.includes('empty: ""'));
    });

    it('should escape strings with colons', () => {
      const obj = { url: 'https://example.com' };
      const yaml = objectToYaml(obj);
      assert.ok(yaml.includes('"https://example.com"'));
    });
  });

  describe('generateFrontmatter', () => {
    it('should generate frontmatter from insight object', () => {
      const insight = {
        id: 'ins-20250115-test',
        source: {
          title: 'Test Source',
          type: 'expert_opinion',
          author: 'Test Author',
          date: '2025-01-15',
          credibility: 'high'
        },
        date: '2025-01-15',
        status: 'evaluating',
        modelEra: 'claude-opus-4.5',
        tags: ['test']
      };
      const frontmatter = generateFrontmatter(insight);
      assert.ok(frontmatter.includes('id: ins-20250115-test'));
      assert.ok(frontmatter.includes('status: evaluating'));
      assert.ok(frontmatter.includes('model_era: claude-opus-4.5'));
    });

    it('should handle missing optional fields', () => {
      const insight = {
        id: 'ins-20250115-test',
        source: {},
        date: '2025-01-15',
        status: 'evaluating'
      };
      const frontmatter = generateFrontmatter(insight);
      assert.ok(frontmatter.includes('id: ins-20250115-test'));
    });
  });

  describe('generateInsightContent', () => {
    it('should generate complete insight file content', () => {
      const insight = {
        id: 'ins-20250115-test',
        source: {
          title: 'Test',
          type: 'blog',
          date: '2025-01-15',
          credibility: 'medium'
        },
        date: '2025-01-15',
        status: 'evaluating',
        content: 'Test content here',
        tags: []
      };
      const content = generateInsightContent(insight);
      assert.ok(content.startsWith('---'));
      assert.ok(content.includes('## 原始洞见'));
      assert.ok(content.includes('Test content here'));
      assert.ok(content.includes('## 评估笔记'));
      assert.ok(content.includes('## 采纳决策'));
    });

    it('should use placeholders for missing content', () => {
      const insight = {
        id: 'ins-20250115-test',
        source: { title: 'Test', type: 'blog', date: '2025-01-15', credibility: 'medium' },
        date: '2025-01-15',
        status: 'evaluating',
        tags: []
      };
      const content = generateInsightContent(insight);
      assert.ok(content.includes('[洞见内容待填充]'));
    });
  });

  describe('generateNewInsight', () => {
    it('should generate new insight with valid data', () => {
      const data = {
        slug: 'test-insight',
        source: {
          title: 'Test Source',
          type: 'expert_opinion',
          date: '2025-01-15',
          credibility: 'high'
        },
        content: 'Test content'
      };
      const result = generateNewInsight(data);
      assert.strictEqual(result.success, true);
      assert.ok(result.insight);
      assert.ok(result.content);
      assert.ok(result.fileName.endsWith('.md'));
    });

    it('should auto-generate slug from title', () => {
      const data = {
        source: {
          title: 'My Test Title',
          type: 'blog',
          date: '2025-01-15',
          credibility: 'medium'
        }
      };
      const result = generateNewInsight(data);
      assert.strictEqual(result.success, true);
      assert.ok(result.fileName.includes('my-test-title'));
    });

    it('should fail with invalid data', () => {
      const data = {
        source: {} // Missing required fields
      };
      const result = generateNewInsight(data);
      assert.strictEqual(result.success, false);
      assert.ok(result.errors.length > 0);
    });
  });

  describe('writeInsightFile', () => {
    let testDir;

    beforeEach(() => {
      testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insight-test-'));
    });

    afterEach(() => {
      if (testDir && fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true });
      }
    });

    it('should write insight file to directory', () => {
      const insight = {
        slug: 'test-write',
        source: {
          title: 'Write Test',
          type: 'documentation',
          date: '2025-01-15',
          credibility: 'high'
        },
        content: 'Write test content'
      };
      const result = writeInsightFile(testDir, insight);
      assert.strictEqual(result.success, true);
      assert.ok(fs.existsSync(result.filePath));
    });

    it('should create directory if not exists', () => {
      const newDir = path.join(testDir, 'subdir', 'nested');
      const insight = {
        slug: 'nested-test',
        source: {
          title: 'Nested Test',
          type: 'blog',
          date: '2025-01-15',
          credibility: 'medium'
        }
      };
      const result = writeInsightFile(newDir, insight);
      assert.strictEqual(result.success, true);
      assert.ok(fs.existsSync(newDir));
    });

    it('should fail with invalid insight data', () => {
      const insight = {
        source: {} // Missing required fields
      };
      const result = writeInsightFile(testDir, insight);
      assert.strictEqual(result.success, false);
    });
  });
});
