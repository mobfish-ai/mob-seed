'use strict';

/**
 * Insight Index Module
 *
 * Maintains the insights index file for quick querying.
 */

const fs = require('fs');
const path = require('path');
const { parseInsightFile, extractMetadata } = require('./insight-parser');
const { getInsightsDir, ensureInsightsDir } = require('./insight-config');
const { InsightStatusValues } = require('./insight-types');

/**
 * Default index structure
 */
function createEmptyIndex() {
  return {
    version: '1.0.0',
    updated: new Date().toISOString(),
    insights: [],
    stats: {
      total: 0,
      byStatus: Object.fromEntries(InsightStatusValues.map(s => [s, 0])),
      bySourceType: {}
    }
  };
}

/**
 * Calculate stats from insights list
 * @param {Array} insights - List of insight metadata
 * @returns {object} Stats object
 */
function calculateStats(insights) {
  const byStatus = Object.fromEntries(InsightStatusValues.map(s => [s, 0]));
  const bySourceType = {};

  for (const insight of insights) {
    // Count by status
    if (insight.status && byStatus[insight.status] !== undefined) {
      byStatus[insight.status]++;
    }

    // Count by source type
    if (insight.sourceType) {
      bySourceType[insight.sourceType] = (bySourceType[insight.sourceType] || 0) + 1;
    }
  }

  return {
    total: insights.length,
    byStatus,
    bySourceType
  };
}

/**
 * Load index from file
 * @param {string} indexPath - Path to index.json
 * @returns {object} Index object or empty index
 */
function loadIndex(indexPath) {
  try {
    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    // Return empty index on error
  }
  return createEmptyIndex();
}

/**
 * Save index to file
 * @param {string} indexPath - Path to index.json
 * @param {object} index - Index object
 * @returns {boolean} Success status
 */
function saveIndex(indexPath, index) {
  try {
    // Ensure directory exists
    const dir = path.dirname(indexPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Update timestamp
    index.updated = new Date().toISOString();

    // Recalculate stats
    index.stats = calculateStats(index.insights);

    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Rebuild index from insight files in directory
 * @param {string} insightsDir - Insights directory path
 * @returns {object} Rebuilt index
 */
function rebuildIndex(insightsDir) {
  const index = createEmptyIndex();

  if (!fs.existsSync(insightsDir)) {
    return index;
  }

  // Find all .md files (excluding index.json)
  const files = fs.readdirSync(insightsDir)
    .filter(f => f.endsWith('.md') && f.startsWith('ins-'));

  for (const file of files) {
    const filePath = path.join(insightsDir, file);
    const result = parseInsightFile(filePath);

    if (result.success && result.insight) {
      const meta = extractMetadata(result.insight);
      meta.file = file;
      index.insights.push(meta);
    }
  }

  // Sort by date descending
  index.insights.sort((a, b) => {
    return new Date(b.date) - new Date(a.date);
  });

  // Calculate stats
  index.stats = calculateStats(index.insights);

  return index;
}

/**
 * Get insight index for a project
 * @param {string} projectPath - Project root path
 * @param {object} [options] - Options
 * @returns {object} Index and metadata
 */
function getIndex(projectPath, options = {}) {
  const insightsDir = getInsightsDir(projectPath, options);
  const indexPath = path.join(insightsDir, 'index.json');

  const index = loadIndex(indexPath);

  return {
    index,
    indexPath,
    insightsDir
  };
}

/**
 * Add insight to index
 * @param {string} projectPath - Project root path
 * @param {object} insightMeta - Insight metadata
 * @param {object} [options] - Options
 * @returns {object} Result
 */
function addToIndex(projectPath, insightMeta, options = {}) {
  const { index, indexPath } = getIndex(projectPath, options);

  // Check if already exists
  const existingIdx = index.insights.findIndex(i => i.id === insightMeta.id);
  if (existingIdx >= 0) {
    // Update existing
    index.insights[existingIdx] = insightMeta;
  } else {
    // Add new
    index.insights.push(insightMeta);
  }

  // Sort by date descending
  index.insights.sort((a, b) => new Date(b.date) - new Date(a.date));

  const success = saveIndex(indexPath, index);

  return {
    success,
    index,
    action: existingIdx >= 0 ? 'updated' : 'added'
  };
}

/**
 * Remove insight from index
 * @param {string} projectPath - Project root path
 * @param {string} insightId - Insight ID to remove
 * @param {object} [options] - Options
 * @returns {object} Result
 */
function removeFromIndex(projectPath, insightId, options = {}) {
  const { index, indexPath } = getIndex(projectPath, options);

  const initialLength = index.insights.length;
  index.insights = index.insights.filter(i => i.id !== insightId);

  if (index.insights.length === initialLength) {
    return {
      success: false,
      error: `Insight not found: ${insightId}`
    };
  }

  const success = saveIndex(indexPath, index);

  return {
    success,
    index,
    action: 'removed'
  };
}

/**
 * Update insight status in index
 * @param {string} projectPath - Project root path
 * @param {string} insightId - Insight ID
 * @param {string} newStatus - New status
 * @param {object} [options] - Options
 * @returns {object} Result
 */
function updateStatus(projectPath, insightId, newStatus, options = {}) {
  const { index, indexPath } = getIndex(projectPath, options);

  const insight = index.insights.find(i => i.id === insightId);
  if (!insight) {
    return {
      success: false,
      error: `Insight not found: ${insightId}`
    };
  }

  const oldStatus = insight.status;
  insight.status = newStatus;

  const success = saveIndex(indexPath, index);

  return {
    success,
    oldStatus,
    newStatus,
    index
  };
}

/**
 * Query insights by filters
 * @param {string} projectPath - Project root path
 * @param {object} filters - Query filters
 * @param {object} [options] - Options
 * @returns {Array} Matching insights
 */
function queryInsights(projectPath, filters = {}, options = {}) {
  const { index } = getIndex(projectPath, options);
  let results = [...index.insights];

  // Filter by status
  if (filters.status) {
    results = results.filter(i => i.status === filters.status);
  }

  // Filter by source type
  if (filters.sourceType) {
    results = results.filter(i => i.sourceType === filters.sourceType);
  }

  // Filter by tag
  if (filters.tag) {
    results = results.filter(i =>
      i.tags && i.tags.includes(filters.tag)
    );
  }

  // Filter by model era
  if (filters.modelEra) {
    results = results.filter(i => i.modelEra === filters.modelEra);
  }

  // Filter by date range
  if (filters.startDate) {
    const start = new Date(filters.startDate);
    results = results.filter(i => new Date(i.date) >= start);
  }
  if (filters.endDate) {
    const end = new Date(filters.endDate);
    results = results.filter(i => new Date(i.date) <= end);
  }

  // Limit results
  if (filters.limit && filters.limit > 0) {
    results = results.slice(0, filters.limit);
  }

  return results;
}

/**
 * Get insight stats
 * @param {string} projectPath - Project root path
 * @param {object} [options] - Options
 * @returns {object} Stats
 */
function getStats(projectPath, options = {}) {
  const { index } = getIndex(projectPath, options);
  return index.stats;
}

/**
 * Sync index with files on disk
 * @param {string} projectPath - Project root path
 * @param {object} [options] - Options
 * @returns {object} Result
 */
function syncIndex(projectPath, options = {}) {
  const insightsDir = getInsightsDir(projectPath, options);
  const indexPath = path.join(insightsDir, 'index.json');

  const oldIndex = loadIndex(indexPath);
  const newIndex = rebuildIndex(insightsDir);

  const added = newIndex.insights.filter(
    n => !oldIndex.insights.find(o => o.id === n.id)
  ).length;

  const removed = oldIndex.insights.filter(
    o => !newIndex.insights.find(n => n.id === o.id)
  ).length;

  const success = saveIndex(indexPath, newIndex);

  return {
    success,
    added,
    removed,
    total: newIndex.insights.length,
    index: newIndex
  };
}

module.exports = {
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
};
