'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  VALID_TRANSITIONS,
  TRANSITION_LABELS,
  STATUS_LABELS,
  STATUS_ICONS,
  isValidTransition,
  getAllowedTransitions,
  getTransitionLabel,
  getStatusLabel,
  getStatusIcon,
  formatStatus,
  transition,
  getLifecycleStage,
  isActionable,
  isTerminal,
  getSuggestedAction
} = require('../../lib/ace/insight-lifecycle');

describe('insight-lifecycle', () => {
  describe('constants', () => {
    it('should have valid transitions defined', () => {
      assert.ok(VALID_TRANSITIONS.evaluating);
      assert.ok(VALID_TRANSITIONS.piloting);
      assert.ok(VALID_TRANSITIONS.adopted);
      assert.ok(VALID_TRANSITIONS.partial);
      assert.ok(VALID_TRANSITIONS.rejected);
      assert.ok(VALID_TRANSITIONS.obsolete);
    });

    it('should have transition labels for all transitions', () => {
      assert.ok(TRANSITION_LABELS['evaluating→piloting']);
      assert.ok(TRANSITION_LABELS['adopted→obsolete']);
    });

    it('should have status labels for all statuses', () => {
      assert.strictEqual(STATUS_LABELS.evaluating, '评估中');
      assert.strictEqual(STATUS_LABELS.adopted, '已采纳');
      assert.strictEqual(STATUS_LABELS.obsolete, '已过时');
    });

    it('should have status icons for all statuses', () => {
      assert.strictEqual(STATUS_ICONS.evaluating, '🔍');
      assert.strictEqual(STATUS_ICONS.adopted, '✅');
      assert.strictEqual(STATUS_ICONS.rejected, '❌');
    });
  });

  describe('isValidTransition', () => {
    it('should return true for valid transitions', () => {
      assert.strictEqual(isValidTransition('evaluating', 'piloting'), true);
      assert.strictEqual(isValidTransition('evaluating', 'adopted'), true);
      assert.strictEqual(isValidTransition('piloting', 'adopted'), true);
      assert.strictEqual(isValidTransition('adopted', 'obsolete'), true);
    });

    it('should return false for invalid transitions', () => {
      assert.strictEqual(isValidTransition('evaluating', 'obsolete'), false);
      assert.strictEqual(isValidTransition('adopted', 'evaluating'), false);
      assert.strictEqual(isValidTransition('rejected', 'adopted'), false);
    });

    it('should return false for invalid statuses', () => {
      assert.strictEqual(isValidTransition('invalid', 'adopted'), false);
      assert.strictEqual(isValidTransition('evaluating', 'invalid'), false);
    });
  });

  describe('getAllowedTransitions', () => {
    it('should return allowed transitions for evaluating', () => {
      const allowed = getAllowedTransitions('evaluating');
      assert.deepStrictEqual(allowed, ['piloting', 'adopted', 'partial', 'rejected']);
    });

    it('should return allowed transitions for adopted', () => {
      const allowed = getAllowedTransitions('adopted');
      assert.deepStrictEqual(allowed, ['obsolete']);
    });

    it('should return empty array for invalid status', () => {
      const allowed = getAllowedTransitions('invalid');
      assert.deepStrictEqual(allowed, []);
    });
  });

  describe('getTransitionLabel', () => {
    it('should return label for known transition', () => {
      assert.strictEqual(getTransitionLabel('evaluating', 'piloting'), '开始试点');
      assert.strictEqual(getTransitionLabel('piloting', 'adopted'), '试点成功，全面采纳');
    });

    it('should return fallback for unknown transition', () => {
      const label = getTransitionLabel('foo', 'bar');
      assert.strictEqual(label, 'foo → bar');
    });
  });

  describe('getStatusLabel', () => {
    it('should return label for known status', () => {
      assert.strictEqual(getStatusLabel('evaluating'), '评估中');
      assert.strictEqual(getStatusLabel('adopted'), '已采纳');
    });

    it('should return status itself for unknown status', () => {
      assert.strictEqual(getStatusLabel('unknown'), 'unknown');
    });
  });

  describe('getStatusIcon', () => {
    it('should return icon for known status', () => {
      assert.strictEqual(getStatusIcon('evaluating'), '🔍');
      assert.strictEqual(getStatusIcon('adopted'), '✅');
    });

    it('should return question mark for unknown status', () => {
      assert.strictEqual(getStatusIcon('unknown'), '❓');
    });
  });

  describe('formatStatus', () => {
    it('should format status with icon and label', () => {
      assert.strictEqual(formatStatus('evaluating'), '🔍 评估中');
      assert.strictEqual(formatStatus('adopted'), '✅ 已采纳');
    });
  });

  describe('transition', () => {
    it('should return success for valid transition', () => {
      const result = transition('evaluating', 'piloting');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.fromStatus, 'evaluating');
      assert.strictEqual(result.toStatus, 'piloting');
      assert.strictEqual(result.label, '开始试点');
      assert.ok(result.timestamp);
    });

    it('should return error for invalid from status', () => {
      const result = transition('invalid', 'adopted');
      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('Invalid current status'));
    });

    it('should return error for invalid to status', () => {
      const result = transition('evaluating', 'invalid');
      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('Invalid target status'));
    });

    it('should return error for invalid transition', () => {
      const result = transition('adopted', 'evaluating');
      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('Cannot transition'));
    });
  });

  describe('getLifecycleStage', () => {
    it('should return active for evaluating and piloting', () => {
      assert.strictEqual(getLifecycleStage('evaluating'), 'active');
      assert.strictEqual(getLifecycleStage('piloting'), 'active');
    });

    it('should return completed for adopted and partial', () => {
      assert.strictEqual(getLifecycleStage('adopted'), 'completed');
      assert.strictEqual(getLifecycleStage('partial'), 'completed');
    });

    it('should return archived for rejected and obsolete', () => {
      assert.strictEqual(getLifecycleStage('rejected'), 'archived');
      assert.strictEqual(getLifecycleStage('obsolete'), 'archived');
    });

    it('should return unknown for invalid status', () => {
      assert.strictEqual(getLifecycleStage('invalid'), 'unknown');
    });
  });

  describe('isActionable', () => {
    it('should return true for evaluating and piloting', () => {
      assert.strictEqual(isActionable('evaluating'), true);
      assert.strictEqual(isActionable('piloting'), true);
    });

    it('should return false for other statuses', () => {
      assert.strictEqual(isActionable('adopted'), false);
      assert.strictEqual(isActionable('rejected'), false);
    });
  });

  describe('isTerminal', () => {
    it('should return true for rejected and obsolete', () => {
      assert.strictEqual(isTerminal('rejected'), true);
      assert.strictEqual(isTerminal('obsolete'), true);
    });

    it('should return false for other statuses', () => {
      assert.strictEqual(isTerminal('evaluating'), false);
      assert.strictEqual(isTerminal('adopted'), false);
    });
  });

  describe('getSuggestedAction', () => {
    it('should return review action for evaluating', () => {
      const action = getSuggestedAction('evaluating');
      assert.strictEqual(action.action, 'review');
      assert.ok(action.message);
    });

    it('should return monitor action for adopted', () => {
      const action = getSuggestedAction('adopted');
      assert.strictEqual(action.action, 'monitor');
    });

    it('should return unknown for invalid status', () => {
      const action = getSuggestedAction('invalid');
      assert.strictEqual(action.action, 'unknown');
    });
  });
});
