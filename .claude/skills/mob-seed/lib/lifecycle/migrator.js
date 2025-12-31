/**
 * OpenSpec 迁移逻辑
 * @module lifecycle/migrator
 * @see docs/plans/SEED-OPENSPEC-COMPAT.md
 */

const fs = require('fs');
const path = require('path');
const { parseMetadata, parseTitle } = require('./parser');

/**
 * 迁移结果
 * @typedef {Object} MigrationResult
 * @property {boolean} success - 是否成功
 * @property {Array<{from: string, to: string}>} migrations - 迁移记录
 * @property {string} backupPath - 备份路径
 * @property {string[]} errors - 错误列表
 * @property {string[]} warnings - 警告列表
 */

/**
 * 迁移前检查结果
 * @typedef {Object} MigrationPreCheck
 * @property {boolean} canMigrate - 是否可迁移
 * @property {boolean} specsExists - specs/ 是否存在
 * @property {boolean} openspecExists - openspec/ 是否已存在
 * @property {number} specCount - 规格文件数量
 * @property {string[]} issues - 问题列表
 */

/**
 * 检查迁移前置条件
 * @param {string} projectRoot - 项目根目录
 * @returns {MigrationPreCheck} 检查结果
 */
function checkMigrationPreConditions(projectRoot) {
  const result = {
    canMigrate: true,
    specsExists: false,
    openspecExists: false,
    specCount: 0,
    issues: []
  };

  const specsDir = path.join(projectRoot, 'specs');
  const openspecDir = path.join(projectRoot, 'openspec');

  // 检查 specs/ 目录
  if (!fs.existsSync(specsDir)) {
    result.canMigrate = false;
    result.issues.push('specs/ 目录不存在，无需迁移');
    return result;
  }
  result.specsExists = true;

  // 检查 openspec/ 是否已存在
  if (fs.existsSync(openspecDir)) {
    result.openspecExists = true;
    result.issues.push('openspec/ 目录已存在，将合并迁移');
  }

  // 统计规格文件数量
  const specFiles = findSpecFiles(specsDir);
  result.specCount = specFiles.length;

  if (specFiles.length === 0) {
    result.canMigrate = false;
    result.issues.push('specs/ 目录中没有规格文件');
  }

  return result;
}

/**
 * 查找规格文件
 * @param {string} dir - 目录路径
 * @returns {string[]} 规格文件路径列表
 */
function findSpecFiles(dir) {
  const files = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...findSpecFiles(fullPath));
    } else if (entry.name.endsWith('.fspec.md') || entry.name.endsWith('.spec.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * 从文件名提取领域名称
 *
 * 规则：
 * - user-auth.fspec.md → domain: user, name: auth
 * - auth.fspec.md → domain: auth, name: spec
 * - api-v1-users.fspec.md → domain: api, name: v1-users
 *
 * @param {string} fileName - 文件名
 * @returns {{domain: string, name: string}} 领域和名称
 */
function extractDomainFromFileName(fileName) {
  // 移除扩展名
  const baseName = fileName.replace(/\.(fspec|spec)\.md$/, '');

  // 按 - 分割
  const parts = baseName.split('-');

  if (parts.length === 1) {
    // 单个词作为领域，文件名为 spec
    return { domain: parts[0], name: 'spec' };
  }

  // 第一个词作为领域，其余作为名称
  return {
    domain: parts[0],
    name: parts.slice(1).join('-')
  };
}

/**
 * 计算目标路径
 * @param {string} sourceFile - 源文件路径
 * @param {string} specsDir - 源 specs/ 目录
 * @param {string} targetDir - 目标 openspec/specs/ 目录
 * @returns {string} 目标路径
 */
function computeTargetPath(sourceFile, specsDir, targetDir) {
  const relativePath = path.relative(specsDir, sourceFile);
  const dir = path.dirname(relativePath);
  const fileName = path.basename(sourceFile);

  // 如果已经在子目录中，保持结构
  if (dir !== '.') {
    return path.join(targetDir, relativePath);
  }

  // 从文件名提取领域
  const { domain, name } = extractDomainFromFileName(fileName);

  // 构建目标路径
  return path.join(targetDir, domain, `${name}.fspec.md`);
}

/**
 * 备份 specs/ 目录
 * @param {string} specsDir - specs/ 目录路径
 * @returns {string} 备份路径
 */
function backupSpecsDir(specsDir) {
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  let backupPath = `${specsDir}.bak`;

  // 如果已存在，添加时间戳
  if (fs.existsSync(backupPath)) {
    backupPath = `${specsDir}.bak.${timestamp}`;
  }

  // 如果还是存在，添加序号
  let counter = 1;
  while (fs.existsSync(backupPath)) {
    backupPath = `${specsDir}.bak.${timestamp}.${counter}`;
    counter++;
  }

  fs.cpSync(specsDir, backupPath, { recursive: true });

  return backupPath;
}

/**
 * 创建 OpenSpec 目录结构
 * @param {string} openspecDir - openspec/ 目录路径
 */
function createOpenSpecStructure(openspecDir) {
  const specsDir = path.join(openspecDir, 'specs');
  const changesDir = path.join(openspecDir, 'changes');
  const archiveDir = path.join(openspecDir, 'archive');

  fs.mkdirSync(specsDir, { recursive: true });
  fs.mkdirSync(changesDir, { recursive: true });
  fs.mkdirSync(archiveDir, { recursive: true });

  // 创建 .gitkeep 文件
  if (fs.readdirSync(specsDir).length === 0) {
    fs.writeFileSync(path.join(specsDir, '.gitkeep'), '');
  }
  if (fs.readdirSync(changesDir).length === 0) {
    fs.writeFileSync(path.join(changesDir, '.gitkeep'), '');
  }

  // 创建 project.md 模板
  const projectMdPath = path.join(openspecDir, 'project.md');
  if (!fs.existsSync(projectMdPath)) {
    fs.writeFileSync(projectMdPath, `# Project Conventions

> 由 SEED 迁移工具自动生成
> 日期: ${new Date().toISOString().slice(0, 10)}

## 项目概述

[项目描述]

## 目录约定

| 目录 | 用途 |
|------|------|
| specs/ | 已实现的规格（真相源） |
| changes/ | 开发中的变更提案 |
| archive/ | 已归档的历史变更 |

## 规格格式

使用 SEED fspec 格式 + OpenSpec Delta 语法。
`);
  }

  // 创建 AGENTS.md 模板
  const agentsMdPath = path.join(openspecDir, 'AGENTS.md');
  if (!fs.existsSync(agentsMdPath)) {
    fs.writeFileSync(agentsMdPath, `# AI Agent 工作流指令

## SEED 方法论集成

本项目使用 SEED (Spec → Emit → Execute → Defend) 方法论，
与 OpenSpec 生命周期完全兼容。

### 工作流程

1. **创建变更提案**: \`/mob-seed-spec --proposal "feature-name"\`
2. **编写规格**: 在 \`changes/[feature]/specs/\` 编写 Delta 规格
3. **提交审查**: \`/mob-seed-spec --submit "feature-name"\`
4. **派生代码**: \`/mob-seed-emit "feature-name"\`
5. **执行测试**: \`/mob-seed-exec "feature-name"\`
6. **归档规格**: \`/mob-seed-archive "feature-name"\`

### 规格格式

使用 SEED fspec 格式 + OpenSpec Delta 语法。
详见 \`.claude/skills/mob-seed/templates/\`
`);
  }
}

/**
 * 更新规格文件状态为 archived
 * @param {string} filePath - 文件路径
 */
function updateToArchivedState(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');

  // 检查是否已有状态字段
  const statePattern = /(>\s*(?:状态|state)\s*:\s*)(\w+)/i;

  if (statePattern.test(content)) {
    // 更新现有状态
    content = content.replace(statePattern, '$1archived');
  } else {
    // 添加状态字段到标题后
    const titleMatch = content.match(/^#\s+.+\n/m);
    if (titleMatch) {
      const insertPos = titleMatch.index + titleMatch[0].length;
      content = content.slice(0, insertPos) +
                '\n> 状态: archived\n' +
                content.slice(insertPos);
    }
  }

  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * 执行迁移操作
 * @param {string} projectRoot - 项目根目录
 * @param {Object} options - 选项
 * @param {boolean} [options.dryRun=false] - 是否仅预览
 * @param {boolean} [options.updateState=true] - 是否更新状态为 archived
 * @param {boolean} [options.removeOriginal=false] - 是否删除原始文件
 * @returns {MigrationResult} 迁移结果
 */
function migrateToOpenSpec(projectRoot, options = {}) {
  const result = {
    success: true,
    migrations: [],
    backupPath: '',
    errors: [],
    warnings: []
  };

  const specsDir = path.join(projectRoot, 'specs');
  const openspecDir = path.join(projectRoot, 'openspec');
  const targetSpecsDir = path.join(openspecDir, 'specs');

  // 检查前置条件
  const preCheck = checkMigrationPreConditions(projectRoot);
  if (!preCheck.canMigrate) {
    result.success = false;
    result.errors = preCheck.issues;
    return result;
  }

  if (preCheck.openspecExists) {
    result.warnings.push('openspec/ 目录已存在，将合并迁移');
  }

  // 获取所有规格文件
  const specFiles = findSpecFiles(specsDir);

  // 预览模式
  if (options.dryRun) {
    for (const sourceFile of specFiles) {
      const targetPath = computeTargetPath(sourceFile, specsDir, targetSpecsDir);
      result.migrations.push({
        from: path.relative(projectRoot, sourceFile),
        to: path.relative(projectRoot, targetPath)
      });
    }
    return result;
  }

  // 备份
  result.backupPath = backupSpecsDir(specsDir);

  // 创建 OpenSpec 结构
  createOpenSpecStructure(openspecDir);

  // 迁移每个文件
  for (const sourceFile of specFiles) {
    try {
      const targetPath = computeTargetPath(sourceFile, specsDir, targetSpecsDir);

      // 确保目标目录存在
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });

      // 复制文件
      fs.copyFileSync(sourceFile, targetPath);

      // 更新状态
      if (options.updateState !== false) {
        updateToArchivedState(targetPath);
      }

      result.migrations.push({
        from: path.relative(projectRoot, sourceFile),
        to: path.relative(projectRoot, targetPath)
      });

      // 删除原始文件（可选）
      if (options.removeOriginal) {
        fs.unlinkSync(sourceFile);
      }
    } catch (error) {
      result.errors.push(`迁移失败: ${sourceFile} - ${error.message}`);
    }
  }

  // 清理空的 .gitkeep
  const gitkeepPath = path.join(targetSpecsDir, '.gitkeep');
  if (fs.existsSync(gitkeepPath) && result.migrations.length > 0) {
    fs.unlinkSync(gitkeepPath);
  }

  if (result.errors.length > 0) {
    result.success = false;
  }

  return result;
}

/**
 * 生成迁移报告
 * @param {MigrationResult} result - 迁移结果
 * @returns {string} 报告文本
 */
function generateMigrationReport(result) {
  const lines = [];

  if (result.success) {
    lines.push('✅ 迁移完成');
  } else {
    lines.push('❌ 迁移失败');
  }

  lines.push('');

  if (result.backupPath) {
    lines.push(`备份: ${result.backupPath}`);
    lines.push('');
  }

  if (result.migrations.length > 0) {
    lines.push('迁移记录:');
    lines.push('┌' + '─'.repeat(60) + '┐');
    lines.push('│ 原路径' + ' '.repeat(23) + '→ 新路径' + ' '.repeat(20) + '│');
    lines.push('├' + '─'.repeat(60) + '┤');

    for (const m of result.migrations) {
      const fromStr = m.from.substring(0, 25).padEnd(25);
      const toStr = m.to.substring(0, 30).padEnd(30);
      lines.push(`│ ${fromStr} → ${toStr} │`);
    }

    lines.push('└' + '─'.repeat(60) + '┘');
  }

  if (result.warnings.length > 0) {
    lines.push('');
    lines.push('⚠️ 警告:');
    for (const w of result.warnings) {
      lines.push(`  - ${w}`);
    }
  }

  if (result.errors.length > 0) {
    lines.push('');
    lines.push('❌ 错误:');
    for (const e of result.errors) {
      lines.push(`  - ${e}`);
    }
  }

  return lines.join('\n');
}

module.exports = {
  checkMigrationPreConditions,
  findSpecFiles,
  extractDomainFromFileName,
  computeTargetPath,
  backupSpecsDir,
  createOpenSpecStructure,
  updateToArchivedState,
  migrateToOpenSpec,
  generateMigrationReport
};
