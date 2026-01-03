/**
 * report-generator 单元测试
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const reportGenerator = require('../../lib/brownfield/report-generator');

describe('report-generator', () => {

  describe('percent', () => {
    it('should calculate percentage', () => {
      assert.strictEqual(reportGenerator.percent(50, 100), '50%');
      assert.strictEqual(reportGenerator.percent(1, 3), '33%');
      assert.strictEqual(reportGenerator.percent(2, 3), '67%');
    });

    it('should return 0% for zero total', () => {
      assert.strictEqual(reportGenerator.percent(0, 0), '0%');
      assert.strictEqual(reportGenerator.percent(10, 0), '0%');
    });

    it('should handle undefined value', () => {
      assert.strictEqual(reportGenerator.percent(undefined, 100), '0%');
    });
  });

  describe('calculateQualityDistribution', () => {
    it('should count quality levels', () => {
      const results = [
        { success: true, quality: 'high' },
        { success: true, quality: 'high' },
        { success: true, quality: 'medium' },
        { success: true, quality: 'low', spec: { path: 'a.fspec.md' } },
        { success: false } // not counted
      ];

      const dist = reportGenerator.calculateQualityDistribution(results);

      assert.strictEqual(dist.high, 2);
      assert.strictEqual(dist.medium, 1);
      assert.strictEqual(dist.low, 1);
      assert.deepStrictEqual(dist.lowQualitySpecs, ['a.fspec.md']);
    });

    it('should handle empty results', () => {
      const dist = reportGenerator.calculateQualityDistribution([]);

      assert.strictEqual(dist.high, 0);
      assert.strictEqual(dist.medium, 0);
      assert.strictEqual(dist.low, 0);
    });

    it('should default unknown quality to low', () => {
      const results = [
        { success: true }, // no quality = low
        { success: true, quality: 'unknown' } // unknown = low
      ];

      const dist = reportGenerator.calculateQualityDistribution(results);

      assert.strictEqual(dist.low, 2);
    });
  });

  describe('calculateCompleteness', () => {
    it('should calculate completeness percentage', () => {
      const extractResult = { total: 100, success: 80 };
      const validateResult = { total: 80, synced: 60 };

      const result = reportGenerator.calculateCompleteness(extractResult, validateResult);

      // 提取成功 80/100 = 80% * 50 = 40
      // 同步验证 60/80 = 75% * 50 = 37.5
      // 总计 = 77.5 → 78
      assert.strictEqual(result, 78);
    });

    it('should return 0 for empty extract', () => {
      const result = reportGenerator.calculateCompleteness({ total: 0 }, null);
      assert.strictEqual(result, 0);
    });

    it('should default sync to 50% if no validation', () => {
      const extractResult = { total: 100, success: 100 };

      const result = reportGenerator.calculateCompleteness(extractResult, null);

      // 100% extract = 50, no validation = 50
      assert.strictEqual(result, 100);
    });
  });

  describe('generateSummary', () => {
    it('should generate summary string', () => {
      const options = {
        extractResult: { total: 100, success: 90, failed: [1, 2, 3] },
        enrichResult: { enriched: 50 },
        validateResult: { total: 90, synced: 85 }
      };

      const summary = reportGenerator.generateSummary(options);

      assert.ok(summary.includes('提取: 90/100 成功'));
      assert.ok(summary.includes('失败: 3 个文件'));
      assert.ok(summary.includes('补充: 50 个规格'));
      assert.ok(summary.includes('同步: 85/90'));
    });

    it('should handle minimal options', () => {
      const options = {
        extractResult: { total: 10, success: 10 }
      };

      const summary = reportGenerator.generateSummary(options);

      assert.ok(summary.includes('提取: 10/10 成功'));
    });
  });

  describe('generateReport', () => {
    it('should generate markdown report', () => {
      const options = {
        projectInfo: {
          name: 'test-project',
          type: 'Node.js',
          srcDir: 'src',
          testDir: 'test',
          sourceFiles: ['a.js', 'b.js']
        },
        extractResult: {
          total: 10,
          success: 8,
          failed: [
            { file: 'c.js', error: 'Parse error' }
          ],
          results: [
            { success: true, quality: 'high' },
            { success: true, quality: 'medium' }
          ]
        },
        enrichResult: {
          enriched: 5
        },
        validateResult: {
          total: 8,
          synced: 6,
          drifted: ['spec-a.fspec.md', 'spec-b.fspec.md']
        }
      };

      const report = reportGenerator.generateReport(options);

      // 检查报告结构
      assert.ok(report.includes('# Brownfield 迁移报告'));
      assert.ok(report.includes('项目: test-project'));
      assert.ok(report.includes('类型: Node.js'));
      assert.ok(report.includes('## 📊 统计摘要'));
      assert.ok(report.includes('| 总文件数 | 10 |'));
      assert.ok(report.includes('| 提取成功 | 8 |'));
      assert.ok(report.includes('## 🎯 质量分布'));
      assert.ok(report.includes('## 📁 项目结构'));
      assert.ok(report.includes('## 📝 后续建议'));
      assert.ok(report.includes('## 🚀 下一步操作'));
      assert.ok(report.includes('迁移完成度'));
    });

    it('should include failed files section', () => {
      const options = {
        projectInfo: { type: 'Node.js', srcDir: 'src', testDir: 'test' },
        extractResult: {
          total: 5,
          success: 3,
          failed: [
            { file: 'a.js', error: 'Syntax error' },
            { file: 'b.js', error: 'Timeout' }
          ],
          results: []
        }
      };

      const report = reportGenerator.generateReport(options);

      assert.ok(report.includes('## ⚠️ 失败文件列表'));
      assert.ok(report.includes('`a.js`: Syntax error'));
      assert.ok(report.includes('`b.js`: Timeout'));
    });

    it('should show drifted specs in recommendations', () => {
      const options = {
        projectInfo: { type: 'Node.js', srcDir: 'src', testDir: 'test' },
        extractResult: { total: 10, success: 10, results: [] },
        validateResult: {
          total: 10,
          synced: 8,
          drifted: ['spec-a.fspec.md']
        }
      };

      const report = reportGenerator.generateReport(options);

      assert.ok(report.includes('审核 `spec-a.fspec.md`'));
    });

    it('should handle no drifted specs', () => {
      const options = {
        projectInfo: { type: 'Node.js', srcDir: 'src', testDir: 'test' },
        extractResult: { total: 10, success: 10, results: [] },
        validateResult: {
          total: 10,
          synced: 10,
          drifted: []
        }
      };

      const report = reportGenerator.generateReport(options);

      assert.ok(report.includes('[x] 所有规格与代码同步'));
    });
  });

  describe('generateJsonReport', () => {
    it('should generate JSON report object', () => {
      const options = {
        projectInfo: {
          name: 'test-project',
          type: 'Node.js',
          srcDir: 'src',
          testDir: 'test',
          sourceFiles: ['a.js', 'b.js']
        },
        extractResult: {
          total: 10,
          success: 8,
          failed: [{ file: 'c.js', error: 'Parse error' }],
          results: [
            { success: true, quality: 'high' },
            { success: true, quality: 'low' }
          ]
        },
        enrichResult: {
          enriched: 5,
          acExtracted: 10,
          frGenerated: 3
        },
        validateResult: {
          total: 8,
          synced: 6,
          drifted: ['a.fspec.md', 'b.fspec.md']
        }
      };

      const report = reportGenerator.generateJsonReport(options);

      assert.ok(report.timestamp);
      assert.strictEqual(report.project.name, 'test-project');
      assert.strictEqual(report.project.type, 'Node.js');
      assert.strictEqual(report.extraction.total, 10);
      assert.strictEqual(report.extraction.success, 8);
      assert.strictEqual(report.extraction.failed, 1);
      assert.strictEqual(report.enrichment.enriched, 5);
      assert.strictEqual(report.validation.synced, 6);
      assert.strictEqual(report.validation.drifted, 2);
      assert.strictEqual(report.quality.high, 1);
      assert.strictEqual(report.quality.low, 1);
      assert.ok(report.completeness >= 0 && report.completeness <= 100);
    });

    it('should handle null enrichment', () => {
      const options = {
        projectInfo: { type: 'Node.js', srcDir: '.', testDir: 'test' },
        extractResult: { total: 5, success: 5, failed: [], results: [] },
        enrichResult: null,
        validateResult: { total: 5, synced: 5, drifted: [] }
      };

      const report = reportGenerator.generateJsonReport(options);

      assert.strictEqual(report.enrichment, null);
    });
  });
});
