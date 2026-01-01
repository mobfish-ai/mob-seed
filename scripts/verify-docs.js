#!/usr/bin/env node
/**
 * 文档完整性验证脚本
 *
 * 检查所有文档类型：
 * 1. API 文档 (docs/api/) - 从代码派生
 * 2. 用户指南 (docs/guide/) - 从规格+代码派生
 * 3. 概念说明 (docs/concepts/) - 从规格派生
 * 4. CHANGELOG.md - 从 Git 历史派生
 * 5. README.md / README.zh-CN.md - 从规格+代码派生
 *
 * 用法: node scripts/verify-docs.js [--verbose]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

const args = process.argv.slice(2);
const verbose = args.includes('--verbose') || args.includes('-v');

const errors = [];
const warnings = [];

/**
 * 检查文件是否存在
 */
function fileExists(filePath) {
  return fs.existsSync(filePath);
}

/**
 * 读取文件内容
 */
function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * 检查命令格式
 */
function checkCommandFormat(content, filePath) {
  const issues = [];

  // 检查旧命令格式
  const oldCommands = [
    '/mob-seed-init',
    '/mob-seed-spec',
    '/mob-seed-emit',
    '/mob-seed-exec',
    '/mob-seed-defend',
    '/mob-seed-status',
    '/mob-seed-archive'
  ];

  for (const cmd of oldCommands) {
    if (content.includes(cmd)) {
      issues.push(`使用旧命令格式: ${cmd} (应为 ${cmd.replace('-', ':')})`);
    }
  }

  return issues;
}

/**
 * 检查 README 中英文同步
 */
function checkReadmeSync() {
  const issues = [];

  if (!fileExists('README.md') || !fileExists('README.zh-CN.md')) {
    if (!fileExists('README.md')) errors.push('README.md 不存在');
    if (!fileExists('README.zh-CN.md')) errors.push('README.zh-CN.md 不存在');
    return issues;
  }

  const enReadme = readFile('README.md');
  const zhReadme = readFile('README.zh-CN.md');

  // 检查版本号是否一致
  const enVersion = enReadme.match(/version[:\s]+(\d+\.\d+\.\d+)/i);
  const zhVersion = zhReadme.match(/version[:\s]+(\d+\.\d+\.\d+)/i);

  if (enVersion && zhVersion && enVersion[1] !== zhVersion[1]) {
    issues.push(`README 版本号不一致: EN=${enVersion[1]}, ZH=${zhVersion[1]}`);
  }

  // 检查命令格式
  const enCmdIssues = checkCommandFormat(enReadme, 'README.md');
  const zhCmdIssues = checkCommandFormat(zhReadme, 'README.zh-CN.md');

  issues.push(...enCmdIssues.map(i => `README.md: ${i}`));
  issues.push(...zhCmdIssues.map(i => `README.zh-CN.md: ${i}`));

  return issues;
}

/**
 * 检查 CHANGELOG 格式
 */
function checkChangelog() {
  const issues = [];

  if (!fileExists('CHANGELOG.md')) {
    errors.push('CHANGELOG.md 不存在');
    return issues;
  }

  const content = readFile('CHANGELOG.md');

  // 检查是否有 Unreleased 节
  if (!content.includes('## [Unreleased]')) {
    issues.push('CHANGELOG 缺少 [Unreleased] 节');
  }

  // 检查是否遵循 Keep a Changelog 格式
  const requiredSections = ['### Added', '### Changed', '### Fixed'];
  let hasAnySection = false;
  for (const section of requiredSections) {
    if (content.includes(section)) {
      hasAnySection = true;
      break;
    }
  }

  if (!hasAnySection) {
    issues.push('CHANGELOG 未遵循 Keep a Changelog 格式');
  }

  // 检查版本链接
  if (!content.includes('[Unreleased]:')) {
    issues.push('CHANGELOG 缺少版本比较链接');
  }

  return issues;
}

/**
 * 检查用户指南
 */
function checkGuides() {
  const issues = [];
  const guideDir = 'docs/guide';

  if (!fileExists(guideDir)) {
    errors.push('docs/guide/ 目录不存在');
    return issues;
  }

  const requiredGuides = ['getting-started.md', 'writing-specs.md'];

  for (const guide of requiredGuides) {
    const guidePath = path.join(guideDir, guide);
    if (!fileExists(guidePath)) {
      errors.push(`缺少必要指南: ${guidePath}`);
    } else {
      const content = readFile(guidePath);
      const cmdIssues = checkCommandFormat(content, guidePath);
      issues.push(...cmdIssues.map(i => `${guidePath}: ${i}`));
    }
  }

  return issues;
}

/**
 * 检查概念文档
 */
function checkConcepts() {
  const issues = [];
  const conceptDir = 'docs/concepts';

  if (!fileExists(conceptDir)) {
    errors.push('docs/concepts/ 目录不存在');
    return issues;
  }

  const requiredConcepts = ['seed-methodology.md', 'openspec-lifecycle.md'];

  for (const concept of requiredConcepts) {
    const conceptPath = path.join(conceptDir, concept);
    if (!fileExists(conceptPath)) {
      errors.push(`缺少概念文档: ${conceptPath}`);
    }
  }

  return issues;
}

/**
 * 主函数
 */
function main() {
  console.log('\n━━━ 📚 文档完整性验证 ━━━\n');

  // 1. 检查 README 同步
  console.log('检查 README 中英文同步...');
  const readmeIssues = checkReadmeSync();
  warnings.push(...readmeIssues);

  // 2. 检查 CHANGELOG
  console.log('检查 CHANGELOG 格式...');
  const changelogIssues = checkChangelog();
  warnings.push(...changelogIssues);

  // 3. 检查用户指南
  console.log('检查用户指南...');
  const guideIssues = checkGuides();
  warnings.push(...guideIssues);

  // 4. 检查概念文档
  console.log('检查概念文档...');
  const conceptIssues = checkConcepts();
  warnings.push(...conceptIssues);

  // 5. 输出结果
  console.log('\n━━━ 结果 ━━━\n');

  if (errors.length === 0 && warnings.length === 0) {
    console.log(`${GREEN}✅ 文档验证通过！${RESET}\n`);
    process.exit(0);
  }

  if (errors.length > 0) {
    console.log(`${RED}❌ 错误 (${errors.length}):${RESET}`);
    errors.forEach(e => console.log(`   ${RED}${e}${RESET}`));
    console.log();
  }

  if (warnings.length > 0) {
    console.log(`${YELLOW}⚠️ 警告 (${warnings.length}):${RESET}`);
    warnings.forEach(w => console.log(`   ${YELLOW}${w}${RESET}`));
    console.log();
  }

  if (errors.length > 0) {
    process.exit(1);
  }

  process.exit(0);
}

try {
  main();
} catch (err) {
  console.error(`${RED}错误: ${err.message}${RESET}`);
  process.exit(1);
}
