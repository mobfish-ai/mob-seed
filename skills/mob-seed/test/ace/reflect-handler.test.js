/**
 * ACE Reflect 命令处理器测试
 * @see openspec/changes/v3.0-ace-integration/specs/ace/reflect-handler.fspec.md
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  // 主处理函数
  handleReflect,

  // 子操作
  triggerAnalysis,
  handleList,
  handleShow,
  handleAccept,
  handleReject,
  handleAutoAccept,

  // 工具函数
  formatCandidates,
  getPatternLabel,
  acceptCandidate,
  formatTimeAgo
} = require('../../lib/ace/reflect-handler');

const {
  createReflection,
  saveReflection,
  PATTERN_TYPES,
  REFLECTION_STATUS
} = require('../../lib/ace/reflection');

const {
  createObservation,
  saveObservation,
  updateIndex: updateObservationIndex
} = require('../../lib/ace/observation');

// 测试用临时目录
let testDir;

function setupTestDir() {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reflect-handler-test-'));
  fs.mkdirSync(path.join(testDir, '.seed', 'observations'), { recursive: true });
  fs.mkdirSync(path.join(testDir, '.seed', 'reflections'), { recursive: true });
}

function cleanupTestDir() {
  if (testDir && fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

// 创建测试观察并保存
function createAndSaveObservation(id, overrides = {}) {
  const obs = createObservation({
    type: 'test_failure',
    source: 'manual',
    description: '测试失败',
    ...overrides
  });

  // 覆盖 ID
  obs.id = id || obs.id;
  saveObservation(testDir, obs);
  return obs;
}

// 创建多个 triaged 观察
function createTriagedObservations(count, type = 'test_failure') {
  const observations = [];
  for (let i = 0; i < count; i++) {
    const obs = createObservation({
      type,
      source: 'manual',
      description: `测试描述 ${i + 1}`,
      status: 'triaged'
    });
    saveObservation(testDir, obs);
    observations.push(obs);
  }
  updateObservationIndex(testDir);
  return observations;
}

// ============================================================================
// REQ-001: 主要触发 (AC-001 ~ AC-004)
// ============================================================================

describe('REQ-001: 主要触发', () => {

  it('AC-001: handleReflect 函数存在', () => {
    assert.strictEqual(typeof handleReflect, 'function');
  });

  it('AC-002: 读取 triaged 观察进行分析', () => {
    setupTestDir();
    try {
      // 创建 triaged 观察
      createTriagedObservations(3, 'test_failure');

      const result = triggerAnalysis(testDir, { minConfidence: 0 });

      assert.ok(result.success);
      // 应该返回一些结果（可能是候选或空结果消息）
      assert.ok(result.message);
    } finally {
      cleanupTestDir();
    }
  });

  it('AC-003: 调用 PatternMatcher 进行分析', () => {
    setupTestDir();
    try {
      // 创建足够的 triaged 观察触发类型聚合
      createTriagedObservations(4, 'test_failure');

      const result = triggerAnalysis(testDir, { minConfidence: 0 });

      assert.ok(result.success);
      // 如果有候选，应该有 data.candidates
      if (result.data && result.data.candidates) {
        assert.ok(Array.isArray(result.data.candidates));
      }
    } finally {
      cleanupTestDir();
    }
  });

  it('AC-004: 返回反思建议列表', () => {
    setupTestDir();
    try {
      createTriagedObservations(5, 'test_failure');

      const result = triggerAnalysis(testDir, { minConfidence: 0 });

      assert.ok(result.success);
      assert.ok(result.message);
    } finally {
      cleanupTestDir();
    }
  });

  it('AC-004b: 支持指定模式类型', () => {
    setupTestDir();
    try {
      createTriagedObservations(4, 'test_failure');

      const result = triggerAnalysis(testDir, {
        minConfidence: 0,
        patterns: [PATTERN_TYPES.TYPE_AGGREGATION]
      });

      assert.ok(result.success);
    } finally {
      cleanupTestDir();
    }
  });
});

// ============================================================================
// REQ-002: 交互式确认 (AC-005 ~ AC-012)
// ============================================================================

describe('REQ-002: 交互式确认', () => {

  it('AC-005: formatCandidates 格式化候选列表', () => {
    const candidates = [
      {
        pattern: PATTERN_TYPES.TYPE_AGGREGATION,
        observations: ['obs-1', 'obs-2', 'obs-3'],
        confidence: 0.8,
        suggestedLesson: '测试教训'
      }
    ];

    const formatted = formatCandidates(candidates);

    assert.ok(formatted.includes('发现'), '应有发现提示');
    assert.ok(formatted.includes('obs-1'), '应包含观察 ID');
    assert.ok(formatted.includes('80%'), '应显示置信度');
  });

  it('AC-006: 显示置信度百分比', () => {
    const candidates = [
      {
        pattern: PATTERN_TYPES.TYPE_AGGREGATION,
        observations: ['obs-1', 'obs-2'],
        confidence: 0.75,
        suggestedLesson: '测试'
      }
    ];

    const formatted = formatCandidates(candidates);
    assert.ok(formatted.includes('75%'));
  });

  it('AC-007: getPatternLabel 返回模式标签', () => {
    assert.strictEqual(getPatternLabel(PATTERN_TYPES.TYPE_AGGREGATION), '类型聚合');
    assert.strictEqual(getPatternLabel(PATTERN_TYPES.SPEC_AGGREGATION), '规格聚合');
    assert.strictEqual(getPatternLabel(PATTERN_TYPES.TIME_CLUSTERING), '时间聚类');
    assert.strictEqual(getPatternLabel(PATTERN_TYPES.KEYWORD_SIMILARITY), '关键词相似');
    assert.strictEqual(getPatternLabel(PATTERN_TYPES.MANUAL), '手动创建');
  });

  it('AC-008: acceptCandidate 创建反思', () => {
    setupTestDir();
    try {
      const candidate = {
        pattern: PATTERN_TYPES.TYPE_AGGREGATION,
        observations: ['obs-1', 'obs-2', 'obs-3'],
        confidence: 0.8,
        suggestedLesson: '测试教训',
        suggestedActions: ['行动1'],
        metadata: { type: 'test_failure', count: 3 }
      };

      const { reflection, filePath } = acceptCandidate(testDir, candidate, []);

      assert.ok(reflection.id, '应创建反思');
      assert.strictEqual(reflection.pattern, PATTERN_TYPES.TYPE_AGGREGATION);
      assert.ok(fs.existsSync(filePath), '应保存文件');
    } finally {
      cleanupTestDir();
    }
  });

  it('AC-009: acceptCandidate 调用 createReflection', () => {
    setupTestDir();
    try {
      const candidate = {
        pattern: PATTERN_TYPES.SPEC_AGGREGATION,
        observations: ['obs-a', 'obs-b'],
        confidence: 0.6,
        suggestedLesson: '规格问题',
        suggestedActions: ['审查规格'],
        metadata: { spec: 'test.fspec.md', count: 2 }
      };

      const { reflection } = acceptCandidate(testDir, candidate, []);

      assert.strictEqual(reflection.status, REFLECTION_STATUS.DRAFT);
      assert.strictEqual(reflection.source, 'auto');
    } finally {
      cleanupTestDir();
    }
  });

  it('AC-010: 反思文件包含教训、分析、建议行动', () => {
    setupTestDir();
    try {
      const candidate = {
        pattern: PATTERN_TYPES.TYPE_AGGREGATION,
        observations: ['obs-1', 'obs-2'],
        confidence: 0.7,
        suggestedLesson: '教训内容',
        suggestedActions: ['行动1', '行动2'],
        metadata: { type: 'test', count: 2 }
      };

      const { filePath } = acceptCandidate(testDir, candidate, []);
      const content = fs.readFileSync(filePath, 'utf-8');

      assert.ok(content.includes('## 教训'), '应有教训章节');
      assert.ok(content.includes('## 分析'), '应有分析章节');
      assert.ok(content.includes('## 建议行动'), '应有建议行动章节');
    } finally {
      cleanupTestDir();
    }
  });

  it('AC-011: 自动填充来源追溯表', () => {
    setupTestDir();
    try {
      const observations = [
        { id: 'obs-1', type: 'test_failure', description: '失败1' },
        { id: 'obs-2', type: 'test_failure', description: '失败2' }
      ];

      const candidate = {
        pattern: PATTERN_TYPES.TYPE_AGGREGATION,
        observations: ['obs-1', 'obs-2'],
        confidence: 0.8,
        suggestedLesson: '测试',
        suggestedActions: [],
        metadata: { type: 'test', count: 2 }
      };

      const { filePath } = acceptCandidate(testDir, candidate, observations);
      const content = fs.readFileSync(filePath, 'utf-8');

      assert.ok(content.includes('## 来源追溯'), '应有来源追溯章节');
      assert.ok(content.includes('obs-1'), '应包含观察 ID');
      assert.ok(content.includes('test_failure'), '应包含观察类型');
    } finally {
      cleanupTestDir();
    }
  });

  it('AC-012: acceptCandidate 更新索引', () => {
    setupTestDir();
    try {
      const candidate = {
        pattern: PATTERN_TYPES.TYPE_AGGREGATION,
        observations: ['obs-1', 'obs-2'],
        confidence: 0.8,
        suggestedLesson: '测试',
        suggestedActions: [],
        metadata: { type: 'test', count: 2 }
      };

      acceptCandidate(testDir, candidate, []);

      const indexPath = path.join(testDir, '.seed', 'reflections', 'index.json');
      assert.ok(fs.existsSync(indexPath), '应创建索引文件');
    } finally {
      cleanupTestDir();
    }
  });
});

// ============================================================================
// REQ-004: 自动模式 (AC-013 ~ AC-015)
// ============================================================================

describe('REQ-004: 自动模式', () => {

  it('AC-013: handleAutoAccept 自动接受高置信度', () => {
    setupTestDir();
    try {
      const candidates = [
        {
          pattern: PATTERN_TYPES.TYPE_AGGREGATION,
          observations: ['obs-1', 'obs-2'],
          confidence: 0.95, // 高于默认阈值 0.9
          suggestedLesson: '高置信度',
          suggestedActions: [],
          metadata: { type: 'test', count: 2 }
        }
      ];

      const result = handleAutoAccept(testDir, candidates, { autoAcceptThreshold: 0.9 });

      assert.ok(result.success);
      assert.ok(result.data.created.length > 0, '应自动创建反思');
    } finally {
      cleanupTestDir();
    }
  });

  it('AC-014: 低于阈值不自动接受', () => {
    setupTestDir();
    try {
      const candidates = [
        {
          pattern: PATTERN_TYPES.TYPE_AGGREGATION,
          observations: ['obs-1', 'obs-2'],
          confidence: 0.5, // 低于阈值
          suggestedLesson: '低置信度',
          suggestedActions: [],
          metadata: { type: 'test', count: 2 }
        }
      ];

      const result = handleAutoAccept(testDir, candidates, { autoAcceptThreshold: 0.9 });

      assert.ok(result.success);
      assert.strictEqual(result.data.created.length, 0, '不应创建反思');
    } finally {
      cleanupTestDir();
    }
  });

  it('AC-015: 报告自动接受的反思', () => {
    setupTestDir();
    try {
      const candidates = [
        {
          pattern: PATTERN_TYPES.TYPE_AGGREGATION,
          observations: ['obs-1', 'obs-2'],
          confidence: 0.95,
          suggestedLesson: '测试',
          suggestedActions: [],
          metadata: { type: 'test', count: 2 }
        }
      ];

      const result = handleAutoAccept(testDir, candidates, { autoAcceptThreshold: 0.9 });

      assert.ok(result.message.includes('自动接受'), '应报告自动接受');
    } finally {
      cleanupTestDir();
    }
  });
});

// ============================================================================
// REQ-005: 空结果处理 (AC-016 ~ AC-018)
// ============================================================================

describe('REQ-005: 空结果处理', () => {

  it('AC-016: 无 triaged 观察时提示', () => {
    setupTestDir();
    try {
      // 不创建任何观察
      const result = triggerAnalysis(testDir, {});

      assert.ok(result.success);
      assert.ok(result.message.includes('triaged'), '应提示无 triaged 观察');
    } finally {
      cleanupTestDir();
    }
  });

  it('AC-017: 提示可能原因', () => {
    setupTestDir();
    try {
      const result = triggerAnalysis(testDir, {});

      assert.ok(result.message.includes('可能原因'), '应提示可能原因');
    } finally {
      cleanupTestDir();
    }
  });

  it('AC-018: 提供后续建议', () => {
    setupTestDir();
    try {
      const result = triggerAnalysis(testDir, {});

      assert.ok(result.message.includes('建议'), '应提供建议');
    } finally {
      cleanupTestDir();
    }
  });
});

// ============================================================================
// REQ-006: 列表和查看 (AC-019 ~ AC-022)
// ============================================================================

describe('REQ-006: 列表和查看', () => {

  it('AC-019: handleList 返回反思列表', () => {
    setupTestDir();
    try {
      // 创建反思
      const reflection = createReflection({
        observations: ['obs-1', 'obs-2'],
        pattern: PATTERN_TYPES.TYPE_AGGREGATION,
        lesson: '测试'
      });
      saveReflection(testDir, reflection);

      const result = handleList(testDir);

      assert.ok(result.success);
      assert.ok(result.data.reflections.length > 0);
    } finally {
      cleanupTestDir();
    }
  });

  it('AC-020: 列表显示状态、模式、时间', () => {
    setupTestDir();
    try {
      const reflection = createReflection({
        observations: ['obs-1', 'obs-2'],
        pattern: PATTERN_TYPES.TYPE_AGGREGATION,
        lesson: '测试'
      });
      saveReflection(testDir, reflection);

      const result = handleList(testDir);

      assert.ok(result.message.includes('draft') || result.message.includes('状态'));
      assert.ok(result.message.includes('类型聚合') || result.message.includes('type'));
    } finally {
      cleanupTestDir();
    }
  });

  it('AC-021: handleShow 返回反思详情', () => {
    setupTestDir();
    try {
      const reflection = createReflection({
        observations: ['obs-1', 'obs-2'],
        pattern: PATTERN_TYPES.TYPE_AGGREGATION,
        lesson: '测试教训',
        analysis: '测试分析'
      });
      saveReflection(testDir, reflection);

      const result = handleShow(testDir, reflection.id);

      assert.ok(result.success);
      assert.ok(result.message.includes('测试教训'));
      assert.ok(result.message.includes('测试分析'));
    } finally {
      cleanupTestDir();
    }
  });

  it('AC-022: handleShow 不存在返回错误', () => {
    setupTestDir();
    try {
      const result = handleShow(testDir, 'ref-nonexistent-0000');

      assert.ok(!result.success);
      assert.ok(result.message.includes('不存在'));
    } finally {
      cleanupTestDir();
    }
  });
});

// ============================================================================
// REQ-007: 接受和拒绝 (AC-023 ~ AC-026)
// ============================================================================

describe('REQ-007: 接受和拒绝', () => {

  it('AC-023: handleAccept 接受反思', () => {
    setupTestDir();
    try {
      const reflection = createReflection({
        observations: ['obs-1', 'obs-2'],
        pattern: PATTERN_TYPES.TYPE_AGGREGATION,
        lesson: '测试'
      });
      saveReflection(testDir, reflection);

      const result = handleAccept(testDir, reflection.id);

      assert.ok(result.success);
      assert.strictEqual(result.data.reflection.status, REFLECTION_STATUS.ACCEPTED);
    } finally {
      cleanupTestDir();
    }
  });

  it('AC-024: handleReject 拒绝反思', () => {
    setupTestDir();
    try {
      const reflection = createReflection({
        observations: ['obs-1', 'obs-2'],
        pattern: PATTERN_TYPES.TYPE_AGGREGATION,
        lesson: '测试'
      });
      saveReflection(testDir, reflection);

      const result = handleReject(testDir, reflection.id, '不适用');

      assert.ok(result.success);
      assert.strictEqual(result.data.reflection.status, REFLECTION_STATUS.REJECTED);
    } finally {
      cleanupTestDir();
    }
  });

  it('AC-025: handleReject 需要理由', () => {
    setupTestDir();
    try {
      const reflection = createReflection({
        observations: ['obs-1', 'obs-2'],
        pattern: PATTERN_TYPES.TYPE_AGGREGATION,
        lesson: '测试'
      });
      saveReflection(testDir, reflection);

      const result = handleReject(testDir, reflection.id); // 无理由

      assert.ok(!result.success);
      assert.ok(result.message.includes('理由'));
    } finally {
      cleanupTestDir();
    }
  });

  it('AC-026: 操作更新索引', () => {
    setupTestDir();
    try {
      const reflection = createReflection({
        observations: ['obs-1', 'obs-2'],
        pattern: PATTERN_TYPES.TYPE_AGGREGATION,
        lesson: '测试'
      });
      saveReflection(testDir, reflection);

      handleAccept(testDir, reflection.id);

      const indexPath = path.join(testDir, '.seed', 'reflections', 'index.json');
      const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));

      assert.ok(index.reflections.accepted.includes(reflection.id));
    } finally {
      cleanupTestDir();
    }
  });

  it('AC-026b: 只能接受 draft 状态', () => {
    setupTestDir();
    try {
      const reflection = createReflection({
        observations: ['obs-1', 'obs-2'],
        pattern: PATTERN_TYPES.TYPE_AGGREGATION,
        lesson: '测试'
      });
      saveReflection(testDir, reflection);

      // 先接受
      handleAccept(testDir, reflection.id);

      // 再次接受应失败
      const result = handleAccept(testDir, reflection.id);

      assert.ok(!result.success);
      assert.ok(result.message.includes('只能接受 draft'));
    } finally {
      cleanupTestDir();
    }
  });
});

// ============================================================================
// 工具函数测试
// ============================================================================

describe('工具函数', () => {

  it('formatTimeAgo 格式化相对时间', () => {
    const now = new Date();

    // 刚刚
    assert.strictEqual(formatTimeAgo(now), '刚刚');

    // 5 分钟前
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
    assert.ok(formatTimeAgo(fiveMinAgo).includes('分钟'));

    // 2 小时前
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    assert.ok(formatTimeAgo(twoHoursAgo).includes('小时'));

    // 3 天前
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    assert.ok(formatTimeAgo(threeDaysAgo).includes('天'));
  });

  it('handleReflect 路由到正确操作', () => {
    setupTestDir();
    try {
      // list 路由
      const listResult = handleReflect(testDir, { list: true });
      assert.ok(listResult.message.includes('反思列表') || listResult.message.includes('暂无'));

      // show 路由（不存在）
      const showResult = handleReflect(testDir, { show: 'ref-xxx' });
      assert.ok(!showResult.success);
    } finally {
      cleanupTestDir();
    }
  });
});

// ============================================================================
// 空列表测试
// ============================================================================

describe('空列表处理', () => {

  it('空反思列表显示提示', () => {
    setupTestDir();
    try {
      const result = handleList(testDir);

      assert.ok(result.success);
      assert.ok(result.message.includes('暂无'));
    } finally {
      cleanupTestDir();
    }
  });
});
