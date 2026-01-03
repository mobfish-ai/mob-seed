/**
 * ACE 反思模块测试
 * @see openspec/changes/v3.0-ace-integration/specs/ace/reflection.fspec.md
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
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
} = require('../../lib/ace/reflection');

// 测试用临时目录
let testDir;

function setupTestDir() {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reflection-test-'));
  fs.mkdirSync(path.join(testDir, '.seed'), { recursive: true });
}

function cleanupTestDir() {
  if (testDir && fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

// ============================================================================
// REQ-001: 反思数据结构定义 (AC-001 ~ AC-004)
// ============================================================================

describe('REQ-001: 反思数据结构定义', () => {

  it('AC-001: 定义 Reflection 类型', () => {
    setupTestDir();
    try {
      const reflection = createReflection({
        observations: ['obs-001', 'obs-002'],
        pattern: PATTERN_TYPES.TYPE_AGGREGATION,
        lesson: '测试教训',
        analysis: '测试分析',
        suggestedActions: ['行动1', '行动2']
      });

      assert.ok(reflection.id, '应有 id');
      assert.ok(reflection.created, '应有 created');
      assert.ok(reflection.updated, '应有 updated');
      assert.deepStrictEqual(reflection.observations, ['obs-001', 'obs-002'], '应有 observations');
      assert.strictEqual(reflection.status, 'draft', '应有 status');
      assert.strictEqual(reflection.pattern, 'type_aggregation', '应有 pattern');
      assert.strictEqual(reflection.lesson, '测试教训', '应有 lesson');
      assert.strictEqual(reflection.analysis, '测试分析', '应有 analysis');
      assert.deepStrictEqual(reflection.suggestedActions, ['行动1', '行动2'], '应有 suggestedActions');
    } finally {
      cleanupTestDir();
    }
  });

  it('AC-002: 定义 PatternType 枚举', () => {
    assert.strictEqual(PATTERN_TYPES.TYPE_AGGREGATION, 'type_aggregation');
    assert.strictEqual(PATTERN_TYPES.SPEC_AGGREGATION, 'spec_aggregation');
    assert.strictEqual(PATTERN_TYPES.TIME_CLUSTERING, 'time_clustering');
    assert.strictEqual(PATTERN_TYPES.KEYWORD_SIMILARITY, 'keyword_similarity');
    assert.strictEqual(PATTERN_TYPES.MANUAL, 'manual');
  });

  it('AC-003: 定义 ReflectionStatus 枚举', () => {
    assert.strictEqual(REFLECTION_STATUS.DRAFT, 'draft');
    assert.strictEqual(REFLECTION_STATUS.ACCEPTED, 'accepted');
    assert.strictEqual(REFLECTION_STATUS.REJECTED, 'rejected');
  });

  it('AC-004: observations 至少关联 2 个观察', () => {
    // 应该抛出错误
    assert.throws(() => {
      createReflection({
        observations: ['obs-001'],
        pattern: PATTERN_TYPES.TYPE_AGGREGATION,
        lesson: '测试'
      });
    }, /至少 2 个观察/);

    assert.throws(() => {
      createReflection({
        observations: [],
        pattern: PATTERN_TYPES.TYPE_AGGREGATION,
        lesson: '测试'
      });
    }, /至少 2 个观察/);
  });

  it('AC-004b: 无效模式类型应抛出错误', () => {
    assert.throws(() => {
      createReflection({
        observations: ['obs-001', 'obs-002'],
        pattern: 'invalid_pattern',
        lesson: '测试'
      });
    }, /无效的模式类型/);
  });
});

// ============================================================================
// REQ-002: 反思状态机 (AC-005 ~ AC-008)
// ============================================================================

describe('REQ-002: 反思状态机', () => {

  it('AC-005: draft 可转换到 accepted 或 rejected', () => {
    assert.ok(canTransition('draft', 'accepted'), 'draft -> accepted 应允许');
    assert.ok(canTransition('draft', 'rejected'), 'draft -> rejected 应允许');
    assert.ok(!canTransition('draft', 'draft'), 'draft -> draft 不应允许');
  });

  it('AC-006: accepted 是终态，不可变更', () => {
    assert.ok(!canTransition('accepted', 'draft'), 'accepted -> draft 不应允许');
    assert.ok(!canTransition('accepted', 'rejected'), 'accepted -> rejected 不应允许');
    assert.ok(!canTransition('accepted', 'accepted'), 'accepted -> accepted 不应允许');
  });

  it('AC-007: rejected 是终态，不可变更', () => {
    assert.ok(!canTransition('rejected', 'draft'), 'rejected -> draft 不应允许');
    assert.ok(!canTransition('rejected', 'accepted'), 'rejected -> accepted 不应允许');
    assert.ok(!canTransition('rejected', 'rejected'), 'rejected -> rejected 不应允许');
  });

  it('AC-008: transition() 执行状态转换', () => {
    setupTestDir();
    try {
      const reflection = createReflection({
        observations: ['obs-001', 'obs-002'],
        pattern: PATTERN_TYPES.TYPE_AGGREGATION,
        lesson: '测试'
      });

      // 转换到 accepted
      const accepted = transition(reflection, REFLECTION_STATUS.ACCEPTED);
      assert.strictEqual(accepted.status, 'accepted');
      assert.ok(new Date(accepted.updated) >= new Date(reflection.updated));

      // 终态不可再转换
      assert.throws(() => {
        transition(accepted, REFLECTION_STATUS.REJECTED);
      }, /终态/);
    } finally {
      cleanupTestDir();
    }
  });

  it('AC-008b: transition() 支持拒绝理由', () => {
    setupTestDir();
    try {
      const reflection = createReflection({
        observations: ['obs-001', 'obs-002'],
        pattern: PATTERN_TYPES.TYPE_AGGREGATION,
        lesson: '测试'
      });

      const rejected = transition(reflection, REFLECTION_STATUS.REJECTED, {
        reason: '不适用'
      });

      assert.strictEqual(rejected.status, 'rejected');
      assert.strictEqual(rejected.rejectReason, '不适用');
    } finally {
      cleanupTestDir();
    }
  });
});

// ============================================================================
// REQ-003: ID 生成规则 (AC-009 ~ AC-011)
// ============================================================================

describe('REQ-003: ID 生成规则', () => {

  it('AC-009: ID 格式为 ref-YYYYMMDD-hash', () => {
    const id = generateReflectionId('test content');
    const match = id.match(/^ref-(\d{8})-([a-f0-9]{4})$/);

    assert.ok(match, `ID 格式不正确: ${id}`);
    assert.strictEqual(match[1].length, 8, '日期部分应为 8 位');
    assert.strictEqual(match[2].length, 4, '哈希部分应为 4 位');
  });

  it('AC-010: 日期为 YYYYMMDD 格式', () => {
    const id = generateReflectionId();
    const dateStr = id.split('-')[1];
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    assert.strictEqual(dateStr, today, '日期应为今天');
  });

  it('AC-011: 不同输入生成不同 ID', () => {
    const id1 = generateReflectionId('content1');
    const id2 = generateReflectionId('content2');

    assert.notStrictEqual(id1, id2, '不同内容应生成不同 ID');
  });
});

// ============================================================================
// REQ-004: 文件存储 (AC-012 ~ AC-015)
// ============================================================================

describe('REQ-004: 文件存储', () => {

  it('AC-012: 保存为 Markdown 文件', () => {
    setupTestDir();
    try {
      const reflection = createReflection({
        observations: ['obs-001', 'obs-002'],
        pattern: PATTERN_TYPES.TYPE_AGGREGATION,
        lesson: '测试教训',
        analysis: '测试分析',
        suggestedActions: ['行动1', '行动2']
      });

      const filePath = saveReflection(testDir, reflection);

      assert.ok(fs.existsSync(filePath), '文件应存在');
      assert.ok(filePath.endsWith('.md'), '应为 .md 文件');
    } finally {
      cleanupTestDir();
    }
  });

  it('AC-013: 文件路径为 .seed/reflections/{id}.md', () => {
    setupTestDir();
    try {
      const reflection = createReflection({
        observations: ['obs-001', 'obs-002'],
        pattern: PATTERN_TYPES.TYPE_AGGREGATION,
        lesson: '测试'
      });

      const filePath = saveReflection(testDir, reflection);
      const expectedPath = path.join(testDir, '.seed', 'reflections', `${reflection.id}.md`);

      assert.strictEqual(filePath, expectedPath);
    } finally {
      cleanupTestDir();
    }
  });

  it('AC-014: YAML frontmatter 包含元数据', () => {
    const reflection = createReflection({
      observations: ['obs-001', 'obs-002'],
      pattern: PATTERN_TYPES.TYPE_AGGREGATION,
      lesson: '测试教训'
    });

    const markdown = toMarkdown(reflection);

    assert.ok(markdown.includes('---'), '应有 frontmatter 分隔符');
    assert.ok(markdown.includes(`id: ${reflection.id}`), '应包含 id');
    assert.ok(markdown.includes(`status: ${reflection.status}`), '应包含 status');
    assert.ok(markdown.includes(`pattern: ${reflection.pattern}`), '应包含 pattern');
    assert.ok(markdown.includes('observations:'), '应包含 observations');
  });

  it('AC-015: Markdown 包含来源追溯表', () => {
    const reflection = createReflection({
      observations: ['obs-001', 'obs-002'],
      pattern: PATTERN_TYPES.TYPE_AGGREGATION,
      lesson: '测试教训'
    });

    const observationDetails = {
      'obs-001': { type: 'test_failure', description: '测试失败1' },
      'obs-002': { type: 'test_failure', description: '测试失败2' }
    };

    const markdown = toMarkdown(reflection, observationDetails);

    assert.ok(markdown.includes('## 来源追溯'), '应有来源追溯章节');
    assert.ok(markdown.includes('obs-001'), '应包含观察 ID');
    assert.ok(markdown.includes('test_failure'), '应包含观察类型');
  });

  it('AC-015b: loadReflection 读取已保存的反思', () => {
    setupTestDir();
    try {
      const reflection = createReflection({
        observations: ['obs-001', 'obs-002'],
        pattern: PATTERN_TYPES.TYPE_AGGREGATION,
        lesson: '测试教训',
        analysis: '测试分析',
        suggestedActions: ['行动1']
      });

      saveReflection(testDir, reflection);
      const loaded = loadReflection(testDir, reflection.id);

      assert.strictEqual(loaded.id, reflection.id);
      assert.strictEqual(loaded.lesson, reflection.lesson);
      assert.strictEqual(loaded.pattern, reflection.pattern);
      assert.deepStrictEqual(loaded.observations, reflection.observations);
    } finally {
      cleanupTestDir();
    }
  });

  it('AC-015c: loadReflection 不存在返回 null', () => {
    setupTestDir();
    try {
      const loaded = loadReflection(testDir, 'ref-nonexistent-0000');
      assert.strictEqual(loaded, null);
    } finally {
      cleanupTestDir();
    }
  });
});

// ============================================================================
// REQ-005: 索引管理 (AC-016 ~ AC-019)
// ============================================================================

describe('REQ-005: 索引管理', () => {

  it('AC-016: 索引包含反思列表', () => {
    setupTestDir();
    try {
      const reflection = createReflection({
        observations: ['obs-001', 'obs-002'],
        pattern: PATTERN_TYPES.TYPE_AGGREGATION,
        lesson: '测试'
      });

      saveReflection(testDir, reflection);
      updateIndex(testDir);

      const index = loadIndex(testDir);
      assert.ok(index.reflections, '应有 reflections 字段');
      assert.ok(index.reflections.draft, '应有 draft 列表');
      assert.ok(index.reflections.draft.includes(reflection.id), '应包含反思 ID');
    } finally {
      cleanupTestDir();
    }
  });

  it('AC-017: 索引按状态分组', () => {
    setupTestDir();
    try {
      const ref1 = createReflection({
        observations: ['obs-001', 'obs-002'],
        pattern: PATTERN_TYPES.TYPE_AGGREGATION,
        lesson: '测试1'
      });

      const ref2 = createReflection({
        observations: ['obs-003', 'obs-004'],
        pattern: PATTERN_TYPES.SPEC_AGGREGATION,
        lesson: '测试2'
      });

      // 保存并接受 ref2
      saveReflection(testDir, ref1);
      const accepted = transition(ref2, REFLECTION_STATUS.ACCEPTED);
      saveReflection(testDir, accepted);
      updateIndex(testDir);

      const index = loadIndex(testDir);
      assert.ok(index.reflections.draft.includes(ref1.id), 'draft 应包含 ref1');
      assert.ok(index.reflections.accepted.includes(accepted.id), 'accepted 应包含 ref2');
    } finally {
      cleanupTestDir();
    }
  });

  it('AC-018: 索引按模式统计数量', () => {
    setupTestDir();
    try {
      const ref1 = createReflection({
        observations: ['obs-001', 'obs-002'],
        pattern: PATTERN_TYPES.TYPE_AGGREGATION,
        lesson: '测试1'
      });

      const ref2 = createReflection({
        observations: ['obs-003', 'obs-004'],
        pattern: PATTERN_TYPES.TYPE_AGGREGATION,
        lesson: '测试2'
      });

      saveReflection(testDir, ref1);
      saveReflection(testDir, ref2);
      updateIndex(testDir);

      const index = loadIndex(testDir);
      assert.strictEqual(index.stats.byPattern.type_aggregation, 2, '应统计模式数量');
    } finally {
      cleanupTestDir();
    }
  });

  it('AC-019: 索引保存到 index.json', () => {
    setupTestDir();
    try {
      const reflection = createReflection({
        observations: ['obs-001', 'obs-002'],
        pattern: PATTERN_TYPES.TYPE_AGGREGATION,
        lesson: '测试'
      });

      saveReflection(testDir, reflection);
      updateIndex(testDir);

      const indexPath = getIndexPath(testDir);
      assert.ok(fs.existsSync(indexPath), 'index.json 应存在');

      const indexContent = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
      assert.ok(indexContent.lastUpdated, '应有 lastUpdated');
    } finally {
      cleanupTestDir();
    }
  });

  it('AC-019b: listReflections 返回所有反思', () => {
    setupTestDir();
    try {
      const ref1 = createReflection({
        observations: ['obs-001', 'obs-002'],
        pattern: PATTERN_TYPES.TYPE_AGGREGATION,
        lesson: '测试1'
      });

      const ref2 = createReflection({
        observations: ['obs-003', 'obs-004'],
        pattern: PATTERN_TYPES.SPEC_AGGREGATION,
        lesson: '测试2'
      });

      saveReflection(testDir, ref1);
      saveReflection(testDir, ref2);

      const reflections = listReflections(testDir);
      assert.strictEqual(reflections.length, 2, '应返回 2 个反思');
    } finally {
      cleanupTestDir();
    }
  });

  it('AC-019c: listReflections 支持过滤', () => {
    setupTestDir();
    try {
      const ref1 = createReflection({
        observations: ['obs-001', 'obs-002'],
        pattern: PATTERN_TYPES.TYPE_AGGREGATION,
        lesson: '测试1'
      });

      const ref2 = createReflection({
        observations: ['obs-003', 'obs-004'],
        pattern: PATTERN_TYPES.SPEC_AGGREGATION,
        lesson: '测试2'
      });

      saveReflection(testDir, ref1);
      saveReflection(testDir, ref2);

      const filtered = listReflections(testDir, { pattern: PATTERN_TYPES.TYPE_AGGREGATION });
      assert.strictEqual(filtered.length, 1, '应只返回 1 个匹配的反思');
      assert.strictEqual(filtered[0].pattern, PATTERN_TYPES.TYPE_AGGREGATION);
    } finally {
      cleanupTestDir();
    }
  });
});

// ============================================================================
// 格式转换测试
// ============================================================================

describe('Markdown 格式转换', () => {

  it('toMarkdown 应生成正确格式', () => {
    const reflection = createReflection({
      observations: ['obs-001', 'obs-002'],
      pattern: PATTERN_TYPES.TYPE_AGGREGATION,
      lesson: '这是教训内容',
      analysis: '这是分析内容',
      suggestedActions: ['行动1', '行动2']
    });

    const markdown = toMarkdown(reflection);

    assert.ok(markdown.includes('## 教训'), '应有教训章节');
    assert.ok(markdown.includes('这是教训内容'), '应包含教训内容');
    assert.ok(markdown.includes('## 分析'), '应有分析章节');
    assert.ok(markdown.includes('这是分析内容'), '应包含分析内容');
    assert.ok(markdown.includes('## 建议行动'), '应有建议行动章节');
    assert.ok(markdown.includes('1. 行动1'), '应包含建议行动');
  });

  it('fromMarkdown 应正确解析', () => {
    const original = createReflection({
      observations: ['obs-001', 'obs-002'],
      pattern: PATTERN_TYPES.SPEC_AGGREGATION,
      lesson: '教训内容',
      analysis: '分析内容',
      suggestedActions: ['行动1', '行动2']
    });

    const markdown = toMarkdown(original);
    const parsed = fromMarkdown(markdown);

    assert.strictEqual(parsed.id, original.id);
    assert.strictEqual(parsed.lesson, original.lesson);
    assert.strictEqual(parsed.analysis, original.analysis);
    assert.strictEqual(parsed.pattern, original.pattern);
    assert.deepStrictEqual(parsed.observations, original.observations);
    assert.deepStrictEqual(parsed.suggestedActions, original.suggestedActions);
  });

  it('fromMarkdown 缺少 frontmatter 应抛出错误', () => {
    assert.throws(() => {
      fromMarkdown('# 没有 frontmatter 的内容');
    }, /缺少 frontmatter/);
  });
});
