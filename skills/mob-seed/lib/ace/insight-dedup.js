'use strict';

/**
 * Insight Deduplication - Check for similar existing insights before creating new ones
 *
 * Uses keyword/tag overlap and content similarity to detect potential duplicates.
 *
 * @module ace/insight-dedup
 */

const { getIndex } = require('./insight-index');
const { getInsight } = require('./insight-manager');
const { jaccardSimilarity, levenshteinSimilarity } = require('./similarity-matcher');

// ============================================================================
// Constants
// ============================================================================

/**
 * Default configuration for deduplication
 */
const DEFAULT_CONFIG = {
  // Minimum similarity score to consider as potential duplicate (0-1)
  threshold: 0.4,
  // Maximum number of similar insights to return
  maxResults: 5,
  // Weights for different similarity dimensions
  weights: {
    tags: 0.35,        // Tag overlap weight
    keywords: 0.35,    // Keyword/content similarity weight
    title: 0.30        // Title similarity weight
  }
};

// ============================================================================
// Keyword Extraction
// ============================================================================

/**
 * Extract keywords from text content
 * @param {string} text - Text to extract keywords from
 * @returns {string[]} Extracted keywords
 */
function extractKeywords(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // Normalize text
  const normalized = text.toLowerCase();

  // Common stop words to filter out (Chinese + English)
  const stopWords = new Set([
    // English
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
    'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
    'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'between', 'under', 'again', 'further', 'then', 'once', 'here',
    'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few',
    'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
    'own', 'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but',
    'if', 'or', 'because', 'until', 'while', 'about', 'against',
    'this', 'that', 'these', 'those', 'it', 'its', 'you', 'your',
    'we', 'our', 'they', 'their', 'he', 'she', 'him', 'her', 'my',
    // Chinese
    '的', '是', '在', '了', '和', '与', '或', '但', '而', '也',
    '有', '这', '那', '个', '们', '中', '上', '下', '为', '以',
    '及', '等', '能', '会', '可以', '需要', '使用', '通过', '进行',
    '一个', '一种', '这个', '那个', '什么', '如何', '为什么',
    '不是', '不会', '不能', '没有', '已经', '正在', '将要'
  ]);

  // Extract words (handle both English and Chinese)
  const words = [];

  // Extract English words
  const englishMatches = normalized.match(/[a-z][a-z0-9_-]*/g) || [];
  words.push(...englishMatches.filter(w => w.length > 2 && !stopWords.has(w)));

  // Extract Chinese phrases (2-4 characters)
  const chineseMatches = normalized.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
  words.push(...chineseMatches.filter(w => !stopWords.has(w)));

  // Deduplicate and return
  return [...new Set(words)];
}

/**
 * Extract keywords from insight content
 * @param {Object} insight - Insight object with tags, title, content
 * @returns {string[]} Combined keywords
 */
function extractInsightKeywords(insight) {
  const keywords = [];

  // Add tags directly as keywords
  if (Array.isArray(insight.tags)) {
    keywords.push(...insight.tags.map(t => t.toLowerCase()));
  }

  // Extract from title
  if (insight.title || insight.source?.title) {
    const titleKeywords = extractKeywords(insight.title || insight.source?.title);
    keywords.push(...titleKeywords);
  }

  // Extract from content (if available)
  if (insight.content) {
    const contentKeywords = extractKeywords(insight.content);
    keywords.push(...contentKeywords);
  }

  return [...new Set(keywords)];
}

// ============================================================================
// Similarity Calculation
// ============================================================================

/**
 * Calculate similarity between two insights
 * @param {Object} newInsight - New insight to check
 * @param {Object} existingInsight - Existing insight to compare
 * @param {Object} [weights] - Weight configuration
 * @returns {Object} Similarity result with score and breakdown
 */
function calculateInsightSimilarity(newInsight, existingInsight, weights = DEFAULT_CONFIG.weights) {
  const breakdown = {
    tags: 0,
    keywords: 0,
    title: 0
  };

  // Tag similarity (Jaccard)
  const newTags = (newInsight.tags || []).map(t => t.toLowerCase());
  const existingTags = (existingInsight.tags || []).map(t => t.toLowerCase());
  breakdown.tags = jaccardSimilarity(newTags, existingTags);

  // Keyword similarity (Jaccard on extracted keywords)
  const newKeywords = extractInsightKeywords(newInsight);
  const existingKeywords = extractInsightKeywords(existingInsight);
  breakdown.keywords = jaccardSimilarity(newKeywords, existingKeywords);

  // Title similarity (Levenshtein)
  const newTitle = (newInsight.title || newInsight.source?.title || '').toLowerCase();
  const existingTitle = (existingInsight.title || existingInsight.source?.title || '').toLowerCase();
  breakdown.title = levenshteinSimilarity(newTitle, existingTitle);

  // Calculate weighted score
  let totalWeight = 0;
  let weightedScore = 0;

  for (const [key, weight] of Object.entries(weights)) {
    if (weight > 0 && breakdown[key] !== undefined) {
      weightedScore += weight * breakdown[key];
      totalWeight += weight;
    }
  }

  const score = totalWeight > 0 ? weightedScore / totalWeight : 0;

  return {
    score,
    breakdown,
    weights
  };
}

// ============================================================================
// Duplicate Detection
// ============================================================================

/**
 * Find similar existing insights
 * @param {string} projectPath - Project root path
 * @param {Object} newInsightData - New insight data to check
 * @param {string} [newInsightData.title] - Title
 * @param {string[]} [newInsightData.tags] - Tags
 * @param {string} [newInsightData.content] - Content
 * @param {Object} [config] - Configuration
 * @param {number} [config.threshold] - Similarity threshold (default 0.4)
 * @param {number} [config.maxResults] - Max results to return (default 5)
 * @param {Object} [config.weights] - Similarity weights
 * @returns {Object} Result with similar insights
 */
function findSimilarInsights(projectPath, newInsightData, config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  const result = {
    hasSimilar: false,
    similar: [],
    bestMatch: null,
    suggestions: []
  };

  // Get existing insights from index
  const { index, error } = getIndex(projectPath);

  if (error || !index || !Array.isArray(index.insights)) {
    result.error = error || 'Failed to load insights index';
    return result;
  }

  const existingInsights = index.insights;

  if (existingInsights.length === 0) {
    return result;
  }

  // Calculate similarity with each existing insight
  const matches = [];

  for (const existing of existingInsights) {
    const similarity = calculateInsightSimilarity(newInsightData, existing, cfg.weights);

    if (similarity.score >= cfg.threshold) {
      matches.push({
        insight: existing,
        similarity: similarity.score,
        breakdown: similarity.breakdown
      });
    }
  }

  // Sort by similarity score (descending)
  matches.sort((a, b) => b.similarity - a.similarity);

  // Take top results
  result.similar = matches.slice(0, cfg.maxResults);
  result.hasSimilar = result.similar.length > 0;

  // Set best match
  if (result.hasSimilar) {
    result.bestMatch = result.similar[0];

    // Generate suggestions
    const bestScore = result.bestMatch.similarity;
    if (bestScore >= 0.8) {
      result.suggestions.push({
        type: 'exact_duplicate',
        message: `高度相似 (${(bestScore * 100).toFixed(0)}%)，建议更新现有洞见`,
        action: 'update',
        insightId: result.bestMatch.insight.id
      });
    } else if (bestScore >= 0.6) {
      result.suggestions.push({
        type: 'likely_duplicate',
        message: `可能重复 (${(bestScore * 100).toFixed(0)}%)，建议检查后决定`,
        action: 'review',
        insightId: result.bestMatch.insight.id
      });
    } else {
      result.suggestions.push({
        type: 'partial_overlap',
        message: `部分相关 (${(bestScore * 100).toFixed(0)}%)，可以创建新洞见或扩展现有洞见`,
        action: 'decide',
        insightId: result.bestMatch.insight.id
      });
    }
  }

  return result;
}

/**
 * Format deduplication result for display
 * @param {Object} result - Result from findSimilarInsights
 * @returns {string} Formatted output
 */
function formatDedupResult(result) {
  const lines = [];

  if (result.error) {
    lines.push(`❌ 检查失败: ${result.error}`);
    return lines.join('\n');
  }

  if (!result.hasSimilar) {
    lines.push('✅ 未找到相似洞见，可以创建新洞见');
    return lines.join('\n');
  }

  lines.push('⚠️ 发现相似洞见:');
  lines.push('');

  for (const match of result.similar) {
    const insight = match.insight;
    const score = (match.similarity * 100).toFixed(0);

    lines.push(`📄 ${insight.id} (相似度: ${score}%)`);
    lines.push(`   标题: ${insight.title || insight.source?.title || '(无标题)'}`);
    lines.push(`   状态: ${insight.status}`);
    lines.push(`   标签: [${(insight.tags || []).join(', ')}]`);

    // Show breakdown
    const bd = match.breakdown;
    lines.push(`   匹配详情: 标签 ${(bd.tags * 100).toFixed(0)}% | 关键词 ${(bd.keywords * 100).toFixed(0)}% | 标题 ${(bd.title * 100).toFixed(0)}%`);
    lines.push('');
  }

  // Show suggestions
  if (result.suggestions.length > 0) {
    lines.push('💡 建议:');
    for (const suggestion of result.suggestions) {
      lines.push(`   ${suggestion.message}`);
      if (suggestion.action === 'update') {
        lines.push(`   → 使用 /mob-seed:insight --update ${suggestion.insightId} 更新状态`);
        lines.push(`   → 或直接编辑文件添加新内容`);
      } else if (suggestion.action === 'review') {
        lines.push(`   → 查看现有洞见: .seed/insights/${suggestion.insightId}.md`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Check for duplicates before import (convenience wrapper)
 * @param {string} projectPath - Project root path
 * @param {Object} importData - Import data (text content or metadata)
 * @param {string} [importData.title] - Title
 * @param {string[]} [importData.tags] - Tags
 * @param {string} [importData.content] - Content text
 * @returns {Object} Dedup check result
 */
function checkBeforeImport(projectPath, importData) {
  // Extract keywords from content if provided
  let keywords = [];
  if (importData.content) {
    keywords = extractKeywords(importData.content);
  }

  // Build insight data for comparison
  const newInsightData = {
    title: importData.title || '',
    tags: importData.tags || [],
    content: importData.content || ''
  };

  // If no title but have content, try to extract title from first line
  if (!newInsightData.title && importData.content) {
    const firstLine = importData.content.split('\n')[0];
    // Remove markdown headers
    newInsightData.title = firstLine.replace(/^#+\s*/, '').trim();
  }

  // If no tags but have content, use extracted keywords as pseudo-tags
  if (newInsightData.tags.length === 0 && keywords.length > 0) {
    newInsightData.tags = keywords.slice(0, 10); // Top 10 keywords as tags
  }

  return findSimilarInsights(projectPath, newInsightData);
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  // Core functions
  findSimilarInsights,
  checkBeforeImport,

  // Similarity calculation
  calculateInsightSimilarity,
  extractKeywords,
  extractInsightKeywords,

  // Display formatting
  formatDedupResult,

  // Configuration
  DEFAULT_CONFIG
};
