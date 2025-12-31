/**
 * OpenSpec 归档逻辑
 * @module lifecycle/archiver
 * @see docs/plans/SEED-OPENSPEC-COMPAT.md
 */

const fs = require('fs');
const path = require('path');
const { parseSpecFile, parseMetadata, updateSpecState, scanChangeProposals } = require('./parser');
const { canTransition, getStateDisplay } = require('./types');

/**
 * 归档结果
 * @typedef {Object} ArchiveResult
 * @property {boolean} success - 是否成功
 * @property {string} proposalName - 提案名称
 * @property {string} archivePath - 归档路径
 * @property {Object} deltaSummary - Delta 合并摘要
 * @property {string[]} errors - 错误列表
 * @property {string[]} warnings - 警告列表
 */

/**
 * 归档前置条件检查结果
 * @typedef {Object} ArchivePreCheck
 * @property {boolean} canArchive - 是否可归档
 * @property {string} currentState - 当前状态
 * @property {boolean} testsPass - 测试是否通过
 * @property {boolean} filesComplete - 文件是否完整
 * @property {string[]} issues - 问题列表
 */

/**
 * 检查归档前置条件
 * @param {string} proposalPath - 提案目录路径
 * @param {Object} options - 选项
 * @param {boolean} [options.force=false] - 是否跳过测试检查
 * @returns {ArchivePreCheck} 检查结果
 */
function checkArchivePreConditions(proposalPath, options = {}) {
  const result = {
    canArchive: true,
    currentState: 'unknown',
    testsPass: true,
    filesComplete: true,
    issues: []
  };

  // 检查提案目录存在
  if (!fs.existsSync(proposalPath)) {
    result.canArchive = false;
    result.issues.push(`提案目录不存在: ${proposalPath}`);
    return result;
  }

  // 检查 proposal.md
  const proposalMdPath = path.join(proposalPath, 'proposal.md');
  if (!fs.existsSync(proposalMdPath)) {
    result.canArchive = false;
    result.filesComplete = false;
    result.issues.push('缺少 proposal.md 文件');
    return result;
  }

  // 解析状态
  const proposalContent = fs.readFileSync(proposalMdPath, 'utf-8');
  const metadata = parseMetadata(proposalContent);
  result.currentState = metadata.state;

  // 检查状态是否为 implementing
  if (metadata.state !== 'implementing') {
    result.canArchive = false;
    result.issues.push(`当前状态为 ${metadata.state}，需要是 implementing 才能归档`);
  }

  // 检查状态转换是否有效
  if (!canTransition('implementing', 'archived')) {
    result.canArchive = false;
    result.issues.push('状态转换 implementing → archived 无效');
  }

  // 检查规格文件（递归扫描）
  const specsDir = path.join(proposalPath, 'specs');
  if (!fs.existsSync(specsDir)) {
    result.filesComplete = false;
    result.issues.push('缺少 specs/ 目录');
  } else {
    // 递归扫描所有规格文件
    const scanForSpecs = (dir) => {
      const files = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...scanForSpecs(fullPath));
        } else if (entry.name.endsWith('.fspec.md') || entry.name.endsWith('.spec.md')) {
          files.push(fullPath);
        }
      }
      return files;
    };

    const specFiles = scanForSpecs(specsDir);
    if (specFiles.length === 0) {
      result.filesComplete = false;
      result.issues.push('specs/ 目录中没有规格文件');
    }
  }

  // 测试检查（除非 force）
  if (!options.force) {
    // TODO: 实际的测试结果检查
    // 这里暂时假设测试通过
    result.testsPass = true;
  }

  if (!result.filesComplete) {
    result.canArchive = false;
  }

  return result;
}

/**
 * 从文件路径提取领域名称
 * @param {string} filePath - 规格文件路径
 * @returns {string} 领域名称
 */
function extractDomain(filePath) {
  // 从路径中提取领域
  // 例如: openspec/changes/add-oauth/specs/auth/oauth.fspec.md → auth
  // 或者: openspec/changes/add-oauth/specs/oauth.fspec.md → add-oauth (使用提案名作为领域)

  const parts = filePath.split(path.sep);
  const specsIndex = parts.indexOf('specs');

  if (specsIndex >= 0 && parts.length > specsIndex + 2) {
    // 有子目录，使用子目录作为领域
    return parts[specsIndex + 1];
  }

  // 没有子目录，从文件名推断
  const fileName = path.basename(filePath, path.extname(filePath));
  // 移除 .fspec 后缀
  return fileName.replace('.fspec', '').replace('.spec', '');
}

/**
 * 合并 Delta 规格到目标真相源
 * @param {string} targetSpecPath - 目标规格文件路径
 * @param {Object} delta - Delta 规格对象
 * @param {Array} delta.added - 新增需求
 * @param {Array} delta.modified - 修改需求
 * @param {Array} delta.removed - 删除需求
 * @param {Object} options - 选项
 * @param {boolean} [options.dryRun=false] - 是否仅预览
 * @returns {Object} 合并结果
 */
function mergeDeltaToSpec(targetSpecPath, delta, options = {}) {
  const result = {
    success: true,
    targetPath: targetSpecPath,
    added: [],
    modified: [],
    removed: [],
    errors: []
  };

  let content;
  let isNewFile = false;

  // 读取目标规格文件
  if (fs.existsSync(targetSpecPath)) {
    content = fs.readFileSync(targetSpecPath, 'utf-8');
  } else {
    // 创建新的规格文件
    isNewFile = true;
    const domain = path.basename(path.dirname(targetSpecPath));
    content = `# ${domain} 规格

> 状态: archived
> 版本: 1.0.0
> 最后更新: ${new Date().toISOString().slice(0, 10)}

## Requirements

`;
  }

  // 处理 ADDED
  if (delta.added && delta.added.length > 0) {
    for (const req of delta.added) {
      const reqBlock = formatRequirement(req);

      // 在 Requirements 章节末尾添加
      const reqSectionMatch = content.match(/## Requirements\n/);
      if (reqSectionMatch) {
        const insertPos = reqSectionMatch.index + reqSectionMatch[0].length;
        // 找到下一个 ## 章节或文件末尾
        const nextSectionMatch = content.slice(insertPos).match(/\n## /);
        const endPos = nextSectionMatch
          ? insertPos + nextSectionMatch.index
          : content.length;

        content = content.slice(0, endPos) + '\n' + reqBlock + '\n' + content.slice(endPos);
      } else {
        // 如果没有 Requirements 章节，追加到末尾
        content += '\n## Requirements\n\n' + reqBlock + '\n';
      }

      result.added.push(req.id);
    }
  }

  // 处理 MODIFIED
  if (delta.modified && delta.modified.length > 0) {
    for (const req of delta.modified) {
      const reqPattern = new RegExp(
        `### ${req.id}:.*?(?=### REQ-|## |$)`,
        'gs'
      );

      if (reqPattern.test(content)) {
        const reqBlock = formatRequirement(req);
        content = content.replace(reqPattern, reqBlock + '\n');
        result.modified.push(req.id);
      } else {
        result.errors.push(`无法找到要修改的需求: ${req.id}`);
      }
    }
  }

  // 处理 REMOVED
  if (delta.removed && delta.removed.length > 0) {
    for (const req of delta.removed) {
      const reqPattern = new RegExp(
        `### ${req.id}:.*?(?=### REQ-|## |$)`,
        'gs'
      );

      if (reqPattern.test(content)) {
        content = content.replace(reqPattern, '');
        result.removed.push(req.id);
      } else {
        result.errors.push(`无法找到要删除的需求: ${req.id}`);
      }
    }
  }

  // 更新版本和日期
  content = content.replace(
    /> 最后更新: .*/,
    `> 最后更新: ${new Date().toISOString().slice(0, 10)}`
  );

  // 如果是 dry-run，不实际写入
  if (!options.dryRun) {
    // 确保目录存在
    fs.mkdirSync(path.dirname(targetSpecPath), { recursive: true });
    fs.writeFileSync(targetSpecPath, content, 'utf-8');
  }

  if (result.errors.length > 0) {
    result.success = false;
  }

  return result;
}

/**
 * 格式化需求为 Markdown
 * @param {Object} req - 需求对象
 * @returns {string} Markdown 格式的需求
 */
function formatRequirement(req) {
  let md = `### ${req.id}: ${req.title}\n`;

  if (req.description) {
    md += `${req.description}\n\n`;
  }

  if (req.scenarios && req.scenarios.length > 0) {
    for (const scenario of req.scenarios) {
      md += `**Scenario: ${scenario.name}**\n`;
      if (scenario.when) md += `- WHEN ${scenario.when}\n`;
      if (scenario.then) md += `- THEN ${scenario.then}\n`;
      md += '\n';
    }
  }

  if (req.acceptance && req.acceptance.length > 0) {
    md += '**Acceptance Criteria:**\n';
    for (const ac of req.acceptance) {
      md += `- [ ] ${ac}\n`;
    }
    md += '\n';
  }

  return md;
}

/**
 * 执行归档操作
 * @param {string} proposalName - 提案名称
 * @param {string} openspecRoot - OpenSpec 根目录
 * @param {Object} options - 选项
 * @param {boolean} [options.dryRun=false] - 是否仅预览
 * @param {boolean} [options.force=false] - 是否强制归档
 * @returns {ArchiveResult} 归档结果
 */
function archiveProposal(proposalName, openspecRoot, options = {}) {
  const result = {
    success: true,
    proposalName,
    archivePath: '',
    deltaSummary: { added: [], modified: [], removed: [] },
    errors: [],
    warnings: []
  };

  const proposalPath = path.join(openspecRoot, 'changes', proposalName);
  const specsDir = path.join(openspecRoot, 'specs');
  const archiveDir = path.join(openspecRoot, 'archive');

  // 检查前置条件
  const preCheck = checkArchivePreConditions(proposalPath, options);
  if (!preCheck.canArchive) {
    result.success = false;
    result.errors = preCheck.issues;
    return result;
  }

  // 扫描提案中的规格文件
  const proposalSpecsDir = path.join(proposalPath, 'specs');
  if (!fs.existsSync(proposalSpecsDir)) {
    result.success = false;
    result.errors.push('提案中没有 specs/ 目录');
    return result;
  }

  // 递归扫描规格文件
  const specFiles = [];
  const scanDir = (dir, basePath = '') => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        scanDir(fullPath, relativePath);
      } else if (entry.name.endsWith('.fspec.md') || entry.name.endsWith('.spec.md')) {
        specFiles.push(fullPath);
      }
    }
  };
  scanDir(proposalSpecsDir);

  if (specFiles.length === 0) {
    result.success = false;
    result.errors.push('提案中没有规格文件');
    return result;
  }

  // 解析并合并每个规格
  for (const specFile of specFiles) {
    const parsed = parseSpecFile(specFile);
    if (!parsed) {
      result.warnings.push(`无法解析规格文件: ${specFile}`);
      continue;
    }

    // 确定目标规格路径
    const domain = extractDomain(specFile);
    const targetSpecPath = path.join(specsDir, domain, 'spec.fspec.md');

    // 合并 Delta
    const mergeResult = mergeDeltaToSpec(
      targetSpecPath,
      {
        added: parsed.added,
        modified: parsed.modified,
        removed: parsed.removed
      },
      options
    );

    // 汇总结果
    result.deltaSummary.added.push(...mergeResult.added);
    result.deltaSummary.modified.push(...mergeResult.modified);
    result.deltaSummary.removed.push(...mergeResult.removed);

    if (!mergeResult.success) {
      result.errors.push(...mergeResult.errors);
    }
  }

  // 移动提案到归档目录
  if (!options.dryRun && result.errors.length === 0) {
    const timestamp = new Date().toISOString().slice(0, 7);  // YYYY-MM
    const archivePath = path.join(archiveDir, timestamp, proposalName);

    fs.mkdirSync(path.dirname(archivePath), { recursive: true });
    fs.renameSync(proposalPath, archivePath);

    result.archivePath = archivePath;

    // 更新归档副本中的状态
    const archivedProposalMd = path.join(archivePath, 'proposal.md');
    if (fs.existsSync(archivedProposalMd)) {
      updateSpecState(archivedProposalMd, 'archived');
    }
  }

  if (result.errors.length > 0) {
    result.success = false;
  }

  return result;
}

/**
 * 获取所有可归档的提案
 * @param {string} openspecRoot - OpenSpec 根目录
 * @returns {string[]} 可归档的提案名称列表
 */
function getArchivableProposals(openspecRoot) {
  const changesDir = path.join(openspecRoot, 'changes');

  if (!fs.existsSync(changesDir)) {
    return [];
  }

  const proposals = scanChangeProposals(changesDir);

  return proposals
    .filter(p => p.state === 'implementing')
    .map(p => p.name);
}

/**
 * 批量归档所有可归档的提案
 * @param {string} openspecRoot - OpenSpec 根目录
 * @param {Object} options - 选项
 * @returns {ArchiveResult[]} 归档结果列表
 */
function archiveAll(openspecRoot, options = {}) {
  const proposals = getArchivableProposals(openspecRoot);
  const results = [];

  for (const proposalName of proposals) {
    const result = archiveProposal(proposalName, openspecRoot, options);
    results.push(result);
  }

  return results;
}

module.exports = {
  checkArchivePreConditions,
  extractDomain,
  mergeDeltaToSpec,
  formatRequirement,
  archiveProposal,
  getArchivableProposals,
  archiveAll
};
