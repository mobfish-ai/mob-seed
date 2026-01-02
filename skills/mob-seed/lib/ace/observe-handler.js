/**
 * ACE observe 子操作处理器
 * @module ace/observe-handler
 * @see openspec/changes/v3.0-ace-integration/specs/ace/spec-observe-command.fspec.md
 *
 * 实现 `/mob-seed:spec observe` 子操作，支持手动添加、列出、查看和删除观察。
 */

const path = require('path');
const {
  createObservation,
  saveObservation,
  loadObservation,
  deleteObservation,
  listObservations,
  updateIndex,
  OBSERVATION_TYPES,
  OBSERVATION_SOURCES,
  OBSERVATION_STATUS
} = require('./observation');

// ============================================================================
// 类型定义
// ============================================================================

/**
 * observe 命令选项
 * @typedef {Object} ObserveOptions
 * @property {boolean} [list] - 列出观察
 * @property {string} [status] - 状态过滤
 * @property {string} [show] - 查看详情的 ID
 * @property {string} [delete] - 删除的 ID
 * @property {string} [type] - 观察类型
 * @property {string} [spec] - 关联规格
 * @property {string} [priority] - 优先级
 * @property {boolean} [interactive] - 交互模式
 */

/**
 * observe 命令结果
 * @typedef {Object} ObserveResult
 * @property {boolean} success - 是否成功
 * @property {string} [message] - 消息
 * @property {string[]} [output] - 输出行
 * @property {Object} [data] - 返回数据
 */

/**
 * 用于交互式提示的回调接口
 * @typedef {Object} PromptInterface
 * @property {function(string, string[]): Promise<string>} select - 选择题
 * @property {function(string, boolean): Promise<string>} input - 输入题
 * @property {function(string): Promise<boolean>} confirm - 确认题
 */

// ============================================================================
// 时间格式化辅助
// ============================================================================

/**
 * 格式化相对时间 (AC-012)
 * @param {string} isoDate - ISO 日期字符串
 * @returns {string} 相对时间表示
 */
function formatRelativeTime(isoDate) {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(isoDate).toLocaleDateString();
}

/**
 * 格式化日期时间
 * @param {string} isoDate - ISO 日期字符串
 * @returns {string} 格式化的日期时间
 */
function formatDateTime(isoDate) {
  return new Date(isoDate).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

// ============================================================================
// REQ-001: 添加观察命令 (AC-001 ~ AC-004)
// ============================================================================

/**
 * 处理 observe 命令 (AC-001)
 * @param {string} projectRoot - 项目根目录
 * @param {ObserveOptions} options - 命令选项
 * @param {string} [description] - 观察描述（快速模式）
 * @param {PromptInterface} [prompts] - 交互式提示接口
 * @returns {Promise<ObserveResult>} 处理结果
 */
async function handleObserve(projectRoot, options = {}, description, prompts) {
  // --list 选项
  if (options.list) {
    return handleList(projectRoot, options);
  }

  // --show 选项
  if (options.show) {
    return handleShow(projectRoot, options.show);
  }

  // --delete 选项
  if (options.delete) {
    return handleDelete(projectRoot, options.delete, prompts);
  }

  // 添加观察
  // AC-003: 快速模式（有描述参数）
  if (description) {
    return handleQuickAdd(projectRoot, options, description);
  }

  // AC-002: 交互式模式
  if (prompts) {
    return handleInteractiveAdd(projectRoot, prompts);
  }

  // 无参数且无交互接口，返回帮助信息
  return {
    success: false,
    message: '请提供描述参数或使用交互模式',
    output: [
      '用法: /mob-seed:spec observe [options] <description>',
      '',
      '选项:',
      '  --list             列出所有观察',
      '  --status <status>  按状态过滤 (raw|triaged|promoted|ignored)',
      '  --show <id>        查看观察详情',
      '  --delete <id>      删除观察',
      '  --type <type>      观察类型 (user_feedback|pattern_insight)',
      '  --spec <path>      关联规格路径',
      '  --priority <P0-P4> 优先级',
      '',
      '示例:',
      '  /mob-seed:spec observe --list',
      '  /mob-seed:spec observe --type user_feedback "解析器需要支持注释"'
    ]
  };
}

/**
 * 快速添加观察 (AC-003)
 * @param {string} projectRoot - 项目根目录
 * @param {ObserveOptions} options - 命令选项
 * @param {string} description - 观察描述
 * @returns {Promise<ObserveResult>} 处理结果
 */
async function handleQuickAdd(projectRoot, options, description) {
  // 验证类型
  const type = options.type || OBSERVATION_TYPES.USER_FEEDBACK;
  if (!Object.values(OBSERVATION_TYPES).includes(type)) {
    return {
      success: false,
      message: `无效的观察类型: ${type}`
    };
  }

  // AC-004: source 为 manual
  const obs = createObservation({
    type,
    source: OBSERVATION_SOURCES.MANUAL,
    description,
    spec: options.spec,
    context: {}
  }, projectRoot);

  // 如果指定了优先级，设置到观察中
  if (options.priority) {
    obs.priority = options.priority;
  }

  saveObservation(projectRoot, obs);
  updateIndex(projectRoot);

  return {
    success: true,
    message: `观察已创建: ${obs.id}`,
    data: { id: obs.id, observation: obs }
  };
}

// ============================================================================
// REQ-002: 交互式信息收集 (AC-005 ~ AC-008)
// ============================================================================

/**
 * 交互式添加观察 (AC-002)
 * @param {string} projectRoot - 项目根目录
 * @param {PromptInterface} prompts - 交互式提示接口
 * @returns {Promise<ObserveResult>} 处理结果
 */
async function handleInteractiveAdd(projectRoot, prompts) {
  const output = ['📝 添加新观察', ''];

  // AC-005: 询问观察类型（选择题）
  const typeOptions = [
    'user_feedback - 用户/团队反馈',
    'pattern_insight - 模式洞察'
  ];
  const typeChoice = await prompts.select('观察类型:', typeOptions);
  const type = typeChoice.split(' - ')[0];

  // AC-006: 询问关联规格（可选，支持自动补全）
  const spec = await prompts.input('关联规格 (可选，回车跳过):', false);

  // AC-007: 询问观察描述（必填）
  const description = await prompts.input('描述你的观察:', true);
  if (!description) {
    return {
      success: false,
      message: '描述是必填项'
    };
  }

  // AC-008: 询问建议（可选）
  const suggestion = await prompts.input('建议 (可选):', false);

  // AC-004: source 为 manual
  const obs = createObservation({
    type,
    source: OBSERVATION_SOURCES.MANUAL,
    description,
    spec: spec || undefined,
    suggestion: suggestion || undefined,
    context: {}
  }, projectRoot);

  saveObservation(projectRoot, obs);
  updateIndex(projectRoot);

  output.push(`✅ 观察已创建: ${obs.id}`);

  return {
    success: true,
    message: `观察已创建: ${obs.id}`,
    output,
    data: { id: obs.id, observation: obs }
  };
}

// ============================================================================
// REQ-003: 列出观察命令 (AC-009 ~ AC-012)
// ============================================================================

/**
 * 列出观察 (AC-009)
 * @param {string} projectRoot - 项目根目录
 * @param {ObserveOptions} options - 命令选项
 * @returns {ObserveResult} 处理结果
 */
function handleList(projectRoot, options) {
  const output = [];

  // 获取观察列表
  const filter = {};
  if (options.status) {
    // AC-010: 支持 --status 过滤
    filter.status = options.status;
  }

  const observations = listObservations(projectRoot, filter);

  if (observations.length === 0) {
    return {
      success: true,
      message: '无观察记录',
      output: ['📋 无观察记录']
    };
  }

  // AC-011: 显示状态分组统计
  const byStatus = {};
  for (const obs of observations) {
    byStatus[obs.status] = byStatus[obs.status] || [];
    byStatus[obs.status].push(obs);
  }

  const statusCounts = Object.entries(byStatus)
    .map(([status, list]) => `${status}: ${list.length}`)
    .join(', ');

  output.push(`📋 观察列表 (${statusCounts})`);
  output.push('');

  // 按状态分组显示
  for (const [status, list] of Object.entries(byStatus)) {
    output.push(`${status}:`);

    for (const obs of list) {
      // 加载完整观察获取优先级
      const fullObs = loadObservation(projectRoot, obs.id);
      const priority = fullObs?.priority ? `  ${fullObs.priority}` : '';
      const spec = obs.spec ? path.basename(obs.spec) : '-';

      // AC-012: 显示时间相对表示
      const relTime = formatRelativeTime(obs.created);

      output.push(`  ${obs.id}  ${obs.type.padEnd(15)}  ${spec.padEnd(20)}${priority.padEnd(4)}  ${relTime}`);
    }

    output.push('');
  }

  output.push('💡 运行 `/mob-seed:spec observe --show <id>` 查看详情');

  return {
    success: true,
    output,
    data: { observations, byStatus }
  };
}

// ============================================================================
// REQ-004: 查看观察详情 (AC-013 ~ AC-015)
// ============================================================================

/**
 * 查看观察详情 (AC-013)
 * @param {string} projectRoot - 项目根目录
 * @param {string} id - 观察 ID
 * @returns {ObserveResult} 处理结果
 */
function handleShow(projectRoot, id) {
  const obs = loadObservation(projectRoot, id);

  if (!obs) {
    return {
      success: false,
      message: `观察不存在: ${id}`
    };
  }

  // AC-014: 显示完整观察内容
  const output = [
    `📄 观察详情: ${obs.id}`,
    '',
    `类型:     ${obs.type}`,
    `状态:     ${obs.status}`,
    `来源:     ${obs.source}`,
    `创建时间: ${formatDateTime(obs.created)}`,
    `更新时间: ${formatDateTime(obs.updated)}`
  ];

  if (obs.spec) {
    output.push(`关联规格: ${obs.spec}`);
  }

  if (obs.priority) {
    output.push(`优先级:   ${obs.priority}`);
  }

  output.push('');
  output.push('描述:');
  output.push(`  ${obs.description}`);

  if (obs.context && Object.keys(obs.context).length > 0) {
    output.push('');
    output.push('上下文:');
    for (const [key, value] of Object.entries(obs.context)) {
      if (value !== undefined && value !== null) {
        output.push(`  ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
      }
    }
  }

  if (obs.suggestion) {
    output.push('');
    output.push('建议:');
    output.push(`  ${obs.suggestion}`);
  }

  // AC-015: 显示可执行的后续操作
  output.push('');
  output.push('操作:');

  if (obs.status === 'raw') {
    output.push(`  /mob-seed:spec triage ${obs.id}  # 进行归类`);
    output.push(`  /mob-seed:spec observe --delete ${obs.id}  # 删除`);
  } else if (obs.status === 'triaged') {
    output.push(`  /mob-seed:spec triage ${obs.id}  # 升级为提案`);
  }

  return {
    success: true,
    output,
    data: { observation: obs }
  };
}

// ============================================================================
// REQ-005: 删除观察 (AC-016 ~ AC-019)
// ============================================================================

/**
 * 删除观察 (AC-016)
 * @param {string} projectRoot - 项目根目录
 * @param {string} id - 观察 ID
 * @param {PromptInterface} [prompts] - 交互式提示接口
 * @returns {Promise<ObserveResult>} 处理结果
 */
async function handleDelete(projectRoot, id, prompts) {
  const obs = loadObservation(projectRoot, id);

  if (!obs) {
    return {
      success: false,
      message: `观察不存在: ${id}`
    };
  }

  // AC-017: 只允许删除 raw 状态的观察
  if (obs.status !== OBSERVATION_STATUS.RAW) {
    return {
      success: false,
      message: `只能删除 raw 状态的观察。当前状态: ${obs.status}`
    };
  }

  // AC-018: 删除前需确认
  if (prompts) {
    const confirmed = await prompts.confirm(`确定删除观察 ${id}?`);
    if (!confirmed) {
      return {
        success: false,
        message: '已取消删除'
      };
    }
  }

  // 执行删除
  const deleted = deleteObservation(projectRoot, id);

  if (!deleted) {
    return {
      success: false,
      message: `删除失败: ${id}`
    };
  }

  // AC-019: 删除后更新索引
  updateIndex(projectRoot);

  return {
    success: true,
    message: `观察已删除: ${id}`
  };
}

// ============================================================================
// 解析命令行参数
// ============================================================================

/**
 * 解析 observe 命令参数
 * @param {string[]} args - 命令行参数
 * @returns {{options: ObserveOptions, description: string|undefined}} 解析结果
 */
function parseObserveArgs(args) {
  const options = {};
  let description;
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    if (arg === '--list') {
      options.list = true;
    } else if (arg === '--status' && i + 1 < args.length) {
      options.status = args[++i];
    } else if (arg === '--show' && i + 1 < args.length) {
      options.show = args[++i];
    } else if (arg === '--delete' && i + 1 < args.length) {
      options.delete = args[++i];
    } else if (arg === '--type' && i + 1 < args.length) {
      options.type = args[++i];
    } else if (arg === '--spec' && i + 1 < args.length) {
      options.spec = args[++i];
    } else if (arg === '--priority' && i + 1 < args.length) {
      options.priority = args[++i];
    } else if (!arg.startsWith('--')) {
      // 非选项参数视为描述
      description = args.slice(i).join(' ');
      break;
    }

    i++;
  }

  return { options, description };
}

module.exports = {
  // 主处理函数
  handleObserve,

  // 子处理函数
  handleQuickAdd,
  handleInteractiveAdd,
  handleList,
  handleShow,
  handleDelete,

  // 参数解析
  parseObserveArgs,

  // 辅助函数
  formatRelativeTime,
  formatDateTime
};
