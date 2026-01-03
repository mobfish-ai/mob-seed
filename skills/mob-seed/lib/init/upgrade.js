/**
 * v3.0 升级模块
 * @module init/upgrade
 * @see openspec/changes/v3.0-ace-integration/specs/ace/migration-guide.fspec.md
 *
 * 实现 `/mob-seed:init --upgrade` 选项，将 v2.x 项目升级到 v3.0
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 升级结果
 * @typedef {Object} UpgradeResult
 * @property {boolean} success - 是否成功
 * @property {string} message - 结果消息
 * @property {Object} data - 升级详情
 */

/**
 * 升级选项
 * @typedef {Object} UpgradeOptions
 * @property {boolean} [dryRun=false] - 预览模式
 * @property {boolean} [force=false] - 强制升级
 */

// ============================================================================
// 版本常量
// ============================================================================

const CURRENT_VERSION = '3.0.0';
const MIN_UPGRADE_VERSION = '2.0.0';

/**
 * 默认 ACE 配置
 */
const DEFAULT_ACE_CONFIG = {
  enabled: true,
  sources: {
    core: ['test_failure', 'spec_drift', 'coverage_gap', 'user_feedback']
  },
  reflect: {
    auto_trigger: true,
    thresholds: {
      same_type: 3,
      same_spec: 2
    }
  }
};

// ============================================================================
// 主升级函数 (REQ-005: AC-017 ~ AC-020)
// ============================================================================

/**
 * 执行升级
 * @param {string} projectRoot - 项目根目录
 * @param {UpgradeOptions} options - 升级选项
 * @returns {UpgradeResult} 升级结果
 */
function upgrade(projectRoot, options = {}) {
  const { dryRun = false, force = false } = options;
  const changes = [];
  const warnings = [];

  // 1. 检查当前版本 (AC-017 step 1)
  const configPath = path.join(projectRoot, '.seed', 'config.json');

  if (!fs.existsSync(configPath)) {
    return {
      success: false,
      message: '❌ 未找到 .seed/config.json，请先运行 /mob-seed:init 初始化项目',
      data: null
    };
  }

  // 读取现有配置
  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (e) {
    return {
      success: false,
      message: `❌ 无法解析 config.json: ${e.message}`,
      data: null
    };
  }

  // 检查是否已经是 v3.0
  if (config.ace && !force) {
    return {
      success: false,
      message: '⚠️ 项目已包含 ACE 配置，无需升级。使用 --force 强制重新配置。',
      data: { currentConfig: config }
    };
  }

  // 2. 备份配置 (AC-018)
  const backupPath = path.join(projectRoot, '.seed', 'config.json.backup');

  if (!dryRun) {
    fs.copyFileSync(configPath, backupPath);
    changes.push(`备份配置到 ${path.relative(projectRoot, backupPath)}`);
  } else {
    changes.push(`[dry-run] 将备份配置到 config.json.backup`);
  }

  // 3. 添加 ACE 配置 (AC-019 step 3)
  const newConfig = {
    ...config,
    ace: DEFAULT_ACE_CONFIG
  };

  if (!dryRun) {
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), 'utf-8');
    changes.push('添加 ace 配置字段');
  } else {
    changes.push('[dry-run] 将添加 ace 配置字段');
  }

  // 4. 创建 observations 目录 (AC-019 step 4)
  const obsDir = path.join(projectRoot, '.seed', 'observations');
  if (!fs.existsSync(obsDir)) {
    if (!dryRun) {
      fs.mkdirSync(obsDir, { recursive: true });
      // 创建空索引
      const indexPath = path.join(obsDir, 'index.json');
      const emptyIndex = {
        version: '1.0.0',
        updated: new Date().toISOString(),
        observations: [],
        stats: { total: 0, raw: 0, triaged: 0, promoted: 0, ignored: 0 }
      };
      fs.writeFileSync(indexPath, JSON.stringify(emptyIndex, null, 2), 'utf-8');
      changes.push('创建 .seed/observations/ 目录');
    } else {
      changes.push('[dry-run] 将创建 .seed/observations/ 目录');
    }
  } else {
    warnings.push('observations/ 目录已存在，跳过');
  }

  // 5. 创建 reflections 目录 (AC-019 step 5)
  const refDir = path.join(projectRoot, '.seed', 'reflections');
  if (!fs.existsSync(refDir)) {
    if (!dryRun) {
      fs.mkdirSync(refDir, { recursive: true });
      // 创建空索引
      const indexPath = path.join(refDir, 'index.json');
      const emptyIndex = {
        version: '1.0.0',
        updated: new Date().toISOString(),
        reflections: { draft: [], accepted: [], rejected: [] },
        stats: { total: 0, draft: 0, accepted: 0, rejected: 0 }
      };
      fs.writeFileSync(indexPath, JSON.stringify(emptyIndex, null, 2), 'utf-8');
      changes.push('创建 .seed/reflections/ 目录');
    } else {
      changes.push('[dry-run] 将创建 .seed/reflections/ 目录');
    }
  } else {
    warnings.push('reflections/ 目录已存在，跳过');
  }

  // 6. 生成升级摘要 (AC-020)
  const summary = formatUpgradeSummary(changes, warnings, dryRun);

  return {
    success: true,
    message: summary,
    data: {
      changes,
      warnings,
      backupPath: dryRun ? null : backupPath,
      newConfig
    }
  };
}

/**
 * 检查是否需要升级
 * @param {string} projectRoot - 项目根目录
 * @returns {{needsUpgrade: boolean, reason: string, currentVersion?: string}}
 */
function checkUpgradeNeeded(projectRoot) {
  const configPath = path.join(projectRoot, '.seed', 'config.json');

  if (!fs.existsSync(configPath)) {
    return {
      needsUpgrade: false,
      reason: '项目未初始化'
    };
  }

  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (e) {
    return {
      needsUpgrade: false,
      reason: `配置文件解析失败: ${e.message}`
    };
  }

  // 检查是否有 ACE 配置
  if (config.ace) {
    return {
      needsUpgrade: false,
      reason: '已是 v3.0 配置'
    };
  }

  // 检查目录
  const obsDir = path.join(projectRoot, '.seed', 'observations');
  const refDir = path.join(projectRoot, '.seed', 'reflections');

  const missingDirs = [];
  if (!fs.existsSync(obsDir)) missingDirs.push('observations/');
  if (!fs.existsSync(refDir)) missingDirs.push('reflections/');

  return {
    needsUpgrade: true,
    reason: `缺少 ACE 配置${missingDirs.length > 0 ? ` 和目录: ${missingDirs.join(', ')}` : ''}`
  };
}

/**
 * 回滚升级
 * @param {string} projectRoot - 项目根目录
 * @returns {UpgradeResult} 回滚结果
 */
function rollback(projectRoot) {
  const configPath = path.join(projectRoot, '.seed', 'config.json');
  const backupPath = path.join(projectRoot, '.seed', 'config.json.backup');

  if (!fs.existsSync(backupPath)) {
    return {
      success: false,
      message: '❌ 未找到备份文件，无法回滚',
      data: null
    };
  }

  // 恢复配置
  fs.copyFileSync(backupPath, configPath);

  // 删除新目录（可选，这里保守处理，不删除）
  const changes = ['恢复 config.json 从备份'];

  return {
    success: true,
    message: `✅ 回滚完成\n\n${changes.join('\n')}\n\n注意: observations/ 和 reflections/ 目录已保留`,
    data: { changes }
  };
}

/**
 * 获取升级状态
 * @param {string} projectRoot - 项目根目录
 * @returns {Object} 升级状态
 */
function getUpgradeStatus(projectRoot) {
  const configPath = path.join(projectRoot, '.seed', 'config.json');
  const obsDir = path.join(projectRoot, '.seed', 'observations');
  const refDir = path.join(projectRoot, '.seed', 'reflections');

  const status = {
    initialized: fs.existsSync(configPath),
    hasACEConfig: false,
    hasObservationsDir: fs.existsSync(obsDir),
    hasReflectionsDir: fs.existsSync(refDir),
    version: 'unknown'
  };

  if (status.initialized) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      status.hasACEConfig = !!config.ace;
      status.version = config.ace ? '3.0' : '2.x';
    } catch (e) {
      status.version = 'error';
    }
  }

  return status;
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 格式化升级摘要 (AC-020)
 * @param {string[]} changes - 变更列表
 * @param {string[]} warnings - 警告列表
 * @param {boolean} dryRun - 是否预览模式
 * @returns {string} 格式化的摘要
 */
function formatUpgradeSummary(changes, warnings, dryRun) {
  const lines = [];

  if (dryRun) {
    lines.push('📋 升级预览 (dry-run 模式)');
    lines.push('');
    lines.push('以下操作将在实际升级时执行：');
  } else {
    lines.push('✅ mob-seed 升级完成 (v2.x → v3.0)');
  }

  lines.push('');
  lines.push('变更:');
  changes.forEach(c => lines.push(`  - ${c}`));

  if (warnings.length > 0) {
    lines.push('');
    lines.push('警告:');
    warnings.forEach(w => lines.push(`  ⚠️ ${w}`));
  }

  lines.push('');
  lines.push('命令变更:');
  lines.push('  - /mob-seed-* → /mob-seed:*');
  lines.push('  - 详见: docs/migration/v2-to-v3.md');

  lines.push('');
  lines.push('下一步:');
  lines.push('  - 运行 /mob-seed 查看状态面板');
  lines.push('  - 运行 /mob-seed:spec observe 添加首个观察');

  return lines.join('\n');
}

// ============================================================================
// 导出
// ============================================================================

module.exports = {
  // 主函数
  upgrade,
  checkUpgradeNeeded,
  rollback,
  getUpgradeStatus,

  // 常量
  CURRENT_VERSION,
  MIN_UPGRADE_VERSION,
  DEFAULT_ACE_CONFIG,

  // 辅助函数
  formatUpgradeSummary
};
