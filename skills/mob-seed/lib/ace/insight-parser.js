'use strict';

/**
 * Insight Parser Module
 *
 * Parses YAML frontmatter + Markdown format insight files.
 */

const fs = require('fs');
const path = require('path');
const {
  validateInsight,
  isValidInsightId,
  isValidStatus,
  isValidSourceType,
  isValidCredibility
} = require('./insight-types');

/**
 * Parse YAML frontmatter from content
 * Simple YAML parser for insight frontmatter
 * @param {string} yamlContent - YAML content string
 * @returns {object} Parsed object
 */
function parseYamlFrontmatter(yamlContent) {
  const result = {};
  const lines = yamlContent.split('\n');
  const stack = [{ obj: result, indent: -1 }];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) continue;

    // Calculate indentation
    const indent = line.search(/\S/);
    const trimmed = line.trim();

    // Handle array items
    if (trimmed.startsWith('- ')) {
      const value = trimmed.substring(2).trim();
      const parent = stack[stack.length - 1];
      const keys = Object.keys(parent.obj);
      const lastKey = keys[keys.length - 1];

      if (lastKey && Array.isArray(parent.obj[lastKey])) {
        // Parse value (remove quotes if present)
        const parsed = parseYamlValue(value);
        parent.obj[lastKey].push(parsed);
      }
      continue;
    }

    // Handle key-value pairs
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;

    const key = trimmed.substring(0, colonIndex).trim();
    let value = trimmed.substring(colonIndex + 1).trim();

    // Pop stack until we find appropriate parent
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1];

    if (value === '' || value === '|' || value === '>') {
      // Nested object or multiline
      if (value === '') {
        // Check if next line is indented more (nested object)
        const nextLine = lines[i + 1];
        if (nextLine && nextLine.search(/\S/) > indent) {
          parent.obj[key] = {};
          stack.push({ obj: parent.obj[key], indent });
        } else {
          parent.obj[key] = '';
        }
      } else {
        // Multiline string - collect until dedent
        const multilineIndent = indent;
        let multiline = '';
        let j = i + 1;
        while (j < lines.length) {
          const nextLine = lines[j];
          if (nextLine.trim() === '') {
            multiline += '\n';
            j++;
            continue;
          }
          const nextIndent = nextLine.search(/\S/);
          if (nextIndent <= multilineIndent) break;
          multiline += (multiline ? '\n' : '') + nextLine.trim();
          j++;
        }
        parent.obj[key] = multiline;
        i = j - 1;
      }
    } else if (value.startsWith('[') && value.endsWith(']')) {
      // Inline array
      const arrayContent = value.slice(1, -1);
      if (arrayContent.trim() === '') {
        parent.obj[key] = [];
      } else {
        parent.obj[key] = arrayContent.split(',').map(v => parseYamlValue(v.trim()));
      }
    } else {
      // Simple value
      parent.obj[key] = parseYamlValue(value);
    }
  }

  return result;
}

/**
 * Parse a YAML value (handle quotes, booleans, numbers)
 * @param {string} value - Raw value string
 * @returns {*} Parsed value
 */
function parseYamlValue(value) {
  if (!value) return '';

  // Remove quotes
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  // Boolean
  if (value === 'true') return true;
  if (value === 'false') return false;

  // Number
  if (/^-?\d+$/.test(value)) return parseInt(value, 10);
  if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);

  return value;
}

/**
 * Parse insight file content
 * @param {string} content - File content with YAML frontmatter
 * @returns {object} Parsed insight object with frontmatter and body sections
 */
function parseInsightContent(content) {
  const result = {
    frontmatter: null,
    body: '',
    sections: {},
    raw: content
  };

  // Check for frontmatter
  if (!content.startsWith('---')) {
    result.body = content;
    return result;
  }

  // Find end of frontmatter
  const endIndex = content.indexOf('\n---', 3);
  if (endIndex === -1) {
    result.body = content;
    return result;
  }

  // Parse frontmatter
  const frontmatterStr = content.substring(4, endIndex);
  result.frontmatter = parseYamlFrontmatter(frontmatterStr);

  // Parse body
  result.body = content.substring(endIndex + 4).trim();

  // Parse sections from body
  result.sections = parseMarkdownSections(result.body);

  return result;
}

/**
 * Parse markdown sections (## headings)
 * @param {string} body - Markdown body content
 * @returns {object} Sections by heading
 */
function parseMarkdownSections(body) {
  const sections = {};
  const lines = body.split('\n');
  let currentSection = null;
  let currentContent = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      // Save previous section
      if (currentSection) {
        sections[currentSection] = currentContent.join('\n').trim();
      }
      currentSection = line.substring(3).trim();
      currentContent = [];
    } else if (currentSection) {
      currentContent.push(line);
    }
  }

  // Save last section
  if (currentSection) {
    sections[currentSection] = currentContent.join('\n').trim();
  }

  return sections;
}

/**
 * Parse insight file and return structured insight object
 * @param {string} content - File content
 * @returns {object} Result with insight object or errors
 */
function parseInsight(content) {
  const parsed = parseInsightContent(content);

  if (!parsed.frontmatter) {
    return {
      success: false,
      errors: ['No YAML frontmatter found'],
      insight: null
    };
  }

  const fm = parsed.frontmatter;

  // Build insight object from frontmatter
  const insight = {
    id: fm.id,
    source: {
      title: fm.source?.title || '',
      type: fm.source?.type || 'expert_opinion',
      author: fm.source?.author || '',
      affiliation: fm.source?.affiliation || '',
      date: fm.source?.date || '',
      context: fm.source?.context || '',
      url: fm.source?.url || '',
      credibility: fm.source?.credibility || 'medium',
      secondary_sources: fm.source?.secondary_sources || []
    },
    date: fm.date,
    status: fm.status,
    modelEra: fm.model_era || fm.modelEra || '',
    reviewTrigger: fm.review_trigger || fm.reviewTrigger || '',
    tags: fm.tags || [],
    content: parsed.sections['原始洞见'] || parsed.sections['Original Insight'] || '',
    evaluation: parsed.sections['评估笔记'] || parsed.sections['Evaluation Notes'] || '',
    decision: parsed.sections['采纳决策'] || parsed.sections['Adoption Decision'] || ''
  };

  // Validate
  const validation = validateInsight(insight);

  return {
    success: validation.isValid,
    errors: validation.errors,
    insight,
    sections: parsed.sections,
    raw: content
  };
}

/**
 * Parse insight file from path
 * @param {string} filePath - Path to insight file
 * @returns {object} Result with insight object or errors
 */
function parseInsightFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        errors: [`File not found: ${filePath}`],
        insight: null
      };
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const result = parseInsight(content);
    result.filePath = filePath;
    result.fileName = path.basename(filePath);

    return result;
  } catch (err) {
    return {
      success: false,
      errors: [`Error reading file: ${err.message}`],
      insight: null
    };
  }
}

/**
 * Extract metadata summary from insight
 * @param {object} insight - Insight object
 * @returns {object} Metadata summary for indexing
 */
function extractMetadata(insight) {
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

module.exports = {
  parseYamlFrontmatter,
  parseYamlValue,
  parseInsightContent,
  parseMarkdownSections,
  parseInsight,
  parseInsightFile,
  extractMetadata
};
