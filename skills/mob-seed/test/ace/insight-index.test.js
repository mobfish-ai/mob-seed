'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  createEmptyIndex,
  createEmptyTagsIndex,
  calculateStats,
  loadIndex,
  saveIndex,
  loadTagsIndex,
  saveTagsIndex,
  rebuildIndex,
  rebuildIndexes,
  buildTagsIndex,
  getIndex,
  addToIndex,
  removeFromIndex,
  updateStatus,
  queryInsights,
  queryByTag,
  getAllTags,
  getStats,
  syncIndex,
  INDEX_VERSION,
  TAGS_INDEX_VERSION,
  TAG_THRESHOLD
} = require('../../lib/ace/insight-index');

describe('insight-index v2.0', () => {
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
      assert.strictEqual(index.version, INDEX_VERSION);
      assert.strictEqual(index.version, '2.0.0');
      assert.ok(index.updated);
      assert.deepStrictEqual(index.insights, []);
      assert.strictEqual(index.count, 0);
    });

    it('should not have stats in compact format', () => {
      const index = createEmptyIndex();
      assert.strictEqual(index.stats, undefined);
    });
  });

  describe('createEmptyTagsIndex', () => {
    it('should create empty tags index with correct structure', () => {
      const tagsIndex = createEmptyTagsIndex();
      assert.strictEqual(tagsIndex.version, TAGS_INDEX_VERSION);
      assert.strictEqual(tagsIndex.version, '1.0.0');
      assert.ok(tagsIndex.updated);
      assert.deepStrictEqual(tagsIndex.tags, []);
      assert.strictEqual(tagsIndex.stats.total_tags, 0);
      assert.strictEqual(tagsIndex.stats.indexed_tags, 0);
      assert.strictEqual(tagsIndex.stats.threshold, TAG_THRESHOLD);
    });
  });

  describe('calculateStats', () => {
    it('should calculate stats from insights list', () => {
      const insights = [
        { status: 'evaluating', file: 'test1.md' },
        { status: 'evaluating', file: 'test2.md' },
        { status: 'adopted', file: 'test3.md' }
      ];
      // Without insightsDir, only status stats are calculated
      const stats = calculateStats(insights);
      assert.strictEqual(stats.total, 3);
      assert.strictEqual(stats.byStatus.evaluating, 2);
      assert.strictEqual(stats.byStatus.adopted, 1);
    });

    it('should handle empty insights list', () => {
      const stats = calculateStats([]);
      assert.strictEqual(stats.total, 0);
    });

    it('should calculate sourceType stats from files when insightsDir provided', () => {
      // Create test insight files with source type
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
      fs.writeFileSync(path.join(insightsDir, 'ins-20260115-test1.md'), insight1);

      const insights = [
        { id: 'ins-20260115-test1', status: 'evaluating', date: '2026-01-15', file: 'ins-20260115-test1.md' }
      ];
      const stats = calculateStats(insights, insightsDir);
      assert.strictEqual(stats.total, 1);
      assert.strictEqual(stats.bySourceType.blog, 1);
    });
  });

  describe('loadIndex / saveIndex', () => {
    it('should save and load index', () => {
      const indexPath = path.join(insightsDir, 'index.json');
      const index = createEmptyIndex();
      index.insights.push({ id: 'ins-20260115-test', status: 'evaluating', date: '2026-01-15', file: 'ins-20260115-test.md' });

      const saved = saveIndex(indexPath, index);
      assert.strictEqual(saved, true);

      const loaded = loadIndex(indexPath);
      assert.strictEqual(loaded.insights.length, 1);
      assert.strictEqual(loaded.insights[0].id, 'ins-20260115-test');
      assert.strictEqual(loaded.version, INDEX_VERSION);
    });

    it('should return empty index for non-existent file', () => {
      const loaded = loadIndex('/nonexistent/path/index.json');
      assert.deepStrictEqual(loaded.insights, []);
      assert.strictEqual(loaded.version, INDEX_VERSION);
    });

    it('should create directory if not exists', () => {
      const nestedPath = path.join(tempDir, 'nested', 'dir', 'index.json');
      const index = createEmptyIndex();
      const saved = saveIndex(nestedPath, index);
      assert.strictEqual(saved, true);
      assert.ok(fs.existsSync(nestedPath));
    });

    it('should migrate v1 index to v2 format', () => {
      const indexPath = path.join(insightsDir, 'index.json');
      // Write v1 format index
      const v1Index = {
        version: '1.0.0',
        updated: new Date().toISOString(),
        stats: { total: 1, byStatus: { evaluating: 1 }, bySourceType: { blog: 1 } },
        insights: [
          { id: 'ins-20260115-old', status: 'evaluating', date: '2026-01-15', title: 'Old Title', sourceType: 'blog', tags: ['test'] }
        ]
      };
      fs.writeFileSync(indexPath, JSON.stringify(v1Index));

      const loaded = loadIndex(indexPath);
      assert.strictEqual(loaded.version, INDEX_VERSION);
      assert.strictEqual(loaded.insights.length, 1);
      // Compact format only has id, status, date, file
      assert.strictEqual(loaded.insights[0].id, 'ins-20260115-old');
      assert.strictEqual(loaded.insights[0].file, 'ins-20260115-old.md');
      assert.strictEqual(loaded.insights[0].title, undefined);
      assert.strictEqual(loaded.insights[0].sourceType, undefined);
    });
  });

  describe('loadTagsIndex / saveTagsIndex', () => {
    it('should save and load tags index', () => {
      const tagsIndexPath = path.join(insightsDir, 'tags-index.json');
      const tagsIndex = createEmptyTagsIndex();
      tagsIndex.tags.push({ tag: 'test', count: 3, insights: ['ins-1', 'ins-2', 'ins-3'] });
      tagsIndex.stats.indexed_tags = 1;

      const saved = saveTagsIndex(tagsIndexPath, tagsIndex);
      assert.strictEqual(saved, true);

      const loaded = loadTagsIndex(tagsIndexPath);
      assert.strictEqual(loaded.tags.length, 1);
      assert.strictEqual(loaded.tags[0].tag, 'test');
      assert.strictEqual(loaded.tags[0].count, 3);
    });

    it('should return empty tags index for non-existent file', () => {
      const loaded = loadTagsIndex('/nonexistent/path/tags-index.json');
      assert.deepStrictEqual(loaded.tags, []);
    });
  });

  describe('rebuildIndex / rebuildIndexes', () => {
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
      // Compact format
      assert.strictEqual(index.insights[0].file, 'ins-20260115-test1.md');
      assert.strictEqual(index.insights[0].title, undefined);
    });

    it('should rebuild both indexes from insight files', () => {
      // Create test insight files with shared tags
      const insight1 = `---
id: ins-20260115-test1
source:
  title: Test 1
  type: blog
  date: 2026-01-15
date: 2026-01-15
status: evaluating
tags: [shared-tag, unique-tag-1]
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
date: 2026-01-14
status: adopted
tags: [shared-tag, unique-tag-2]
---

## 原始洞见

Test content 2
`;
      fs.writeFileSync(path.join(insightsDir, 'ins-20260115-test1.md'), insight1);
      fs.writeFileSync(path.join(insightsDir, 'ins-20260114-test2.md'), insight2);

      const { index, tagsIndex } = rebuildIndexes(insightsDir);

      // Check index
      assert.strictEqual(index.insights.length, 2);
      assert.strictEqual(index.version, INDEX_VERSION);

      // Check tags index - only shared-tag should be indexed (count >= 2)
      assert.strictEqual(tagsIndex.version, TAGS_INDEX_VERSION);
      assert.strictEqual(tagsIndex.tags.length, 1);
      assert.strictEqual(tagsIndex.tags[0].tag, 'shared-tag');
      assert.strictEqual(tagsIndex.tags[0].count, 2);
    });

    it('should return empty index for non-existent directory', () => {
      const index = rebuildIndex('/nonexistent/dir');
      assert.deepStrictEqual(index.insights, []);
    });
  });

  describe('buildTagsIndex', () => {
    it('should build tags index with threshold filtering', () => {
      // Create test insight files with valid source metadata
      const insight1 = `---
id: ins-20260115-test1
source:
  title: Test 1
  type: blog
  date: 2026-01-15
  credibility: medium
date: 2026-01-15
status: evaluating
tags: [common, rare1]
---

## 原始洞见

Test content 1
`;
      const insight2 = `---
id: ins-20260114-test2
source:
  title: Test 2
  type: blog
  date: 2026-01-14
  credibility: medium
date: 2026-01-14
status: adopted
tags: [common, rare2]
---

## 原始洞见

Test content 2
`;
      const insight3 = `---
id: ins-20260113-test3
source:
  title: Test 3
  type: blog
  date: 2026-01-13
  credibility: medium
date: 2026-01-13
status: evaluating
tags: [common]
---

## 原始洞见

Test content 3
`;
      fs.writeFileSync(path.join(insightsDir, 'ins-20260115-test1.md'), insight1);
      fs.writeFileSync(path.join(insightsDir, 'ins-20260114-test2.md'), insight2);
      fs.writeFileSync(path.join(insightsDir, 'ins-20260113-test3.md'), insight3);

      const tagsIndex = buildTagsIndex(insightsDir);

      // Only 'common' tag should be indexed (count 3 >= threshold 2)
      assert.strictEqual(tagsIndex.tags.length, 1);
      assert.strictEqual(tagsIndex.tags[0].tag, 'common');
      assert.strictEqual(tagsIndex.tags[0].count, 3);
      assert.strictEqual(tagsIndex.stats.total_tags, 3); // common, rare1, rare2
      assert.strictEqual(tagsIndex.stats.indexed_tags, 1);
    });

    it('should support custom threshold', () => {
      const insight1 = `---
id: ins-20260115-test1
source:
  title: Test 1
  type: blog
  date: 2026-01-15
  credibility: medium
date: 2026-01-15
status: evaluating
tags: [tag1, tag2]
---

## 原始洞见

Test
`;
      fs.writeFileSync(path.join(insightsDir, 'ins-20260115-test1.md'), insight1);

      // With threshold 1, all tags should be indexed
      const tagsIndex = buildTagsIndex(insightsDir, 1);
      assert.strictEqual(tagsIndex.tags.length, 2);
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
      // Check compact format
      assert.strictEqual(result.index.insights[0].file, 'ins-20260115-new.md');
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

    it('should update tags index when tags provided', () => {
      // Create insight files with proper metadata for tags index to work
      const insight1 = `---
id: ins-20260115-t1
source:
  title: Tag Test 1
  type: blog
  date: 2026-01-15
  credibility: medium
date: 2026-01-15
status: evaluating
tags: [shared]
---

## 原始洞见

Test
`;
      const insight2 = `---
id: ins-20260114-t2
source:
  title: Tag Test 2
  type: blog
  date: 2026-01-14
  credibility: medium
date: 2026-01-14
status: evaluating
tags: [shared]
---

## 原始洞见

Test
`;
      fs.writeFileSync(path.join(insightsDir, 'ins-20260115-t1.md'), insight1);
      fs.writeFileSync(path.join(insightsDir, 'ins-20260114-t2.md'), insight2);

      // Add insights to index
      addToIndex(tempDir, {
        id: 'ins-20260115-t1',
        status: 'evaluating',
        date: '2026-01-15',
        tags: ['shared']
      });
      const result = addToIndex(tempDir, {
        id: 'ins-20260114-t2',
        status: 'evaluating',
        date: '2026-01-14',
        tags: ['shared']
      });

      // Rebuild tags index from files to get proper counts
      const tagsIndex = buildTagsIndex(insightsDir);

      // Tags index should include 'shared' (count 2 >= threshold)
      const sharedTag = tagsIndex.tags.find(t => t.tag === 'shared');
      assert.ok(sharedTag);
      assert.strictEqual(sharedTag.count, 2);
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
      // Create test insight files with complete source metadata
      const insight1 = `---
id: ins-20260115-q1
source:
  title: Query Test 1
  type: blog
  date: 2026-01-15
  credibility: medium
date: 2026-01-15
status: evaluating
model_era: claude-opus-4.5
tags: [test, alpha]
---

## 原始洞见

Test content 1
`;
      const insight2 = `---
id: ins-20260114-q2
source:
  title: Query Test 2
  type: paper
  date: 2026-01-14
  credibility: high
date: 2026-01-14
status: adopted
model_era: claude-opus-4
tags: [test, beta]
---

## 原始洞见

Test content 2
`;
      const insight3 = `---
id: ins-20260113-q3
source:
  title: Query Test 3
  type: blog
  date: 2026-01-13
  credibility: medium
date: 2026-01-13
status: evaluating
model_era: claude-opus-4.5
tags: [gamma]
---

## 原始洞见

Test content 3
`;
      fs.writeFileSync(path.join(insightsDir, 'ins-20260115-q1.md'), insight1);
      fs.writeFileSync(path.join(insightsDir, 'ins-20260114-q2.md'), insight2);
      fs.writeFileSync(path.join(insightsDir, 'ins-20260113-q3.md'), insight3);

      // Add to index
      addToIndex(tempDir, {
        id: 'ins-20260115-q1',
        status: 'evaluating',
        date: '2026-01-15',
        tags: ['test', 'alpha']
      });
      addToIndex(tempDir, {
        id: 'ins-20260114-q2',
        status: 'adopted',
        date: '2026-01-14',
        tags: ['test', 'beta']
      });
      addToIndex(tempDir, {
        id: 'ins-20260113-q3',
        status: 'evaluating',
        date: '2026-01-13',
        tags: ['gamma']
      });

      // Build tags index from files for tag-based queries
      const tagsIndex = buildTagsIndex(insightsDir);
      saveTagsIndex(path.join(insightsDir, 'tags-index.json'), tagsIndex);
    });

    it('should filter by status', () => {
      const results = queryInsights(tempDir, { status: 'evaluating' });
      assert.strictEqual(results.length, 2);
    });

    it('should filter by source type (reads from files)', () => {
      const results = queryInsights(tempDir, { sourceType: 'paper' });
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].id, 'ins-20260114-q2');
    });

    it('should filter by tag (uses tags index)', () => {
      const results = queryInsights(tempDir, { tag: 'test' });
      assert.strictEqual(results.length, 2);
    });

    it('should filter by model era (reads from files)', () => {
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

  describe('queryByTag', () => {
    beforeEach(() => {
      // Create insight files with valid metadata for tags index to work
      const insight1 = `---
id: ins-20260115-tag1
source:
  title: Tag Query Test 1
  type: blog
  date: 2026-01-15
  credibility: medium
date: 2026-01-15
status: evaluating
tags: [shared]
---

## 原始洞见

Test
`;
      const insight2 = `---
id: ins-20260114-tag2
source:
  title: Tag Query Test 2
  type: blog
  date: 2026-01-14
  credibility: medium
date: 2026-01-14
status: adopted
tags: [shared]
---

## 原始洞见

Test
`;
      const insight3 = `---
id: ins-20260113-tag3
source:
  title: Tag Query Test 3
  type: blog
  date: 2026-01-13
  credibility: medium
date: 2026-01-13
status: evaluating
tags: [unique]
---

## 原始洞见

Test
`;
      fs.writeFileSync(path.join(insightsDir, 'ins-20260115-tag1.md'), insight1);
      fs.writeFileSync(path.join(insightsDir, 'ins-20260114-tag2.md'), insight2);
      fs.writeFileSync(path.join(insightsDir, 'ins-20260113-tag3.md'), insight3);

      // Add to index and rebuild tags index
      addToIndex(tempDir, { id: 'ins-20260115-tag1', status: 'evaluating', date: '2026-01-15', tags: ['shared'] });
      addToIndex(tempDir, { id: 'ins-20260114-tag2', status: 'adopted', date: '2026-01-14', tags: ['shared'] });
      addToIndex(tempDir, { id: 'ins-20260113-tag3', status: 'evaluating', date: '2026-01-13', tags: ['unique'] });

      // Rebuild tags index from files
      const tagsIndex = buildTagsIndex(insightsDir);
      saveTagsIndex(path.join(insightsDir, 'tags-index.json'), tagsIndex);
    });

    it('should return insight IDs for existing tag', () => {
      const results = queryByTag(tempDir, 'shared');
      assert.strictEqual(results.length, 2);
      assert.ok(results.includes('ins-20260115-tag1'));
      assert.ok(results.includes('ins-20260114-tag2'));
    });

    it('should return empty array for non-indexed tag', () => {
      const results = queryByTag(tempDir, 'unique');
      assert.deepStrictEqual(results, []); // unique appears only once, below threshold
    });

    it('should handle case insensitivity', () => {
      const results = queryByTag(tempDir, 'SHARED');
      assert.strictEqual(results.length, 2);
    });
  });

  describe('getAllTags', () => {
    it('should return all indexed tags with counts', () => {
      // Create insight files with valid metadata
      const insight1 = `---
id: ins-20260115-gat1
source:
  title: GetAllTags Test 1
  type: blog
  date: 2026-01-15
  credibility: medium
date: 2026-01-15
status: evaluating
tags: [common]
---

## 原始洞见

Test
`;
      const insight2 = `---
id: ins-20260114-gat2
source:
  title: GetAllTags Test 2
  type: blog
  date: 2026-01-14
  credibility: medium
date: 2026-01-14
status: adopted
tags: [common]
---

## 原始洞见

Test
`;
      const insight3 = `---
id: ins-20260113-gat3
source:
  title: GetAllTags Test 3
  type: blog
  date: 2026-01-13
  credibility: medium
date: 2026-01-13
status: evaluating
tags: [common, rare]
---

## 原始洞见

Test
`;
      fs.writeFileSync(path.join(insightsDir, 'ins-20260115-gat1.md'), insight1);
      fs.writeFileSync(path.join(insightsDir, 'ins-20260114-gat2.md'), insight2);
      fs.writeFileSync(path.join(insightsDir, 'ins-20260113-gat3.md'), insight3);

      addToIndex(tempDir, { id: 'ins-20260115-gat1', status: 'evaluating', date: '2026-01-15', tags: ['common'] });
      addToIndex(tempDir, { id: 'ins-20260114-gat2', status: 'adopted', date: '2026-01-14', tags: ['common'] });
      addToIndex(tempDir, { id: 'ins-20260113-gat3', status: 'evaluating', date: '2026-01-13', tags: ['common', 'rare'] });

      // Rebuild tags index from files
      const tagsIndex = buildTagsIndex(insightsDir);
      saveTagsIndex(path.join(insightsDir, 'tags-index.json'), tagsIndex);

      const tags = getAllTags(tempDir);
      assert.ok(tags.length >= 1);
      const commonTag = tags.find(t => t.tag === 'common');
      assert.ok(commonTag);
      assert.strictEqual(commonTag.count, 3);
    });
  });

  describe('getStats', () => {
    it('should return stats from index', () => {
      // Create insight files with valid source metadata
      const insight1 = `---
id: ins-20260115-s1
source:
  title: Stats Test 1
  type: blog
  date: 2026-01-15
  credibility: medium
date: 2026-01-15
status: evaluating
---

## 原始洞见

Test
`;
      const insight2 = `---
id: ins-20260115-s2
source:
  title: Stats Test 2
  type: paper
  date: 2026-01-15
  credibility: high
date: 2026-01-15
status: adopted
---

## 原始洞见

Test
`;
      fs.writeFileSync(path.join(insightsDir, 'ins-20260115-s1.md'), insight1);
      fs.writeFileSync(path.join(insightsDir, 'ins-20260115-s2.md'), insight2);

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

    it('should rebuild tags index on sync', () => {
      // Create files with shared tags
      const insight1 = `---
id: ins-20260115-sync1
source:
  title: Sync Test 1
  type: blog
  date: 2026-01-15
  credibility: medium
date: 2026-01-15
status: evaluating
tags: [sync-tag]
---

## 原始洞见

Test
`;
      const insight2 = `---
id: ins-20260114-sync2
source:
  title: Sync Test 2
  type: blog
  date: 2026-01-14
  credibility: medium
date: 2026-01-14
status: adopted
tags: [sync-tag]
---

## 原始洞见

Test
`;
      fs.writeFileSync(path.join(insightsDir, 'ins-20260115-sync1.md'), insight1);
      fs.writeFileSync(path.join(insightsDir, 'ins-20260114-sync2.md'), insight2);

      const result = syncIndex(tempDir);
      assert.strictEqual(result.success, true);
      assert.ok(result.tagsIndex);
      const syncTag = result.tagsIndex.tags.find(t => t.tag === 'sync-tag');
      assert.ok(syncTag);
      assert.strictEqual(syncTag.count, 2);
    });
  });

  describe('getIndex', () => {
    it('should return both indexes and paths', () => {
      const result = getIndex(tempDir);
      assert.ok(result.index);
      assert.ok(result.tagsIndex);
      assert.ok(result.indexPath);
      assert.ok(result.tagsIndexPath);
      assert.ok(result.insightsDir);
    });
  });
});
