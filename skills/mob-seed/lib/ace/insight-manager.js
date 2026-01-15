'use strict';

/**
 * Insight Manager - High-level orchestration for external insights
 *
 * Coordinates insight-index, insight-lifecycle, and insight-review modules
 * to provide a unified API for insight management operations.
 *
 * @module ace/insight-manager
 */

const fs = require('fs');
const path = require('path');

const {
  getIndex,
  addToIndex,
  removeFromIndex,
  updateStatus: updateIndexStatus,
  queryInsights,
  getStats,
  syncIndex
} = require('./insight-index');

const {
  isValidTransition,
  getAllowedTransitions,
  transition,
  getStatusLabel,
  getStatusIcon,
  formatStatus,
  isActionable,
  isTerminal
} = require('./insight-lifecycle');

const {
  getCurrentModelEra,
  checkModelEraReview,
  findInsightsNeedingReview,
  generateReviewSummary,
  checkObsolescence
} = require('./insight-review');

const {
  parseInsight
} = require('./insight-parser');

const {
  generateInsightId
} = require('./insight-types');

const {
  generateInsightContent,
  generateNewInsight
} = require('./insight-generator');

const { getInsightsDir } = require('./insight-config');

/**
 * Get insight by ID
 * @param {string} projectPath - Project root path
 * @param {string} insightId - Insight ID
 * @returns {Object|null} Insight data or null if not found
 */
function getInsight(projectPath, insightId) {
  const insightsDir = getInsightsDir(projectPath);
  const filePath = path.join(insightsDir, `${insightId}.md`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const result = parseInsight(content);
    return result.success ? result.insight : null;
  } catch (error) {
    return null;
  }
}

/**
 * Create a new insight
 * @param {string} projectPath - Project root path
 * @param {Object} insightData - Insight data
 * @param {Object} insightData.source - Source information
 * @param {string} insightData.content - Original insight content
 * @param {string[]} [insightData.tags] - Tags
 * @returns {Object} Result with success, insightId, filePath
 */
function createInsight(projectPath, insightData) {
  const insightsDir = getInsightsDir(projectPath);

  // Ensure directory exists
  if (!fs.existsSync(insightsDir)) {
    fs.mkdirSync(insightsDir, { recursive: true });
  }

  // Generate ID - generateInsightId(date, slug)
  // Slug generation: lowercase → non-alnum to dash → collapse consecutive dashes → trim ends
  const title = insightData.source?.title || 'untitled';
  const slug = title.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')    // Non-alphanumeric → single dash
    .replace(/^-+|-+$/g, '')        // Remove leading/trailing dashes
    .substring(0, 30);
  const insightId = generateInsightId(new Date(), slug);
  const filePath = path.join(insightsDir, `${insightId}.md`);

  // Check for duplicate
  if (fs.existsSync(filePath)) {
    return {
      success: false,
      error: `Insight already exists: ${insightId}`,
      insightId
    };
  }

  // Create content
  const today = new Date().toISOString().split('T')[0];
  const fileContent = generateInsightContent({
    id: insightId,
    source: insightData.source,
    status: 'evaluating',
    modelEra: getCurrentModelEra(),
    tags: insightData.tags || [],
    content: insightData.content,
    date: today
  });

  // Write file
  try {
    fs.writeFileSync(filePath, fileContent, 'utf8');
  } catch (error) {
    return {
      success: false,
      error: `Failed to write file: ${error.message}`,
      insightId
    };
  }

  // Add to index
  const indexResult = addToIndex(projectPath, {
    id: insightId,
    title: insightData.source?.title || 'Untitled',
    status: 'evaluating',
    sourceType: insightData.source?.type || 'unknown',
    credibility: insightData.source?.credibility || 'medium',
    modelEra: getCurrentModelEra(),
    tags: insightData.tags || [],
    date: new Date().toISOString().split('T')[0]
  });

  if (!indexResult.success) {
    return {
      success: false,
      error: `Failed to update index: ${indexResult.error}`,
      insightId,
      filePath
    };
  }

  return {
    success: true,
    insightId,
    filePath,
    action: 'created'
  };
}

/**
 * Update insight status with lifecycle validation
 * @param {string} projectPath - Project root path
 * @param {string} insightId - Insight ID
 * @param {string} newStatus - New status
 * @returns {Object} Result with success, oldStatus, newStatus
 */
function updateInsightStatus(projectPath, insightId, newStatus) {
  const insight = getInsight(projectPath, insightId);

  if (!insight) {
    return {
      success: false,
      error: `Insight not found: ${insightId}`
    };
  }

  const currentStatus = insight.status;

  // Validate transition
  if (!isValidTransition(currentStatus, newStatus)) {
    const allowed = getAllowedTransitions(currentStatus);
    return {
      success: false,
      error: `Invalid transition from ${currentStatus} to ${newStatus}. Allowed: ${allowed.join(', ')}`,
      currentStatus,
      allowedTransitions: allowed
    };
  }

  // Perform transition
  const transitionResult = transition(currentStatus, newStatus);

  if (!transitionResult.success) {
    return transitionResult;
  }

  // Update file
  const insightsDir = getInsightsDir(projectPath);
  const filePath = path.join(insightsDir, `${insightId}.md`);

  try {
    let content = fs.readFileSync(filePath, 'utf8');
    // Update status in frontmatter
    content = content.replace(
      /^status:\s*.+$/m,
      `status: ${newStatus}`
    );
    fs.writeFileSync(filePath, content, 'utf8');
  } catch (error) {
    return {
      success: false,
      error: `Failed to update file: ${error.message}`
    };
  }

  // Update index
  const indexResult = updateIndexStatus(projectPath, insightId, newStatus);

  if (!indexResult.success) {
    return {
      success: false,
      error: `Failed to update index: ${indexResult.error}`
    };
  }

  return {
    success: true,
    insightId,
    oldStatus: currentStatus,
    newStatus,
    label: transitionResult.label,
    timestamp: transitionResult.timestamp
  };
}

/**
 * Delete an insight
 * @param {string} projectPath - Project root path
 * @param {string} insightId - Insight ID
 * @returns {Object} Result with success
 */
function deleteInsight(projectPath, insightId) {
  const insightsDir = getInsightsDir(projectPath);
  const filePath = path.join(insightsDir, `${insightId}.md`);

  if (!fs.existsSync(filePath)) {
    return {
      success: false,
      error: `Insight not found: ${insightId}`
    };
  }

  // Remove from index first
  const indexResult = removeFromIndex(projectPath, insightId);

  if (!indexResult.success) {
    return {
      success: false,
      error: `Failed to update index: ${indexResult.error}`
    };
  }

  // Delete file
  try {
    fs.unlinkSync(filePath);
  } catch (error) {
    return {
      success: false,
      error: `Failed to delete file: ${error.message}`
    };
  }

  return {
    success: true,
    insightId,
    action: 'deleted'
  };
}

/**
 * List insights with optional filters
 * @param {string} projectPath - Project root path
 * @param {Object} [options] - Filter options
 * @param {string} [options.status] - Filter by status
 * @param {string} [options.sourceType] - Filter by source type
 * @param {string} [options.tag] - Filter by tag
 * @param {number} [options.limit] - Limit results
 * @returns {Object[]} List of insights
 */
function listInsights(projectPath, options = {}) {
  return queryInsights(projectPath, options);
}

/**
 * Get insights statistics
 * @param {string} projectPath - Project root path
 * @returns {Object} Statistics object
 */
function getInsightStats(projectPath) {
  return getStats(projectPath);
}

/**
 * Check insights for model era review
 * @param {string} projectPath - Project root path
 * @param {Object} [options] - Options
 * @param {boolean} [options.includeTerminal] - Include terminal states
 * @returns {Object} Review result with insights needing review
 */
function checkReview(projectPath, options = {}) {
  const { index } = getIndex(projectPath);
  const currentEra = getCurrentModelEra();

  const insightsNeedingReview = findInsightsNeedingReview(index.insights || [], {
    currentEra,
    includeTerminal: options.includeTerminal || false
  });

  const summary = generateReviewSummary(insightsNeedingReview);

  return {
    currentEra,
    insights: insightsNeedingReview,
    summary
  };
}

/**
 * Check if an insight should be marked obsolete
 * @param {string} projectPath - Project root path
 * @param {string} insightId - Insight ID
 * @param {Object} [options] - Options
 * @param {number} [options.obsoleteThreshold] - Version distance threshold
 * @returns {Object} Obsolescence check result
 */
function checkInsightObsolescence(projectPath, insightId, options = {}) {
  const insight = getInsight(projectPath, insightId);

  if (!insight) {
    return {
      success: false,
      error: `Insight not found: ${insightId}`
    };
  }

  return {
    success: true,
    insightId,
    ...checkObsolescence(insight, options)
  };
}

/**
 * Sync index with files on disk
 * @param {string} projectPath - Project root path
 * @returns {Object} Sync result
 */
function syncInsightIndex(projectPath) {
  return syncIndex(projectPath);
}

/**
 * Get actionable insights (evaluating, piloting)
 * @param {string} projectPath - Project root path
 * @returns {Object[]} List of actionable insights
 */
function getActionableInsights(projectPath) {
  const { index } = getIndex(projectPath);
  return (index.insights || []).filter(insight => isActionable(insight.status));
}

/**
 * Get terminal insights (rejected, obsolete)
 * @param {string} projectPath - Project root path
 * @returns {Object[]} List of terminal insights
 */
function getTerminalInsights(projectPath) {
  const { index } = getIndex(projectPath);
  return (index.insights || []).filter(insight => isTerminal(insight.status));
}

/**
 * Format insight for display
 * @param {Object} insight - Insight object
 * @returns {Object} Formatted insight
 */
function formatInsight(insight) {
  return {
    ...insight,
    statusFormatted: formatStatus(insight.status),
    statusLabel: getStatusLabel(insight.status),
    statusIcon: getStatusIcon(insight.status),
    allowedTransitions: getAllowedTransitions(insight.status)
  };
}

/**
 * Get insight with full details
 * @param {string} projectPath - Project root path
 * @param {string} insightId - Insight ID
 * @returns {Object|null} Full insight details or null
 */
function getInsightDetails(projectPath, insightId) {
  const insight = getInsight(projectPath, insightId);

  if (!insight) {
    return null;
  }

  const reviewStatus = checkModelEraReview(insight);
  const obsolescenceCheck = checkObsolescence(insight);

  return {
    ...formatInsight(insight),
    reviewStatus,
    obsolescenceCheck
  };
}

module.exports = {
  // Core CRUD operations
  getInsight,
  createInsight,
  updateInsightStatus,
  deleteInsight,

  // Query operations
  listInsights,
  getInsightStats,
  getActionableInsights,
  getTerminalInsights,

  // Review operations
  checkReview,
  checkInsightObsolescence,

  // Utility operations
  syncInsightIndex,
  formatInsight,
  getInsightDetails
};
