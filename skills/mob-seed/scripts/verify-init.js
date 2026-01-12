#!/usr/bin/env node
/**
 * SEED 初始化验证脚本
 *
 * 验证 /mob-seed:init 是否正确执行，检查所有必需文件是否存在。
 *
 * @module scripts/verify-init
 * @usage node skills/mob-seed/scripts/verify-init.js [project-root]
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// 必需文件清单
// ============================================================================

const REQUIRED_FILES = [
  {
    path: '.seed/config.json',
    description: 'SEED 配置文件',
    validator: (content) => {
      try {
        const config = JSON.parse(content);
        if (!config.version) return '缺少 version 字段';
        if (!config.paths) return '缺少 paths 配置';
        if (!config.mission) return '缺少 mission 配置';
        return null;
      } catch (e) {
        return '无效的 JSON 格式';
      }
    }
  },
  {
    path: '.seed/mission.md',
    description: '项目使命声明',
    validator: (content) => {
      // 检查是否包含基本结构
      if (!content.includes('purpose')) return '缺少 purpose 定义';
      if (!content.includes('principles')) return '缺少 principles 定义';
      if (!content.includes('anti_goals') && !content.includes('anti-goals')) {
        return '缺少 anti_goals 定义';
      }
      return null;
    }
  },
  {
    path: '.seed/observations/index.json',
    description: 'ACE 观察索引',
    validator: (content) => {
      try {
        const index = JSON.parse(content);
        if (!index.version) return '缺少 version 字段';
        if (!Array.isArray(index.observations)) return '缺少 observations 数组';
        return null;
      } catch (e) {
        return '无效的 JSON 格式';
      }
    }
  },
  {
    path: 'openspec/specs/.gitkeep',
    description: '规格目录',
    validator: null // 只检查存在性
  },
  {
    path: 'openspec/changes/.gitkeep',
    description: '变更提案目录',
    validator: null
  },
  {
    path: 'openspec/project.md',
    description: '项目约定文档',
    validator: (content) => {
      if (!content.includes('项目概述') && !content.includes('Project')) {
        return '缺少项目概述章节';
      }
      return null;
    }
  },
  {
    path: 'openspec/AGENTS.md',
    description: 'AI 工作流文档',
    validator: (content) => {
      if (!content.includes('SEED') && !content.includes('OpenSpec')) {
        return '缺少 SEED/OpenSpec 相关内容';
      }
      return null;
    }
  }
];

// ============================================================================
// 验证函数
// ============================================================================

/**
 * 验证单个文件
 * @param {string} projectRoot - 项目根目录
 * @param {Object} fileSpec - 文件规格
 * @returns {Object} 验证结果
 */
function verifyFile(projectRoot, fileSpec) {
  const fullPath = path.join(projectRoot, fileSpec.path);
  const result = {
    path: fileSpec.path,
    description: fileSpec.description,
    exists: false,
    valid: false,
    error: null
  };

  // 检查文件是否存在
  if (!fs.existsSync(fullPath)) {
    result.error = '文件不存在';
    return result;
  }

  result.exists = true;

  // 如果没有验证器，只检查存在性
  if (!fileSpec.validator) {
    result.valid = true;
    return result;
  }

  // 读取并验证内容
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    const validationError = fileSpec.validator(content);

    if (validationError) {
      result.error = validationError;
    } else {
      result.valid = true;
    }
  } catch (e) {
    result.error = `读取失败: ${e.message}`;
  }

  return result;
}

/**
 * 验证初始化结果
 * @param {string} projectRoot - 项目根目录
 * @returns {Object} 完整验证结果
 */
function verifyInit(projectRoot) {
  const results = {
    projectRoot,
    timestamp: new Date().toISOString(),
    success: true,
    files: [],
    summary: {
      total: REQUIRED_FILES.length,
      exists: 0,
      valid: 0,
      missing: 0,
      invalid: 0
    }
  };

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔍 SEED 初始化验证');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`📂 项目目录: ${projectRoot}`);
  console.log('');

  for (const fileSpec of REQUIRED_FILES) {
    const result = verifyFile(projectRoot, fileSpec);
    results.files.push(result);

    if (result.exists) {
      results.summary.exists++;
    } else {
      results.summary.missing++;
    }

    if (result.valid) {
      results.summary.valid++;
    } else if (result.exists) {
      results.summary.invalid++;
    }

    // 输出结果
    if (result.valid) {
      console.log(`✅ ${result.path}`);
      console.log(`   ${result.description}`);
    } else if (result.exists) {
      console.log(`⚠️  ${result.path}`);
      console.log(`   ${result.description}`);
      console.log(`   错误: ${result.error}`);
      results.success = false;
    } else {
      console.log(`❌ ${result.path}`);
      console.log(`   ${result.description}`);
      console.log(`   错误: ${result.error}`);
      results.success = false;
    }
    console.log('');
  }

  // 输出摘要
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 验证摘要');
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`   总文件数: ${results.summary.total}`);
  console.log(`   ✅ 有效:   ${results.summary.valid}`);
  console.log(`   ⚠️  无效:   ${results.summary.invalid}`);
  console.log(`   ❌ 缺失:   ${results.summary.missing}`);
  console.log('');

  if (results.success) {
    console.log('✅ 初始化验证通过！');
  } else {
    console.log('❌ 初始化验证失败！');
    console.log('');
    console.log('💡 修复建议:');

    if (results.summary.missing > 0) {
      console.log('   1. 重新运行 /mob-seed:init --force');
      console.log('   2. 或手动运行初始化脚本:');
      console.log('      node $SKILL_DIR/scripts/init-project.js . --force');
    }

    if (results.summary.invalid > 0) {
      console.log('   3. 检查无效文件的内容格式');
    }
  }

  console.log('═══════════════════════════════════════════════════════════════');

  return results;
}

// ============================================================================
// CLI 入口
// ============================================================================

function main() {
  const args = process.argv.slice(2);
  const projectRoot = args.find(a => !a.startsWith('-')) || process.cwd();
  const jsonOutput = args.includes('--json');

  const results = verifyInit(projectRoot);

  if (jsonOutput) {
    console.log('\n' + JSON.stringify(results, null, 2));
  }

  process.exit(results.success ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = {
  verifyInit,
  verifyFile,
  REQUIRED_FILES
};
