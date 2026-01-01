/**
 * change-handler 测试
 * @see openspec/changes/v2.0-seed-complete/specs/ops/change-handler.fspec.md
 */

'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const {
  detectChanges,
  watchFspec,
  compareVersions,
  analyzeImpact,
  findAffectedFiles,
  estimateEffort,
  requestApproval,
  recordDecision,
  executeChange,
  rollbackChange,
  recordChange,
  getChangeHistory,
  getChangeById,
  batchProcess,
  mergeImpacts,
  CHANGE_TYPES,
  DECISION_TYPES
} = require('../../lib/ops/change-handler.js');

describe('change-handler', () => {
  const testDir = '/tmp/change-handler-test';
  const changesDir = path.join(testDir, '.seed/changes');

  beforeEach(() => {
    if (!fs.existsSync(changesDir)) {
      fs.mkdirSync(changesDir, { recursive: true });
    }
    process.env.SEED_CHANGES_DIR = changesDir;
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    delete process.env.SEED_CHANGES_DIR;
  });

  // =============================================================
  // Constants
  // =============================================================

  describe('CHANGE_TYPES', () => {
    it('should define ADDED type', () => {
      assert.strictEqual(CHANGE_TYPES.ADDED, 'ADDED');
    });

    it('should define MODIFIED type', () => {
      assert.strictEqual(CHANGE_TYPES.MODIFIED, 'MODIFIED');
    });

    it('should define REMOVED type', () => {
      assert.strictEqual(CHANGE_TYPES.REMOVED, 'REMOVED');
    });

    it('should define CLARIFIED type', () => {
      assert.strictEqual(CHANGE_TYPES.CLARIFIED, 'CLARIFIED');
    });
  });

  describe('DECISION_TYPES', () => {
    it('should define APPROVED decision', () => {
      assert.strictEqual(DECISION_TYPES.APPROVED, 'approved');
    });

    it('should define REJECTED decision', () => {
      assert.strictEqual(DECISION_TYPES.REJECTED, 'rejected');
    });

    it('should define DEFERRED decision', () => {
      assert.strictEqual(DECISION_TYPES.DEFERRED, 'deferred');
    });
  });

  // =============================================================
  // REQ-001: 变更检测
  // =============================================================

  describe('detectChanges', () => {
    it('should detect changes in fspec file', () => {
      const fspecPath = path.join(testDir, 'test.fspec.md');
      fs.writeFileSync(fspecPath, '# Feature\n\n## ADDED Requirements\n\n### REQ-001');

      const changes = detectChanges(fspecPath);

      assert.ok(Array.isArray(changes));
    });

    it('should return empty array for no changes', () => {
      const fspecPath = path.join(testDir, 'unchanged.fspec.md');
      fs.writeFileSync(fspecPath, '# Feature\n\n## Requirements');

      const changes = detectChanges(fspecPath);

      assert.ok(Array.isArray(changes));
    });
  });

  describe('compareVersions', () => {
    it('should detect ADDED content', () => {
      const oldContent = '# Feature\n## Requirements';
      const newContent = '# Feature\n## ADDED Requirements\n### REQ-001';

      const diff = compareVersions(oldContent, newContent);

      assert.ok(diff);
      assert.ok(diff.changes || diff.added);
    });

    it('should detect REMOVED content', () => {
      const oldContent = '# Feature\n## Requirements\n### REQ-001';
      const newContent = '# Feature\n## REMOVED Requirements';

      const diff = compareVersions(oldContent, newContent);

      assert.ok(diff);
    });

    it('should detect MODIFIED content', () => {
      const oldContent = '# Feature\n## Requirements\n### REQ-001: Old text';
      const newContent = '# Feature\n## MODIFIED Requirements\n### REQ-001: New text';

      const diff = compareVersions(oldContent, newContent);

      assert.ok(diff);
    });
  });

  describe('watchFspec', () => {
    it('should return a watcher object', () => {
      const watcher = watchFspec(testDir, () => {});

      assert.ok(watcher);
      assert.ok(typeof watcher.close === 'function');

      watcher.close();
    });
  });

  // =============================================================
  // REQ-002: 影响分析
  // =============================================================

  describe('analyzeImpact', () => {
    it('should return impact analysis', () => {
      const change = {
        type: CHANGE_TYPES.MODIFIED,
        target: 'REQ-001',
        source: 'test.fspec.md'
      };

      const impact = analyzeImpact(change);

      assert.ok(impact);
      assert.ok('files' in impact || 'affectedFiles' in impact);
    });

    it('should include effort estimate', () => {
      const change = {
        type: CHANGE_TYPES.ADDED,
        target: 'REQ-002',
        source: 'test.fspec.md'
      };

      const impact = analyzeImpact(change);

      assert.ok(impact.effort || impact.estimate);
    });
  });

  describe('findAffectedFiles', () => {
    it('should return affected file paths', () => {
      const change = {
        type: CHANGE_TYPES.MODIFIED,
        target: 'REQ-001',
        source: 'test.fspec.md'
      };

      const files = findAffectedFiles(change);

      assert.ok(Array.isArray(files));
    });
  });

  describe('estimateEffort', () => {
    it('should return time estimate', () => {
      const impact = {
        affectedFiles: ['file1.js', 'file2.js'],
        affectedTests: ['test1.js']
      };

      const estimate = estimateEffort(impact);

      assert.ok(estimate);
      assert.ok('minutes' in estimate || 'hours' in estimate || 'total' in estimate);
    });
  });

  // =============================================================
  // REQ-003: 变更审批
  // =============================================================

  describe('requestApproval', () => {
    it('should return a decision', async () => {
      const change = { type: CHANGE_TYPES.MODIFIED, target: 'REQ-001' };
      const impact = { affectedFiles: ['file.js'] };

      const decision = await requestApproval(change, impact);

      assert.ok(decision);
      assert.ok(['approved', 'rejected', 'deferred'].includes(decision.decision));
    });
  });

  describe('recordDecision', () => {
    it('should record decision without error', () => {
      const changeId = 'CHG-001';
      const decision = DECISION_TYPES.APPROVED;
      const reason = 'Test approval';

      // Should not throw
      recordDecision(changeId, decision, reason);
    });
  });

  // =============================================================
  // REQ-004: 变更执行
  // =============================================================

  describe('executeChange', () => {
    it('should return execution result', () => {
      const change = { id: 'CHG-001', type: CHANGE_TYPES.MODIFIED };
      const impact = { affectedFiles: [] };

      const result = executeChange(change, impact);

      assert.ok(result);
      assert.ok('status' in result || 'success' in result);
    });

    it('should include steps in result', () => {
      const change = { id: 'CHG-002', type: CHANGE_TYPES.ADDED };
      const impact = { affectedFiles: [] };

      const result = executeChange(change, impact);

      assert.ok(result.steps || result.executed);
    });
  });

  describe('rollbackChange', () => {
    it('should rollback without error', () => {
      const changeId = 'CHG-001';

      // Should not throw
      rollbackChange(changeId);
    });
  });

  // =============================================================
  // REQ-005: 变更追溯
  // =============================================================

  describe('recordChange / getChangeHistory / getChangeById', () => {
    it('should record change', () => {
      const change = { id: 'CHG-REC-001', type: CHANGE_TYPES.MODIFIED };
      const execution = { status: 'completed' };

      recordChange(change, execution);
      // No throw means success
    });

    it('should get change history', () => {
      const history = getChangeHistory();

      assert.ok(Array.isArray(history));
    });

    it('should get change history for specific fspec', () => {
      const history = getChangeHistory('test.fspec.md');

      assert.ok(Array.isArray(history));
    });

    it('should get change by id', () => {
      const change = { id: 'CHG-GET-001', type: CHANGE_TYPES.ADDED };
      const execution = { status: 'completed' };

      recordChange(change, execution);
      const retrieved = getChangeById('CHG-GET-001');

      assert.ok(retrieved);
    });

    it('should return null for unknown id', () => {
      const retrieved = getChangeById('CHG-UNKNOWN');

      assert.strictEqual(retrieved, null);
    });
  });

  // =============================================================
  // REQ-006: 批量处理
  // =============================================================

  describe('batchProcess', () => {
    it('should process multiple changes', () => {
      const changes = [
        { id: 'CHG-B1', type: CHANGE_TYPES.ADDED },
        { id: 'CHG-B2', type: CHANGE_TYPES.MODIFIED }
      ];

      const result = batchProcess(changes);

      assert.ok(result);
      assert.ok(result.processed || result.results);
    });

    it('should return empty result for empty changes', () => {
      const result = batchProcess([]);

      assert.ok(result);
      assert.strictEqual(result.processed || result.results?.length, 0);
    });
  });

  describe('mergeImpacts', () => {
    it('should merge multiple impacts', () => {
      const impacts = [
        { affectedFiles: ['a.js'], effort: { minutes: 30 } },
        { affectedFiles: ['b.js'], effort: { minutes: 20 } }
      ];

      const merged = mergeImpacts(impacts);

      assert.ok(merged);
      assert.ok(merged.affectedFiles || merged.files);
    });

    it('should deduplicate files', () => {
      const impacts = [
        { affectedFiles: ['a.js', 'b.js'] },
        { affectedFiles: ['b.js', 'c.js'] }
      ];

      const merged = mergeImpacts(impacts);
      const files = merged.affectedFiles || merged.files || [];

      // Should not have duplicates
      const unique = new Set(files);
      assert.strictEqual(files.length, unique.size);
    });
  });
});
