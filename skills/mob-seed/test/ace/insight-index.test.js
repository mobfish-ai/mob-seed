'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  createEmptyIndex,
  calculateStats,
  loadIndex,
  saveIndex,
  rebuildIndex,
  getIndex,
  addToIndex,
  removeFromIndex,
  updateStatus,
  queryInsights,
  getStats,
  syncIndex
} = require('../../lib/ace/insight-index');

describe('insight-index', () => {
  let tempDir;
  let insightsDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insight-index-test-'));
    insightsDir = path.join(tempDir, '.seed', 'insights');
    fs.mkdirSync(insightsDir, { recursive: true });
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('createEmptyIndex', () => {
    it('should create empty index with correct structure', () => {
      const index = createEmptyIndex();
      assert.strictEqual(index.version, '1.0.0');
      assert.ok(index.updated);
      assert.deepStrictEqual(index.insights, []);
      assert.strictEqual(index.stats.total, 0);
    });

    it('should have all status counts initialized to 0', () => {
      const index = createEmptyIndex();
      assert.strictEqual(index.stats.byStatus.evaluating, 0);
      assert.strictEqual(index.stats.byStatus.adopted, 0);
      assert.strictEqual(index.stats.byStatus.obsolete, 0);
    });
  });

  describe('calculateStats', () => {
    it('should calculate stats from insights list', () => {
      const insights = [
        { status: 'evaluating', sourceType: 'blog' },
        { status: 'evaluating', sourceType: 'paper' },
        { status: 'adopted', sourceType: 'blog' }
      ];
      const stats = calculateStats(insights);
      assert.strictEqual(stats.total, 3);
      assert.strictEqual(stats.byStatus.evaluating, 2);
      assert.strictEqual(stats.byStatus.adopted, 1);
      assert.strictEqual(stats.bySourceType.blog, 2);
      assert.strictEqual(stats.bySourceType.paper, 1);
    });

    it('should handle empty insights list', () => {
      const stats = calculateStats([]);
      assert.strictEqual(stats.total, 0);
    });
  });

  describe('loadIndex / saveIndex', () => {
    it('should save and load index', () => {
      const indexPath = path.join(insightsDir, 'index.json');
      const index = createEmptyIndex();
      index.insights.push({ id: 'ins-20260115-test', status: 'evaluating' });

      const saved = saveIndex(indexPath, index);
      assert.strictEqual(saved, true);

      const loaded = loadIndex(indexPath);
      assert.strictEqual(loaded.insights.length, 1);
      assert.strictEqual(loaded.insights[0].id, 'ins-20260115-test');
    });

    it('should return empty index for non-existent file', () => {
      const loaded = loadIndex('/nonexistent/path/index.json');
      assert.deepStrictEqual(loaded.insights, []);
    });

    it('should create directory if not exists', () => {
      const nestedPath = path.join(tempDir, 'nested', 'dir', 'index.json');
      const index = createEmptyIndex();
      const saved = saveIndex(nestedPath, index);
      assert.strictEqual(saved, true);
      assert.ok(fs.existsSync(nestedPath));
    });
  });

  describe('rebuildIndex', () => {
    it('should rebuild index from insight files', () => {
      // Create test insight files
      const insight1 = `---
id: ins-20260115-test1
source:
  title: Test 1
  type: blog
  date: 2026-01-15
  credibility: medium
date: 2026-01-15
status: evaluating
model_era: claude-opus-4.5
tags: [test]
---

## 原始洞见

Test content 1
`;
      const insight2 = `---
id: ins-20260114-test2
source:
  title: Test 2
  type: paper
  date: 2026-01-14
  credibility: high
date: 2026-01-14
status: adopted
model_era: claude-opus-4.5
tags: [test]
---

## 原始洞见

Test content 2
`;
      fs.writeFileSync(path.join(insightsDir, 'ins-20260115-test1.md'), insight1);
      fs.writeFileSync(path.join(insightsDir, 'ins-20260114-test2.md'), insight2);

      const index = rebuildIndex(insightsDir);
      assert.strictEqual(index.insights.length, 2);
      // Should be sorted by date descending
      assert.strictEqual(index.insights[0].id, 'ins-20260115-test1');
      assert.strictEqual(index.insights[1].id, 'ins-20260114-test2');
    });

    it('should return empty index for non-existent directory', () => {
      const index = rebuildIndex('/nonexistent/dir');
      assert.deepStrictEqual(index.insights, []);
    });
  });

  describe('addToIndex', () => {
    it('should add new insight to index', () => {
      const insightMeta = {
        id: 'ins-20260115-new',
        status: 'evaluating',
        date: '2026-01-15'
      };
      const result = addToIndex(tempDir, insightMeta);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.action, 'added');
      assert.strictEqual(result.index.insights.length, 1);
    });

    it('should update existing insight', () => {
      const insightMeta = {
        id: 'ins-20260115-existing',
        status: 'evaluating',
        date: '2026-01-15'
      };
      addToIndex(tempDir, insightMeta);

      insightMeta.status = 'adopted';
      const result = addToIndex(tempDir, insightMeta);
      assert.strictEqual(result.action, 'updated');
      assert.strictEqual(result.index.insights[0].status, 'adopted');
    });
  });

  describe('removeFromIndex', () => {
    it('should remove insight from index', () => {
      const insightMeta = {
        id: 'ins-20260115-remove',
        status: 'evaluating',
        date: '2026-01-15'
      };
      addToIndex(tempDir, insightMeta);

      const result = removeFromIndex(tempDir, 'ins-20260115-remove');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.action, 'removed');
      assert.strictEqual(result.index.insights.length, 0);
    });

    it('should return error for non-existent insight', () => {
      const result = removeFromIndex(tempDir, 'nonexistent');
      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('not found'));
    });
  });

  describe('updateStatus', () => {
    it('should update insight status', () => {
      const insightMeta = {
        id: 'ins-20260115-status',
        status: 'evaluating',
        date: '2026-01-15'
      };
      addToIndex(tempDir, insightMeta);

      const result = updateStatus(tempDir, 'ins-20260115-status', 'adopted');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.oldStatus, 'evaluating');
      assert.strictEqual(result.newStatus, 'adopted');
    });

    it('should return error for non-existent insight', () => {
      const result = updateStatus(tempDir, 'nonexistent', 'adopted');
      assert.strictEqual(result.success, false);
    });
  });

  describe('queryInsights', () => {
    beforeEach(() => {
      // Add test insights
      addToIndex(tempDir, {
        id: 'ins-20260115-q1',
        status: 'evaluating',
        sourceType: 'blog',
        tags: ['test', 'alpha'],
        modelEra: 'claude-opus-4.5',
        date: '2026-01-15'
      });
      addToIndex(tempDir, {
        id: 'ins-20260114-q2',
        status: 'adopted',
        sourceType: 'paper',
        tags: ['test', 'beta'],
        modelEra: 'claude-opus-4',
        date: '2026-01-14'
      });
      addToIndex(tempDir, {
        id: 'ins-20260113-q3',
        status: 'evaluating',
        sourceType: 'blog',
        tags: ['gamma'],
        modelEra: 'claude-opus-4.5',
        date: '2026-01-13'
      });
    });

    it('should filter by status', () => {
      const results = queryInsights(tempDir, { status: 'evaluating' });
      assert.strictEqual(results.length, 2);
    });

    it('should filter by source type', () => {
      const results = queryInsights(tempDir, { sourceType: 'paper' });
      assert.strictEqual(results.length, 1);
    });

    it('should filter by tag', () => {
      const results = queryInsights(tempDir, { tag: 'test' });
      assert.strictEqual(results.length, 2);
    });

    it('should filter by model era', () => {
      const results = queryInsights(tempDir, { modelEra: 'claude-opus-4.5' });
      assert.strictEqual(results.length, 2);
    });

    it('should filter by date range', () => {
      const results = queryInsights(tempDir, {
        startDate: '2026-01-14',
        endDate: '2026-01-15'
      });
      assert.strictEqual(results.length, 2);
    });

    it('should limit results', () => {
      const results = queryInsights(tempDir, { limit: 1 });
      assert.strictEqual(results.length, 1);
    });

    it('should combine filters', () => {
      const results = queryInsights(tempDir, {
        status: 'evaluating',
        sourceType: 'blog'
      });
      assert.strictEqual(results.length, 2);
    });
  });

  describe('getStats', () => {
    it('should return stats from index', () => {
      addToIndex(tempDir, {
        id: 'ins-20260115-s1',
        status: 'evaluating',
        date: '2026-01-15'
      });
      addToIndex(tempDir, {
        id: 'ins-20260115-s2',
        status: 'adopted',
        date: '2026-01-15'
      });

      const stats = getStats(tempDir);
      assert.strictEqual(stats.total, 2);
      assert.strictEqual(stats.byStatus.evaluating, 1);
      assert.strictEqual(stats.byStatus.adopted, 1);
    });
  });

  describe('syncIndex', () => {
    it('should sync index with files on disk', () => {
      // Add insight to index
      addToIndex(tempDir, {
        id: 'ins-20260115-sync',
        status: 'evaluating',
        date: '2026-01-15'
      });

      // Create a new file not in index
      const newInsight = `---
id: ins-20260114-new
source:
  title: New
  type: blog
  date: 2026-01-14
  credibility: medium
date: 2026-01-14
status: evaluating
model_era: claude-opus-4.5
tags: []
---

## 原始洞见

New content
`;
      fs.writeFileSync(path.join(insightsDir, 'ins-20260114-new.md'), newInsight);

      const result = syncIndex(tempDir);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.added, 1);
      // ins-20260115-sync was in index but not as file, so it's removed
      assert.strictEqual(result.removed, 1);
    });
  });
});
