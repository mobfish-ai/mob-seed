'use strict';

/**
 * Insight Types Module
 *
 * Defines data structures, enums, and validation for external insights.
 */

/**
 * Valid insight source types
 */
const InsightSourceTypes = [
  'expert_opinion',  // 专家意见
  'paper',           // 学术论文
  'blog',            // 技术博客
  'documentation',   // 官方文档
  'discussion',      // 社区讨论
  'experience',      // 实践经验
  'ai_generated'     // AI 生成建议
];

/**
 * Valid insight credibility levels
 */
const InsightCredibilityLevels = [
  'high',    // 高：知名专家、权威论文
  'medium',  // 中：行业从业者、技术博客
  'low'      // 低：未验证来源、匿名分享
];

/**
 * Valid insight status values
 */
const InsightStatusValues = [
  'evaluating',  // 评估中
  'piloting',    // 试点中
  'adopted',     // 已采纳
  'partial',     // 部分采纳
  'rejected',    // 已拒绝
  'obsolete'     // 已过时
];

/**
 * Generate insight ID from date and slug
 * @param {Date|string} date - Date for the insight
 * @param {string} slug - Short identifier slug
 * @returns {string} Formatted insight ID
 */
function generateInsightId(date, slug) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  // Sanitize slug: lowercase, replace spaces with hyphens, remove special chars
  const sanitizedSlug = slug
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .substring(0, 30);

  return `ins-${year}${month}${day}-${sanitizedSlug}`;
}

/**
 * Validate insight ID format
 * @param {string} id - Insight ID to validate
 * @returns {boolean} True if valid
 */
function isValidInsightId(id) {
  if (!id || typeof id !== 'string') return false;
  // Format: ins-YYYYMMDD-slug
  const pattern = /^ins-\d{8}-[a-z0-9-]+$/;
  return pattern.test(id);
}

/**
 * Parse insight ID to extract date and slug
 * @param {string} id - Insight ID
 * @returns {object|null} Parsed components or null if invalid
 */
function parseInsightId(id) {
  if (!isValidInsightId(id)) return null;

  const match = id.match(/^ins-(\d{4})(\d{2})(\d{2})-(.+)$/);
  if (!match) return null;

  const [, year, month, day, slug] = match;
  return {
    date: new Date(parseInt(year), parseInt(month) - 1, parseInt(day)),
    dateStr: `${year}-${month}-${day}`,
    slug
  };
}

/**
 * Validate source type
 * @param {string} sourceType - Source type to validate
 * @returns {boolean} True if valid
 */
function isValidSourceType(sourceType) {
  return InsightSourceTypes.includes(sourceType);
}

/**
 * Validate credibility level
 * @param {string} credibility - Credibility level to validate
 * @returns {boolean} True if valid
 */
function isValidCredibility(credibility) {
  return InsightCredibilityLevels.includes(credibility);
}

/**
 * Validate insight status
 * @param {string} status - Status to validate
 * @returns {boolean} True if valid
 */
function isValidStatus(status) {
  return InsightStatusValues.includes(status);
}

/**
 * Validate insight source object
 * @param {object} source - Source object to validate
 * @returns {object} Validation result with isValid and errors
 */
function validateSource(source) {
  const errors = [];

  if (!source) {
    return { isValid: false, errors: ['Source is required'] };
  }

  if (!source.title || typeof source.title !== 'string') {
    errors.push('Source title is required and must be a string');
  }

  if (!source.type || !isValidSourceType(source.type)) {
    errors.push(`Source type must be one of: ${InsightSourceTypes.join(', ')}`);
  }

  if (!source.date) {
    errors.push('Source date is required');
  }

  if (!source.credibility || !isValidCredibility(source.credibility)) {
    errors.push(`Source credibility must be one of: ${InsightCredibilityLevels.join(', ')}`);
  }

  // Optional fields validation
  if (source.author !== undefined && typeof source.author !== 'string') {
    errors.push('Source author must be a string');
  }

  if (source.affiliation !== undefined && typeof source.affiliation !== 'string') {
    errors.push('Source affiliation must be a string');
  }

  if (source.url !== undefined && typeof source.url !== 'string') {
    errors.push('Source URL must be a string');
  }

  if (source.context !== undefined && typeof source.context !== 'string') {
    errors.push('Source context must be a string');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate complete insight object
 * @param {object} insight - Insight object to validate
 * @returns {object} Validation result with isValid and errors
 */
function validateInsight(insight) {
  const errors = [];

  if (!insight) {
    return { isValid: false, errors: ['Insight object is required'] };
  }

  // Required fields
  if (!insight.id || !isValidInsightId(insight.id)) {
    errors.push('Valid insight ID is required (format: ins-YYYYMMDD-slug)');
  }

  if (!insight.date) {
    errors.push('Insight date is required');
  }

  if (!insight.status || !isValidStatus(insight.status)) {
    errors.push(`Status must be one of: ${InsightStatusValues.join(', ')}`);
  }

  // Validate source
  const sourceValidation = validateSource(insight.source);
  if (!sourceValidation.isValid) {
    errors.push(...sourceValidation.errors);
  }

  // Tags validation
  if (insight.tags !== undefined) {
    if (!Array.isArray(insight.tags)) {
      errors.push('Tags must be an array');
    } else if (!insight.tags.every(tag => typeof tag === 'string')) {
      errors.push('All tags must be strings');
    }
  }

  // Optional fields
  if (insight.modelEra !== undefined && typeof insight.modelEra !== 'string') {
    errors.push('Model era must be a string');
  }

  if (insight.reviewTrigger !== undefined && typeof insight.reviewTrigger !== 'string') {
    errors.push('Review trigger must be a string');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Create default insight object
 * @param {object} overrides - Properties to override defaults
 * @returns {object} Insight object with defaults
 */
function createDefaultInsight(overrides = {}) {
  const now = new Date();
  const defaultSlug = 'untitled';

  return {
    id: overrides.id || generateInsightId(now, overrides.slug || defaultSlug),
    source: {
      title: '',
      type: 'expert_opinion',
      author: '',
      affiliation: '',
      date: now.toISOString().split('T')[0],
      context: '',
      url: '',
      credibility: 'medium',
      ...(overrides.source || {})
    },
    date: overrides.date || now.toISOString().split('T')[0],
    status: overrides.status || 'evaluating',
    modelEra: overrides.modelEra || 'claude-opus-4.5',
    reviewTrigger: overrides.reviewTrigger || '',
    tags: overrides.tags || [],
    content: overrides.content || '',
    evaluation: overrides.evaluation || '',
    decision: overrides.decision || ''
  };
}

module.exports = {
  // Constants
  InsightSourceTypes,
  InsightCredibilityLevels,
  InsightStatusValues,

  // ID functions
  generateInsightId,
  isValidInsightId,
  parseInsightId,

  // Validation functions
  isValidSourceType,
  isValidCredibility,
  isValidStatus,
  validateSource,
  validateInsight,

  // Factory function
  createDefaultInsight
};
