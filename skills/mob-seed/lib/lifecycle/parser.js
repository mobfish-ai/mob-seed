/**
 * OpenSpec 规格文件解析器
 * @module lifecycle/parser
 * @see docs/plans/SEED-OPENSPEC-COMPAT.md
 */

const fs = require('fs');
const path = require('path');
const { getStateDisplay } = require('./types');

/**
 * 解析规格文件的元数据块
 *
 * 支持格式:
 * > 状态: draft
 * > 版本: 1.0.0
 * > 技术栈: TypeScript
 * > 派生路径: src/auth/
 *
 * @param {string} content - 文件内容
 * @returns {import('./types').SpecStateMetadata} 元数据
 */
function parseMetadata(content) {
  const metadata = {
    state: 'draft',
    version: '1.0.0'
  };

  // 匹配 > 字段: 值 格式
  const stateMatch = content.match(/>\s*(?:状态|state)\s*:\s*(\w+)/i);
  if (stateMatch) {
    metadata.state = stateMatch[1].toLowerCase();
  }

  const versionMatch = content.match(/>\s*(?:版本|version)\s*:\s*([\d.]+)/i);
  if (versionMatch) {
    metadata.version = versionMatch[1];
  }

  const stackMatch = content.match(/>\s*(?:技术栈|stack)\s*:\s*(.+?)(?:\n|$)/i);
  if (stackMatch) {
    metadata.stack = stackMatch[1].trim();
  }

  const pathMatch = content.match(/>\s*(?:派生路径|emitPath|output)\s*:\s*(.+?)(?:\n|$)/i);
  if (pathMatch) {
    metadata.emitPath = pathMatch[1].trim();
  }

  return metadata;
}

/**
 * 解析规格标题
 * @param {string} content - 文件内容
 * @returns {string} 标题
 */
function parseTitle(content) {
  const match = content.match(/^#\s+(?:Feature:\s*)?(.+?)(?:\n|$)/m);
  return match ? match[1].trim() : 'Untitled';
}

/**
 * 解析 Delta 需求块
 * @param {string} content - 文件内容
 * @param {'ADDED' | 'MODIFIED' | 'REMOVED'} type - 变更类型
 * @returns {import('./types').DeltaRequirement[]} 需求列表
 */
function parseDeltaRequirements(content, type) {
  const requirements = [];

  // 查找对应的 Delta 块
  const sectionPattern = new RegExp(
    `##\\s*${type}\\s+(?:Requirements|需求)([\\s\\S]*?)(?=##\\s*(?:ADDED|MODIFIED|REMOVED)|$)`,
    'i'
  );

  const sectionMatch = content.match(sectionPattern);
  if (!sectionMatch) {
    return requirements;
  }

  const sectionContent = sectionMatch[1];

  // 解析每个 ### REQ-XXX 块
  const reqPattern = /###\s*(REQ-\d+)\s*:\s*(.+?)(?:\n|$)([\s\S]*?)(?=###|$)/g;
  let reqMatch;

  while ((reqMatch = reqPattern.exec(sectionContent)) !== null) {
    const [, id, title, body] = reqMatch;

    const req = {
      type,
      id,
      title: title.trim(),
      description: '',
      scenarios: [],
      acceptance: []
    };

    // 提取描述 (The system SHALL...)
    const descMatch = body.match(/(?:The system|系统)\s+(?:SHALL|SHOULD|MAY|必须|应该)\s+(.+?)(?:\n\n|\*\*|$)/is);
    if (descMatch) {
      req.description = descMatch[0].trim();
    }

    // 提取场景
    const scenarioPattern = /\*\*Scenario:\s*(.+?)\*\*([\s\S]*?)(?=\*\*Scenario|\*\*Acceptance|$)/gi;
    let scenarioMatch;

    while ((scenarioMatch = scenarioPattern.exec(body)) !== null) {
      const scenario = {
        name: scenarioMatch[1].trim(),
        when: '',
        then: ''
      };

      const whenMatch = scenarioMatch[2].match(/-\s*WHEN\s+(.+?)(?:\n|$)/i);
      if (whenMatch) scenario.when = whenMatch[1].trim();

      const thenMatch = scenarioMatch[2].match(/-\s*THEN\s+(.+?)(?:\n|$)/i);
      if (thenMatch) scenario.then = thenMatch[1].trim();

      req.scenarios.push(scenario);
    }

    // 提取验收条件
    const acPattern = /-\s*\[[ x]?\]\s*(AC-\d+)\s*:\s*(.+?)(?:\n|$)/gi;
    let acMatch;

    while ((acMatch = acPattern.exec(body)) !== null) {
      req.acceptance.push(`${acMatch[1]}: ${acMatch[2].trim()}`);
    }

    requirements.push(req);
  }

  return requirements;
}

/**
 * 解析规格文件
 * @param {string} filePath - 文件路径
 * @returns {import('./types').ParsedSpec | null} 解析结果
 */
function parseSpecFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  return {
    title: parseTitle(content),
    metadata: parseMetadata(content),
    added: parseDeltaRequirements(content, 'ADDED'),
    modified: parseDeltaRequirements(content, 'MODIFIED'),
    removed: parseDeltaRequirements(content, 'REMOVED'),
    raw: content
  };
}

/**
 * 更新规格文件的状态
 * @param {string} filePath - 文件路径
 * @param {import('./types').LifecycleState} newState - 新状态
 * @returns {boolean} 是否成功
 */
function updateSpecState(filePath, newState) {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf-8');

  // 替换状态行
  const statePattern = /(>\s*(?:状态|state)\s*:\s*)(\w+)/i;

  if (statePattern.test(content)) {
    content = content.replace(statePattern, `$1${newState}`);
  } else {
    // 如果没有状态行，在元数据块后添加
    const titleMatch = content.match(/^#\s+.+\n/m);
    if (titleMatch) {
      const insertPos = titleMatch.index + titleMatch[0].length;
      content = content.slice(0, insertPos) +
                `\n> 状态: ${newState}\n` +
                content.slice(insertPos);
    }
  }

  fs.writeFileSync(filePath, content, 'utf-8');
  return true;
}

/**
 * 递归扫描规格文件
 * @param {string} dir - 目录路径
 * @param {string} basePath - 基础路径
 * @returns {string[]} 规格文件相对路径列表
 */
function scanSpecFiles(dir, basePath = '') {
  const files = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      files.push(...scanSpecFiles(path.join(dir, entry.name), relativePath));
    } else if (entry.name.endsWith('.fspec.md') || entry.name.endsWith('.spec.md')) {
      files.push(relativePath);
    }
  }

  return files;
}

/**
 * 扫描变更提案目录
 * @param {string} changesDir - changes/ 目录路径
 * @returns {import('./types').ChangeProposal[]} 提案列表
 */
function scanChangeProposals(changesDir) {
  const proposals = [];

  if (!fs.existsSync(changesDir)) {
    return proposals;
  }

  const entries = fs.readdirSync(changesDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) {
      continue;
    }

    const proposalPath = path.join(changesDir, entry.name);
    const proposal = {
      name: entry.name,
      path: proposalPath,
      state: 'draft',
      version: '1.0.0',
      specs: [],
      hasProposalMd: false,
      hasTasksMd: false
    };

    // 检查 proposal.md
    const proposalMdPath = path.join(proposalPath, 'proposal.md');
    if (fs.existsSync(proposalMdPath)) {
      proposal.hasProposalMd = true;
      const meta = parseMetadata(fs.readFileSync(proposalMdPath, 'utf-8'));
      proposal.state = meta.state;
      proposal.version = meta.version;
    }

    // 检查 tasks.md
    proposal.hasTasksMd = fs.existsSync(path.join(proposalPath, 'tasks.md'));

    // 扫描规格文件
    const specsDir = path.join(proposalPath, 'specs');
    if (fs.existsSync(specsDir)) {
      proposal.specs = scanSpecFiles(specsDir);
    }

    // 获取目录时间
    const stats = fs.statSync(proposalPath);
    proposal.createdAt = stats.birthtime.toISOString();
    proposal.updatedAt = stats.mtime.toISOString();

    proposals.push(proposal);
  }

  return proposals;
}

/**
 * 获取规格状态概览
 * @param {string} openspecRoot - openspec/ 目录路径
 * @returns {import('./types').SpecStatusOverview} 状态概览
 */
function getStatusOverview(openspecRoot) {
  const specsDir = path.join(openspecRoot, 'specs');
  const changesDir = path.join(openspecRoot, 'changes');

  // 扫描已归档规格
  const archivedSpecs = [];
  if (fs.existsSync(specsDir)) {
    const specFiles = scanSpecFiles(specsDir);
    for (const file of specFiles) {
      const parsed = parseSpecFile(path.join(specsDir, file));
      if (parsed) {
        parsed.metadata.state = 'archived';
        archivedSpecs.push(parsed);
      }
    }
  }

  // 扫描变更提案
  const proposals = scanChangeProposals(changesDir);

  // 按状态分组
  const byState = {
    draft: proposals.filter(p => p.state === 'draft'),
    review: proposals.filter(p => p.state === 'review'),
    implementing: proposals.filter(p => p.state === 'implementing')
  };

  return {
    archived: archivedSpecs,
    draft: byState.draft,
    review: byState.review,
    implementing: byState.implementing,
    totalSpecs: archivedSpecs.length,
    totalChanges: proposals.length
  };
}

module.exports = {
  parseMetadata,
  parseTitle,
  parseDeltaRequirements,
  parseSpecFile,
  updateSpecState,
  scanChangeProposals,
  scanSpecFiles,
  getStatusOverview
};
