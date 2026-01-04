#!/usr/bin/env node

/**
 * 验证规格文件是否完成架构决策
 *
 * 用途：
 * - 检查规格文件的 architecture_decisions_completed 标记
 * - 检查架构决策检查清单是否填写完整
 * - 集成到 /mob-seed:spec validate 命令
 *
 * 使用：
 *   node scripts/verify-architecture-decisions.js <spec-file-path>
 *   node scripts/verify-architecture-decisions.js openspec/changes/v3.3-brownfield-support/specs/spec-extract.fspec.md
 */

const fs = require('fs');
const path = require('path');

/**
 * 解析 frontmatter
 */
function parseFrontmatter(content) {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return { frontmatter: {}, body: content };
  }

  const frontmatterText = frontmatterMatch[1];
  const body = content.slice(frontmatterMatch[0].length);

  const frontmatter = {};
  frontmatterText.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length > 0) {
      const value = valueParts.join(':').trim();
      frontmatter[key.trim()] = value === 'true' ? true : value === 'false' ? false : value;
    }
  });

  return { frontmatter, body };
}

/**
 * 验证架构决策
 */
function verifyArchitectureDecisions(specPath) {
  if (!fs.existsSync(specPath)) {
    return {
      passed: false,
      issues: [`❌ 文件不存在: ${specPath}`]
    };
  }

  const content = fs.readFileSync(specPath, 'utf8');
  const { frontmatter, body } = parseFrontmatter(content);

  const issues = [];

  // 检查 1: frontmatter 标记
  if (frontmatter.status !== 'draft' && !frontmatter.architecture_decisions_completed) {
    issues.push('⚠️ 架构决策未完成，但规格状态已非 draft');
  }

  // 检查 2: 是否包含架构决策章节
  if (!body.includes('## 架构决策检查清单')) {
    issues.push('⚠️ 规格文件缺少"架构决策检查清单"章节');
    return { passed: false, issues };
  }

  // 检查 3: 提取架构决策章节
  const archDecisionsMatch = body.match(/## 架构决策检查清单[\s\S]*?(?=\n## |$)/);
  if (!archDecisionsMatch) {
    issues.push('⚠️ 无法解析架构决策检查清单章节');
    return { passed: false, issues };
  }

  const archDecisionsSection = archDecisionsMatch[0];

  // 检查 4: 分析每个决策点（### 1. 到 ### 8.）
  const decisionSections = archDecisionsSection.split(/### \d+\. /).slice(1);
  const expectedDecisions = 8;

  if (decisionSections.length < expectedDecisions) {
    issues.push(`⚠️ 架构决策点不完整，期望 ${expectedDecisions} 个，实际 ${decisionSections.length} 个`);
  }

  let incompleteDecisions = [];

  decisionSections.forEach((section, index) => {
    const decisionNum = index + 1;
    const hasChecked = section.includes('- [x]') || section.includes('- [X]');
    const hasChoice = section.match(/\*\*选择\*\*:\s*\S+/) && !section.includes('**选择**: ____________');

    // 检查"选择"之后是否有实质性内容（理由/适用场景/降级路径/风险分级等）
    // 提取"选择"之后到下一个分隔符的内容
    const choiceMatch = section.match(/\*\*选择\*\*:[\s\S]*?(?=\n---|$)/);
    let hasSubstantiveContent = false;

    if (choiceMatch) {
      const afterChoice = choiceMatch[0];

      // 简单检查：选择字段后是否有非空白、非占位符内容
      const contentAfterChoice = afterChoice.replace(/\*\*选择\*\*:.*\n/, '').trim();

      hasSubstantiveContent = contentAfterChoice.length > 10 &&  // 有一定长度的内容
                              !contentAfterChoice.includes('____________'); // 不含占位符
    }

    if (!hasChecked || !hasChoice || !hasSubstantiveContent) {
      const missing = [];
      if (!hasChecked) missing.push('未勾选任何选项');
      if (!hasChoice) missing.push('未填写选择');
      if (!hasSubstantiveContent) missing.push('未填写详细说明（理由/适用场景/降级路径等）');

      incompleteDecisions.push(`决策 ${decisionNum}: ${missing.join('、')}`);
    }
  });

  if (incompleteDecisions.length > 0) {
    issues.push(`⚠️ 以下架构决策未完成:\n   ${incompleteDecisions.join('\n   ')}`);
  }

  // 检查 5: frontmatter 标记与实际情况不符
  if (frontmatter.architecture_decisions_completed && incompleteDecisions.length > 0) {
    issues.push('⚠️ frontmatter 标记为已完成，但检查清单仍有未填项');
  }

  if (!frontmatter.architecture_decisions_completed && incompleteDecisions.length === 0) {
    issues.push('💡 所有决策已完成，建议将 frontmatter 中 architecture_decisions_completed 设为 true');
  }

  return {
    passed: issues.length === 0,
    issues,
    stats: {
      total: decisionSections.length,
      completed: decisionSections.length - incompleteDecisions.length,
      incomplete: incompleteDecisions.length
    }
  };
}

/**
 * 主函数
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('用法: node scripts/verify-architecture-decisions.js <spec-file-path>');
    console.error('');
    console.error('示例:');
    console.error('  node scripts/verify-architecture-decisions.js openspec/changes/v3.3-brownfield-support/specs/spec-extract.fspec.md');
    process.exit(1);
  }

  const specPath = args[0];
  const result = verifyArchitectureDecisions(specPath);

  console.log('\n🔍 架构决策验证报告');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📄 规格文件: ${specPath}`);
  console.log('');

  // 显示统计信息（如果有）
  if (result.stats) {
    console.log(`📊 统计: ${result.stats.completed}/${result.stats.total} 个决策点已完成`);
    console.log('');
  }

  if (result.passed) {
    console.log('✅ 架构决策已完成，所有检查通过');
    process.exit(0);
  } else {
    console.log('❌ 架构决策验证失败\n');
    result.issues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue}`);
    });
    console.log('\n💡 建议: 完成所有架构决策后，将 frontmatter 中 architecture_decisions_completed 设为 true');
    process.exit(1);
  }
}

// 导出函数供其他模块使用
if (require.main === module) {
  main();
} else {
  module.exports = { verifyArchitectureDecisions, parseFrontmatter };
}
