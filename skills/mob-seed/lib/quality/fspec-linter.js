/**
 * fspec Linter (规格检查器)
 *
 * 检查 fspec 文件质量，识别模糊词汇、格式错误、缺失字段。
 *
 * @see openspec/changes/v2.0-seed-complete/specs/quality/fspec-linter.fspec.md
 * @module lib/quality/fspec-linter
 * @version 1.0.0
 */

'use strict';

/**
 * 模糊词汇列表
 * @see REQ-001: 模糊词汇检测
 */
const FUZZY_WORDS = {
  degree: {
    zh: ['某种', '一些', '大概', '可能', '也许', '差不多', '基本上'],
    en: ['maybe', 'perhaps', 'probably', 'approximately', 'roughly']
  },
  time: {
    zh: ['适时', '合适时候', '尽快', '稍后', '不久'],
    en: ['soon', 'later', 'eventually', 'in time']
  },
  quantity: {
    zh: ['若干', '几个', '多个', '很多', '少量'],
    en: ['several', 'many', 'few', 'a lot']
  },
  condition: {
    zh: ['如有必要', '视情况', '酌情', '适当'],
    en: ['if necessary', 'as needed', 'when required', 'appropriately']
  },
  scope: {
    zh: ['等等', '之类', '相关', '类似'],
    en: ['etc', 'and so on', 'related', 'similar', 'and more']
  }
};

/**
 * 必需字段列表
 * @see REQ-002: 格式验证
 */
const REQUIRED_FIELDS = [
  { name: '状态', pattern: /状态:\s*(draft|review|implementing|archived)/ },
  { name: '版本', pattern: /版本:\s*\d+\.\d+\.\d+/ },
  { name: '技术栈', pattern: /技术栈:\s*\w+/ },
  { name: '派生路径', pattern: /派生路径:\s*.+/ },
  { name: '概述', pattern: /## 概述|## Overview/ },
  { name: 'Requirements', pattern: /## ADDED Requirements|### REQ-\d+/ }
];

/**
 * 检测模糊词汇
 *
 * @see REQ-001 AC-001: 支持中英文模糊词检测
 * @see REQ-001 AC-002: 提供替换建议
 *
 * @param {string} content - 文件内容
 * @returns {Array<Object>} 检测结果列表
 */
function detectFuzzyWords(content) {
  const matches = [];
  const lines = content.split('\n');

  for (const [category, words] of Object.entries(FUZZY_WORDS)) {
    const allWords = [...words.zh, ...words.en];

    for (const word of allWords) {
      lines.forEach((lineContent, lineIndex) => {
        let pos = 0;
        while ((pos = lineContent.indexOf(word, pos)) !== -1) {
          matches.push({
            word,
            line: lineIndex + 1,
            column: pos + 1,
            category,
            context: lineContent.trim()
          });
          pos += word.length;
        }
      });
    }
  }

  return matches.sort((a, b) => a.line - b.line || a.column - b.column);
}

/**
 * 验证必需字段
 *
 * @see REQ-002 AC-004: 报告缺失字段
 *
 * @param {string} content - 文件内容
 * @returns {Array<Object>} 缺失字段列表
 */
function validateRequiredFields(content) {
  const errors = [];

  for (const field of REQUIRED_FIELDS) {
    if (!field.pattern.test(content)) {
      errors.push({
        field: field.name,
        message: `缺少必需字段: ${field.name}`,
        severity: 'error'
      });
    }
  }

  return errors;
}

/**
 * 验证 REQ/AC 编号格式
 *
 * @param {string} content - 文件内容
 * @returns {Array<Object>} 格式问题列表
 */
function validateIdFormat(content) {
  const errors = [];
  const lines = content.split('\n');

  const reqIds = new Map();
  const acIds = new Map();

  lines.forEach((line, index) => {
    const reqMatch = line.match(/###\s+(REQ-\d+)/);
    if (reqMatch) {
      const id = reqMatch[1];
      if (reqIds.has(id)) {
        reqIds.get(id).push(index + 1);
      } else {
        reqIds.set(id, [index + 1]);
      }
    }

    const acMatch = line.match(/\[\s*\]\s*(AC-\d+)/);
    if (acMatch) {
      const id = acMatch[1];
      if (acIds.has(id)) {
        acIds.get(id).push(index + 1);
      } else {
        acIds.set(id, [index + 1]);
      }
    }
  });

  for (const [id, lineNums] of reqIds) {
    if (lineNums.length > 1) {
      errors.push({ id, message: `重复 ${id}`, lines: lineNums, severity: 'error' });
    }
  }

  for (const [id, lineNums] of acIds) {
    if (lineNums.length > 1) {
      errors.push({ id, message: `重复 ${id}`, lines: lineNums, severity: 'error' });
    }
  }

  return errors;
}

/**
 * 检查 Scenario 格式
 *
 * @param {string} content - 文件内容
 * @returns {Array<Object>} 格式问题列表
 */
function validateScenarioFormat(content) {
  const errors = [];
  const lines = content.split('\n');

  let inScenario = false;
  let scenarioName = '';
  let scenarioLine = 0;
  let hasWhen = false;
  let hasThen = false;

  const checkScenario = () => {
    if (inScenario) {
      if (!hasWhen) {
        errors.push({ scenario: scenarioName, line: scenarioLine, message: `缺少 WHEN` });
      }
      if (!hasThen) {
        errors.push({ scenario: scenarioName, line: scenarioLine, message: `缺少 THEN` });
      }
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const match = line.match(/^\*\*Scenario:\s*(.+)\*\*$/);

    if (match) {
      checkScenario();
      inScenario = true;
      scenarioName = match[1];
      scenarioLine = i + 1;
      hasWhen = false;
      hasThen = false;
    } else if (inScenario) {
      if (line.startsWith('- WHEN ')) hasWhen = true;
      if (line.startsWith('- THEN ')) hasThen = true;
      if (line.startsWith('**') && !line.includes('Scenario')) {
        checkScenario();
        inScenario = false;
      }
    }
  }

  checkScenario();
  return errors;
}

/**
 * 执行完整的 lint 检查
 *
 * @param {string} filePath - 文件路径
 * @param {Object} options - 检查选项
 * @returns {Object} 检查结果
 */
function lintFile(filePath, options = {}) {
  const fs = require('fs');
  const content = fs.readFileSync(filePath, 'utf-8');
  const result = lintContent(content, options);
  result.file = filePath;
  return result;
}

function lintContent(content, options = {}) {
  const errors = [];
  const warnings = [];

  errors.push(...validateRequiredFields(content));
  errors.push(...validateIdFormat(content));
  errors.push(...validateScenarioFormat(content));

  const fuzzy = detectFuzzyWords(content);
  for (const m of fuzzy) {
    warnings.push({ type: 'fuzzy-word', ...m, severity: 'warning' });
  }

  return { errors, warnings, stats: { errorCount: errors.length, warningCount: warnings.length } };
}

/**
 * 批量检查多个文件
 *
 * @param {Array<string>} filePaths - 文件路径列表
 * @param {Object} options - 检查选项
 * @returns {Object} 批量检查结果
 */
function lintFiles(dirPath, options = {}) {
  const fs = require('fs');
  const path = require('path');
  const results = [];

  function scan(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) scan(full);
      else if (e.name.endsWith('.fspec.md')) results.push(lintFile(full, options));
    }
  }

  scan(dirPath);
  return {
    results,
    summary: {
      totalFiles: results.length,
      passedFiles: results.filter(r => r.errors.length === 0).length,
      totalErrors: results.reduce((s, r) => s + r.errors.length, 0),
      totalWarnings: results.reduce((s, r) => s + r.warnings.length, 0)
    }
  };
}

/**
 * 格式化输出结果
 *
 * @param {Object} result - 检查结果
 * @param {string} format - 输出格式 (text/json/markdown)
 * @returns {string} 格式化后的输出
 */
function formatOutput(result, format = 'text') {
  const lines = [];
  if (result.errors.length === 0 && result.warnings.length === 0) {
    return '✅ 没有发现问题';
  }
  for (const e of result.errors) lines.push(`❌ ${e.message || e.field}`);
  for (const w of result.warnings) lines.push(`⚠️ 第${w.line}行: ${w.word} (${w.category})`);
  return lines.join('\n');
}

/**
 * 添加自定义模糊词
 *
 * @see REQ-001 AC-003: 支持自定义词汇表
 *
 * @param {string} word - 词汇
 * @param {string} category - 类别
 * @param {string} lang - 语言 (zh/en)
 */
function addFuzzyWord(word, category, lang = 'zh') {
  if (!FUZZY_WORDS[category]) {
    FUZZY_WORDS[category] = { zh: [], en: [] };
  }
  if (!FUZZY_WORDS[category][lang].includes(word)) {
    FUZZY_WORDS[category][lang].push(word);
  }
}

module.exports = {
  // 检测
  detectFuzzyWords,
  validateRequiredFields,
  validateIdFormat,
  validateScenarioFormat,

  // 执行
  lintFile,
  lintContent,
  lintFiles,

  // 输出
  formatOutput,

  // 配置
  addFuzzyWord,

  // 常量
  FUZZY_WORDS,
  REQUIRED_FIELDS
};
