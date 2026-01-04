#!/usr/bin/env node
/**
 * resolve-skill-path.js - 解析 mob-seed 技能路径
 *
 * 用途：统一解析 mob-seed 技能目录的位置
 *
 * 安装方式优先级（从高到低）：
 * 1. Plugin marketplace: ~/.claude/plugins/marketplaces/mobfish-ai/
 * 2. Plugin cache: ~/.claude/plugins/cache/mobfish-ai/mob-seed/{version}/
 * 3. User skills: ~/.claude/skills/mob-seed/
 * 4. Project local: .claude/skills/mob-seed/
 *
 * 用法：
 *   node resolve-skill-path.js              # 输出技能目录路径
 *   node resolve-skill-path.js --json       # 输出 JSON 格式
 *   node resolve-skill-path.js --check      # 检查并输出诊断信息
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// 路径优先级定义
const SEARCH_PATHS = [
  // 1. Plugin marketplace (最常见的安装方式)
  {
    name: 'plugin-marketplace',
    path: path.join(os.homedir(), '.claude/plugins/marketplaces/mobfish-ai'),
    description: 'Plugin marketplace 安装'
  },
  // 2. Plugin cache (版本化缓存)
  {
    name: 'plugin-cache',
    path: path.join(os.homedir(), '.claude/plugins/cache/mobfish-ai'),
    description: 'Plugin cache',
    isVersioned: true
  },
  // 3. User global skills
  {
    name: 'user-skills',
    path: path.join(os.homedir(), '.claude/skills/mob-seed'),
    description: '用户全局技能目录'
  },
  // 4. Project local skills
  {
    name: 'project-skills',
    path: '.claude/skills/mob-seed',
    description: '项目本地技能目录',
    isRelative: true
  }
];

/**
 * 查找最新版本目录（用于 plugin-cache）
 */
function findLatestVersion(basePath) {
  if (!fs.existsSync(basePath)) return null;

  const entries = fs.readdirSync(basePath);
  const mobSeedDir = entries.find(e => e === 'mob-seed');

  if (!mobSeedDir) return null;

  const mobSeedPath = path.join(basePath, 'mob-seed');
  const versions = fs.readdirSync(mobSeedPath)
    .filter(v => /^\d+\.\d+\.\d+$/.test(v))
    .sort((a, b) => {
      const [aMajor, aMinor, aPatch] = a.split('.').map(Number);
      const [bMajor, bMinor, bPatch] = b.split('.').map(Number);
      if (aMajor !== bMajor) return bMajor - aMajor;
      if (aMinor !== bMinor) return bMinor - aMinor;
      return bPatch - aPatch;
    });

  if (versions.length === 0) return null;

  return path.join(mobSeedPath, versions[0]);
}

/**
 * 验证路径是否是有效的 mob-seed 技能目录
 */
function isValidSkillDir(skillPath) {
  // 检查关键文件/目录是否存在
  const requiredPaths = [
    'skills/mob-seed/lib',
    'skills/mob-seed/scripts',
    'skills/mob-seed/templates'
  ];

  // 某些路径可能直接是 skills/mob-seed 目录
  const altRequiredPaths = [
    'lib',
    'scripts',
    'templates'
  ];

  // 尝试第一种结构
  const hasFullStructure = requiredPaths.every(p =>
    fs.existsSync(path.join(skillPath, p))
  );

  if (hasFullStructure) return { valid: true, skillSubdir: 'skills/mob-seed' };

  // 尝试第二种结构（直接是 mob-seed 目录）
  const hasDirectStructure = altRequiredPaths.every(p =>
    fs.existsSync(path.join(skillPath, p))
  );

  if (hasDirectStructure) return { valid: true, skillSubdir: '' };

  return { valid: false };
}

/**
 * 解析技能路径
 */
function resolveSkillPath(cwd = process.cwd()) {
  for (const searchPath of SEARCH_PATHS) {
    let candidatePath;

    if (searchPath.isRelative) {
      candidatePath = path.resolve(cwd, searchPath.path);
    } else if (searchPath.isVersioned) {
      candidatePath = findLatestVersion(searchPath.path);
      if (!candidatePath) continue;
    } else {
      candidatePath = searchPath.path;
    }

    if (!fs.existsSync(candidatePath)) continue;

    const validation = isValidSkillDir(candidatePath);
    if (validation.valid) {
      const fullPath = validation.skillSubdir
        ? path.join(candidatePath, validation.skillSubdir)
        : candidatePath;

      return {
        found: true,
        source: searchPath.name,
        description: searchPath.description,
        basePath: candidatePath,
        skillPath: fullPath,
        version: getVersion(fullPath)
      };
    }
  }

  return {
    found: false,
    error: 'mob-seed 技能目录未找到',
    searchedPaths: SEARCH_PATHS.map(p => ({
      name: p.name,
      path: p.isRelative ? path.resolve(cwd, p.path) : p.path
    }))
  };
}

/**
 * 获取版本号
 */
function getVersion(skillPath) {
  const pkgPath = path.join(skillPath, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      return pkg.version || 'unknown';
    } catch {
      return 'unknown';
    }
  }
  return 'unknown';
}

// CLI 入口
function main() {
  const args = process.argv.slice(2);
  const result = resolveSkillPath();

  if (args.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.found ? 0 : 1);
  }

  if (args.includes('--check')) {
    console.log('🔍 mob-seed 技能路径解析诊断\n');
    console.log('搜索优先级:');
    SEARCH_PATHS.forEach((p, i) => {
      const fullPath = p.isRelative ? path.resolve(process.cwd(), p.path) : p.path;
      const exists = fs.existsSync(fullPath);
      console.log(`  ${i + 1}. [${exists ? '✓' : '✗'}] ${p.name}: ${fullPath}`);
    });
    console.log('');

    if (result.found) {
      console.log(`✅ 找到技能目录:`);
      console.log(`   来源: ${result.description}`);
      console.log(`   路径: ${result.skillPath}`);
      console.log(`   版本: ${result.version}`);
    } else {
      console.log(`❌ ${result.error}`);
    }
    process.exit(result.found ? 0 : 1);
  }

  // 默认输出：只输出路径
  if (result.found) {
    console.log(result.skillPath);
    process.exit(0);
  } else {
    console.error(result.error);
    process.exit(1);
  }
}

// 支持作为模块导入
module.exports = { resolveSkillPath, SEARCH_PATHS };

// 直接运行
if (require.main === module) {
  main();
}
