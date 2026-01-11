'use strict';

/**
 * Insight Lifecycle Module
 *
 * Manages insight status transitions following the defined state machine.
 */

const { InsightStatusValues, isValidStatus } = require('./insight-types');

/**
 * Valid state transitions
 *
 * State machine:
 *   evaluating → piloting | adopted | partial | rejected
 *   piloting → adopted | partial | rejected
 *   adopted → obsolete
 *   partial → obsolete | adopted
 *   rejected → evaluating
 *   obsolete → evaluating
 */
const VALID_TRANSITIONS = {
  evaluating: ['piloting', 'adopted', 'partial', 'rejected'],
  piloting: ['adopted', 'partial', 'rejected'],
  adopted: ['obsolete'],
  partial: ['obsolete', 'adopted'],
  rejected: ['evaluating'],
  obsolete: ['evaluating']
};

/**
 * Transition descriptions (for user-friendly messages)
 */
const TRANSITION_LABELS = {
  'evaluating→piloting': '开始试点',
  'evaluating→adopted': '直接采纳',
  'evaluating→partial': '部分采纳',
  'evaluating→rejected': '拒绝采纳',
  'piloting→adopted': '试点成功，全面采纳',
  'piloting→partial': '试点部分成功',
  'piloting→rejected': '试点失败',
  'adopted→obsolete': '标记过时',
  'partial→obsolete': '标记过时',
  'partial→adopted': '全面采纳',
  'rejected→evaluating': '重新评估',
  'obsolete→evaluating': '重新评估'
};

/**
 * Status display labels
 */
const STATUS_LABELS = {
  evaluating: '评估中',
  piloting: '试点中',
  adopted: '已采纳',
  partial: '部分采纳',
  rejected: '已拒绝',
  obsolete: '已过时'
};

/**
 * Status icons
 */
const STATUS_ICONS = {
  evaluating: '🔍',
  piloting: '🧪',
  adopted: '✅',
  partial: '⚡',
  rejected: '❌',
  obsolete: '📦'
};

/**
 * Check if a status transition is valid
 * @param {string} fromStatus - Current status
 * @param {string} toStatus - Target status
 * @returns {boolean} True if transition is valid
 */
function isValidTransition(fromStatus, toStatus) {
  if (!isValidStatus(fromStatus) || !isValidStatus(toStatus)) {
    return false;
  }

  const allowedTargets = VALID_TRANSITIONS[fromStatus];
  return allowedTargets && allowedTargets.includes(toStatus);
}

/**
 * Get allowed transitions from a status
 * @param {string} status - Current status
 * @returns {Array} List of allowed target statuses
 */
function getAllowedTransitions(status) {
  if (!isValidStatus(status)) {
    return [];
  }
  return VALID_TRANSITIONS[status] || [];
}

/**
 * Get transition label
 * @param {string} fromStatus - Current status
 * @param {string} toStatus - Target status
 * @returns {string} Human-readable transition label
 */
function getTransitionLabel(fromStatus, toStatus) {
  const key = `${fromStatus}→${toStatus}`;
  return TRANSITION_LABELS[key] || `${fromStatus} → ${toStatus}`;
}

/**
 * Get status label
 * @param {string} status - Status value
 * @returns {string} Human-readable status label
 */
function getStatusLabel(status) {
  return STATUS_LABELS[status] || status;
}

/**
 * Get status icon
 * @param {string} status - Status value
 * @returns {string} Status icon emoji
 */
function getStatusIcon(status) {
  return STATUS_ICONS[status] || '❓';
}

/**
 * Format status with icon
 * @param {string} status - Status value
 * @returns {string} Formatted status string
 */
function formatStatus(status) {
  const icon = getStatusIcon(status);
  const label = getStatusLabel(status);
  return `${icon} ${label}`;
}

/**
 * Validate and execute status transition
 * @param {string} fromStatus - Current status
 * @param {string} toStatus - Target status
 * @returns {object} Result with success and error
 */
function transition(fromStatus, toStatus) {
  if (!isValidStatus(fromStatus)) {
    return {
      success: false,
      error: `Invalid current status: ${fromStatus}`
    };
  }

  if (!isValidStatus(toStatus)) {
    return {
      success: false,
      error: `Invalid target status: ${toStatus}`
    };
  }

  if (!isValidTransition(fromStatus, toStatus)) {
    const allowed = getAllowedTransitions(fromStatus);
    return {
      success: false,
      error: `Cannot transition from ${fromStatus} to ${toStatus}. Allowed: ${allowed.join(', ') || 'none'}`
    };
  }

  return {
    success: true,
    fromStatus,
    toStatus,
    label: getTransitionLabel(fromStatus, toStatus),
    timestamp: new Date().toISOString()
  };
}

/**
 * Get lifecycle stage (for grouping)
 * @param {string} status - Status value
 * @returns {string} Stage: 'active' | 'completed' | 'archived'
 */
function getLifecycleStage(status) {
  switch (status) {
    case 'evaluating':
    case 'piloting':
      return 'active';
    case 'adopted':
    case 'partial':
      return 'completed';
    case 'rejected':
    case 'obsolete':
      return 'archived';
    default:
      return 'unknown';
  }
}

/**
 * Check if insight is actionable (needs attention)
 * @param {string} status - Status value
 * @returns {boolean} True if needs attention
 */
function isActionable(status) {
  return status === 'evaluating' || status === 'piloting';
}

/**
 * Check if insight is terminal (no more actions needed)
 * @param {string} status - Status value
 * @returns {boolean} True if terminal
 */
function isTerminal(status) {
  return status === 'rejected' || status === 'obsolete';
}

/**
 * Get next suggested action based on status
 * @param {string} status - Current status
 * @returns {object} Suggested action
 */
function getSuggestedAction(status) {
  switch (status) {
    case 'evaluating':
      return {
        action: 'review',
        message: '请完成辩证评估并做出采纳决策'
      };
    case 'piloting':
      return {
        action: 'evaluate_pilot',
        message: '请评估试点结果并决定是否全面采纳'
      };
    case 'adopted':
      return {
        action: 'monitor',
        message: '已采纳，关注模型升级后是否需要复审'
      };
    case 'partial':
      return {
        action: 'consider_full',
        message: '考虑是否全面采纳剩余部分'
      };
    case 'rejected':
      return {
        action: 'archive',
        message: '可归档或在条件变化后重新评估'
      };
    case 'obsolete':
      return {
        action: 're_evaluate',
        message: '模型升级后可重新评估'
      };
    default:
      return {
        action: 'unknown',
        message: '状态未知'
      };
  }
}

module.exports = {
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
};
