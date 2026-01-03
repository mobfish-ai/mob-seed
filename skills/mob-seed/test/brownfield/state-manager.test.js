/**
 * state-manager 单元测试
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const stateManager = require('../../lib/brownfield/state-manager');

describe('state-manager', () => {
  const testDir = path.join(__dirname, '../fixtures/state-manager');

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  describe('STATE_FILE', () => {
    it('should have correct state file name', () => {
      assert.strictEqual(stateManager.STATE_FILE, 'brownfield-state.json');
    });
  });

  describe('getStatePath', () => {
    it('should return correct path', () => {
      const result = stateManager.getStatePath('/project');
      assert.strictEqual(result, '/project/.seed/brownfield-state.json');
    });
  });

  describe('createInitialState', () => {
    it('should create state with default options', () => {
      const state = stateManager.createInitialState({});

      assert.strictEqual(state.version, 1);
      assert.strictEqual(state.phase, 'detecting');
      assert.ok(state.startedAt);
      assert.strictEqual(state.options.concurrency, 5);
      assert.strictEqual(state.options.enrichEnabled, true);
      assert.strictEqual(state.options.dryRun, false);
      assert.strictEqual(state.progress.total, 0);
      assert.deepStrictEqual(state.files.remaining, []);
    });

    it('should use provided options', () => {
      const state = stateManager.createInitialState({
        concurrency: 10,
        enrichEnabled: false,
        dryRun: true
      });

      assert.strictEqual(state.options.concurrency, 10);
      assert.strictEqual(state.options.enrichEnabled, false);
      assert.strictEqual(state.options.dryRun, true);
    });
  });

  describe('saveState and loadState', () => {
    it('should save and load state', () => {
      const projectPath = path.join(testDir, 'save-load');
      fs.mkdirSync(projectPath, { recursive: true });

      const state = stateManager.createInitialState({});
      state.progress.total = 100;
      state.files.remaining = ['a.js', 'b.js'];

      const saved = stateManager.saveState(projectPath, state);
      assert.strictEqual(saved, true);

      const loaded = stateManager.loadState(projectPath);
      assert.ok(loaded);
      assert.strictEqual(loaded.progress.total, 100);
      assert.deepStrictEqual(loaded.files.remaining, ['a.js', 'b.js']);
    });

    it('should return null if no state file', () => {
      const projectPath = path.join(testDir, 'no-state');
      fs.mkdirSync(projectPath, { recursive: true });

      const loaded = stateManager.loadState(projectPath);
      assert.strictEqual(loaded, null);
    });

    it('should return null for invalid state', () => {
      const projectPath = path.join(testDir, 'invalid-state');
      fs.mkdirSync(path.join(projectPath, '.seed'), { recursive: true });
      fs.writeFileSync(
        path.join(projectPath, '.seed', 'brownfield-state.json'),
        '{"invalid": true}'
      );

      const loaded = stateManager.loadState(projectPath);
      assert.strictEqual(loaded, null);
    });
  });

  describe('clearState', () => {
    it('should clear existing state', () => {
      const projectPath = path.join(testDir, 'clear-state');
      fs.mkdirSync(path.join(projectPath, '.seed'), { recursive: true });

      const state = stateManager.createInitialState({});
      stateManager.saveState(projectPath, state);

      const cleared = stateManager.clearState(projectPath);
      assert.strictEqual(cleared, true);

      const loaded = stateManager.loadState(projectPath);
      assert.strictEqual(loaded, null);
    });

    it('should return true if no state file', () => {
      const projectPath = path.join(testDir, 'no-clear');
      fs.mkdirSync(projectPath, { recursive: true });

      const cleared = stateManager.clearState(projectPath);
      assert.strictEqual(cleared, true);
    });
  });

  describe('hasIncompleteState', () => {
    it('should return true for incomplete state', () => {
      const projectPath = path.join(testDir, 'incomplete');
      fs.mkdirSync(projectPath, { recursive: true });

      const state = stateManager.createInitialState({});
      state.phase = 'extracting';
      stateManager.saveState(projectPath, state);

      const result = stateManager.hasIncompleteState(projectPath);
      assert.strictEqual(result, true);
    });

    it('should return false for completed state', () => {
      const projectPath = path.join(testDir, 'completed');
      fs.mkdirSync(projectPath, { recursive: true });

      const state = stateManager.createInitialState({});
      state.phase = 'completed';
      stateManager.saveState(projectPath, state);

      const result = stateManager.hasIncompleteState(projectPath);
      assert.strictEqual(result, false);
    });

    it('should return false if no state', () => {
      const projectPath = path.join(testDir, 'no-incomplete');
      fs.mkdirSync(projectPath, { recursive: true });

      const result = stateManager.hasIncompleteState(projectPath);
      assert.strictEqual(result, false);
    });
  });

  describe('updatePhase', () => {
    it('should update phase', () => {
      const state = stateManager.createInitialState({});
      // Manually set an older timestamp to avoid race condition
      state.updatedAt = '2000-01-01T00:00:00.000Z';

      const updated = stateManager.updatePhase(state, 'extracting');

      assert.strictEqual(updated.phase, 'extracting');
      assert.notStrictEqual(updated.updatedAt, state.updatedAt);
      assert.ok(new Date(updated.updatedAt) > new Date(state.updatedAt));
    });
  });

  describe('updateProgress', () => {
    it('should update progress', () => {
      const state = stateManager.createInitialState({});

      const updated = stateManager.updateProgress(state, {
        total: 100,
        processed: 50
      });

      assert.strictEqual(updated.progress.total, 100);
      assert.strictEqual(updated.progress.processed, 50);
    });
  });

  describe('markFileCompleted', () => {
    it('should mark successful file', () => {
      const state = stateManager.createInitialState({});
      state.files.remaining = ['a.js', 'b.js', 'c.js'];

      const updated = stateManager.markFileCompleted(state, 'b.js', true);

      assert.deepStrictEqual(updated.files.remaining, ['a.js', 'c.js']);
      assert.deepStrictEqual(updated.files.completed, ['b.js']);
      assert.strictEqual(updated.progress.processed, 1);
      assert.strictEqual(updated.progress.successful, 1);
    });

    it('should mark failed file', () => {
      const state = stateManager.createInitialState({});
      state.files.remaining = ['a.js', 'b.js'];

      const updated = stateManager.markFileCompleted(state, 'a.js', false, 'Parse error');

      assert.deepStrictEqual(updated.files.remaining, ['b.js']);
      assert.deepStrictEqual(updated.files.failed, [{ file: 'a.js', error: 'Parse error' }]);
      assert.strictEqual(updated.progress.failed, 1);
    });
  });

  describe('isValidState', () => {
    it('should validate correct state', () => {
      const state = stateManager.createInitialState({});
      assert.strictEqual(stateManager.isValidState(state), true);
    });

    it('should reject null', () => {
      assert.strictEqual(stateManager.isValidState(null), false);
    });

    it('should reject state without version', () => {
      assert.strictEqual(stateManager.isValidState({ phase: 'x' }), false);
    });

    it('should reject state without phase', () => {
      assert.strictEqual(stateManager.isValidState({ version: 1 }), false);
    });

    it('should reject state without progress', () => {
      assert.strictEqual(
        stateManager.isValidState({ version: 1, phase: 'x' }),
        false
      );
    });
  });

  describe('calculateProgress', () => {
    it('should calculate percentage', () => {
      const state = stateManager.createInitialState({});
      state.progress.total = 100;
      state.progress.processed = 75;

      const result = stateManager.calculateProgress(state);
      assert.strictEqual(result, 75);
    });

    it('should return 0 for empty state', () => {
      assert.strictEqual(stateManager.calculateProgress(null), 0);
      assert.strictEqual(stateManager.calculateProgress({ progress: { total: 0 } }), 0);
    });
  });

  describe('getStateSummary', () => {
    it('should return summary', () => {
      const state = stateManager.createInitialState({});
      state.phase = 'extracting';
      state.progress.total = 100;
      state.progress.processed = 50;
      state.progress.successful = 45;
      state.progress.failed = 5;
      state.files.remaining = new Array(50).fill('x.js');

      const summary = stateManager.getStateSummary(state);

      assert.strictEqual(summary.phase, 'extracting');
      assert.strictEqual(summary.progress, 50);
      assert.strictEqual(summary.total, 100);
      assert.strictEqual(summary.remaining, 50);
      assert.strictEqual(summary.successful, 45);
      assert.strictEqual(summary.failed, 5);
    });

    it('should return null for null state', () => {
      assert.strictEqual(stateManager.getStateSummary(null), null);
    });
  });
});
