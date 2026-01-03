/**
 * 报告生成器 (Report Generator)
 *
 * 生成 brownfield 迁移报告。
 *
 * @module skills/mob-seed/lib/brownfield/report-generator
 */

const path = require('path');

/**
 * 生成迁移报告
 * @param {Object} options - 报告选项
 * @param {Object} options.projectInfo - 项目信息
 * @param {Object} options.extractResult - 提取结果
 * @param {Object} [options.enrichResult] - 补充结果
 * @param {Object} [options.validateResult] - 验证结果
 * @returns {string} Markdown 格式的报告
 */
function generateReport(options) {
  const {
    projectInfo,
    extractResult,
    enrichResult,
    validateResult
  } = options;

  const qualityDist = calculateQualityDistribution(extractResult.results || []);
  const completeness = calculateCompleteness(extractResult, validateResult);
  const timestamp = new Date().toISOString();

  let report = `# Brownfield 迁移报告

> 项目: ${projectInfo.name || projectInfo.type}
> 类型: ${projectInfo.type}
> 时间: ${timestamp}

---

## 📊 统计摘要

| 指标 | 数量 | 百分比 |
|------|------|--------|
| 总文件数 | ${extractResult.total || 0} | 100% |
| 提取成功 | ${extractResult.success || 0} | ${percent(extractResult.success, extractResult.total)} |
| 提取失败 | ${extractResult.failed?.length || 0} | ${percent(extractResult.failed?.length, extractResult.total)} |
`;

  if (enrichResult) {
    report += `| 智能补充 | ${enrichResult.enriched || 0} | ${percent(enrichResult.enriched, extractResult.success)} |
`;
  }

  if (validateResult) {
    report += `| 同步验证通过 | ${validateResult.synced || 0} | ${percent(validateResult.synced, validateResult.total)} |
| 规格偏离 | ${validateResult.drifted?.length || 0} | ${percent(validateResult.drifted?.length, validateResult.total)} |
`;
  }

  report += `
## 🎯 质量分布

| 质量等级 | 数量 | 说明 |
|----------|------|------|
| ⭐⭐⭐ 高质量 | ${qualityDist.high} | AST 解析 + 完整 JSDoc |
| ⭐⭐ 中等质量 | ${qualityDist.medium} | 正则提取 + 部分文档 |
| ⭐ 低质量 | ${qualityDist.low} | 模板生成 + 需人工补充 |

## 📁 项目结构

| 属性 | 值 |
|------|-----|
| 源码目录 | \`${projectInfo.srcDir}\` |
| 测试目录 | \`${projectInfo.testDir}\` |
| 源文件数 | ${projectInfo.sourceFiles?.length || 0} |
`;

  if (projectInfo.packageManager) {
    report += `| 包管理器 | ${projectInfo.packageManager} |
`;
  }

  if (projectInfo.moduleType) {
    report += `| 模块类型 | ${projectInfo.moduleType} |
`;
  }

  // 失败文件列表
  if (extractResult.failed && extractResult.failed.length > 0) {
    report += `
## ⚠️ 失败文件列表

`;
    for (const failure of extractResult.failed.slice(0, 20)) {
      const file = typeof failure === 'string' ? failure : failure.file;
      const error = typeof failure === 'object' ? failure.error : '未知错误';
      report += `- \`${file}\`: ${error}\n`;
    }
    if (extractResult.failed.length > 20) {
      report += `\n*...还有 ${extractResult.failed.length - 20} 个失败文件*\n`;
    }
  }

  // 后续建议
  report += `
## 📝 后续建议

### 高优先级

`;

  if (validateResult?.drifted?.length > 0) {
    for (const spec of validateResult.drifted.slice(0, 5)) {
      report += `- [ ] 审核 \`${spec}\` - 检测到代码与规格不一致\n`;
    }
  } else {
    report += `- [x] 所有规格与代码同步\n`;
  }

  report += `
### 中优先级

`;

  if (qualityDist.lowQualitySpecs.length > 0) {
    for (const spec of qualityDist.lowQualitySpecs.slice(0, 5)) {
      report += `- [ ] 补充 \`${spec}\` - 自动提取质量较低，需人工审核\n`;
    }
  } else {
    report += `- [x] 所有规格质量达标\n`;
  }

  report += `
### 低优先级

- [ ] 检查所有规格的验收标准（AC）是否完整
- [ ] 运行 \`/mob-seed:defend\` 定期验证同步状态
- [ ] 配置 Git Hooks 自动运行 defend

## 🚀 下一步操作

1. ${validateResult?.drifted?.length > 0 ? `审核偏离规格（${validateResult.drifted.length} 个）` : '规格同步检查完成'}
2. ${qualityDist.low > 0 ? `补充低质量规格（${qualityDist.low} 个）` : '质量检查完成'}
3. 运行 \`/mob-seed:defend\` 验证规格
4. 配置 Git Hooks: \`/mob-seed:init --hooks\`

---

**迁移完成度**: ${completeness}%

*报告生成时间: ${timestamp}*
`;

  return report;
}

/**
 * 计算质量分布
 * @param {Array} results - 提取结果数组
 * @returns {Object} 质量分布
 */
function calculateQualityDistribution(results) {
  const distribution = {
    high: 0,
    medium: 0,
    low: 0,
    lowQualitySpecs: []
  };

  for (const result of results) {
    if (!result.success) continue;

    const quality = result.quality || 'low';

    if (quality === 'high') {
      distribution.high++;
    } else if (quality === 'medium') {
      distribution.medium++;
    } else {
      distribution.low++;
      if (result.spec?.path) {
        distribution.lowQualitySpecs.push(result.spec.path);
      }
    }
  }

  return distribution;
}

/**
 * 计算完成百分比
 * @param {Object} extractResult - 提取结果
 * @param {Object} validateResult - 验证结果
 * @returns {number} 完成百分比
 */
function calculateCompleteness(extractResult, validateResult) {
  if (!extractResult || extractResult.total === 0) {
    return 0;
  }

  // 提取成功占 50%
  const extractScore = ((extractResult.success || 0) / extractResult.total) * 50;

  // 同步验证占 50%（如果有验证结果）
  let syncScore = 50; // 默认满分
  if (validateResult && validateResult.total > 0) {
    syncScore = ((validateResult.synced || 0) / validateResult.total) * 50;
  }

  return Math.round(extractScore + syncScore);
}

/**
 * 计算百分比字符串
 * @param {number} value - 分子
 * @param {number} total - 分母
 * @returns {string} 百分比字符串
 */
function percent(value, total) {
  if (!total || total === 0) {
    return '0%';
  }
  return `${Math.round((value || 0) / total * 100)}%`;
}

/**
 * 生成简要摘要
 * @param {Object} options - 报告选项
 * @returns {string} 简要摘要
 */
function generateSummary(options) {
  const {
    extractResult,
    enrichResult,
    validateResult
  } = options;

  const lines = [];

  lines.push(`提取: ${extractResult.success}/${extractResult.total} 成功`);

  if (extractResult.failed?.length > 0) {
    lines.push(`失败: ${extractResult.failed.length} 个文件`);
  }

  if (enrichResult) {
    lines.push(`补充: ${enrichResult.enriched || 0} 个规格`);
  }

  if (validateResult) {
    lines.push(`同步: ${validateResult.synced}/${validateResult.total}`);
  }

  return lines.join(', ');
}

/**
 * 生成 JSON 格式报告
 * @param {Object} options - 报告选项
 * @returns {Object} JSON 报告对象
 */
function generateJsonReport(options) {
  const {
    projectInfo,
    extractResult,
    enrichResult,
    validateResult
  } = options;

  const qualityDist = calculateQualityDistribution(extractResult.results || []);

  return {
    timestamp: new Date().toISOString(),
    project: {
      name: projectInfo.name,
      type: projectInfo.type,
      srcDir: projectInfo.srcDir,
      testDir: projectInfo.testDir,
      fileCount: projectInfo.sourceFiles?.length || 0
    },
    extraction: {
      total: extractResult.total || 0,
      success: extractResult.success || 0,
      failed: extractResult.failed?.length || 0,
      failedFiles: extractResult.failed?.slice(0, 50) || []
    },
    enrichment: enrichResult ? {
      enriched: enrichResult.enriched || 0,
      acExtracted: enrichResult.acExtracted || 0,
      frGenerated: enrichResult.frGenerated || 0
    } : null,
    validation: validateResult ? {
      total: validateResult.total || 0,
      synced: validateResult.synced || 0,
      drifted: validateResult.drifted?.length || 0,
      driftedSpecs: validateResult.drifted?.slice(0, 20) || []
    } : null,
    quality: {
      high: qualityDist.high,
      medium: qualityDist.medium,
      low: qualityDist.low
    },
    completeness: calculateCompleteness(extractResult, validateResult)
  };
}

// 导出
module.exports = {
  generateReport,
  generateSummary,
  generateJsonReport,
  calculateQualityDistribution,
  calculateCompleteness,
  percent
};
