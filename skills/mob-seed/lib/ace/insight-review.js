'use strict';

/**
 * Insight Review Module
 *
 * Manages model era based review triggers for insights.
 */

const { isValidStatus } = require('./insight-types');

/**
 * Known model eras (ordered from oldest to newest)
 */
const MODEL_ERAS = [
  'claude-3-opus',
  'claude-3.5-sonnet',
  'claude-3.5-opus',
  'claude-opus-4',
  'claude-opus-4.5'
];

/**
 * Review trigger reasons
 */
const REVIEW_TRIGGERS = {
  model_upgrade: '模型升级',
  time_elapsed: '时间触发',
  manual: '手动触发',
  dependency_change: '依赖变更',
  performance_issue: '性能问题'
};

/**
 * Get current model era
 * @returns {string} Current model era
 */
function getCurrentModelEra() {
  return process.env.CLAUDE_MODEL_ERA || 'claude-opus-4.5';
}

/**
 * Compare two model eras
 * @param {string} era1 - First era
 * @param {string} era2 - Second era
 * @returns {number} -1 if era1 < era2, 0 if equal, 1 if era1 > era2
 */
function compareModelEras(era1, era2) {
  const idx1 = MODEL_ERAS.indexOf(era1);
  const idx2 = MODEL_ERAS.indexOf(era2);

  // Unknown eras are treated as oldest
  const effectiveIdx1 = idx1 === -1 ? -1 : idx1;
  const effectiveIdx2 = idx2 === -1 ? -1 : idx2;

  if (effectiveIdx1 < effectiveIdx2) return -1;
  if (effectiveIdx1 > effectiveIdx2) return 1;
  return 0;
}

/**
 * Check if a model era is outdated
 * @param {string} era - Model era to check
 * @param {string} [currentEra] - Current era (defaults to getCurrentModelEra())
 * @returns {boolean} True if outdated
 */
function isModelEraOutdated(era, currentEra) {
  const current = currentEra || getCurrentModelEra();
  return compareModelEras(era, current) < 0;
}

/**
 * Get model era distance (number of versions apart)
 * @param {string} era1 - First era
 * @param {string} era2 - Second era
 * @returns {number} Distance between eras
 */
function getModelEraDistance(era1, era2) {
  const idx1 = MODEL_ERAS.indexOf(era1);
  const idx2 = MODEL_ERAS.indexOf(era2);

  if (idx1 === -1 || idx2 === -1) {
    return -1; // Unknown era
  }

  return Math.abs(idx2 - idx1);
}

/**
 * Check if insight needs review based on model era
 * @param {object} insight - Insight object
 * @param {object} [options] - Options
 * @returns {object} Review status
 */
function checkModelEraReview(insight, options = {}) {
  const currentEra = options.currentEra || getCurrentModelEra();
  const insightEra = insight.modelEra || insight.model_era;

  if (!insightEra) {
    return {
      needsReview: true,
      reason: 'missing_era',
      message: '洞见缺少模型时代标记'
    };
  }

  const distance = getModelEraDistance(insightEra, currentEra);

  if (distance === -1) {
    return {
      needsReview: true,
      reason: 'unknown_era',
      message: `未知的模型时代: ${insightEra}`
    };
  }

  if (distance === 0) {
    return {
      needsReview: false,
      reason: 'current',
      message: '洞见属于当前模型时代'
    };
  }

  // Default threshold is 1 version
  const threshold = options.threshold || 1;

  if (distance >= threshold) {
    return {
      needsReview: true,
      reason: 'outdated',
      message: `洞见模型时代 (${insightEra}) 落后当前 (${currentEra}) ${distance} 个版本`,
      distance,
      fromEra: insightEra,
      toEra: currentEra
    };
  }

  return {
    needsReview: false,
    reason: 'within_threshold',
    message: `洞见模型时代在阈值范围内 (距离: ${distance})`
  };
}

/**
 * Get review trigger label
 * @param {string} trigger - Trigger type
 * @returns {string} Human-readable label
 */
function getReviewTriggerLabel(trigger) {
  return REVIEW_TRIGGERS[trigger] || trigger;
}

/**
 * Find insights needing review
 * @param {Array} insights - List of insights
 * @param {object} [options] - Options
 * @returns {Array} Insights needing review
 */
function findInsightsNeedingReview(insights, options = {}) {
  const results = [];
  const currentEra = options.currentEra || getCurrentModelEra();

  for (const insight of insights) {
    // Skip terminal states unless explicitly included
    if (!options.includeTerminal) {
      if (insight.status === 'rejected' || insight.status === 'obsolete') {
        continue;
      }
    }

    const reviewStatus = checkModelEraReview(insight, { currentEra, ...options });

    if (reviewStatus.needsReview) {
      results.push({
        insight,
        reviewStatus
      });
    }
  }

  // Sort by distance (most outdated first)
  results.sort((a, b) => {
    const distA = a.reviewStatus.distance || 0;
    const distB = b.reviewStatus.distance || 0;
    return distB - distA;
  });

  return results;
}

/**
 * Generate review summary
 * @param {Array} reviewResults - Results from findInsightsNeedingReview
 * @returns {object} Summary object
 */
function generateReviewSummary(reviewResults) {
  const byReason = {};
  const byEra = {};

  for (const result of reviewResults) {
    const reason = result.reviewStatus.reason;
    byReason[reason] = (byReason[reason] || 0) + 1;

    if (result.reviewStatus.fromEra) {
      const era = result.reviewStatus.fromEra;
      byEra[era] = (byEra[era] || 0) + 1;
    }
  }

  return {
    total: reviewResults.length,
    byReason,
    byEra,
    currentEra: getCurrentModelEra()
  };
}

/**
 * Create review trigger record
 * @param {string} insightId - Insight ID
 * @param {string} trigger - Trigger type
 * @param {object} [details] - Additional details
 * @returns {object} Trigger record
 */
function createReviewTrigger(insightId, trigger, details = {}) {
  return {
    insightId,
    trigger,
    label: getReviewTriggerLabel(trigger),
    timestamp: new Date().toISOString(),
    modelEra: getCurrentModelEra(),
    ...details
  };
}

/**
 * Check if insight should be marked obsolete
 * @param {object} insight - Insight object
 * @param {object} [options] - Options
 * @returns {object} Obsolescence check result
 */
function checkObsolescence(insight, options = {}) {
  const currentEra = options.currentEra || getCurrentModelEra();
  const insightEra = insight.modelEra || insight.model_era;

  // Insights without era are not auto-obsoleted
  if (!insightEra) {
    return {
      shouldObsolete: false,
      reason: 'missing_era'
    };
  }

  const distance = getModelEraDistance(insightEra, currentEra);

  // Default obsolescence threshold is 3 versions
  const obsoleteThreshold = options.obsoleteThreshold || 3;

  if (distance >= obsoleteThreshold) {
    return {
      shouldObsolete: true,
      reason: 'era_distance',
      message: `洞见模型时代过于陈旧 (${distance} 个版本差距)`,
      distance
    };
  }

  return {
    shouldObsolete: false,
    reason: 'within_threshold'
  };
}

module.exports = {
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
};
