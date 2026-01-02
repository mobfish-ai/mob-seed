/**
 * ACE 观察模块测试
 * @see openspec/changes/v3.0-ace-integration/specs/ace/observation.fspec.md
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  // 类型常量
  OBSERVATION_TYPES,
  OBSERVATION_STATUS,
  OBSERVATION_SOURCES,

  // 状态机
  STATE_TRANSITIONS,
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
} = require('../../lib/ace/observation');

// 测试用临时目录
let testDir;

function setupTestDir() {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'obs-test-'));
  fs.mkdirSync(path.join(testDir, '.seed'), { recursive: true });
}

function cleanupTestDir() {
  if (testDir && fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

// ============================================================================
// REQ-001: 观察数据结构定义 (AC-001 ~ AC-004)
// ============================================================================

describe('REQ-001: 观察数据结构定义', () => {

  it('AC-001: 定义 Observation 类型', () => {
    // 通过 createObservation 验证类型结构
    const obs = createObservation({
      type: OBSERVATION_TYPES.TEST_FAILURE,
      source: OBSERVATION_SOURCES.AUTO_EXECUTE,
      description: '测试失败'
    });

    assert.ok(obs.id, '应有 id');
    assert.strictEqual(obs.type, 'test_failure', '应有 type');
    assert.strictEqual(obs.source, 'auto:execute', '应有 source');
    assert.ok(obs.created, '应有 created');
    assert.ok(obs.updated, '应有 updated');
    assert.strictEqual(obs.status, 'raw', '应有 status');
    assert.strictEqual(obs.description, '测试失败', '应有 description');
    assert.ok(obs.context, '应有 context');
  });

  it('AC-002: 定义 ObservationType 枚举', () => {
    assert.strictEqual(OBSERVATION_TYPES.TEST_FAILURE, 'test_failure');
    assert.strictEqual(OBSERVATION_TYPES.COVERAGE_GAP, 'coverage_gap');
    assert.strictEqual(OBSERVATION_TYPES.SPEC_DRIFT, 'spec_drift');
    assert.strictEqual(OBSERVATION_TYPES.USER_FEEDBACK, 'user_feedback');
    assert.strictEqual(OBSERVATION_TYPES.PATTERN_INSIGHT, 'pattern_insight');
    assert.strictEqual(Object.keys(OBSERVATION_TYPES).length, 5);
  });

  it('AC-003: 定义 ObservationStatus 枚举', () => {
    assert.strictEqual(OBSERVATION_STATUS.RAW, 'raw');
    assert.strictEqual(OBSERVATION_STATUS.TRIAGED, 'triaged');
    assert.strictEqual(OBSERVATION_STATUS.PROMOTED, 'promoted');
    assert.strictEqual(OBSERVATION_STATUS.IGNORED, 'ignored');
    assert.strictEqual(Object.keys(OBSERVATION_STATUS).length, 4);
  });

  it('AC-004: 导出类型定义', () => {
    // 验证所有导出
    assert.ok(OBSERVATION_TYPES, 'OBSERVATION_TYPES 应导出');
    assert.ok(OBSERVATION_STATUS, 'OBSERVATION_STATUS 应导出');
    assert.ok(OBSERVATION_SOURCES, 'OBSERVATION_SOURCES 应导出');
    assert.ok(typeof createObservation === 'function', 'createObservation 应导出');
    assert.ok(typeof isValidType === 'function', 'isValidType 应导出');
    assert.ok(typeof isValidStatus === 'function', 'isValidStatus 应导出');
  });

});

// ============================================================================
// REQ-002: 观察状态机 (AC-005 ~ AC-008)
// ============================================================================

describe('REQ-002: 观察状态机', () => {

  it('AC-005: 实现 canTransition(from, to) 函数', () => {
    // raw 可转换到 triaged, ignored
    assert.strictEqual(canTransition('raw', 'triaged'), true);
    assert.strictEqual(canTransition('raw', 'ignored'), true);
    assert.strictEqual(canTransition('raw', 'promoted'), false);

    // triaged 可转换到 promoted, ignored
    assert.strictEqual(canTransition('triaged', 'promoted'), true);
    assert.strictEqual(canTransition('triaged', 'ignored'), true);
    assert.strictEqual(canTransition('triaged', 'raw'), false);

    // 终态不可转换
    assert.strictEqual(canTransition('promoted', 'raw'), false);
    assert.strictEqual(canTransition('promoted', 'triaged'), false);
    assert.strictEqual(canTransition('ignored', 'raw'), false);
    assert.strictEqual(canTransition('ignored', 'triaged'), false);
  });

  it('AC-006: 实现 transition(obs, newStatus) 函数', () => {
    const obs = createObservation({
      type: OBSERVATION_TYPES.TEST_FAILURE,
      source: OBSERVATION_SOURCES.AUTO_EXECUTE,
      description: '测试失败'
    });

    const triaged = transition(obs, 'triaged', { priority: 'P1' });
    assert.strictEqual(triaged.status, 'triaged');
    assert.strictEqual(triaged.priority, 'P1');
  });

  it('AC-007: 终态（promoted, ignored）不可转换', () => {
    const promotedObs = {
      id: 'obs-test',
      status: 'promoted',
      type: 'test_failure',
      source: 'manual',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      description: 'test'
    };

    assert.throws(
      () => transition(promotedObs, 'raw'),
      /终态不可转换/
    );

    const ignoredObs = { ...promotedObs, status: 'ignored' };
    assert.throws(
      () => transition(ignoredObs, 'triaged'),
      /终态不可转换/
    );
  });

  it('AC-008: 转换时更新 updated 时间戳', () => {
    // 创建一个旧时间戳的观察
    const oldTime = new Date('2020-01-01T00:00:00Z').toISOString();
    const obs = {
      id: 'obs-test-008',
      type: OBSERVATION_TYPES.TEST_FAILURE,
      source: OBSERVATION_SOURCES.AUTO_EXECUTE,
      created: oldTime,
      updated: oldTime,
      status: 'raw',
      description: '测试失败',
      context: {}
    };

    const triaged = transition(obs, 'triaged');

    // 新的 updated 应该大于旧的
    assert.ok(new Date(triaged.updated) > new Date(oldTime), 'updated 应该被更新为更新的时间');
  });

});

// ============================================================================
// REQ-003: 观察存储格式 (AC-009 ~ AC-012)
// ============================================================================

describe('REQ-003: 观察存储格式', () => {

  beforeEach(() => {
    setupTestDir();
  });

  afterEach(() => {
    cleanupTestDir();
  });

  it('AC-009: 实现 saveObservation(obs) 函数', () => {
    const obs = createObservation({
      type: OBSERVATION_TYPES.TEST_FAILURE,
      source: OBSERVATION_SOURCES.AUTO_EXECUTE,
      description: '测试失败',
      context: { error: 'TypeError', file: 'test.js', line: 10 },
      spec: 'openspec/specs/test.fspec.md',
      suggestion: '添加空值检查'
    }, testDir);

    const filePath = saveObservation(testDir, obs);

    assert.ok(fs.existsSync(filePath), '文件应存在');
    assert.ok(filePath.endsWith(`${obs.id}.md`), '文件名应为 {id}.md');
  });

  it('AC-010: 实现 loadObservation(id) 函数', () => {
    const obs = createObservation({
      type: OBSERVATION_TYPES.USER_FEEDBACK,
      source: OBSERVATION_SOURCES.MANUAL,
      description: '用户反馈',
      context: { error: '功能缺失' }
    }, testDir);

    saveObservation(testDir, obs);
    const loaded = loadObservation(testDir, obs.id);

    assert.strictEqual(loaded.id, obs.id);
    assert.strictEqual(loaded.type, obs.type);
    assert.strictEqual(loaded.description, obs.description);
    assert.strictEqual(loaded.status, 'raw');
  });

  it('AC-010: loadObservation 不存在返回 null', () => {
    const result = loadObservation(testDir, 'non-existent');
    assert.strictEqual(result, null);
  });

  it('AC-011: 文件名格式为 {id}.md', () => {
    const obs = createObservation({
      type: OBSERVATION_TYPES.SPEC_DRIFT,
      source: OBSERVATION_SOURCES.AUTO_DEFEND,
      description: '规格偏离'
    }, testDir);

    const filePath = saveObservation(testDir, obs);
    const fileName = path.basename(filePath);

    assert.strictEqual(fileName, `${obs.id}.md`);
  });

  it('AC-012: YAML frontmatter 包含所有必需字段', () => {
    const obs = createObservation({
      type: OBSERVATION_TYPES.COVERAGE_GAP,
      source: OBSERVATION_SOURCES.AUTO_EXECUTE,
      description: '覆盖率不足',
      spec: 'test.fspec.md'
    }, testDir);

    const markdown = observationToMarkdown(obs);

    // 验证 frontmatter 字段
    assert.ok(markdown.includes(`id: ${obs.id}`), '应包含 id');
    assert.ok(markdown.includes(`type: ${obs.type}`), '应包含 type');
    assert.ok(markdown.includes(`source: ${obs.source}`), '应包含 source');
    assert.ok(markdown.includes(`created: ${obs.created}`), '应包含 created');
    assert.ok(markdown.includes(`updated: ${obs.updated}`), '应包含 updated');
    assert.ok(markdown.includes(`status: ${obs.status}`), '应包含 status');
    assert.ok(markdown.includes(`spec: ${obs.spec}`), '应包含 spec');
  });

  it('Markdown 往返测试 (序列化-反序列化)', () => {
    const obs = createObservation({
      type: OBSERVATION_TYPES.TEST_FAILURE,
      source: OBSERVATION_SOURCES.AUTO_EXECUTE,
      description: '测试 `should handle empty` 失败',
      context: {
        error: 'TypeError: Cannot read property',
        file: 'test/parser.test.js',
        line: 45,
        runId: 'run-12345'
      },
      spec: 'openspec/specs/parser.fspec.md',
      suggestion: '添加 AC: 输入为空时返回空数组'
    }, testDir);

    const markdown = observationToMarkdown(obs);
    const parsed = parseObservationMarkdown(markdown);

    assert.strictEqual(parsed.id, obs.id);
    assert.strictEqual(parsed.type, obs.type);
    assert.strictEqual(parsed.source, obs.source);
    assert.strictEqual(parsed.status, obs.status);
    assert.strictEqual(parsed.description, obs.description);
    assert.strictEqual(parsed.context.error, obs.context.error);
    assert.strictEqual(parsed.context.file, obs.context.file);
    assert.strictEqual(parsed.context.line, obs.context.line);
    assert.strictEqual(parsed.suggestion, obs.suggestion);
  });

});

// ============================================================================
// REQ-004: 观察索引管理 (AC-013 ~ AC-016)
// ============================================================================

describe('REQ-004: 观察索引管理', () => {

  beforeEach(() => {
    setupTestDir();
  });

  afterEach(() => {
    cleanupTestDir();
  });

  it('AC-013: 实现 updateIndex() 函数', () => {
    // 创建几个观察
    const obs1 = createObservation({
      type: OBSERVATION_TYPES.TEST_FAILURE,
      source: OBSERVATION_SOURCES.AUTO_EXECUTE,
      description: '失败 1'
    }, testDir);
    saveObservation(testDir, obs1);

    const obs2 = createObservation({
      type: OBSERVATION_TYPES.SPEC_DRIFT,
      source: OBSERVATION_SOURCES.AUTO_DEFEND,
      description: '偏离 1'
    }, testDir);
    saveObservation(testDir, obs2);

    const index = updateIndex(testDir);

    assert.strictEqual(index.version, '1.0.0');
    assert.ok(index.updated);
    assert.strictEqual(index.observations.length, 2);
    assert.strictEqual(index.stats.total, 2);
    assert.strictEqual(index.stats.raw, 2);
  });

  it('AC-014: 实现 listObservations(filter) 函数', () => {
    // 创建不同状态的观察
    const rawObs = createObservation({
      type: OBSERVATION_TYPES.TEST_FAILURE,
      source: OBSERVATION_SOURCES.AUTO_EXECUTE,
      description: 'raw obs'
    }, testDir);
    saveObservation(testDir, rawObs);

    const triagedObs = createObservation({
      type: OBSERVATION_TYPES.USER_FEEDBACK,
      source: OBSERVATION_SOURCES.MANUAL,
      description: 'triaged obs'
    }, testDir);
    const updated = transition(triagedObs, 'triaged');
    saveObservation(testDir, updated);

    // 测试过滤
    const allObs = listObservations(testDir);
    assert.strictEqual(allObs.length, 2);

    const rawOnly = listObservations(testDir, { status: 'raw' });
    assert.strictEqual(rawOnly.length, 1);
    assert.strictEqual(rawOnly[0].id, rawObs.id);

    const triagedOnly = listObservations(testDir, { status: 'triaged' });
    assert.strictEqual(triagedOnly.length, 1);
  });

  it('AC-015: 实现 getStats() 函数', () => {
    const obs = createObservation({
      type: OBSERVATION_TYPES.TEST_FAILURE,
      source: OBSERVATION_SOURCES.AUTO_EXECUTE,
      description: 'test'
    }, testDir);
    saveObservation(testDir, obs);

    updateIndex(testDir);
    const stats = getStats(testDir);

    assert.strictEqual(stats.total, 1);
    assert.strictEqual(stats.raw, 1);
    assert.strictEqual(stats.triaged, 0);
    assert.strictEqual(stats.promoted, 0);
    assert.strictEqual(stats.ignored, 0);
  });

  it('AC-015: getStats 无索引时返回空统计', () => {
    const stats = getStats(testDir);

    assert.strictEqual(stats.total, 0);
    assert.strictEqual(stats.raw, 0);
  });

  it('AC-016: 索引文件路径为 .seed/observations/index.json', () => {
    const obs = createObservation({
      type: OBSERVATION_TYPES.TEST_FAILURE,
      source: OBSERVATION_SOURCES.AUTO_EXECUTE,
      description: 'test'
    }, testDir);
    saveObservation(testDir, obs);

    updateIndex(testDir);

    const indexPath = path.join(testDir, '.seed', 'observations', 'index.json');
    assert.ok(fs.existsSync(indexPath), '索引文件应存在');

    const content = fs.readFileSync(indexPath, 'utf-8');
    const index = JSON.parse(content);
    assert.strictEqual(index.version, '1.0.0');
  });

});

// ============================================================================
// REQ-005: 观察 ID 生成 (AC-017 ~ AC-019)
// ============================================================================

describe('REQ-005: 观察 ID 生成', () => {

  beforeEach(() => {
    setupTestDir();
  });

  afterEach(() => {
    cleanupTestDir();
  });

  it('AC-017: 实现 generateObservationId() 函数', () => {
    const id = generateObservationId();
    assert.ok(id, 'ID 不应为空');
    assert.ok(typeof id === 'string', 'ID 应为字符串');
  });

  it('AC-018: ID 格式为 obs-{日期}-{6位随机字符}', () => {
    const id = generateObservationId();

    // 格式: obs-YYYYMMDD-xxxxxx
    const pattern = /^obs-\d{8}-[a-f0-9]{6}$/;
    assert.ok(pattern.test(id), `ID 格式不正确: ${id}`);

    // 验证日期部分
    const dateStr = id.split('-')[1];
    const year = parseInt(dateStr.slice(0, 4), 10);
    const month = parseInt(dateStr.slice(4, 6), 10);
    const day = parseInt(dateStr.slice(6, 8), 10);

    assert.ok(year >= 2020 && year <= 2100, '年份应在合理范围');
    assert.ok(month >= 1 && month <= 12, '月份应在 1-12');
    assert.ok(day >= 1 && day <= 31, '日期应在 1-31');
  });

  it('AC-019: 确保 ID 唯一性（检查已存在文件）', () => {
    // 生成多个 ID，检查唯一性
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      const id = generateObservationId(testDir);
      assert.ok(!ids.has(id), `ID 重复: ${id}`);
      ids.add(id);
    }
  });

  it('AC-019: 跳过已存在的 ID', () => {
    // 先创建一个观察文件
    const existingId = generateObservationId();
    const obsDir = path.join(testDir, '.seed', 'observations');
    fs.mkdirSync(obsDir, { recursive: true });
    fs.writeFileSync(path.join(obsDir, `${existingId}.md`), 'test', 'utf-8');

    // 生成新 ID 应该不同
    const newId = generateObservationId(testDir);
    assert.notStrictEqual(newId, existingId);
  });

});

// ============================================================================
// 辅助功能测试
// ============================================================================

describe('辅助功能', () => {

  beforeEach(() => {
    setupTestDir();
  });

  afterEach(() => {
    cleanupTestDir();
  });

  it('isValidType 验证类型', () => {
    assert.strictEqual(isValidType('test_failure'), true);
    assert.strictEqual(isValidType('coverage_gap'), true);
    assert.strictEqual(isValidType('spec_drift'), true);
    assert.strictEqual(isValidType('user_feedback'), true);
    assert.strictEqual(isValidType('pattern_insight'), true);
    assert.strictEqual(isValidType('invalid'), false);
    assert.strictEqual(isValidType(''), false);
  });

  it('isValidStatus 验证状态', () => {
    assert.strictEqual(isValidStatus('raw'), true);
    assert.strictEqual(isValidStatus('triaged'), true);
    assert.strictEqual(isValidStatus('promoted'), true);
    assert.strictEqual(isValidStatus('ignored'), true);
    assert.strictEqual(isValidStatus('invalid'), false);
  });

  it('getStatusDisplay 返回状态显示信息', () => {
    const rawDisplay = getStatusDisplay('raw');
    assert.strictEqual(rawDisplay.icon, '🔵');
    assert.strictEqual(rawDisplay.label, '待归类');

    const unknownDisplay = getStatusDisplay('unknown');
    assert.strictEqual(unknownDisplay.icon, '❓');
  });

  it('deleteObservation 删除观察', () => {
    const obs = createObservation({
      type: OBSERVATION_TYPES.TEST_FAILURE,
      source: OBSERVATION_SOURCES.AUTO_EXECUTE,
      description: 'test'
    }, testDir);

    saveObservation(testDir, obs);
    assert.ok(loadObservation(testDir, obs.id));

    const deleted = deleteObservation(testDir, obs.id);
    assert.strictEqual(deleted, true);
    assert.strictEqual(loadObservation(testDir, obs.id), null);
  });

  it('deleteObservation 不存在返回 false', () => {
    const deleted = deleteObservation(testDir, 'non-existent');
    assert.strictEqual(deleted, false);
  });

  it('createObservation 设置默认值', () => {
    const obs = createObservation({
      type: OBSERVATION_TYPES.TEST_FAILURE,
      source: OBSERVATION_SOURCES.AUTO_EXECUTE,
      description: 'test'
    });

    assert.ok(obs.id);
    assert.strictEqual(obs.status, 'raw');
    assert.ok(obs.created);
    assert.ok(obs.updated);
    assert.deepStrictEqual(obs.context, {});
    assert.strictEqual(obs.spec, undefined);
    assert.strictEqual(obs.suggestion, undefined);
  });

});
