/**
 * observation-stats.js 测试
 * @see openspec/changes/v3.0-ace-integration/specs/ace/status-panel-enhance.fspec.md
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  getObservationStats,
  getPriorityDistribution,
  getNonZeroPriorities,
  getPriorityColor,
  getHealthStatus,
  getHealthColor,
  getSuggestedActions,
  renderObservationBlock,
  formatObservationStats
} = require('../../lib/ace/observation-stats');

const {
  createObservation,
  saveObservation,
  transition,
  updateIndex,
  OBSERVATION_TYPES,
  OBSERVATION_SOURCES
} = require('../../lib/ace/observation');

// 测试辅助函数
function createTestDir() {
  const testDir = path.join(os.tmpdir(), `obs-stats-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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
    type: OBSERVATION_TYPES.TEST_FAILURE,
    source: OBSERVATION_SOURCES.AUTO_EXECUTE,
    description: '测试观察',
    context: { testFile: 'test.js', testName: 'should work' },
    ...overrides
  }, projectRoot);

  return obs;
}

// ============================================================================
// REQ-002: 观察统计数据获取
// ============================================================================

describe('REQ-002: 观察统计数据获取', () => {
  let testDir;

  beforeEach(() => {
    testDir = createTestDir();
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  it('AC-005: 实现 getObservationStats() 函数', () => {
    // 创建一些观察
    const obs1 = createTestObservation(testDir);
    saveObservation(testDir, obs1);

    const obs2 = createTestObservation(testDir);
    saveObservation(testDir, obs2);

    updateIndex(testDir);

    const stats = getObservationStats(testDir);

    assert.strictEqual(typeof stats, 'object');
    assert.strictEqual(stats.total, 2);
    assert.strictEqual(stats.raw, 2);
  });

  it('AC-006: 从 index.json 读取统计', () => {
    // 创建索引
    const obsDir = path.join(testDir, '.seed', 'observations');
    fs.mkdirSync(obsDir, { recursive: true });

    const index = {
      version: '1.0.0',
      updated: new Date().toISOString(),
      observations: [],
      stats: { total: 5, raw: 2, triaged: 2, promoted: 1, ignored: 0 }
    };

    fs.writeFileSync(path.join(obsDir, 'index.json'), JSON.stringify(index));

    const stats = getObservationStats(testDir);

    assert.strictEqual(stats.total, 5);
    assert.strictEqual(stats.raw, 2);
    assert.strictEqual(stats.triaged, 2);
    assert.strictEqual(stats.promoted, 1);
  });

  it('AC-007: 索引不存在时返回空统计', () => {
    const stats = getObservationStats(testDir);

    assert.deepStrictEqual(stats, {
      total: 0,
      raw: 0,
      triaged: 0,
      promoted: 0,
      ignored: 0
    });
  });
});

// ============================================================================
// REQ-003: 优先级分布统计
// ============================================================================

describe('REQ-003: 优先级分布统计', () => {
  let testDir;

  beforeEach(() => {
    testDir = createTestDir();
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  it('AC-008: 实现 getPriorityDistribution() 函数', () => {
    // 创建已归类的观察
    const obs1 = createTestObservation(testDir);
    const triaged1 = transition(obs1, 'triaged', { priority: 'P1' });
    saveObservation(testDir, triaged1);

    const obs2 = createTestObservation(testDir);
    const triaged2 = transition(obs2, 'triaged', { priority: 'P2' });
    saveObservation(testDir, triaged2);

    const obs3 = createTestObservation(testDir);
    const triaged3 = transition(obs3, 'triaged', { priority: 'P2' });
    saveObservation(testDir, triaged3);

    updateIndex(testDir);

    const dist = getPriorityDistribution(testDir);

    assert.strictEqual(dist.P0, 0);
    assert.strictEqual(dist.P1, 1);
    assert.strictEqual(dist.P2, 2);
    assert.strictEqual(dist.P3, 0);
    assert.strictEqual(dist.P4, 0);
  });

  it('AC-009: 只显示有数量的优先级', () => {
    const dist = { P0: 0, P1: 2, P2: 0, P3: 3, P4: 0 };
    const nonZero = getNonZeroPriorities(dist);

    assert.deepStrictEqual(nonZero, { P1: 2, P3: 3 });
    assert.ok(!('P0' in nonZero));
    assert.ok(!('P2' in nonZero));
  });

  it('AC-010: P0/P1 使用醒目颜色', () => {
    assert.strictEqual(getPriorityColor('P0'), 'red');
    assert.strictEqual(getPriorityColor('P1'), 'yellow');
    assert.strictEqual(getPriorityColor('P2'), 'default');
    assert.strictEqual(getPriorityColor('P3'), 'default');
    assert.strictEqual(getPriorityColor('P4'), 'default');
  });
});

// ============================================================================
// REQ-004: 观察健康度指示
// ============================================================================

describe('REQ-004: 观察健康度指示', () => {
  it('AC-011: 实现健康度计算逻辑', () => {
    // 健康状态
    const healthyStats = { total: 3, raw: 3, triaged: 0, promoted: 0, ignored: 0 };
    const healthyResult = getHealthStatus(healthyStats);
    assert.strictEqual(healthyResult.status, 'healthy');

    // 注意状态
    const attentionStats = { total: 8, raw: 8, triaged: 0, promoted: 0, ignored: 0 };
    const attentionResult = getHealthStatus(attentionStats);
    assert.strictEqual(attentionResult.status, 'attention');

    // 积压状态
    const backlogStats = { total: 15, raw: 15, triaged: 0, promoted: 0, ignored: 0 };
    const backlogResult = getHealthStatus(backlogStats);
    assert.strictEqual(backlogResult.status, 'backlog');
  });

  it('AC-011: 高优先级触发紧急状态', () => {
    const stats = { total: 2, raw: 0, triaged: 2, promoted: 0, ignored: 0 };
    const priorityDist = { P0: 1, P1: 1, P2: 0, P3: 0, P4: 0 };

    const result = getHealthStatus(stats, priorityDist);
    assert.strictEqual(result.status, 'critical');
    assert.ok(result.message.includes('高优先级'));
  });

  it('AC-012: 根据健康度显示不同颜色', () => {
    assert.strictEqual(getHealthColor('healthy'), 'green');
    assert.strictEqual(getHealthColor('attention'), 'yellow');
    assert.strictEqual(getHealthColor('backlog'), 'red');
    assert.strictEqual(getHealthColor('critical'), 'red');
  });

  it('AC-013: 积压时显示警告提示', () => {
    const stats = { total: 12, raw: 12, triaged: 0, promoted: 0, ignored: 0 };
    const result = getHealthStatus(stats);

    assert.strictEqual(result.status, 'backlog');
    assert.strictEqual(result.icon, '❗');
    assert.ok(result.message.includes('积压'));
    assert.ok(result.message.includes('12'));
  });
});

// ============================================================================
// REQ-005: 快捷操作入口
// ============================================================================

describe('REQ-005: 快捷操作入口', () => {
  it('AC-014: 根据状态生成操作建议', () => {
    const stats = { total: 5, raw: 3, triaged: 1, promoted: 1, ignored: 0 };
    const priorityDist = { P0: 0, P1: 1, P2: 0, P3: 0, P4: 0 };

    const actions = getSuggestedActions(stats, priorityDist);

    assert.ok(actions.length > 0);

    // 应该包含 triage 命令
    const triageAction = actions.find(a => a.command.includes('triage'));
    assert.ok(triageAction);
  });

  it('AC-015: 建议可直接复制执行', () => {
    const stats = { total: 5, raw: 3, triaged: 1, promoted: 1, ignored: 0 };

    const actions = getSuggestedActions(stats);

    for (const action of actions) {
      // 命令应该以 / 开头
      assert.ok(action.command.startsWith('/'), `命令应以 / 开头: ${action.command}`);
      // 命令应该包含 mob-seed
      assert.ok(action.command.includes('mob-seed'), `命令应包含 mob-seed: ${action.command}`);
    }
  });

  it('AC-016: 优先显示高优先级操作', () => {
    const stats = { total: 5, raw: 3, triaged: 2, promoted: 0, ignored: 0 };
    const priorityDist = { P0: 1, P1: 1, P2: 0, P3: 0, P4: 0 };

    const actions = getSuggestedActions(stats, priorityDist);

    // P0 应该排在最前
    assert.ok(actions[0].command.includes('P0'));
    // P1 应该排在第二
    assert.ok(actions[1].command.includes('P1'));
  });

  it('无观察时返回空建议', () => {
    const stats = { total: 0, raw: 0, triaged: 0, promoted: 0, ignored: 0 };

    const actions = getSuggestedActions(stats);
    assert.strictEqual(actions.length, 0);
  });
});

// ============================================================================
// REQ-001: 状态面板观察区块
// ============================================================================

describe('REQ-001: 状态面板观察区块', () => {
  let testDir;

  beforeEach(() => {
    testDir = createTestDir();
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  it('AC-001: 在状态面板添加"观察状态"区块', () => {
    // 创建观察
    const obs = createTestObservation(testDir);
    saveObservation(testDir, obs);
    updateIndex(testDir);

    const lines = renderObservationBlock(testDir);

    assert.ok(lines.length > 0);
    assert.ok(lines[0].includes('观察状态'));
  });

  it('AC-002: 显示各状态数量统计', () => {
    // 创建不同状态的观察
    const obs1 = createTestObservation(testDir);
    saveObservation(testDir, obs1);

    const obs2 = createTestObservation(testDir);
    const triaged = transition(obs2, 'triaged', { priority: 'P2' });
    saveObservation(testDir, triaged);

    updateIndex(testDir);

    const lines = renderObservationBlock(testDir);
    const output = lines.join('\n');

    assert.ok(output.includes('待处理'), '应显示待处理');
    assert.ok(output.includes('已归类'), '应显示已归类');
  });

  it('AC-003: triaged 状态按优先级细分', () => {
    // 创建不同优先级的已归类观察
    const obs1 = createTestObservation(testDir);
    const triaged1 = transition(obs1, 'triaged', { priority: 'P1' });
    saveObservation(testDir, triaged1);

    const obs2 = createTestObservation(testDir);
    const triaged2 = transition(obs2, 'triaged', { priority: 'P2' });
    saveObservation(testDir, triaged2);

    updateIndex(testDir);

    const lines = renderObservationBlock(testDir);
    const output = lines.join('\n');

    assert.ok(output.includes('P1'), '应显示 P1');
    assert.ok(output.includes('P2'), '应显示 P2');
  });

  it('AC-004: 显示操作提示', () => {
    // 创建观察
    const obs = createTestObservation(testDir);
    saveObservation(testDir, obs);
    updateIndex(testDir);

    const lines = renderObservationBlock(testDir);
    const output = lines.join('\n');

    assert.ok(output.includes('建议操作') || output.includes('/mob-seed'), '应显示操作提示');
  });

  it('无观察时返回空数组', () => {
    const lines = renderObservationBlock(testDir);
    assert.strictEqual(lines.length, 0);
  });

  it('formatObservationStats 返回格式化字符串', () => {
    // 创建观察
    const obs = createTestObservation(testDir);
    saveObservation(testDir, obs);
    updateIndex(testDir);

    const output = formatObservationStats(testDir);

    assert.strictEqual(typeof output, 'string');
    assert.ok(output.includes('观察状态'));
  });
});
