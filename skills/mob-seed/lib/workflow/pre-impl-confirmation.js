'use strict';

/**
 * @generated-from pre-impl-confirmation.fspec.md
 * @seed-version 1.0.0
 *
 * Pre-Implementation Confirmation (实现前确认)
 * 在开始实现阶段之前，展示即将执行的操作清单供用户确认
 */

const fs = require('fs');
const path = require('path');

// 风险等级常量
const RISK_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high'
};

// 变更类型常量
const CHANGE_TYPES = {
  CREATE: 'create',
  MODIFY: 'modify',
  DELETE: 'delete'
};

// 用户选择常量
const USER_CHOICES = {
  CONFIRM: 'confirm',
  CANCEL: 'cancel',
  VIEW: 'view',
  SKIP: 'skip',
  EDIT: 'edit'
};

// 默认配置
const DEFAULT_CONFIG = {
  enabled: true,
  batchSize: 10,
  highRiskConfirmPhrase: '我确认',
  autoBackup: true,
  backupDir: '.seed/backups/',
  skipForQuickFlow: true
};

/**
 * 分析设计方案提取变更清单
 * @param {Object} designPlan - 设计方案
 * @returns {Array<Object>} 变更项列表
 */
function analyzeChanges(designPlan) {
  const changes = [];

  if (!designPlan) {
    return changes;
  }

  // 处理新建文件
  if (designPlan.newFiles) {
    for (const file of designPlan.newFiles) {
      changes.push({
        type: CHANGE_TYPES.CREATE,
        path: file.path,
        estimatedLines: file.estimatedLines || 100,
        risk: RISK_LEVELS.LOW,
        status: 'pending',
        module: extractModule(file.path)
      });
    }
  }

  // 处理修改文件
  if (designPlan.modifyFiles) {
    for (const file of designPlan.modifyFiles) {
      const isCoreFile = isCoreFilePath(file.path);
      changes.push({
        type: CHANGE_TYPES.MODIFY,
        path: file.path,
        additions: file.additions || 0,
        deletions: file.deletions || 0,
        risk: isCoreFile ? RISK_LEVELS.MEDIUM : RISK_LEVELS.LOW,
        status: 'pending',
        module: extractModule(file.path)
      });
    }
  }

  // 处理删除文件
  if (designPlan.deleteFiles) {
    for (const file of designPlan.deleteFiles) {
      changes.push({
        type: CHANGE_TYPES.DELETE,
        path: file.path,
        hasBackup: file.hasBackup || false,
        risk: file.hasBackup ? RISK_LEVELS.MEDIUM : RISK_LEVELS.HIGH,
        status: 'pending',
        module: extractModule(file.path)
      });
    }
  }

  // 处理依赖变更
  if (designPlan.dependencies) {
    for (const dep of designPlan.dependencies) {
      changes.push({
        type: 'dependency',
        name: dep.name,
        action: dep.action, // add/remove/update
        version: dep.version,
        risk: dep.action === 'add' && dep.major ? RISK_LEVELS.HIGH : RISK_LEVELS.MEDIUM,
        status: 'pending'
      });
    }
  }

  return changes;
}

/**
 * 从文件路径提取模块名
 * @param {string} filePath - 文件路径
 * @returns {string} 模块名
 */
function extractModule(filePath) {
  const parts = filePath.split('/');
  // 找到 lib/ 或 src/ 后的第一个目录作为模块名
  const libIndex = parts.findIndex(p => p === 'lib' || p === 'src');
  if (libIndex >= 0 && parts[libIndex + 1]) {
    return parts[libIndex + 1];
  }
  return 'root';
}

/**
 * 判断是否为核心文件
 * @param {string} filePath - 文件路径
 * @returns {boolean}
 */
function isCoreFilePath(filePath) {
  const corePatterns = [
    /\/core\//,           // lib/core/ 目录
    /\/engine\./,         // engine.js 文件
    /^config\//,          // config/ 目录
    /\/config\//,         // 子目录中的 config/
    /index\.(js|ts)$/,    // index.js/ts 入口文件
    /main\.(js|ts)$/      // main.js/ts 主文件
  ];
  return corePatterns.some(pattern => pattern.test(filePath));
}

/**
 * 评估单个变更的风险等级
 * @param {Object} change - 变更项
 * @returns {string} 风险等级
 */
function getRiskLevel(change) {
  if (change.type === CHANGE_TYPES.DELETE && !change.hasBackup) {
    return RISK_LEVELS.HIGH;
  }
  if (change.type === CHANGE_TYPES.MODIFY && isCoreFilePath(change.path)) {
    return RISK_LEVELS.MEDIUM;
  }
  if (change.type === 'dependency' && change.action === 'add') {
    return RISK_LEVELS.MEDIUM;
  }
  return change.risk || RISK_LEVELS.LOW;
}

/**
 * 综合评估所有变更的风险
 * @param {Array<Object>} changes - 变更列表
 * @returns {Object} 风险评估结果
 */
function assessRisk(changes) {
  const assessment = {
    totalRisk: RISK_LEVELS.LOW,
    fileCount: changes.length,
    highRiskCount: 0,
    mediumRiskCount: 0,
    lowRiskCount: 0,
    warnings: [],
    requiresConfirmPhrase: false
  };

  // 统计各风险等级数量
  for (const change of changes) {
    const risk = getRiskLevel(change);
    switch (risk) {
      case RISK_LEVELS.HIGH:
        assessment.highRiskCount++;
        break;
      case RISK_LEVELS.MEDIUM:
        assessment.mediumRiskCount++;
        break;
      default:
        assessment.lowRiskCount++;
    }
  }

  // 根据文件数量评估
  if (changes.length > 15) {
    assessment.warnings.push('变更文件数量较多 (>15)，建议分批实现');
    assessment.totalRisk = RISK_LEVELS.HIGH;
  } else if (changes.length > 5) {
    if (assessment.totalRisk === RISK_LEVELS.LOW) {
      assessment.totalRisk = RISK_LEVELS.MEDIUM;
    }
  }

  // 根据高风险项评估
  if (assessment.highRiskCount > 0) {
    assessment.totalRisk = RISK_LEVELS.HIGH;
    assessment.requiresConfirmPhrase = true;
    assessment.warnings.push(`存在 ${assessment.highRiskCount} 个高风险变更`);
  } else if (assessment.mediumRiskCount > 2) {
    assessment.totalRisk = RISK_LEVELS.MEDIUM;
    assessment.warnings.push(`存在 ${assessment.mediumRiskCount} 个中风险变更`);
  }

  // 检查核心文件修改
  const coreModifications = changes.filter(
    c => c.type === CHANGE_TYPES.MODIFY && isCoreFilePath(c.path)
  );
  if (coreModifications.length > 2) {
    assessment.totalRisk = RISK_LEVELS.HIGH;
    assessment.requiresConfirmPhrase = true;
    assessment.warnings.push('修改多个核心文件，可能影响系统稳定性');
  }

  // 检查无备份删除
  const unsafeDeletes = changes.filter(
    c => c.type === CHANGE_TYPES.DELETE && !c.hasBackup
  );
  if (unsafeDeletes.length > 0) {
    assessment.warnings.push(`${unsafeDeletes.length} 个文件将被删除且无备份`);
  }

  return assessment;
}

/**
 * 生成变更预览
 * @param {Object} designPlan - 设计方案
 * @returns {Object} 变更预览
 */
function generateChangePreview(designPlan) {
  const changes = analyzeChanges(designPlan);
  const riskAssessment = assessRisk(changes);

  // 按类型分组
  const createFiles = changes.filter(c => c.type === CHANGE_TYPES.CREATE);
  const modifyFiles = changes.filter(c => c.type === CHANGE_TYPES.MODIFY);
  const deleteFiles = changes.filter(c => c.type === CHANGE_TYPES.DELETE);
  const dependencies = changes.filter(c => c.type === 'dependency');

  // 按模块分组
  const byModule = {};
  for (const change of changes) {
    const module = change.module || 'other';
    if (!byModule[module]) {
      byModule[module] = [];
    }
    byModule[module].push(change);
  }

  return {
    summary: {
      total: changes.length,
      create: createFiles.length,
      modify: modifyFiles.length,
      delete: deleteFiles.length,
      dependencies: dependencies.length
    },
    changes,
    byType: {
      create: createFiles,
      modify: modifyFiles,
      delete: deleteFiles,
      dependencies
    },
    byModule,
    riskAssessment,
    generatedAt: new Date().toISOString()
  };
}

/**
 * 格式化变更预览为文本输出
 * @param {Object} preview - 变更预览
 * @returns {string} 格式化的文本
 */
function formatPreviewText(preview) {
  const lines = [];

  lines.push('📋 实现前确认');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('');

  // 变更概览
  lines.push('📊 变更概览');
  lines.push(`   新建: ${preview.summary.create} 个文件`);
  lines.push(`   修改: ${preview.summary.modify} 个文件`);
  lines.push(`   删除: ${preview.summary.delete} 个文件`);
  if (preview.summary.dependencies > 0) {
    lines.push(`   依赖: ${preview.summary.dependencies} 项变更`);
  }
  lines.push('');

  // 详细清单
  lines.push('📁 详细清单');
  lines.push('');

  // 新建文件
  if (preview.byType.create.length > 0) {
    lines.push('🟢 新建文件:');
    for (const file of preview.byType.create) {
      const lineInfo = file.estimatedLines ? `(~${file.estimatedLines} 行)` : '';
      lines.push(`   + ${file.path}  ${lineInfo}`);
    }
    lines.push('');
  }

  // 修改文件
  if (preview.byType.modify.length > 0) {
    lines.push('🟡 修改文件:');
    for (const file of preview.byType.modify) {
      const changeInfo = `(+${file.additions || 0}/-${file.deletions || 0} 行)`;
      lines.push(`   ~ ${file.path}  ${changeInfo}`);
    }
    lines.push('');
  }

  // 删除文件
  if (preview.byType.delete.length > 0) {
    lines.push('🔴 删除文件:');
    for (const file of preview.byType.delete) {
      const backupInfo = file.hasBackup ? '(已备份)' : '(无备份!)';
      lines.push(`   - ${file.path}  ${backupInfo}`);
    }
    lines.push('');
  }

  // 依赖变更
  if (preview.byType.dependencies.length > 0) {
    lines.push('📦 依赖变更:');
    for (const dep of preview.byType.dependencies) {
      const actionIcon = dep.action === 'add' ? '+' : dep.action === 'remove' ? '-' : '~';
      lines.push(`   ${actionIcon} ${dep.name}@${dep.version || 'latest'}`);
    }
    lines.push('');
  }

  // 风险提示
  const { riskAssessment } = preview;
  if (riskAssessment.warnings.length > 0) {
    lines.push('⚠️ 风险提示:');
    for (const warning of riskAssessment.warnings) {
      lines.push(`   - ${warning}`);
    }
    lines.push('');
  }

  // 总体风险
  const riskIcons = {
    low: '🟢 低',
    medium: '🟡 中',
    high: '🔴 高'
  };
  lines.push(`📊 总体风险: ${riskIcons[riskAssessment.totalRisk]}`);
  lines.push('');

  // 确认提示
  if (riskAssessment.requiresConfirmPhrase) {
    lines.push(`⚠️ 高风险变更，请输入 "${DEFAULT_CONFIG.highRiskConfirmPhrase}" 确认`);
  } else {
    lines.push('确认开始实现? [Y/n/v(查看详情)/s(跳过某项)]');
  }

  return lines.join('\n');
}

/**
 * 解析用户输入
 * @param {string} input - 用户输入
 * @param {Object} preview - 变更预览（用于高风险确认）
 * @returns {Object} 解析结果
 */
function parseUserChoice(input, preview) {
  const trimmed = (input || '').trim().toLowerCase();

  // 高风险确认短语
  if (preview && preview.riskAssessment.requiresConfirmPhrase) {
    if (input && input.trim() === DEFAULT_CONFIG.highRiskConfirmPhrase) {
      return { choice: USER_CHOICES.CONFIRM, confirmed: true };
    }
    if (trimmed === 'n' || trimmed === 'no') {
      return { choice: USER_CHOICES.CANCEL, confirmed: false };
    }
    return { choice: 'invalid', message: `请输入 "${DEFAULT_CONFIG.highRiskConfirmPhrase}" 确认高风险操作` };
  }

  // 常规确认
  switch (trimmed) {
    case '':
    case 'y':
    case 'yes':
      return { choice: USER_CHOICES.CONFIRM, confirmed: true };
    case 'n':
    case 'no':
      return { choice: USER_CHOICES.CANCEL, confirmed: false };
    case 'v':
    case 'view':
      return { choice: USER_CHOICES.VIEW, confirmed: false };
    case 's':
    case 'skip':
      return { choice: USER_CHOICES.SKIP, confirmed: false };
    case 'e':
    case 'edit':
      return { choice: USER_CHOICES.EDIT, confirmed: false };
    default:
      return { choice: 'invalid', message: '无效输入，请输入 Y/n/v/s/e' };
  }
}

/**
 * 处理用户选择
 * @param {Object} userChoice - 用户选择
 * @param {Object} preview - 变更预览
 * @returns {Object} 处理结果
 */
function processUserChoice(userChoice, preview) {
  switch (userChoice.choice) {
    case USER_CHOICES.CONFIRM:
      return {
        action: 'proceed',
        message: '开始实现...',
        changes: preview.changes
      };
    case USER_CHOICES.CANCEL:
      return {
        action: 'cancel',
        message: '已取消，返回设计阶段',
        changes: []
      };
    case USER_CHOICES.VIEW:
      return {
        action: 'view',
        message: '请指定要查看的文件编号或路径',
        changes: preview.changes
      };
    case USER_CHOICES.SKIP:
      return {
        action: 'skip',
        message: '请指定要跳过的变更项',
        changes: preview.changes
      };
    case USER_CHOICES.EDIT:
      return {
        action: 'edit',
        message: '进入编辑模式，可手动调整变更清单',
        changes: preview.changes
      };
    default:
      return {
        action: 'invalid',
        message: userChoice.message || '无效操作',
        changes: []
      };
  }
}

/**
 * 保存实现计划
 * @param {Object} preview - 变更预览
 * @param {Object} userChoices - 用户选择
 * @param {string} flowId - 工作流 ID
 * @returns {string} 保存路径
 */
function saveImplPlan(preview, userChoices, flowId) {
  const planDir = '.seed';
  const planPath = path.join(planDir, 'impl-plan.json');

  const plan = {
    version: '1.0',
    confirmed_at: new Date().toISOString(),
    flow_id: flowId || `flow-${Date.now()}`,
    changes: preview.changes.map(c => ({
      ...c,
      status: userChoices.skipped?.includes(c.path) ? 'skipped' : 'pending'
    })),
    skipped: userChoices.skipped || [],
    total_risk: preview.riskAssessment.totalRisk,
    user_confirmed: userChoices.confirmed
  };

  // 确保目录存在
  if (!fs.existsSync(planDir)) {
    fs.mkdirSync(planDir, { recursive: true });
  }

  fs.writeFileSync(planPath, JSON.stringify(plan, null, 2));
  return planPath;
}

/**
 * 加载实现计划
 * @param {string} flowId - 工作流 ID
 * @returns {Object|null} 实现计划
 */
function loadImplPlan(flowId) {
  const planPath = path.join('.seed', 'impl-plan.json');

  if (!fs.existsSync(planPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(planPath, 'utf-8');
    const plan = JSON.parse(content);

    // 如果指定了 flowId，检查是否匹配
    if (flowId && plan.flow_id !== flowId) {
      return null;
    }

    return plan;
  } catch (err) {
    return null;
  }
}

/**
 * 创建回滚点
 * @param {Array<Object>} changes - 变更列表
 * @param {string} flowId - 工作流 ID
 * @returns {Object} 回滚信息
 */
function createRollbackPoint(changes, flowId) {
  const backupDir = path.join(DEFAULT_CONFIG.backupDir, flowId || `flow-${Date.now()}`);
  const rollbackInfo = {
    flowId: flowId || `flow-${Date.now()}`,
    createdAt: new Date().toISOString(),
    backupDir,
    files: [],
    gitCommit: null,
    rollbackScript: null
  };

  // 确保备份目录存在
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  // 备份将被修改或删除的文件
  const filesToBackup = changes.filter(
    c => c.type === CHANGE_TYPES.MODIFY || c.type === CHANGE_TYPES.DELETE
  );

  for (const change of filesToBackup) {
    if (fs.existsSync(change.path)) {
      const backupPath = path.join(backupDir, change.path);
      const backupFileDir = path.dirname(backupPath);

      if (!fs.existsSync(backupFileDir)) {
        fs.mkdirSync(backupFileDir, { recursive: true });
      }

      try {
        fs.copyFileSync(change.path, backupPath);
        rollbackInfo.files.push({
          original: change.path,
          backup: backupPath
        });
      } catch (err) {
        // 文件可能不存在或无权访问
      }
    }
  }

  // 生成回滚脚本
  const rollbackScriptPath = path.join('.seed', `rollback-${rollbackInfo.flowId}.sh`);
  const scriptLines = [
    '#!/bin/bash',
    `# 回滚脚本 - ${rollbackInfo.flowId}`,
    `# 创建于: ${rollbackInfo.createdAt}`,
    '',
    'set -e',
    ''
  ];

  // 恢复修改的文件
  for (const file of rollbackInfo.files) {
    scriptLines.push(`cp "${file.backup}" "${file.original}"`);
  }

  // 删除新创建的文件
  const newFiles = changes.filter(c => c.type === CHANGE_TYPES.CREATE);
  for (const file of newFiles) {
    scriptLines.push(`rm -f "${file.path}"`);
  }

  scriptLines.push('');
  scriptLines.push('echo "回滚完成"');

  if (!fs.existsSync('.seed')) {
    fs.mkdirSync('.seed', { recursive: true });
  }
  fs.writeFileSync(rollbackScriptPath, scriptLines.join('\n'));
  rollbackInfo.rollbackScript = rollbackScriptPath;

  // 保存回滚信息
  const rollbackInfoPath = path.join(backupDir, 'rollback-info.json');
  fs.writeFileSync(rollbackInfoPath, JSON.stringify(rollbackInfo, null, 2));

  return rollbackInfo;
}

/**
 * 执行回滚
 * @param {string} flowId - 工作流 ID
 * @returns {Object} 回滚结果
 */
function executeRollback(flowId) {
  const backupDir = path.join(DEFAULT_CONFIG.backupDir, flowId);
  const rollbackInfoPath = path.join(backupDir, 'rollback-info.json');

  if (!fs.existsSync(rollbackInfoPath)) {
    return {
      success: false,
      message: `未找到回滚信息: ${flowId}`
    };
  }

  try {
    const rollbackInfo = JSON.parse(fs.readFileSync(rollbackInfoPath, 'utf-8'));
    let restoredCount = 0;

    // 恢复备份的文件
    for (const file of rollbackInfo.files) {
      if (fs.existsSync(file.backup)) {
        const targetDir = path.dirname(file.original);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        fs.copyFileSync(file.backup, file.original);
        restoredCount++;
      }
    }

    return {
      success: true,
      message: `回滚完成，恢复了 ${restoredCount} 个文件`,
      restoredFiles: restoredCount
    };
  } catch (err) {
    return {
      success: false,
      message: `回滚失败: ${err.message}`
    };
  }
}

/**
 * 按批次分组变更（用于大规模变更）
 * @param {Array<Object>} changes - 变更列表
 * @param {number} batchSize - 批次大小
 * @returns {Array<Array<Object>>} 分批的变更
 */
function batchChanges(changes, batchSize = DEFAULT_CONFIG.batchSize) {
  const batches = [];
  for (let i = 0; i < changes.length; i += batchSize) {
    batches.push(changes.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * 按模块分组变更
 * @param {Array<Object>} changes - 变更列表
 * @returns {Object} 按模块分组的变更
 */
function groupByModule(changes) {
  const groups = {};
  for (const change of changes) {
    const module = change.module || 'other';
    if (!groups[module]) {
      groups[module] = [];
    }
    groups[module].push(change);
  }
  return groups;
}

module.exports = {
  // 常量
  RISK_LEVELS,
  CHANGE_TYPES,
  USER_CHOICES,
  DEFAULT_CONFIG,

  // 预览生成
  generateChangePreview,
  analyzeChanges,
  formatPreviewText,

  // 风险评估
  assessRisk,
  getRiskLevel,

  // 用户交互
  parseUserChoice,
  processUserChoice,

  // 持久化
  saveImplPlan,
  loadImplPlan,

  // 回滚准备
  createRollbackPoint,
  executeRollback,

  // 辅助函数
  batchChanges,
  groupByModule,
  extractModule,
  isCoreFilePath
};
