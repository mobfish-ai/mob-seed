#!/usr/bin/env node
/**
 * 归档验证脚本
 *
 * 用法: node scripts/verify-archive.js <archive-path>
 * 例如: node scripts/verify-archive.js openspec/archive/v2.1-release-automation
 *
 * 这个脚本会检查归档是否完整，防止遗漏：
 * 1. proposal.md 状态和 AC checkbox
 * 2. *.fspec.md 状态和 FR/NFR checkbox
 */

const fs = require('fs');
const path = require('path');

/**
 * 递归查找文件
 */
function findFiles(dir, extension) {
  const results = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      results.push(...findFiles(fullPath, extension));
    } else if (item.name.endsWith(extension)) {
      results.push(fullPath);
    }
  }

  return results;
}

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function main() {
  const archivePath = process.argv[2];

  if (!archivePath) {
    console.error(`${RED}用法: node scripts/verify-archive.js <archive-path>${RESET}`);
    process.exit(1);
  }

  if (!fs.existsSync(archivePath)) {
    console.error(`${RED}路径不存在: ${archivePath}${RESET}`);
    process.exit(1);
  }

  console.log(`\n━━━ 🔍 归档验证 ━━━\n`);
  console.log(`路径: ${archivePath}\n`);

  const errors = [];
  const warnings = [];

  // 1. 检查 proposal.md
  const proposalPath = path.join(archivePath, 'proposal.md');
  if (fs.existsSync(proposalPath)) {
    const content = fs.readFileSync(proposalPath, 'utf-8');
    checkFile('proposal.md', content, errors, warnings, true);
  } else {
    errors.push(`proposal.md 不存在`);
  }

  // 2. 检查所有 .fspec.md
  const specFiles = findFiles(archivePath, '.fspec.md');
  console.log(`检查文件: ${specFiles.length} 个 .fspec.md\n`);

  for (const specFile of specFiles) {
    const content = fs.readFileSync(specFile, 'utf-8');
    const relativePath = path.relative(archivePath, specFile);
    checkFile(relativePath, content, errors, warnings, false);
  }

  // 输出结果
  console.log('━━━ 结果 ━━━\n');

  if (errors.length === 0 && warnings.length === 0) {
    console.log(`${GREEN}✅ 验证通过！所有文件状态正确。${RESET}\n`);
    process.exit(0);
  }

  if (errors.length > 0) {
    console.log(`${RED}❌ 错误 (${errors.length}):${RESET}`);
    errors.forEach(e => console.log(`   ${RED}• ${e}${RESET}`));
    console.log();
  }

  if (warnings.length > 0) {
    console.log(`${YELLOW}⚠️ 警告 (${warnings.length}):${RESET}`);
    warnings.forEach(w => console.log(`   ${YELLOW}• ${w}${RESET}`));
    console.log();
  }

  if (errors.length > 0) {
    console.log(`${RED}归档不完整，请修复上述错误。${RESET}\n`);
    process.exit(1);
  }

  process.exit(0);
}

function checkFile(fileName, content, errors, warnings, isProposal) {
  // 检查状态标记
  if (!content.includes('> 状态: archived')) {
    errors.push(`${fileName}: 缺少 "> 状态: archived"`);
  }

  // 检查归档日期
  if (!content.includes('> 归档日期:')) {
    errors.push(`${fileName}: 缺少 "> 归档日期:"`);
  }

  // 检查未完成的 checkbox
  const uncheckedMatches = content.match(/^- \[ \]/gm) || [];
  const uncheckedCount = uncheckedMatches.length;

  if (uncheckedCount > 0) {
    if (isProposal) {
      // proposal.md 的 AC 必须全部完成
      errors.push(`${fileName}: ${uncheckedCount} 个 AC 未完成 (必须全部标记 [x])`);
    } else {
      // .fspec.md 的 FR/NFR 可能有未覆盖的，只警告
      warnings.push(`${fileName}: ${uncheckedCount} 个 checkbox 未完成`);
    }
  }

  // 输出单个文件状态
  const hasStatus = content.includes('> 状态: archived');
  const hasDate = content.includes('> 归档日期:');
  const statusIcon = hasStatus && hasDate && (isProposal ? uncheckedCount === 0 : true) ? '✅' : '❌';

  console.log(`${statusIcon} ${fileName}`);
  if (!hasStatus) console.log(`   缺少状态标记`);
  if (!hasDate) console.log(`   缺少归档日期`);
  if (uncheckedCount > 0) console.log(`   ${uncheckedCount} 个未完成 checkbox`);
}

try {
  main();
} catch (err) {
  console.error(`${RED}错误: ${err.message}${RESET}`);
  process.exit(1);
}
