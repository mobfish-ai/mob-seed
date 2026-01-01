/**
 * State Evolution - 状态自动进化器
 *
 * 实现 AC 测试通过后自动更新状态、进度可视化面板等功能。
 *
 * @module workflow/state-evolution
 * @see openspec/changes/v2.1-release-automation/specs/workflow/state-evolution.fspec.md
 */

const fs = require('fs');
const path = require('path');

// 状态转换规则
const STATE_TRANSITIONS = {
  draft: ['review'],
  review: ['implementing', 'draft'],
  implementing: ['archived', 'review'],
  archived: ['draft']  // 需要 reopen 选项
};

/**
 * 解析测试输出，提取 AC 结果
 * @param {string} testOutput - 测试输出文本
 * @returns {Array<{acId: string, passed: boolean}>} AC 结果数组
 */
function parseTestResults(testOutput) {
  if (!testOutput || typeof testOutput !== 'string') {
    return [];
  }

  const results = [];
  // 匹配格式: ✔ AC-001: ... 或 ✖ AC-001: ...
  const acPattern = /([✔✓✖✗])\s+(AC-\d+):\s*([^\n]+)/g;

  let match;
  while ((match = acPattern.exec(testOutput)) !== null) {
    const [, status, acId, description] = match;
    results.push({
      acId,
      passed: status === '✔' || status === '✓',
      description: description.trim()
    });
  }

  return results;
}

/**
 * 更新规格文件中的 AC 状态
 * @param {string} specPath - 规格文件路径
 * @param {Array<{acId: string, passed: boolean}>} results - 测试结果
 * @returns {Promise<{success: boolean, updated: number, error?: string}>}
 */
async function updateACStatus(specPath, results) {
  try {
    if (!fs.existsSync(specPath)) {
      return { success: false, updated: 0, error: `文件不存在: ${specPath}` };
    }

    let content = fs.readFileSync(specPath, 'utf-8');
    let updated = 0;

    for (const result of results) {
      if (!result.passed) continue;

      // 查找 AC 标题并更新
      // 格式: ### AC-001: 描述 或 - [ ] AC-001: 描述
      const patterns = [
        // 标题格式: ### AC-001: ...
        new RegExp(`(###\\s*${result.acId}:)`, 'g'),
        // 复选框格式: - [ ] AC-001: ...
        new RegExp(`(- \\[ \\]\\s*${result.acId}:)`, 'g')
      ];

      for (const pattern of patterns) {
        if (pattern.test(content)) {
          // 对于复选框格式，将 [ ] 改为 [x]
          if (pattern.source.includes('\\[ \\]')) {
            content = content.replace(
              new RegExp(`- \\[ \\]\\s*(${result.acId}:)`, 'g'),
              `- [x] $1`
            );
            updated++;
          }
        }
      }
    }

    if (updated > 0) {
      fs.writeFileSync(specPath, content);
    }

    return { success: true, updated };
  } catch (error) {
    return { success: false, updated: 0, error: error.message };
  }
}

/**
 * 检查是否可以进行状态转换
 * @param {string} current - 当前状态
 * @param {string} target - 目标状态
 * @param {object} [options] - 选项
 * @param {boolean} [options.reopen] - 是否为重新开启操作
 * @returns {{allowed: boolean, reason?: string}}
 */
function canTransition(current, target, options = {}) {
  const allowed = STATE_TRANSITIONS[current];

  if (!allowed) {
    return { allowed: false, reason: `未知状态: ${current}` };
  }

  // 特殊处理: archived -> draft 需要 reopen
  if (current === 'archived' && target === 'draft') {
    if (options.reopen) {
      return { allowed: true };
    }
    return { allowed: false, reason: '从 archived 转换到 draft 需要使用 --reopen 选项' };
  }

  if (allowed.includes(target)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `不允许从 ${current} 转换到 ${target}，允许的目标: ${allowed.join(', ')}`
  };
}

/**
 * 执行状态转换
 * @param {string} specPath - 规格文件路径
 * @param {string} targetState - 目标状态
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function transitionState(specPath, targetState) {
  try {
    if (!fs.existsSync(specPath)) {
      return { success: false, error: `文件不存在: ${specPath}` };
    }

    let content = fs.readFileSync(specPath, 'utf-8');

    // 匹配 YAML frontmatter 中的状态或正文中的状态
    const statePatterns = [
      // YAML frontmatter: state: xxx
      /^(state:\s*)(\w+)/m,
      // 正文格式: > 状态: xxx
      /(>\s*状态:\s*)(\w+)/m,
      // 英文格式: > status: xxx
      /(>\s*status:\s*)(\w+)/mi
    ];

    let updated = false;
    for (const pattern of statePatterns) {
      if (pattern.test(content)) {
        content = content.replace(pattern, `$1${targetState}`);
        updated = true;
        break;
      }
    }

    if (!updated) {
      return { success: false, error: '未找到状态字段' };
    }

    fs.writeFileSync(specPath, content);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 计算提案进度
 * @param {string} proposalPath - 提案目录路径
 * @returns {object} 进度信息
 */
function calculateProgress(proposalPath) {
  const progress = {
    overall: 0,
    state: 'draft',
    specs: { total: 0, complete: 0 },
    code: { total: 0, derived: 0 },
    tests: { total: 0, passed: 0 },
    acs: { total: 0, complete: 0 },
    canArchive: false
  };

  try {
    // 查找 specs 目录
    const specsDir = path.join(proposalPath, 'specs');
    if (!fs.existsSync(specsDir)) {
      return progress;
    }

    // 递归查找所有 .fspec.md 文件
    const specFiles = findSpecFiles(specsDir);
    progress.specs.total = specFiles.length;

    for (const specFile of specFiles) {
      const content = fs.readFileSync(specFile, 'utf-8');

      // 统计 AC
      const acMatches = content.match(/###\s*AC-\d+/g) || [];
      progress.acs.total += acMatches.length;

      // 统计完成的 AC (带 [x] 的)
      const completedAcMatches = content.match(/- \[x\]/gi) || [];
      progress.acs.complete += completedAcMatches.length;

      // 检查规格是否完整（有概述和验收标准）
      if (content.includes('## 概述') || content.includes('## Overview')) {
        if (content.includes('## 验收标准') || content.includes('## Acceptance')) {
          progress.specs.complete++;
        }
      }
    }

    // 计算总体进度
    if (progress.acs.total > 0) {
      progress.overall = Math.round((progress.acs.complete / progress.acs.total) * 100);
    } else if (progress.specs.total > 0) {
      progress.overall = Math.round((progress.specs.complete / progress.specs.total) * 100);
    }

    // 判断是否可以归档
    if (progress.acs.total > 0 && progress.acs.complete === progress.acs.total) {
      progress.canArchive = true;
    }

    return progress;
  } catch (error) {
    return progress;
  }
}

/**
 * 递归查找规格文件
 * @param {string} dir - 目录路径
 * @returns {string[]} 规格文件路径数组
 */
function findSpecFiles(dir) {
  const files = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findSpecFiles(fullPath));
    } else if (entry.name.endsWith('.fspec.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * 渲染进度可视化面板
 * @param {object} progress - 进度信息
 * @returns {string} 格式化的进度面板
 */
function renderProgressPanel(progress) {
  const bar = renderProgressBar(progress.overall);

  const lines = [
    '┌─────────────────────────────────────────────┐',
    `│ 进度: ${bar} ${progress.overall}%`.padEnd(46) + '│',
    `│ 状态: ${progress.state}`.padEnd(46) + '│',
    '├─────────────────────────────────────────────┤',
    `│ 规格: ${progress.specs.complete}/${progress.specs.total}`.padEnd(46) + '│',
  ];

  if (progress.code) {
    lines.push(`│ 代码: ${progress.code.derived}/${progress.code.total}`.padEnd(46) + '│');
  }

  if (progress.tests) {
    lines.push(`│ 测试: ${progress.tests.passed}/${progress.tests.total}`.padEnd(46) + '│');
  }

  lines.push(`│ AC: ${progress.acs.complete}/${progress.acs.total}`.padEnd(46) + '│');
  lines.push('└─────────────────────────────────────────────┘');

  if (progress.canArchive) {
    lines.push('');
    lines.push('✅ 所有 AC 已完成，可以执行归档');
  }

  return lines.join('\n');
}

/**
 * 渲染进度条
 * @param {number} percent - 百分比 (0-100)
 * @returns {string} 进度条字符串
 */
function renderProgressBar(percent) {
  const width = 20;
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;

  return '█'.repeat(filled) + '░'.repeat(empty);
}

module.exports = {
  parseTestResults,
  updateACStatus,
  canTransition,
  transitionState,
  calculateProgress,
  renderProgressPanel,
  // 常量导出
  STATE_TRANSITIONS
};
