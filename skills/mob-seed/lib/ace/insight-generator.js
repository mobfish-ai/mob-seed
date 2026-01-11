'use strict';

/**
 * Insight Generator Module
 *
 * Generates insight files in YAML frontmatter + Markdown format.
 */

const fs = require('fs');
const path = require('path');
const {
  generateInsightId,
  createDefaultInsight,
  validateInsight
} = require('./insight-types');

/**
 * Convert object to YAML string (simple implementation)
 * @param {object} obj - Object to convert
 * @param {number} [indent=0] - Current indentation level
 * @returns {string} YAML string
 */
function objectToYaml(obj, indent = 0) {
  const spaces = '  '.repeat(indent);
  const lines = [];

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined || value === '') {
      lines.push(`${spaces}${key}: ""`);
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${spaces}${key}: []`);
      } else if (typeof value[0] === 'object') {
        // Array of objects
        lines.push(`${spaces}${key}:`);
        for (const item of value) {
          const itemLines = objectToYaml(item, indent + 2).split('\n');
          lines.push(`${spaces}  - ${itemLines[0].trim()}`);
          for (let i = 1; i < itemLines.length; i++) {
            if (itemLines[i].trim()) {
              lines.push(`${spaces}    ${itemLines[i].trim()}`);
            }
          }
        }
      } else {
        // Simple array - inline format
        const formatted = value.map(v =>
          typeof v === 'string' && v.includes(' ') ? `"${v}"` : v
        );
        lines.push(`${spaces}${key}: [${formatted.join(', ')}]`);
      }
    } else if (typeof value === 'object') {
      lines.push(`${spaces}${key}:`);
      lines.push(objectToYaml(value, indent + 1));
    } else if (typeof value === 'string') {
      // Escape strings with special characters
      if (value.includes(':') || value.includes('#') || value.includes('\n')) {
        lines.push(`${spaces}${key}: "${value.replace(/"/g, '\\"')}"`);
      } else {
        lines.push(`${spaces}${key}: ${value}`);
      }
    } else {
      lines.push(`${spaces}${key}: ${value}`);
    }
  }

  return lines.join('\n');
}

/**
 * Generate YAML frontmatter from insight object
 * @param {object} insight - Insight object
 * @returns {string} YAML frontmatter string
 */
function generateFrontmatter(insight) {
  const frontmatter = {
    id: insight.id,
    source: {
      title: insight.source?.title || '',
      type: insight.source?.type || 'expert_opinion',
      author: insight.source?.author || '',
      affiliation: insight.source?.affiliation || '',
      date: insight.source?.date || '',
      context: insight.source?.context || '',
      url: insight.source?.url || '',
      credibility: insight.source?.credibility || 'medium'
    },
    date: insight.date,
    status: insight.status || 'evaluating',
    model_era: insight.modelEra || 'claude-opus-4.5',
    review_trigger: insight.reviewTrigger || '',
    tags: insight.tags || []
  };

  // Add secondary sources if present
  if (insight.source?.secondary_sources?.length > 0) {
    frontmatter.source.secondary_sources = insight.source.secondary_sources;
  }

  return objectToYaml(frontmatter);
}

/**
 * Generate insight file content
 * @param {object} insight - Insight object
 * @returns {string} Complete file content
 */
function generateInsightContent(insight) {
  const frontmatter = generateFrontmatter(insight);

  const content = insight.content || '[洞见内容待填充]';
  const evaluation = insight.evaluation || `| 观点 | 适用性 | 理由 |
|------|--------|------|
| | | |`;
  const decision = insight.decision || `- ✅ 采纳：
- ⏸️ 观望：
- ❌ 不采纳：`;

  return `---
${frontmatter}
---

## 原始洞见

${content}

## 评估笔记

${evaluation}

## 采纳决策

${decision}

## 相关变更

- [待填充]
`;
}

/**
 * Generate new insight with auto-generated ID
 * @param {object} data - Insight data
 * @returns {object} Result with insight content or errors
 */
function generateNewInsight(data) {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  // Generate ID from title or slug
  const slug = data.slug || (data.source?.title || 'untitled')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 30);

  const id = data.id || generateInsightId(now, slug);

  const insight = createDefaultInsight({
    id,
    date: data.date || dateStr,
    status: data.status || 'evaluating',
    modelEra: data.modelEra || 'claude-opus-4.5',
    reviewTrigger: data.reviewTrigger || '',
    tags: data.tags || [],
    content: data.content || '',
    evaluation: data.evaluation || '',
    decision: data.decision || '',
    source: data.source || {}
  });

  // Validate
  const validation = validateInsight(insight);

  if (!validation.isValid) {
    return {
      success: false,
      errors: validation.errors,
      insight: null,
      content: null
    };
  }

  const content = generateInsightContent(insight);

  return {
    success: true,
    errors: [],
    insight,
    content,
    fileName: `${id}.md`
  };
}

/**
 * Write insight to file
 * @param {string} dirPath - Directory path
 * @param {object} insight - Insight object
 * @returns {object} Result with file path or errors
 */
function writeInsightFile(dirPath, insight) {
  try {
    const result = generateNewInsight(insight);

    if (!result.success) {
      return result;
    }

    // Ensure directory exists
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    const filePath = path.join(dirPath, result.fileName);
    fs.writeFileSync(filePath, result.content, 'utf-8');

    return {
      success: true,
      errors: [],
      filePath,
      fileName: result.fileName,
      insight: result.insight
    };
  } catch (err) {
    return {
      success: false,
      errors: [`Error writing file: ${err.message}`],
      filePath: null
    };
  }
}

/**
 * Update existing insight file
 * @param {string} filePath - Path to existing file
 * @param {object} updates - Fields to update
 * @returns {object} Result
 */
function updateInsightFile(filePath, updates) {
  try {
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        errors: [`File not found: ${filePath}`]
      };
    }

    const { parseInsight } = require('./insight-parser');
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = parseInsight(content);

    if (!parsed.success) {
      return {
        success: false,
        errors: parsed.errors
      };
    }

    // Merge updates
    const updatedInsight = {
      ...parsed.insight,
      ...updates,
      source: {
        ...parsed.insight.source,
        ...(updates.source || {})
      }
    };

    // Preserve sections that aren't being updated
    if (!updates.content && parsed.sections['原始洞见']) {
      updatedInsight.content = parsed.sections['原始洞见'];
    }
    if (!updates.evaluation && parsed.sections['评估笔记']) {
      updatedInsight.evaluation = parsed.sections['评估笔记'];
    }
    if (!updates.decision && parsed.sections['采纳决策']) {
      updatedInsight.decision = parsed.sections['采纳决策'];
    }

    const newContent = generateInsightContent(updatedInsight);
    fs.writeFileSync(filePath, newContent, 'utf-8');

    return {
      success: true,
      errors: [],
      insight: updatedInsight,
      filePath
    };
  } catch (err) {
    return {
      success: false,
      errors: [`Error updating file: ${err.message}`]
    };
  }
}

module.exports = {
  objectToYaml,
  generateFrontmatter,
  generateInsightContent,
  generateNewInsight,
  writeInsightFile,
  updateInsightFile
};
