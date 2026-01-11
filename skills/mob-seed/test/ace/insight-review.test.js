'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const {
  MODEL_ERAS,
  REVIEW_TRIGGERS,
  getCurrentModelEra,
  compareModelEras,
  isModelEraOutdated,
  getModelEraDistance,
  checkModelEraReview,
  getReviewTriggerLabel,
  findInsightsNeedingReview,
  generateReviewSummary,
  createReviewTrigger,
  checkObsolescence
} = require('../../lib/ace/insight-review');

describe('insight-review', () => {
  // Save and restore env var
  let originalModelEra;

  beforeEach(() => {
    originalModelEra = process.env.CLAUDE_MODEL_ERA;
    delete process.env.CLAUDE_MODEL_ERA;
  });

  afterEach(() => {
    if (originalModelEra !== undefined) {
      process.env.CLAUDE_MODEL_ERA = originalModelEra;
    } else {
      delete process.env.CLAUDE_MODEL_ERA;
    }
  });

  describe('constants', () => {
    it('should have model eras defined', () => {
      assert.ok(MODEL_ERAS.includes('claude-opus-4.5'));
      assert.ok(MODEL_ERAS.includes('claude-3-opus'));
      assert.ok(MODEL_ERAS.length >= 5);
    });

    it('should have review triggers defined', () => {
      assert.ok(REVIEW_TRIGGERS.model_upgrade);
      assert.ok(REVIEW_TRIGGERS.manual);
    });
  });

  describe('getCurrentModelEra', () => {
    it('should return default era when env not set', () => {
      const era = getCurrentModelEra();
      assert.strictEqual(era, 'claude-opus-4.5');
    });

    it('should return env var when set', () => {
      process.env.CLAUDE_MODEL_ERA = 'claude-opus-4';
      const era = getCurrentModelEra();
      assert.strictEqual(era, 'claude-opus-4');
    });
  });

  describe('compareModelEras', () => {
    it('should return 0 for equal eras', () => {
      assert.strictEqual(compareModelEras('claude-opus-4.5', 'claude-opus-4.5'), 0);
    });

    it('should return -1 for older era', () => {
      assert.strictEqual(compareModelEras('claude-3-opus', 'claude-opus-4.5'), -1);
    });

    it('should return 1 for newer era', () => {
      assert.strictEqual(compareModelEras('claude-opus-4.5', 'claude-3-opus'), 1);
    });

    it('should treat unknown era as oldest', () => {
      assert.strictEqual(compareModelEras('unknown', 'claude-3-opus'), -1);
    });
  });

  describe('isModelEraOutdated', () => {
    it('should return true for older era', () => {
      assert.strictEqual(isModelEraOutdated('claude-3-opus', 'claude-opus-4.5'), true);
    });

    it('should return false for current era', () => {
      assert.strictEqual(isModelEraOutdated('claude-opus-4.5', 'claude-opus-4.5'), false);
    });

    it('should return false for newer era', () => {
      assert.strictEqual(isModelEraOutdated('claude-opus-4.5', 'claude-3-opus'), false);
    });
  });

  describe('getModelEraDistance', () => {
    it('should return 0 for same era', () => {
      assert.strictEqual(getModelEraDistance('claude-opus-4.5', 'claude-opus-4.5'), 0);
    });

    it('should return positive distance for different eras', () => {
      const distance = getModelEraDistance('claude-3-opus', 'claude-opus-4.5');
      assert.ok(distance > 0);
    });

    it('should return -1 for unknown era', () => {
      assert.strictEqual(getModelEraDistance('unknown', 'claude-opus-4.5'), -1);
    });
  });

  describe('checkModelEraReview', () => {
    it('should not need review for current era', () => {
      const insight = { modelEra: 'claude-opus-4.5' };
      const result = checkModelEraReview(insight, { currentEra: 'claude-opus-4.5' });
      assert.strictEqual(result.needsReview, false);
      assert.strictEqual(result.reason, 'current');
    });

    it('should need review for outdated era', () => {
      const insight = { modelEra: 'claude-3-opus' };
      const result = checkModelEraReview(insight, { currentEra: 'claude-opus-4.5' });
      assert.strictEqual(result.needsReview, true);
      assert.strictEqual(result.reason, 'outdated');
    });

    it('should need review for missing era', () => {
      const insight = {};
      const result = checkModelEraReview(insight);
      assert.strictEqual(result.needsReview, true);
      assert.strictEqual(result.reason, 'missing_era');
    });

    it('should need review for unknown era', () => {
      const insight = { modelEra: 'unknown-era' };
      const result = checkModelEraReview(insight);
      assert.strictEqual(result.needsReview, true);
      assert.strictEqual(result.reason, 'unknown_era');
    });

    it('should respect custom threshold', () => {
      const insight = { modelEra: 'claude-opus-4' };
      // With threshold 2, one version difference should not trigger review
      const result = checkModelEraReview(insight, {
        currentEra: 'claude-opus-4.5',
        threshold: 2
      });
      assert.strictEqual(result.needsReview, false);
    });

    it('should handle model_era property name', () => {
      const insight = { model_era: 'claude-opus-4.5' };
      const result = checkModelEraReview(insight, { currentEra: 'claude-opus-4.5' });
      assert.strictEqual(result.needsReview, false);
    });
  });

  describe('getReviewTriggerLabel', () => {
    it('should return label for known trigger', () => {
      assert.strictEqual(getReviewTriggerLabel('model_upgrade'), '模型升级');
      assert.strictEqual(getReviewTriggerLabel('manual'), '手动触发');
    });

    it('should return trigger itself for unknown trigger', () => {
      assert.strictEqual(getReviewTriggerLabel('unknown'), 'unknown');
    });
  });

  describe('findInsightsNeedingReview', () => {
    const insights = [
      { id: 'ins-1', modelEra: 'claude-3-opus', status: 'evaluating' },
      { id: 'ins-2', modelEra: 'claude-opus-4.5', status: 'adopted' },
      { id: 'ins-3', modelEra: 'claude-opus-4', status: 'piloting' },
      { id: 'ins-4', modelEra: 'claude-3-opus', status: 'rejected' },
      { id: 'ins-5', status: 'evaluating' } // missing era
    ];

    it('should find insights needing review', () => {
      const results = findInsightsNeedingReview(insights, {
        currentEra: 'claude-opus-4.5'
      });
      // ins-1 (outdated), ins-3 (outdated), ins-5 (missing)
      // ins-4 is terminal and excluded by default
      assert.strictEqual(results.length, 3);
    });

    it('should include terminal states when requested', () => {
      const results = findInsightsNeedingReview(insights, {
        currentEra: 'claude-opus-4.5',
        includeTerminal: true
      });
      assert.strictEqual(results.length, 4);
    });

    it('should sort by distance descending', () => {
      const results = findInsightsNeedingReview(insights, {
        currentEra: 'claude-opus-4.5'
      });
      // Most outdated should be first
      const distances = results
        .filter(r => r.reviewStatus.distance)
        .map(r => r.reviewStatus.distance);
      for (let i = 1; i < distances.length; i++) {
        assert.ok(distances[i - 1] >= distances[i]);
      }
    });
  });

  describe('generateReviewSummary', () => {
    it('should generate summary from review results', () => {
      const reviewResults = [
        {
          insight: { id: 'ins-1' },
          reviewStatus: { reason: 'outdated', fromEra: 'claude-3-opus' }
        },
        {
          insight: { id: 'ins-2' },
          reviewStatus: { reason: 'outdated', fromEra: 'claude-3-opus' }
        },
        {
          insight: { id: 'ins-3' },
          reviewStatus: { reason: 'missing_era' }
        }
      ];

      const summary = generateReviewSummary(reviewResults);
      assert.strictEqual(summary.total, 3);
      assert.strictEqual(summary.byReason.outdated, 2);
      assert.strictEqual(summary.byReason.missing_era, 1);
      assert.strictEqual(summary.byEra['claude-3-opus'], 2);
    });
  });

  describe('createReviewTrigger', () => {
    it('should create review trigger record', () => {
      const trigger = createReviewTrigger('ins-123', 'model_upgrade', {
        notes: 'test'
      });
      assert.strictEqual(trigger.insightId, 'ins-123');
      assert.strictEqual(trigger.trigger, 'model_upgrade');
      assert.strictEqual(trigger.label, '模型升级');
      assert.ok(trigger.timestamp);
      assert.strictEqual(trigger.notes, 'test');
    });
  });

  describe('checkObsolescence', () => {
    it('should not obsolete current era insight', () => {
      const insight = { modelEra: 'claude-opus-4.5' };
      const result = checkObsolescence(insight, { currentEra: 'claude-opus-4.5' });
      assert.strictEqual(result.shouldObsolete, false);
    });

    it('should obsolete very old insights', () => {
      const insight = { modelEra: 'claude-3-opus' };
      const result = checkObsolescence(insight, {
        currentEra: 'claude-opus-4.5',
        obsoleteThreshold: 3
      });
      // claude-3-opus is 4 versions behind claude-opus-4.5
      assert.strictEqual(result.shouldObsolete, true);
    });

    it('should not obsolete insights without era', () => {
      const insight = {};
      const result = checkObsolescence(insight);
      assert.strictEqual(result.shouldObsolete, false);
      assert.strictEqual(result.reason, 'missing_era');
    });

    it('should respect custom threshold', () => {
      const insight = { modelEra: 'claude-opus-4' };
      // Distance is 1, with threshold 2 should not obsolete
      const result = checkObsolescence(insight, {
        currentEra: 'claude-opus-4.5',
        obsoleteThreshold: 2
      });
      assert.strictEqual(result.shouldObsolete, false);
    });
  });
});
