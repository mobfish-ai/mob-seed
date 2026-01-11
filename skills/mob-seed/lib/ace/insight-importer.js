'use strict';

/**
 * Insight Importer - Orchestrates insight import from URLs and text
 *
 * Combines extraction and file generation into a unified import flow.
 *
 * @module ace/insight-importer
 */

const fs = require('fs');
const path = require('path');

const {
  extractFromUrl,
  extractFromText,
  validateMetadata
} = require('./insight-extractor');

const {
  createInsight,
  getInsight
} = require('./insight-manager');

const {
  generateInsightId
} = require('./insight-types');

const {
  getInsightsDir
} = require('./insight-config');

/**
 * Import modes
 */
const ImportMode = {
  URL: 'url',
  TEXT: 'text'
};

/**
 * Import insight from URL
 * @param {string} projectPath - Project root path
 * @param {string} url - URL to import from
 * @param {Object} [options] - Import options
 * @param {boolean} [options.dryRun] - If true, preview without creating file
 * @param {Object} [options.overrides] - Override extracted metadata
 * @param {string[]} [options.additionalTags] - Additional tags to add
 * @returns {Promise<Object>} Import result
 */
async function importFromUrl(projectPath, url, options = {}) {
  const { dryRun = false, overrides = {}, additionalTags = [] } = options;

  const result = {
    success: false,
    mode: ImportMode.URL,
    url,
    dryRun,
    metadata: null,
    insightId: null,
    filePath: null,
    warnings: [],
    error: null
  };

  // Validate URL
  try {
    new URL(url);
  } catch {
    result.error = `Invalid URL: ${url}`;
    return result;
  }

  // Extract metadata from URL
  const extraction = await extractFromUrl(url);

  if (!extraction.success) {
    result.error = `Failed to extract from URL: ${extraction.error}`;
    return result;
  }

  // Merge with overrides
  const metadata = {
    ...extraction.metadata,
    ...overrides
  };

  // Add additional tags
  if (additionalTags.length > 0) {
    metadata.tags = [...new Set([...(metadata.tags || []), ...additionalTags])];
  }

  // Validate metadata
  const validation = validateMetadata(metadata);
  result.warnings = validation.warnings;

  if (!validation.isValid) {
    result.error = `Invalid metadata: ${validation.errors.join(', ')}`;
    return result;
  }

  result.metadata = metadata;

  // If dry run, return preview
  if (dryRun) {
    const title = metadata.title || 'untitled';
    const slug = title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').substring(0, 30);
    result.insightId = generateInsightId(new Date(), slug);
    result.success = true;
    return result;
  }

  // Create the insight
  const createResult = createInsight(projectPath, {
    source: {
      title: metadata.title,
      type: metadata.type,
      author: metadata.author,
      affiliation: metadata.affiliation,
      date: metadata.date,
      url: metadata.url,
      credibility: metadata.credibility
    },
    content: `Imported from: ${url}\n\n[Content to be added manually or by AI assistant]`,
    tags: metadata.tags
  });

  if (!createResult.success) {
    result.error = createResult.error;
    return result;
  }

  result.success = true;
  result.insightId = createResult.insightId;
  result.filePath = createResult.filePath;

  return result;
}

/**
 * Import insight from text content
 * @param {string} projectPath - Project root path
 * @param {string} text - Text content
 * @param {Object} [options] - Import options
 * @param {boolean} [options.dryRun] - If true, preview without creating file
 * @param {Object} [options.sourceInfo] - Source information
 * @param {string} [options.sourceInfo.type] - Source type
 * @param {string} [options.sourceInfo.author] - Author
 * @param {string} [options.sourceInfo.date] - Date
 * @param {string} [options.sourceInfo.credibility] - Credibility
 * @param {string[]} [options.additionalTags] - Additional tags to add
 * @returns {Object} Import result
 */
function importFromText(projectPath, text, options = {}) {
  const { dryRun = false, sourceInfo = {}, additionalTags = [] } = options;

  const result = {
    success: false,
    mode: ImportMode.TEXT,
    dryRun,
    metadata: null,
    insightId: null,
    filePath: null,
    warnings: [],
    error: null
  };

  // Validate text
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    result.error = 'Text content is required';
    return result;
  }

  // Extract metadata from text
  const extraction = extractFromText(text, {
    sourceType: sourceInfo.type,
    author: sourceInfo.author,
    date: sourceInfo.date,
    credibility: sourceInfo.credibility
  });

  const metadata = extraction.metadata;

  // Add additional tags
  if (additionalTags.length > 0) {
    metadata.tags = [...new Set([...(metadata.tags || []), ...additionalTags])];
  }

  // Validate metadata
  const validation = validateMetadata(metadata);
  result.warnings = validation.warnings;

  if (!validation.isValid) {
    result.error = `Invalid metadata: ${validation.errors.join(', ')}`;
    return result;
  }

  result.metadata = metadata;

  // If dry run, return preview
  if (dryRun) {
    const title = metadata.title || 'untitled';
    const slug = title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').substring(0, 30);
    result.insightId = generateInsightId(new Date(), slug);
    result.success = true;
    return result;
  }

  // Create the insight
  const createResult = createInsight(projectPath, {
    source: {
      title: metadata.title,
      type: metadata.type,
      author: metadata.author,
      affiliation: metadata.affiliation,
      date: metadata.date,
      url: null,
      credibility: metadata.credibility
    },
    content: text,
    tags: metadata.tags
  });

  if (!createResult.success) {
    result.error = createResult.error;
    return result;
  }

  result.success = true;
  result.insightId = createResult.insightId;
  result.filePath = createResult.filePath;

  return result;
}

/**
 * Format import result for display
 * @param {Object} result - Import result
 * @returns {string} Formatted output
 */
function formatImportResult(result) {
  const lines = [];

  if (result.dryRun) {
    lines.push('📋 预览模式 (Dry Run)');
    lines.push('');
  }

  if (result.success) {
    lines.push('✅ 导入成功');
    lines.push('');
    lines.push(`   洞见 ID: ${result.insightId}`);

    if (result.filePath) {
      lines.push(`   文件路径: ${result.filePath}`);
    }

    if (result.metadata) {
      lines.push('');
      lines.push('📄 提取的元数据:');
      lines.push(`   标题: ${result.metadata.title}`);
      lines.push(`   作者: ${result.metadata.author || '(未知)'}`);
      lines.push(`   日期: ${result.metadata.date}`);
      lines.push(`   类型: ${result.metadata.type}`);
      lines.push(`   可信度: ${result.metadata.credibility}`);
      if (result.metadata.tags && result.metadata.tags.length > 0) {
        lines.push(`   标签: [${result.metadata.tags.join(', ')}]`);
      }
    }

    if (result.warnings.length > 0) {
      lines.push('');
      lines.push('⚠️ 警告:');
      result.warnings.forEach(w => lines.push(`   - ${w}`));
    }

    lines.push('');
    lines.push('💡 下一步:');
    lines.push('   - 编辑洞见文件完成评估笔记');
    lines.push('   - 使用 /mob-seed:insight --update <id> 更新状态');
  } else {
    lines.push('❌ 导入失败');
    lines.push('');
    lines.push(`   错误: ${result.error}`);

    if (result.mode === ImportMode.URL) {
      lines.push('');
      lines.push('💡 提示:');
      lines.push('   - 检查 URL 是否可访问');
      lines.push('   - 使用 --text 模式手动输入内容');
    }
  }

  return lines.join('\n');
}

/**
 * Batch import multiple insights
 * @param {string} projectPath - Project root path
 * @param {Array<{url?: string, text?: string, options?: Object}>} items - Items to import
 * @param {Object} [globalOptions] - Global options for all imports
 * @returns {Promise<Object>} Batch import result
 */
async function batchImport(projectPath, items, globalOptions = {}) {
  const results = {
    total: items.length,
    success: 0,
    failed: 0,
    items: []
  };

  for (const item of items) {
    const options = { ...globalOptions, ...(item.options || {}) };
    let result;

    if (item.url) {
      result = await importFromUrl(projectPath, item.url, options);
    } else if (item.text) {
      result = importFromText(projectPath, item.text, options);
    } else {
      result = {
        success: false,
        error: 'Either url or text is required'
      };
    }

    results.items.push(result);

    if (result.success) {
      results.success++;
    } else {
      results.failed++;
    }
  }

  return results;
}

/**
 * Check if URL is supported for import
 * @param {string} url - URL to check
 * @returns {Object} Support check result
 */
function checkUrlSupport(url) {
  try {
    const parsedUrl = new URL(url);

    // Check protocol
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return {
        supported: false,
        reason: `Unsupported protocol: ${parsedUrl.protocol}`
      };
    }

    // Check for known problematic patterns
    const hostname = parsedUrl.hostname.toLowerCase();

    // Sites that require authentication
    const authRequired = [
      'linkedin.com',
      'facebook.com'
    ];

    for (const domain of authRequired) {
      if (hostname.includes(domain)) {
        return {
          supported: false,
          reason: `${domain} requires authentication, use --text mode instead`
        };
      }
    }

    return {
      supported: true,
      reason: null
    };
  } catch {
    return {
      supported: false,
      reason: 'Invalid URL format'
    };
  }
}

module.exports = {
  // Main import functions
  importFromUrl,
  importFromText,
  batchImport,

  // Utility functions
  formatImportResult,
  checkUrlSupport,

  // Constants
  ImportMode
};
