/**
 * ACE triage 子操作处理器
 * @module ace/triage-handler
 * @see openspec/changes/v3.0-ace-integration/specs/ace/spec-triage-command.fspec.md
 *
 * 实现 `/mob-seed:spec triage` 子操作，支持观察归类、优先级排序和提案提升。
 */

const path = require('path');
const fs = require('fs');
const {
  loadObservation,
  saveObservation,
  listObservations,
  transition,
  updateIndex,
  OBSERVATION_STATUS
} = require('./observation');

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 归类决策
 * @typedef {'accept' | 'defer' | 'ignore' | 'skip'} TriageDecision
 */

/**
 * 优先级
 * @typedef {'P0' | 'P1' | 'P2' | 'P3' | 'P4'} Priority
 */

/**
 * triage 命令选项
 * @typedef {Object} TriageOptions
 * @property {string} [batch] - 批量归类的状态过滤
 * @property {TriageDecision} [decision] - 快速模式决策
 * @property {Priority} [priority] - 快速模式优先级
 * @property {string} [note] - 备注
 */

/**
 * triage 命令结果
 * @typedef {Object} TriageResult
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

/**
 * 批量归类统计
 * @typedef {Object} BatchStats
 * @property {number} accepted - 接受数
 * @property {number} deferred - 延后数
 * @property {number} ignored - 忽略数
 * @property {number} skipped - 跳过数
 * @property {string[]} proposalIds - 创建的提案 ID 列表
 */

// ============================================================================
// 优先级定义
// ============================================================================

const PRIORITIES = {
  P0: { label: 'P0 - 紧急，阻塞发布', shortcut: '0' },
  P1: { label: 'P1 - 高，本周处理', shortcut: '1' },
  P2: { label: 'P2 - 中，本月处理', shortcut: '2' },
  P3: { label: 'P3 - 低，有空处理', shortcut: '3' },
  P4: { label: 'P4 - 最低，可能不处理', shortcut: '4' }
};

const DECISIONS = {
  accept: { label: 'accept - 接受，将提升为规格变更', shortcut: 'a' },
  defer: { label: 'defer - 延后，标记优先级后暂存', shortcut: 'd' },
  ignore: { label: 'ignore - 忽略，不需要处理', shortcut: 'i' },
  skip: { label: 'skip - 跳过，稍后处理', shortcut: 's' }
};

// ============================================================================
// REQ-001: 归类观察命令 (AC-001 ~ AC-004)
// ============================================================================

/**
 * 处理 triage 命令 (AC-001)
 * @param {string} projectRoot - 项目根目录
 * @param {TriageOptions} options - 命令选项
 * @param {string} [id] - 观察 ID
 * @param {PromptInterface} [prompts] - 交互式提示接口
 * @returns {Promise<TriageResult>} 处理结果
 */
async function handleTriage(projectRoot, options = {}, id, prompts) {
  // AC-004: --batch 批量归类
  if (options.batch) {
    return handleBatchTriage(projectRoot, options.batch, prompts);
  }

  // 无 ID 且无 batch，返回帮助
  if (!id) {
    return {
      success: false,
      message: '请提供观察 ID 或使用 --batch 选项',
      output: [
        '用法: /mob-seed:spec triage [options] <id>',
        '',
        '选项:',
        '  --batch <status>   批量归类指定状态的观察',
        '  --decision <d>     快速模式决策 (accept|defer|ignore)',
        '  --priority <P0-P4> 优先级',
        '  --note <text>      备注',
        '',
        '示例:',
        '  /mob-seed:spec triage obs-20260101-abc123',
        '  /mob-seed:spec triage --batch raw',
        '  /mob-seed:spec triage obs-123 --decision accept --priority P1'
      ]
    };
  }

  // 加载观察
  const obs = loadObservation(projectRoot, id);
  if (!obs) {
    return {
      success: false,
      message: `观察不存在: ${id}`
    };
  }

  // 检查状态：只能归类 raw 或 triaged
  if (obs.status !== OBSERVATION_STATUS.RAW && obs.status !== OBSERVATION_STATUS.TRIAGED) {
    return {
      success: false,
      message: `只能归类 raw 或 triaged 状态的观察。当前状态: ${obs.status}`
    };
  }

  // AC-003: 快速模式
  if (options.decision) {
    return handleQuickTriage(projectRoot, obs, options);
  }

  // AC-002: 交互式模式
  if (prompts) {
    return handleInteractiveTriage(projectRoot, obs, prompts);
  }

  // 无交互接口，返回观察详情和帮助
  return {
    success: false,
    message: '请使用交互模式或提供 --decision 选项',
    output: formatObservationPreview(obs)
  };
}

/**
 * 快速归类 (AC-003)
 * @param {string} projectRoot - 项目根目录
 * @param {Object} obs - 观察对象
 * @param {TriageOptions} options - 选项
 * @returns {Promise<TriageResult>} 处理结果
 */
async function handleQuickTriage(projectRoot, obs, options) {
  const decision = options.decision;
  const priority = options.priority || 'P2';
  const note = options.note;

  // 验证决策
  if (!['accept', 'defer', 'ignore'].includes(decision)) {
    return {
      success: false,
      message: `无效的决策: ${decision}。有效值: accept, defer, ignore`
    };
  }

  return executeTriageDecision(projectRoot, obs, decision, priority, note);
}

// ============================================================================
// REQ-002: 交互式归类流程 (AC-005 ~ AC-008)
// ============================================================================

/**
 * 交互式归类 (AC-005 ~ AC-008)
 * @param {string} projectRoot - 项目根目录
 * @param {Object} obs - 观察对象
 * @param {PromptInterface} prompts - 交互式提示接口
 * @returns {Promise<TriageResult>} 处理结果
 */
async function handleInteractiveTriage(projectRoot, obs, prompts) {
  const output = [];

  // AC-005: 显示观察完整内容
  output.push(`📋 归类观察: ${obs.id}`);
  output.push('');
  output.push(`类型: ${obs.type}`);
  output.push(`来源: ${obs.source}`);
  output.push(`描述: ${obs.description}`);
  if (obs.suggestion) {
    output.push(`建议: ${obs.suggestion}`);
  }
  if (obs.spec) {
    output.push(`规格: ${obs.spec}`);
  }
  output.push('');

  // AC-006: 收集决策
  const decisionOptions = Object.values(DECISIONS).map(d => d.label);
  const decisionChoice = await prompts.select('你的决策:', decisionOptions);
  const decision = decisionChoice.split(' - ')[0];

  // skip 直接返回
  if (decision === 'skip') {
    return {
      success: true,
      message: '已跳过',
      output: [...output, '⏭️ 已跳过，稍后处理'],
      data: { decision: 'skip' }
    };
  }

  // AC-007: 收集优先级
  const priorityOptions = Object.values(PRIORITIES).map(p => p.label);
  const priorityChoice = await prompts.select('优先级:', priorityOptions);
  const priority = priorityChoice.split(' - ')[0];

  // AC-008: 收集备注（可选）
  const note = await prompts.input('备注 (可选):', false);

  return executeTriageDecision(projectRoot, obs, decision, priority, note || undefined, output);
}

/**
 * 格式化观察预览
 * @param {Object} obs - 观察对象
 * @returns {string[]} 预览行
 */
function formatObservationPreview(obs) {
  const lines = [
    `📋 观察: ${obs.id}`,
    '',
    `类型:   ${obs.type}`,
    `状态:   ${obs.status}`,
    `来源:   ${obs.source}`,
    `描述:   ${obs.description}`
  ];

  if (obs.suggestion) {
    lines.push(`建议:   ${obs.suggestion}`);
  }

  if (obs.spec) {
    lines.push(`规格:   ${obs.spec}`);
  }

  return lines;
}

// ============================================================================
// REQ-003: 提升观察为提案 (AC-009 ~ AC-012)
// ============================================================================

/**
 * 执行归类决策
 * @param {string} projectRoot - 项目根目录
 * @param {Object} obs - 观察对象
 * @param {TriageDecision} decision - 决策
 * @param {Priority} priority - 优先级
 * @param {string} [note] - 备注
 * @param {string[]} [existingOutput] - 已有输出
 * @returns {Promise<TriageResult>} 处理结果
 */
async function executeTriageDecision(projectRoot, obs, decision, priority, note, existingOutput = []) {
  const output = [...existingOutput];

  switch (decision) {
    case 'accept': {
      // AC-009 ~ AC-012: 提升为提案
      const result = promoteToProposal(projectRoot, obs, priority, note);

      output.push('');
      output.push('🚀 观察已提升为提案');
      output.push('');
      output.push(`提案: ${result.proposalName}`);
      output.push(`状态: draft`);
      output.push(`来源: ${obs.id}`);
      output.push('');
      output.push('下一步:');
      output.push(`  /mob-seed:spec edit ${result.proposalName}  # 编辑提案`);

      return {
        success: true,
        message: `观察已提升为提案: ${result.proposalName}`,
        output,
        data: {
          decision: 'accept',
          priority,
          proposalId: result.proposalId,
          proposalName: result.proposalName
        }
      };
    }

    case 'defer': {
      // 延后：转换为 triaged 状态
      const triaged = transition(obs, OBSERVATION_STATUS.TRIAGED, { priority, note });
      saveObservation(projectRoot, triaged);
      updateIndex(projectRoot);

      output.push('');
      output.push(`✅ 观察已归类: triaged (${priority})`);
      if (note) {
        output.push(`   备注: ${note}`);
      }

      return {
        success: true,
        message: `观察已归类: ${obs.id} (${priority})`,
        output,
        data: { decision: 'defer', priority, observation: triaged }
      };
    }

    case 'ignore': {
      // AC-013 ~ AC-016: 忽略观察
      const ignored = transition(obs, OBSERVATION_STATUS.IGNORED, { note });
      saveObservation(projectRoot, ignored);
      updateIndex(projectRoot);

      output.push('');
      output.push(`✅ 观察已忽略: ${obs.id}`);
      if (note) {
        output.push(`   理由: ${note}`);
      }

      return {
        success: true,
        message: `观察已忽略: ${obs.id}`,
        output,
        data: { decision: 'ignore', observation: ignored }
      };
    }

    default:
      return {
        success: false,
        message: `未知决策: ${decision}`
      };
  }
}

/**
 * 提升观察为提案 (AC-009 ~ AC-012)
 * @param {string} projectRoot - 项目根目录
 * @param {Object} obs - 观察对象
 * @param {Priority} priority - 优先级
 * @param {string} [note] - 备注
 * @returns {Object} 提案信息
 */
function promoteToProposal(projectRoot, obs, priority, note) {
  // 生成提案名称
  const proposalName = generateProposalName(obs);
  const proposalId = `proposal-${Date.now()}`;

  // 创建提案目录和文件
  const proposalDir = path.join(projectRoot, 'openspec', 'changes', proposalName);
  fs.mkdirSync(proposalDir, { recursive: true });

  // 创建 proposal.md
  const proposalContent = generateProposalContent(obs, proposalName, priority, note);
  fs.writeFileSync(path.join(proposalDir, 'proposal.md'), proposalContent);

  // AC-011: 更新观察状态为 promoted
  // 状态机要求：raw → triaged → promoted
  let current = obs;
  if (current.status === OBSERVATION_STATUS.RAW) {
    current = transition(current, OBSERVATION_STATUS.TRIAGED, { priority });
  }

  // AC-012: 更新 proposal_id 字段
  const promoted = transition(current, OBSERVATION_STATUS.PROMOTED, {
    proposal_id: proposalId,
    proposalName,
    note
  });
  saveObservation(projectRoot, promoted);
  updateIndex(projectRoot);

  return {
    proposalId,
    proposalName,
    proposalDir
  };
}

/**
 * 生成提案名称
 * @param {Object} obs - 观察对象
 * @returns {string} 提案名称
 */
function generateProposalName(obs) {
  // 从描述生成简短名称
  const words = obs.description
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 0)
    .slice(0, 4);

  const slug = words.join('-').substring(0, 30) || 'unnamed';
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  return `${dateStr}-${slug}`;
}

/**
 * 生成提案内容
 * @param {Object} obs - 观察对象
 * @param {string} proposalName - 提案名称
 * @param {Priority} priority - 优先级
 * @param {string} [note] - 备注
 * @returns {string} 提案内容
 */
function generateProposalContent(obs, proposalName, priority, note) {
  const lines = [
    '---',
    'status: draft',
    `version: 1.0.0`,
    `created: ${new Date().toISOString()}`,
    `source: obs:${obs.id}`,
    `priority: ${priority}`,
    '---',
    '',
    `# ${proposalName}`,
    '',
    '## 概述',
    '',
    obs.description,
    ''
  ];

  if (obs.suggestion) {
    lines.push('## 建议变更', '', obs.suggestion, '');
  }

  if (obs.spec) {
    lines.push('## 关联规格', '', `- ${obs.spec}`, '');
  }

  if (note) {
    lines.push('## 备注', '', note, '');
  }

  lines.push(
    '## 来源追溯',
    '',
    `- 观察 ID: ${obs.id}`,
    `- 观察类型: ${obs.type}`,
    `- 观察来源: ${obs.source}`,
    ''
  );

  return lines.join('\n');
}

// ============================================================================
// REQ-004: 忽略观察 (AC-013 ~ AC-016)
// ============================================================================

/**
 * 忽略观察（需要确认）(AC-013)
 * @param {string} projectRoot - 项目根目录
 * @param {Object} obs - 观察对象
 * @param {PromptInterface} prompts - 交互式提示接口
 * @returns {Promise<TriageResult>} 处理结果
 */
async function handleIgnoreWithConfirm(projectRoot, obs, prompts) {
  const output = [];

  output.push(`⚠️ 确认忽略观察 ${obs.id}`);
  output.push('');
  output.push(`类型: ${obs.type}`);
  output.push(`描述: ${obs.description}`);
  output.push('');

  // AC-014: 记录忽略理由
  const reason = await prompts.input('确认忽略? (输入理由):', true);

  if (!reason) {
    return {
      success: false,
      message: '已取消忽略'
    };
  }

  // AC-015: 变更状态为 ignored
  const ignored = transition(obs, OBSERVATION_STATUS.IGNORED, { note: reason });
  saveObservation(projectRoot, ignored);
  updateIndex(projectRoot);

  output.push(`✅ 观察已忽略`);
  output.push(`   理由: ${reason}`);

  return {
    success: true,
    message: `观察已忽略: ${obs.id}`,
    output,
    data: { observation: ignored }
  };
}

// ============================================================================
// REQ-005: 批量归类支持 (AC-017 ~ AC-020)
// ============================================================================

/**
 * 批量归类 (AC-017)
 * @param {string} projectRoot - 项目根目录
 * @param {string} status - 要归类的状态
 * @param {PromptInterface} [prompts] - 交互式提示接口
 * @returns {Promise<TriageResult>} 处理结果
 */
async function handleBatchTriage(projectRoot, status, prompts) {
  const output = [];

  // 获取指定状态的观察列表
  const observations = listObservations(projectRoot, { status });

  if (observations.length === 0) {
    return {
      success: true,
      message: `无 ${status} 状态的观察`,
      output: [`📋 无 ${status} 状态的观察需要归类`]
    };
  }

  output.push(`📋 批量归类模式 (${status}: ${observations.length} 条)`);
  output.push('');

  // 如果无交互接口，只显示列表
  if (!prompts) {
    for (const item of observations) {
      output.push(`  ${item.id}  ${item.type}  ${item.description?.substring(0, 40) || ''}`);
    }
    output.push('');
    output.push('💡 使用交互模式进行批量归类');
    return {
      success: true,
      output,
      data: { observations }
    };
  }

  // 批量归类统计
  const stats = {
    accepted: 0,
    deferred: 0,
    ignored: 0,
    skipped: 0,
    proposalIds: []
  };

  // 依次处理每个观察
  for (let i = 0; i < observations.length; i++) {
    const item = observations[i];
    const obs = loadObservation(projectRoot, item.id);

    if (!obs) continue;

    output.push(`[${i + 1}/${observations.length}] ${obs.id}`);
    output.push(`  类型: ${obs.type}`);
    output.push(`  描述: ${obs.description?.substring(0, 50) || ''}`);

    // AC-018: 快捷键操作
    const decisionOptions = [
      '[a]ccept - 接受提升',
      '[d]efer - 延后暂存',
      '[i]gnore - 忽略',
      '[s]kip - 跳过'
    ];
    const choice = await prompts.select('决策:', decisionOptions);
    const decision = choice.charAt(1); // 取快捷键字符

    // 跳过处理
    if (decision === 's') {
      stats.skipped++;
      output.push('  ⏭️ 已跳过');
      output.push('');
      continue;
    }

    // 收集优先级（非跳过时）
    const priorityOptions = Object.entries(PRIORITIES).map(([k, v]) => `${k} - ${v.label.split(' - ')[1]}`);
    const priorityChoice = await prompts.select('优先级:', priorityOptions);
    const priority = priorityChoice.split(' - ')[0];

    // 执行决策
    const decisionMap = { a: 'accept', d: 'defer', i: 'ignore' };
    const result = await executeTriageDecision(projectRoot, obs, decisionMap[decision], priority);

    if (result.success) {
      if (decision === 'a') {
        stats.accepted++;
        if (result.data.proposalId) {
          stats.proposalIds.push(result.data.proposalName);
        }
        output.push(`  🚀 已提升为提案: ${result.data.proposalName}`);
      } else if (decision === 'd') {
        stats.deferred++;
        output.push(`  ✅ 已归类: triaged (${priority})`);
      } else if (decision === 'i') {
        stats.ignored++;
        output.push(`  ✅ 已忽略`);
      }
    }

    output.push('');
  }

  // AC-019: 显示进度和统计
  output.push('📊 归类完成');
  output.push(`  accepted: ${stats.accepted}` + (stats.proposalIds.length > 0 ? ` → 创建 ${stats.proposalIds.length} 个提案草稿` : ''));
  output.push(`  deferred: ${stats.deferred}`);
  output.push(`  ignored: ${stats.ignored}`);
  output.push(`  skipped: ${stats.skipped}`);

  return {
    success: true,
    message: `批量归类完成: ${observations.length} 条`,
    output,
    data: { stats }
  };
}

// ============================================================================
// 解析命令行参数
// ============================================================================

/**
 * 解析 triage 命令参数
 * @param {string[]} args - 命令行参数
 * @returns {{options: TriageOptions, id: string|undefined}} 解析结果
 */
function parseTriageArgs(args) {
  const options = {};
  let id;
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    if (arg === '--batch' && i + 1 < args.length) {
      options.batch = args[++i];
    } else if (arg === '--decision' && i + 1 < args.length) {
      options.decision = args[++i];
    } else if (arg === '--priority' && i + 1 < args.length) {
      options.priority = args[++i];
    } else if (arg === '--note' && i + 1 < args.length) {
      options.note = args[++i];
    } else if (!arg.startsWith('--')) {
      id = arg;
    }

    i++;
  }

  return { options, id };
}

module.exports = {
  // 主处理函数
  handleTriage,

  // 子处理函数
  handleQuickTriage,
  handleInteractiveTriage,
  handleBatchTriage,
  handleIgnoreWithConfirm,

  // 提案生成
  promoteToProposal,
  generateProposalName,
  generateProposalContent,

  // 决策执行
  executeTriageDecision,

  // 参数解析
  parseTriageArgs,

  // 常量
  PRIORITIES,
  DECISIONS
};
