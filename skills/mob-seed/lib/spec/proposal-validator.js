/**
 * 提案完整性验证器
 * @module spec/proposal-validator
 * @see openspec/changes/v3.0-ace-integration/specs/ace/proposal-validation.fspec.md
 *
 * 验证提案状态转换前的完整性：
 * - REQ-001: 任务 fspec 关联检查
 * - REQ-002: fspec 文件存在性检查
 * - REQ-003: fspec 状态检查
 * - REQ-004: 状态转换阻止
 * - REQ-005: 验证报告
 */

const fs = require('fs');
const path = require('path');
const { parseProposalFile, getFspecStatus } = require('./proposal-parser');

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 验证错误
 * @typedef {Object} ValidationError
 * @property {string} phase - 阶段 ID
 * @property {string} task - 任务 ID
 * @property {string} error - 错误信息
 * @property {'missing_spec' | 'spec_not_found' | 'invalid_status'} type - 错误类型
 */

/**
 * 验证结果
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - 是否验证通过
 * @property {ValidationError[]} errors - 错误列表
 * @property {Object} stats - 统计信息
 */

// ============================================================================
// 状态定义
// ============================================================================

const FSPEC_STATUS_ORDER = ['draft', 'review', 'implementing', 'archived'];

/**
 * 获取状态优先级（数值越大越高）
 * @param {string} status - 状态
 * @returns {number}
 */
function getStatusPriority(status) {
  const index = FSPEC_STATUS_ORDER.indexOf(status);
  return index >= 0 ? index : -1;
}

// ============================================================================
// REQ-001: 任务 fspec 关联检查 (AC-001, AC-002, AC-003)
// ============================================================================

/**
 * 验证任务是否有关联的 fspec
 * @param {Object} task - 任务对象
 * @returns {boolean}
 */
function hasAssociatedSpec(task) {
  return Boolean(task.specs && task.specs.length > 0);
}

/**
 * 验证提案完整性 - 检查所有任务都有 fspec 关联
 * @param {string} proposalPath - proposal.md 路径
 * @returns {ValidationResult}
 */
function validateProposalCompleteness(proposalPath) {
  const proposal = parseProposalFile(proposalPath);
  const errors = [];
  let totalTasks = 0;
  let tasksWithSpec = 0;

  for (const phase of proposal.phases) {
    for (const task of phase.tasks) {
      totalTasks++;

      // AC-001, AC-002: 检查任务是否有 fspec 关联
      if (!hasAssociatedSpec(task)) {
        errors.push({
          phase: phase.id,
          phaseName: phase.name,
          task: task.id,
          taskName: task.name,
          error: '任务缺少关联 fspec',
          type: 'missing_spec'
        });
      } else {
        tasksWithSpec++;
      }
    }
  }

  // AC-003: 返回缺失 fspec 的任务列表
  return {
    valid: errors.length === 0,
    errors,
    stats: {
      totalTasks,
      tasksWithSpec,
      percentage: totalTasks > 0 ? Math.round((tasksWithSpec / totalTasks) * 100) : 0
    }
  };
}

// ============================================================================
// REQ-002: fspec 文件存在性检查 (AC-004, AC-005, AC-006)
// ============================================================================

/**
 * 查找 fspec 文件 (AC-005: 支持嵌套目录)
 * @param {string} proposalDir - 提案目录
 * @param {string} specName - 规格文件名
 * @returns {string | null} 找到的完整路径，未找到返回 null
 */
function findSpecFile(proposalDir, specName) {
  // 尝试的路径模式
  const possiblePaths = [
    // 直接在 specs/ 下
    path.join(proposalDir, 'specs', specName),
    // 在 specs/ace/ 下（常见模式）
    path.join(proposalDir, 'specs', 'ace', specName),
    // 在 specs/ 的任意子目录下
    ...findInSubdirectories(path.join(proposalDir, 'specs'), specName)
  ];

  for (const fullPath of possiblePaths) {
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
}

/**
 * 在子目录中查找文件
 * @param {string} baseDir - 基础目录
 * @param {string} fileName - 文件名
 * @returns {string[]} 可能的路径列表
 */
function findInSubdirectories(baseDir, fileName) {
  const paths = [];

  if (!fs.existsSync(baseDir)) {
    return paths;
  }

  try {
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        paths.push(path.join(baseDir, entry.name, fileName));
      }
    }
  } catch (err) {
    // 忽略读取错误
  }

  return paths;
}

/**
 * 验证 fspec 文件存在性
 * @param {string} proposalDir - 提案目录
 * @param {string[]} specs - 规格文件名列表
 * @returns {ValidationResult}
 */
function validateFspecExistence(proposalDir, specs) {
  const errors = [];
  const found = [];

  for (const spec of specs) {
    // AC-004, AC-005: 检查文件是否存在（支持嵌套目录）
    const specPath = findSpecFile(proposalDir, spec);

    if (!specPath) {
      errors.push({
        spec,
        error: 'fspec 文件不存在',
        type: 'spec_not_found'
      });
    } else {
      found.push({ spec, path: specPath });
    }
  }

  // AC-006: 返回不存在的 fspec 列表
  return {
    valid: errors.length === 0,
    errors,
    found
  };
}

// ============================================================================
// REQ-003: fspec 状态检查 (AC-007, AC-008, AC-009)
// ============================================================================

/**
 * 获取 fspec 文件状态 (AC-007)
 * @param {string} specPath - fspec 文件完整路径
 * @returns {string} 状态
 */
function getSpecStatus(specPath) {
  if (!fs.existsSync(specPath)) {
    return 'unknown';
  }

  const content = fs.readFileSync(specPath, 'utf-8');

  // 尝试匹配状态字段
  const statusMatch = content.match(/>\s*状态:\s*(\w+)/);
  if (statusMatch) {
    return statusMatch[1].toLowerCase();
  }

  // 尝试匹配英文状态
  const statusMatchEn = content.match(/>\s*status:\s*(\w+)/i);
  if (statusMatchEn) {
    return statusMatchEn[1].toLowerCase();
  }

  return 'draft';
}

/**
 * 验证 fspec 状态是否符合转换要求 (AC-008)
 * @param {string} specStatus - fspec 当前状态
 * @param {string} targetProposalStatus - 目标提案状态
 * @returns {boolean}
 */
function isStatusValidForTransition(specStatus, targetProposalStatus) {
  const specPriority = getStatusPriority(specStatus);
  const targetPriority = getStatusPriority(targetProposalStatus);

  // review → implementing 时，fspec 必须是 review 或更高状态
  if (targetProposalStatus === 'implementing') {
    return specPriority >= getStatusPriority('review');
  }

  // draft → review 时，fspec 存在即可
  if (targetProposalStatus === 'review') {
    return specPriority >= 0;  // 只要有状态就行
  }

  return true;
}

/**
 * 验证所有 fspec 状态
 * @param {string} proposalDir - 提案目录
 * @param {Object[]} foundSpecs - 找到的规格列表 [{spec, path}]
 * @param {string} targetStatus - 目标提案状态
 * @returns {ValidationResult}
 */
function validateFspecStatuses(proposalDir, foundSpecs, targetStatus) {
  const errors = [];

  for (const { spec, path: specPath } of foundSpecs) {
    // AC-007: 读取 fspec 状态
    const status = getSpecStatus(specPath);

    // AC-008: 验证状态符合转换要求
    if (!isStatusValidForTransition(status, targetStatus)) {
      errors.push({
        spec,
        currentStatus: status,
        requiredStatus: targetStatus === 'implementing' ? 'review 或更高' : '任意',
        error: `fspec 状态 (${status}) 不符合转换要求`,
        type: 'invalid_status'
      });
    }
  }

  // AC-009: 返回状态不符的 fspec 列表
  return {
    valid: errors.length === 0,
    errors
  };
}

// ============================================================================
// REQ-004: 状态转换阻止 (AC-010, AC-011, AC-012, AC-013)
// ============================================================================

/**
 * 检查提案是否可以转换到目标状态
 * @param {string} proposalPath - proposal.md 路径
 * @param {string} targetStatus - 目标状态
 * @returns {ValidationResult}
 */
function canTransitionStatus(proposalPath, targetStatus) {
  const proposalDir = path.dirname(proposalPath);
  const allErrors = [];

  // AC-010: review → implementing 时执行验证
  if (targetStatus === 'implementing') {
    // 1. 检查任务 fspec 关联
    const completenessResult = validateProposalCompleteness(proposalPath);
    allErrors.push(...completenessResult.errors);

    // 2. 收集所有引用的 specs
    const proposal = parseProposalFile(proposalPath);
    const allSpecs = [];
    for (const phase of proposal.phases) {
      for (const task of phase.tasks) {
        if (task.specs) {
          allSpecs.push(...task.specs);
        }
      }
    }

    // 3. 检查 fspec 存在性
    const existenceResult = validateFspecExistence(proposalDir, allSpecs);
    allErrors.push(...existenceResult.errors);

    // 4. 检查 fspec 状态
    if (existenceResult.found.length > 0) {
      const statusResult = validateFspecStatuses(proposalDir, existenceResult.found, targetStatus);
      allErrors.push(...statusResult.errors);
    }
  }

  // AC-011, AC-012: 验证失败时显示详细错误并阻止状态转换
  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    // AC-013: 提供明确的修复建议
    suggestions: generateSuggestions(allErrors)
  };
}

/**
 * 生成修复建议 (AC-013)
 * @param {ValidationError[]} errors - 错误列表
 * @returns {string[]}
 */
function generateSuggestions(errors) {
  const suggestions = [];
  const errorTypes = new Set(errors.map(e => e.type));

  if (errorTypes.has('missing_spec')) {
    suggestions.push('请为缺少 fspec 的任务创建规格文件');
    suggestions.push('使用 /mob-seed:spec create <spec-name> 创建新规格');
  }

  if (errorTypes.has('spec_not_found')) {
    suggestions.push('请检查 proposal.md 中引用的 fspec 文件名是否正确');
    suggestions.push('确保 fspec 文件位于 specs/ 或 specs/ace/ 目录下');
  }

  if (errorTypes.has('invalid_status')) {
    suggestions.push('请将 fspec 状态更新为 review 或更高');
    suggestions.push('使用 /mob-seed:spec review <spec-name> 提交审核');
  }

  return suggestions;
}

// ============================================================================
// REQ-005: 验证报告 (AC-014, AC-015, AC-016, AC-017)
// ============================================================================

/**
 * 生成验证报告
 * @param {string} proposalPath - proposal.md 路径
 * @returns {string}
 */
function formatValidationReport(proposalPath) {
  const proposalDir = path.dirname(proposalPath);
  const proposal = parseProposalFile(proposalPath);
  const lines = [];

  // 标题
  lines.push(`📋 提案完整性检查: ${proposal.proposalName}`);
  lines.push('');

  let totalTasks = 0;
  let tasksWithSpec = 0;
  let tasksWithValidSpec = 0;
  const allErrors = [];

  // AC-014: 按 Phase 分组显示检查结果
  for (const phase of proposal.phases) {
    lines.push(`Phase ${phase.number}: ${phase.name}`);

    for (const task of phase.tasks) {
      totalTasks++;
      let status = '❌';
      let specInfo = '[缺少 fspec]';

      if (task.specs && task.specs.length > 0) {
        const specName = task.specs[0];
        const specPath = findSpecFile(proposalDir, specName);

        if (specPath) {
          const specStatus = getSpecStatus(specPath);
          tasksWithSpec++;

          if (isStatusValidForTransition(specStatus, 'implementing')) {
            status = '✅';
            tasksWithValidSpec++;
            specInfo = `→ ${specName}`;
          } else {
            specInfo = `→ ${specName} [状态: ${specStatus}]`;
            allErrors.push({
              phase: phase.id,
              task: task.id,
              error: `fspec 状态 (${specStatus}) 不符合要求`
            });
          }
        } else {
          specInfo = `→ ${specName} [文件不存在]`;
          allErrors.push({
            phase: phase.id,
            task: task.id,
            error: 'fspec 文件不存在'
          });
        }
      } else {
        allErrors.push({
          phase: phase.id,
          task: task.id,
          error: '缺少 fspec 关联'
        });
      }

      // AC-015: 使用 ✅/❌ 图标区分状态
      lines.push(`  ${status} ${task.id} ${task.name} ${specInfo}`);
    }

    lines.push('');
  }

  // AC-016: 显示完成百分比
  const percentage = totalTasks > 0 ? Math.round((tasksWithValidSpec / totalTasks) * 100) : 0;
  lines.push(`统计: ${tasksWithValidSpec}/${totalTasks} 任务有有效 fspec (${percentage}%)`);
  lines.push('');

  // AC-017: 汇总错误数量
  if (allErrors.length > 0) {
    lines.push(`❌ 验证失败: ${allErrors.length} 个问题`);
  } else {
    lines.push('✅ 验证通过: 所有任务都有有效的 fspec');
  }

  return lines.join('\n');
}

// ============================================================================
// REQ-006: 独立验证命令支持 (AC-018, AC-019, AC-020, AC-021)
// ============================================================================

/**
 * 执行独立验证 (供命令调用)
 * @param {string} proposalName - 提案名称
 * @param {string} projectRoot - 项目根目录
 * @returns {{ exitCode: number, report: string }}
 */
function validateProposal(proposalName, projectRoot) {
  // AC-019: 支持指定提案名称
  const proposalPath = path.join(
    projectRoot,
    'openspec',
    'changes',
    proposalName,
    'proposal.md'
  );

  if (!fs.existsSync(proposalPath)) {
    return {
      exitCode: 1,
      report: `❌ 提案不存在: ${proposalName}`
    };
  }

  // AC-020: 输出完整验证报告
  const report = formatValidationReport(proposalPath);

  // AC-021: 返回退出码
  const validation = canTransitionStatus(proposalPath, 'implementing');
  const exitCode = validation.valid ? 0 : 1;

  return { exitCode, report };
}

// ============================================================================
// 导出
// ============================================================================

module.exports = {
  // REQ-001: 任务 fspec 关联检查
  validateProposalCompleteness,
  hasAssociatedSpec,

  // REQ-002: fspec 文件存在性检查
  validateFspecExistence,
  findSpecFile,
  findInSubdirectories,

  // REQ-003: fspec 状态检查
  getSpecStatus,
  isStatusValidForTransition,
  validateFspecStatuses,
  getStatusPriority,

  // REQ-004: 状态转换阻止
  canTransitionStatus,
  generateSuggestions,

  // REQ-005: 验证报告
  formatValidationReport,

  // REQ-006: 独立验证命令
  validateProposal,

  // 常量
  FSPEC_STATUS_ORDER
};
