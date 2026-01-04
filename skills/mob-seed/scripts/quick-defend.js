#!/usr/bin/env node
/**
 * SEED 快速检查
 *
 * 快速同步检查，仅检查 staged 文件
 * 检查项：
 * 1. SEED 四字诀基础验证
 * 2. 派生链验证
 * 3. 基础同步检查
 */

const fs = require('fs');
const path = require('path');

// 颜色定义
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

/**
 * 加载 SEED 配置
 */
function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync('.seed/config.json', 'utf8'));
  } catch {
    return null;
  }
}

/**
 * 检查规格文件是否存在
 */
function checkSpecExists(codeFile, config) {
  const specsDir = config?.paths?.specs || 'openspec/specs';
  const baseName = path.basename(codeFile, path.extname(codeFile));

  // 尝试找到对应的规格文件
  const possibleSpecs = [
    path.join(specsDir, `${baseName}.fspec.md`),
    path.join(specsDir, '**', `${baseName}.fspec.md`)
  ];

  for (const specPath of possibleSpecs) {
    if (fs.existsSync(specPath)) {
      return { exists: true, path: specPath };
    }
  }

  return { exists: false, path: null };
}

/**
 * 快速 SEED 四字诀验证
 */
function quickSeedCheck(files, config) {
  const issues = [];
  const fileList = files.split('\n').filter(f => f.trim());

  for (const file of fileList) {
    const ext = path.extname(file);

    // 检查代码文件是否有对应规格
    if (['.js', '.ts', '.jsx', '.tsx'].includes(ext)) {
      // 排除测试文件和配置文件
      if (file.includes('.test.') || file.includes('.spec.') || file.includes('config')) {
        continue;
      }

      // S: 检查是否有对应规格
      const specCheck = checkSpecExists(file, config);
      if (!specCheck.exists) {
        // 只警告，不阻止（可能是工具文件）
        issues.push({
          level: 'warning',
          file,
          message: `无对应规格文件（可能是工具/配置文件）`
        });
      }
    }

    // 检查规格文件格式
    if (file.endsWith('.fspec.md')) {
      try {
        const content = fs.readFileSync(file, 'utf8');

        // 检查必要的章节
        if (!content.includes('## 功能需求') && !content.includes('## Functional Requirements')) {
          issues.push({
            level: 'error',
            file,
            message: '规格文件缺少功能需求章节'
          });
        }
      } catch (e) {
        issues.push({
          level: 'error',
          file,
          message: `无法读取规格文件: ${e.message}`
        });
      }
    }
  }

  return issues;
}

/**
 * 输出检查结果
 */
function printResults(issues) {
  const errors = issues.filter(i => i.level === 'error');
  const warnings = issues.filter(i => i.level === 'warning');

  if (errors.length > 0) {
    console.log(`${colors.red}❌ 发现 ${errors.length} 个错误:${colors.reset}`);
    for (const issue of errors) {
      console.log(`   ${colors.red}• ${issue.file}: ${issue.message}${colors.reset}`);
    }
  }

  if (warnings.length > 0) {
    console.log(`${colors.yellow}⚠️  ${warnings.length} 个警告:${colors.reset}`);
    for (const issue of warnings) {
      console.log(`   ${colors.yellow}• ${issue.file}: ${issue.message}${colors.reset}`);
    }
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log(`${colors.green}✅ 快速检查通过${colors.reset}`);
  }

  return errors.length === 0;
}

// 解析命令行参数
const args = process.argv.slice(2);
let files = '';

for (const arg of args) {
  if (arg.startsWith('--files=')) {
    files = arg.substring(8);
  }
}

if (!files) {
  console.error('Usage: quick-defend.js --files="file1\\nfile2"');
  process.exit(1);
}

// 执行检查
const config = loadConfig();
const issues = quickSeedCheck(files, config);
const passed = printResults(issues);

process.exit(passed ? 0 : 1);
