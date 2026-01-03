#!/usr/bin/env node
/**
 * 项目结构智能检测脚本
 * 用于 /mob-seed:init 命令，自动检测项目目录结构和配置
 *
 * @module scripts/detect-project
 * @usage node skills/mob-seed/scripts/detect-project.js [project-root]
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// 目录检测候选列表
// ============================================================================

const PATH_CANDIDATES = {
  src: ['src', 'lib', 'server', 'app', 'source', 'code'],
  test: ['test', 'tests', '__tests__', 'spec', 'specs'],
  docs: ['docs', 'documentation', 'doc', 'documents']
};

// ============================================================================
// 智能检测函数
// ============================================================================

/**
 * 检测项目目录结构
 * @param {string} projectRoot - 项目根目录
 * @returns {Object} 检测结果
 */
function detectProjectStructure(projectRoot) {
  const detected = {
    paths: {},
    projectInfo: {},
    techStack: {},
    warnings: []
  };

  // 1. 检测目录路径
  for (const [key, candidates] of Object.entries(PATH_CANDIDATES)) {
    const found = candidates.find(candidate => {
      const fullPath = path.join(projectRoot, candidate);
      return fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();
    });

    if (found) {
      detected.paths[key] = found;
    } else {
      detected.warnings.push(`⚠️  未找到 ${key} 目录，将使用默认值: ${candidates[0]}`);
      detected.paths[key] = candidates[0]; // 使用第一个作为默认值
    }
  }

  // 2. 从 package.json 提取项目信息
  const pkgPath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      detected.projectInfo = {
        name: pkg.name || 'my-project',
        description: pkg.description || 'A new project',
        version: pkg.version || '0.1.0',
        license: pkg.license || 'MIT',
        repository: pkg.repository?.url || pkg.repository || '',
        author: pkg.author || '',
        homepage: pkg.homepage || ''
      };

      // 检测技术栈
      detected.techStack = detectTechStack(pkg);
    } catch (err) {
      detected.warnings.push(`⚠️  读取 package.json 失败: ${err.message}`);
    }
  } else {
    detected.warnings.push('⚠️  未找到 package.json，将使用默认项目信息');
    detected.projectInfo = {
      name: 'my-project',
      description: 'A new project',
      version: '0.1.0'
    };
  }

  // 3. 固定路径
  detected.paths.specs = 'openspec/specs';
  detected.paths.output = '.seed/output';

  return detected;
}

/**
 * 检测技术栈
 * @param {Object} pkg - package.json 内容
 * @returns {Object} 技术栈信息
 */
function detectTechStack(pkg) {
  const allDeps = {
    ...pkg.dependencies || {},
    ...pkg.devDependencies || {}
  };

  const stack = {
    language: 'JavaScript', // 默认
    runtime: '',
    framework: '',
    testing: '',
    build: ''
  };

  // 检测语言
  if (allDeps.typescript || pkg.devDependencies?.typescript) {
    stack.language = 'TypeScript';
  }

  // 检测运行时
  if (pkg.engines?.node) {
    stack.runtime = `Node.js ${pkg.engines.node}`;
  } else {
    stack.runtime = 'Node.js';
  }

  // 检测框架
  const frameworks = {
    'express': 'Express',
    'koa': 'Koa',
    'fastify': 'Fastify',
    'vue': 'Vue.js',
    'react': 'React',
    'next': 'Next.js',
    'nuxt': 'Nuxt.js',
    '@nestjs/core': 'NestJS'
  };

  for (const [dep, name] of Object.entries(frameworks)) {
    if (allDeps[dep]) {
      stack.framework = `${name} ${allDeps[dep]}`;
      break;
    }
  }

  // 检测测试框架
  const testFrameworks = {
    'jest': 'Jest',
    'vitest': 'Vitest',
    'mocha': 'Mocha',
    '@playwright/test': 'Playwright',
    'cypress': 'Cypress'
  };

  for (const [dep, name] of Object.entries(testFrameworks)) {
    if (allDeps[dep]) {
      stack.testing = `${name} ${allDeps[dep]}`;
      break;
    }
  }

  // 检测构建工具
  const buildTools = {
    'vite': 'Vite',
    'webpack': 'Webpack',
    'esbuild': 'esbuild',
    'rollup': 'Rollup',
    '@parcel/core': 'Parcel'
  };

  for (const [dep, name] of Object.entries(buildTools)) {
    if (allDeps[dep]) {
      stack.build = `${name} ${allDeps[dep]}`;
      break;
    }
  }

  return stack;
}

/**
 * 生成 .seed/config.json 配置
 * @param {Object} detected - 检测结果
 * @returns {Object} 配置对象
 */
function generateConfig(detected) {
  return {
    version: "2.0.0",
    created: new Date().toISOString(),
    updated: new Date().toISOString(),

    openspec: {
      enabled: true,
      root: "openspec",
      specsDir: "specs",
      changesDir: "changes"
    },

    mission: {
      enabled: true,
      path: ".seed/mission.md",
      language: "en"
    },

    paths: {
      specs: detected.paths.specs,
      src: detected.paths.src,
      test: detected.paths.test,
      docs: detected.paths.docs,
      output: detected.paths.output
    },

    patterns: {
      spec: "*.fspec.md",
      code: "*.js",
      test: "*.test.js"
    },

    emit: {
      codeTemplate: "skeleton",
      testTemplate: "jest",
      docTemplate: "markdown"
    },

    sync: {
      autoBackup: true,
      defaultDirection: "spec"
    },

    ace: {
      enabled: true,
      reflect: {
        thresholds: {
          same_type: 3,
          same_spec: 2,
          time_window: "24h"
        }
      }
    }
  };
}

/**
 * 生成 openspec/project.md 内容
 * @param {Object} detected - 检测结果
 * @returns {string} project.md 内容
 */
function generateProjectMd(detected) {
  const { projectInfo, techStack, paths } = detected;

  return `# ${projectInfo.name}

> 本文件定义项目的基本约定，供 AI 工具和团队成员参考。
> 文件位置: \`openspec/project.md\`

---

## 项目概述

### 名称
${projectInfo.name}

### 描述
${projectInfo.description}

### 仓库
${projectInfo.repository || '(未配置)'}

---

## 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 语言 | ${techStack.language} | - |
| 运行时 | ${techStack.runtime || '(未检测到)'} | - |
| 框架 | ${techStack.framework || '(未检测到)'} | - |
| 测试 | ${techStack.testing || '(未检测到)'} | - |
| 构建 | ${techStack.build || '(未检测到)'} | - |

---

## 目录结构

\`\`\`
${projectInfo.name}/
├── openspec/               # OpenSpec 规格目录
│   ├── specs/              # 真相源（已实现的规格）
│   ├── changes/            # 变更提案（开发中的规格）
│   └── project.md          # 本文件
├── ${paths.src}/           # 源代码
│   └── ...
├── ${paths.test}/          # 测试代码
│   └── ...
└── ${paths.docs}/          # 文档
    └── ...
\`\`\`

---

## 开发规范

### 代码风格
- 使用 ESLint/Prettier 进行代码检查
- 提交前运行: \`npm run lint\`

### 提交规范
- 使用约定式提交 (Conventional Commits)
- 格式: \`{type}({scope}): {description}\`
- 类型: feat, fix, docs, refactor, test, chore

### 分支策略
- 主分支: \`main\`
- 功能分支: \`feature/{feature-name}\`
- 修复分支: \`fix/{issue-id}\`

---

## 命令参考

| 命令 | 说明 |
|------|------|
| \`npm run dev\` | 启动开发服务器 |
| \`npm run build\` | 构建生产版本 |
| \`npm run test\` | 运行测试 |
| \`npm run lint\` | 代码检查 |

---

## 联系方式

- 维护者: ${projectInfo.author || '(待填写)'}
- Issue: ${projectInfo.repository?.replace(/\.git$/, '') + '/issues' || '(待配置)'}

---

## 变更记录

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| ${projectInfo.version} | ${new Date().toISOString().split('T')[0]} | 初始版本 |
`;
}

// ============================================================================
// CLI 接口
// ============================================================================

function main() {
  const projectRoot = process.argv[2] || process.cwd();

  console.log(`🔍 检测项目结构: ${projectRoot}\n`);

  const detected = detectProjectStructure(projectRoot);

  // 输出检测结果
  console.log('📂 检测到的目录路径:');
  Object.entries(detected.paths).forEach(([key, value]) => {
    console.log(`   ${key}: ${value}`);
  });

  console.log('\n📦 项目信息:');
  console.log(`   名称: ${detected.projectInfo.name}`);
  console.log(`   描述: ${detected.projectInfo.description}`);
  console.log(`   版本: ${detected.projectInfo.version}`);

  console.log('\n🛠️  技术栈:');
  Object.entries(detected.techStack).forEach(([key, value]) => {
    if (value) {
      console.log(`   ${key}: ${value}`);
    }
  });

  // 输出警告
  if (detected.warnings.length > 0) {
    console.log('\n⚠️  警告:');
    detected.warnings.forEach(w => console.log(`   ${w}`));
  }

  // 输出 JSON 格式（供其他脚本使用）
  if (process.argv.includes('--json')) {
    console.log('\n' + JSON.stringify(detected, null, 2));
  }

  // 生成配置文件（如果指定）
  if (process.argv.includes('--config')) {
    const config = generateConfig(detected);
    console.log('\n📝 生成的配置:\n');
    console.log(JSON.stringify(config, null, 2));
  }

  // 生成 project.md（如果指定）
  if (process.argv.includes('--project-md')) {
    const projectMd = generateProjectMd(detected);
    console.log('\n📝 生成的 project.md:\n');
    console.log(projectMd);
  }

  console.log('\n✅ 检测完成');
}

// 如果直接执行
if (require.main === module) {
  main();
}

// 导出函数供其他模块使用
module.exports = {
  detectProjectStructure,
  detectTechStack,
  generateConfig,
  generateProjectMd
};
