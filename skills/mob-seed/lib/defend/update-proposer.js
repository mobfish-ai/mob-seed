/**
 * 更新建议生成器
 *
 * 基于偏离检测结果生成规格更新建议。
 *
 * @module skills/mob-seed/lib/defend/update-proposer
 */

const { DriftType, DriftSeverity } = require('./drift-detector');

/**
 * 更新操作类型
 */
const UpdateAction = {
  ADD: 'add',
  UPDATE: 'update',
  REMOVE: 'remove'
};

/**
 * 可更新的章节
 */
const UpdatableSections = {
  DERIVED_OUTPUTS: 'derived_outputs',
  TECHNICAL_DESIGN: 'technical_design',
  API_REFERENCE: 'api_reference'
};

/**
 * 受保护的章节（不自动更新）
 */
const ProtectedSections = [
  'requirements',
  'functional_requirements',
  'non_functional_requirements',
  'acceptance_criteria',
  'business_rules',
  'constraints'
];

/**
 * 生成规格更新建议
 *
 * @param {Object} spec - 规格信息
 * @param {Object} codeInfo - 代码信息
 * @param {Array<Object>} drifts - 偏离列表
 * @returns {Object} 更新建议
 */
function generateUpdateProposal(spec, codeInfo, drifts) {
  const updates = [];
  const warnings = [];

  for (const drift of drifts) {
    const proposal = proposeSingleUpdate(drift, codeInfo);
    if (proposal) {
      updates.push(proposal);
    }
  }

  // 检查是否有受保护章节的变更
  const protectedDrifts = drifts.filter(d =>
    d.section && ProtectedSections.includes(d.section)
  );
  if (protectedDrifts.length > 0) {
    warnings.push({
      type: 'protected_section',
      message: `${protectedDrifts.length} 处变更涉及受保护章节，需手动审核`
    });
  }

  // 生成 diff 预览
  const diff = generateDiffPreview(updates);

  // 计算风险等级
  const riskLevel = calculateRiskLevel(drifts);

  return {
    updates,
    warnings,
    diff,
    riskLevel,
    summary: `${updates.length} 处建议更新`,
    autoApplicable: updates.filter(u => u.autoApplicable).length,
    requiresReview: updates.filter(u => !u.autoApplicable).length
  };
}

/**
 * 为单个偏离生成更新建议
 *
 * @param {Object} drift - 偏离信息
 * @param {Object} codeInfo - 代码信息
 * @returns {Object|null} 更新建议
 */
function proposeSingleUpdate(drift, codeInfo) {
  switch (drift.type) {
    case DriftType.METHOD_ADDED:
      return proposeMethodAdd(drift, codeInfo);

    case DriftType.METHOD_REMOVED:
      return proposeMethodRemove(drift);

    case DriftType.SIGNATURE_CHANGED:
      return proposeSignatureUpdate(drift, codeInfo);

    case DriftType.PARAMETER_ADDED:
      return proposeParameterAdd(drift, codeInfo);

    case DriftType.PARAMETER_REMOVED:
      return proposeParameterRemove(drift);

    default:
      return null;
  }
}

/**
 * 建议添加新方法到规格
 *
 * @param {Object} drift - 偏离信息
 * @param {Object} codeInfo - 代码信息
 * @returns {Object} 更新建议
 */
function proposeMethodAdd(drift, codeInfo) {
  const method = codeInfo.methods?.find(m => m.name === drift.method);
  const description = method?.jsdoc?.description || '新增方法';

  return {
    action: UpdateAction.ADD,
    section: UpdatableSections.DERIVED_OUTPUTS,
    method: drift.method,
    content: {
      type: 'function',
      name: drift.method,
      signature: drift.signature,
      description
    },
    tableRow: `| 函数 | \`${drift.signature}\` | ${description} |`,
    reason: '代码中新增方法',
    autoApplicable: true,
    risk: 'low'
  };
}

/**
 * 建议从规格中移除方法
 *
 * @param {Object} drift - 偏离信息
 * @returns {Object} 更新建议
 */
function proposeMethodRemove(drift) {
  return {
    action: UpdateAction.REMOVE,
    section: UpdatableSections.DERIVED_OUTPUTS,
    method: drift.method,
    content: {
      name: drift.method,
      oldSignature: drift.oldSignature
    },
    reason: '代码中方法已删除',
    autoApplicable: false,  // 删除需要人工确认
    risk: 'high',
    warning: '删除规格可能影响文档完整性，建议手动确认'
  };
}

/**
 * 建议更新方法签名
 *
 * @param {Object} drift - 偏离信息
 * @param {Object} codeInfo - 代码信息
 * @returns {Object} 更新建议
 */
function proposeSignatureUpdate(drift, codeInfo) {
  const method = codeInfo.methods?.find(m => m.name === drift.method);

  return {
    action: UpdateAction.UPDATE,
    section: UpdatableSections.DERIVED_OUTPUTS,
    method: drift.method,
    content: {
      oldSignature: drift.oldSignature,
      newSignature: drift.newSignature,
      description: method?.jsdoc?.description
    },
    diff: {
      before: drift.oldSignature,
      after: drift.newSignature
    },
    reason: '函数签名已变更',
    autoApplicable: false,  // 签名变更需要确认
    risk: 'medium'
  };
}

/**
 * 建议添加新参数到规格
 *
 * @param {Object} drift - 偏离信息
 * @param {Object} codeInfo - 代码信息
 * @returns {Object} 更新建议
 */
function proposeParameterAdd(drift, codeInfo) {
  const method = codeInfo.methods?.find(m => m.name === drift.method);
  const param = method?.jsdoc?.params?.find(p => p.name === drift.parameter);

  return {
    action: UpdateAction.UPDATE,
    section: UpdatableSections.DERIVED_OUTPUTS,
    method: drift.method,
    parameter: drift.parameter,
    content: {
      parameter: drift.parameter,
      type: param?.type || 'any',
      description: param?.description || '新增参数'
    },
    reason: '方法新增参数',
    autoApplicable: true,
    risk: 'medium'
  };
}

/**
 * 建议从规格中移除参数
 *
 * @param {Object} drift - 偏离信息
 * @returns {Object} 更新建议
 */
function proposeParameterRemove(drift) {
  return {
    action: UpdateAction.UPDATE,
    section: UpdatableSections.DERIVED_OUTPUTS,
    method: drift.method,
    parameter: drift.parameter,
    content: {
      removedParameter: drift.parameter
    },
    reason: '方法删除参数',
    autoApplicable: false,  // 删除参数需要确认
    risk: 'high',
    warning: '删除参数可能是破坏性变更'
  };
}

/**
 * 生成 diff 预览
 *
 * @param {Array<Object>} updates - 更新列表
 * @returns {string} diff 预览文本
 */
function generateDiffPreview(updates) {
  const lines = [];

  for (const update of updates) {
    lines.push(`--- ${update.section} ---`);

    switch (update.action) {
      case UpdateAction.ADD:
        lines.push(`+ ${update.tableRow || update.content.signature}`);
        break;

      case UpdateAction.UPDATE:
        if (update.diff) {
          lines.push(`- ${update.diff.before}`);
          lines.push(`+ ${update.diff.after}`);
        }
        break;

      case UpdateAction.REMOVE:
        lines.push(`- ${update.content.oldSignature || update.method}`);
        break;
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * 计算风险等级
 *
 * @param {Array<Object>} drifts - 偏离列表
 * @returns {string} 风险等级
 */
function calculateRiskLevel(drifts) {
  const hasHigh = drifts.some(d => d.severity === DriftSeverity.HIGH);
  const hasMedium = drifts.some(d => d.severity === DriftSeverity.MEDIUM);

  if (hasHigh) return 'high';
  if (hasMedium) return 'medium';
  return 'low';
}

/**
 * 应用更新建议到规格内容
 *
 * @param {string} specContent - 规格内容
 * @param {Array<Object>} updates - 更新列表
 * @returns {string} 更新后的规格内容
 */
function applyUpdates(specContent, updates) {
  let content = specContent;

  // 找到派生产物表格
  const tableMatch = content.match(
    /(## 派生产物.*?\n\n\|[^\n]+\|\n\|[-: ]+\|\n)((?:\|[^\n]+\|\n)*)/s
  );

  if (!tableMatch) {
    // 没有找到表格，在文件末尾添加
    const newRows = updates
      .filter(u => u.action === UpdateAction.ADD)
      .map(u => u.tableRow)
      .join('\n');

    if (newRows) {
      content += `\n\n## 派生产物 (Derived Outputs)\n\n| 类型 | 路径 | 说明 |\n|------|------|------|\n${newRows}\n`;
    }
    return content;
  }

  const tableHeader = tableMatch[1];
  let tableBody = tableMatch[2];

  // 处理每个更新
  for (const update of updates) {
    switch (update.action) {
      case UpdateAction.ADD:
        tableBody += update.tableRow + '\n';
        break;

      case UpdateAction.UPDATE:
        if (update.diff) {
          // 替换旧签名为新签名
          tableBody = tableBody.replace(
            new RegExp(escapeRegex(update.diff.before), 'g'),
            update.diff.after
          );
        }
        break;

      case UpdateAction.REMOVE:
        // 移除包含该方法的行
        const methodRegex = new RegExp(`\\|[^|]*${escapeRegex(update.method)}[^|]*\\|[^\\n]*\\n`, 'g');
        tableBody = tableBody.replace(methodRegex, '');
        break;
    }
  }

  // 重建内容
  content = content.replace(tableMatch[0], tableHeader + tableBody);

  return content;
}

/**
 * 转义正则特殊字符
 *
 * @param {string} str - 输入字符串
 * @returns {string} 转义后的字符串
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 验证更新是否安全
 *
 * @param {Array<Object>} updates - 更新列表
 * @returns {Object} 验证结果
 */
function validateUpdates(updates) {
  const issues = [];

  for (const update of updates) {
    // 检查是否修改受保护章节
    if (ProtectedSections.includes(update.section)) {
      issues.push({
        type: 'protected_section',
        update,
        message: `不允许自动修改受保护章节: ${update.section}`
      });
    }

    // 检查高风险更新
    if (update.risk === 'high' && update.autoApplicable) {
      issues.push({
        type: 'high_risk_auto',
        update,
        message: `高风险更新不应自动应用: ${update.method}`
      });
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

// 导出
module.exports = {
  UpdateAction,
  UpdatableSections,
  ProtectedSections,
  generateUpdateProposal,
  proposeSingleUpdate,
  proposeMethodAdd,
  proposeMethodRemove,
  proposeSignatureUpdate,
  proposeParameterAdd,
  proposeParameterRemove,
  generateDiffPreview,
  calculateRiskLevel,
  applyUpdates,
  validateUpdates
};
