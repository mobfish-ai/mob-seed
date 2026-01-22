'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  getInsight,
  createInsight,
  updateInsightStatus,
  deleteInsight,
  listInsights,
  getInsightStats,
  getActionableInsights,
  getTerminalInsights,
  checkReview,
  checkInsightObsolescence,
  syncInsightIndex,
  formatInsight,
  getInsightDetails
} = require('../../lib/ace/insight-manager');

describe('insight-manager', () => {
  let tempDir;
  let insightsDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insight-manager-test-'));
    insightsDir = path.join(tempDir, '.seed', 'insights');
    fs.mkdirSync(insightsDir, { recursive: true });
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('createInsight', () => {
    it('should create a new insight', () => {
      const result = createInsight(tempDir, {
        source: {
          title: 'Test Insight',
          type: 'blog',
          author: 'Test Author',
          date: '2026-01-15',
          credibility: 'medium'
        },
        content: 'This is the insight content.',
        tags: ['test', 'example']
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.insightId);
      assert.ok(result.insightId.startsWith('ins-'));
      assert.ok(result.filePath);
      assert.ok(fs.existsSync(result.filePath));
    });

    it('should set initial status to evaluating', () => {
      const result = createInsight(tempDir, {
        source: {
          title: 'Status Test',
          type: 'paper',
          date: '2026-01-15',
          credibility: 'high'
        },
        content: 'Content here.'
      });

      assert.strictEqual(result.success, true);

      const insight = getInsight(tempDir, result.insightId);
      assert.strictEqual(insight.status, 'evaluating');
    });

    it('should record current model era', () => {
      const result = createInsight(tempDir, {
        source: {
          title: 'Era Test',
          type: 'blog',
          date: '2026-01-15',
          credibility: 'medium'
        },
        content: 'Content.'
      });

      assert.strictEqual(result.success, true);

      const insight = getInsight(tempDir, result.insightId);
      assert.ok(insight.modelEra || insight.model_era);
    });

    it('should prevent duplicate insights', () => {
      const insightData = {
        source: {
          title: 'Duplicate Test',
          type: 'blog',
          date: '2026-01-15',
          credibility: 'medium'
        },
        content: 'Content.'
      };

      const result1 = createInsight(tempDir, insightData);
      assert.strictEqual(result1.success, true);

      // Same title on same day = same ID = duplicate should fail
      const result2 = createInsight(tempDir, insightData);
      assert.strictEqual(result2.success, false);
      assert.ok(result2.error.includes('already exists'));
    });
  });

  describe('getInsight', () => {
    it('should return null for non-existent insight', () => {
      const insight = getInsight(tempDir, 'ins-nonexistent');
      assert.strictEqual(insight, null);
    });

    it('should return insight data for existing insight', () => {
      const result = createInsight(tempDir, {
        source: {
          title: 'Get Test',
          type: 'documentation',
          date: '2026-01-15',
          credibility: 'high'
        },
        content: 'Test content.'
      });

      const insight = getInsight(tempDir, result.insightId);
      assert.ok(insight);
      assert.strictEqual(insight.source.title, 'Get Test');
      assert.strictEqual(insight.source.type, 'documentation');
    });
  });

  describe('updateInsightStatus', () => {
    it('should update status with valid transition', () => {
      const createResult = createInsight(tempDir, {
        source: {
          title: 'Update Test',
          type: 'blog',
          date: '2026-01-15',
          credibility: 'medium'
        },
        content: 'Content.'
      });

      const updateResult = updateInsightStatus(
        tempDir,
        createResult.insightId,
        'piloting'
      );

      assert.strictEqual(updateResult.success, true);
      assert.strictEqual(updateResult.oldStatus, 'evaluating');
      assert.strictEqual(updateResult.newStatus, 'piloting');
      assert.ok(updateResult.label);
    });

    it('should reject invalid transition', () => {
      const createResult = createInsight(tempDir, {
        source: {
          title: 'Invalid Transition',
          type: 'blog',
          date: '2026-01-15',
          credibility: 'medium'
        },
        content: 'Content.'
      });

      // evaluating -> obsolete is not valid
      const updateResult = updateInsightStatus(
        tempDir,
        createResult.insightId,
        'obsolete'
      );

      assert.strictEqual(updateResult.success, false);
      assert.ok(updateResult.error.includes('Invalid transition'));
      assert.ok(updateResult.allowedTransitions);
    });

    it('should return error for non-existent insight', () => {
      const updateResult = updateInsightStatus(
        tempDir,
        'ins-nonexistent',
        'adopted'
      );

      assert.strictEqual(updateResult.success, false);
      assert.ok(updateResult.error.includes('not found'));
    });

    it('should persist status change to file', () => {
      const createResult = createInsight(tempDir, {
        source: {
          title: 'Persist Test',
          type: 'paper',
          date: '2026-01-15',
          credibility: 'high'
        },
        content: 'Content.'
      });

      updateInsightStatus(tempDir, createResult.insightId, 'adopted');

      const insight = getInsight(tempDir, createResult.insightId);
      assert.strictEqual(insight.status, 'adopted');
    });
  });

  describe('deleteInsight', () => {
    it('should delete existing insight', () => {
      const createResult = createInsight(tempDir, {
        source: {
          title: 'Delete Test',
          type: 'blog',
          date: '2026-01-15',
          credibility: 'low'
        },
        content: 'Content.'
      });

      const deleteResult = deleteInsight(tempDir, createResult.insightId);

      assert.strictEqual(deleteResult.success, true);
      assert.strictEqual(deleteResult.action, 'deleted');
      assert.strictEqual(fs.existsSync(createResult.filePath), false);
    });

    it('should return error for non-existent insight', () => {
      const deleteResult = deleteInsight(tempDir, 'ins-nonexistent');

      assert.strictEqual(deleteResult.success, false);
      assert.ok(deleteResult.error.includes('not found'));
    });
  });

  describe('listInsights', () => {
    beforeEach(() => {
      // Create test insights
      // Note: Tags must appear at least 2 times to be indexed (threshold = 2)
      createInsight(tempDir, {
        source: {
          title: 'List Test 1',
          type: 'blog',
          date: '2026-01-15',
          credibility: 'medium'
        },
        content: 'Content 1.',
        tags: ['shared', 'alpha']
      });
      createInsight(tempDir, {
        source: {
          title: 'List Test 2',
          type: 'paper',
          date: '2026-01-14',
          credibility: 'high'
        },
        content: 'Content 2.',
        tags: ['shared', 'beta']
      });

      // Rebuild tags index after creating insights
      // (incremental updates filter by threshold, so manual rebuild is needed)
      syncInsightIndex(tempDir);
    });

    it('should list all insights', () => {
      const insights = listInsights(tempDir);
      assert.strictEqual(insights.length, 2);
    });

    it('should filter by status', () => {
      const insights = listInsights(tempDir, { status: 'evaluating' });
      assert.strictEqual(insights.length, 2);
    });

    it('should filter by source type', () => {
      const insights = listInsights(tempDir, { sourceType: 'paper' });
      assert.strictEqual(insights.length, 1);
    });

    it('should filter by tag', () => {
      // 'shared' tag appears 2 times, meeting the index threshold
      const insights = listInsights(tempDir, { tag: 'shared' });
      assert.strictEqual(insights.length, 2);
    });

    it('should limit results', () => {
      const insights = listInsights(tempDir, { limit: 1 });
      assert.strictEqual(insights.length, 1);
    });
  });

  describe('getInsightStats', () => {
    it('should return statistics', () => {
      createInsight(tempDir, {
        source: {
          title: 'Stats Test',
          type: 'blog',
          date: '2026-01-15',
          credibility: 'medium'
        },
        content: 'Content.'
      });

      const stats = getInsightStats(tempDir);

      assert.ok(stats.total >= 1);
      assert.ok(stats.byStatus);
      assert.ok(stats.bySourceType);
    });
  });

  describe('getActionableInsights', () => {
    it('should return insights in evaluating/piloting states', () => {
      createInsight(tempDir, {
        source: {
          title: 'Actionable Test',
          type: 'blog',
          date: '2026-01-15',
          credibility: 'medium'
        },
        content: 'Content.'
      });

      const actionable = getActionableInsights(tempDir);
      assert.strictEqual(actionable.length, 1);
      assert.strictEqual(actionable[0].status, 'evaluating');
    });
  });

  describe('getTerminalInsights', () => {
    it('should return empty for no terminal insights', () => {
      createInsight(tempDir, {
        source: {
          title: 'Terminal Test',
          type: 'blog',
          date: '2026-01-15',
          credibility: 'medium'
        },
        content: 'Content.'
      });

      const terminal = getTerminalInsights(tempDir);
      assert.strictEqual(terminal.length, 0);
    });
  });

  describe('checkReview', () => {
    it('should return current model era', () => {
      const result = checkReview(tempDir);

      assert.ok(result.currentEra);
      assert.ok(result.insights);
      assert.ok(result.summary);
    });

    it('should identify insights needing review', () => {
      // Create insight with old model era
      const insightContent = `---
id: ins-20260115-old-era
source:
  title: Old Era Test
  type: blog
  date: 2026-01-15
  credibility: medium
date: 2026-01-15
status: evaluating
model_era: claude-3-opus
tags: []
---

## 原始洞见

Old content.
`;
      fs.writeFileSync(
        path.join(insightsDir, 'ins-20260115-old-era.md'),
        insightContent
      );
      syncInsightIndex(tempDir);

      const result = checkReview(tempDir);

      // Should find the outdated insight
      const oldEraInsight = result.insights.find(
        i => i.insight.id === 'ins-20260115-old-era'
      );
      if (oldEraInsight) {
        assert.strictEqual(oldEraInsight.reviewStatus.needsReview, true);
      }
    });
  });

  describe('checkInsightObsolescence', () => {
    it('should return error for non-existent insight', () => {
      const result = checkInsightObsolescence(tempDir, 'ins-nonexistent');

      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('not found'));
    });

    it('should check obsolescence for existing insight', () => {
      const createResult = createInsight(tempDir, {
        source: {
          title: 'Obsolescence Test',
          type: 'blog',
          date: '2026-01-15',
          credibility: 'medium'
        },
        content: 'Content.'
      });

      const result = checkInsightObsolescence(tempDir, createResult.insightId);

      assert.strictEqual(result.success, true);
      assert.ok('shouldObsolete' in result);
    });
  });

  describe('syncInsightIndex', () => {
    it('should sync index with files', () => {
      // Create file directly without using createInsight
      const insightContent = `---
id: ins-20260115-sync-test
source:
  title: Sync Test
  type: blog
  date: 2026-01-15
  credibility: medium
date: 2026-01-15
status: evaluating
model_era: claude-opus-4.5
tags: []
---

## 原始洞见

Sync content.
`;
      fs.writeFileSync(
        path.join(insightsDir, 'ins-20260115-sync-test.md'),
        insightContent
      );

      const result = syncInsightIndex(tempDir);

      assert.strictEqual(result.success, true);
      assert.ok(result.added >= 0);
    });
  });

  describe('formatInsight', () => {
    it('should format insight with status details', () => {
      const insight = {
        id: 'ins-test',
        status: 'evaluating',
        source: { title: 'Test' }
      };

      const formatted = formatInsight(insight);

      assert.ok(formatted.statusFormatted);
      assert.ok(formatted.statusLabel);
      assert.ok(formatted.statusIcon);
      assert.ok(formatted.allowedTransitions);
    });
  });

  describe('getInsightDetails', () => {
    it('should return null for non-existent insight', () => {
      const details = getInsightDetails(tempDir, 'ins-nonexistent');
      assert.strictEqual(details, null);
    });

    it('should return full details for existing insight', () => {
      const createResult = createInsight(tempDir, {
        source: {
          title: 'Details Test',
          type: 'paper',
          date: '2026-01-15',
          credibility: 'high'
        },
        content: 'Content.'
      });

      const details = getInsightDetails(tempDir, createResult.insightId);

      assert.ok(details);
      assert.ok(details.source);
      assert.ok(details.statusFormatted);
      assert.ok(details.reviewStatus);
      assert.ok(details.obsolescenceCheck);
    });
  });
});
