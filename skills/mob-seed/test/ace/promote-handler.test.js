/**
 * ACE Promote 命令处理器测试
 * @see openspec/changes/v3.0-ace-integration/specs/ace/promote-handler.fspec.md
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  handlePromote,
  promoteObservation,
  promoteReflection,
  promoteBatch,
  promoteSingle,
  generateProposalFromObservation,
  generateProposalFromReflection,
  generateBatchProposal,
  generateProposalName,
  generateProposalNameFromReflection,
  formatProposalTitle,
  getPatternLabel
} = require('../../lib/ace/promote-handler');

const {
  createObservation,
  saveObservation,
  transition: transitionObs,
  OBSERVATION_STATUS
} = require('../../lib/ace/observation');

const {
  createReflection,
  saveReflection,
  transition: transitionRef,
  REFLECTION_STATUS
} = require('../../lib/ace/reflection');

// 测试用临时目录
let testDir;

function setupTestDir() {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'promote-test-'));
  fs.mkdirSync(path.join(testDir, '.seed', 'observations'), { recursive: true });
  fs.mkdirSync(path.join(testDir, '.seed', 'reflections'), { recursive: true });
  fs.mkdirSync(path.join(testDir, 'openspec', 'changes'), { recursive: true });
}

function cleanupTestDir() {
  if (testDir && fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

// 创建一个 triaged 观察用于测试
function createTriagedObservation(extra = {}) {
  const obs = createObservation({
    type: 'test_failure',
    source: 'auto:execute',
    description: '测试失败: parser 空值处理',
    context: { error: 'null pointer', file: 'parser.js' },
    suggestion: '添加空值检查',
    ...extra
  });
  const triaged = transitionObs(obs, OBSERVATION_STATUS.TRIAGED);
  triaged.priority = 'P2';
  saveObservation(testDir, triaged);
  return triaged;
}

// 创建一个 accepted 反思用于测试（反思需要至少 2 个观察）
function createAcceptedReflection(obsIds = null, extra = {}) {
  // 如果没有传入 obsIds，创建 2 个 triaged 观察
  let actualObsIds = obsIds;
  if (!actualObsIds || actualObsIds.length < 2) {
    const obs1 = createTriagedObservation({ description: 'auto obs 1 for reflection' });
    const obs2 = createTriagedObservation({ description: 'auto obs 2 for reflection' });
    actualObsIds = obsIds && obsIds.length > 0 ? [...obsIds, obs2.id] : [obs1.id, obs2.id];
  }

  const ref = createReflection({
    observations: actualObsIds,
    pattern: 'type_aggregation',
    lesson: '空值处理需要统一规范',
    suggestedActions: ['添加空值检查', '编写单元测试'],
    ...extra
  });
  // 使用 transition 函数将 draft 转换为 accepted
  const accepted = transitionRef(ref, REFLECTION_STATUS.ACCEPTED);
  saveReflection(testDir, accepted);
  return accepted;
}

// ============================================================================
// REQ-001: Promote 观察 (AC-001 ~ AC-004)
// ============================================================================

describe('REQ-001: Promote 观察', () => {
  beforeEach(() => setupTestDir());
  afterEach(() => cleanupTestDir());

  it('AC-001: 实现 promoteObservation() 函数', () => {
    const obs = createTriagedObservation();
    const result = promoteObservation(testDir, obs.id, { name: 'fix-null-handling' });

    assert.strictEqual(result.success, true);
    assert.ok(result.message.includes('提案'));
    assert.ok(result.data.proposalPath);
  });

  it('AC-002: 验证观察状态为 triaged', () => {
    const obs = createTriagedObservation();

    // 先验证是 triaged
    const result = promoteObservation(testDir, obs.id, { name: 'fix-test' });
    assert.strictEqual(result.success, true);
  });

  it('AC-003: 拒绝 promote 其他状态的观察', () => {
    // 创建 raw 状态观察
    const obs = createObservation({
      type: 'test_failure',
      source: 'manual',
      description: 'raw 观察'
    });
    saveObservation(testDir, obs);

    const result = promoteObservation(testDir, obs.id, { name: 'should-fail' });
    assert.strictEqual(result.success, false);
    assert.ok(result.message.includes('triaged'));
  });

  it('AC-004: 创建提案目录和 proposal.md', () => {
    const obs = createTriagedObservation();
    const result = promoteObservation(testDir, obs.id, { name: 'fix-parser' });

    assert.strictEqual(result.success, true);

    const proposalDir = path.join(testDir, 'openspec', 'changes', 'fix-parser');
    const proposalFile = path.join(proposalDir, 'proposal.md');

    assert.ok(fs.existsSync(proposalDir), '应创建提案目录');
    assert.ok(fs.existsSync(proposalFile), '应创建 proposal.md');
  });

  it('返回不存在的观察错误', () => {
    const result = promoteObservation(testDir, 'obs-nonexistent', {});
    assert.strictEqual(result.success, false);
    assert.ok(result.message.includes('不存在'));
  });

  it('拒绝重复提案名称', () => {
    const obs1 = createTriagedObservation({ description: 'obs1' });
    const obs2 = createTriagedObservation({ description: 'obs2' });

    // 创建第一个提案
    promoteObservation(testDir, obs1.id, { name: 'same-name' });

    // 尝试使用相同名称
    const result = promoteObservation(testDir, obs2.id, { name: 'same-name' });
    assert.strictEqual(result.success, false);
    assert.ok(result.message.includes('已存在'));
  });
});

// ============================================================================
// REQ-002: Promote 反思 (AC-005 ~ AC-008)
// ============================================================================

describe('REQ-002: Promote 反思', () => {
  beforeEach(() => setupTestDir());
  afterEach(() => cleanupTestDir());

  it('AC-005: 实现 promoteReflection() 函数', () => {
    const obs = createTriagedObservation();
    const ref = createAcceptedReflection([obs.id]);

    const result = promoteReflection(testDir, ref.id, { name: 'enhance-null-check' });

    assert.strictEqual(result.success, true);
    assert.ok(result.message.includes('提案'));
  });

  it('AC-006: 验证反思状态为 accepted', () => {
    // 先创建 2 个观察以满足反思要求
    const obs1 = createTriagedObservation({ description: 'for draft ref 1' });
    const obs2 = createTriagedObservation({ description: 'for draft ref 2' });

    // 创建 draft 状态反思（不调用 acceptReflection）
    const ref = createReflection({
      observations: [obs1.id, obs2.id],
      pattern: 'manual',
      lesson: 'draft 反思'
    });
    saveReflection(testDir, ref);

    const result = promoteReflection(testDir, ref.id, { name: 'should-fail' });
    assert.strictEqual(result.success, false);
    assert.ok(result.message.includes('accepted'));
  });

  it('AC-007: 将反思的建议行动转换为提案任务', () => {
    const obs = createTriagedObservation();
    const ref = createAcceptedReflection([obs.id], {
      suggestedActions: ['任务1', '任务2', '任务3']
    });

    const result = promoteReflection(testDir, ref.id, { name: 'multi-task' });

    assert.strictEqual(result.success, true);

    // 读取生成的提案
    const proposalPath = path.join(testDir, 'openspec', 'changes', 'multi-task', 'proposal.md');
    const content = fs.readFileSync(proposalPath, 'utf-8');

    assert.ok(content.includes('- [ ] 任务1'), '应包含任务1');
    assert.ok(content.includes('- [ ] 任务2'), '应包含任务2');
    assert.ok(content.includes('- [ ] 任务3'), '应包含任务3');
  });

  it('AC-008: 关联的观察状态也更新为 promoted', () => {
    const obs = createTriagedObservation();
    const ref = createAcceptedReflection([obs.id]);

    promoteReflection(testDir, ref.id, { name: 'update-obs-status' });

    // 读取更新后的观察
    const { loadObservation } = require('../../lib/ace/observation');
    const updatedObs = loadObservation(testDir, obs.id);

    assert.strictEqual(updatedObs.status, 'promoted');
    assert.strictEqual(updatedObs.proposal_id, 'update-obs-status');
  });

  it('返回不存在的反思错误', () => {
    const result = promoteReflection(testDir, 'ref-nonexistent', {});
    assert.strictEqual(result.success, false);
    assert.ok(result.message.includes('不存在'));
  });
});

// ============================================================================
// REQ-003: 提案模板生成 (AC-009 ~ AC-012)
// ============================================================================

describe('REQ-003: 提案模板生成', () => {
  it('AC-009: 生成符合 proposal.md 格式的文件', () => {
    const obs = {
      id: 'obs-20260101-abc123',
      type: 'test_failure',
      created: '2026-01-01T20:00:00Z',
      description: '测试失败描述',
      context: { error: 'some error' },
      suggestion: '建议修复'
    };

    const content = generateProposalFromObservation(obs, 'fix-test');

    // 验证 frontmatter
    assert.ok(content.startsWith('---'), '应以 frontmatter 开始');
    assert.ok(content.includes('status: draft'), '应包含 status');
    assert.ok(content.includes('source:'), '应包含 source');

    // 验证章节
    assert.ok(content.includes('## 概述'), '应包含概述章节');
    assert.ok(content.includes('## 来源追溯'), '应包含来源追溯章节');
    assert.ok(content.includes('## 问题分析'), '应包含问题分析章节');
    assert.ok(content.includes('## 建议方案'), '应包含建议方案章节');
  });

  it('AC-010: 自动填充概述、问题分析、建议方案', () => {
    const obs = {
      id: 'obs-test',
      type: 'spec_drift',
      created: new Date().toISOString(),
      description: '规格与代码不同步',
      context: { file: 'parser.js', error: '类型不匹配' },
      suggestion: '更新规格或修改代码'
    };

    const content = generateProposalFromObservation(obs, 'align-spec');

    assert.ok(content.includes('规格与代码不同步'), '概述应包含描述');
    assert.ok(content.includes('类型不匹配'), '问题分析应包含错误');
    assert.ok(content.includes('更新规格或修改代码'), '建议方案应包含建议');
  });

  it('AC-011: 包含完整来源追溯表', () => {
    const obs = {
      id: 'obs-20260102-xyz789',
      type: 'coverage_gap',
      created: '2026-01-02T10:00:00Z',
      description: '覆盖率不足'
    };

    const content = generateProposalFromObservation(obs, 'cover-gap');

    assert.ok(content.includes('| ID | 类型 | 描述 | 创建时间 |'), '应包含表头');
    assert.ok(content.includes('obs-20260102-xyz789'), '应包含观察 ID');
    assert.ok(content.includes('coverage_gap'), '应包含类型');
  });

  it('AC-012: 将建议行动转换为实施任务', () => {
    const ref = {
      id: 'ref-test',
      pattern: 'type_aggregation',
      created: new Date().toISOString(),
      observations: [],
      lesson: '教训内容',
      suggestedActions: ['添加测试', '更新文档', '重构代码']
    };

    const content = generateProposalFromReflection(ref, 'impl-actions', testDir);

    assert.ok(content.includes('## 实施阶段'), '应包含实施阶段');
    assert.ok(content.includes('- [ ] 添加测试'), '应转换为任务1');
    assert.ok(content.includes('- [ ] 更新文档'), '应转换为任务2');
    assert.ok(content.includes('- [ ] 重构代码'), '应转换为任务3');
  });
});

// ============================================================================
// REQ-004: 状态更新 (AC-013 ~ AC-016)
// ============================================================================

describe('REQ-004: 状态更新', () => {
  beforeEach(() => setupTestDir());
  afterEach(() => cleanupTestDir());

  it('AC-013: 更新观察的 status 为 promoted', () => {
    const obs = createTriagedObservation();
    promoteObservation(testDir, obs.id, { name: 'status-update' });

    const { loadObservation } = require('../../lib/ace/observation');
    const updated = loadObservation(testDir, obs.id);

    assert.strictEqual(updated.status, 'promoted');
  });

  it('AC-014: 设置 proposal_id 字段', () => {
    const obs = createTriagedObservation();
    promoteObservation(testDir, obs.id, { name: 'proposal-id-test' });

    const { loadObservation } = require('../../lib/ace/observation');
    const updated = loadObservation(testDir, obs.id);

    assert.strictEqual(updated.proposal_id, 'proposal-id-test');
  });

  it('AC-015: 设置 promoted_at 时间戳', () => {
    const obs = createTriagedObservation();
    const before = new Date().toISOString();

    promoteObservation(testDir, obs.id, { name: 'timestamp-test' });

    const { loadObservation } = require('../../lib/ace/observation');
    const updated = loadObservation(testDir, obs.id);

    assert.ok(updated.promoted_at, '应设置 promoted_at');
    assert.ok(updated.promoted_at >= before, '时间戳应在操作之后');
  });

  it('AC-016: 更新索引文件 (通过 updateIndex)', () => {
    const obs = createTriagedObservation();
    promoteObservation(testDir, obs.id, { name: 'index-update' });

    // 更新索引以反映变更
    const { updateIndex } = require('../../lib/ace/observation');
    const index = updateIndex(testDir);

    const entry = index.observations.find(o => o.id === obs.id);
    assert.ok(entry, '索引应包含观察');
    assert.strictEqual(entry.status, 'promoted');
  });
});

// ============================================================================
// REQ-005: 来源追溯链 (AC-017 ~ AC-019)
// ============================================================================

describe('REQ-005: 来源追溯链', () => {
  beforeEach(() => setupTestDir());
  afterEach(() => cleanupTestDir());

  it('AC-017: 提案 frontmatter 包含 source 字段', () => {
    const obs = createTriagedObservation();
    promoteObservation(testDir, obs.id, { name: 'source-trace' });

    const proposalPath = path.join(testDir, 'openspec', 'changes', 'source-trace', 'proposal.md');
    const content = fs.readFileSync(proposalPath, 'utf-8');

    assert.ok(content.includes('source:'), '应包含 source 字段');
    assert.ok(content.includes('type: observation'), '应包含 type');
    assert.ok(content.includes(`id: ${obs.id}`), '应包含 id');
  });

  it('AC-018: source 记录类型、ID、创建时间', () => {
    const obs = createTriagedObservation();
    promoteObservation(testDir, obs.id, { name: 'source-detail' });

    const proposalPath = path.join(testDir, 'openspec', 'changes', 'source-detail', 'proposal.md');
    const content = fs.readFileSync(proposalPath, 'utf-8');

    assert.ok(content.includes('type: observation'), 'source 应包含 type');
    assert.ok(content.includes(`id: ${obs.id}`), 'source 应包含 id');
    assert.ok(content.includes('created:'), 'source 应包含 created');
  });

  it('AC-019: 支持从提案反向查找来源', () => {
    const obs = createTriagedObservation();
    promoteObservation(testDir, obs.id, { name: 'reverse-lookup' });

    // 从提案内容中提取来源 ID
    const proposalPath = path.join(testDir, 'openspec', 'changes', 'reverse-lookup', 'proposal.md');
    const content = fs.readFileSync(proposalPath, 'utf-8');

    // 从 frontmatter 提取
    const idMatch = content.match(/id: (obs-[a-z0-9-]+)/);
    assert.ok(idMatch, '应能从提案中提取 ID');
    assert.strictEqual(idMatch[1], obs.id);
  });
});

// ============================================================================
// REQ-006: 交互式确认 (AC-020 ~ AC-023)
// ============================================================================

describe('REQ-006: 交互式确认（dry-run 模式）', () => {
  beforeEach(() => setupTestDir());
  afterEach(() => cleanupTestDir());

  it('AC-020: 显示待 promote 的内容摘要 (dry-run)', () => {
    const obs = createTriagedObservation({ description: 'parser 解析失败' });
    const result = promoteObservation(testDir, obs.id, { dryRun: true });

    assert.strictEqual(result.success, true);
    assert.ok(result.message.includes('准备 Promote'), '应显示准备 promote');
    assert.ok(result.message.includes(obs.id), '应显示观察 ID');
    assert.ok(result.message.includes('parser'), '应显示描述');
  });

  it('AC-021: 允许用户自定义提案名称', () => {
    const obs = createTriagedObservation();
    const result = promoteObservation(testDir, obs.id, { name: 'custom-proposal-name' });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.proposalName, 'custom-proposal-name');
  });

  it('AC-022: 提供默认名称建议', () => {
    const obs = createTriagedObservation({ description: 'null pointer error' });
    const result = promoteObservation(testDir, obs.id, { dryRun: true });

    assert.ok(result.data.proposalName, '应生成默认名称');
    assert.ok(result.data.proposalName.includes('fix'), '测试失败应使用 fix 前缀');
  });

  it('AC-023: 确认后才创建 (dry-run 不创建)', () => {
    const obs = createTriagedObservation();
    promoteObservation(testDir, obs.id, { name: 'dry-run-test', dryRun: true });

    const proposalDir = path.join(testDir, 'openspec', 'changes', 'dry-run-test');
    assert.ok(!fs.existsSync(proposalDir), 'dry-run 不应创建目录');
  });
});

// ============================================================================
// REQ-007: 批量 Promote (AC-024 ~ AC-026)
// ============================================================================

describe('REQ-007: 批量 Promote', () => {
  beforeEach(() => setupTestDir());
  afterEach(() => cleanupTestDir());

  it('AC-024: 支持多个 ID 参数', () => {
    const obs1 = createTriagedObservation({ description: 'obs 1' });
    const obs2 = createTriagedObservation({ description: 'obs 2' });

    const result = handlePromote(testDir, [obs1.id, obs2.id], {});

    assert.strictEqual(result.success, true);
    assert.ok(result.message.includes('2/2'), '应显示成功数量');
  });

  it('AC-025: 支持 --asSingle 合并为单个提案', () => {
    const obs1 = createTriagedObservation({ description: 'obs 1' });
    const obs2 = createTriagedObservation({ description: 'obs 2' });

    const result = handlePromote(testDir, [obs1.id, obs2.id], {
      asSingle: true,
      name: 'merged-proposal'
    });

    assert.strictEqual(result.success, true);

    // 应只创建一个提案目录
    const proposalDir = path.join(testDir, 'openspec', 'changes', 'merged-proposal');
    assert.ok(fs.existsSync(proposalDir), '应创建合并提案');

    // 读取提案验证内容
    const content = fs.readFileSync(path.join(proposalDir, 'proposal.md'), 'utf-8');
    assert.ok(content.includes(obs1.id), '应包含第一个观察');
    assert.ok(content.includes(obs2.id), '应包含第二个观察');
  });

  it('AC-026: 默认分别创建提案', () => {
    const obs1 = createTriagedObservation({ description: 'separate 1' });
    const obs2 = createTriagedObservation({ description: 'separate 2' });

    // 不使用 asSingle
    const result = handlePromote(testDir, [obs1.id, obs2.id], {});

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.results.length, 2);
    assert.strictEqual(result.data.results[0].success, true);
    assert.strictEqual(result.data.results[1].success, true);
  });

  it('空 ID 列表返回错误', () => {
    const result = handlePromote(testDir, [], {});
    assert.strictEqual(result.success, false);
    assert.ok(result.message.includes('请提供'));
  });

  it('单个 ID 直接处理', () => {
    const obs = createTriagedObservation();
    const result = handlePromote(testDir, [obs.id], { name: 'single-item' });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.proposalName, 'single-item');
  });

  it('批量 promote 混合观察和反思', () => {
    const obs = createTriagedObservation();
    const ref = createAcceptedReflection([obs.id]);

    // 需要另一个 triaged 观察
    const obs2 = createTriagedObservation({ description: 'another obs' });

    const result = handlePromote(testDir, [obs2.id, ref.id], {
      asSingle: true,
      name: 'mixed-promote'
    });

    assert.strictEqual(result.success, true);

    const proposalPath = path.join(testDir, 'openspec', 'changes', 'mixed-promote', 'proposal.md');
    const content = fs.readFileSync(proposalPath, 'utf-8');

    // 提案内容格式: "本提案整合了 X 个观察和 Y 个反思的内容"
    assert.ok(content.includes('1 个观察'), '应包含观察计数');
    assert.ok(content.includes('1 个反思'), '应包含反思计数');
  });
});

// ============================================================================
// 辅助函数测试
// ============================================================================

describe('辅助函数', () => {
  it('generateProposalName 根据类型生成前缀', () => {
    const testCases = [
      { type: 'test_failure', expectedPrefix: 'fix' },
      { type: 'spec_drift', expectedPrefix: 'align' },
      { type: 'coverage_gap', expectedPrefix: 'cover' },
      { type: 'user_feedback', expectedPrefix: 'improve' }
    ];

    testCases.forEach(({ type, expectedPrefix }) => {
      const name = generateProposalName({ type, description: 'test desc' });
      assert.ok(name.startsWith(expectedPrefix), `${type} 应使用 ${expectedPrefix} 前缀`);
    });
  });

  it('generateProposalNameFromReflection 使用 enhance 前缀', () => {
    const name = generateProposalNameFromReflection({ lesson: 'improve something' });
    assert.ok(name.startsWith('enhance'), '反思应使用 enhance 前缀');
  });

  it('formatProposalTitle 格式化标题', () => {
    assert.strictEqual(formatProposalTitle('fix-null-handling'), 'Fix Null Handling');
    assert.strictEqual(formatProposalTitle('align-spec-code'), 'Align Spec Code');
  });

  it('getPatternLabel 返回中文标签', () => {
    assert.strictEqual(getPatternLabel('type_aggregation'), '类型聚合');
    assert.strictEqual(getPatternLabel('spec_aggregation'), '规格聚合');
    assert.strictEqual(getPatternLabel('time_clustering'), '时间聚类');
    assert.strictEqual(getPatternLabel('keyword_similarity'), '关键词相似');
    assert.strictEqual(getPatternLabel('manual'), '手动创建');
    assert.strictEqual(getPatternLabel('unknown'), 'unknown');
  });

  it('promoteSingle 识别 ID 类型', () => {
    // 无效 ID 类型
    const result = promoteSingle('/tmp', 'invalid-id', {});
    assert.strictEqual(result.success, false);
    assert.ok(result.message.includes('无法识别'));
  });
});
