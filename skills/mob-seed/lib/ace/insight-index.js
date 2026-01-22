'use strict';

/**
 * Insight Index Module (v2.0)
 *
 * Maintains a dual-index architecture for insights:
 * - index.json: Compact index with minimal fields (id, status, date, file)
 * - tags-index.json: Inverted index for tag-based queries
 *
 * Full metadata is read from individual insight files on demand.
 */

const fs = require('fs');
const path = require('path');
const { parseInsightFile } = require('./insight-parser');
const { getInsightsDir } = require('./insight-config');
const { InsightStatusValues } = require('./insight-types');

// Configuration
const INDEX_VERSION = '2.0.0';
const TAGS_INDEX_VERSION = '1.0.0';
const TAG_THRESHOLD = 2; // Only index tags appearing 2+ times

/**
 * Create empty compact index
 * @returns {object} Empty index structure
 */
function createEmptyIndex() {
  return {
    version: INDEX_VERSION,
    updated: new Date().toISOString(),
    count: 0,
    insights: []
  };
}

/**
 * Create empty tags index
 * @returns {object} Empty tags index structure
 */
function createEmptyTagsIndex() {
  return {
    version: TAGS_INDEX_VERSION,
    updated: new Date().toISOString(),
    stats: {
      total_tags: 0,
      indexed_tags: 0,
      threshold: TAG_THRESHOLD
    },
    tags: []
  };
}

/**
 * Extract compact metadata for index (only essential fields)
 * @param {object} insight - Full insight object
 * @param {string} file - Filename
 * @returns {object} Compact metadata
 */
function extractCompactMetadata(insight, file) {
  return {
    id: insight.id,
    status: insight.status,
    date: insight.date,
    file: file
  };
}

/**
 * Extract full metadata for backward compatibility
 * @param {object} insight - Full insight object
 * @returns {object} Full metadata
 */
function extractFullMetadata(insight) {
  return {
    id: insight.id,
    source: insight.source?.title || '',
    sourceType: insight.source?.type || '',
    author: insight.source?.author || '',
    status: insight.status,
    modelEra: insight.modelEra,
    tags: insight.tags || [],
    date: insight.date
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
      const index = JSON.parse(content);

      // Migrate old format if needed
      if (!index.version || index.version.startsWith('1.')) {
        return migrateIndexV1toV2(index);
      }

      return index;
    }
  } catch (err) {
    // Return empty index on error
  }
  return createEmptyIndex();
}

/**
 * Migrate v1 index to v2 compact format
 * @param {object} oldIndex - v1 index with full metadata
 * @returns {object} v2 compact index
 */
function migrateIndexV1toV2(oldIndex) {
  const newIndex = createEmptyIndex();

  if (oldIndex.insights && Array.isArray(oldIndex.insights)) {
    newIndex.insights = oldIndex.insights.map(item => ({
      id: item.id,
      status: item.status,
      date: item.date,
      file: item.file || `${item.id}.md`
    }));
    newIndex.count = newIndex.insights.length;
  }

  return newIndex;
}

/**
 * Save index to file
 * @param {string} indexPath - Path to index.json
 * @param {object} index - Index object
 * @returns {boolean} Success status
 */
function saveIndex(indexPath, index) {
  try {
    const dir = path.dirname(indexPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    index.updated = new Date().toISOString();
    index.count = index.insights.length;

    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Load tags index from file
 * @param {string} tagsIndexPath - Path to tags-index.json
 * @returns {object} Tags index object or empty
 */
function loadTagsIndex(tagsIndexPath) {
  try {
    if (fs.existsSync(tagsIndexPath)) {
      const content = fs.readFileSync(tagsIndexPath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    // Return empty on error
  }
  return createEmptyTagsIndex();
}

/**
 * Save tags index to file
 * @param {string} tagsIndexPath - Path to tags-index.json
 * @param {object} tagsIndex - Tags index object
 * @returns {boolean} Success status
 */
function saveTagsIndex(tagsIndexPath, tagsIndex) {
  try {
    const dir = path.dirname(tagsIndexPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    tagsIndex.updated = new Date().toISOString();

    fs.writeFileSync(tagsIndexPath, JSON.stringify(tagsIndex, null, 2), 'utf-8');
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Build tags index from insight files
 * @param {string} insightsDir - Insights directory path
 * @param {number} [threshold] - Minimum tag occurrences to index
 * @returns {object} Tags index
 */
function buildTagsIndex(insightsDir, threshold = TAG_THRESHOLD) {
  const tagCounts = new Map();
  const tagInsights = new Map();

  if (!fs.existsSync(insightsDir)) {
    return createEmptyTagsIndex();
  }

  // Scan all insight files
  const files = fs.readdirSync(insightsDir)
    .filter(f => f.endsWith('.md') && f.startsWith('ins-'));

  for (const file of files) {
    const filePath = path.join(insightsDir, file);
    const result = parseInsightFile(filePath);

    if (result.success && result.insight && result.insight.tags) {
      const insightId = result.insight.id;

      for (const tag of result.insight.tags) {
        const normalizedTag = tag.toLowerCase().trim();
        tagCounts.set(normalizedTag, (tagCounts.get(normalizedTag) || 0) + 1);

        if (!tagInsights.has(normalizedTag)) {
          tagInsights.set(normalizedTag, []);
        }
        tagInsights.get(normalizedTag).push(insightId);
      }
    }
  }

  // Filter tags by threshold and build index
  const indexedTags = [];
  for (const [tag, count] of tagCounts.entries()) {
    if (count >= threshold) {
      indexedTags.push({
        tag,
        count,
        insights: tagInsights.get(tag)
      });
    }
  }

  // Sort by count descending
  indexedTags.sort((a, b) => b.count - a.count);

  return {
    version: TAGS_INDEX_VERSION,
    updated: new Date().toISOString(),
    stats: {
      total_tags: tagCounts.size,
      indexed_tags: indexedTags.length,
      threshold
    },
    tags: indexedTags
  };
}

/**
 * Update tags index when adding/removing insight
 * @param {object} tagsIndex - Current tags index
 * @param {string} insightId - Insight ID
 * @param {Array} oldTags - Previous tags (for removal)
 * @param {Array} newTags - New tags (for addition)
 * @returns {object} Updated tags index
 */
function updateTagsIndexForInsight(tagsIndex, insightId, oldTags = [], newTags = []) {
  const tagsMap = new Map(tagsIndex.tags.map(t => [t.tag, { ...t }]));

  // Remove from old tags
  for (const tag of oldTags) {
    const normalizedTag = tag.toLowerCase().trim();
    const entry = tagsMap.get(normalizedTag);
    if (entry) {
      entry.insights = entry.insights.filter(id => id !== insightId);
      entry.count = entry.insights.length;
      if (entry.count < TAG_THRESHOLD) {
        tagsMap.delete(normalizedTag);
      }
    }
  }

  // Add to new tags
  for (const tag of newTags) {
    const normalizedTag = tag.toLowerCase().trim();
    let entry = tagsMap.get(normalizedTag);
    if (!entry) {
      entry = { tag: normalizedTag, count: 0, insights: [] };
      tagsMap.set(normalizedTag, entry);
    }
    if (!entry.insights.includes(insightId)) {
      entry.insights.push(insightId);
      entry.count = entry.insights.length;
    }
  }

  // Rebuild tags array, filtering by threshold
  const filteredTags = Array.from(tagsMap.values())
    .filter(t => t.count >= TAG_THRESHOLD)
    .sort((a, b) => b.count - a.count);

  return {
    ...tagsIndex,
    updated: new Date().toISOString(),
    stats: {
      ...tagsIndex.stats,
      indexed_tags: filteredTags.length
    },
    tags: filteredTags
  };
}

/**
 * Rebuild both indexes from insight files
 * @param {string} insightsDir - Insights directory path
 * @returns {object} { index, tagsIndex }
 */
function rebuildIndexes(insightsDir) {
  const index = createEmptyIndex();

  if (!fs.existsSync(insightsDir)) {
    return { index, tagsIndex: createEmptyTagsIndex() };
  }

  const files = fs.readdirSync(insightsDir)
    .filter(f => f.endsWith('.md') && f.startsWith('ins-'));

  for (const file of files) {
    const filePath = path.join(insightsDir, file);
    const result = parseInsightFile(filePath);

    if (result.success && result.insight) {
      index.insights.push(extractCompactMetadata(result.insight, file));
    }
  }

  // Sort by date descending
  index.insights.sort((a, b) => new Date(b.date) - new Date(a.date));
  index.count = index.insights.length;

  // Build tags index
  const tagsIndex = buildTagsIndex(insightsDir);

  return { index, tagsIndex };
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use rebuildIndexes instead
 */
function rebuildIndex(insightsDir) {
  const { index } = rebuildIndexes(insightsDir);
  return index;
}

/**
 * Calculate stats from insights (for backward compatibility)
 * Requires reading insight files for full metadata
 * @param {Array} insights - List of compact insight metadata
 * @param {string} insightsDir - Directory containing insight files
 * @returns {object} Stats object
 */
function calculateStats(insights, insightsDir) {
  const byStatus = Object.fromEntries(InsightStatusValues.map(s => [s, 0]));
  const bySourceType = {};

  for (const item of insights) {
    // Count by status (available in compact format)
    if (item.status && byStatus[item.status] !== undefined) {
      byStatus[item.status]++;
    }

    // For source type, need to read from file if not in compact
    if (item.sourceType) {
      bySourceType[item.sourceType] = (bySourceType[item.sourceType] || 0) + 1;
    } else if (insightsDir && item.file) {
      // Read from file for full stats
      const filePath = path.join(insightsDir, item.file);
      const result = parseInsightFile(filePath);
      if (result.success && result.insight?.source?.type) {
        const sourceType = result.insight.source.type;
        bySourceType[sourceType] = (bySourceType[sourceType] || 0) + 1;
      }
    }
  }

  return {
    total: insights.length,
    byStatus,
    bySourceType
  };
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
  const tagsIndexPath = path.join(insightsDir, 'tags-index.json');

  const index = loadIndex(indexPath);
  const tagsIndex = loadTagsIndex(tagsIndexPath);

  return {
    index,
    tagsIndex,
    indexPath,
    tagsIndexPath,
    insightsDir
  };
}

/**
 * Add insight to index
 * @param {string} projectPath - Project root path
 * @param {object} insightMeta - Insight metadata (can be full or compact)
 * @param {object} [options] - Options
 * @returns {object} Result
 */
function addToIndex(projectPath, insightMeta, options = {}) {
  const { index, tagsIndex, indexPath, tagsIndexPath } = getIndex(projectPath, options);

  // Extract compact metadata
  const compactMeta = {
    id: insightMeta.id,
    status: insightMeta.status,
    date: insightMeta.date,
    file: insightMeta.file || `${insightMeta.id}.md`
  };

  // Check if already exists
  const existingIdx = index.insights.findIndex(i => i.id === compactMeta.id);
  const oldTags = [];

  if (existingIdx >= 0) {
    // Update existing
    index.insights[existingIdx] = compactMeta;
  } else {
    // Add new
    index.insights.push(compactMeta);
  }

  // Sort by date descending
  index.insights.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Update tags index if tags provided
  const newTags = insightMeta.tags || [];
  const updatedTagsIndex = updateTagsIndexForInsight(tagsIndex, compactMeta.id, oldTags, newTags);

  // Save both indexes
  const indexSuccess = saveIndex(indexPath, index);
  const tagsSuccess = saveTagsIndex(tagsIndexPath, updatedTagsIndex);

  return {
    success: indexSuccess && tagsSuccess,
    index,
    tagsIndex: updatedTagsIndex,
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
  const { index, tagsIndex, indexPath, tagsIndexPath, insightsDir } = getIndex(projectPath, options);

  const existingIdx = index.insights.findIndex(i => i.id === insightId);
  if (existingIdx === -1) {
    return {
      success: false,
      error: `Insight not found: ${insightId}`
    };
  }

  // Get tags from file before removing (for tags index update)
  const insightFile = index.insights[existingIdx].file;
  let oldTags = [];
  if (insightFile) {
    const filePath = path.join(insightsDir, insightFile);
    const result = parseInsightFile(filePath);
    if (result.success && result.insight) {
      oldTags = result.insight.tags || [];
    }
  }

  // Remove from index
  index.insights.splice(existingIdx, 1);

  // Update tags index
  const updatedTagsIndex = updateTagsIndexForInsight(tagsIndex, insightId, oldTags, []);

  // Save both indexes
  const indexSuccess = saveIndex(indexPath, index);
  const tagsSuccess = saveTagsIndex(tagsIndexPath, updatedTagsIndex);

  return {
    success: indexSuccess && tagsSuccess,
    index,
    tagsIndex: updatedTagsIndex,
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
 * @returns {Array} Matching insights (compact format)
 */
function queryInsights(projectPath, filters = {}, options = {}) {
  const { index, tagsIndex, insightsDir } = getIndex(projectPath, options);
  let results = [...index.insights];

  // Filter by status
  if (filters.status) {
    results = results.filter(i => i.status === filters.status);
  }

  // Filter by tag using tags index
  if (filters.tag) {
    const normalizedTag = filters.tag.toLowerCase().trim();
    const tagEntry = tagsIndex.tags.find(t => t.tag === normalizedTag);
    if (tagEntry) {
      const tagInsightIds = new Set(tagEntry.insights);
      results = results.filter(i => tagInsightIds.has(i.id));
    } else {
      results = []; // Tag not in index
    }
  }

  // For filters requiring full metadata, read from files
  if (filters.sourceType || filters.modelEra) {
    results = results.filter(item => {
      const filePath = path.join(insightsDir, item.file);
      const parseResult = parseInsightFile(filePath);
      if (!parseResult.success) return false;

      const insight = parseResult.insight;
      if (filters.sourceType && insight.source?.type !== filters.sourceType) {
        return false;
      }
      if (filters.modelEra && insight.modelEra !== filters.modelEra) {
        return false;
      }
      return true;
    });
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
 * Query insights by tag using tags index
 * @param {string} projectPath - Project root path
 * @param {string} tag - Tag to search
 * @param {object} [options] - Options
 * @returns {Array} Matching insight IDs
 */
function queryByTag(projectPath, tag, options = {}) {
  const { tagsIndex } = getIndex(projectPath, options);
  const normalizedTag = tag.toLowerCase().trim();
  const tagEntry = tagsIndex.tags.find(t => t.tag === normalizedTag);
  return tagEntry ? tagEntry.insights : [];
}

/**
 * Get all tags with counts
 * @param {string} projectPath - Project root path
 * @param {object} [options] - Options
 * @returns {Array} Tags with counts
 */
function getAllTags(projectPath, options = {}) {
  const { tagsIndex } = getIndex(projectPath, options);
  return tagsIndex.tags;
}

/**
 * Get insight stats
 * @param {string} projectPath - Project root path
 * @param {object} [options] - Options
 * @returns {object} Stats
 */
function getStats(projectPath, options = {}) {
  const { index, insightsDir } = getIndex(projectPath, options);
  return calculateStats(index.insights, insightsDir);
}

/**
 * Sync both indexes with files on disk
 * @param {string} projectPath - Project root path
 * @param {object} [options] - Options
 * @returns {object} Result
 */
function syncIndex(projectPath, options = {}) {
  const insightsDir = getInsightsDir(projectPath, options);
  const indexPath = path.join(insightsDir, 'index.json');
  const tagsIndexPath = path.join(insightsDir, 'tags-index.json');

  const oldIndex = loadIndex(indexPath);
  const { index: newIndex, tagsIndex: newTagsIndex } = rebuildIndexes(insightsDir);

  const added = newIndex.insights.filter(
    n => !oldIndex.insights.find(o => o.id === n.id)
  ).length;

  const removed = oldIndex.insights.filter(
    o => !newIndex.insights.find(n => n.id === o.id)
  ).length;

  const indexSuccess = saveIndex(indexPath, newIndex);
  const tagsSuccess = saveTagsIndex(tagsIndexPath, newTagsIndex);

  return {
    success: indexSuccess && tagsSuccess,
    added,
    removed,
    total: newIndex.insights.length,
    index: newIndex,
    tagsIndex: newTagsIndex
  };
}

module.exports = {
  // Index structure
  createEmptyIndex,
  createEmptyTagsIndex,

  // Metadata extraction
  extractCompactMetadata,
  extractFullMetadata,

  // Index I/O
  loadIndex,
  saveIndex,
  loadTagsIndex,
  saveTagsIndex,

  // Index building
  rebuildIndex,
  rebuildIndexes,
  buildTagsIndex,
  updateTagsIndexForInsight,

  // Main API
  getIndex,
  addToIndex,
  removeFromIndex,
  updateStatus,
  queryInsights,
  queryByTag,
  getAllTags,
  getStats,
  syncIndex,

  // Backward compatibility
  calculateStats,

  // Constants
  INDEX_VERSION,
  TAGS_INDEX_VERSION,
  TAG_THRESHOLD
};
