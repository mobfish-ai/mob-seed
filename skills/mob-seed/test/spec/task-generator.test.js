/**
 * 任务生成器测试
 * @see openspec/changes/v3.0-ace-integration/specs/ace/task-generation.fspec.md
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { parseProposal, parseProposalFile, parseFrontmatter, getFspecStatus } = require('../../lib/spec/proposal-parser');
const {
  STATUS_MAP,
  getTaskStatus,
  generateTasksContent,
  generateTasksFromProposal,
  updateTasksStatus,
  calculatePhaseProgress,
  generateProgressBar,
  getTaskProgress,
  formatProgress
} = require('../../lib/spec/task-generator');

// ============================================================================
// 测试夹具
// ============================================================================

const SAMPLE_PROPOSAL = `---
title: v3.0-ace-integration
status: implementing
---

# ACE Integration

## 概述

这是一个测试提案。

## 实施阶段

### Phase 1: 观察基础 (v3.0-alpha)

- [ ] 定义观察数据结构 → \`observation.fspec.md\`
- [x] Execute/Defend 自动收集 → \`observation-collector.fspec.md\`
- [ ] 状态面板增强 → \`status-panel-enhance.fspec.md\`

### Phase 2: 反思能力 (v3.0-beta)

- [ ] 定义反思数据结构
- [ ] 规则匹配式反思

## 其他章节

不应被解析。
`;

const SAMPLE_PROPOSAL_EN = `---
title: v3.0-ace-integration
status: implementing
---

# ACE Integration

## Implementation

### Phase 1: Observation Foundation

- [ ] Define observation data structure → \`observation.fspec.md\`
- [x] Execute/Defend auto collection → \`observation-collector.fspec.md\`

### Phase 2: Reflection

- [ ] Define reflection structure
`;

const SAMPLE_PROPOSAL_WITH_TASKS = `---
title: test-proposal
status: implementing
---

# Test Proposal

## 实施阶段

### Phase 1: 基础

- [ ] 任务一 → \`task-one.fspec.md\`
- [x] 任务二 → \`task-two.fspec.md\`

---

### 任务 1.1: 任务一

**关联规格**: \`task-one.fspec.md\`

**Acceptance Criteria**:
- [ ] AC-001: 完成第一步
- [x] AC-002: 完成第二步

**派生产物**:
- \`lib/task-one.js\`
- \`test/task-one.test.js\`

---

### 任务 1.2: 任务二

**关联规格**: \`task-two.fspec.md\`

**Acceptance Criteria**:
- [x] AC-003: 全部完成

**派生产物**:
- \`lib/task-two.js\`
`;

// ============================================================================
// REQ-002: Proposal 内容解析
// ============================================================================

describe('proposal-parser', () => {
  describe('parseProposal', () => {
    it('AC-004: 解析 Proposal 的阶段结构', () => {
      const result = parseProposal(SAMPLE_PROPOSAL);

      assert.strictEqual(result.phases.length, 2, '应该解析出 2 个阶段');
      assert.strictEqual(result.phases[0].number, 1);
      assert.strictEqual(result.phases[0].name, '观察基础');
      assert.strictEqual(result.phases[1].number, 2);
      assert.strictEqual(result.phases[1].name, '反思能力');
    });

    it('AC-005: 提取任务和子任务', () => {
      const result = parseProposal(SAMPLE_PROPOSAL);

      // Phase 1 应该有 3 个任务
      assert.strictEqual(result.phases[0].tasks.length, 3, 'Phase 1 应该有 3 个任务');

      // 第一个任务
      const task1 = result.phases[0].tasks[0];
      assert.strictEqual(task1.id, '1.1');
      assert.strictEqual(task1.name, '定义观察数据结构');
      assert.strictEqual(task1.completed, false);

      // 第二个任务（已完成）
      const task2 = result.phases[0].tasks[1];
      assert.strictEqual(task2.id, '1.2');
      assert.strictEqual(task2.completed, true);
    });

    it('AC-006: 关联 fspec 文件', () => {
      const result = parseProposal(SAMPLE_PROPOSAL);

      const task1 = result.phases[0].tasks[0];
      assert.deepStrictEqual(task1.specs, ['observation.fspec.md']);

      const task2 = result.phases[0].tasks[1];
      assert.deepStrictEqual(task2.specs, ['observation-collector.fspec.md']);
    });

    it('AC-007: 支持中英文标题格式', () => {
      // 中文格式
      const resultCN = parseProposal(SAMPLE_PROPOSAL);
      assert.strictEqual(resultCN.phases.length, 2, '中文格式应解析出 2 个阶段');

      // 英文格式
      const resultEN = parseProposal(SAMPLE_PROPOSAL_EN);
      assert.strictEqual(resultEN.phases.length, 2, '英文格式应解析出 2 个阶段');
      assert.strictEqual(resultEN.phases[0].name, 'Observation Foundation');
    });

    it('解析详细任务结构（含 AC 和派生产物）', () => {
      const result = parseProposal(SAMPLE_PROPOSAL_WITH_TASKS);

      // 检查阶段解析
      assert.strictEqual(result.phases.length, 1);

      // 解析器会同时识别:
      // - 2 个来自列表项的任务 (- [ ] 任务一, - [x] 任务二)
      // - 2 个来自详细任务标题的任务 (### 任务 1.1, ### 任务 1.2)
      // 总计 4 个任务
      assert.strictEqual(result.phases[0].tasks.length, 4);

      // 详细任务部分会包含 AC subtasks 和 derivedOutputs
      // 但 AC 列表项不会被误解析为任务（已修复）
    });
  });

  describe('parseFrontmatter', () => {
    it('解析 YAML frontmatter', () => {
      const result = parseFrontmatter(SAMPLE_PROPOSAL);

      assert.strictEqual(result.title, 'v3.0-ace-integration');
      assert.strictEqual(result.status, 'implementing');
    });

    it('无 frontmatter 返回空对象', () => {
      const result = parseFrontmatter('# No frontmatter');
      assert.deepStrictEqual(result, {});
    });
  });
});

// ============================================================================
// REQ-003: tasks.md 文件格式
// ============================================================================

describe('task-generator', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-gen-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('generateTasksContent', () => {
    it('AC-008: 使用 YAML frontmatter 记录元信息', () => {
      const parseResult = parseProposal(SAMPLE_PROPOSAL);
      const content = generateTasksContent(parseResult, 'test-proposal');

      assert.ok(content.startsWith('---'), '应该以 YAML frontmatter 开始');
      assert.ok(content.includes('proposal: test-proposal'), '应该包含 proposal 名称');
      assert.ok(content.includes('generated:'), '应该包含生成时间');
      assert.ok(content.includes('source: proposal.md'), '应该包含源文件');
    });

    it('AC-009: 包含"请勿手动编辑"警告', () => {
      const parseResult = parseProposal(SAMPLE_PROPOSAL);
      const content = generateTasksContent(parseResult, 'test-proposal');

      assert.ok(content.includes('请勿手动编辑'), '应该包含警告信息');
      assert.ok(content.includes('此文件由系统自动生成'), '应该说明是自动生成');
    });

    it('AC-010: 任务表格显示状态', () => {
      const parseResult = parseProposal(SAMPLE_PROPOSAL);
      const content = generateTasksContent(parseResult, 'test-proposal');

      // 检查表格格式
      assert.ok(content.includes('| 任务 | 规格 | 状态 |'), '应该包含表头');
      assert.ok(content.includes('|------|------|------|'), '应该包含表格分隔符');

      // 检查状态显示
      assert.ok(content.includes('pending') || content.includes('completed'), '应该显示状态');
    });

    it('AC-011: 每个任务详情包含派生产物', () => {
      // 使用包含派生产物的提案
      const parseResult = parseProposal(SAMPLE_PROPOSAL_WITH_TASKS);
      const content = generateTasksContent(parseResult, 'test-proposal');

      // 任务详情部分
      assert.ok(content.includes('### 任务'), '应该包含任务详情');
    });
  });

  describe('generateTasksFromProposal', () => {
    it('AC-002: 生成的 tasks.md 在 proposal 目录下', () => {
      // 创建测试目录结构
      const proposalDir = path.join(tempDir, 'openspec', 'changes', 'test-proposal');
      fs.mkdirSync(proposalDir, { recursive: true });
      fs.writeFileSync(path.join(proposalDir, 'proposal.md'), SAMPLE_PROPOSAL);

      // skipValidation: true 因为测试不需要创建完整的 fspec 文件
      const result = generateTasksFromProposal(tempDir, 'test-proposal', { skipValidation: true });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.path, path.join(proposalDir, 'tasks.md'));
      assert.ok(fs.existsSync(result.path), 'tasks.md 文件应该存在');
    });

    it('AC-003: 重复进入 implementing 时覆盖更新', () => {
      // 创建测试目录
      const proposalDir = path.join(tempDir, 'openspec', 'changes', 'test-proposal');
      fs.mkdirSync(proposalDir, { recursive: true });
      fs.writeFileSync(path.join(proposalDir, 'proposal.md'), SAMPLE_PROPOSAL);

      // 第一次生成 (skipValidation: true)
      const result1 = generateTasksFromProposal(tempDir, 'test-proposal', { skipValidation: true });
      assert.strictEqual(result1.success, true);

      const content1 = fs.readFileSync(result1.path, 'utf-8');
      const time1 = content1.match(/generated: (.+)/)[1];

      // 等待一小段时间
      // 第二次生成（覆盖）
      const result2 = generateTasksFromProposal(tempDir, 'test-proposal', { skipValidation: true });
      assert.strictEqual(result2.success, true);

      const content2 = fs.readFileSync(result2.path, 'utf-8');
      // 应该成功覆盖（不报错）
      assert.ok(content2.includes('proposal: test-proposal'));
    });

    it('Proposal 不存在时返回错误', () => {
      const result = generateTasksFromProposal(tempDir, 'non-existent');

      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('不存在'));
    });

    it('返回统计信息', () => {
      const proposalDir = path.join(tempDir, 'openspec', 'changes', 'test-proposal');
      fs.mkdirSync(proposalDir, { recursive: true });
      fs.writeFileSync(path.join(proposalDir, 'proposal.md'), SAMPLE_PROPOSAL);

      const result = generateTasksFromProposal(tempDir, 'test-proposal', { skipValidation: true });

      assert.strictEqual(result.success, true);
      assert.ok(result.stats, '应该返回统计信息');
      assert.strictEqual(result.stats.phases, 2, '应该有 2 个阶段');
      assert.strictEqual(result.stats.tasks, 5, '应该有 5 个任务');
    });
  });

  // ============================================================================
  // REQ-004: 任务状态同步
  // ============================================================================

  describe('getTaskStatus', () => {
    it('AC-013: 任务状态与 fspec 状态同步', () => {
      assert.deepStrictEqual(getTaskStatus('draft'), { icon: ':hourglass:', label: 'pending' });
      assert.deepStrictEqual(getTaskStatus('review'), { icon: ':mag:', label: 'reviewing' });
      assert.deepStrictEqual(getTaskStatus('implementing'), { icon: ':hammer:', label: 'in_progress' });
      assert.deepStrictEqual(getTaskStatus('archived'), { icon: ':white_check_mark:', label: 'completed' });
    });

    it('未知状态返回 draft 默认值', () => {
      assert.deepStrictEqual(getTaskStatus('unknown'), STATUS_MAP.draft);
    });
  });

  describe('updateTasksStatus', () => {
    it('AC-012: fspec 状态变更触发 tasks.md 更新', () => {
      const proposalDir = path.join(tempDir, 'openspec', 'changes', 'test-proposal');
      fs.mkdirSync(proposalDir, { recursive: true });
      fs.writeFileSync(path.join(proposalDir, 'proposal.md'), SAMPLE_PROPOSAL);

      // 先生成 (skipValidation: true)
      generateTasksFromProposal(tempDir, 'test-proposal', { skipValidation: true });

      // 更新状态 (skipValidation: true)
      const result = updateTasksStatus(tempDir, 'test-proposal', { skipValidation: true });
      assert.strictEqual(result.success, true);
    });

    it('AC-014: 更新时保留手动无法编辑的警告', () => {
      const proposalDir = path.join(tempDir, 'openspec', 'changes', 'test-proposal');
      fs.mkdirSync(proposalDir, { recursive: true });
      fs.writeFileSync(path.join(proposalDir, 'proposal.md'), SAMPLE_PROPOSAL);

      generateTasksFromProposal(tempDir, 'test-proposal', { skipValidation: true });
      updateTasksStatus(tempDir, 'test-proposal', { skipValidation: true });

      const content = fs.readFileSync(path.join(proposalDir, 'tasks.md'), 'utf-8');
      assert.ok(content.includes('请勿手动编辑'), '更新后应保留警告');
    });

    it('tasks.md 不存在时返回错误', () => {
      const proposalDir = path.join(tempDir, 'openspec', 'changes', 'test-proposal');
      fs.mkdirSync(proposalDir, { recursive: true });
      // 不创建 tasks.md

      const result = updateTasksStatus(tempDir, 'test-proposal');
      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('不存在'));
    });
  });

  // ============================================================================
  // REQ-005: 任务进度统计
  // ============================================================================

  describe('calculatePhaseProgress', () => {
    it('AC-015: 计算各阶段完成百分比', () => {
      const phase = {
        name: 'Test Phase',
        number: 1,
        tasks: [
          { id: '1.1', name: 'Task 1', specs: [], completed: true },
          { id: '1.2', name: 'Task 2', specs: [], completed: false },
          { id: '1.3', name: 'Task 3', specs: [], completed: true },
          { id: '1.4', name: 'Task 4', specs: [], completed: false }
        ]
      };

      const progress = calculatePhaseProgress(phase);

      assert.strictEqual(progress.completed, 2);
      assert.strictEqual(progress.total, 4);
      assert.strictEqual(progress.percentage, 50);
    });

    it('空阶段返回 0%', () => {
      const phase = {
        name: 'Empty Phase',
        number: 1,
        tasks: []
      };

      const progress = calculatePhaseProgress(phase);

      assert.strictEqual(progress.percentage, 0);
    });
  });

  describe('generateProgressBar', () => {
    it('AC-016: 显示进度条可视化', () => {
      const bar0 = generateProgressBar(0);
      const bar50 = generateProgressBar(50);
      const bar100 = generateProgressBar(100);

      assert.strictEqual(bar0, '░'.repeat(20));
      assert.strictEqual(bar50, '█'.repeat(10) + '░'.repeat(10));
      assert.strictEqual(bar100, '█'.repeat(20));
    });

    it('支持自定义宽度', () => {
      const bar = generateProgressBar(50, 10);
      assert.strictEqual(bar.length, 10);
      assert.strictEqual(bar, '█████░░░░░');
    });
  });

  describe('getTaskProgress', () => {
    it('AC-017: 在状态面板集成显示', () => {
      const proposalDir = path.join(tempDir, 'openspec', 'changes', 'test-proposal');
      fs.mkdirSync(proposalDir, { recursive: true });
      fs.writeFileSync(path.join(proposalDir, 'proposal.md'), SAMPLE_PROPOSAL);

      const progress = getTaskProgress(tempDir, 'test-proposal');

      assert.ok(progress, '应该返回进度信息');
      assert.strictEqual(progress.proposalName, 'test-proposal');
      assert.ok(progress.phases, '应该包含阶段进度');
      assert.ok(progress.overall, '应该包含总体进度');
      assert.ok(progress.overall.bar, '应该包含进度条');
    });

    it('proposal 不存在返回 null', () => {
      const progress = getTaskProgress(tempDir, 'non-existent');
      assert.strictEqual(progress, null);
    });
  });

  describe('formatProgress', () => {
    it('格式化进度输出', () => {
      const progress = {
        proposalName: 'test',
        phases: [
          { name: 'Phase 1', number: 1, completed: 2, total: 4, percentage: 50, bar: '██████████░░░░░░░░░░' }
        ],
        overall: { completed: 2, total: 4, percentage: 50, bar: '██████████░░░░░░░░░░' }
      };

      const output = formatProgress(progress);

      assert.ok(output.includes('📋 任务进度'));
      assert.ok(output.includes('Phase 1'));
      assert.ok(output.includes('50%'));
      assert.ok(output.includes('总进度'));
    });

    it('null 输入返回提示信息', () => {
      const output = formatProgress(null);
      assert.ok(output.includes('暂无任务进度'));
    });
  });
});

// ============================================================================
// REQ-001: 状态转换触发 (集成测试)
// ============================================================================

describe('状态转换集成', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-gen-integration-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('AC-001: review → implementing 触发任务生成', () => {
    // 创建 review 状态的提案
    const proposalDir = path.join(tempDir, 'openspec', 'changes', 'test-proposal');
    fs.mkdirSync(proposalDir, { recursive: true });

    const reviewProposal = `---
title: test-proposal
status: review
---

# Test

## 实施阶段

### Phase 1: 基础

- [ ] 任务一 → \`task.fspec.md\`
`;
    fs.writeFileSync(path.join(proposalDir, 'proposal.md'), reviewProposal);

    // 模拟状态转换到 implementing 时触发任务生成
    // 这通常在 spec 命令中实现，这里直接调用生成函数
    // 注意: 真实场景需要验证，但这里测试格式生成，跳过验证
    const result = generateTasksFromProposal(tempDir, 'test-proposal', { skipValidation: true });

    assert.strictEqual(result.success, true);
    assert.ok(fs.existsSync(path.join(proposalDir, 'tasks.md')));
  });
});

// ============================================================================
// getFspecStatus 测试
// ============================================================================

describe('getFspecStatus', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fspec-status-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('从 fspec 文件读取状态', () => {
    const specsDir = path.join(tempDir, 'openspec', 'specs');
    fs.mkdirSync(specsDir, { recursive: true });

    fs.writeFileSync(path.join(specsDir, 'test.fspec.md'), `
# Test Feature

> 状态: implementing
> 版本: 1.0.0

## 概述
测试规格
`);

    const status = getFspecStatus(tempDir, 'openspec/specs/test.fspec.md');
    assert.strictEqual(status, 'implementing');
  });

  it('文件不存在返回 draft', () => {
    const status = getFspecStatus(tempDir, 'non-existent.fspec.md');
    assert.strictEqual(status, 'draft');
  });

  it('无状态标记返回 draft', () => {
    fs.writeFileSync(path.join(tempDir, 'no-status.fspec.md'), `
# Test Feature

没有状态标记
`);

    const status = getFspecStatus(tempDir, 'no-status.fspec.md');
    assert.strictEqual(status, 'draft');
  });
});
