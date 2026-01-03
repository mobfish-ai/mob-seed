/**
 * ACE 观察数据结构与操作
 * @module ace/observation
 * @see openspec/changes/v3.0-ace-integration/specs/ace/observation.fspec.md
 *
 * 观察状态机:
 * raw → triaged → promoted
 *   ↓      ↓          ↓
 * ignore ignore     终态
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ============================================================================
// 类型定义 (AC-001 ~ AC-004)
// ============================================================================

/**
 * 观察类型
 * @typedef {'test_failure' | 'coverage_gap' | 'spec_drift' | 'user_feedback' | 'pattern_insight'} ObservationType
 */

/**
 * 观察状态
 * @typedef {'raw' | 'triaged' | 'promoted' | 'ignored'} ObservationStatus
 */

/**
 * 观察决策
 * @typedef {Object} ObservationDecision
 * @property {'pending' | 'accept' | 'defer' | 'ignore'} decision - 决策结果
 * @property {string} [priority] - 优先级 (P0-P4)
 * @property {string} [reason] - 决策理由
 * @property {string} [proposal_id] - 关联提案 ID
 */

/**
 * 观察上下文
 * @typedef {Object} ObservationContext
 * @property {string} [error] - 错误信息
 * @property {string} [file] - 相关文件
 * @property {number} [line] - 行号
 * @property {string} [runId] - 执行批次 ID
 * @property {Object} [extra] - 额外上下文
 */

/**
 * 观察数据结构
 * @typedef {Object} Observation
 * @property {string} id - 唯一标识 (obs-{YYYYMMDD}-{random6})
 * @property {ObservationType} type - 观察类型
 * @property {string} source - 来源 (auto:execute | auto:defend | manual)
 * @property {string} created - ISO 8601 创建时间
 * @property {string} updated - ISO 8601 更新时间
 * @property {ObservationStatus} status - 状态
 * @property {string} [spec] - 关联规格路径
 * @property {string} [priority] - 优先级 (P0-P4, triaged 后)
 * @property {string} [proposal_id] - 关联提案 ID (promoted 后)
 * @property {string} description - 描述
 * @property {ObservationContext} context - 上下文信息
 * @property {string} [suggestion] - 建议
 * @property {ObservationDecision} [decision] - 决策信息
 */

/**
 * 观察索引
 * @typedef {Object} ObservationIndex
 * @property {string} version - 索引版本
 * @property {string} updated - 更新时间
 * @property {Array<{id: string, type: ObservationType, status: ObservationStatus, created: string, spec?: string}>} observations - 观察摘要列表
 * @property {{total: number, raw: number, triaged: number, promoted: number, ignored: number}} stats - 统计信息
 */

/**
 * 观察类型枚举
 * @type {Record<string, ObservationType>}
 */
const OBSERVATION_TYPES = {
  TEST_FAILURE: 'test_failure',
  COVERAGE_GAP: 'coverage_gap',
  SPEC_DRIFT: 'spec_drift',
  USER_FEEDBACK: 'user_feedback',
  PATTERN_INSIGHT: 'pattern_insight'
};

/**
 * 观察状态枚举
 * @type {Record<string, ObservationStatus>}
 */
const OBSERVATION_STATUS = {
  RAW: 'raw',
  TRIAGED: 'triaged',
  PROMOTED: 'promoted',
  IGNORED: 'ignored'
};

/**
 * 观察来源类型
 * @type {Record<string, string>}
 */
const OBSERVATION_SOURCES = {
  AUTO_EXECUTE: 'auto:execute',
  AUTO_DEFEND: 'auto:defend',
  MANUAL: 'manual'
};

// ============================================================================
// 状态机 (AC-005 ~ AC-008)
// ============================================================================

/**
 * 状态转换规则
 * @type {Record<ObservationStatus, ObservationStatus[]>}
 */
const STATE_TRANSITIONS = {
  raw: ['triaged', 'ignored'],
  triaged: ['promoted', 'ignored'],
  promoted: [],  // 终态
  ignored: []    // 终态
};

/**
 * 状态显示配置
 * @type {Record<ObservationStatus, {icon: string, label: string}>}
 */
const STATE_DISPLAY = {
  raw: { icon: '🔵', label: '待归类' },
  triaged: { icon: '🟡', label: '已归类' },
  promoted: { icon: '🟢', label: '已升级' },
  ignored: { icon: '⚪', label: '已忽略' }
};

/**
 * 检查状态转换是否有效 (AC-005)
 * @param {ObservationStatus} from - 当前状态
 * @param {ObservationStatus} to - 目标状态
 * @returns {boolean} 是否可转换
 */
function canTransition(from, to) {
  const allowed = STATE_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * 执行状态转换 (AC-006, AC-007, AC-008)
 * @param {Observation} obs - 观察对象
 * @param {ObservationStatus} newStatus - 新状态
 * @param {Object} [updates] - 额外更新字段
 * @returns {Observation} 更新后的观察对象
 * @throws {Error} 无效状态转换
 */
function transition(obs, newStatus, updates = {}) {
  if (!canTransition(obs.status, newStatus)) {
    throw new Error(
      `无效状态转换: ${obs.status} → ${newStatus}。` +
      `${obs.status === 'promoted' || obs.status === 'ignored' ? '终态不可转换' : `允许转换到: ${STATE_TRANSITIONS[obs.status].join(', ')}`}`
    );
  }

  return {
    ...obs,
    status: newStatus,
    updated: new Date().toISOString(),
    ...updates
  };
}

/**
 * 获取状态显示信息
 * @param {ObservationStatus} status - 状态
 * @returns {{icon: string, label: string}} 显示配置
 */
function getStatusDisplay(status) {
  return STATE_DISPLAY[status] || { icon: '❓', label: status };
}

// ============================================================================
// ID 生成 (AC-017 ~ AC-019)
// ============================================================================

/**
 * 生成观察 ID (AC-017, AC-018)
 * @param {string} [projectRoot] - 项目根目录（用于检查唯一性）
 * @returns {string} 格式: obs-{YYYYMMDD}-{random6}
 */
function generateObservationId(projectRoot) {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');

  // 生成候选 ID，确保唯一性 (AC-019)
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const random = crypto.randomBytes(3).toString('hex');
    const id = `obs-${dateStr}-${random}`;

    // 如果提供了项目根目录，检查文件是否已存在
    if (projectRoot) {
      const obsDir = path.join(projectRoot, '.seed', 'observations');
      const filePath = path.join(obsDir, `${id}.md`);
      if (!fs.existsSync(filePath)) {
        return id;
      }
    } else {
      return id;
    }

    attempts++;
  }

  throw new Error(`无法生成唯一 ID，尝试 ${maxAttempts} 次后失败`);
}

// ============================================================================
// 存储操作 (AC-009 ~ AC-012)
// ============================================================================

/**
 * 确保观察目录存在
 * @param {string} projectRoot - 项目根目录
 * @returns {string} 观察目录路径
 */
function ensureObservationDir(projectRoot) {
  const obsDir = path.join(projectRoot, '.seed', 'observations');
  if (!fs.existsSync(obsDir)) {
    fs.mkdirSync(obsDir, { recursive: true });
  }
  return obsDir;
}

/**
 * 将观察对象转换为 Markdown 文件内容
 * @param {Observation} obs - 观察对象
 * @returns {string} Markdown 内容
 */
function observationToMarkdown(obs) {
  const frontmatter = [
    '---',
    `id: ${obs.id}`,
    `type: ${obs.type}`,
    `source: ${obs.source}`,
    `created: ${obs.created}`,
    `updated: ${obs.updated}`,
    `status: ${obs.status}`
  ];

  if (obs.spec) frontmatter.push(`spec: ${obs.spec}`);
  if (obs.priority) frontmatter.push(`priority: ${obs.priority}`);
  if (obs.proposal_id) frontmatter.push(`proposal_id: ${obs.proposal_id}`);
  if (obs.promoted_at) frontmatter.push(`promoted_at: ${obs.promoted_at}`);
  if (obs.proposalName) frontmatter.push(`proposalName: ${obs.proposalName}`);
  if (obs.note) frontmatter.push(`note: ${obs.note}`);

  frontmatter.push('---');

  const body = [
    '',
    '## 描述',
    '',
    obs.description,
    '',
    '## 上下文',
    ''
  ];

  if (obs.context) {
    // 通用字段
    if (obs.context.error) body.push(`- 错误: ${obs.context.error}`);
    if (obs.context.file) body.push(`- 文件: ${obs.context.file}${obs.context.line ? `:${obs.context.line}` : ''}`);
    if (obs.context.runId) body.push(`- 执行批次: ${obs.context.runId}`);
    if (obs.context.lastRunId) body.push(`- 最后执行批次: ${obs.context.lastRunId}`);

    // test_failure 类型字段
    if (obs.context.testFile) body.push(`- 测试文件: ${obs.context.testFile}`);
    if (obs.context.testName) body.push(`- 测试名称: ${obs.context.testName}`);

    // coverage_gap 类型字段
    if (obs.context.specFile) body.push(`- 规格文件: ${obs.context.specFile}`);
    if (obs.context.acId) body.push(`- AC标识: ${obs.context.acId}`);

    // spec_drift 类型字段
    if (obs.context.codeFile) body.push(`- 代码文件: ${obs.context.codeFile}`);
    if (obs.context.driftType) body.push(`- 偏离类型: ${obs.context.driftType}`);
    if (obs.context.details) body.push(`- 详情: ${JSON.stringify(obs.context.details)}`);

    // 额外字段
    if (obs.context.extra) {
      Object.entries(obs.context.extra).forEach(([key, value]) => {
        body.push(`- ${key}: ${value}`);
      });
    }
  }

  if (obs.suggestion) {
    body.push('', '## 建议', '', obs.suggestion);
  }

  body.push('', '## 决策', '');
  if (obs.decision) {
    body.push(`- 决策: ${obs.decision.decision}`);
    if (obs.decision.priority) body.push(`- 优先级: ${obs.decision.priority}`);
    if (obs.decision.reason) body.push(`- 理由: ${obs.decision.reason}`);
    if (obs.decision.proposal_id) body.push(`- 关联提案: ${obs.decision.proposal_id}`);
  } else {
    body.push('<!-- triage 时填写 -->');
    body.push('- 决策: pending');
    body.push('- 优先级:');
    body.push('- 理由:');
    body.push('- 关联提案:');
  }

  return frontmatter.join('\n') + body.join('\n');
}

/**
 * 从 Markdown 内容解析观察对象
 * @param {string} content - Markdown 内容
 * @returns {Observation} 观察对象
 */
function parseObservationMarkdown(content) {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    throw new Error('无效的观察文件格式：缺少 YAML frontmatter');
  }

  const frontmatter = frontmatterMatch[1];
  const body = content.slice(frontmatterMatch[0].length);

  // 解析 frontmatter
  const metadata = {};
  frontmatter.split('\n').forEach(line => {
    const match = line.match(/^(\w+):\s*(.*)$/);
    if (match) {
      metadata[match[1]] = match[2];
    }
  });

  // 解析 body sections
  const descMatch = body.match(/## 描述\n\n([\s\S]*?)(?=\n## |$)/);
  const ctxMatch = body.match(/## 上下文\n\n([\s\S]*?)(?=\n## |$)/);
  const sugMatch = body.match(/## 建议\n\n([\s\S]*?)(?=\n## |$)/);
  const decMatch = body.match(/## 决策\n\n([\s\S]*?)(?=\n## |$)/);

  // 解析上下文
  const context = {};
  if (ctxMatch) {
    const ctxLines = ctxMatch[1].trim().split('\n');
    ctxLines.forEach(line => {
      // 通用字段
      const errorMatch = line.match(/^- 错误:\s*(.*)$/);
      const fileMatch = line.match(/^- 文件:\s*(.*)$/);
      const runMatch = line.match(/^- 执行批次:\s*(.*)$/);
      const lastRunMatch = line.match(/^- 最后执行批次:\s*(.*)$/);

      // test_failure 类型字段
      const testFileMatch = line.match(/^- 测试文件:\s*(.*)$/);
      const testNameMatch = line.match(/^- 测试名称:\s*(.*)$/);

      // coverage_gap 类型字段
      const specFileMatch = line.match(/^- 规格文件:\s*(.*)$/);
      const acIdMatch = line.match(/^- AC标识:\s*(.*)$/);

      // spec_drift 类型字段
      const codeFileMatch = line.match(/^- 代码文件:\s*(.*)$/);
      const driftTypeMatch = line.match(/^- 偏离类型:\s*(.*)$/);
      const detailsMatch = line.match(/^- 详情:\s*(.*)$/);

      if (errorMatch) context.error = errorMatch[1];
      if (fileMatch) {
        const [file, lineNum] = fileMatch[1].split(':');
        context.file = file;
        if (lineNum) context.line = parseInt(lineNum, 10);
      }
      if (runMatch) context.runId = runMatch[1];
      if (lastRunMatch) context.lastRunId = lastRunMatch[1];

      if (testFileMatch) context.testFile = testFileMatch[1];
      if (testNameMatch) context.testName = testNameMatch[1];

      if (specFileMatch) context.specFile = specFileMatch[1];
      if (acIdMatch) context.acId = acIdMatch[1];

      if (codeFileMatch) context.codeFile = codeFileMatch[1];
      if (driftTypeMatch) context.driftType = driftTypeMatch[1];
      if (detailsMatch) {
        try {
          context.details = JSON.parse(detailsMatch[1]);
        } catch {
          context.details = detailsMatch[1];
        }
      }
    });
  }

  // 解析决策
  let decision;
  if (decMatch && !decMatch[1].includes('<!-- triage 时填写 -->')) {
    decision = {};
    const decLines = decMatch[1].trim().split('\n');
    decLines.forEach(line => {
      const decisionMatch = line.match(/^- 决策:\s*(.*)$/);
      const priorityMatch = line.match(/^- 优先级:\s*(.*)$/);
      const reasonMatch = line.match(/^- 理由:\s*(.*)$/);
      const proposalMatch = line.match(/^- 关联提案:\s*(.*)$/);

      if (decisionMatch && decisionMatch[1] !== 'pending') decision.decision = decisionMatch[1];
      if (priorityMatch && priorityMatch[1]) decision.priority = priorityMatch[1];
      if (reasonMatch && reasonMatch[1]) decision.reason = reasonMatch[1];
      if (proposalMatch && proposalMatch[1]) decision.proposal_id = proposalMatch[1];
    });
    if (Object.keys(decision).length === 0) decision = undefined;
  }

  return {
    id: metadata.id,
    type: metadata.type,
    source: metadata.source,
    created: metadata.created,
    updated: metadata.updated,
    status: metadata.status,
    spec: metadata.spec || undefined,
    priority: metadata.priority || undefined,
    proposal_id: metadata.proposal_id || undefined,
    promoted_at: metadata.promoted_at || undefined,
    proposalName: metadata.proposalName || undefined,
    note: metadata.note || undefined,
    description: descMatch ? descMatch[1].trim() : '',
    context,
    suggestion: sugMatch ? sugMatch[1].trim() : undefined,
    decision
  };
}

/**
 * 保存观察到文件 (AC-009, AC-011, AC-012)
 * @param {string} projectRoot - 项目根目录
 * @param {Observation} obs - 观察对象
 * @returns {string} 保存的文件路径
 */
function saveObservation(projectRoot, obs) {
  const obsDir = ensureObservationDir(projectRoot);
  const filePath = path.join(obsDir, `${obs.id}.md`);
  const content = observationToMarkdown(obs);
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

/**
 * 加载观察 (AC-010)
 * @param {string} projectRoot - 项目根目录
 * @param {string} id - 观察 ID
 * @returns {Observation | null} 观察对象，不存在返回 null
 */
function loadObservation(projectRoot, id) {
  const obsDir = path.join(projectRoot, '.seed', 'observations');
  const filePath = path.join(obsDir, `${id}.md`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return parseObservationMarkdown(content);
}

/**
 * 删除观察
 * @param {string} projectRoot - 项目根目录
 * @param {string} id - 观察 ID
 * @returns {boolean} 是否成功删除
 */
function deleteObservation(projectRoot, id) {
  const obsDir = path.join(projectRoot, '.seed', 'observations');
  const filePath = path.join(obsDir, `${id}.md`);

  if (!fs.existsSync(filePath)) {
    return false;
  }

  fs.unlinkSync(filePath);
  return true;
}

// ============================================================================
// 索引管理 (AC-013 ~ AC-016)
// ============================================================================

/**
 * 获取索引文件路径
 * @param {string} projectRoot - 项目根目录
 * @returns {string} 索引文件路径
 */
function getIndexPath(projectRoot) {
  return path.join(projectRoot, '.seed', 'observations', 'index.json');
}

/**
 * 更新观察索引 (AC-013, AC-016)
 * @param {string} projectRoot - 项目根目录
 * @returns {ObservationIndex} 更新后的索引
 */
function updateIndex(projectRoot) {
  const obsDir = path.join(projectRoot, '.seed', 'observations');

  if (!fs.existsSync(obsDir)) {
    const emptyIndex = {
      version: '1.0.0',
      updated: new Date().toISOString(),
      observations: [],
      stats: { total: 0, raw: 0, triaged: 0, promoted: 0, ignored: 0 }
    };
    return emptyIndex;
  }

  const files = fs.readdirSync(obsDir).filter(f => f.endsWith('.md'));
  const observations = [];
  const stats = { total: 0, raw: 0, triaged: 0, promoted: 0, ignored: 0 };

  for (const file of files) {
    const content = fs.readFileSync(path.join(obsDir, file), 'utf-8');
    try {
      const obs = parseObservationMarkdown(content);
      observations.push({
        id: obs.id,
        type: obs.type,
        status: obs.status,
        created: obs.created,
        spec: obs.spec
      });
      stats.total++;
      if (stats[obs.status] !== undefined) {
        stats[obs.status]++;
      }
    } catch (e) {
      // 跳过无效文件
      console.warn(`跳过无效观察文件: ${file}`, e.message);
    }
  }

  // 按创建时间倒序排列
  observations.sort((a, b) => new Date(b.created) - new Date(a.created));

  const index = {
    version: '1.0.0',
    updated: new Date().toISOString(),
    observations,
    stats
  };

  // 保存索引
  const indexPath = getIndexPath(projectRoot);
  ensureObservationDir(projectRoot);
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');

  return index;
}

/**
 * 加载观察索引
 * @param {string} projectRoot - 项目根目录
 * @returns {ObservationIndex | null} 索引，不存在返回 null
 */
function loadIndex(projectRoot) {
  const indexPath = getIndexPath(projectRoot);

  if (!fs.existsSync(indexPath)) {
    return null;
  }

  const content = fs.readFileSync(indexPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * 列出观察 (AC-014)
 * @param {string} projectRoot - 项目根目录
 * @param {Object} [filter] - 过滤条件
 * @param {ObservationStatus} [filter.status] - 状态过滤
 * @param {ObservationType} [filter.type] - 类型过滤
 * @param {string} [filter.spec] - 规格过滤
 * @returns {Array<{id: string, type: ObservationType, status: ObservationStatus, created: string, spec?: string}>} 观察摘要列表
 */
function listObservations(projectRoot, filter = {}) {
  // 先更新索引
  const index = updateIndex(projectRoot);

  let observations = index.observations;

  if (filter.status) {
    observations = observations.filter(o => o.status === filter.status);
  }
  if (filter.type) {
    observations = observations.filter(o => o.type === filter.type);
  }
  if (filter.spec) {
    observations = observations.filter(o => o.spec === filter.spec);
  }

  return observations;
}

/**
 * 获取观察统计 (AC-015)
 * @param {string} projectRoot - 项目根目录
 * @returns {{total: number, raw: number, triaged: number, promoted: number, ignored: number}} 统计信息
 */
function getStats(projectRoot) {
  const index = loadIndex(projectRoot);

  if (!index) {
    return { total: 0, raw: 0, triaged: 0, promoted: 0, ignored: 0 };
  }

  return index.stats;
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 创建新观察对象
 * @param {Object} params - 观察参数
 * @param {ObservationType} params.type - 类型
 * @param {string} params.source - 来源
 * @param {string} params.description - 描述
 * @param {ObservationContext} [params.context] - 上下文
 * @param {string} [params.spec] - 关联规格
 * @param {string} [params.suggestion] - 建议
 * @param {string} [projectRoot] - 项目根目录（用于生成唯一 ID）
 * @returns {Observation} 观察对象
 */
function createObservation(params, projectRoot) {
  const now = new Date().toISOString();

  return {
    id: generateObservationId(projectRoot),
    type: params.type,
    source: params.source,
    created: now,
    updated: now,
    status: OBSERVATION_STATUS.RAW,
    spec: params.spec,
    description: params.description,
    context: params.context || {},
    suggestion: params.suggestion
  };
}

/**
 * 验证观察类型
 * @param {string} type - 类型字符串
 * @returns {boolean} 是否有效
 */
function isValidType(type) {
  return Object.values(OBSERVATION_TYPES).includes(type);
}

/**
 * 验证观察状态
 * @param {string} status - 状态字符串
 * @returns {boolean} 是否有效
 */
function isValidStatus(status) {
  return Object.values(OBSERVATION_STATUS).includes(status);
}

module.exports = {
  // 类型常量
  OBSERVATION_TYPES,
  OBSERVATION_STATUS,
  OBSERVATION_SOURCES,

  // 状态机
  STATE_TRANSITIONS,
  STATE_DISPLAY,
  canTransition,
  transition,
  getStatusDisplay,

  // ID 生成
  generateObservationId,

  // 存储操作
  saveObservation,
  loadObservation,
  deleteObservation,
  observationToMarkdown,
  parseObservationMarkdown,

  // 索引管理
  updateIndex,
  loadIndex,
  listObservations,
  getStats,

  // 辅助函数
  createObservation,
  isValidType,
  isValidStatus
};
