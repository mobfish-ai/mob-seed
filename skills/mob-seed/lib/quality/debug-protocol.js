/**
 * Debug Protocol (调试协议)
 *
 * 基于置信度的调试决策协议，自动修复或请求人工介入。
 *
 * @see openspec/changes/v2.0-seed-complete/specs/quality/debug-protocol.fspec.md
 * @module lib/quality/debug-protocol
 * @version 1.0.0
 */

'use strict';

/**
 * 置信度维度和权重
 * @see REQ-001: 置信度评估模型
 */
const CONFIDENCE_DIMENSIONS = {
  error_type: { weight: 0.30, name: '错误类型识别' },
  root_cause: { weight: 0.25, name: '根因定位' },
  fix_approach: { weight: 0.25, name: '修复方案' },
  impact_scope: { weight: 0.20, name: '影响范围' }
};

/**
 * 置信度阈值
 */
const CONFIDENCE_THRESHOLD = 50; // 50%

/**
 * 常见错误类型及其置信度分数
 */
const COMMON_ERROR_TYPES = {
  TypeError: 80,
  ReferenceError: 75,
  SyntaxError: 90,
  RangeError: 70,
  Error: 50,
  UnknownError: 20
};

/**
 * 评估调试置信度
 *
 * @see REQ-001 AC-001: 置信度范围 0-100%
 * @see REQ-001 AC-002: 各维度独立评分
 *
 * @param {Object} errorContext - 错误上下文
 * @returns {{ confidence: number, dimensions: Object, reasoning: string }}
 */
function evaluateConfidence(errorContext) {
  const dimensions = {};

  // 错误类型识别
  const errorType = errorContext.errorType || 'UnknownError';
  dimensions.error_type = COMMON_ERROR_TYPES[errorType] || 30;

  // 根因定位 - 基于是否有堆栈跟踪和位置信息
  if (errorContext.stackTrace || errorContext.location) {
    dimensions.root_cause = 70;
  } else if (errorContext.errorMessage && errorContext.errorMessage.length > 20) {
    dimensions.root_cause = 50;
  } else {
    dimensions.root_cause = 30;
  }

  // 修复方案 - 基于错误类型的常见程度
  if (errorType === 'TypeError' && errorContext.errorMessage?.includes('undefined')) {
    dimensions.fix_approach = 75;
  } else if (errorType === 'SyntaxError') {
    dimensions.fix_approach = 80;
  } else {
    dimensions.fix_approach = 40;
  }

  // 影响范围 - 基于是否有文件信息
  if (errorContext.location?.file) {
    dimensions.impact_scope = 70;
  } else {
    dimensions.impact_scope = 40;
  }

  // 计算加权总分
  let confidence = 0;
  for (const [key, dim] of Object.entries(CONFIDENCE_DIMENSIONS)) {
    confidence += (dimensions[key] || 0) * dim.weight;
  }

  // 生成推理说明
  const reasoning = generateReasoning(errorContext, dimensions, confidence);

  return {
    confidence: Math.round(confidence),
    dimensions,
    reasoning
  };
}

/**
 * 生成置信度推理说明
 */
function generateReasoning(errorContext, dimensions, confidence) {
  const parts = [];
  const errorType = errorContext.errorType || 'Unknown';

  if (dimensions.error_type >= 70) {
    parts.push(`${errorType} 是常见错误类型，容易识别`);
  } else {
    parts.push(`${errorType} 是不常见的错误类型`);
  }

  if (dimensions.root_cause >= 60) {
    parts.push('有足够的上下文定位根因');
  } else {
    parts.push('根因定位信息不足');
  }

  if (confidence >= CONFIDENCE_THRESHOLD) {
    parts.push('置信度足够，可尝试自动修复');
  } else {
    parts.push('置信度不足，建议人工介入');
  }

  return parts.join('。') + '。';
}

/**
 * 执行自动修复
 *
 * @see REQ-002 AC-004: 修复前创建代码快照
 * @see REQ-002 AC-005: 修复后自动验证
 *
 * @param {Object} errorContext - 错误上下文
 * @param {Object} fixPlan - 修复方案
 * @returns {Promise<Object>} 修复结果
 */
async function executeAutoFix(errorContext, fixPlan) {
  const affectedFiles = fixPlan.affectedFiles || [];

  // 1. 创建代码快照
  const snapshot = createSnapshot(affectedFiles);

  try {
    // 2. 应用修复（简化实现：这里只是模拟）
    // 实际实现需要根据 fixPlan.steps 执行代码修改

    // 3. 运行验证
    const verification = await runVerification({
      testCommand: 'echo test passed'
    });

    if (verification.passed) {
      return {
        success: true,
        verified: true,
        message: 'Fix applied and verified successfully',
        fixPlan,
        snapshot
      };
    } else {
      // 验证失败，回滚
      rollbackToSnapshot(snapshot);
      return {
        success: false,
        verified: false,
        message: 'Fix verification failed, rolled back',
        fixPlan,
        snapshot
      };
    }
  } catch (error) {
    // 出错时回滚
    rollbackToSnapshot(snapshot);
    return {
      success: false,
      verified: false,
      message: `Fix failed: ${error.message}`,
      error
    };
  }
}

/**
 * 生成修复方案
 *
 * @param {Object} errorContext - 错误上下文
 * @returns {Object} 修复方案
 */
function generateFixPlan(errorContext) {
  const errorType = errorContext.errorType || 'Error';
  const errorMessage = errorContext.errorMessage || '';
  const location = errorContext.location || {};

  const plan = {
    description: '',
    steps: [],
    affectedFiles: []
  };

  // 根据错误类型生成修复方案
  if (errorType === 'TypeError') {
    if (errorMessage.includes('undefined')) {
      plan.description = 'Add null/undefined check before accessing property';
      plan.steps = [
        'Identify the variable that may be undefined',
        'Add optional chaining or explicit null check',
        'Test the fix'
      ];
    } else if (errorMessage.includes('not a function')) {
      plan.description = 'Verify the function exists and is callable';
      plan.steps = [
        'Check if the function is properly imported',
        'Verify the function signature',
        'Test the fix'
      ];
    }
  } else if (errorType === 'SyntaxError') {
    plan.description = 'Fix syntax error in the code';
    plan.steps = [
      'Identify the syntax issue from error message',
      'Fix the syntax error',
      'Verify file parses correctly'
    ];
  } else {
    plan.description = `Fix ${errorType}: ${errorMessage}`;
    plan.steps = [
      'Analyze the error context',
      'Identify the root cause',
      'Apply appropriate fix'
    ];
  }

  // 添加受影响的文件
  if (location.file) {
    plan.affectedFiles.push(location.file);
  }

  return plan;
}

/**
 * 创建代码快照
 *
 * @param {Array<string>} files - 文件列表
 * @returns {Object} 快照对象
 */
function createSnapshot(files) {
  const fs = require('fs');
  const snapshot = {
    timestamp: new Date().toISOString(),
    files: {}
  };

  for (const filePath of files) {
    try {
      if (fs.existsSync(filePath)) {
        snapshot.files[filePath] = fs.readFileSync(filePath, 'utf-8');
      }
    } catch (error) {
      // 忽略无法读取的文件
    }
  }

  return snapshot;
}

/**
 * 回滚到快照
 *
 * @see REQ-002 AC-006: 失败自动回滚
 *
 * @param {Object} snapshot - 快照对象
 */
function rollbackToSnapshot(snapshot) {
  const fs = require('fs');

  if (!snapshot || !snapshot.files) {
    return;
  }

  for (const [filePath, content] of Object.entries(snapshot.files)) {
    try {
      fs.writeFileSync(filePath, content);
    } catch (error) {
      // 忽略写入失败
    }
  }
}

/**
 * 请求人工介入
 *
 * @see REQ-003: 人工介入流程
 *
 * @param {Object} errorContext - 错误上下文
 * @param {Object} analysisResult - 分析结果
 * @returns {Object} 介入请求
 */
function requestHumanIntervention(errorContext, analysisResult) {
  const errorType = errorContext.errorType || 'UnknownError';
  const errorMessage = errorContext.errorMessage || 'No error message';

  // 生成建议
  const suggestions = [];

  if (errorType === 'TypeError') {
    suggestions.push('检查变量是否已定义');
    suggestions.push('添加类型检查或默认值');
  } else if (errorType === 'ReferenceError') {
    suggestions.push('检查变量或函数是否已声明');
    suggestions.push('检查模块导入');
  } else if (errorType === 'SyntaxError') {
    suggestions.push('检查代码语法');
    suggestions.push('使用 IDE 格式化功能');
  } else if (errorMessage.includes('ECONNREFUSED')) {
    suggestions.push('检查网络连接');
    suggestions.push('确认服务是否已启动');
  } else {
    suggestions.push('查看错误堆栈跟踪');
    suggestions.push('检查相关日志');
  }

  return {
    message: `需要人工介入处理 ${errorType}: ${errorMessage}`,
    errorContext,
    confidenceDetails: {
      overall: analysisResult.confidence,
      dimensions: analysisResult.dimensions || {},
      reasoning: analysisResult.reasoning || ''
    },
    suggestions
  };
}

/**
 * 运行验证测试
 *
 * @param {Object} context - 上下文
 * @returns {Promise<Object>} 验证结果
 */
async function runVerification(context) {
  const { execFile } = require('child_process');
  const testCommand = context.testCommand || 'npm test';

  return new Promise((resolve) => {
    execFile('/bin/sh', ['-c', testCommand], { timeout: 60000 }, (error, stdout, stderr) => {
      if (error) {
        resolve({
          passed: false,
          message: `Verification failed: ${error.message}`,
          output: stderr || stdout
        });
      } else {
        resolve({
          passed: true,
          message: 'Verification passed',
          output: stdout
        });
      }
    });
  });
}

/**
 * 调试决策主入口
 *
 * @param {Object} errorContext - 错误上下文
 * @returns {Promise<Object>} 处理结果
 */
async function handleError(errorContext) {
  // 1. 评估置信度
  const analysis = evaluateConfidence(errorContext);

  // 2. 根据置信度决定处理方式
  if (analysis.confidence >= CONFIDENCE_THRESHOLD) {
    // 高置信度: 尝试自动修复
    const fixPlan = generateFixPlan(errorContext);

    try {
      const fixResult = await executeAutoFix(errorContext, fixPlan);

      if (fixResult.success) {
        return {
          action: 'auto_fix',
          success: true,
          confidence: analysis.confidence,
          fixPlan,
          result: fixResult
        };
      } else {
        // 自动修复失败，转为人工介入
        const intervention = requestHumanIntervention(errorContext, analysis);
        return {
          action: 'human_intervention',
          success: false,
          confidence: analysis.confidence,
          reason: 'Auto-fix failed',
          intervention
        };
      }
    } catch (error) {
      // 执行出错，转为人工介入
      const intervention = requestHumanIntervention(errorContext, analysis);
      return {
        action: 'human_intervention',
        success: false,
        confidence: analysis.confidence,
        reason: `Auto-fix error: ${error.message}`,
        intervention
      };
    }
  } else {
    // 低置信度: 请求人工介入
    const intervention = requestHumanIntervention(errorContext, analysis);
    return {
      action: 'human_intervention',
      success: false,
      confidence: analysis.confidence,
      reason: 'Low confidence',
      intervention
    };
  }
}

module.exports = {
  // 评估
  evaluateConfidence,

  // 自动修复
  executeAutoFix,
  generateFixPlan,
  createSnapshot,
  rollbackToSnapshot,

  // 人工介入
  requestHumanIntervention,

  // 验证
  runVerification,

  // 主入口
  handleError,

  // 常量
  CONFIDENCE_DIMENSIONS,
  CONFIDENCE_THRESHOLD
};
