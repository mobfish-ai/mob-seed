#!/usr/bin/env node
/**
 * SEED 项目初始化脚本
 *
 * 强制执行完整的初始化流程，确保所有必需文件都被创建。
 *
 * @module scripts/init-project
 * @usage node skills/mob-seed/scripts/init-project.js [project-root] [--force]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 导入检测脚本
const { detectProjectStructure, generateConfig, generateProjectMd } = require('./detect-project');

// ============================================================================
// 常量定义
// ============================================================================

const REQUIRED_FILES = [
  '.seed/config.json',
  '.seed/mission.md',
  '.seed/observations/index.json',
  'openspec/specs/.gitkeep',
  'openspec/changes/.gitkeep',
  'openspec/project.md',
  'openspec/AGENTS.md'
];

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 解析技能目录路径
 * @returns {string|null} 技能目录路径
 */
function resolveSkillDir() {
  const homeDir = process.env.HOME || process.env.USERPROFILE;

  // 按优先级检测
  const candidates = [
    // 1. Plugin marketplace（最常见）
    path.join(homeDir, '.claude/plugins/marketplaces/mobfish-ai/skills/mob-seed'),
    // 2. 开发模式（当前项目是 mob-seed 本身）
    path.join(process.cwd(), 'skills/mob-seed'),
    // 3. 用户全局技能
    path.join(homeDir, '.claude/skills/mob-seed'),
    // 4. 项目本地技能
    path.join(process.cwd(), '.claude/skills/mob-seed')
  ];

  // 2. Plugin cache（查找最新版本）
  const cacheDir = path.join(homeDir, '.claude/plugins/cache/mobfish-ai/mob-seed');
  if (fs.existsSync(cacheDir)) {
    try {
      const versions = fs.readdirSync(cacheDir)
        .filter(v => /^\d+\.\d+\.\d+/.test(v))
        .sort((a, b) => {
          const [aMajor, aMinor, aPatch] = a.split('.').map(Number);
          const [bMajor, bMinor, bPatch] = b.split('.').map(Number);
          return bMajor - aMajor || bMinor - aMinor || bPatch - aPatch;
        });

      if (versions.length > 0) {
        const cachePath = path.join(cacheDir, versions[0], 'skills/mob-seed');
        candidates.splice(1, 0, cachePath); // 插入到第二优先级
      }
    } catch (err) {
      // 忽略错误
    }
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.existsSync(path.join(candidate, 'templates'))) {
      return candidate;
    }
  }

  return null;
}

/**
 * 确保目录存在
 * @param {string} dirPath - 目录路径
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 复制文件
 * @param {string} src - 源文件
 * @param {string} dest - 目标文件
 * @param {Object} replacements - 替换映射
 */
function copyFileWithReplacements(src, dest, replacements = {}) {
  let content = fs.readFileSync(src, 'utf8');

  for (const [key, value] of Object.entries(replacements)) {
    content = content.replace(new RegExp(key, 'g'), value);
  }

  ensureDir(path.dirname(dest));
  fs.writeFileSync(dest, content, 'utf8');
}

/**
 * 创建 .gitkeep 文件
 * @param {string} dirPath - 目录路径
 */
function createGitkeep(dirPath) {
  ensureDir(dirPath);
  const gitkeepPath = path.join(dirPath, '.gitkeep');
  if (!fs.existsSync(gitkeepPath)) {
    fs.writeFileSync(gitkeepPath, '', 'utf8');
  }
}

// ============================================================================
// 初始化步骤
// ============================================================================

/**
 * 步骤 1: 创建 OpenSpec 目录结构
 * @param {string} projectRoot - 项目根目录
 * @param {string} skillDir - 技能目录
 * @param {Object} detected - 检测结果
 * @param {Object} options - 选项
 */
function step1CreateOpenSpecStructure(projectRoot, skillDir, detected, options) {
  console.log('\n📁 步骤 1: 创建 OpenSpec 目录结构...');

  const openspecDir = path.join(projectRoot, 'openspec');

  // 创建目录
  createGitkeep(path.join(openspecDir, 'specs'));
  createGitkeep(path.join(openspecDir, 'changes'));

  // 复制 AGENTS.md
  const agentsSrc = path.join(skillDir, 'templates/openspec/AGENTS.md');
  const agentsDest = path.join(openspecDir, 'AGENTS.md');
  if (fs.existsSync(agentsSrc)) {
    copyFileWithReplacements(agentsSrc, agentsDest, {});
    console.log('   ✓ openspec/AGENTS.md');
  } else {
    console.log('   ⚠️  模板不存在: templates/openspec/AGENTS.md');
  }

  // 生成 project.md
  const projectMd = generateProjectMd(detected);
  fs.writeFileSync(path.join(openspecDir, 'project.md'), projectMd, 'utf8');
  console.log('   ✓ openspec/project.md');

  console.log('   ✓ openspec/specs/');
  console.log('   ✓ openspec/changes/');
}

/**
 * 步骤 2: 创建 .seed 配置目录
 * @param {string} projectRoot - 项目根目录
 * @param {string} skillDir - 技能目录
 * @param {Object} detected - 检测结果
 * @param {Object} options - 选项
 */
function step2CreateSeedConfig(projectRoot, skillDir, detected, options) {
  console.log('\n⚙️  步骤 2: 创建 .seed 配置...');

  const seedDir = path.join(projectRoot, '.seed');
  ensureDir(seedDir);

  // 生成 config.json
  const config = generateConfig(detected);
  fs.writeFileSync(
    path.join(seedDir, 'config.json'),
    JSON.stringify(config, null, 2),
    'utf8'
  );
  console.log('   ✓ .seed/config.json');

  // 复制 mission.md（关键步骤！）
  const missionSrc = path.join(skillDir, 'templates/openspec/mission.md');
  const missionDest = path.join(seedDir, 'mission.md');

  if (fs.existsSync(missionSrc)) {
    const timestamp = new Date().toISOString();
    copyFileWithReplacements(missionSrc, missionDest, {
      '{{TIMESTAMP}}': timestamp
    });
    console.log('   ✓ .seed/mission.md (从模板创建)');
  } else {
    // 如果模板不存在，创建基本的 mission 文件
    console.log('   ⚠️  模板不存在: templates/openspec/mission.md');
    console.log('   → 创建基本 mission.md...');

    const basicMission = createBasicMission(detected.projectInfo);
    fs.writeFileSync(missionDest, basicMission, 'utf8');
    console.log('   ✓ .seed/mission.md (基本版本)');
  }
}

/**
 * 创建基本的 mission 文件
 * @param {Object} projectInfo - 项目信息
 * @returns {string} mission 内容
 */
function createBasicMission(projectInfo) {
  return `---
# PROJECT MISSION STATEMENT
# Created: ${new Date().toISOString()}
# ============================================================================

purpose:
  statement:
    en: |
      ${projectInfo.description || '[Define your project core mission]'}
    zh: |
      ${projectInfo.description || '[定义项目核心使命]'}

principles:
  - id: quality_first
    name:
      en: Quality First
      zh: 质量优先
    description:
      en: Write code that is correct, readable, and maintainable.
      zh: 编写正确、可读、可维护的代码。

  - id: simplicity_over_cleverness
    name:
      en: Simplicity Over Cleverness
      zh: 简单胜于聪明
    description:
      en: Simple solutions are easier for humans and AI to understand.
      zh: 简单的方案更容易被人类和 AI 理解。

anti_goals:
  - id: feature_creep
    name:
      en: Feature Creep
      zh: 功能蔓延
    description:
      en: Never add features not defined in specs.
      zh: 不添加规格未定义的功能。

  - id: over_engineering
    name:
      en: Over Engineering
      zh: 过度工程
    description:
      en: Never design for hypothetical future needs. YAGNI.
      zh: 不为假设的未来需求设计。YAGNI。

evolution:
  allowed_scopes:
    - id: document
      auto_apply: true
    - id: test
      auto_apply: true
    - id: refactor
      auto_apply: false
    - id: fix
      auto_apply: false

  decision_criteria:
    min_alignment_score: 0.7

---

# Project Mission

> Edit this file to define your project's mission, principles, and evolution rules.

## How to Use

1. **Purpose**: Define why this project exists
2. **Principles**: List 3-5 core principles that guide development
3. **Anti-Goals**: Define what the project will never do
4. **Evolution**: Configure how changes are evaluated

## Next Steps

1. Replace placeholder text with your project's actual mission
2. Customize principles based on your team's values
3. Add project-specific anti-goals
4. Run \`/mob-seed:defend\` to validate alignment
`;
}

/**
 * 步骤 3: 创建 ACE 观察目录
 * @param {string} projectRoot - 项目根目录
 * @param {Object} options - 选项
 */
function step3CreateACEStructure(projectRoot, options) {
  console.log('\n🧠 步骤 3: 创建 ACE 自演化目录...');

  const observationsDir = path.join(projectRoot, '.seed/observations');
  ensureDir(observationsDir);

  // 创建 observations/index.json
  const indexPath = path.join(observationsDir, 'index.json');
  if (!fs.existsSync(indexPath)) {
    const index = {
      version: '1.0.0',
      created: new Date().toISOString(),
      observations: []
    };
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
  }
  console.log('   ✓ .seed/observations/index.json');
}

/**
 * 步骤 4: 安装 Git Hooks（可选）
 * @param {string} projectRoot - 项目根目录
 * @param {string} skillDir - 技能目录
 * @param {Object} options - 选项
 */
function step4InstallGitHooks(projectRoot, skillDir, options) {
  console.log('\n🔗 步骤 4: 安装 Git Hooks...');

  const gitDir = path.join(projectRoot, '.git');

  // 检查是否是 Git 仓库
  if (!fs.existsSync(gitDir)) {
    console.log('   ℹ️  非 Git 仓库，跳过 hooks 安装');
    return;
  }

  // 检查是否是 mob-seed 项目本身（dogfooding 模式）
  if (fs.existsSync(path.join(projectRoot, 'skills/mob-seed/lib/hooks'))) {
    console.log('   ℹ️  检测到 mob-seed 项目（dogfooding 模式）');
    console.log('   → 请手动安装: cp skills/mob-seed/hooks/* .git/hooks/');
    return;
  }

  const hooksDir = path.join(gitDir, 'hooks');
  ensureDir(hooksDir);

  const hooks = ['pre-commit', 'pre-push'];

  for (const hook of hooks) {
    const srcHook = path.join(skillDir, 'hooks', hook);
    const destHook = path.join(hooksDir, hook);

    if (fs.existsSync(srcHook)) {
      // 检查是否已存在
      if (fs.existsSync(destHook) && !options.force) {
        // 检查是否已包含 SEED 检查
        const content = fs.readFileSync(destHook, 'utf8');
        if (content.includes('.seed/config.json')) {
          console.log(`   ℹ️  ${hook} 已包含 SEED 检查，跳过`);
          continue;
        }
        console.log(`   ⚠️  ${hook} 已存在，使用 --force 覆盖`);
        continue;
      }

      fs.copyFileSync(srcHook, destHook);
      fs.chmodSync(destHook, '755');
      console.log(`   ✓ .git/hooks/${hook}`);
    }
  }
}

/**
 * 步骤 5: 验证初始化结果
 * @param {string} projectRoot - 项目根目录
 * @returns {Object} 验证结果
 */
function step5Verify(projectRoot) {
  console.log('\n✅ 步骤 5: 验证初始化结果...');

  const results = {
    success: true,
    created: [],
    missing: []
  };

  for (const file of REQUIRED_FILES) {
    const filePath = path.join(projectRoot, file);
    if (fs.existsSync(filePath)) {
      results.created.push(file);
    } else {
      results.missing.push(file);
      results.success = false;
    }
  }

  if (results.success) {
    console.log('   ✅ 所有必需文件已创建');
  } else {
    console.log('   ❌ 以下文件缺失:');
    results.missing.forEach(f => console.log(`      - ${f}`));
  }

  return results;
}

// ============================================================================
// 主函数
// ============================================================================

/**
 * 执行初始化
 * @param {string} projectRoot - 项目根目录
 * @param {Object} options - 选项
 * @returns {Object} 初始化结果
 */
function initProject(projectRoot, options = {}) {
  const results = {
    success: false,
    skillDir: null,
    detected: null,
    files: [],
    errors: []
  };

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🌱 SEED 项目初始化');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`📂 项目目录: ${projectRoot}`);

  // 检查已初始化
  const configPath = path.join(projectRoot, '.seed/config.json');
  if (fs.existsSync(configPath) && !options.force) {
    console.log('\n⚠️  项目已初始化');
    console.log('   使用 --force 重新初始化');
    results.errors.push('已初始化，使用 --force 重新初始化');
    return results;
  }

  // 解析技能目录
  const skillDir = resolveSkillDir();
  if (!skillDir) {
    console.log('\n❌ 错误: 未找到 mob-seed 技能目录');
    console.log('   请确保已通过 plugin 或 skill 安装 mob-seed');
    results.errors.push('未找到技能目录');
    return results;
  }

  results.skillDir = skillDir;
  console.log(`🔧 技能目录: ${skillDir}`);

  // 检测项目结构
  console.log('\n🔍 检测项目结构...');
  const detected = detectProjectStructure(projectRoot);
  results.detected = detected;

  console.log(`   项目名称: ${detected.projectInfo.name}`);
  console.log(`   源码目录: ${detected.paths.src}`);
  console.log(`   测试目录: ${detected.paths.test}`);

  // 执行初始化步骤
  try {
    step1CreateOpenSpecStructure(projectRoot, skillDir, detected, options);
    step2CreateSeedConfig(projectRoot, skillDir, detected, options);
    step3CreateACEStructure(projectRoot, options);
    step4InstallGitHooks(projectRoot, skillDir, options);

    const verification = step5Verify(projectRoot);
    results.files = verification.created;
    results.success = verification.success;

  } catch (err) {
    console.log(`\n❌ 错误: ${err.message}`);
    results.errors.push(err.message);
    return results;
  }

  // 输出完成信息
  console.log('\n═══════════════════════════════════════════════════════════════');

  if (results.success) {
    console.log('✅ SEED 初始化完成！');
    console.log('');
    console.log('📁 已创建目录结构:');
    console.log('');
    console.log('openspec/');
    console.log('├── specs/          # 真相源（已实现的规格）');
    console.log('├── changes/        # 变更提案（开发中的规格）');
    console.log('├── project.md      # 项目约定');
    console.log('└── AGENTS.md       # AI 工作流');
    console.log('');
    console.log('.seed/');
    console.log('├── config.json     # SEED 配置');
    console.log('├── mission.md      # 项目使命声明 ⭐');
    console.log('└── observations/   # ACE 观察目录');
    console.log('');
    console.log('💡 下一步:');
    console.log('   1. 编辑 .seed/mission.md 定义项目使命和原则');
    console.log('   2. 检查 openspec/project.md（已自动填充基本信息）');
    console.log('   3. 创建规格提案: /mob-seed:spec "feature-name"');
    console.log('   4. 查看状态: /mob-seed');
  } else {
    console.log('⚠️  初始化完成，但有文件缺失');
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
  const options = {
    force: args.includes('--force') || args.includes('-f'),
    json: args.includes('--json')
  };

  const results = initProject(projectRoot, options);

  // JSON 输出模式
  if (options.json) {
    console.log('\n' + JSON.stringify(results, null, 2));
  }

  // 退出码
  process.exit(results.success ? 0 : 1);
}

// 如果直接执行
if (require.main === module) {
  main();
}

// 导出函数
module.exports = {
  initProject,
  resolveSkillDir,
  REQUIRED_FILES
};
