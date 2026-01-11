'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
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

describe('insight-types', () => {
  describe('constants', () => {
    it('should export InsightSourceTypes array', () => {
      assert.ok(Array.isArray(InsightSourceTypes));
      assert.ok(InsightSourceTypes.includes('expert_opinion'));
      assert.ok(InsightSourceTypes.includes('paper'));
      assert.ok(InsightSourceTypes.includes('blog'));
    });

    it('should export InsightCredibilityLevels array', () => {
      assert.ok(Array.isArray(InsightCredibilityLevels));
      assert.deepStrictEqual(InsightCredibilityLevels, ['high', 'medium', 'low']);
    });

    it('should export InsightStatusValues array', () => {
      assert.ok(Array.isArray(InsightStatusValues));
      assert.ok(InsightStatusValues.includes('evaluating'));
      assert.ok(InsightStatusValues.includes('adopted'));
      assert.ok(InsightStatusValues.includes('rejected'));
    });
  });

  describe('generateInsightId', () => {
    it('should generate ID from date and slug', () => {
      const date = new Date('2025-01-15');
      const id = generateInsightId(date, 'test-insight');
      assert.strictEqual(id, 'ins-20250115-test-insight');
    });

    it('should handle string date', () => {
      const id = generateInsightId('2025-03-20', 'my-slug');
      assert.strictEqual(id, 'ins-20250320-my-slug');
    });

    it('should sanitize slug', () => {
      const date = new Date('2025-01-01');
      const id = generateInsightId(date, 'Test Slug With Spaces!');
      assert.strictEqual(id, 'ins-20250101-test-slug-with-spaces');
    });

    it('should truncate long slugs', () => {
      const date = new Date('2025-01-01');
      const longSlug = 'this-is-a-very-long-slug-that-should-be-truncated';
      const id = generateInsightId(date, longSlug);
      // Format: ins-YYYYMMDD-{slug} = 4 + 8 + 1 + 30 = 43 max
      assert.ok(id.length <= 43, `ID too long: ${id} (${id.length} chars)`);
    });
  });

  describe('isValidInsightId', () => {
    it('should return true for valid ID', () => {
      assert.strictEqual(isValidInsightId('ins-20250115-test'), true);
    });

    it('should return false for invalid format', () => {
      assert.strictEqual(isValidInsightId('invalid-id'), false);
      assert.strictEqual(isValidInsightId('ins-2025-test'), false);
      assert.strictEqual(isValidInsightId('obs-20250115-test'), false);
    });

    it('should return false for null/undefined', () => {
      assert.strictEqual(isValidInsightId(null), false);
      assert.strictEqual(isValidInsightId(undefined), false);
    });
  });

  describe('parseInsightId', () => {
    it('should parse valid ID', () => {
      const result = parseInsightId('ins-20250315-my-slug');
      assert.ok(result);
      assert.strictEqual(result.dateStr, '2025-03-15');
      assert.strictEqual(result.slug, 'my-slug');
    });

    it('should return null for invalid ID', () => {
      assert.strictEqual(parseInsightId('invalid'), null);
    });
  });

  describe('validation functions', () => {
    it('isValidSourceType should validate source types', () => {
      assert.strictEqual(isValidSourceType('expert_opinion'), true);
      assert.strictEqual(isValidSourceType('paper'), true);
      assert.strictEqual(isValidSourceType('invalid_type'), false);
    });

    it('isValidCredibility should validate credibility levels', () => {
      assert.strictEqual(isValidCredibility('high'), true);
      assert.strictEqual(isValidCredibility('medium'), true);
      assert.strictEqual(isValidCredibility('invalid'), false);
    });

    it('isValidStatus should validate status values', () => {
      assert.strictEqual(isValidStatus('evaluating'), true);
      assert.strictEqual(isValidStatus('adopted'), true);
      assert.strictEqual(isValidStatus('invalid'), false);
    });
  });

  describe('validateSource', () => {
    it('should validate valid source', () => {
      const source = {
        title: 'Test Source',
        type: 'expert_opinion',
        date: '2025-01-15',
        credibility: 'high'
      };
      const result = validateSource(source);
      assert.strictEqual(result.isValid, true);
      assert.deepStrictEqual(result.errors, []);
    });

    it('should fail for missing required fields', () => {
      const source = { title: 'Test' };
      const result = validateSource(source);
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.length > 0);
    });

    it('should fail for null source', () => {
      const result = validateSource(null);
      assert.strictEqual(result.isValid, false);
    });
  });

  describe('validateInsight', () => {
    it('should validate valid insight', () => {
      const insight = {
        id: 'ins-20250115-test',
        date: '2025-01-15',
        status: 'evaluating',
        source: {
          title: 'Test',
          type: 'expert_opinion',
          date: '2025-01-15',
          credibility: 'medium'
        }
      };
      const result = validateInsight(insight);
      assert.strictEqual(result.isValid, true);
    });

    it('should fail for invalid insight', () => {
      const insight = {
        id: 'invalid-id',
        status: 'invalid'
      };
      const result = validateInsight(insight);
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.length > 0);
    });
  });

  describe('createDefaultInsight', () => {
    it('should create insight with defaults', () => {
      const insight = createDefaultInsight();
      assert.ok(insight.id.startsWith('ins-'));
      assert.strictEqual(insight.status, 'evaluating');
      assert.ok(insight.source);
    });

    it('should apply overrides', () => {
      const insight = createDefaultInsight({
        status: 'adopted',
        tags: ['test', 'demo']
      });
      assert.strictEqual(insight.status, 'adopted');
      assert.deepStrictEqual(insight.tags, ['test', 'demo']);
    });
  });
});
