/**
 * drift-detector 单元测试
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  DriftType,
  DriftSeverity,
  detectDrift,
  detectSignatureDrift,
  extractSpecMethods,
  normalizeSignature,
  extractParams,
  calculateDriftSummary,
  filterDrifts,
  formatDriftReport
} = require('../../lib/defend/drift-detector');

describe('drift-detector', () => {

  describe('DriftType', () => {
    it('should define drift types', () => {
      assert.strictEqual(DriftType.METHOD_ADDED, 'method_added');
      assert.strictEqual(DriftType.METHOD_REMOVED, 'method_removed');
      assert.strictEqual(DriftType.SIGNATURE_CHANGED, 'signature_changed');
      assert.strictEqual(DriftType.PARAMETER_ADDED, 'parameter_added');
      assert.strictEqual(DriftType.PARAMETER_REMOVED, 'parameter_removed');
    });
  });

  describe('DriftSeverity', () => {
    it('should define severity levels', () => {
      assert.strictEqual(DriftSeverity.HIGH, 'high');
      assert.strictEqual(DriftSeverity.MEDIUM, 'medium');
      assert.strictEqual(DriftSeverity.LOW, 'low');
    });
  });

  describe('detectDrift', () => {
    it('should return empty array for null inputs', () => {
      assert.deepStrictEqual(detectDrift(null, null), []);
      assert.deepStrictEqual(detectDrift({}, null), []);
      assert.deepStrictEqual(detectDrift(null, {}), []);
    });

    it('should detect added methods', () => {
      const spec = { methods: [] };
      const codeInfo = {
        methods: [
          { name: 'newFunc', signature: 'newFunc(a, b)' }
        ]
      };

      const drifts = detectDrift(spec, codeInfo);

      assert.strictEqual(drifts.length, 1);
      assert.strictEqual(drifts[0].type, DriftType.METHOD_ADDED);
      assert.strictEqual(drifts[0].method, 'newFunc');
      assert.strictEqual(drifts[0].severity, DriftSeverity.MEDIUM);
    });

    it('should detect removed methods', () => {
      const spec = {
        methods: [
          { name: 'oldFunc', signature: 'oldFunc(x)' }
        ]
      };
      const codeInfo = { methods: [] };

      const drifts = detectDrift(spec, codeInfo);

      assert.strictEqual(drifts.length, 1);
      assert.strictEqual(drifts[0].type, DriftType.METHOD_REMOVED);
      assert.strictEqual(drifts[0].method, 'oldFunc');
      assert.strictEqual(drifts[0].severity, DriftSeverity.HIGH);
    });

    it('should detect signature changes', () => {
      const spec = {
        methods: [
          { name: 'foo', signature: 'foo(a, b)' }
        ]
      };
      const codeInfo = {
        methods: [
          { name: 'foo', signature: 'foo(a, b, c)' }
        ]
      };

      const drifts = detectDrift(spec, codeInfo);

      assert.ok(drifts.length > 0);
      assert.ok(drifts.some(d => d.method === 'foo'));
    });

    it('should not report drift for matching methods', () => {
      const spec = {
        methods: [
          { name: 'foo', signature: 'foo(a, b)' }
        ]
      };
      const codeInfo = {
        methods: [
          { name: 'foo', signature: 'foo(a, b)' }
        ]
      };

      const drifts = detectDrift(spec, codeInfo);

      assert.strictEqual(drifts.length, 0);
    });
  });

  describe('detectSignatureDrift', () => {
    it('should detect parameter added', () => {
      const specMethod = { name: 'foo', signature: 'foo(a)' };
      const codeMethod = { name: 'foo', signature: 'foo(a, b)' };

      const drifts = detectSignatureDrift(specMethod, codeMethod);

      assert.ok(drifts.length > 0);
      assert.ok(drifts.some(d => d.type === DriftType.PARAMETER_ADDED));
    });

    it('should detect parameter removed', () => {
      const specMethod = { name: 'foo', signature: 'foo(a, b)' };
      const codeMethod = { name: 'foo', signature: 'foo(a)' };

      const drifts = detectSignatureDrift(specMethod, codeMethod);

      assert.ok(drifts.length > 0);
      assert.ok(drifts.some(d => d.type === DriftType.PARAMETER_REMOVED));
    });

    it('should return empty for matching signatures', () => {
      const specMethod = { name: 'foo', signature: 'foo(a, b)' };
      const codeMethod = { name: 'foo', signature: 'foo(a, b)' };

      const drifts = detectSignatureDrift(specMethod, codeMethod);

      assert.strictEqual(drifts.length, 0);
    });
  });

  describe('extractSpecMethods', () => {
    it('should return methods array if present', () => {
      const spec = {
        methods: [{ name: 'foo', signature: 'foo()' }]
      };

      const methods = extractSpecMethods(spec);

      assert.strictEqual(methods.length, 1);
      assert.strictEqual(methods[0].name, 'foo');
    });

    it('should parse methods from content', () => {
      const spec = {
        content: '| 函数 | `bar(x, y)` | 计算函数 |'
      };

      const methods = extractSpecMethods(spec);

      assert.strictEqual(methods.length, 1);
      assert.strictEqual(methods[0].name, 'bar');
    });

    it('should return empty array for empty spec', () => {
      const methods = extractSpecMethods({});
      assert.deepStrictEqual(methods, []);
    });
  });

  describe('normalizeSignature', () => {
    it('should normalize whitespace', () => {
      assert.strictEqual(
        normalizeSignature('foo( a, b )'),
        normalizeSignature('foo(a,b)')
      );
    });

    it('should remove type annotations', () => {
      assert.strictEqual(
        normalizeSignature('foo(a: string, b: number)'),
        'foo(a,b)'
      );
    });

    it('should handle empty input', () => {
      assert.strictEqual(normalizeSignature(''), '');
      assert.strictEqual(normalizeSignature(null), '');
      assert.strictEqual(normalizeSignature(undefined), '');
    });
  });

  describe('extractParams', () => {
    it('should extract parameter names', () => {
      const params = extractParams('foo(a, b, c)');
      assert.deepStrictEqual(params, ['a', 'b', 'c']);
    });

    it('should handle default values', () => {
      const params = extractParams('foo(a = 1, b = "test")');
      assert.deepStrictEqual(params, ['a', 'b']);
    });

    it('should handle type annotations', () => {
      const params = extractParams('foo(a: string, b: number)');
      assert.deepStrictEqual(params, ['a', 'b']);
    });

    it('should return empty array for no params', () => {
      assert.deepStrictEqual(extractParams('foo()'), []);
      assert.deepStrictEqual(extractParams(''), []);
      assert.deepStrictEqual(extractParams(null), []);
    });
  });

  describe('calculateDriftSummary', () => {
    it('should calculate summary', () => {
      const drifts = [
        { type: DriftType.METHOD_ADDED, severity: DriftSeverity.MEDIUM },
        { type: DriftType.METHOD_REMOVED, severity: DriftSeverity.HIGH },
        { type: DriftType.SIGNATURE_CHANGED, severity: DriftSeverity.MEDIUM }
      ];

      const summary = calculateDriftSummary(drifts);

      assert.strictEqual(summary.total, 3);
      assert.strictEqual(summary.bySeverity.high, 1);
      assert.strictEqual(summary.bySeverity.medium, 2);
      assert.strictEqual(summary.hasCritical, true);
    });

    it('should handle empty drifts', () => {
      const summary = calculateDriftSummary([]);

      assert.strictEqual(summary.total, 0);
      assert.strictEqual(summary.hasCritical, false);
    });
  });

  describe('filterDrifts', () => {
    const drifts = [
      { type: DriftType.METHOD_ADDED, severity: DriftSeverity.LOW },
      { type: DriftType.METHOD_REMOVED, severity: DriftSeverity.HIGH },
      { type: DriftType.SIGNATURE_CHANGED, severity: DriftSeverity.MEDIUM }
    ];

    it('should filter by minimum severity', () => {
      const filtered = filterDrifts(drifts, { minSeverity: 'medium' });

      assert.strictEqual(filtered.length, 2);
      assert.ok(!filtered.some(d => d.severity === 'low'));
    });

    it('should filter by types', () => {
      const filtered = filterDrifts(drifts, {
        types: [DriftType.METHOD_ADDED, DriftType.METHOD_REMOVED]
      });

      assert.strictEqual(filtered.length, 2);
      assert.ok(!filtered.some(d => d.type === DriftType.SIGNATURE_CHANGED));
    });

    it('should return all when no filter', () => {
      const filtered = filterDrifts(drifts);
      assert.strictEqual(filtered.length, 3);
    });
  });

  describe('formatDriftReport', () => {
    it('should format empty drifts', () => {
      const report = formatDriftReport([]);
      assert.ok(report.includes('未检测到'));
    });

    it('should format drifts by severity', () => {
      const drifts = [
        { type: DriftType.METHOD_REMOVED, severity: DriftSeverity.HIGH, description: '删除方法 foo' },
        { type: DriftType.METHOD_ADDED, severity: DriftSeverity.MEDIUM, description: '新增方法 bar' }
      ];

      const report = formatDriftReport(drifts);

      assert.ok(report.includes('高风险'));
      assert.ok(report.includes('中风险'));
      assert.ok(report.includes('删除方法 foo'));
      assert.ok(report.includes('新增方法 bar'));
    });
  });
});
