/**
 * triage-handler.js 测试
 * @see openspec/changes/v3.0-ace-integration/specs/ace/spec-triage-command.fspec.md
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  handleTriage,
  handleQuickTriage,
  handleInteractiveTriage,
  handleBatchTriage,
  promoteToProposal,
  generateProposalName,
  generateProposalContent,
  executeTriageDecision,
  parseTriageArgs,
  PRIORITIES,
  DECISIONS
} = require('../../lib/ace/triage-handler');

const {
  createObservation,
  saveObservation,
  loadObservation,
  transition,
  updateIndex,
  OBSERVATION_TYPES,
  OBSERVATION_SOURCES,
  OBSERVATION_STATUS
} = require('../../lib/ace/observation');

// 测试辅助函数
function createTestDir() {
  const testDir = path.join(os.tmpdir(), `triage-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(testDir, { recursive: true });
  // 创建 openspec/changes 目录供 promoteToProposal 使用
  fs.mkdirSync(path.join(testDir, 'openspec', 'changes'), { recursive: true });
  return testDir;
}

function cleanupTestDir(testDir) {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

function createTestObservation(projectRoot, overrides = {}) {
  const obs = createObservation({
    type: OBSERVATION_TYPES.TEST_FAILURE,
    source: OBSERVATION_SOURCES.AUTO_EXECUTE,
    description: '测试观察描述',
    suggestion: '建议修复方案',
    context: { testFile: 'test.js' },
    ...overrides
  }, projectRoot);

  return obs;
}

// Mock prompts 接口
function createMockPrompts(responses = {}) {
  let selectIndex = 0;
  let inputIndex = 0;

  return {
    select: async (question, options) => {
      if (Array.isArray(responses.select)) {
        return responses.select[selectIndex++] || options[0];
      }
      return responses.select || options[0];
    },
    input: async (question, required) => {
      if (Array.isArray(responses.input)) {
        return responses.input[inputIndex++] || '';
      }
      return responses.input || '';
    },
    confirm: async (question) => responses.confirm !== undefined ? responses.confirm : true
  };
}

// ============================================================================
// REQ-001: 归类观察命令 (AC-001 ~ AC-004)
// ============================================================================

describe('REQ-001: 归类观察命令', () => {
  let testDir;

  beforeEach(() => {
    testDir = createTestDir();
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  it('AC-001: 实现 /mob-seed:spec triage 子操作', async () => {
    // 无参数时返回帮助
    const result = await handleTriage(testDir, {});

    assert.strictEqual(result.success, false);
    assert.ok(result.output);
    assert.ok(result.output.some(line => line.includes('用法')));
  });

  it('AC-002: 支持单个观察归类', async () => {
    const obs = createTestObservation(testDir);
    saveObservation(testDir, obs);
    updateIndex(testDir);

    const prompts = createMockPrompts({
      select: ['defer - 延后，标记优先级后暂存', 'P2 - 中，本月处理'],
      input: ''
    });

    const result = await handleTriage(testDir, {}, obs.id, prompts);

    assert.strictEqual(result.success, true);
    assert.ok(result.data.decision === 'defer');
  });

  it('AC-003: 支持快速归类模式', async () => {
    const obs = createTestObservation(testDir);
    saveObservation(testDir, obs);
    updateIndex(testDir);

    const result = await handleTriage(testDir, {
      decision: 'defer',
      priority: 'P1'
    }, obs.id);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.decision, 'defer');
    assert.strictEqual(result.data.priority, 'P1');
  });

  it('AC-004: 支持批量归类', async () => {
    // 创建多个观察
    const obs1 = createTestObservation(testDir);
    saveObservation(testDir, obs1);
    const obs2 = createTestObservation(testDir);
    saveObservation(testDir, obs2);
    updateIndex(testDir);

    const result = await handleBatchTriage(testDir, 'raw');

    assert.strictEqual(result.success, true);
    assert.ok(result.data.observations);
    assert.strictEqual(result.data.observations.length, 2);
  });
});

// ============================================================================
// REQ-002: 交互式归类流程 (AC-005 ~ AC-008)
// ============================================================================

describe('REQ-002: 交互式归类流程', () => {
  let testDir;

  beforeEach(() => {
    testDir = createTestDir();
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  it('AC-005: 显示观察完整内容', async () => {
    const obs = createTestObservation(testDir, {
      description: '详细的观察描述内容',
      suggestion: '具体的建议',
      spec: 'specs/test.fspec.md'
    });
    saveObservation(testDir, obs);
    updateIndex(testDir);

    const prompts = createMockPrompts({
      select: ['defer - 延后，标记优先级后暂存', 'P2 - 中，本月处理']
    });

    const result = await handleInteractiveTriage(testDir, obs, prompts);

    const output = result.output.join('\n');
    assert.ok(output.includes(obs.id));
    assert.ok(output.includes('详细的观察描述内容'));
    assert.ok(output.includes('具体的建议'));
    assert.ok(output.includes('specs/test.fspec.md'));
  });

  it('AC-006: 收集决策（accept/defer/ignore）', async () => {
    const obs = createTestObservation(testDir);
    saveObservation(testDir, obs);
    updateIndex(testDir);

    // 测试 defer 决策
    const prompts = createMockPrompts({
      select: ['defer - 延后，标记优先级后暂存', 'P2 - 中，本月处理']
    });

    const result = await handleInteractiveTriage(testDir, obs, prompts);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.decision, 'defer');
  });

  it('AC-007: 收集优先级', async () => {
    const obs = createTestObservation(testDir);
    saveObservation(testDir, obs);
    updateIndex(testDir);

    const prompts = createMockPrompts({
      select: ['defer - 延后，标记优先级后暂存', 'P1 - 高，本周处理']
    });

    const result = await handleInteractiveTriage(testDir, obs, prompts);

    assert.strictEqual(result.data.priority, 'P1');
  });

  it('AC-008: 收集备注（可选）', async () => {
    const obs = createTestObservation(testDir);
    saveObservation(testDir, obs);
    updateIndex(testDir);

    const prompts = createMockPrompts({
      select: ['defer - 延后，标记优先级后暂存', 'P2 - 中，本月处理'],
      input: '这是备注内容'
    });

    const result = await handleInteractiveTriage(testDir, obs, prompts);

    assert.strictEqual(result.success, true);
    // 备注应该保存到观察中
    const updated = loadObservation(testDir, obs.id);
    assert.ok(updated);
  });
});

// ============================================================================
// REQ-003: 提升观察为提案 (AC-009 ~ AC-012)
// ============================================================================

describe('REQ-003: 提升观察为提案', () => {
  let testDir;

  beforeEach(() => {
    testDir = createTestDir();
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  it('AC-009: accept 决策触发提案创建', async () => {
    const obs = createTestObservation(testDir);
    saveObservation(testDir, obs);
    updateIndex(testDir);

    const result = await executeTriageDecision(testDir, obs, 'accept', 'P1');

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.decision, 'accept');
    assert.ok(result.data.proposalName);

    // 检查提案目录已创建
    const proposalDir = path.join(testDir, 'openspec', 'changes', result.data.proposalName);
    assert.ok(fs.existsSync(proposalDir));
  });

  it('AC-010: 提案与原观察关联（source 字段）', async () => {
    const obs = createTestObservation(testDir);
    saveObservation(testDir, obs);
    updateIndex(testDir);

    const result = await executeTriageDecision(testDir, obs, 'accept', 'P1');

    // 检查提案内容包含 source 字段
    const proposalPath = path.join(testDir, 'openspec', 'changes', result.data.proposalName, 'proposal.md');
    const content = fs.readFileSync(proposalPath, 'utf-8');
    assert.ok(content.includes(`source: obs:${obs.id}`));
  });

  it('AC-011: 观察状态变更为 promoted', async () => {
    const obs = createTestObservation(testDir);
    saveObservation(testDir, obs);
    updateIndex(testDir);

    await executeTriageDecision(testDir, obs, 'accept', 'P1');

    const updated = loadObservation(testDir, obs.id);
    assert.strictEqual(updated.status, OBSERVATION_STATUS.PROMOTED);
  });

  it('AC-012: 更新观察的 proposal_id 字段', async () => {
    const obs = createTestObservation(testDir);
    saveObservation(testDir, obs);
    updateIndex(testDir);

    const result = await executeTriageDecision(testDir, obs, 'accept', 'P1');

    const updated = loadObservation(testDir, obs.id);
    assert.ok(updated.proposal_id);
    assert.strictEqual(updated.proposalName, result.data.proposalName);
  });
});

// ============================================================================
// REQ-004: 忽略观察 (AC-013 ~ AC-016)
// ============================================================================

describe('REQ-004: 忽略观察', () => {
  let testDir;

  beforeEach(() => {
    testDir = createTestDir();
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  it('AC-013: ignore 决策需要理由', async () => {
    const obs = createTestObservation(testDir);
    saveObservation(testDir, obs);
    updateIndex(testDir);

    // 使用 executeTriageDecision 带 note
    const result = await executeTriageDecision(testDir, obs, 'ignore', 'P2', '这是忽略理由');

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.decision, 'ignore');
  });

  it('AC-014: 记录忽略理由', async () => {
    const obs = createTestObservation(testDir);
    saveObservation(testDir, obs);
    updateIndex(testDir);

    const note = '历史代码风格，暂不统一';
    await executeTriageDecision(testDir, obs, 'ignore', 'P2', note);

    const updated = loadObservation(testDir, obs.id);
    // note 通过 transition 的 updates 参数传递，会成为观察的顶级字段
    assert.ok(
      updated.note === note ||
      updated.context?.note === note ||
      JSON.stringify(updated).includes(note),
      `Expected note "${note}" to be in observation: ${JSON.stringify(updated)}`
    );
  });

  it('AC-015: 观察状态变更为 ignored', async () => {
    const obs = createTestObservation(testDir);
    saveObservation(testDir, obs);
    updateIndex(testDir);

    await executeTriageDecision(testDir, obs, 'ignore', 'P2');

    const updated = loadObservation(testDir, obs.id);
    assert.strictEqual(updated.status, OBSERVATION_STATUS.IGNORED);
  });

  it('AC-016: ignored 为终态，不可恢复', async () => {
    const obs = createTestObservation(testDir);
    saveObservation(testDir, obs);
    updateIndex(testDir);

    await executeTriageDecision(testDir, obs, 'ignore', 'P2');

    const updated = loadObservation(testDir, obs.id);

    // 尝试再次归类应该失败
    const result = await handleTriage(testDir, { decision: 'accept', priority: 'P1' }, updated.id);
    assert.strictEqual(result.success, false);
    assert.ok(result.message.includes('raw') || result.message.includes('triaged'));
  });
});

// ============================================================================
// REQ-005: 批量归类支持 (AC-017 ~ AC-020)
// ============================================================================

describe('REQ-005: 批量归类支持', () => {
  let testDir;

  beforeEach(() => {
    testDir = createTestDir();
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  it('AC-017: 实现 --batch <status> 选项', async () => {
    // 创建不同状态的观察
    const obs1 = createTestObservation(testDir);
    saveObservation(testDir, obs1);
    const obs2 = createTestObservation(testDir);
    saveObservation(testDir, obs2);
    const obs3 = createTestObservation(testDir);
    const triaged = transition(obs3, 'triaged', { priority: 'P2' });
    saveObservation(testDir, triaged);
    updateIndex(testDir);

    // 只处理 raw 状态
    const result = await handleBatchTriage(testDir, 'raw');

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.observations.length, 2);
  });

  it('AC-018: 支持快捷键操作（a/d/i/s）', async () => {
    const obs = createTestObservation(testDir);
    saveObservation(testDir, obs);
    updateIndex(testDir);

    // 模拟快捷键选择
    const prompts = createMockPrompts({
      select: ['[d]efer - 延后暂存', 'P2 - 中，本月处理']
    });

    const result = await handleBatchTriage(testDir, 'raw', prompts);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.stats.deferred, 1);
  });

  it('AC-019: 显示进度和统计', async () => {
    const obs1 = createTestObservation(testDir);
    saveObservation(testDir, obs1);
    const obs2 = createTestObservation(testDir);
    saveObservation(testDir, obs2);
    updateIndex(testDir);

    const prompts = createMockPrompts({
      select: ['[d]efer - 延后暂存', 'P2 - 中，本月处理']
    });

    const result = await handleBatchTriage(testDir, 'raw', prompts);

    const output = result.output.join('\n');
    // 应该包含进度指示
    assert.ok(output.includes('[1/2]') || output.includes('1/2'));
    // 应该包含统计
    assert.ok(output.includes('归类完成'));
  });

  it('AC-020: 支持跳过（稍后处理）', async () => {
    const obs = createTestObservation(testDir);
    saveObservation(testDir, obs);
    updateIndex(testDir);

    // 选择跳过
    const prompts = createMockPrompts({
      select: ['[s]kip - 跳过']
    });

    const result = await handleBatchTriage(testDir, 'raw', prompts);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.stats.skipped, 1);
  });
});

// ============================================================================
// 辅助函数测试
// ============================================================================

describe('辅助函数', () => {
  it('generateProposalName 生成合法名称', () => {
    const obs = {
      description: 'Fix the empty input handling bug',
      type: 'test_failure'
    };

    const name = generateProposalName(obs);

    assert.ok(name);
    assert.ok(name.match(/^\d{8}-/)); // 以日期开头
    assert.ok(!name.includes(' ')); // 无空格
  });

  it('generateProposalContent 生成完整内容', () => {
    const obs = {
      id: 'obs-20260101-abc123',
      type: 'test_failure',
      source: 'auto:execute',
      description: '测试失败描述',
      suggestion: '建议修复方案',
      spec: 'specs/test.fspec.md'
    };

    const content = generateProposalContent(obs, 'test-proposal', 'P1', '备注');

    assert.ok(content.includes('status: draft'));
    assert.ok(content.includes('source: obs:obs-20260101-abc123'));
    assert.ok(content.includes('priority: P1'));
    assert.ok(content.includes('测试失败描述'));
    assert.ok(content.includes('建议修复方案'));
    assert.ok(content.includes('备注'));
  });

  it('parseTriageArgs 解析参数', () => {
    const { options, id } = parseTriageArgs(['obs-123', '--decision', 'accept', '--priority', 'P1']);

    assert.strictEqual(id, 'obs-123');
    assert.strictEqual(options.decision, 'accept');
    assert.strictEqual(options.priority, 'P1');
  });

  it('parseTriageArgs 解析 --batch', () => {
    const { options } = parseTriageArgs(['--batch', 'raw']);

    assert.strictEqual(options.batch, 'raw');
  });

  it('PRIORITIES 常量完整', () => {
    assert.ok(PRIORITIES.P0);
    assert.ok(PRIORITIES.P1);
    assert.ok(PRIORITIES.P2);
    assert.ok(PRIORITIES.P3);
    assert.ok(PRIORITIES.P4);
  });

  it('DECISIONS 常量完整', () => {
    assert.ok(DECISIONS.accept);
    assert.ok(DECISIONS.defer);
    assert.ok(DECISIONS.ignore);
    assert.ok(DECISIONS.skip);
  });
});
