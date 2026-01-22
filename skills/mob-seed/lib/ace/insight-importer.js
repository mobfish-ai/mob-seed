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
const { extractSmartTitleFromText, truncateTitle } = require('./insight-extractor');

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

const {
  checkBeforeImport,
  formatDedupResult
} = require('./insight-dedup');

/**
 * Import modes
 */
const ImportMode = {
  URL: 'url',
  TEXT: 'text',
  FILE: 'file'
};

/**
 * Import insight from URL
 * @param {string} projectPath - Project root path
 * @param {string} url - URL to import from
 * @param {Object} [options] - Import options
 * @param {boolean} [options.dryRun] - If true, preview without creating file
 * @param {boolean} [options.skipDedupCheck] - If true, skip duplicate check
 * @param {boolean} [options.forceCreate] - If true, create even if duplicates found
 * @param {Object} [options.overrides] - Override extracted metadata
 * @param {string[]} [options.additionalTags] - Additional tags to add
 * @returns {Promise<Object>} Import result
 */
async function importFromUrl(projectPath, url, options = {}) {
  const { dryRun = false, skipDedupCheck = false, forceCreate = false, overrides = {}, additionalTags = [] } = options;

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

  // Deduplication check (unless skipped)
  if (!skipDedupCheck) {
    const dedupResult = checkBeforeImport(projectPath, {
      title: metadata.title,
      tags: metadata.tags,
      content: '' // URL import doesn't have content yet
    });

    result.dedupCheck = dedupResult;

    if (dedupResult.hasSimilar && !forceCreate) {
      result.success = false;
      result.error = 'Similar insight(s) already exist';
      result.similarInsights = dedupResult.similar;
      result.suggestions = dedupResult.suggestions;
      return result;
    }
  }

  // If dry run, return preview
  if (dryRun) {
    const title = metadata.title || 'untitled';
    const slug = title.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')    // Non-alphanumeric → single dash
      .replace(/^-+|-+$/g, '')        // Remove leading/trailing dashes
      .substring(0, 30);
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
 * @param {boolean} [options.skipDedupCheck] - If true, skip duplicate check
 * @param {boolean} [options.forceCreate] - If true, create even if duplicates found
 * @param {Object} [options.sourceInfo] - Source information
 * @param {string} [options.sourceInfo.type] - Source type
 * @param {string} [options.sourceInfo.author] - Author
 * @param {string} [options.sourceInfo.date] - Date
 * @param {string} [options.sourceInfo.credibility] - Credibility
 * @param {string[]} [options.additionalTags] - Additional tags to add
 * @returns {Object} Import result
 */
function importFromText(projectPath, text, options = {}) {
  const { dryRun = false, skipDedupCheck = false, forceCreate = false, sourceInfo = {}, additionalTags = [] } = options;

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

  // Deduplication check (unless skipped)
  if (!skipDedupCheck) {
    const dedupResult = checkBeforeImport(projectPath, {
      title: metadata.title,
      tags: metadata.tags,
      content: text // Text import has full content for better matching
    });

    result.dedupCheck = dedupResult;

    if (dedupResult.hasSimilar && !forceCreate) {
      result.success = false;
      result.error = 'Similar insight(s) already exist';
      result.similarInsights = dedupResult.similar;
      result.suggestions = dedupResult.suggestions;
      return result;
    }
  }

  // If dry run, return preview
  if (dryRun) {
    const title = metadata.title || 'untitled';
    const slug = title.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')    // Non-alphanumeric → single dash
      .replace(/^-+|-+$/g, '')        // Remove leading/trailing dashes
      .substring(0, 30);
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
 * Import insight from local file
 * @param {string} projectPath - Project root path
 * @param {string} filePath - Path to the file to import
 * @param {Object} [options] - Import options
 * @param {boolean} [options.dryRun] - If true, preview without creating file
 * @param {boolean} [options.skipDedupCheck] - If true, skip duplicate check
 * @param {boolean} [options.forceCreate] - If true, create even if duplicates found
 * @param {Object} [options.overrides] - Override extracted metadata
 * @param {string[]} [options.additionalTags] - Additional tags to add
 * @returns {Object} Import result
 */
function importFromFile(projectPath, filePath, options = {}) {
  const { dryRun = false, skipDedupCheck = false, forceCreate = false, overrides = {}, additionalTags = [] } = options;

  const result = {
    success: false,
    mode: ImportMode.FILE,
    filePath,
    dryRun,
    metadata: null,
    insightId: null,
    insightFilePath: null,
    warnings: [],
    error: null
  };

  // Resolve file path
  const resolvedPath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(projectPath, filePath);

  // Step 1: File validation
  const validation = validateFile(resolvedPath);
  if (!validation.valid) {
    result.error = validation.error;
    return result;
  }

  // Step 2: Parse file content
  const parsing = parseFile(resolvedPath);
  if (!parsing.success) {
    result.error = parsing.error;
    return result;
  }

  // Step 3: Extract metadata from file
  const metadata = extractMetadataFromFile(resolvedPath, parsing.content, parsing.type);

  // Merge with overrides
  const finalMetadata = {
    ...metadata,
    ...overrides
  };

  // Add additional tags
  if (additionalTags.length > 0) {
    finalMetadata.tags = [...new Set([...(finalMetadata.tags || []), ...additionalTags])];
  }

  // Validate metadata
  const metadataValidation = validateMetadata(finalMetadata);
  result.warnings = metadataValidation.warnings;

  if (!metadataValidation.isValid) {
    result.error = `Invalid metadata: ${metadataValidation.errors.join(', ')}`;
    return result;
  }

  result.metadata = finalMetadata;

  // Step 4: Deduplication check (unless skipped)
  if (!skipDedupCheck) {
    const dedupResult = checkBeforeImport(projectPath, {
      title: finalMetadata.title,
      tags: finalMetadata.tags,
      content: parsing.content
    });

    result.dedupCheck = dedupResult;

    if (dedupResult.hasSimilar && !forceCreate) {
      result.success = false;
      result.error = 'Similar insight(s) already exist';
      result.similarInsights = dedupResult.similar;
      result.suggestions = dedupResult.suggestions;
      return result;
    }
  }

  // If dry run, return preview
  if (dryRun) {
    const title = finalMetadata.title || 'untitled';
    const slug = title.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')    // Non-alphanumeric → single dash
      .replace(/^-+|-+$/g, '')        // Remove leading/trailing dashes
      .substring(0, 30);
    result.insightId = generateInsightId(new Date(), slug);
    result.success = true;
    return result;
  }

  // Create the insight
  const createResult = createInsight(projectPath, {
    source: {
      title: finalMetadata.title,
      type: finalMetadata.type,
      author: finalMetadata.author,
      affiliation: finalMetadata.affiliation,
      date: finalMetadata.date,
      url: null,
      credibility: finalMetadata.credibility
    },
    content: parsing.content,
    tags: finalMetadata.tags
  });

  if (!createResult.success) {
    result.error = createResult.error;
    return result;
  }

  result.success = true;
  result.insightId = createResult.insightId;
  result.insightFilePath = createResult.filePath;

  return result;
}

/**
 * Validate file before import
 * @param {string} filePath - Absolute path to file
 * @returns {Object} Validation result
 */
function validateFile(filePath) {
  const MAX_FILE_SIZE = 1024 * 1024; // 1MB
  const SUPPORTED_EXTENSIONS = ['.md', '.txt', '.json'];

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return {
      valid: false,
      error: `文件不存在: ${filePath}`
    };
  }

  // Check if file is readable
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
  } catch {
    return {
      valid: false,
      error: `文件不可读: ${filePath}`
    };
  }

  // Check file size
  const stats = fs.statSync(filePath);
  if (stats.size > MAX_FILE_SIZE) {
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `文件过大: ${sizeMB} MB (限制: 1MB)`
    };
  }

  // Check file extension
  const ext = path.extname(filePath).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `不支持的文件类型: ${ext} (支持: .md, .txt, .json)`
    };
  }

  return { valid: true };
}

/**
 * Parse file content based on type
 * @param {string} filePath - Path to file
 * @returns {Object} Parsing result
 */
function parseFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  try {
    let content;
    let type = ext;

    if (ext === '.json') {
      // JSON file: parse and extract content field
      const rawData = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(rawData);

      if (data.content) {
        content = data.content;
      } else if (data.text) {
        content = data.text;
      } else {
        return {
          success: false,
          error: 'JSON 文件必须包含 content 或 text 字段'
        };
      }

      // Extract additional metadata from JSON if available
      type = 'json';
    } else {
      // .md or .txt file: read as is
      content = fs.readFileSync(filePath, 'utf8');

      if (ext === '.md') {
        // Remove YAML frontmatter if present
        content = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');
      }
    }

    return {
      success: true,
      content,
      type
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        success: false,
        error: `文件不存在: ${filePath}`
      };
    }

    if (error instanceof SyntaxError) {
      return {
        success: false,
        error: `JSON 格式错误: ${error.message}`
      };
    }

    return {
      success: false,
      error: `读取文件失败: ${error.message}`
    };
  }
}

/**
 * Extract metadata from file
 * @param {string} filePath - Path to file
 * @param {string} content - File content
 * @param {string} fileType - File type (.md, .txt, .json)
 * @param {Object} [options] - Extraction options
 * @param {boolean} [options.smartTitle] - Enable smart title extraction
 * @returns {Object} Extracted metadata
 */
function extractMetadataFromFile(filePath, content, fileType, options = {}) {
  const { smartTitle = true } = options;

  const metadata = {
    title: null,
    type: 'documentation',
    author: null,
    affiliation: null,
    date: null,
    credibility: 'medium',
    tags: []
  };

  // Extract title based on file type
  if (fileType === '.md') {
    // For markdown: only use first line as title if it starts with #
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length > 0) {
      const firstLine = lines[0].trim();
      // Only treat as title if it's a heading
      if (firstLine.startsWith('#')) {
        metadata.title = firstLine.replace(/^#+\s*/, '');
      }
      // Otherwise, fall back to filename below
    }
  } else if (fileType === '.txt') {
    // For text files: use smart title extraction if enabled
    if (smartTitle) {
      metadata.title = extractSmartTitleFromText(content);
    } else {
      // Simple fallback: first line up to 50 chars
      const lines = content.split('\n').filter(line => line.trim());
      if (lines.length > 0) {
        const firstLine = lines[0].trim();
        metadata.title = firstLine.length > 50
          ? firstLine.substring(0, 50) + '...'
          : firstLine;
      }
    }
  }
  // For .json: may have title field in metadata, handled below
  else if (fileType === 'json') {
    // For JSON: read and parse the file to extract metadata
    try {
      const rawData = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(rawData);
      metadata.title = data.title || null;
      metadata.author = data.author || null;
      metadata.affiliation = data.affiliation || null;
      metadata.credibility = data.credibility || 'medium';
      metadata.tags = data.tags || [];
    } catch {
      // Fall back to default
    }
  }

  // Fallback to filename if no title extracted
  if (!metadata.title) {
    metadata.title = path.basename(filePath, path.extname(filePath));
  }

  // Extract date from file modification time
  const stats = fs.statSync(filePath);
  metadata.date = stats.mtime.toISOString().split('T')[0];

  // Extract tags from filename keywords
  const filename = path.basename(filePath, path.extname(filePath));
  const keywords = filename.toLowerCase().split(/[-_\s]+/).filter(word => word.length > 3);
  metadata.tags = [...new Set([...metadata.tags, ...keywords])];

  return metadata;
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

    // Show similar insights if dedup check failed
    if (result.similarInsights && result.similarInsights.length > 0) {
      lines.push('');
      lines.push('⚠️ 发现相似洞见:');
      for (const match of result.similarInsights) {
        const insight = match.insight;
        const score = (match.similarity * 100).toFixed(0);
        lines.push(`   📄 ${insight.id} (相似度: ${score}%)`);
        lines.push(`      标题: ${insight.title || '(无标题)'}`);
        lines.push(`      状态: ${insight.status}`);
      }
      lines.push('');
      lines.push('💡 建议:');
      if (result.suggestions && result.suggestions.length > 0) {
        for (const suggestion of result.suggestions) {
          lines.push(`   ${suggestion.message}`);
        }
      }
      lines.push('');
      lines.push('   如确需创建新洞见，使用 --force 参数');
    } else if (result.mode === ImportMode.URL) {
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
  importFromFile,
  batchImport,

  // Utility functions
  formatImportResult,
  checkUrlSupport,

  // Deduplication (re-exported for convenience)
  checkBeforeImport,
  formatDedupResult,

  // Constants
  ImportMode
};
