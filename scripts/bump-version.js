#!/usr/bin/env node
/**
 * bump-version.js - 版本同步工具
 * @see openspec/changes/v2.1-release-automation/specs/automation/version-sync.fspec.md
 *
 * 用法:
 *   node scripts/bump-version.js --check        # 检查版本一致性
 *   node scripts/bump-version.js 2.1.0          # 同步到指定版本
 *   node scripts/bump-version.js --patch        # 递增 patch 版本
 *   node scripts/bump-version.js --minor        # 递增 minor 版本
 *   node scripts/bump-version.js --major        # 递增 major 版本
 *   node scripts/bump-version.js 2.1.0 --dry-run  # 预览模式
 */

'use strict';

const fs = require('fs');
const path = require('path');

// 版本文件配置
const VERSION_FILES = [
  { path: 'package.json', field: 'version' },
  { path: '.claude-plugin/plugin.json', field: 'version' },
  { path: '.claude-plugin/marketplace.json', field: 'plugins[0].version', nested: true },
  { path: 'skills/mob-seed/package.json', field: 'version' }
];

// 颜色输出
const colors = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  blue: (s) => `\x1b[34m${s}\x1b[0m`,
  gray: (s) => `\x1b[90m${s}\x1b[0m`
};

/**
 * 验证 semver 格式
 * @param {string} version - 版本字符串
 * @returns {boolean}
 */
function validateSemver(version) {
  const semverRegex = /^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/;
  return semverRegex.test(version);
}

/**
 * 解析 semver 版本
 * @param {string} version - 版本字符串
 * @returns {{major: number, minor: number, patch: number}}
 */
function parseSemver(version) {
  const [major, minor, patch] = version.split('-')[0].split('.').map(Number);
  return { major, minor, patch };
}

/**
 * 递增版本
 * @param {string} current - 当前版本
 * @param {'major'|'minor'|'patch'} type - 递增类型
 * @returns {string} 新版本
 */
function incrementVersion(current, type) {
  const { major, minor, patch } = parseSemver(current);

  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(`Unknown increment type: ${type}`);
  }
}

/**
 * 读取 JSON 文件
 * @param {string} filePath - 文件路径
 * @returns {object|null}
 */
function readJsonFile(filePath) {
  try {
    const fullPath = path.resolve(process.cwd(), filePath);
    const content = fs.readFileSync(fullPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

/**
 * 写入 JSON 文件
 * @param {string} filePath - 文件路径
 * @param {object} data - 数据
 */
function writeJsonFile(filePath, data) {
  const fullPath = path.resolve(process.cwd(), filePath);
  const content = JSON.stringify(data, null, 2) + '\n';
  fs.writeFileSync(fullPath, content, 'utf8');
}

/**
 * 获取嵌套字段值
 * @param {object} obj - 对象
 * @param {string} fieldPath - 字段路径 (如 'plugins[0].version')
 * @returns {*}
 */
function getNestedValue(obj, fieldPath) {
  const parts = fieldPath.replace(/\[(\d+)\]/g, '.$1').split('.');
  let value = obj;
  for (const part of parts) {
    if (value == null) return null;
    value = value[part];
  }
  return value;
}

/**
 * 设置嵌套字段值
 * @param {object} obj - 对象
 * @param {string} fieldPath - 字段路径 (如 'plugins[0].version')
 * @param {*} value - 新值
 */
function setNestedValue(obj, fieldPath, value) {
  const parts = fieldPath.replace(/\[(\d+)\]/g, '.$1').split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

/**
 * 读取所有版本
 * @returns {Array<{path: string, version: string|null, exists: boolean}>}
 */
function readAllVersions() {
  return VERSION_FILES.map(({ path: filePath, field, nested }) => {
    const data = readJsonFile(filePath);
    const version = data
      ? (nested ? getNestedValue(data, field) : data[field])
      : null;
    return {
      path: filePath,
      version,
      exists: data !== null
    };
  });
}

/**
 * 检查版本一致性
 * @returns {{consistent: boolean, versions: Array, message: string}}
 */
function checkConsistency() {
  const versions = readAllVersions();
  const existingVersions = versions.filter(v => v.exists);

  if (existingVersions.length === 0) {
    return {
      consistent: false,
      versions,
      message: 'No version files found'
    };
  }

  const uniqueVersions = [...new Set(existingVersions.map(v => v.version))];
  const consistent = uniqueVersions.length === 1;

  return {
    consistent,
    versions,
    currentVersion: consistent ? uniqueVersions[0] : null,
    message: consistent
      ? `All versions are consistent: ${uniqueVersions[0]}`
      : `Version mismatch detected: ${uniqueVersions.join(', ')}`
  };
}

/**
 * 更新所有版本文件
 * @param {string} newVersion - 新版本
 * @param {object} options - 选项
 * @returns {{success: boolean, updated: Array, errors: Array}}
 */
function updateAllVersions(newVersion, options = {}) {
  const { dryRun = false } = options;
  const updated = [];
  const errors = [];

  for (const { path: filePath, field, nested } of VERSION_FILES) {
    const data = readJsonFile(filePath);

    if (!data) {
      errors.push({ path: filePath, error: 'File not found or invalid JSON' });
      continue;
    }

    const oldVersion = nested ? getNestedValue(data, field) : data[field];

    if (nested) {
      setNestedValue(data, field, newVersion);
    } else {
      data[field] = newVersion;
    }

    if (!dryRun) {
      try {
        writeJsonFile(filePath, data);
        updated.push({ path: filePath, oldVersion, newVersion });
      } catch (error) {
        errors.push({ path: filePath, error: error.message });
      }
    } else {
      updated.push({ path: filePath, oldVersion, newVersion, dryRun: true });
    }
  }

  return {
    success: errors.length === 0,
    updated,
    errors
  };
}

/**
 * 打印版本状态
 * @param {Array} versions - 版本列表
 */
function printVersionStatus(versions) {
  console.log('\n📦 Version Files Status:\n');

  const maxPathLen = Math.max(...versions.map(v => v.path.length));

  for (const { path: filePath, version, exists } of versions) {
    const paddedPath = filePath.padEnd(maxPathLen);
    if (!exists) {
      console.log(`  ${colors.red('✗')} ${paddedPath}  ${colors.gray('(not found)')}`);
    } else {
      console.log(`  ${colors.green('✓')} ${paddedPath}  ${colors.blue(version)}`);
    }
  }
  console.log();
}

/**
 * 主函数
 */
function main() {
  const args = process.argv.slice(2);

  // 解析参数
  const dryRun = args.includes('--dry-run');
  const checkOnly = args.includes('--check');
  const incrementPatch = args.includes('--patch');
  const incrementMinor = args.includes('--minor');
  const incrementMajor = args.includes('--major');

  // 获取版本参数
  const versionArg = args.find(arg => !arg.startsWith('--'));

  // 检查模式
  if (checkOnly) {
    const result = checkConsistency();
    printVersionStatus(result.versions);

    if (result.consistent) {
      console.log(colors.green(`✓ ${result.message}`));
      process.exit(0);
    } else {
      console.log(colors.red(`✗ ${result.message}`));
      process.exit(1);
    }
  }

  // 确定新版本
  let newVersion;

  if (versionArg) {
    // 移除 'v' 前缀（如果有）
    newVersion = versionArg.replace(/^v/, '');

    if (!validateSemver(newVersion)) {
      console.error(colors.red(`✗ Invalid semver format: ${versionArg}`));
      console.error('  Expected format: x.y.z (e.g., 2.1.0)');
      process.exit(1);
    }
  } else if (incrementPatch || incrementMinor || incrementMajor) {
    const result = checkConsistency();

    if (!result.consistent) {
      console.error(colors.red('✗ Cannot increment: versions are not consistent'));
      printVersionStatus(result.versions);
      console.error('  Please sync versions first using: node scripts/bump-version.js <version>');
      process.exit(1);
    }

    const type = incrementMajor ? 'major' : incrementMinor ? 'minor' : 'patch';
    newVersion = incrementVersion(result.currentVersion, type);
    console.log(`Incrementing ${type}: ${result.currentVersion} → ${newVersion}`);
  } else {
    // 无参数，显示帮助
    console.log(`
bump-version.js - Version sync tool

Usage:
  node scripts/bump-version.js --check           Check version consistency
  node scripts/bump-version.js <version>         Sync all files to version
  node scripts/bump-version.js --patch           Increment patch version
  node scripts/bump-version.js --minor           Increment minor version
  node scripts/bump-version.js --major           Increment major version

Options:
  --dry-run    Preview changes without modifying files
  --check      Only check consistency, don't modify

Examples:
  node scripts/bump-version.js 2.1.0
  node scripts/bump-version.js v2.1.0 --dry-run
  node scripts/bump-version.js --patch
`);

    // 显示当前状态
    const result = checkConsistency();
    printVersionStatus(result.versions);
    process.exit(0);
  }

  // 执行更新
  console.log(`\n${dryRun ? '🔍 Preview' : '🔄 Updating'} versions to ${colors.blue(newVersion)}...\n`);

  const result = updateAllVersions(newVersion, { dryRun });

  for (const { path: filePath, oldVersion, newVersion: nv } of result.updated) {
    const action = dryRun ? 'would update' : 'updated';
    console.log(`  ${colors.green('✓')} ${filePath}: ${colors.gray(oldVersion)} → ${colors.blue(nv)}`);
  }

  for (const { path: filePath, error } of result.errors) {
    console.log(`  ${colors.red('✗')} ${filePath}: ${error}`);
  }

  console.log();

  if (result.success) {
    if (dryRun) {
      console.log(colors.yellow('ℹ Dry run complete. No files were modified.'));
    } else {
      console.log(colors.green(`✓ All versions updated to ${newVersion}`));
    }
    process.exit(0);
  } else {
    console.log(colors.red('✗ Some updates failed'));
    process.exit(1);
  }
}

// 导出函数供测试使用
module.exports = {
  validateSemver,
  parseSemver,
  incrementVersion,
  getNestedValue,
  setNestedValue,
  readAllVersions,
  checkConsistency,
  updateAllVersions,
  VERSION_FILES
};

// 如果直接运行
if (require.main === module) {
  main();
}
