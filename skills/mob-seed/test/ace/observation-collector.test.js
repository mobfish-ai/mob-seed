/**
 * ACE 观察收集器测试
 * @see openspec/changes/v3.0-ace-integration/specs/ace/observation-collector.fspec.md
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  collectFromExecute,
  collectFromDefend,
  findDuplicate,
  getObservationKey,
  ObservationCollector,
  formatCollectResult,
  formatCollectSummary
} = require('../../lib/ace/observation-collector');

const {
  OBSERVATION_TYPES,
  OBSERVATION_SOURCES,
  listObservations,
  loadObservation
} = require('../../lib/ace/observation');

// 测试用临时目录
let testDir;

function setupTestDir() {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'collector-test-'));
  fs.mkdirSync(path.join(testDir, '.seed'), { recursive: true });
}

function cleanupTestDir() {
  if (testDir && fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

// ============================================================================
// REQ-001: Execute 阶段观察收集 (AC-001 ~ AC-004)
// ============================================================================

describe('REQ-001: Execute 阶段观察收集', () => {

  it('AC-001: 实现 collectFromExecute(result) 函数', () => {
    const result = {
      runId: 'run-123',
      failures: [],
      coverageGaps: []
    };

    const observations = collectFromExecute(result);
    assert.ok(Array.isArray(observations));
    assert.strictEqual(observations.length, 0);
  });

  it('AC-002: 测试失败时创建 test_failure 观察', () => {
    const result = {
      runId: 'run-456',
      failures: [
        {
          file: 'test/parser.test.js',
          name: 'should handle empty input',
          message: 'AssertionError: expected null to be undefined',
          error: 'Error stack...'
        }
      ],
      coverageGaps: []
    };

    const observations = collectFromExecute(result);

    assert.strictEqual(observations.length, 1);
    assert.strictEqual(observations[0].type, OBSERVATION_TYPES.TEST_FAILURE);
    assert.strictEqual(observations[0].source, OBSERVATION_SOURCES.AUTO_EXECUTE);
    assert.ok(observations[0].description.includes('AssertionError'));
  });

  it('AC-003: 覆盖率不足时创建 coverage_gap 观察', () => {
    const result = {
      runId: 'run-789',
      failures: [],
      coverageGaps: [
        {
          specFile: 'openspec/specs/parser.fspec.md',
          acId: 'AC-005',
          description: 'AC-005 未被测试覆盖'
        }
      ]
    };

    const observations = collectFromExecute(result);

    assert.strictEqual(observations.length, 1);
    assert.strictEqual(observations[0].type, OBSERVATION_TYPES.COVERAGE_GAP);
    assert.strictEqual(observations[0].spec, 'openspec/specs/parser.fspec.md');
    assert.ok(observations[0].description.includes('AC-005'));
  });

  it('AC-004: 观察包含 runId 用于追溯', () => {
    const result = {
      runId: 'run-test-004',
      failures: [
        { file: 'test.js', name: 'test', message: 'failed' }
      ],
      coverageGaps: [
        { specFile: 'spec.md', acId: 'AC-001' }
      ]
    };

    const observations = collectFromExecute(result);

    assert.strictEqual(observations.length, 2);
    assert.strictEqual(observations[0].context.runId, 'run-test-004');
    assert.strictEqual(observations[1].context.runId, 'run-test-004');
  });

  it('多个失败时创建多个观察', () => {
    const result = {
      runId: 'run-multi',
      failures: [
        { file: 'a.test.js', name: 'test1', message: 'error1' },
        { file: 'b.test.js', name: 'test2', message: 'error2' },
        { file: 'c.test.js', name: 'test3', message: 'error3' }
      ],
      coverageGaps: []
    };

    const observations = collectFromExecute(result);
    assert.strictEqual(observations.length, 3);
  });

});

// ============================================================================
// REQ-002: Defend 阶段观察收集 (AC-005 ~ AC-007)
// ============================================================================

describe('REQ-002: Defend 阶段观察收集', () => {

  it('AC-005: 实现 collectFromDefend(result) 函数', () => {
    const result = {
      runId: 'defend-123',
      drifts: [],
      synced: true
    };

    const observations = collectFromDefend(result);
    assert.ok(Array.isArray(observations));
    assert.strictEqual(observations.length, 0);
  });

  it('AC-006: 规格偏离时创建 spec_drift 观察', () => {
    const result = {
      runId: 'defend-456',
      drifts: [
        {
          specFile: 'openspec/specs/parser.fspec.md',
          codeFile: 'lib/parser.js',
          type: 'missing_code',
          message: '函数 parseInput 在规格中定义但未实现'
        }
      ],
      synced: false
    };

    const observations = collectFromDefend(result);

    assert.strictEqual(observations.length, 1);
    assert.strictEqual(observations[0].type, OBSERVATION_TYPES.SPEC_DRIFT);
    assert.strictEqual(observations[0].source, OBSERVATION_SOURCES.AUTO_DEFEND);
    assert.strictEqual(observations[0].spec, 'openspec/specs/parser.fspec.md');
  });

  it('AC-007: 观察包含偏离类型和详情', () => {
    const result = {
      drifts: [
        {
          specFile: 'spec.md',
          codeFile: 'code.js',
          type: 'signature_mismatch',
          message: '函数签名不匹配',
          details: {
            expected: 'foo(a, b)',
            actual: 'foo(a)'
          }
        }
      ],
      synced: false
    };

    const observations = collectFromDefend(result);

    assert.strictEqual(observations[0].context.driftType, 'signature_mismatch');
    assert.deepStrictEqual(observations[0].context.details, {
      expected: 'foo(a, b)',
      actual: 'foo(a)'
    });
  });

});

// ============================================================================
// REQ-003: 观察去重机制 (AC-008 ~ AC-010)
// ============================================================================

describe('REQ-003: 观察去重机制', () => {

  it('AC-008: 实现 findDuplicate(obs, existing) 函数', () => {
    const obsParams = {
      type: OBSERVATION_TYPES.TEST_FAILURE,
      context: { testFile: 'test.js', testName: 'test1' }
    };

    const existing = [
      {
        id: 'obs-existing',
        type: OBSERVATION_TYPES.TEST_FAILURE,
        context: { testFile: 'test.js', testName: 'test1' }
      }
    ];

    const duplicate = findDuplicate(obsParams, existing);
    assert.ok(duplicate);
    assert.strictEqual(duplicate.id, 'obs-existing');
  });

  it('AC-008: 无重复时返回 null', () => {
    const obsParams = {
      type: OBSERVATION_TYPES.TEST_FAILURE,
      context: { testFile: 'test.js', testName: 'test1' }
    };

    const existing = [
      {
        id: 'obs-other',
        type: OBSERVATION_TYPES.TEST_FAILURE,
        context: { testFile: 'test.js', testName: 'test2' }
      }
    ];

    const duplicate = findDuplicate(obsParams, existing);
    assert.strictEqual(duplicate, null);
  });

  it('AC-009: 相同信号不创建重复观察', async () => {
    setupTestDir();
    try {
      const collector = new ObservationCollector({ projectRoot: testDir });

      // 第一次收集
      const result1 = {
        runId: 'run-1',
        failures: [
          { file: 'test.js', name: 'test1', message: 'error' }
        ],
        coverageGaps: []
      };
      await collector.processExecuteResult(result1);

      // 第二次收集相同信号
      const result2 = {
        runId: 'run-2',
        failures: [
          { file: 'test.js', name: 'test1', message: 'error' }
        ],
        coverageGaps: []
      };
      const collectResult = await collector.processExecuteResult(result2);

      // 应该更新而非新增
      assert.strictEqual(collectResult.added, 0);
      assert.strictEqual(collectResult.updated, 1);

      // 只有一个观察
      const observations = listObservations(testDir);
      assert.strictEqual(observations.length, 1);
    } finally {
      cleanupTestDir();
    }
  });

  it('AC-010: 重复信号更新已有观察的 updated 时间戳', async () => {
    setupTestDir();
    try {
      const collector = new ObservationCollector({ projectRoot: testDir });

      // 第一次收集
      await collector.processExecuteResult({
        runId: 'run-old',
        failures: [{ file: 'test.js', name: 'test1', message: 'error' }],
        coverageGaps: []
      });

      const obsBefore = listObservations(testDir);
      const obsBeforeData = loadObservation(testDir, obsBefore[0].id);
      const updatedBefore = obsBeforeData.updated;

      // 等待一小段时间
      await new Promise(resolve => setTimeout(resolve, 10));

      // 第二次收集
      await collector.processExecuteResult({
        runId: 'run-new',
        failures: [{ file: 'test.js', name: 'test1', message: 'error' }],
        coverageGaps: []
      });

      const obsAfterData = loadObservation(testDir, obsBefore[0].id);

      // updated 应该已更新
      assert.ok(
        new Date(obsAfterData.updated) >= new Date(updatedBefore),
        'updated 时间戳应已更新'
      );
      // context 应包含最新的 runId
      assert.strictEqual(obsAfterData.context.lastRunId, 'run-new');
    } finally {
      cleanupTestDir();
    }
  });

  it('去重规则: test_failure 基于 testFile + testName', () => {
    const key1 = getObservationKey({
      type: OBSERVATION_TYPES.TEST_FAILURE,
      context: { testFile: 'a.js', testName: 'test1' }
    });
    const key2 = getObservationKey({
      type: OBSERVATION_TYPES.TEST_FAILURE,
      context: { testFile: 'a.js', testName: 'test1' }
    });
    const key3 = getObservationKey({
      type: OBSERVATION_TYPES.TEST_FAILURE,
      context: { testFile: 'a.js', testName: 'test2' }
    });

    assert.strictEqual(key1, key2);
    assert.notStrictEqual(key1, key3);
  });

  it('去重规则: coverage_gap 基于 specFile + acId', () => {
    const key1 = getObservationKey({
      type: OBSERVATION_TYPES.COVERAGE_GAP,
      context: { specFile: 'spec.md', acId: 'AC-001' }
    });
    const key2 = getObservationKey({
      type: OBSERVATION_TYPES.COVERAGE_GAP,
      context: { specFile: 'spec.md', acId: 'AC-002' }
    });

    assert.notStrictEqual(key1, key2);
  });

  it('去重规则: spec_drift 基于 specFile + codeFile + driftType', () => {
    const key1 = getObservationKey({
      type: OBSERVATION_TYPES.SPEC_DRIFT,
      context: { specFile: 'spec.md', codeFile: 'code.js', driftType: 'missing_code' }
    });
    const key2 = getObservationKey({
      type: OBSERVATION_TYPES.SPEC_DRIFT,
      context: { specFile: 'spec.md', codeFile: 'code.js', driftType: 'extra_code' }
    });

    assert.notStrictEqual(key1, key2);
  });

  it('user_feedback 不去重', () => {
    const key = getObservationKey({
      type: OBSERVATION_TYPES.USER_FEEDBACK,
      context: { anything: 'value' }
    });

    assert.strictEqual(key, null);
  });

});

// ============================================================================
// REQ-004: 收集器集成接口 (AC-011 ~ AC-014)
// ============================================================================

describe('REQ-004: 收集器集成接口', () => {

  beforeEach(() => {
    setupTestDir();
  });

  afterEach(() => {
    cleanupTestDir();
  });

  it('AC-011: 实现 ObservationCollector 类', () => {
    const collector = new ObservationCollector({ projectRoot: testDir });
    assert.ok(collector);
    assert.strictEqual(collector.projectRoot, testDir);
  });

  it('AC-012: 提供 processExecuteResult 方法', async () => {
    const collector = new ObservationCollector({ projectRoot: testDir });

    const result = await collector.processExecuteResult({
      runId: 'run-test',
      failures: [
        { file: 'test.js', name: 'test1', message: 'error1' }
      ],
      coverageGaps: []
    });

    assert.strictEqual(result.added, 1);
    assert.strictEqual(result.byType[OBSERVATION_TYPES.TEST_FAILURE], 1);
  });

  it('AC-013: 提供 processDefendResult 方法', async () => {
    const collector = new ObservationCollector({ projectRoot: testDir });

    const result = await collector.processDefendResult({
      drifts: [
        {
          specFile: 'spec.md',
          codeFile: 'code.js',
          type: 'missing_code',
          message: 'missing function'
        }
      ],
      synced: false
    });

    assert.strictEqual(result.added, 1);
    assert.strictEqual(result.byType[OBSERVATION_TYPES.SPEC_DRIFT], 1);
  });

  it('AC-014: 返回收集结果（新增数、更新数、跳过数）', async () => {
    const collector = new ObservationCollector({ projectRoot: testDir });

    const result = await collector.processExecuteResult({
      runId: 'run-test',
      failures: [
        { file: 'a.js', name: 'test1', message: 'error1' },
        { file: 'b.js', name: 'test2', message: 'error2' }
      ],
      coverageGaps: [
        { specFile: 'spec.md', acId: 'AC-001' }
      ]
    });

    assert.strictEqual(typeof result.added, 'number');
    assert.strictEqual(typeof result.updated, 'number');
    assert.strictEqual(typeof result.skipped, 'number');
    assert.ok(Array.isArray(result.ids));

    assert.strictEqual(result.added, 3);
    assert.strictEqual(result.ids.length, 3);
  });

  it('空结果不创建观察', async () => {
    const collector = new ObservationCollector({ projectRoot: testDir });

    const result = await collector.processExecuteResult({
      runId: 'run-empty',
      failures: [],
      coverageGaps: []
    });

    assert.strictEqual(result.added, 0);
    assert.strictEqual(result.updated, 0);
  });

});

// ============================================================================
// REQ-005: 收集结果报告 (AC-015 ~ AC-017)
// ============================================================================

describe('REQ-005: 收集结果报告', () => {

  it('AC-015: 实现收集结果格式化输出', () => {
    const result = {
      added: 3,
      updated: 1,
      skipped: 0,
      byType: {
        test_failure: 2,
        coverage_gap: 1
      },
      ids: ['obs-1', 'obs-2', 'obs-3']
    };

    const output = formatCollectResult(result);

    assert.ok(output.includes('📊 观察收集完成'));
    assert.ok(output.includes('新增: 3 条'));
    assert.ok(output.includes('更新: 1 条'));
  });

  it('AC-016: 显示分类统计（按类型）', () => {
    const result = {
      added: 5,
      updated: 0,
      skipped: 0,
      byType: {
        test_failure: 3,
        coverage_gap: 2
      },
      ids: []
    };

    const output = formatCollectResult(result);

    assert.ok(output.includes('test_failure'));
    assert.ok(output.includes('coverage_gap'));
    assert.ok(output.includes('3'));
    assert.ok(output.includes('2'));
  });

  it('AC-017: 提示用户查看详情的命令', () => {
    const result = {
      added: 1,
      updated: 0,
      skipped: 0,
      byType: { test_failure: 1 },
      ids: ['obs-1']
    };

    const output = formatCollectResult(result);

    assert.ok(output.includes('/mob-seed:spec observe --list'));
  });

  it('无新增时不显示提示', () => {
    const result = {
      added: 0,
      updated: 0,
      skipped: 0,
      byType: {},
      ids: []
    };

    const output = formatCollectResult(result);

    assert.ok(!output.includes('/mob-seed:spec observe'));
  });

  it('formatCollectSummary 生成单行摘要', () => {
    assert.strictEqual(
      formatCollectSummary({ added: 3, updated: 1, skipped: 0, byType: {}, ids: [] }),
      '收集 3 条新观察，更新 1 条'
    );

    assert.strictEqual(
      formatCollectSummary({ added: 2, updated: 0, skipped: 0, byType: {}, ids: [] }),
      '收集 2 条新观察'
    );

    assert.strictEqual(
      formatCollectSummary({ added: 0, updated: 0, skipped: 0, byType: {}, ids: [] }),
      '无新观察'
    );
  });

});
