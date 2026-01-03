/**
 * 提案完整性验证器测试
 * @see lib/spec/proposal-validator.js
 * @see openspec/changes/v3.0-ace-integration/specs/ace/proposal-validation.fspec.md
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  // REQ-001
  validateProposalCompleteness,
  hasAssociatedSpec,
  // REQ-002
  validateFspecExistence,
  findSpecFile,
  findInSubdirectories,
  // REQ-003
  getSpecStatus,
  isStatusValidForTransition,
  validateFspecStatuses,
  getStatusPriority,
  // REQ-004
  canTransitionStatus,
  generateSuggestions,
  // REQ-005
  formatValidationReport,
  // REQ-006
  validateProposal,
  // 常量
  FSPEC_STATUS_ORDER
} = require('../../lib/spec/proposal-validator');

// ============================================================================
// 测试工具
// ============================================================================

let tempDir;

function createTempDir() {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'proposal-validator-test-'));
  return tempDir;
}

function cleanupTempDir() {
  if (tempDir && fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function createProposalStructure(proposalName, phases) {
  const proposalDir = path.join(tempDir, 'openspec', 'changes', proposalName);
  fs.mkdirSync(proposalDir, { recursive: true });
  fs.mkdirSync(path.join(proposalDir, 'specs', 'ace'), { recursive: true });

  // 生成 proposal.md
  const lines = [
    `# ${proposalName}`,
    '',
    '## 实施阶段',
    ''
  ];

  for (const phase of phases) {
    lines.push(`### Phase ${phase.number}: ${phase.name}`);
    for (const task of phase.tasks) {
      const checkbox = task.completed ? '[x]' : '[ ]';
      const specRef = task.spec ? ` → \`${task.spec}\`` : '';
      lines.push(`- ${checkbox} ${task.name}${specRef}`);
    }
    lines.push('');
  }

  const proposalPath = path.join(proposalDir, 'proposal.md');
  fs.writeFileSync(proposalPath, lines.join('\n'));

  return { proposalDir, proposalPath };
}

function createFspecFile(proposalDir, specName, status = 'draft', subdir = 'ace') {
  const specPath = path.join(proposalDir, 'specs', subdir, specName);
  const content = `# Feature: Test\n\n> 状态: ${status}\n`;
  fs.writeFileSync(specPath, content);
  return specPath;
}

// ============================================================================
// REQ-001: 任务 fspec 关联检查 (AC-001, AC-002, AC-003)
// ============================================================================

describe('REQ-001: 任务 fspec 关联检查', () => {
  beforeEach(() => {
    createTempDir();
  });

  afterEach(() => {
    cleanupTempDir();
  });

  describe('hasAssociatedSpec', () => {
    it('AC-002: 任务有 specs 数组时返回 true', () => {
      assert.strictEqual(hasAssociatedSpec({ specs: ['test.fspec.md'] }), true);
    });

    it('任务 specs 为空数组时返回 false', () => {
      assert.strictEqual(hasAssociatedSpec({ specs: [] }), false);
    });

    it('任务没有 specs 字段时返回 false', () => {
      assert.strictEqual(hasAssociatedSpec({}), false);
    });

    it('任务 specs 为 undefined 时返回 false', () => {
      assert.strictEqual(hasAssociatedSpec({ specs: undefined }), false);
    });
  });

  describe('validateProposalCompleteness', () => {
    it('AC-001: 解析 proposal.md 提取所有任务', () => {
      const { proposalPath } = createProposalStructure('test-proposal', [
        {
          number: 1,
          name: 'Phase 1',
          tasks: [
            { name: 'Task 1', spec: 'task1.fspec.md' },
            { name: 'Task 2', spec: 'task2.fspec.md' }
          ]
        }
      ]);

      const result = validateProposalCompleteness(proposalPath);

      assert.strictEqual(result.stats.totalTasks, 2);
      assert.strictEqual(result.stats.tasksWithSpec, 2);
    });

    it('AC-002: 检查每个任务是否有 fspec 关联', () => {
      const { proposalPath } = createProposalStructure('test-proposal', [
        {
          number: 1,
          name: 'Phase 1',
          tasks: [
            { name: 'Task 1', spec: 'task1.fspec.md' },
            { name: 'Task 2' } // 无 fspec
          ]
        }
      ]);

      const result = validateProposalCompleteness(proposalPath);

      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.stats.tasksWithSpec, 1);
    });

    it('AC-003: 返回缺失 fspec 的任务列表', () => {
      const { proposalPath } = createProposalStructure('test-proposal', [
        {
          number: 1,
          name: 'Phase 1',
          tasks: [
            { name: 'Task 1' }, // 无 fspec
            { name: 'Task 2' }  // 无 fspec
          ]
        }
      ]);

      const result = validateProposalCompleteness(proposalPath);

      assert.strictEqual(result.errors.length, 2);
      assert.strictEqual(result.errors[0].type, 'missing_spec');
      assert.ok(result.errors[0].error.includes('缺少'));
    });

    it('所有任务都有 fspec 时返回 valid=true', () => {
      const { proposalPath } = createProposalStructure('test-proposal', [
        {
          number: 1,
          name: 'Phase 1',
          tasks: [
            { name: 'Task 1', spec: 'task1.fspec.md' },
            { name: 'Task 2', spec: 'task2.fspec.md' }
          ]
        }
      ]);

      const result = validateProposalCompleteness(proposalPath);

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
      assert.strictEqual(result.stats.percentage, 100);
    });
  });
});

// ============================================================================
// REQ-002: fspec 文件存在性检查 (AC-004, AC-005, AC-006)
// ============================================================================

describe('REQ-002: fspec 文件存在性检查', () => {
  beforeEach(() => {
    createTempDir();
  });

  afterEach(() => {
    cleanupTempDir();
  });

  describe('findSpecFile', () => {
    it('AC-004: 在 specs/ 目录下查找文件', () => {
      const { proposalDir } = createProposalStructure('test-proposal', []);
      const specPath = path.join(proposalDir, 'specs', 'test.fspec.md');
      fs.writeFileSync(specPath, '# Test');

      const found = findSpecFile(proposalDir, 'test.fspec.md');

      assert.strictEqual(found, specPath);
    });

    it('AC-005: 支持嵌套目录 specs/ace/', () => {
      const { proposalDir } = createProposalStructure('test-proposal', []);
      createFspecFile(proposalDir, 'nested.fspec.md', 'draft', 'ace');

      const found = findSpecFile(proposalDir, 'nested.fspec.md');

      assert.ok(found);
      assert.ok(found.includes('ace'));
    });

    it('文件不存在时返回 null', () => {
      const { proposalDir } = createProposalStructure('test-proposal', []);

      const found = findSpecFile(proposalDir, 'nonexistent.fspec.md');

      assert.strictEqual(found, null);
    });
  });

  describe('findInSubdirectories', () => {
    it('在子目录中查找可能的路径', () => {
      const { proposalDir } = createProposalStructure('test-proposal', []);

      const paths = findInSubdirectories(
        path.join(proposalDir, 'specs'),
        'test.fspec.md'
      );

      // 应该包含 ace 子目录的路径
      assert.ok(paths.some(p => p.includes('ace')));
    });

    it('目录不存在时返回空数组', () => {
      const paths = findInSubdirectories('/nonexistent/path', 'test.fspec.md');

      assert.deepStrictEqual(paths, []);
    });
  });

  describe('validateFspecExistence', () => {
    it('AC-004: 检查 specs/ 目录下是否存在引用的 fspec', () => {
      const { proposalDir } = createProposalStructure('test-proposal', []);
      createFspecFile(proposalDir, 'exists.fspec.md');

      const result = validateFspecExistence(proposalDir, ['exists.fspec.md']);

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.found.length, 1);
    });

    it('AC-006: 返回不存在的 fspec 文件列表', () => {
      const { proposalDir } = createProposalStructure('test-proposal', []);

      const result = validateFspecExistence(proposalDir, [
        'nonexistent1.fspec.md',
        'nonexistent2.fspec.md'
      ]);

      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.errors.length, 2);
      assert.strictEqual(result.errors[0].type, 'spec_not_found');
    });

    it('混合存在和不存在的文件', () => {
      const { proposalDir } = createProposalStructure('test-proposal', []);
      createFspecFile(proposalDir, 'exists.fspec.md');

      const result = validateFspecExistence(proposalDir, [
        'exists.fspec.md',
        'nonexistent.fspec.md'
      ]);

      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.found.length, 1);
      assert.strictEqual(result.errors.length, 1);
    });
  });
});

// ============================================================================
// REQ-003: fspec 状态检查 (AC-007, AC-008, AC-009)
// ============================================================================

describe('REQ-003: fspec 状态检查', () => {
  beforeEach(() => {
    createTempDir();
  });

  afterEach(() => {
    cleanupTempDir();
  });

  describe('getStatusPriority', () => {
    it('返回正确的状态优先级', () => {
      assert.strictEqual(getStatusPriority('draft'), 0);
      assert.strictEqual(getStatusPriority('review'), 1);
      assert.strictEqual(getStatusPriority('implementing'), 2);
      assert.strictEqual(getStatusPriority('archived'), 3);
    });

    it('未知状态返回 -1', () => {
      assert.strictEqual(getStatusPriority('unknown'), -1);
      assert.strictEqual(getStatusPriority('invalid'), -1);
    });
  });

  describe('getSpecStatus', () => {
    it('AC-007: 读取 fspec 的状态字段', () => {
      const { proposalDir } = createProposalStructure('test-proposal', []);
      const specPath = createFspecFile(proposalDir, 'test.fspec.md', 'review');

      const status = getSpecStatus(specPath);

      assert.strictEqual(status, 'review');
    });

    it('支持英文状态标记', () => {
      const { proposalDir } = createProposalStructure('test-proposal', []);
      const specPath = path.join(proposalDir, 'specs', 'ace', 'english.fspec.md');
      fs.writeFileSync(specPath, '# Test\n\n> status: implementing\n');

      const status = getSpecStatus(specPath);

      assert.strictEqual(status, 'implementing');
    });

    it('无状态字段时返回 draft', () => {
      const { proposalDir } = createProposalStructure('test-proposal', []);
      const specPath = path.join(proposalDir, 'specs', 'ace', 'nostatus.fspec.md');
      fs.writeFileSync(specPath, '# Test\n\nNo status here');

      const status = getSpecStatus(specPath);

      assert.strictEqual(status, 'draft');
    });

    it('文件不存在时返回 unknown', () => {
      const status = getSpecStatus('/nonexistent/path.fspec.md');

      assert.strictEqual(status, 'unknown');
    });
  });

  describe('isStatusValidForTransition', () => {
    it('AC-008: review → implementing 需要 review 或更高状态', () => {
      assert.strictEqual(isStatusValidForTransition('review', 'implementing'), true);
      assert.strictEqual(isStatusValidForTransition('implementing', 'implementing'), true);
      assert.strictEqual(isStatusValidForTransition('archived', 'implementing'), true);
      assert.strictEqual(isStatusValidForTransition('draft', 'implementing'), false);
    });

    it('draft → review 只需要 fspec 存在', () => {
      assert.strictEqual(isStatusValidForTransition('draft', 'review'), true);
      assert.strictEqual(isStatusValidForTransition('review', 'review'), true);
    });
  });

  describe('validateFspecStatuses', () => {
    it('AC-009: 返回状态不符的 fspec 列表', () => {
      const { proposalDir } = createProposalStructure('test-proposal', []);
      const specPath1 = createFspecFile(proposalDir, 'draft.fspec.md', 'draft');
      const specPath2 = createFspecFile(proposalDir, 'review.fspec.md', 'review');

      const foundSpecs = [
        { spec: 'draft.fspec.md', path: specPath1 },
        { spec: 'review.fspec.md', path: specPath2 }
      ];

      const result = validateFspecStatuses(proposalDir, foundSpecs, 'implementing');

      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.errors.length, 1);
      assert.strictEqual(result.errors[0].spec, 'draft.fspec.md');
      assert.strictEqual(result.errors[0].type, 'invalid_status');
    });

    it('所有 fspec 状态符合时返回 valid=true', () => {
      const { proposalDir } = createProposalStructure('test-proposal', []);
      const specPath = createFspecFile(proposalDir, 'review.fspec.md', 'review');

      const foundSpecs = [{ spec: 'review.fspec.md', path: specPath }];

      const result = validateFspecStatuses(proposalDir, foundSpecs, 'implementing');

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });
  });
});

// ============================================================================
// REQ-004: 状态转换阻止 (AC-010, AC-011, AC-012, AC-013)
// ============================================================================

describe('REQ-004: 状态转换阻止', () => {
  beforeEach(() => {
    createTempDir();
  });

  afterEach(() => {
    cleanupTempDir();
  });

  describe('canTransitionStatus', () => {
    it('AC-010: review → implementing 时执行验证', () => {
      const { proposalDir, proposalPath } = createProposalStructure('test-proposal', [
        {
          number: 1,
          name: 'Phase 1',
          tasks: [{ name: 'Task 1', spec: 'task1.fspec.md' }]
        }
      ]);
      createFspecFile(proposalDir, 'task1.fspec.md', 'review');

      const result = canTransitionStatus(proposalPath, 'implementing');

      assert.strictEqual(result.valid, true);
    });

    it('AC-011, AC-012: 验证失败时显示详细错误并阻止转换', () => {
      const { proposalPath } = createProposalStructure('test-proposal', [
        {
          number: 1,
          name: 'Phase 1',
          tasks: [{ name: 'Task 1' }] // 无 fspec
        }
      ]);

      const result = canTransitionStatus(proposalPath, 'implementing');

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
    });

    it('AC-013: 提供明确的修复建议', () => {
      const { proposalPath } = createProposalStructure('test-proposal', [
        {
          number: 1,
          name: 'Phase 1',
          tasks: [{ name: 'Task 1' }] // 无 fspec
        }
      ]);

      const result = canTransitionStatus(proposalPath, 'implementing');

      assert.ok(result.suggestions.length > 0);
      assert.ok(result.suggestions.some(s => s.includes('创建规格文件')));
    });
  });

  describe('generateSuggestions', () => {
    it('missing_spec 错误生成创建规格建议', () => {
      const errors = [{ type: 'missing_spec' }];

      const suggestions = generateSuggestions(errors);

      assert.ok(suggestions.some(s => s.includes('创建规格文件')));
    });

    it('spec_not_found 错误生成检查文件名建议', () => {
      const errors = [{ type: 'spec_not_found' }];

      const suggestions = generateSuggestions(errors);

      assert.ok(suggestions.some(s => s.includes('检查') && s.includes('文件名')));
    });

    it('invalid_status 错误生成更新状态建议', () => {
      const errors = [{ type: 'invalid_status' }];

      const suggestions = generateSuggestions(errors);

      assert.ok(suggestions.some(s => s.includes('状态')));
    });

    it('多种错误类型生成多种建议', () => {
      const errors = [
        { type: 'missing_spec' },
        { type: 'spec_not_found' },
        { type: 'invalid_status' }
      ];

      const suggestions = generateSuggestions(errors);

      assert.ok(suggestions.length >= 3);
    });
  });
});

// ============================================================================
// REQ-005: 验证报告 (AC-014, AC-015, AC-016, AC-017)
// ============================================================================

describe('REQ-005: 验证报告', () => {
  beforeEach(() => {
    createTempDir();
  });

  afterEach(() => {
    cleanupTempDir();
  });

  describe('formatValidationReport', () => {
    it('AC-014: 按 Phase 分组显示检查结果', () => {
      const { proposalDir, proposalPath } = createProposalStructure('test-proposal', [
        {
          number: 1,
          name: '基础功能',
          tasks: [{ name: 'Task 1', spec: 'task1.fspec.md' }]
        },
        {
          number: 2,
          name: '高级功能',
          tasks: [{ name: 'Task 2', spec: 'task2.fspec.md' }]
        }
      ]);
      createFspecFile(proposalDir, 'task1.fspec.md', 'review');
      createFspecFile(proposalDir, 'task2.fspec.md', 'review');

      const report = formatValidationReport(proposalPath);

      assert.ok(report.includes('Phase 1'));
      assert.ok(report.includes('Phase 2'));
      assert.ok(report.includes('基础功能'));
      assert.ok(report.includes('高级功能'));
    });

    it('AC-015: 使用 ✅/❌ 图标区分状态', () => {
      const { proposalDir, proposalPath } = createProposalStructure('test-proposal', [
        {
          number: 1,
          name: 'Phase 1',
          tasks: [
            { name: 'Task 1', spec: 'task1.fspec.md' },
            { name: 'Task 2' } // 无 fspec
          ]
        }
      ]);
      createFspecFile(proposalDir, 'task1.fspec.md', 'review');

      const report = formatValidationReport(proposalPath);

      assert.ok(report.includes('✅'));
      assert.ok(report.includes('❌'));
    });

    it('AC-016: 显示完成百分比', () => {
      const { proposalDir, proposalPath } = createProposalStructure('test-proposal', [
        {
          number: 1,
          name: 'Phase 1',
          tasks: [
            { name: 'Task 1', spec: 'task1.fspec.md' },
            { name: 'Task 2' }
          ]
        }
      ]);
      createFspecFile(proposalDir, 'task1.fspec.md', 'review');

      const report = formatValidationReport(proposalPath);

      assert.ok(report.includes('50%') || report.includes('1/2'));
    });

    it('AC-017: 汇总错误数量', () => {
      const { proposalPath } = createProposalStructure('test-proposal', [
        {
          number: 1,
          name: 'Phase 1',
          tasks: [
            { name: 'Task 1' },
            { name: 'Task 2' }
          ]
        }
      ]);

      const report = formatValidationReport(proposalPath);

      assert.ok(report.includes('验证失败') || report.includes('2 个问题'));
    });

    it('全部通过时显示验证成功', () => {
      const { proposalDir, proposalPath } = createProposalStructure('test-proposal', [
        {
          number: 1,
          name: 'Phase 1',
          tasks: [{ name: 'Task 1', spec: 'task1.fspec.md' }]
        }
      ]);
      createFspecFile(proposalDir, 'task1.fspec.md', 'review');

      const report = formatValidationReport(proposalPath);

      assert.ok(report.includes('验证通过'));
    });
  });
});

// ============================================================================
// REQ-006: 独立验证命令 (AC-018, AC-019, AC-020, AC-021)
// ============================================================================

describe('REQ-006: 独立验证命令', () => {
  beforeEach(() => {
    createTempDir();
  });

  afterEach(() => {
    cleanupTempDir();
  });

  describe('validateProposal', () => {
    it('AC-019: 支持指定提案名称', () => {
      const { proposalDir } = createProposalStructure('my-proposal', [
        {
          number: 1,
          name: 'Phase 1',
          tasks: [{ name: 'Task 1', spec: 'task1.fspec.md' }]
        }
      ]);
      createFspecFile(proposalDir, 'task1.fspec.md', 'review');

      const result = validateProposal('my-proposal', tempDir);

      assert.ok(result.report.includes('my-proposal'));
    });

    it('AC-020: 输出完整验证报告', () => {
      const { proposalDir } = createProposalStructure('test-proposal', [
        {
          number: 1,
          name: 'Phase 1',
          tasks: [{ name: 'Task 1', spec: 'task1.fspec.md' }]
        }
      ]);
      createFspecFile(proposalDir, 'task1.fspec.md', 'review');

      const result = validateProposal('test-proposal', tempDir);

      assert.ok(result.report.includes('📋'));
      assert.ok(result.report.includes('Phase'));
    });

    it('AC-021: 验证通过时返回退出码 0', () => {
      const { proposalDir } = createProposalStructure('test-proposal', [
        {
          number: 1,
          name: 'Phase 1',
          tasks: [{ name: 'Task 1', spec: 'task1.fspec.md' }]
        }
      ]);
      createFspecFile(proposalDir, 'task1.fspec.md', 'review');

      const result = validateProposal('test-proposal', tempDir);

      assert.strictEqual(result.exitCode, 0);
    });

    it('AC-021: 验证失败时返回退出码 1', () => {
      createProposalStructure('test-proposal', [
        {
          number: 1,
          name: 'Phase 1',
          tasks: [{ name: 'Task 1' }] // 无 fspec
        }
      ]);

      const result = validateProposal('test-proposal', tempDir);

      assert.strictEqual(result.exitCode, 1);
    });

    it('提案不存在时返回错误', () => {
      const result = validateProposal('nonexistent-proposal', tempDir);

      assert.strictEqual(result.exitCode, 1);
      assert.ok(result.report.includes('不存在'));
    });
  });
});

// ============================================================================
// 常量测试
// ============================================================================

describe('常量', () => {
  it('FSPEC_STATUS_ORDER 包含所有状态', () => {
    assert.ok(FSPEC_STATUS_ORDER.includes('draft'));
    assert.ok(FSPEC_STATUS_ORDER.includes('review'));
    assert.ok(FSPEC_STATUS_ORDER.includes('implementing'));
    assert.ok(FSPEC_STATUS_ORDER.includes('archived'));
    assert.strictEqual(FSPEC_STATUS_ORDER.length, 4);
  });

  it('FSPEC_STATUS_ORDER 顺序正确', () => {
    const draftIdx = FSPEC_STATUS_ORDER.indexOf('draft');
    const reviewIdx = FSPEC_STATUS_ORDER.indexOf('review');
    const implementingIdx = FSPEC_STATUS_ORDER.indexOf('implementing');
    const archivedIdx = FSPEC_STATUS_ORDER.indexOf('archived');

    assert.ok(draftIdx < reviewIdx);
    assert.ok(reviewIdx < implementingIdx);
    assert.ok(implementingIdx < archivedIdx);
  });
});
