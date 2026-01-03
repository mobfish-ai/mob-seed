/**
 * 偏离检测器
 *
 * 检测规格与代码之间的差异。
 *
 * @module skills/mob-seed/lib/defend/drift-detector
 */

const fs = require('fs');
const path = require('path');

/**
 * 偏离类型
 */
const DriftType = {
  METHOD_ADDED: 'method_added',
  METHOD_REMOVED: 'method_removed',
  SIGNATURE_CHANGED: 'signature_changed',
  PARAMETER_ADDED: 'parameter_added',
  PARAMETER_REMOVED: 'parameter_removed',
  RETURN_TYPE_CHANGED: 'return_type_changed',
  DESCRIPTION_MISMATCH: 'description_mismatch'
};

/**
 * 偏离严重程度
 */
const DriftSeverity = {
  HIGH: 'high',       // 破坏性变更（删除、签名变更）
  MEDIUM: 'medium',   // 功能变更（新增参数）
  LOW: 'low'          // 文档变更（描述不匹配）
};

/**
 * 检测规格与代码之间的偏离
 *
 * @param {Object} spec - 规格信息
 * @param {Object} codeInfo - 代码信息（来自 AST 解析）
 * @returns {Array<Object>} 偏离列表
 */
function detectDrift(spec, codeInfo) {
  const drifts = [];

  if (!spec || !codeInfo) {
    return drifts;
  }

  // 获取规格中的方法列表
  const specMethods = extractSpecMethods(spec);
  const codeMethods = codeInfo.methods || [];

  // 检测新增的方法（代码有，规格没有）
  for (const codeMethod of codeMethods) {
    const specMethod = specMethods.find(m => m.name === codeMethod.name);
    if (!specMethod) {
      drifts.push({
        type: DriftType.METHOD_ADDED,
        severity: DriftSeverity.MEDIUM,
        method: codeMethod.name,
        signature: codeMethod.signature,
        description: `代码中新增方法 ${codeMethod.name}，规格中未定义`
      });
    }
  }

  // 检测删除的方法（规格有，代码没有）
  for (const specMethod of specMethods) {
    const codeMethod = codeMethods.find(m => m.name === specMethod.name);
    if (!codeMethod) {
      drifts.push({
        type: DriftType.METHOD_REMOVED,
        severity: DriftSeverity.HIGH,
        method: specMethod.name,
        oldSignature: specMethod.signature,
        description: `规格中定义的方法 ${specMethod.name} 在代码中已不存在`
      });
    }
  }

  // 检测签名变更
  for (const codeMethod of codeMethods) {
    const specMethod = specMethods.find(m => m.name === codeMethod.name);
    if (specMethod) {
      const signatureDrift = detectSignatureDrift(specMethod, codeMethod);
      if (signatureDrift.length > 0) {
        drifts.push(...signatureDrift);
      }
    }
  }

  return drifts;
}

/**
 * 检测签名变更
 *
 * @param {Object} specMethod - 规格中的方法
 * @param {Object} codeMethod - 代码中的方法
 * @returns {Array<Object>} 签名偏离列表
 */
function detectSignatureDrift(specMethod, codeMethod) {
  const drifts = [];

  // 规范化签名进行比较
  const specSig = normalizeSignature(specMethod.signature);
  const codeSig = normalizeSignature(codeMethod.signature);

  if (specSig !== codeSig) {
    // 详细检测参数变化
    const specParams = extractParams(specMethod.signature);
    const codeParams = extractParams(codeMethod.signature);

    // 检测新增参数
    for (const codeParam of codeParams) {
      if (!specParams.includes(codeParam)) {
        drifts.push({
          type: DriftType.PARAMETER_ADDED,
          severity: DriftSeverity.MEDIUM,
          method: codeMethod.name,
          parameter: codeParam,
          description: `方法 ${codeMethod.name} 新增参数 ${codeParam}`
        });
      }
    }

    // 检测删除参数
    for (const specParam of specParams) {
      if (!codeParams.includes(specParam)) {
        drifts.push({
          type: DriftType.PARAMETER_REMOVED,
          severity: DriftSeverity.HIGH,
          method: codeMethod.name,
          parameter: specParam,
          description: `方法 ${codeMethod.name} 删除参数 ${specParam}`
        });
      }
    }

    // 如果没有检测到具体参数变化但签名不同，记录整体签名变更
    if (drifts.length === 0) {
      drifts.push({
        type: DriftType.SIGNATURE_CHANGED,
        severity: DriftSeverity.MEDIUM,
        method: codeMethod.name,
        oldSignature: specMethod.signature,
        newSignature: codeMethod.signature,
        description: `方法 ${codeMethod.name} 签名已变更`
      });
    }
  }

  return drifts;
}

/**
 * 从规格中提取方法列表
 *
 * @param {Object} spec - 规格对象
 * @returns {Array<Object>} 方法列表
 */
function extractSpecMethods(spec) {
  const methods = [];

  // 从规格的派生产物或技术设计章节提取
  if (spec.methods) {
    return spec.methods;
  }

  // 从规格内容中解析方法定义
  if (spec.content) {
    const methodMatches = spec.content.matchAll(
      /\|\s*(?:函数|方法)\s*\|\s*`?(\w+)\(([^)]*)\)`?\s*\|/g
    );
    for (const match of methodMatches) {
      methods.push({
        name: match[1],
        signature: `${match[1]}(${match[2]})`,
        params: match[2].split(',').map(p => p.trim()).filter(Boolean)
      });
    }
  }

  // 从派生产物表格提取
  if (spec.derivedOutputs) {
    for (const output of spec.derivedOutputs) {
      if (output.type === 'function' || output.type === 'method') {
        methods.push({
          name: output.name,
          signature: output.signature || output.name,
          params: output.params || []
        });
      }
    }
  }

  return methods;
}

/**
 * 规范化签名（移除空格、统一格式）
 *
 * @param {string} signature - 函数签名
 * @returns {string} 规范化后的签名
 */
function normalizeSignature(signature) {
  if (!signature) return '';
  return signature
    .replace(/\s+/g, '')           // 移除所有空格
    .replace(/=>[^,)]+/g, '')      // 移除类型注解
    .replace(/:[^,)]+/g, '')       // 移除 TypeScript 类型
    .toLowerCase();
}

/**
 * 从签名中提取参数名
 *
 * @param {string} signature - 函数签名
 * @returns {Array<string>} 参数名列表
 */
function extractParams(signature) {
  if (!signature) return [];

  // 提取括号内的参数列表
  const match = signature.match(/\(([^)]*)\)/);
  if (!match) return [];

  return match[1]
    .split(',')
    .map(param => {
      // 移除默认值和类型注解
      const name = param
        .replace(/=[^,]+/g, '')   // 移除默认值
        .replace(/:[^,]+/g, '')   // 移除类型注解
        .trim();
      return name;
    })
    .filter(Boolean);
}

/**
 * 计算偏离摘要
 *
 * @param {Array<Object>} drifts - 偏离列表
 * @returns {Object} 摘要信息
 */
function calculateDriftSummary(drifts) {
  const summary = {
    total: drifts.length,
    byType: {},
    bySeverity: {
      high: 0,
      medium: 0,
      low: 0
    },
    hasCritical: false
  };

  for (const drift of drifts) {
    // 按类型统计
    summary.byType[drift.type] = (summary.byType[drift.type] || 0) + 1;

    // 按严重程度统计
    if (drift.severity) {
      summary.bySeverity[drift.severity]++;
    }

    // 检测是否有高风险偏离
    if (drift.severity === DriftSeverity.HIGH) {
      summary.hasCritical = true;
    }
  }

  return summary;
}

/**
 * 过滤偏离（按严重程度或类型）
 *
 * @param {Array<Object>} drifts - 偏离列表
 * @param {Object} options - 过滤选项
 * @returns {Array<Object>} 过滤后的偏离
 */
function filterDrifts(drifts, options = {}) {
  const { minSeverity, types } = options;

  let filtered = [...drifts];

  // 按最小严重程度过滤
  if (minSeverity) {
    const severityOrder = ['low', 'medium', 'high'];
    const minIndex = severityOrder.indexOf(minSeverity);
    filtered = filtered.filter(d => {
      const driftIndex = severityOrder.indexOf(d.severity);
      return driftIndex >= minIndex;
    });
  }

  // 按类型过滤
  if (types && types.length > 0) {
    filtered = filtered.filter(d => types.includes(d.type));
  }

  return filtered;
}

/**
 * 格式化偏离报告
 *
 * @param {Array<Object>} drifts - 偏离列表
 * @returns {string} 格式化的报告
 */
function formatDriftReport(drifts) {
  if (drifts.length === 0) {
    return '✅ 未检测到规格-代码偏离';
  }

  const lines = ['📋 检测到以下规格-代码偏离:', ''];

  // 按严重程度分组
  const highDrifts = drifts.filter(d => d.severity === DriftSeverity.HIGH);
  const mediumDrifts = drifts.filter(d => d.severity === DriftSeverity.MEDIUM);
  const lowDrifts = drifts.filter(d => d.severity === DriftSeverity.LOW);

  if (highDrifts.length > 0) {
    lines.push('🔴 高风险 (需要立即处理):');
    highDrifts.forEach(d => {
      lines.push(`   - ${d.description}`);
    });
    lines.push('');
  }

  if (mediumDrifts.length > 0) {
    lines.push('🟡 中风险 (建议处理):');
    mediumDrifts.forEach(d => {
      lines.push(`   - ${d.description}`);
    });
    lines.push('');
  }

  if (lowDrifts.length > 0) {
    lines.push('🟢 低风险 (可选处理):');
    lowDrifts.forEach(d => {
      lines.push(`   - ${d.description}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

// 导出
module.exports = {
  DriftType,
  DriftSeverity,
  detectDrift,
  detectSignatureDrift,
  extractSpecMethods,
  normalizeSignature,
  extractParams,
  calculateDriftSummary,
  filterDrifts,
  formatDriftReport
};
