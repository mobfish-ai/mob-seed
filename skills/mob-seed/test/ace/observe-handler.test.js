/**
 * observe-handler.js 测试
 * @see openspec/changes/v3.0-ace-integration/specs/ace/spec-observe-command.fspec.md
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  handleObserve,
  handleQuickAdd,
  handleInteractiveAdd,
  handleList,
  handleShow,
  handleDelete,
  parseObserveArgs,
  formatRelativeTime,
  formatDateTime
} = require('../../lib/ace/observe-handler');

const {
  createObservation,
  saveObservation,
  transition,
  updateIndex,
  OBSERVATION_TYPES,
  OBSERVATION_SOURCES,
  OBSERVATION_STATUS
} = require('../../lib/ace/observation');

// 测试辅助函数
function createTestDir() {
  const testDir = path.join(os.tmpdir(), `obs-handler-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(testDir, { recursive: true });
  return testDir;
}

function cleanupTestDir(testDir) {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

function createTestObservation(projectRoot, overrides = {}) {
  const obs = createObservation({
    type: OBSERVATION_TYPES.USER_FEEDBACK,
    source: OBSERVATION_SOURCES.MANUAL,
    description: '测试观察',
    context: {},
    ...overrides
  }, projectRoot);

  return obs;
}

// Mock prompts 接口
function createMockPrompts(answers = {}) {
  return {
    select: async (question, options) => answers.select || options[0],
    input: async (question, required) => answers.input || (required ? '测试输入' : ''),
    confirm: async (question) => answers.confirm !== undefined ? answers.confirm : true
  };
}

// ============================================================================
// REQ-001: 添加观察命令 (AC-001 ~ AC-004)
// ============================================================================

describe('REQ-001: 添加观察命令', () => {
  let testDir;

  beforeEach(() => {
    testDir = createTestDir();
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  it('AC-001: 实现 /mob-seed:spec observe 子操作', async () => {
    // 无参数时返回帮助信息
    const result = await handleObserve(testDir, {});

    assert.strictEqual(result.success, false);
    assert.ok(result.output);
    assert.ok(result.output.some(line => line.includes('用法')));
  });

  it('AC-002: 支持交互式模式', async () => {
    const prompts = createMockPrompts({
      select: 'user_feedback - 用户/团队反馈',
      input: '这是交互式输入的描述'
    });

    const result = await handleInteractiveAdd(testDir, prompts);

    assert.strictEqual(result.success, true);
    assert.ok(result.data.id);
    assert.ok(result.data.observation);
    assert.strictEqual(result.data.observation.type, 'user_feedback');
    assert.strictEqual(result.data.observation.description, '这是交互式输入的描述');
  });

  it('AC-003: 支持快速模式（命令行参数）', async () => {
    const result = await handleQuickAdd(testDir, {}, '快速添加的观察描述');

    assert.strictEqual(result.success, true);
    assert.ok(result.data.id);
    assert.strictEqual(result.data.observation.description, '快速添加的观察描述');
  });

  it('AC-004: 创建的观察 source 为 manual', async () => {
    const result = await handleQuickAdd(testDir, {}, '测试 source');

    assert.strictEqual(result.data.observation.source, OBSERVATION_SOURCES.MANUAL);
  });
});

// ============================================================================
// REQ-002: 交互式信息收集 (AC-005 ~ AC-008)
// ============================================================================

describe('REQ-002: 交互式信息收集', () => {
  let testDir;

  beforeEach(() => {
    testDir = createTestDir();
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  it('AC-005: 询问观察类型（选择题）', async () => {
    let askedType = false;
    const prompts = {
      select: async (question, options) => {
        if (question.includes('类型')) {
          askedType = true;
          assert.ok(options.some(o => o.includes('user_feedback')));
          assert.ok(options.some(o => o.includes('pattern_insight')));
        }
        return 'user_feedback - 用户/团队反馈';
      },
      input: async () => '描述',
      confirm: async () => true
    };

    await handleInteractiveAdd(testDir, prompts);
    assert.strictEqual(askedType, true);
  });

  it('AC-006: 询问关联规格（可选，支持自动补全）', async () => {
    let askedSpec = false;
    const prompts = {
      select: async () => 'user_feedback - 用户/团队反馈',
      input: async (question, required) => {
        if (question.includes('规格')) {
          askedSpec = true;
          assert.strictEqual(required, false); // 可选
          return 'specs/test.fspec.md';
        }
        return '描述';
      },
      confirm: async () => true
    };

    const result = await handleInteractiveAdd(testDir, prompts);
    assert.strictEqual(askedSpec, true);
    assert.strictEqual(result.data.observation.spec, 'specs/test.fspec.md');
  });

  it('AC-007: 询问观察描述（必填）', async () => {
    let askedDescription = false;
    const prompts = {
      select: async () => 'user_feedback - 用户/团队反馈',
      input: async (question, required) => {
        if (question.includes('描述')) {
          askedDescription = true;
          assert.strictEqual(required, true); // 必填
          return '这是必填的描述';
        }
        return '';
      },
      confirm: async () => true
    };

    const result = await handleInteractiveAdd(testDir, prompts);
    assert.strictEqual(askedDescription, true);
    assert.strictEqual(result.data.observation.description, '这是必填的描述');
  });

  it('AC-008: 询问建议（可选）', async () => {
    let askedSuggestion = false;
    const prompts = {
      select: async () => 'user_feedback - 用户/团队反馈',
      input: async (question, required) => {
        if (question.includes('建议')) {
          askedSuggestion = true;
          assert.strictEqual(required, false); // 可选
          return '这是可选的建议';
        }
        if (question.includes('描述')) return '描述';
        return '';
      },
      confirm: async () => true
    };

    const result = await handleInteractiveAdd(testDir, prompts);
    assert.strictEqual(askedSuggestion, true);
    assert.strictEqual(result.data.observation.suggestion, '这是可选的建议');
  });
});

// ============================================================================
// REQ-003: 列出观察命令 (AC-009 ~ AC-012)
// ============================================================================

describe('REQ-003: 列出观察命令', () => {
  let testDir;

  beforeEach(() => {
    testDir = createTestDir();
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  it('AC-009: 实现 --list 选项', () => {
    // 创建一些观察
    const obs1 = createTestObservation(testDir);
    saveObservation(testDir, obs1);
    const obs2 = createTestObservation(testDir);
    saveObservation(testDir, obs2);
    updateIndex(testDir);

    const result = handleList(testDir, {});

    assert.strictEqual(result.success, true);
    assert.ok(result.data.observations);
    assert.strictEqual(result.data.observations.length, 2);
  });

  it('AC-010: 支持 --status 过滤', () => {
    // 创建不同状态的观察
    const obs1 = createTestObservation(testDir);
    saveObservation(testDir, obs1);

    const obs2 = createTestObservation(testDir);
    const triaged = transition(obs2, 'triaged', { priority: 'P2' });
    saveObservation(testDir, triaged);

    updateIndex(testDir);

    // 只列出 raw 状态
    const result = handleList(testDir, { status: 'raw' });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.observations.length, 1);
    assert.strictEqual(result.data.observations[0].status, 'raw');
  });

  it('AC-011: 显示状态分组统计', () => {
    // 创建不同状态的观察
    const obs1 = createTestObservation(testDir);
    saveObservation(testDir, obs1);

    const obs2 = createTestObservation(testDir);
    saveObservation(testDir, obs2);

    const obs3 = createTestObservation(testDir);
    const triaged = transition(obs3, 'triaged', { priority: 'P2' });
    saveObservation(testDir, triaged);

    updateIndex(testDir);

    const result = handleList(testDir, {});

    assert.ok(result.output);
    const output = result.output.join('\n');
    // 应该包含状态统计
    assert.ok(output.includes('raw:') || output.includes('2'));
  });

  it('AC-012: 显示时间相对表示', () => {
    // 测试 formatRelativeTime
    const now = new Date().toISOString();
    const relative = formatRelativeTime(now);
    assert.strictEqual(relative, 'just now');

    // 1 小时前
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const hourRelative = formatRelativeTime(oneHourAgo);
    assert.ok(hourRelative.includes('h ago'));

    // 1 天前
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const dayRelative = formatRelativeTime(oneDayAgo);
    assert.ok(dayRelative.includes('d ago'));
  });
});

// ============================================================================
// REQ-004: 查看观察详情 (AC-013 ~ AC-015)
// ============================================================================

describe('REQ-004: 查看观察详情', () => {
  let testDir;

  beforeEach(() => {
    testDir = createTestDir();
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  it('AC-013: 实现 --show <id> 选项', () => {
    const obs = createTestObservation(testDir, { description: '详情测试' });
    saveObservation(testDir, obs);
    updateIndex(testDir);

    const result = handleShow(testDir, obs.id);

    assert.strictEqual(result.success, true);
    assert.ok(result.data.observation);
    assert.strictEqual(result.data.observation.id, obs.id);
  });

  it('AC-013: 不存在的 ID 返回错误', () => {
    const result = handleShow(testDir, 'obs-99999999-nonexistent');

    assert.strictEqual(result.success, false);
    assert.ok(result.message.includes('不存在'));
  });

  it('AC-014: 显示完整观察内容', () => {
    const obs = createTestObservation(testDir, {
      description: '完整内容测试',
      spec: 'specs/test.fspec.md'
    });
    saveObservation(testDir, obs);
    updateIndex(testDir);

    const result = handleShow(testDir, obs.id);

    assert.ok(result.output);
    const output = result.output.join('\n');
    assert.ok(output.includes(obs.id));
    assert.ok(output.includes('完整内容测试'));
    assert.ok(output.includes('specs/test.fspec.md'));
    assert.ok(output.includes('类型'));
    assert.ok(output.includes('状态'));
  });

  it('AC-015: 显示可执行的后续操作', () => {
    const obs = createTestObservation(testDir);
    saveObservation(testDir, obs);
    updateIndex(testDir);

    const result = handleShow(testDir, obs.id);

    const output = result.output.join('\n');
    // raw 状态应该显示 triage 和 delete 操作
    assert.ok(output.includes('操作'));
    assert.ok(output.includes('triage') || output.includes('delete'));
  });
});

// ============================================================================
// REQ-005: 删除观察 (AC-016 ~ AC-019)
// ============================================================================

describe('REQ-005: 删除观察', () => {
  let testDir;

  beforeEach(() => {
    testDir = createTestDir();
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  it('AC-016: 实现 --delete <id> 选项', async () => {
    const obs = createTestObservation(testDir);
    saveObservation(testDir, obs);
    updateIndex(testDir);

    const result = await handleDelete(testDir, obs.id);

    assert.strictEqual(result.success, true);
    assert.ok(result.message.includes('已删除'));
  });

  it('AC-016: 删除不存在的观察返回错误', async () => {
    const result = await handleDelete(testDir, 'obs-99999999-nonexistent');

    assert.strictEqual(result.success, false);
    assert.ok(result.message.includes('不存在'));
  });

  it('AC-017: 只允许删除 raw 状态的观察', async () => {
    const obs = createTestObservation(testDir);
    const triaged = transition(obs, 'triaged', { priority: 'P2' });
    saveObservation(testDir, triaged);
    updateIndex(testDir);

    const result = await handleDelete(testDir, triaged.id);

    assert.strictEqual(result.success, false);
    assert.ok(result.message.includes('raw'));
  });

  it('AC-018: 删除前需确认', async () => {
    const obs = createTestObservation(testDir);
    saveObservation(testDir, obs);
    updateIndex(testDir);

    // 测试取消确认
    const prompts = createMockPrompts({ confirm: false });
    const result = await handleDelete(testDir, obs.id, prompts);

    assert.strictEqual(result.success, false);
    assert.ok(result.message.includes('取消'));
  });

  it('AC-019: 删除后更新索引', async () => {
    const obs = createTestObservation(testDir);
    saveObservation(testDir, obs);
    updateIndex(testDir);

    await handleDelete(testDir, obs.id);

    // 索引应该不再包含该观察
    const indexPath = path.join(testDir, '.seed', 'observations', 'index.json');
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    const found = index.observations.find(o => o.id === obs.id);
    assert.strictEqual(found, undefined);
  });
});

// ============================================================================
// 参数解析测试
// ============================================================================

describe('参数解析', () => {
  it('解析 --list 选项', () => {
    const { options } = parseObserveArgs(['--list']);
    assert.strictEqual(options.list, true);
  });

  it('解析 --status 选项', () => {
    const { options } = parseObserveArgs(['--list', '--status', 'raw']);
    assert.strictEqual(options.list, true);
    assert.strictEqual(options.status, 'raw');
  });

  it('解析 --show 选项', () => {
    const { options } = parseObserveArgs(['--show', 'obs-123']);
    assert.strictEqual(options.show, 'obs-123');
  });

  it('解析 --delete 选项', () => {
    const { options } = parseObserveArgs(['--delete', 'obs-123']);
    assert.strictEqual(options.delete, 'obs-123');
  });

  it('解析 --type 选项', () => {
    const { options } = parseObserveArgs(['--type', 'user_feedback', '描述']);
    assert.strictEqual(options.type, 'user_feedback');
  });

  it('解析 --spec 选项', () => {
    const { options } = parseObserveArgs(['--spec', 'specs/test.fspec.md', '描述']);
    assert.strictEqual(options.spec, 'specs/test.fspec.md');
  });

  it('解析 --priority 选项', () => {
    const { options } = parseObserveArgs(['--priority', 'P1', '描述']);
    assert.strictEqual(options.priority, 'P1');
  });

  it('解析描述参数', () => {
    const { description } = parseObserveArgs(['--type', 'user_feedback', '这是', '描述', '内容']);
    assert.strictEqual(description, '这是 描述 内容');
  });

  it('无参数时返回空', () => {
    const { options, description } = parseObserveArgs([]);
    assert.deepStrictEqual(options, {});
    assert.strictEqual(description, undefined);
  });
});

// ============================================================================
// 辅助函数测试
// ============================================================================

describe('辅助函数', () => {
  it('formatRelativeTime 处理各种时间', () => {
    // just now
    const now = new Date().toISOString();
    assert.strictEqual(formatRelativeTime(now), 'just now');

    // 5 分钟前
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    assert.strictEqual(formatRelativeTime(fiveMinAgo), '5m ago');

    // 3 小时前
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    assert.strictEqual(formatRelativeTime(threeHoursAgo), '3h ago');

    // 5 天前
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    assert.strictEqual(formatRelativeTime(fiveDaysAgo), '5d ago');
  });

  it('formatDateTime 返回格式化字符串', () => {
    const date = '2025-01-01T12:30:45.000Z';
    const formatted = formatDateTime(date);
    assert.strictEqual(typeof formatted, 'string');
    assert.ok(formatted.length > 0);
  });
});
