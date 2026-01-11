'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  importFromText,
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
      const result = importFromText(tempDir, text);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.mode, ImportMode.TEXT);
      assert.ok(result.insightId);
      assert.ok(result.insightId.startsWith('ins-'));
      assert.ok(result.filePath);
      assert.ok(fs.existsSync(result.filePath));
    });

    it('should extract metadata from text', () => {
      const text = 'My Insight Title\nBy John Doe\n\nContent about the insight.';
      const result = importFromText(tempDir, text);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.metadata.title, 'My Insight Title');
      assert.strictEqual(result.metadata.author, 'John Doe');
    });

    it('should use source info when provided', () => {
      const text = 'Title\n\nContent.';
      const result = importFromText(tempDir, text, {
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
        additionalTags: ['custom-tag', 'another-tag']
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.metadata.tags.includes('custom-tag'));
      assert.ok(result.metadata.tags.includes('another-tag'));
    });

    it('should support dry run mode', () => {
      const text = 'Dry Run Title\n\nContent.';
      const result = importFromText(tempDir, text, { dryRun: true });

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
      const result = importFromText(tempDir, text);

      assert.strictEqual(result.success, true);

      const fileContent = fs.readFileSync(result.filePath, 'utf8');
      assert.ok(fileContent.includes('Insight Title'));
      assert.ok(fileContent.includes('status: evaluating'));
    });

    it('should handle Chinese content', () => {
      const text = '关于AI编程的思考\n作者: 张三\n\n这是一篇关于人工智能的文章。';
      const result = importFromText(tempDir, text);

      assert.strictEqual(result.success, true);
      assert.ok(result.metadata.title.includes('关于AI编程的思考'));
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

      const result1 = importFromText(tempDir, text);
      assert.strictEqual(result1.success, true);

      const result2 = importFromText(tempDir, text);
      assert.strictEqual(result2.success, false);
      assert.ok(result2.error.includes('already exists'));
    });

    it('should allow different titles on same day', () => {
      const text1 = 'First Title\n\nContent 1.';
      const text2 = 'Second Title\n\nContent 2.';

      const result1 = importFromText(tempDir, text1);
      assert.strictEqual(result1.success, true);

      const result2 = importFromText(tempDir, text2);
      assert.strictEqual(result2.success, true);

      assert.notStrictEqual(result1.insightId, result2.insightId);
    });
  });

  describe('insight file content', () => {
    it('should include proper frontmatter', () => {
      const text = 'Test Title\n\nContent here.';
      const result = importFromText(tempDir, text, {
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
      const result = importFromText(tempDir, text);

      assert.strictEqual(result.success, true);

      const fileContent = fs.readFileSync(result.filePath, 'utf8');

      assert.ok(fileContent.includes('## 原始洞见'));
      assert.ok(fileContent.includes('This is the actual content'));
    });
  });
});
