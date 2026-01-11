'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  extractTitle,
  extractAuthor,
  extractDate,
  extractTags,
  extractAffiliation,
  inferSourceType,
  inferCredibility,
  extractFromText,
  generateTagsFromText,
  validateMetadata,
  DomainSourceTypeMap,
  DomainCredibilityMap
} = require('../../lib/ace/insight-extractor');

describe('insight-extractor', () => {
  describe('extractTitle', () => {
    it('should extract title from og:title meta tag', () => {
      const html = '<meta property="og:title" content="Test Article Title">';
      const title = extractTitle(html);
      assert.strictEqual(title, 'Test Article Title');
    });

    it('should extract title from twitter:title meta tag', () => {
      const html = '<meta name="twitter:title" content="Twitter Title">';
      const title = extractTitle(html);
      assert.strictEqual(title, 'Twitter Title');
    });

    it('should extract title from title tag', () => {
      const html = '<html><head><title>Page Title</title></head></html>';
      const title = extractTitle(html);
      assert.strictEqual(title, 'Page Title');
    });

    it('should extract title from h1 tag', () => {
      const html = '<body><h1>Heading Title</h1></body>';
      const title = extractTitle(html);
      assert.strictEqual(title, 'Heading Title');
    });

    it('should return null when no title found', () => {
      const html = '<body><p>Just content</p></body>';
      const title = extractTitle(html);
      assert.strictEqual(title, null);
    });

    it('should decode HTML entities in title', () => {
      const html = '<title>Test &amp; Article</title>';
      const title = extractTitle(html);
      assert.strictEqual(title, 'Test & Article');
    });

    it('should prefer og:title over title tag', () => {
      const html = '<html><head><meta property="og:title" content="OG Title"><title>Page Title</title></head></html>';
      const title = extractTitle(html);
      assert.strictEqual(title, 'OG Title');
    });
  });

  describe('extractAuthor', () => {
    it('should extract author from meta author tag', () => {
      const html = '<meta name="author" content="John Doe">';
      const author = extractAuthor(html);
      assert.strictEqual(author, 'John Doe');
    });

    it('should extract author from article:author', () => {
      const html = '<meta property="article:author" content="Jane Smith">';
      const author = extractAuthor(html);
      assert.strictEqual(author, 'Jane Smith');
    });

    it('should extract author from twitter:creator', () => {
      const html = '<meta name="twitter:creator" content="@author">';
      const author = extractAuthor(html);
      assert.strictEqual(author, '@author');
    });

    it('should extract author from schema.org JSON', () => {
      const html = '{"author": {"name": "Schema Author"}}';
      const author = extractAuthor(html);
      assert.strictEqual(author, 'Schema Author');
    });

    it('should return null when no author found', () => {
      const html = '<body><p>Content without author</p></body>';
      const author = extractAuthor(html);
      assert.strictEqual(author, null);
    });
  });

  describe('extractDate', () => {
    it('should extract date from article:published_time', () => {
      const html = '<meta property="article:published_time" content="2026-01-15T10:00:00Z">';
      const date = extractDate(html);
      assert.strictEqual(date, '2026-01-15');
    });

    it('should extract date from schema.org datePublished', () => {
      const html = '{"datePublished": "2026-01-10"}';
      const date = extractDate(html);
      assert.strictEqual(date, '2026-01-10');
    });

    it('should extract date from time element', () => {
      const html = '<time datetime="2026-01-05T09:00:00Z">Jan 5, 2026</time>';
      const date = extractDate(html);
      assert.strictEqual(date, '2026-01-05');
    });

    it('should return null when no date found', () => {
      const html = '<body><p>No date here</p></body>';
      const date = extractDate(html);
      assert.strictEqual(date, null);
    });
  });

  describe('extractTags', () => {
    it('should extract tags from meta keywords', () => {
      const html = '<meta name="keywords" content="javascript, testing, nodejs">';
      const tags = extractTags(html);
      assert.ok(tags.includes('javascript'));
      assert.ok(tags.includes('testing'));
      assert.ok(tags.includes('nodejs'));
    });

    it('should extract tags from article:tag', () => {
      const html = `
        <meta property="article:tag" content="React">
        <meta property="article:tag" content="Frontend">
      `;
      const tags = extractTags(html);
      assert.ok(tags.includes('react'));
      assert.ok(tags.includes('frontend'));
    });

    it('should return empty array when no tags found', () => {
      const html = '<body><p>No tags</p></body>';
      const tags = extractTags(html);
      assert.deepStrictEqual(tags, []);
    });

    it('should limit tags to 10', () => {
      const keywords = Array.from({ length: 20 }, (_, i) => `tag${i}`).join(', ');
      const html = `<meta name="keywords" content="${keywords}">`;
      const tags = extractTags(html);
      assert.ok(tags.length <= 10);
    });
  });

  describe('extractAffiliation', () => {
    it('should extract affiliation from og:site_name', () => {
      const html = '<meta property="og:site_name" content="TechCorp Blog">';
      const affiliation = extractAffiliation(html);
      assert.strictEqual(affiliation, 'TechCorp Blog');
    });

    it('should extract affiliation from schema.org publisher', () => {
      const html = '{"publisher": {"name": "Tech Publisher"}}';
      const affiliation = extractAffiliation(html);
      assert.strictEqual(affiliation, 'Tech Publisher');
    });

    it('should return null when no affiliation found', () => {
      const html = '<body><p>No affiliation</p></body>';
      const affiliation = extractAffiliation(html);
      assert.strictEqual(affiliation, null);
    });
  });

  describe('inferSourceType', () => {
    it('should infer paper type from arxiv.org', () => {
      const type = inferSourceType('https://arxiv.org/abs/2301.00000');
      assert.strictEqual(type, 'paper');
    });

    it('should infer documentation type from docs.github.com', () => {
      const type = inferSourceType('https://docs.github.com/en/get-started');
      assert.strictEqual(type, 'documentation');
    });

    it('should infer blog type from medium.com', () => {
      const type = inferSourceType('https://medium.com/@author/article');
      assert.strictEqual(type, 'blog');
    });

    it('should infer discussion type from twitter.com', () => {
      const type = inferSourceType('https://twitter.com/user/status/123');
      assert.strictEqual(type, 'discussion');
    });

    it('should default to blog for unknown domains', () => {
      const type = inferSourceType('https://example.com/article');
      assert.strictEqual(type, 'blog');
    });

    it('should handle invalid URLs gracefully', () => {
      const type = inferSourceType('not-a-url');
      assert.strictEqual(type, 'blog');
    });
  });

  describe('inferCredibility', () => {
    it('should infer high credibility from arxiv.org', () => {
      const credibility = inferCredibility('https://arxiv.org/abs/2301.00000');
      assert.strictEqual(credibility, 'high');
    });

    it('should infer medium credibility from medium.com', () => {
      const credibility = inferCredibility('https://medium.com/@author/article');
      assert.strictEqual(credibility, 'medium');
    });

    it('should infer low credibility from twitter.com', () => {
      const credibility = inferCredibility('https://twitter.com/user/status/123');
      assert.strictEqual(credibility, 'low');
    });

    it('should default to medium for unknown domains', () => {
      const credibility = inferCredibility('https://example.com/article');
      assert.strictEqual(credibility, 'medium');
    });

    it('should handle invalid URLs gracefully', () => {
      const credibility = inferCredibility('not-a-url');
      assert.strictEqual(credibility, 'medium');
    });
  });

  describe('extractFromText', () => {
    it('should extract title from first line', () => {
      const text = 'My Article Title\n\nThis is the content.';
      const result = extractFromText(text);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.metadata.title, 'My Article Title');
    });

    it('should remove markdown heading markers from title', () => {
      const text = '# Markdown Title\n\nContent here.';
      const result = extractFromText(text);
      assert.strictEqual(result.metadata.title, 'Markdown Title');
    });

    it('should extract author from "By Author" pattern', () => {
      const text = 'Title\nBy John Doe\n\nContent.';
      const result = extractFromText(text);
      assert.strictEqual(result.metadata.author, 'John Doe');
    });

    it('should extract author from "作者:" pattern', () => {
      const text = 'Title\n作者: 张三\n\nContent.';
      const result = extractFromText(text);
      assert.strictEqual(result.metadata.author, '张三');
    });

    it('should use hints when provided', () => {
      const text = 'Title\n\nContent.';
      const result = extractFromText(text, {
        sourceType: 'paper',
        author: 'Hint Author',
        credibility: 'high'
      });
      assert.strictEqual(result.metadata.type, 'paper');
      assert.strictEqual(result.metadata.author, 'Hint Author');
      assert.strictEqual(result.metadata.credibility, 'high');
    });

    it('should generate tags from content', () => {
      const text = 'JavaScript Testing\n\nThis article covers javascript testing and nodejs best practices.';
      const result = extractFromText(text);
      assert.ok(result.metadata.tags.length > 0);
    });

    it('should truncate very long titles', () => {
      const longTitle = 'A'.repeat(300);
      const text = `${longTitle}\n\nContent.`;
      const result = extractFromText(text);
      assert.ok(result.metadata.title.length <= 200);
    });
  });

  describe('generateTagsFromText', () => {
    it('should extract common words as tags', () => {
      const text = 'javascript testing nodejs javascript nodejs nodejs';
      const tags = generateTagsFromText(text);
      assert.ok(tags.includes('nodejs'));
    });

    it('should filter out stop words', () => {
      const text = 'the and for are but not javascript testing';
      const tags = generateTagsFromText(text);
      assert.ok(!tags.includes('the'));
      assert.ok(!tags.includes('and'));
    });

    it('should limit tags to 5', () => {
      const text = 'word1 word2 word3 word4 word5 word6 word7 word8';
      const tags = generateTagsFromText(text);
      assert.ok(tags.length <= 5);
    });

    it('should only include alphanumeric words', () => {
      const text = 'valid-word 123number @mention $special';
      const tags = generateTagsFromText(text);
      assert.ok(!tags.includes('@mention'));
      assert.ok(!tags.includes('$special'));
    });
  });

  describe('validateMetadata', () => {
    it('should pass for valid metadata', () => {
      const metadata = {
        title: 'Test Title',
        author: 'Test Author',
        date: '2026-01-15',
        type: 'blog',
        credibility: 'medium',
        tags: ['test']
      };
      const result = validateMetadata(metadata);
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it('should fail when title is missing', () => {
      const metadata = {
        author: 'Test Author',
        date: '2026-01-15'
      };
      const result = validateMetadata(metadata);
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.some(e => e.includes('Title')));
    });

    it('should warn when date is missing', () => {
      const metadata = {
        title: 'Test Title',
        author: 'Test Author'
      };
      const result = validateMetadata(metadata);
      assert.strictEqual(result.isValid, true);
      assert.ok(result.warnings.some(w => w.includes('Date')));
    });

    it('should warn when author is missing', () => {
      const metadata = {
        title: 'Test Title',
        date: '2026-01-15'
      };
      const result = validateMetadata(metadata);
      assert.strictEqual(result.isValid, true);
      assert.ok(result.warnings.some(w => w.includes('Author')));
    });

    it('should warn when no tags', () => {
      const metadata = {
        title: 'Test Title',
        date: '2026-01-15',
        tags: []
      };
      const result = validateMetadata(metadata);
      assert.ok(result.warnings.some(w => w.includes('tags')));
    });
  });

  describe('DomainSourceTypeMap', () => {
    it('should have entries for academic sources', () => {
      assert.strictEqual(DomainSourceTypeMap['arxiv.org'], 'paper');
      assert.strictEqual(DomainSourceTypeMap['nature.com'], 'paper');
    });

    it('should have entries for documentation sources', () => {
      assert.strictEqual(DomainSourceTypeMap['developer.mozilla.org'], 'documentation');
      assert.strictEqual(DomainSourceTypeMap['nodejs.org'], 'documentation');
    });

    it('should have entries for blog sources', () => {
      assert.strictEqual(DomainSourceTypeMap['medium.com'], 'blog');
      assert.strictEqual(DomainSourceTypeMap['dev.to'], 'blog');
    });
  });

  describe('DomainCredibilityMap', () => {
    it('should have high credibility for academic sources', () => {
      assert.strictEqual(DomainCredibilityMap['arxiv.org'], 'high');
      assert.strictEqual(DomainCredibilityMap['nature.com'], 'high');
    });

    it('should have medium credibility for tech blogs', () => {
      assert.strictEqual(DomainCredibilityMap['medium.com'], 'medium');
      assert.strictEqual(DomainCredibilityMap['stackoverflow.com'], 'medium');
    });

    it('should have low credibility for social media', () => {
      assert.strictEqual(DomainCredibilityMap['twitter.com'], 'low');
      assert.strictEqual(DomainCredibilityMap['reddit.com'], 'low');
    });
  });
});
