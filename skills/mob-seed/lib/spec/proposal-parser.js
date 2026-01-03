/**
 * Proposal 解析器
 * @module spec/proposal-parser
 * @see openspec/changes/v3.0-ace-integration/specs/ace/task-generation.fspec.md
 *
 * 解析 proposal.md 内容，提取阶段、任务和子任务
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 子任务
 * @typedef {Object} SubTask
 * @property {string} description - 描述
 * @property {boolean} completed - 是否完成
 */

/**
 * 任务
 * @typedef {Object} Task
 * @property {string} id - 任务ID (如 1.1, 1.2)
 * @property {string} name - 任务名称
 * @property {string[]} specs - 关联规格文件
 * @property {SubTask[]} subtasks - 子任务列表
 * @property {string[]} derivedOutputs - 派生产物
 */

/**
 * 阶段/里程碑
 * @typedef {Object} Phase
 * @property {string} id - 阶段ID (如 phase-1)
 * @property {number} number - 阶段编号
 * @property {string} name - 阶段名称
 * @property {Task[]} tasks - 任务列表
 */

/**
 * 解析结果
 * @typedef {Object} ParseResult
 * @property {string} proposalName - 提案名称
 * @property {Phase[]} phases - 阶段列表
 * @property {Object} metadata - 元信息
 */

// ============================================================================
// 解析函数 (REQ-002)
// ============================================================================

/**
 * 解析 Proposal 文件 (AC-004, AC-005, AC-006, AC-007)
 * @param {string} proposalContent - proposal.md 内容
 * @returns {ParseResult} 解析结果
 */
function parseProposal(proposalContent) {
  const phases = [];
  const lines = proposalContent.split('\n');

  let currentPhase = null;
  let currentTask = null;
  let inImplementationSection = false;
  let inACSection = false;
  let inDerivedOutputsSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 检测实施阶段章节
    if (/^##\s+(实施阶段|Implementation|实现阶段)/i.test(line)) {
      inImplementationSection = true;
      continue;
    }

    // 检测阶段标题 (AC-004, AC-007)
    // 支持格式: ### Phase 1: xxx 或 ### 阶段 1: xxx
    const phaseMatch = line.match(/^###\s+(?:Phase|阶段)\s+(\d+):\s*(.+?)(?:\s+\([^)]+\))?$/i);
    if (phaseMatch && inImplementationSection) {
      if (currentTask) {
        currentPhase.tasks.push(currentTask);
        currentTask = null;
      }
      if (currentPhase) {
        phases.push(currentPhase);
      }

      currentPhase = {
        id: `phase-${phaseMatch[1]}`,
        number: parseInt(phaseMatch[1], 10),
        name: phaseMatch[2].trim(),
        tasks: []
      };
      inACSection = false;
      inDerivedOutputsSection = false;
      continue;
    }

    // 检测任务列表项 (AC-005)
    // 支持格式: - [ ] xxx → `xxx.fspec.md` 或 - [x] xxx → `xxx.fspec.md` ✅
    //           - [ ] xxx → `xxx.fspec.md` (REQ-001, REQ-002)
    // 注意：不在 AC 或派生产物区块内才解析为任务
    // 允许行尾有可选的 REQ 引用和状态标记（✅ ✓ 等）
    const taskListMatch = line.match(/^-\s+\[([ x])\]\s+(.+?)(?:\s+→\s+`([^`]+)`)?(?:\s+\([^)]+\))?(?:\s*[✅✓✔☑]*)?$/);
    if (taskListMatch && currentPhase && !inACSection && !inDerivedOutputsSection) {
      const completed = taskListMatch[1] === 'x';
      const description = taskListMatch[2].trim();
      const spec = taskListMatch[3];

      // 这是阶段内的任务列表
      const taskNum = currentPhase.tasks.length + 1;
      const task = {
        id: `${currentPhase.number}.${taskNum}`,
        name: description,
        specs: spec ? [spec] : [],
        subtasks: [],
        derivedOutputs: [],
        completed
      };
      currentPhase.tasks.push(task);
      continue;
    }

    // 如果我们还没有进入实施阶段章节，尝试直接解析任务标题
    // 支持格式: ### 任务 1.1: xxx
    const taskMatch = line.match(/^###\s+(?:任务|Task)\s+(\d+\.\d+):\s*(.+)$/i);
    if (taskMatch) {
      if (currentTask && currentPhase) {
        currentPhase.tasks.push(currentTask);
      }

      currentTask = {
        id: taskMatch[1],
        name: taskMatch[2].trim(),
        specs: [],
        subtasks: [],
        derivedOutputs: []
      };
      inACSection = false;
      inDerivedOutputsSection = false;
      continue;
    }

    // 检测 Acceptance Criteria 区块
    if (/^\*\*Acceptance Criteria\*\*:?/i.test(line)) {
      inACSection = true;
      inDerivedOutputsSection = false;
      continue;
    }

    // 检测派生产物区块
    if (/^\*\*派生产物\*\*:?|^\*\*Derived Outputs\*\*:?/i.test(line)) {
      inDerivedOutputsSection = true;
      inACSection = false;
      continue;
    }

    // 解析 AC 子任务 (AC-005)
    if (inACSection && currentTask) {
      const acMatch = line.match(/^-\s+\[([ x])\]\s+(AC-\d+):\s*(.+)$/);
      if (acMatch) {
        currentTask.subtasks.push({
          id: acMatch[2],
          description: acMatch[3],
          completed: acMatch[1] === 'x'
        });
        continue;
      }
    }

    // 解析派生产物
    if (inDerivedOutputsSection && currentTask) {
      const outputMatch = line.match(/^-\s+`([^`]+)`/);
      if (outputMatch) {
        currentTask.derivedOutputs.push(outputMatch[1]);
        continue;
      }
    }

    // 解析关联规格 (AC-006)
    const specMatch = line.match(/^\*\*关联规格\*\*:\s*`([^`]+)`/);
    if (specMatch && currentTask) {
      currentTask.specs.push(specMatch[1]);
      continue;
    }

    // 检测新章节开始（结束当前阶段解析）
    if (/^##\s+[^#]/.test(line) && !/^##\s+(实施阶段|Implementation|实现阶段)/i.test(line)) {
      if (inImplementationSection) {
        inImplementationSection = false;
      }
    }
  }

  // 添加最后的任务和阶段
  if (currentTask && currentPhase) {
    currentPhase.tasks.push(currentTask);
  }
  if (currentPhase) {
    phases.push(currentPhase);
  }

  return {
    phases,
    metadata: {
      parsed: new Date().toISOString()
    }
  };
}

/**
 * 从文件路径解析 Proposal
 * @param {string} proposalPath - proposal.md 路径
 * @returns {ParseResult} 解析结果
 */
function parseProposalFile(proposalPath) {
  if (!fs.existsSync(proposalPath)) {
    throw new Error(`Proposal 文件不存在: ${proposalPath}`);
  }

  const content = fs.readFileSync(proposalPath, 'utf-8');
  const result = parseProposal(content);

  // 从路径提取提案名称
  const proposalDir = path.dirname(proposalPath);
  result.proposalName = path.basename(proposalDir);

  return result;
}

/**
 * 解析 YAML frontmatter
 * @param {string} content - Markdown 内容
 * @returns {Object} frontmatter 数据
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const frontmatter = {};
  match[1].split('\n').forEach(line => {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) {
      frontmatter[kv[1]] = kv[2];
    }
  });

  return frontmatter;
}

/**
 * 获取 fspec 状态
 * @param {string} projectRoot - 项目根目录
 * @param {string} specPath - 规格文件相对路径
 * @returns {string} 状态 (draft, review, implementing, archived)
 */
function getFspecStatus(projectRoot, specPath) {
  // 尝试多个可能的路径
  const possiblePaths = [
    path.join(projectRoot, specPath),
    path.join(projectRoot, 'openspec', 'changes', specPath),
    path.join(projectRoot, 'openspec', 'specs', specPath)
  ];

  for (const fullPath of possiblePaths) {
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const statusMatch = content.match(/>\s*状态:\s*(\w+)/);
      if (statusMatch) {
        return statusMatch[1];
      }
    }
  }

  return 'draft';
}

module.exports = {
  parseProposal,
  parseProposalFile,
  parseFrontmatter,
  getFspecStatus
};
