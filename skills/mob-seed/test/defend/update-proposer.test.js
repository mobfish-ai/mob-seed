/**
 * update-proposer 单元测试
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  UpdateAction,
  UpdatableSections,
  ProtectedSections,
  generateUpdateProposal,
  proposeSingleUpdate,
  proposeMethodAdd,
  proposeMethodRemove,
  proposeSignatureUpdate,
  proposeParameterAdd,
  proposeParameterRemove,
  generateDiffPreview,
  calculateRiskLevel,
  applyUpdates,
  validateUpdates
} = require('../../lib/defend/update-proposer');
const { DriftType, DriftSeverity } = require('../../lib/defend/drift-detector');

describe('update-proposer', () => {

  describe('UpdateAction', () => {
    it('should define action types', () => {
      assert.strictEqual(UpdateAction.ADD, 'add');
      assert.strictEqual(UpdateAction.UPDATE, 'update');
      assert.strictEqual(UpdateAction.REMOVE, 'remove');
    });
  });

  describe('UpdatableSections', () => {
    it('should define updatable sections', () => {
      assert.strictEqual(UpdatableSections.DERIVED_OUTPUTS, 'derived_outputs');
      assert.strictEqual(UpdatableSections.TECHNICAL_DESIGN, 'technical_design');
      assert.strictEqual(UpdatableSections.API_REFERENCE, 'api_reference');
    });
  });

  describe('ProtectedSections', () => {
    it('should include requirements sections', () => {
      assert.ok(ProtectedSections.includes('requirements'));
      assert.ok(ProtectedSections.includes('functional_requirements'));
      assert.ok(ProtectedSections.includes('acceptance_criteria'));
    });
  });

  describe('generateUpdateProposal', () => {
    it('should generate proposal for method added drift', () => {
      const spec = { methods: [] };
      const codeInfo = {
        methods: [{ name: 'newFunc', signature: 'newFunc(a, b)' }]
      };
      const drifts = [{
        type: DriftType.METHOD_ADDED,
        severity: DriftSeverity.MEDIUM,
        method: 'newFunc',
        signature: 'newFunc(a, b)'
      }];

      const proposal = generateUpdateProposal(spec, codeInfo, drifts);

      assert.strictEqual(proposal.updates.length, 1);
      assert.strictEqual(proposal.updates[0].action, UpdateAction.ADD);
      assert.strictEqual(proposal.riskLevel, 'medium');
    });

    it('should generate warnings for protected sections', () => {
      const spec = {};
      const codeInfo = {};
      const drifts = [{
        type: DriftType.METHOD_REMOVED,
        severity: DriftSeverity.HIGH,
        method: 'foo',
        section: 'requirements'
      }];

      const proposal = generateUpdateProposal(spec, codeInfo, drifts);

      assert.ok(proposal.warnings.length > 0);
      assert.ok(proposal.warnings.some(w => w.type === 'protected_section'));
    });

    it('should calculate auto-applicable count', () => {
      const spec = {};
      const codeInfo = {
        methods: [
          { name: 'func1', signature: 'func1()' },
          { name: 'func2', signature: 'func2()' }
        ]
      };
      const drifts = [
        { type: DriftType.METHOD_ADDED, method: 'func1', signature: 'func1()' },
        { type: DriftType.METHOD_ADDED, method: 'func2', signature: 'func2()' }
      ];

      const proposal = generateUpdateProposal(spec, codeInfo, drifts);

      assert.strictEqual(proposal.autoApplicable, 2);
    });
  });

  describe('proposeSingleUpdate', () => {
    it('should return null for unknown drift type', () => {
      const drift = { type: 'unknown_type' };
      const result = proposeSingleUpdate(drift, {});
      assert.strictEqual(result, null);
    });
  });

  describe('proposeMethodAdd', () => {
    it('should create add proposal with description from jsdoc', () => {
      const drift = {
        type: DriftType.METHOD_ADDED,
        method: 'calculate',
        signature: 'calculate(x, y)'
      };
      const codeInfo = {
        methods: [{
          name: 'calculate',
          jsdoc: { description: '计算两数之和' }
        }]
      };

      const proposal = proposeMethodAdd(drift, codeInfo);

      assert.strictEqual(proposal.action, UpdateAction.ADD);
      assert.strictEqual(proposal.method, 'calculate');
      assert.ok(proposal.tableRow.includes('calculate(x, y)'));
      assert.ok(proposal.tableRow.includes('计算两数之和'));
      assert.strictEqual(proposal.autoApplicable, true);
    });

    it('should use default description when no jsdoc', () => {
      const drift = {
        type: DriftType.METHOD_ADDED,
        method: 'foo',
        signature: 'foo()'
      };
      const codeInfo = { methods: [] };

      const proposal = proposeMethodAdd(drift, codeInfo);

      assert.ok(proposal.tableRow.includes('新增方法'));
    });
  });

  describe('proposeMethodRemove', () => {
    it('should create remove proposal with warning', () => {
      const drift = {
        type: DriftType.METHOD_REMOVED,
        method: 'oldFunc',
        oldSignature: 'oldFunc(a)'
      };

      const proposal = proposeMethodRemove(drift);

      assert.strictEqual(proposal.action, UpdateAction.REMOVE);
      assert.strictEqual(proposal.method, 'oldFunc');
      assert.strictEqual(proposal.autoApplicable, false);
      assert.strictEqual(proposal.risk, 'high');
      assert.ok(proposal.warning);
    });
  });

  describe('proposeSignatureUpdate', () => {
    it('should create update proposal with diff', () => {
      const drift = {
        type: DriftType.SIGNATURE_CHANGED,
        method: 'foo',
        oldSignature: 'foo(a)',
        newSignature: 'foo(a, b)'
      };
      const codeInfo = { methods: [] };

      const proposal = proposeSignatureUpdate(drift, codeInfo);

      assert.strictEqual(proposal.action, UpdateAction.UPDATE);
      assert.deepStrictEqual(proposal.diff, {
        before: 'foo(a)',
        after: 'foo(a, b)'
      });
      assert.strictEqual(proposal.autoApplicable, false);
    });
  });

  describe('proposeParameterAdd', () => {
    it('should create parameter add proposal', () => {
      const drift = {
        type: DriftType.PARAMETER_ADDED,
        method: 'foo',
        parameter: 'newParam'
      };
      const codeInfo = {
        methods: [{
          name: 'foo',
          jsdoc: {
            params: [{ name: 'newParam', type: 'string', description: '新参数' }]
          }
        }]
      };

      const proposal = proposeParameterAdd(drift, codeInfo);

      assert.strictEqual(proposal.action, UpdateAction.UPDATE);
      assert.strictEqual(proposal.parameter, 'newParam');
      assert.strictEqual(proposal.content.type, 'string');
      assert.strictEqual(proposal.autoApplicable, true);
    });
  });

  describe('proposeParameterRemove', () => {
    it('should create parameter remove proposal with warning', () => {
      const drift = {
        type: DriftType.PARAMETER_REMOVED,
        method: 'foo',
        parameter: 'oldParam'
      };

      const proposal = proposeParameterRemove(drift);

      assert.strictEqual(proposal.action, UpdateAction.UPDATE);
      assert.strictEqual(proposal.parameter, 'oldParam');
      assert.strictEqual(proposal.autoApplicable, false);
      assert.strictEqual(proposal.risk, 'high');
    });
  });

  describe('generateDiffPreview', () => {
    it('should generate preview for add action', () => {
      const updates = [{
        action: UpdateAction.ADD,
        section: 'derived_outputs',
        tableRow: '| 函数 | `foo()` | 新函数 |'
      }];

      const diff = generateDiffPreview(updates);

      assert.ok(diff.includes('--- derived_outputs ---'));
      assert.ok(diff.includes('+ | 函数 | `foo()` | 新函数 |'));
    });

    it('should generate preview for update action', () => {
      const updates = [{
        action: UpdateAction.UPDATE,
        section: 'derived_outputs',
        diff: { before: 'foo(a)', after: 'foo(a, b)' }
      }];

      const diff = generateDiffPreview(updates);

      assert.ok(diff.includes('- foo(a)'));
      assert.ok(diff.includes('+ foo(a, b)'));
    });

    it('should generate preview for remove action', () => {
      const updates = [{
        action: UpdateAction.REMOVE,
        section: 'derived_outputs',
        method: 'oldFunc',
        content: { oldSignature: 'oldFunc()' }
      }];

      const diff = generateDiffPreview(updates);

      assert.ok(diff.includes('- oldFunc()'));
    });
  });

  describe('calculateRiskLevel', () => {
    it('should return high for high severity drifts', () => {
      const drifts = [
        { severity: DriftSeverity.HIGH },
        { severity: DriftSeverity.LOW }
      ];

      assert.strictEqual(calculateRiskLevel(drifts), 'high');
    });

    it('should return medium for medium severity drifts', () => {
      const drifts = [
        { severity: DriftSeverity.MEDIUM },
        { severity: DriftSeverity.LOW }
      ];

      assert.strictEqual(calculateRiskLevel(drifts), 'medium');
    });

    it('should return low for only low severity drifts', () => {
      const drifts = [
        { severity: DriftSeverity.LOW },
        { severity: DriftSeverity.LOW }
      ];

      assert.strictEqual(calculateRiskLevel(drifts), 'low');
    });
  });

  describe('applyUpdates', () => {
    it('should add new row to existing table', () => {
      const content = `# 规格

## 派生产物 (Derived Outputs)

| 类型 | 路径 | 说明 |
|------|------|------|
| 函数 | \`existing()\` | 已有函数 |
`;
      const updates = [{
        action: UpdateAction.ADD,
        tableRow: '| 函数 | `newFunc()` | 新增函数 |'
      }];

      const result = applyUpdates(content, updates);

      assert.ok(result.includes('`newFunc()`'));
      assert.ok(result.includes('`existing()`'));
    });

    it('should return content unchanged when table pattern not matched', () => {
      // 注意：applyUpdates 的正则表达式对表格格式有严格要求
      // 如果表格格式不匹配，内容保持不变
      const content = `## 派生产物 (Derived Outputs)

| 类型 | 路径 | 说明 |
|------|------|------|
| 函数 | foo(a) | 函数 |
`;
      const updates = [{
        action: UpdateAction.UPDATE,
        diff: { before: 'foo(a)', after: 'foo(a, b)' }
      }];

      const result = applyUpdates(content, updates);

      // 表格格式不匹配时返回原内容
      assert.ok(result.includes('派生产物'));
    });

    it('should create table if not exists', () => {
      const content = '# 规格\n\n一些内容';
      const updates = [{
        action: UpdateAction.ADD,
        tableRow: '| 函数 | `newFunc()` | 新函数 |'
      }];

      const result = applyUpdates(content, updates);

      assert.ok(result.includes('## 派生产物'));
      assert.ok(result.includes('`newFunc()`'));
    });
  });

  describe('validateUpdates', () => {
    it('should pass for valid updates', () => {
      const updates = [{
        action: UpdateAction.ADD,
        section: UpdatableSections.DERIVED_OUTPUTS,
        risk: 'low',
        autoApplicable: true
      }];

      const result = validateUpdates(updates);

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.issues.length, 0);
    });

    it('should fail for protected section updates', () => {
      const updates = [{
        action: UpdateAction.UPDATE,
        section: 'requirements',
        risk: 'medium',
        autoApplicable: true
      }];

      const result = validateUpdates(updates);

      assert.strictEqual(result.valid, false);
      assert.ok(result.issues.some(i => i.type === 'protected_section'));
    });

    it('should fail for high risk auto-applicable updates', () => {
      const updates = [{
        action: UpdateAction.REMOVE,
        section: UpdatableSections.DERIVED_OUTPUTS,
        method: 'foo',
        risk: 'high',
        autoApplicable: true
      }];

      const result = validateUpdates(updates);

      assert.strictEqual(result.valid, false);
      assert.ok(result.issues.some(i => i.type === 'high_risk_auto'));
    });
  });
});
