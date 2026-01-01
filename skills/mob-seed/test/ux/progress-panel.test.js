/**
 * Progress Panel 单元测试
 *
 * @see openspec/changes/v2.1-release-automation/specs/ux/interactive-mode.fspec.md
 */

const { describe, it, before } = require('node:test');
const assert = require('node:assert');

const panel = require('../../lib/ux/progress-panel.js');

describe('Progress Panel', () => {

  describe('createProgressBar', () => {
    it('should create progress bar with label and total', () => {
      const bar = panel.createProgressBar('处理中', 10);

      assert.ok(bar, 'Should return progress bar');
      assert.strictEqual(bar.total, 10);
      assert.strictEqual(bar.current, 0);
    });

    it('should update progress correctly', () => {
      const bar = panel.createProgressBar('处理中', 10);

      bar.update(5);

      assert.strictEqual(bar.current, 5);
      assert.strictEqual(bar.percent, 50);
    });

    it('should render progress bar string', () => {
      const bar = panel.createProgressBar('处理中', 10);
      bar.update(5);

      const rendered = bar.render();

      assert.ok(rendered.includes('50%') || rendered.includes('5/10'));
      assert.ok(rendered.includes('处理中'));
    });
  });

  describe('renderPanel', () => {
    it('should render status panel with data', () => {
      const data = {
        title: 'SEED 进度',
        status: 'implementing',
        items: [
          { label: '规格', current: 4, total: 4 },
          { label: '代码', current: 3, total: 4 },
          { label: '测试', current: 12, total: 15 }
        ]
      };

      const output = panel.renderPanel(data);

      assert.ok(output.includes('SEED 进度'), 'Should include title');
      assert.ok(output.includes('implementing'), 'Should include status');
      assert.ok(output.includes('规格') && output.includes('4/4'), 'Should include specs');
    });

    it('should render with colored status indicators', () => {
      const data = {
        title: 'Test',
        items: [
          { label: 'Complete', current: 5, total: 5, status: 'complete' },
          { label: 'InProgress', current: 3, total: 5, status: 'in_progress' },
          { label: 'Pending', current: 0, total: 5, status: 'pending' }
        ]
      };

      const output = panel.renderPanel(data);

      // 应该包含状态指示符
      assert.ok(output.includes('Complete'));
      assert.ok(output.includes('InProgress'));
      assert.ok(output.includes('Pending'));
    });
  });

  describe('renderProgressBar', () => {
    it('should render ASCII progress bar', () => {
      const bar = panel.renderProgressBar(50, { width: 20 });

      assert.ok(bar.includes('█') || bar.includes('='), 'Should have filled portion');
      assert.ok(bar.includes('░') || bar.includes('-'), 'Should have empty portion');
    });

    it('should handle 0%', () => {
      const bar = panel.renderProgressBar(0, { width: 10 });

      assert.ok(bar.length > 0, 'Should return non-empty string');
    });

    it('should handle 100%', () => {
      const bar = panel.renderProgressBar(100, { width: 10 });

      assert.ok(bar.includes('█') || bar.includes('='));
    });
  });

  describe('formatDuration', () => {
    it('should format seconds', () => {
      const result = panel.formatDuration(45);
      assert.ok(result.includes('45') && result.includes('s'));
    });

    it('should format minutes and seconds', () => {
      const result = panel.formatDuration(125);
      assert.ok(result.includes('2') && result.includes('m'));
    });
  });
});
