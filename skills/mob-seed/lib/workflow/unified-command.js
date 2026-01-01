/**
 * Unified Command Entry (统一命令入口)
 *
 * 将多个独立命令整合为统一入口，提供智能状态面板和子命令路由。
 *
 * @see openspec/changes/v2.1-release-automation/specs/workflow/unified-command.fspec.md
 * @module lib/workflow/unified-command
 * @version 1.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * 子命令映射
 */
const SUBCOMMANDS = {
  init: 'init',
  spec: 'spec',
  emit: 'emit',
  exec: 'exec',
  defend: 'defend',
  archive: 'archive'
};

/**
 * 全局选项定义
 */
const GLOBAL_OPTIONS = {
  '--quick': { description: '快速检查（秒级）', short: '-q' },
  '--fix': { description: '自动修复可修复问题', short: '-f' },
  '--auto': { description: '自动执行所有建议', short: '-a' },
  '--ci': { description: 'CI 模式（严格检查）' },
  '--strict': { description: '严格模式（警告算失败）' }
};

/**
 * 加载 SEED 配置
 * @param {string} projectPath - 项目路径
 * @returns {Object|null} 配置对象或 null
 */
function loadSeedConfig(projectPath = '.') {
  const configPath = path.join(projectPath, '.seed', 'config.json');
  if (!fs.existsSync(configPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * 检查 OpenSpec 模式
 * @param {string} projectPath - 项目路径
 * @returns {boolean}
 */
function isOpenSpecMode(projectPath = '.') {
  const config = loadSeedConfig(projectPath);
  if (config?.openspec?.enabled) return true;
  return fs.existsSync(path.join(projectPath, 'openspec'));
}

/**
 * 路由子命令
 *
 * @see FR-001: 子命令路由
 *
 * @param {string} subcommand - 子命令名称
 * @param {string[]} args - 参数列表
 * @param {Object} options - 选项
 * @returns {Promise<CommandResult>}
 */
async function routeSubcommand(subcommand, args = [], options = {}) {
  const normalizedCmd = subcommand?.toLowerCase();

  if (!normalizedCmd || !SUBCOMMANDS[normalizedCmd]) {
    return {
      success: false,
      error: `Unknown subcommand: ${subcommand}`,
      suggestion: `Available: ${Object.keys(SUBCOMMANDS).join(', ')}`
    };
  }

  return {
    success: true,
    subcommand: SUBCOMMANDS[normalizedCmd],
    args,
    options,
    commandPath: `commands/mob-seed/${normalizedCmd}.md`
  };
}

/**
 * 执行智能入口（无子命令时）
 *
 * @see FR-002: 智能默认入口
 *
 * @param {Object} options - 选项
 * @returns {Promise<StatusReport>}
 */
async function executeSmartEntry(options = {}) {
  const { projectPath = '.', quick = false } = options;

  // 检查初始化状态
  const config = loadSeedConfig(projectPath);
  if (!config) {
    return {
      success: false,
      initialized: false,
      message: 'SEED 未初始化',
      suggestion: '运行 /mob-seed:init 初始化项目'
    };
  }

  // 收集状态
  const status = await collectStatus(projectPath);

  // 快速模式只返回状态摘要
  if (quick) {
    return {
      success: true,
      mode: 'quick',
      status: {
        initialized: true,
        specsCount: status.specs.total,
        syncedCount: status.sync.synced,
        driftCount: status.drift.total
      },
      suggestions: generateQuickSuggestions(status)
    };
  }

  // 完整模式：状态 + 同步检查 + 漂移检测
  const sync = await checkSync(projectPath);
  const drift = await detectDrift(projectPath);

  return {
    success: true,
    mode: 'full',
    status,
    sync,
    drift,
    suggestions: generateSuggestions(status, sync, drift),
    timestamp: new Date().toISOString()
  };
}

/**
 * 收集项目状态
 *
 * @see FR-004: 状态收集
 *
 * @param {string} projectPath - 项目路径
 * @returns {Promise<ProjectStatus>}
 */
async function collectStatus(projectPath = '.') {
  const config = loadSeedConfig(projectPath);
  const isOpenSpec = isOpenSpecMode(projectPath);

  const status = {
    initialized: !!config,
    openspec: isOpenSpec,
    specs: { total: 0, draft: 0, review: 0, implementing: 0, archived: 0 },
    code: { total: 0, covered: 0 },
    test: { total: 0, passed: 0, failed: 0 },
    ac: { total: 0, completed: 0 },
    sync: { synced: 0, drifted: 0 },
    drift: { total: 0 }
  };

  if (!config) return status;

  // 扫描规格文件
  const specsDir = isOpenSpec
    ? path.join(projectPath, 'openspec', 'specs')
    : path.join(projectPath, config.paths?.specs || 'specs');

  if (fs.existsSync(specsDir)) {
    const specFiles = scanSpecFiles(specsDir);
    status.specs.total = specFiles.length;

    for (const specFile of specFiles) {
      const content = fs.readFileSync(specFile, 'utf-8');
      const stateMatch = content.match(/状态:\s*(draft|review|implementing|archived)/i);
      const state = stateMatch ? stateMatch[1].toLowerCase() : 'draft';
      status.specs[state] = (status.specs[state] || 0) + 1;

      // 统计 AC
      const acMatches = content.matchAll(/- \[([x ])\] AC-\d+/gi);
      for (const match of acMatches) {
        status.ac.total++;
        if (match[1].toLowerCase() === 'x') {
          status.ac.completed++;
        }
      }
    }
  }

  // 扫描变更提案（OpenSpec 模式）
  if (isOpenSpec) {
    const changesDir = path.join(projectPath, 'openspec', 'changes');
    if (fs.existsSync(changesDir)) {
      const proposals = fs.readdirSync(changesDir).filter(f =>
        fs.statSync(path.join(changesDir, f)).isDirectory()
      );

      for (const proposal of proposals) {
        const proposalPath = path.join(changesDir, proposal, 'proposal.md');
        if (fs.existsSync(proposalPath)) {
          const content = fs.readFileSync(proposalPath, 'utf-8');
          const stateMatch = content.match(/状态:\s*(draft|review|implementing)/i);
          const state = stateMatch ? stateMatch[1].toLowerCase() : 'draft';
          status.specs[state] = (status.specs[state] || 0) + 1;
          status.specs.total++;
        }
      }
    }
  }

  return status;
}

/**
 * 扫描规格文件（递归）
 * @param {string} dir - 目录路径
 * @returns {string[]} 文件路径列表
 */
function scanSpecFiles(dir) {
  const files = [];

  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...scanSpecFiles(fullPath));
    } else if (entry.name.endsWith('.fspec.md') || entry.name.endsWith('.spec.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * 检查同步状态
 *
 * @see FR-005: 同步检查
 *
 * @param {string} projectPath - 项目路径
 * @returns {Promise<SyncResult>}
 */
async function checkSync(projectPath = '.') {
  const config = loadSeedConfig(projectPath);
  const isOpenSpec = isOpenSpecMode(projectPath);

  const result = {
    checked: true,
    specsChecked: 0,
    synced: 0,
    drifted: 0,
    issues: []
  };

  if (!config) {
    result.checked = false;
    result.issues.push({ type: 'error', message: 'SEED 未初始化' });
    return result;
  }

  // 扫描规格并检查同步状态
  const specsDir = isOpenSpec
    ? path.join(projectPath, 'openspec', 'specs')
    : path.join(projectPath, config.paths?.specs || 'specs');

  const specFiles = scanSpecFiles(specsDir);
  result.specsChecked = specFiles.length;

  for (const specFile of specFiles) {
    const specName = path.basename(specFile).replace(/\.(f)?spec\.md$/, '');
    const manifestPath = path.join(projectPath, '.seed', 'output', specName, 'seed-manifest.json');

    if (!fs.existsSync(manifestPath)) {
      result.drifted++;
      result.issues.push({
        type: 'warning',
        spec: specName,
        message: '未派生',
        suggestion: `/mob-seed:emit ${specName}`
      });
    } else {
      result.synced++;
    }
  }

  return result;
}

/**
 * 检测漂移
 *
 * @see FR-006: 漂移检测
 *
 * @param {string} projectPath - 项目路径
 * @returns {Promise<DriftResult>}
 */
async function detectDrift(projectPath = '.') {
  const result = {
    checked: true,
    total: 0,
    missing: [],
    additions: [],
    mutations: []
  };

  const config = loadSeedConfig(projectPath);
  if (!config) {
    result.checked = false;
    return result;
  }

  const outputDir = path.join(projectPath, '.seed', 'output');
  if (!fs.existsSync(outputDir)) {
    return result;
  }

  // 检查每个清单
  const specDirs = fs.readdirSync(outputDir).filter(f =>
    fs.statSync(path.join(outputDir, f)).isDirectory()
  );

  for (const specDir of specDirs) {
    const manifestPath = path.join(outputDir, specDir, 'seed-manifest.json');
    if (!fs.existsSync(manifestPath)) continue;

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

      for (const output of manifest.outputs || []) {
        const outputPath = path.join(projectPath, output.path);

        if (!fs.existsSync(outputPath)) {
          result.missing.push({
            spec: specDir,
            type: output.type,
            path: output.path
          });
          result.total++;
        } else if (output.hash) {
          // 检查文件是否被修改（简单实现：比较文件大小）
          const stat = fs.statSync(outputPath);
          if (manifest.generatedAt && stat.mtimeMs > new Date(manifest.generatedAt).getTime()) {
            result.mutations.push({
              spec: specDir,
              type: output.type,
              path: output.path,
              message: '文件可能已被手动修改'
            });
            result.total++;
          }
        }
      }
    } catch {
      // 清单解析失败
      result.mutations.push({
        spec: specDir,
        type: 'manifest',
        message: '清单文件损坏'
      });
      result.total++;
    }
  }

  return result;
}

/**
 * 生成快速建议
 * @param {Object} status - 项目状态
 * @returns {string[]}
 */
function generateQuickSuggestions(status) {
  const suggestions = [];

  if (status.specs.draft > 0) {
    suggestions.push(`📝 ${status.specs.draft} 个草稿规格待审查`);
  }
  if (status.specs.review > 0) {
    suggestions.push(`🔍 ${status.specs.review} 个规格待派生`);
  }
  if (status.specs.implementing > 0) {
    suggestions.push(`🔨 ${status.specs.implementing} 个功能开发中`);
  }

  return suggestions;
}

/**
 * 生成完整建议
 * @param {Object} status - 项目状态
 * @param {Object} sync - 同步结果
 * @param {Object} drift - 漂移结果
 * @returns {Object[]}
 */
function generateSuggestions(status, sync, drift) {
  const suggestions = [];

  // 基于状态生成建议
  if (status.specs.draft > 0) {
    suggestions.push({
      priority: 1,
      action: '提交审查',
      command: '/mob-seed:spec --submit',
      reason: `${status.specs.draft} 个草稿规格待审查`
    });
  }

  if (status.specs.review > 0) {
    suggestions.push({
      priority: 2,
      action: '派生代码',
      command: '/mob-seed:emit',
      reason: `${status.specs.review} 个规格待派生`
    });
  }

  // 基于同步检查生成建议
  if (sync.drifted > 0) {
    suggestions.push({
      priority: 1,
      action: '重新派生',
      command: '/mob-seed:emit --force',
      reason: `${sync.drifted} 个规格未同步`
    });
  }

  // 基于漂移检测生成建议
  if (drift.missing.length > 0) {
    suggestions.push({
      priority: 1,
      action: '恢复缺失文件',
      command: '/mob-seed:emit --restore',
      reason: `${drift.missing.length} 个派生文件缺失`
    });
  }

  if (drift.mutations.length > 0) {
    suggestions.push({
      priority: 2,
      action: '检查手动修改',
      command: '/mob-seed:defend --diff',
      reason: `${drift.mutations.length} 个文件可能被手动修改`
    });
  }

  // 按优先级排序
  return suggestions.sort((a, b) => a.priority - b.priority);
}

/**
 * 格式化状态面板输出
 * @param {Object} report - 状态报告
 * @returns {string}
 */
function formatStatusPanel(report) {
  const lines = [
    '🌱 SEED 状态面板',
    '━'.repeat(40)
  ];

  if (!report.success) {
    lines.push(`❌ ${report.message}`);
    if (report.suggestion) {
      lines.push(`💡 ${report.suggestion}`);
    }
    return lines.join('\n');
  }

  // 规格状态
  const s = report.status;
  lines.push('');
  lines.push('📊 规格状态');
  lines.push(`   总计: ${s.specs.total} | 草稿: ${s.specs.draft} | 审查中: ${s.specs.review} | 实现中: ${s.specs.implementing} | 已归档: ${s.specs.archived}`);

  // AC 完成度
  if (s.ac.total > 0) {
    const acRate = Math.round((s.ac.completed / s.ac.total) * 100);
    lines.push(`   AC 完成度: ${s.ac.completed}/${s.ac.total} (${acRate}%)`);
  }

  // 同步状态
  if (report.sync) {
    lines.push('');
    lines.push('🔄 同步状态');
    lines.push(`   已同步: ${report.sync.synced} | 未同步: ${report.sync.drifted}`);
  }

  // 漂移检测
  if (report.drift && report.drift.total > 0) {
    lines.push('');
    lines.push('⚠️ 漂移检测');
    lines.push(`   缺失: ${report.drift.missing.length} | 修改: ${report.drift.mutations.length}`);
  }

  // 建议行动
  if (report.suggestions && report.suggestions.length > 0) {
    lines.push('');
    lines.push('💡 建议行动');
    for (const sug of report.suggestions) {
      lines.push(`   ${sug.priority}. ${sug.action}: ${sug.command}`);
      lines.push(`      └─ ${sug.reason}`);
    }
  }

  lines.push('');
  lines.push('━'.repeat(40));

  return lines.join('\n');
}

module.exports = {
  // 核心功能
  routeSubcommand,
  executeSmartEntry,
  collectStatus,
  checkSync,
  detectDrift,

  // 辅助功能
  formatStatusPanel,
  generateSuggestions,
  loadSeedConfig,
  isOpenSpecMode,

  // 常量
  SUBCOMMANDS,
  GLOBAL_OPTIONS
};
