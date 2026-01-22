'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  importFromText,
  importFromFile,
  formatImportResult,
  checkUrlSupport,
  ImportMode
} = require('../../lib/ace/insight-importer');

describe('insight-importer', () => {
  let tempDir;
  let insightsDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insight-importer-test-'));
    insightsDir = path.join(tempDir, '.seed', 'insights');
    fs.mkdirSync(insightsDir, { recursive: true });
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('importFromText', () => {
    it('should import text content successfully', () => {
      const text = 'Test Article Title\n\nThis is the article content about javascript and testing.';
      const result = importFromText(tempDir, text, { skipDedupCheck: true });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.mode, ImportMode.TEXT);
      assert.ok(result.insightId);
      assert.ok(result.insightId.startsWith('ins-'));
      assert.ok(result.filePath);
      assert.ok(fs.existsSync(result.filePath));
    });

    it('should extract metadata from text', () => {
      const text = 'My Insight Title\nBy John Doe\n\nContent about the insight.';
      const result = importFromText(tempDir, text, { skipDedupCheck: true });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.metadata.title, 'My Insight Title');
      assert.strictEqual(result.metadata.author, 'John Doe');
    });

    it('should use source info when provided', () => {
      const text = 'Title\n\nContent.';
      const result = importFromText(tempDir, text, {
        skipDedupCheck: true,
        sourceInfo: {
          type: 'paper',
          author: 'Provided Author',
          credibility: 'high'
        }
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.metadata.type, 'paper');
      assert.strictEqual(result.metadata.author, 'Provided Author');
      assert.strictEqual(result.metadata.credibility, 'high');
    });

    it('should add additional tags', () => {
      const text = 'Title\n\nContent about javascript.';
      const result = importFromText(tempDir, text, {
        skipDedupCheck: true,
        additionalTags: ['custom-tag', 'another-tag']
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.metadata.tags.includes('custom-tag'));
      assert.ok(result.metadata.tags.includes('another-tag'));
    });

    it('should support dry run mode', () => {
      const text = 'Dry Run Title\n\nContent.';
      const result = importFromText(tempDir, text, { skipDedupCheck: true, dryRun: true });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.dryRun, true);
      assert.ok(result.insightId);
      assert.strictEqual(result.filePath, null); // No file created
    });

    it('should fail when text is empty', () => {
      const result = importFromText(tempDir, '');

      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('required'));
    });

    it('should fail when text is null', () => {
      const result = importFromText(tempDir, null);

      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('required'));
    });

    it('should fail when text is whitespace only', () => {
      const result = importFromText(tempDir, '   \n\n   ');

      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('required'));
    });

    it('should create insight file with correct content', () => {
      const text = 'Insight Title\n\nThe actual content.';
      const result = importFromText(tempDir, text, { skipDedupCheck: true });

      assert.strictEqual(result.success, true);

      const fileContent = fs.readFileSync(result.filePath, 'utf8');
      assert.ok(fileContent.includes('Insight Title'));
      assert.ok(fileContent.includes('status: evaluating'));
    });

    it('should handle Chinese content', () => {
      const text = '关于AI编程的思考\n作者: 张三\n\n这是一篇关于人工智能的文章。';
      const result = importFromText(tempDir, text, { skipDedupCheck: true });

      assert.strictEqual(result.success, true);
      // Smart title extraction removes "关于" prefix for better titles
      assert.ok(result.metadata.title.includes('AI编程的思考'));
      assert.strictEqual(result.metadata.author, '张三');
    });
  });

  describe('formatImportResult', () => {
    it('should format successful import', () => {
      const result = {
        success: true,
        mode: ImportMode.TEXT,
        dryRun: false,
        insightId: 'ins-20260115-test',
        filePath: '/path/to/file.md',
        metadata: {
          title: 'Test Title',
          author: 'Test Author',
          date: '2026-01-15',
          type: 'blog',
          credibility: 'medium',
          tags: ['test']
        },
        warnings: []
      };

      const output = formatImportResult(result);

      assert.ok(output.includes('✅ 导入成功'));
      assert.ok(output.includes('ins-20260115-test'));
      assert.ok(output.includes('Test Title'));
      assert.ok(output.includes('Test Author'));
    });

    it('should format dry run result', () => {
      const result = {
        success: true,
        mode: ImportMode.TEXT,
        dryRun: true,
        insightId: 'ins-20260115-test',
        filePath: null,
        metadata: {
          title: 'Test Title',
          date: '2026-01-15',
          type: 'blog',
          credibility: 'medium'
        },
        warnings: []
      };

      const output = formatImportResult(result);

      assert.ok(output.includes('预览模式'));
      assert.ok(output.includes('Dry Run'));
    });

    it('should format failed import', () => {
      const result = {
        success: false,
        mode: ImportMode.URL,
        error: 'Network error',
        warnings: []
      };

      const output = formatImportResult(result);

      assert.ok(output.includes('❌ 导入失败'));
      assert.ok(output.includes('Network error'));
    });

    it('should include warnings in output', () => {
      const result = {
        success: true,
        mode: ImportMode.TEXT,
        dryRun: false,
        insightId: 'ins-20260115-test',
        filePath: '/path/to/file.md',
        metadata: {
          title: 'Test Title',
          date: '2026-01-15',
          type: 'blog',
          credibility: 'medium'
        },
        warnings: ['Author not found', 'No tags extracted']
      };

      const output = formatImportResult(result);

      assert.ok(output.includes('⚠️ 警告'));
      assert.ok(output.includes('Author not found'));
      assert.ok(output.includes('No tags extracted'));
    });

    it('should include next steps for successful import', () => {
      const result = {
        success: true,
        mode: ImportMode.TEXT,
        dryRun: false,
        insightId: 'ins-20260115-test',
        filePath: '/path/to/file.md',
        metadata: {
          title: 'Test Title',
          date: '2026-01-15',
          type: 'blog',
          credibility: 'medium'
        },
        warnings: []
      };

      const output = formatImportResult(result);

      assert.ok(output.includes('下一步'));
      assert.ok(output.includes('/mob-seed:insight'));
    });

    it('should suggest --text mode for URL failures', () => {
      const result = {
        success: false,
        mode: ImportMode.URL,
        url: 'https://example.com',
        error: 'Failed to fetch',
        warnings: []
      };

      const output = formatImportResult(result);

      assert.ok(output.includes('--text'));
    });
  });

  describe('checkUrlSupport', () => {
    it('should return supported for valid https URLs', () => {
      const result = checkUrlSupport('https://example.com/article');
      assert.strictEqual(result.supported, true);
    });

    it('should return supported for valid http URLs', () => {
      const result = checkUrlSupport('http://example.com/article');
      assert.strictEqual(result.supported, true);
    });

    it('should return unsupported for file:// URLs', () => {
      const result = checkUrlSupport('file:///path/to/file');
      assert.strictEqual(result.supported, false);
      assert.ok(result.reason.includes('protocol'));
    });

    it('should return unsupported for linkedin.com', () => {
      const result = checkUrlSupport('https://linkedin.com/in/user');
      assert.strictEqual(result.supported, false);
      assert.ok(result.reason.includes('authentication'));
    });

    it('should return unsupported for facebook.com', () => {
      const result = checkUrlSupport('https://facebook.com/post/123');
      assert.strictEqual(result.supported, false);
      assert.ok(result.reason.includes('authentication'));
    });

    it('should return unsupported for invalid URLs', () => {
      const result = checkUrlSupport('not-a-url');
      assert.strictEqual(result.supported, false);
      assert.ok(result.reason.includes('Invalid'));
    });

    it('should return supported for github.com', () => {
      const result = checkUrlSupport('https://github.com/user/repo');
      assert.strictEqual(result.supported, true);
    });

    it('should return supported for medium.com', () => {
      const result = checkUrlSupport('https://medium.com/@author/article');
      assert.strictEqual(result.supported, true);
    });
  });

  describe('ImportMode', () => {
    it('should have URL mode', () => {
      assert.strictEqual(ImportMode.URL, 'url');
    });

    it('should have TEXT mode', () => {
      assert.strictEqual(ImportMode.TEXT, 'text');
    });
  });

  describe('duplicate prevention', () => {
    it('should fail when importing same text twice on same day', () => {
      const text = 'Duplicate Test Title\n\nContent.';

      // First import (skip dedup since no index exists yet)
      const result1 = importFromText(tempDir, text, { skipDedupCheck: true });
      assert.strictEqual(result1.success, true);

      // Second import with same title - should fail due to ID collision
      const result2 = importFromText(tempDir, text, { skipDedupCheck: true });
      assert.strictEqual(result2.success, false);
      assert.ok(result2.error.includes('already exists'));
    });

    it('should allow different titles on same day', () => {
      const text1 = 'First Title\n\nContent 1.';
      const text2 = 'Second Title\n\nContent 2.';

      // Skip dedup check for basic import tests
      const result1 = importFromText(tempDir, text1, { skipDedupCheck: true });
      assert.strictEqual(result1.success, true);

      const result2 = importFromText(tempDir, text2, { skipDedupCheck: true });
      assert.strictEqual(result2.success, true);

      assert.notStrictEqual(result1.insightId, result2.insightId);
    });

    it('should detect similar insights when dedup is enabled', () => {
      // First create an index with existing insight
      const indexDir = path.join(tempDir, '.seed', 'insights');
      const existingIndex = {
        version: '1.0',
        updated: new Date().toISOString(),
        insights: [
          {
            id: 'ins-20260115-test-insight',
            title: 'Agent Architecture Best Practices',
            tags: ['agent', 'architecture', 'best-practices'],
            status: 'evaluating',
            source: { title: 'Agent Architecture Best Practices' }
          }
        ]
      };
      fs.writeFileSync(path.join(indexDir, 'index.json'), JSON.stringify(existingIndex, null, 2));

      // Try to import similar content with dedup enabled
      const text = 'Agent Architecture Patterns\n\nBest practices for agent development.';
      const result = importFromText(tempDir, text);

      // Should detect similarity and block
      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('Similar'));
      assert.ok(result.similarInsights);
      assert.ok(result.similarInsights.length > 0);
    });

    it('should allow import with forceCreate despite similarity', () => {
      // First create an index with existing insight
      const indexDir = path.join(tempDir, '.seed', 'insights');
      const existingIndex = {
        version: '1.0',
        updated: new Date().toISOString(),
        insights: [
          {
            id: 'ins-20260115-test-insight',
            title: 'Agent Architecture Best Practices',
            tags: ['agent', 'architecture', 'best-practices'],
            status: 'evaluating',
            source: { title: 'Agent Architecture Best Practices' }
          }
        ]
      };
      fs.writeFileSync(path.join(indexDir, 'index.json'), JSON.stringify(existingIndex, null, 2));

      // Import with forceCreate to bypass dedup
      const text = 'Agent Architecture Patterns\n\nBest practices for agent development.';
      const result = importFromText(tempDir, text, { forceCreate: true });

      // Should succeed despite similarity
      assert.strictEqual(result.success, true);
      assert.ok(result.insightId);
    });
  });

  describe('insight file content', () => {
    it('should include proper frontmatter', () => {
      const text = 'Test Title\n\nContent here.';
      const result = importFromText(tempDir, text, {
        skipDedupCheck: true,
        sourceInfo: {
          type: 'paper',
          author: 'Test Author',
          credibility: 'high'
        }
      });

      assert.strictEqual(result.success, true);

      const fileContent = fs.readFileSync(result.filePath, 'utf8');

      // Check frontmatter fields
      assert.ok(fileContent.includes('id:'));
      assert.ok(fileContent.includes('source:'));
      assert.ok(fileContent.includes('status: evaluating'));
      assert.ok(fileContent.includes('type: paper'));
      assert.ok(fileContent.includes('credibility: high'));
    });

    it('should include content section', () => {
      const text = 'Test Title\n\nThis is the actual content of the insight.';
      const result = importFromText(tempDir, text, { skipDedupCheck: true });

      assert.strictEqual(result.success, true);

      const fileContent = fs.readFileSync(result.filePath, 'utf8');

      assert.ok(fileContent.includes('## 原始洞见'));
      assert.ok(fileContent.includes('This is the actual content'));
    });
  });

  describe('importFromFile', () => {
    let testFileDir;

    beforeEach(() => {
      testFileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insight-files-'));
    });

    afterEach(() => {
      if (testFileDir && fs.existsSync(testFileDir)) {
        fs.rmSync(testFileDir, { recursive: true, force: true });
      }
    });

    describe('Markdown file import', () => {
      it('should import from .md file successfully', () => {
        const content = '# Test Insight\n\nThis is the insight content about software architecture.';
        const filePath = path.join(testFileDir, 'test-insight.md');
        fs.writeFileSync(filePath, content);

        const result = importFromFile(tempDir, filePath, { skipDedupCheck: true });

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.mode, ImportMode.FILE);
        assert.ok(result.insightId);
        assert.ok(result.insightFilePath);
        assert.ok(fs.existsSync(result.insightFilePath));
      });

      it('should extract title from markdown heading', () => {
        const content = '# Architecture Best Practices\n\nContent about patterns.';
        const filePath = path.join(testFileDir, 'architecture.md');
        fs.writeFileSync(filePath, content);

        const result = importFromFile(tempDir, filePath, { skipDedupCheck: true });

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.metadata.title, 'Architecture Best Practices');
      });

      it('should use filename as title fallback', () => {
        const content = 'No heading here.\n\nJust some content.';
        const filePath = path.join(testFileDir, 'my-insight.md');
        fs.writeFileSync(filePath, content);

        const result = importFromFile(tempDir, filePath, { skipDedupCheck: true });

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.metadata.title, 'my-insight');
      });

      it('should remove YAML frontmatter from markdown', () => {
        const content = `---
title: Frontmatter Title
tags: [test, example]
---

# Actual Title

Content here.`;
        const filePath = path.join(testFileDir, 'with-frontmatter.md');
        fs.writeFileSync(filePath, content);

        const result = importFromFile(tempDir, filePath, { skipDedupCheck: true });

        assert.strictEqual(result.success, true);
        // Should use first heading after frontmatter
        assert.strictEqual(result.metadata.title, 'Actual Title');
      });
    });

    describe('Text file import', () => {
      it('should import from .txt file successfully', () => {
        const content = 'Plain text insight about testing strategies.';
        const filePath = path.join(testFileDir, 'testing.txt');
        fs.writeFileSync(filePath, content);

        const result = importFromFile(tempDir, filePath, { skipDedupCheck: true });

        assert.strictEqual(result.success, true);
        assert.ok(result.insightId);
        assert.ok(fs.existsSync(result.insightFilePath));
      });

      it('should use first line (up to 50 chars) as title for .txt', () => {
        const content = 'This is the first line about architecture.\n\nRest of the content.';
        const filePath = path.join(testFileDir, 'insight.txt');
        fs.writeFileSync(filePath, content);

        const result = importFromFile(tempDir, filePath, { skipDedupCheck: true });

        assert.strictEqual(result.success, true);
        // Should use first line (within 50 chars limit)
        assert.strictEqual(result.metadata.title, 'This is the first line about architecture.');
      });

      it('should truncate long first line to 60 chars with ...', () => {
        const content = 'This is a very long first line that exceeds sixty characters and should be truncated.\n\nRest of the content.';
        const filePath = path.join(testFileDir, 'long-insight.txt');
        fs.writeFileSync(filePath, content);

        const result = importFromFile(tempDir, filePath, { skipDedupCheck: true });

        assert.strictEqual(result.success, true);
        // Smart title extraction truncates at word boundary
        // "This is a very long first line that exceeds sixty..." (52 chars)
        assert.strictEqual(result.metadata.title.length, 52);
        assert.ok(result.metadata.title.endsWith('...'));
      });

      it('should fallback to untitled for empty .txt file', () => {
        const content = '   \n\n   '; // Only whitespace
        const filePath = path.join(testFileDir, 'empty-insight.txt');
        fs.writeFileSync(filePath, content);

        const result = importFromFile(tempDir, filePath, { skipDedupCheck: true });

        assert.strictEqual(result.success, true);
        // Empty content falls back to 'Untitled Insight' (not filename)
        assert.strictEqual(result.metadata.title, 'Untitled Insight');
      });
    });

    describe('JSON file import', () => {
      it('should import from .json file with content field', () => {
        const data = {
          title: 'JSON Insight Title',
          content: 'The actual insight content from JSON.',
          author: 'JSON Author',
          credibility: 'high',
          tags: ['json', 'test']
        };
        const filePath = path.join(testFileDir, 'insight.json');
        fs.writeFileSync(filePath, JSON.stringify(data));

        const result = importFromFile(tempDir, filePath, { skipDedupCheck: true });

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.metadata.title, 'JSON Insight Title');
        assert.strictEqual(result.metadata.author, 'JSON Author');
        assert.strictEqual(result.metadata.credibility, 'high');
      });

      it('should import from .json file with text field', () => {
        const data = {
          text: 'Content from text field.'
        };
        const filePath = path.join(testFileDir, 'insight.json');
        fs.writeFileSync(filePath, JSON.stringify(data));

        const result = importFromFile(tempDir, filePath, { skipDedupCheck: true });

        assert.strictEqual(result.success, true);
      });

      it('should fail when JSON has no content or text field', () => {
        const data = {
          title: 'No content here'
        };
        const filePath = path.join(testFileDir, 'invalid.json');
        fs.writeFileSync(filePath, JSON.stringify(data));

        const result = importFromFile(tempDir, filePath);

        assert.strictEqual(result.success, false);
        assert.ok(result.error.includes('content'));
      });

      it('should fail on invalid JSON syntax', () => {
        const content = '{ invalid json }';
        const filePath = path.join(testFileDir, 'broken.json');
        fs.writeFileSync(filePath, content);

        const result = importFromFile(tempDir, filePath);

        assert.strictEqual(result.success, false);
        assert.ok(result.error.includes('JSON'));
      });
    });

    describe('File validation', () => {
      it('should fail when file does not exist', () => {
        const result = importFromFile(tempDir, '/nonexistent/file.md');

        assert.strictEqual(result.success, false);
        assert.ok(result.error.includes('不存在'));
      });

      it('should fail on unsupported file type', () => {
        const filePath = path.join(testFileDir, 'test.pdf');
        fs.writeFileSync(filePath, 'fake pdf content');

        const result = importFromFile(tempDir, filePath);

        assert.strictEqual(result.success, false);
        assert.ok(result.error.includes('不支持'));
        assert.ok(result.error.includes('.pdf'));
      });

      it('should fail on oversized file (>1MB)', () => {
        const largeContent = 'x'.repeat(2 * 1024 * 1024); // 2MB
        const filePath = path.join(testFileDir, 'large.md');
        fs.writeFileSync(filePath, largeContent);

        const result = importFromFile(tempDir, filePath);

        assert.strictEqual(result.success, false);
        assert.ok(result.error.includes('过大'));
        assert.ok(result.error.includes('MB'));
      });

      it('should support relative file paths', () => {
        const content = '# Relative Path Test\n\nContent.';
        const filePath = path.join(tempDir, 'relative-test.md');
        fs.writeFileSync(filePath, content);

        // Use relative path from project root
        const result = importFromFile(tempDir, 'relative-test.md', { skipDedupCheck: true });

        assert.strictEqual(result.success, true);
      });
    });

    describe('Metadata extraction', () => {
      it('should extract tags from filename keywords', () => {
        const content = '# Test\n\nContent.';
        const filePath = path.join(testFileDir, 'architecture-patterns-best-practices.md');
        fs.writeFileSync(filePath, content);

        const result = importFromFile(tempDir, filePath, { skipDedupCheck: true });

        assert.strictEqual(result.success, true);
        assert.ok(result.metadata.tags.some(tag => tag.includes('architecture')));
      });

      it('should use file modification time as date', () => {
        const content = '# Test\n\nContent.';
        const filePath = path.join(testFileDir, 'dated.md');
        fs.writeFileSync(filePath, content);

        const result = importFromFile(tempDir, filePath, { skipDedupCheck: true });

        assert.strictEqual(result.success, true);
        assert.ok(result.metadata.date);
        assert.match(result.metadata.date, /^\d{4}-\d{2}-\d{2}$/);
      });
    });

    describe('Options and flags', () => {
      it('should support dry run mode', () => {
        const content = '# Dry Run Test\n\nContent.';
        const filePath = path.join(testFileDir, 'dryrun.md');
        fs.writeFileSync(filePath, content);

        const result = importFromFile(tempDir, filePath, { skipDedupCheck: true, dryRun: true });

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.dryRun, true);
        assert.ok(result.insightId);
        assert.strictEqual(result.insightFilePath, null); // No file created
      });

      it('should add additional tags', () => {
        const content = '# Test\n\nContent.';
        const filePath = path.join(testFileDir, 'tags.md');
        fs.writeFileSync(filePath, content);

        const result = importFromFile(tempDir, filePath, {
          skipDedupCheck: true,
          additionalTags: ['custom-tag', 'another-tag']
        });

        assert.strictEqual(result.success, true);
        assert.ok(result.metadata.tags.includes('custom-tag'));
        assert.ok(result.metadata.tags.includes('another-tag'));
      });

      it('should override metadata with options', () => {
        const content = '# Original Title\n\nContent.';
        const filePath = path.join(testFileDir, 'override.md');
        fs.writeFileSync(filePath, content);

        const result = importFromFile(tempDir, filePath, {
          skipDedupCheck: true,
          overrides: {
            title: 'Overridden Title',
            author: 'Override Author'
          }
        });

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.metadata.title, 'Overridden Title');
        assert.strictEqual(result.metadata.author, 'Override Author');
      });
    });

    describe('Duplicate detection', () => {
      it('should detect similar insights', () => {
        // Create existing insight
        const indexDir = path.join(tempDir, '.seed', 'insights');
        const existingIndex = {
          version: '1.0',
          updated: new Date().toISOString(),
          insights: [
            {
              id: 'ins-20260122-existing',
              title: 'File Import Patterns',
              tags: ['file', 'import', 'patterns'],
              status: 'evaluating',
              source: { title: 'File Import Patterns' }
            }
          ]
        };
        fs.writeFileSync(path.join(indexDir, 'index.json'), JSON.stringify(existingIndex, null, 2));

        // Try to import similar content
        const content = '# File Import Best Practices\n\nSimilar content.';
        const filePath = path.join(testFileDir, 'file-import.md');
        fs.writeFileSync(filePath, content);

        const result = importFromFile(tempDir, filePath); // Don't skip dedup

        assert.strictEqual(result.success, false);
        assert.ok(result.error.includes('Similar'));
        assert.ok(result.similarInsights);
      });

      it('should allow import with forceCreate despite similarity', () => {
        // Create existing insight
        const indexDir = path.join(tempDir, '.seed', 'insights');
        const existingIndex = {
          version: '1.0',
          updated: new Date().toISOString(),
          insights: [
            {
              id: 'ins-20260122-existing',
              title: 'File Import Patterns',
              tags: ['file', 'import'],
              status: 'evaluating',
              source: { title: 'File Import Patterns' }
            }
          ]
        };
        fs.writeFileSync(path.join(indexDir, 'index.json'), JSON.stringify(existingIndex, null, 2));

        // Import with forceCreate
        const content = '# File Import Best Practices\n\nSimilar content.';
        const filePath = path.join(testFileDir, 'file-import.md');
        fs.writeFileSync(filePath, content);

        const result = importFromFile(tempDir, filePath, { forceCreate: true });

        assert.strictEqual(result.success, true);
        assert.ok(result.insightId);
      });
    });

    describe('Chinese content support', () => {
      it('should handle Chinese content in markdown', () => {
        const content = '# 关于 AI 编程的思考\n\n这是一篇关于人工智能辅助编程的文章内容。';
        const filePath = path.join(testFileDir, 'ai-coding.md');
        fs.writeFileSync(filePath, content);

        const result = importFromFile(tempDir, filePath, { skipDedupCheck: true });

        assert.strictEqual(result.success, true);
        assert.ok(result.metadata.title.includes('关于 AI 编程'));
      });

      it('should handle Chinese filename', () => {
        const content = '测试内容\n\n关于文件导入的思考。';
        const filePath = path.join(testFileDir, '文件导入测试.md');
        fs.writeFileSync(filePath, content);

        const result = importFromFile(tempDir, filePath, { skipDedupCheck: true });

        assert.strictEqual(result.success, true);
      });
    });

    describe('Insight file creation', () => {
      it('should create insight file with correct content', () => {
        const content = '# Test Title\n\nThis is the actual content.';
        const filePath = path.join(testFileDir, 'test.md');
        fs.writeFileSync(filePath, content);

        const result = importFromFile(tempDir, filePath, { skipDedupCheck: true });

        assert.strictEqual(result.success, true);

        const fileContent = fs.readFileSync(result.insightFilePath, 'utf8');
        assert.ok(fileContent.includes('Test Title'));
        assert.ok(fileContent.includes('status: evaluating'));
        assert.ok(fileContent.includes('## 原始洞见'));
      });
    });
  });
});
