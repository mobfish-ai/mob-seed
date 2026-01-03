/**
 * 反思数据结构
 * @module ace/reflection
 * @see openspec/changes/v3.0-ace-integration/specs/ace/reflection.fspec.md
 *
 * 定义反思（Reflection）的核心数据结构和状态机
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ============================================================================
// 类型定义 (REQ-001)
// ============================================================================

/**
 * 模式类型
 * @typedef {'type_aggregation' | 'spec_aggregation' | 'time_clustering' | 'keyword_similarity' | 'manual'} PatternType
 */

/**
 * 反思状态
 * @typedef {'draft' | 'accepted' | 'rejected'} ReflectionStatus
 */

/**
 * 反思记录
 * @typedef {Object} Reflection
 * @property {string} id - 反思ID (ref-YYYYMMDD-hash)
 * @property {string} created - 创建时间 (ISO 8601)
 * @property {string} updated - 更新时间 (ISO 8601)
 * @property {string[]} observations - 关联的观察ID列表
 * @property {ReflectionStatus} status - 状态
 * @property {PatternType} pattern - 识别到的模式类型
 * @property {string} lesson - 教训描述
 * @property {string} [analysis] - 分析说明
 * @property {string[]} [suggestedActions] - 建议行动
 * @property {string} [proposalId] - 关联提案ID
 * @property {string} [source] - 来源 (auto|manual)
 * @property {string} [rejectReason] - 拒绝理由
 */

/**
 * 模式类型枚举 (AC-002)
 */
const PATTERN_TYPES = {
  TYPE_AGGREGATION: 'type_aggregation',
  SPEC_AGGREGATION: 'spec_aggregation',
  TIME_CLUSTERING: 'time_clustering',
  KEYWORD_SIMILARITY: 'keyword_similarity',
  MANUAL: 'manual'
};

/**
 * 反思状态枚举 (AC-003)
 */
const REFLECTION_STATUS = {
  DRAFT: 'draft',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected'
};

// ============================================================================
// 状态机 (REQ-002)
// ============================================================================

/**
 * 状态转换规则
 */
const STATE_TRANSITIONS = {
  draft: ['accepted', 'rejected'],
  accepted: [], // 终态
  rejected: []  // 终态
};

/**
 * 检查状态转换是否合法 (AC-005, AC-006, AC-007, AC-008)
 * @param {ReflectionStatus} from - 当前状态
 * @param {ReflectionStatus} to - 目标状态
 * @returns {boolean} 是否可以转换
 */
function canTransition(from, to) {
  const allowed = STATE_TRANSITIONS[from];
  return allowed && allowed.includes(to);
}

/**
 * 执行状态转换
 * @param {Reflection} reflection - 反思对象
 * @param {ReflectionStatus} targetStatus - 目标状态
 * @param {Object} [options] - 选项
 * @param {string} [options.reason] - 拒绝理由
 * @returns {Reflection} 更新后的反思对象
 * @throws {Error} 如果状态转换不合法
 */
function transition(reflection, targetStatus, options = {}) {
  if (!canTransition(reflection.status, targetStatus)) {
    throw new Error(
      `无法从 ${reflection.status} 转换到 ${targetStatus}：` +
      (STATE_TRANSITIONS[reflection.status].length === 0
        ? `${reflection.status} 是终态，不可变更`
        : `只能转换到 ${STATE_TRANSITIONS[reflection.status].join(', ')}`)
    );
  }

  const updated = {
    ...reflection,
    status: targetStatus,
    updated: new Date().toISOString()
  };

  if (targetStatus === REFLECTION_STATUS.REJECTED && options.reason) {
    updated.rejectReason = options.reason;
  }

  return updated;
}

// ============================================================================
// ID 生成 (REQ-003)
// ============================================================================

/**
 * 生成反思 ID (AC-009, AC-010, AC-011)
 * @param {string} [content=''] - 内容用于生成哈希
 * @returns {string} 反思 ID (ref-YYYYMMDD-hash)
 */
function generateReflectionId(content = '') {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');

  // 生成内容哈希
  const hashInput = content + now.toISOString() + Math.random().toString();
  const hash = crypto.createHash('md5').update(hashInput).digest('hex').slice(0, 4);

  return `ref-${dateStr}-${hash}`;
}

// ============================================================================
// 文件存储 (REQ-004)
// ============================================================================

/**
 * 反思文件目录
 * @param {string} projectRoot - 项目根目录
 * @returns {string} 反思目录路径
 */
function getReflectionsDir(projectRoot) {
  return path.join(projectRoot, '.seed', 'reflections');
}

/**
 * 创建反思对象 (AC-001)
 * @param {Object} params - 创建参数
 * @param {string[]} params.observations - 观察ID列表（至少2个，AC-004）
 * @param {PatternType} params.pattern - 模式类型
 * @param {string} params.lesson - 教训描述
 * @param {string} [params.analysis] - 分析说明
 * @param {string[]} [params.suggestedActions] - 建议行动
 * @param {string} [params.source='manual'] - 来源
 * @returns {Reflection} 反思对象
 * @throws {Error} 如果观察数量不足
 */
function createReflection(params) {
  const { observations, pattern, lesson, analysis, suggestedActions, source = 'manual' } = params;

  // AC-004: 至少关联 2 个观察
  if (!observations || observations.length < 2) {
    throw new Error('反思必须关联至少 2 个观察');
  }

  // AC-002: 验证模式类型
  if (!Object.values(PATTERN_TYPES).includes(pattern)) {
    throw new Error(`无效的模式类型: ${pattern}`);
  }

  const now = new Date().toISOString();
  const id = generateReflectionId(lesson);

  return {
    id,
    created: now,
    updated: now,
    observations,
    status: REFLECTION_STATUS.DRAFT,
    pattern,
    lesson,
    analysis,
    suggestedActions,
    source
  };
}

/**
 * 将反思对象转换为 Markdown 格式 (AC-012, AC-014, AC-015)
 * @param {Reflection} reflection - 反思对象
 * @param {Object} [observationDetails] - 观察详情（可选，用于追溯表）
 * @returns {string} Markdown 内容
 */
function toMarkdown(reflection, observationDetails = {}) {
  const lines = [];

  // YAML frontmatter
  lines.push('---');
  lines.push(`id: ${reflection.id}`);
  lines.push(`created: ${reflection.created}`);
  lines.push(`updated: ${reflection.updated}`);
  lines.push(`observations: [${reflection.observations.join(', ')}]`);
  lines.push(`status: ${reflection.status}`);
  lines.push(`pattern: ${reflection.pattern}`);
  if (reflection.source) {
    lines.push(`source: ${reflection.source}`);
  }
  if (reflection.proposalId) {
    lines.push(`proposal_id: ${reflection.proposalId}`);
  }
  if (reflection.rejectReason) {
    lines.push(`reject_reason: ${reflection.rejectReason}`);
  }
  lines.push('---');
  lines.push('');

  // 教训
  lines.push('## 教训');
  lines.push('');
  lines.push(reflection.lesson);
  lines.push('');

  // 分析
  if (reflection.analysis) {
    lines.push('## 分析');
    lines.push('');
    lines.push(reflection.analysis);
    lines.push('');
  }

  // 建议行动
  if (reflection.suggestedActions && reflection.suggestedActions.length > 0) {
    lines.push('## 建议行动');
    lines.push('');
    reflection.suggestedActions.forEach((action, i) => {
      lines.push(`${i + 1}. ${action}`);
    });
    lines.push('');
  }

  // 来源追溯
  if (Object.keys(observationDetails).length > 0) {
    lines.push('## 来源追溯');
    lines.push('');
    lines.push('| 观察 | 类型 | 描述 |');
    lines.push('|------|------|------|');
    for (const obsId of reflection.observations) {
      const obs = observationDetails[obsId] || {};
      lines.push(`| ${obsId} | ${obs.type || '-'} | ${obs.description || '-'} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * 从 Markdown 解析反思对象
 * @param {string} content - Markdown 内容
 * @returns {Reflection} 反思对象
 */
function fromMarkdown(content) {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    throw new Error('无效的反思文件格式：缺少 frontmatter');
  }

  const frontmatter = {};
  frontmatterMatch[1].split('\n').forEach(line => {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      const key = match[1];
      let value = match[2].trim();

      // 解析数组
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
      }

      frontmatter[key] = value;
    }
  });

  // 提取教训内容
  const lessonMatch = content.match(/## 教训\n\n([\s\S]*?)(?=\n## |$)/);
  const lesson = lessonMatch ? lessonMatch[1].trim() : '';

  // 提取分析内容
  const analysisMatch = content.match(/## 分析\n\n([\s\S]*?)(?=\n## |$)/);
  const analysis = analysisMatch ? analysisMatch[1].trim() : undefined;

  // 提取建议行动
  const actionsMatch = content.match(/## 建议行动\n\n([\s\S]*?)(?=\n## |$)/);
  let suggestedActions;
  if (actionsMatch) {
    suggestedActions = actionsMatch[1]
      .split('\n')
      .filter(line => /^\d+\./.test(line))
      .map(line => line.replace(/^\d+\.\s*/, '').trim());
  }

  return {
    id: frontmatter.id,
    created: frontmatter.created,
    updated: frontmatter.updated,
    observations: frontmatter.observations || [],
    status: frontmatter.status,
    pattern: frontmatter.pattern,
    lesson,
    analysis,
    suggestedActions,
    source: frontmatter.source,
    proposalId: frontmatter.proposal_id,
    rejectReason: frontmatter.reject_reason
  };
}

/**
 * 保存反思到文件 (AC-012, AC-013)
 * @param {string} projectRoot - 项目根目录
 * @param {Reflection} reflection - 反思对象
 * @param {Object} [observationDetails] - 观察详情
 * @returns {string} 保存的文件路径
 */
function saveReflection(projectRoot, reflection, observationDetails = {}) {
  const dir = getReflectionsDir(projectRoot);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filePath = path.join(dir, `${reflection.id}.md`);
  const content = toMarkdown(reflection, observationDetails);

  fs.writeFileSync(filePath, content, 'utf-8');

  return filePath;
}

/**
 * 读取反思文件
 * @param {string} projectRoot - 项目根目录
 * @param {string} reflectionId - 反思ID
 * @returns {Reflection|null} 反思对象或 null
 */
function loadReflection(projectRoot, reflectionId) {
  const filePath = path.join(getReflectionsDir(projectRoot), `${reflectionId}.md`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return fromMarkdown(content);
}

/**
 * 列出所有反思
 * @param {string} projectRoot - 项目根目录
 * @param {Object} [filter] - 过滤条件
 * @param {ReflectionStatus} [filter.status] - 按状态过滤
 * @param {PatternType} [filter.pattern] - 按模式过滤
 * @returns {Reflection[]} 反思列表
 */
function listReflections(projectRoot, filter = {}) {
  const dir = getReflectionsDir(projectRoot);

  if (!fs.existsSync(dir)) {
    return [];
  }

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md') && f.startsWith('ref-'));
  const reflections = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(dir, file), 'utf-8');
      const reflection = fromMarkdown(content);

      // 应用过滤
      if (filter.status && reflection.status !== filter.status) continue;
      if (filter.pattern && reflection.pattern !== filter.pattern) continue;

      reflections.push(reflection);
    } catch (e) {
      // 跳过无效文件
    }
  }

  // 按创建时间倒序
  return reflections.sort((a, b) =>
    new Date(b.created).getTime() - new Date(a.created).getTime()
  );
}

// ============================================================================
// 索引管理 (REQ-005)
// ============================================================================

/**
 * 索引文件路径
 * @param {string} projectRoot - 项目根目录
 * @returns {string} 索引文件路径
 */
function getIndexPath(projectRoot) {
  return path.join(getReflectionsDir(projectRoot), 'index.json');
}

/**
 * 加载索引 (AC-016)
 * @param {string} projectRoot - 项目根目录
 * @returns {Object} 索引对象
 */
function loadIndex(projectRoot) {
  const indexPath = getIndexPath(projectRoot);

  if (!fs.existsSync(indexPath)) {
    return {
      reflections: {
        draft: [],
        accepted: [],
        rejected: []
      },
      stats: {
        total: 0,
        byPattern: {}
      },
      lastUpdated: null
    };
  }

  return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
}

/**
 * 更新索引 (AC-017, AC-018, AC-019)
 * @param {string} projectRoot - 项目根目录
 * @returns {Object} 更新后的索引
 */
function updateIndex(projectRoot) {
  const reflections = listReflections(projectRoot);

  const index = {
    reflections: {
      draft: [],
      accepted: [],
      rejected: []
    },
    stats: {
      total: reflections.length,
      byPattern: {}
    },
    lastUpdated: new Date().toISOString()
  };

  for (const ref of reflections) {
    // 按状态分组 (AC-017)
    if (index.reflections[ref.status]) {
      index.reflections[ref.status].push(ref.id);
    }

    // 按模式统计 (AC-018)
    if (!index.stats.byPattern[ref.pattern]) {
      index.stats.byPattern[ref.pattern] = 0;
    }
    index.stats.byPattern[ref.pattern]++;
  }

  // 保存索引 (AC-019)
  const dir = getReflectionsDir(projectRoot);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(getIndexPath(projectRoot), JSON.stringify(index, null, 2));

  return index;
}

// ============================================================================
// 导出
// ============================================================================

module.exports = {
  // 常量
  PATTERN_TYPES,
  REFLECTION_STATUS,
  STATE_TRANSITIONS,

  // 状态机
  canTransition,
  transition,

  // ID 生成
  generateReflectionId,

  // CRUD 操作
  createReflection,
  saveReflection,
  loadReflection,
  listReflections,

  // 格式转换
  toMarkdown,
  fromMarkdown,

  // 索引管理
  loadIndex,
  updateIndex,

  // 路径
  getReflectionsDir,
  getIndexPath
};
