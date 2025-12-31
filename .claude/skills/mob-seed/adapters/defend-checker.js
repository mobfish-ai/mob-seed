/**
 * SEED 守护检查器
 *
 * 负责检查规格与代码的同步状态
 *
 * @module defend-checker
 * @see SKILL.md
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

/**
 * 守护检查器配置
 */
const DEFAULT_CONFIG = {
  outputDir: 'output/mob-seed',
  strict: false,
  rules: {
    frCoverage: true,
    acCoverage: true,
    docSync: true,
    versionSync: true,
  },
};

/**
 * 问题严重级别
 */
const Severity = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
};

/**
 * 漂移类型
 */
const DriftType = {
  MISSING: 'MISSING_DRIFT',
  ADDITION: 'ADDITION_DRIFT',
  MUTATION: 'MUTATION_DRIFT',
  VERSION: 'VERSION_DRIFT',
};

/**
 * 守护检查器
 * 检查规格与代码的同步状态
 */
export class DefendChecker {
  /**
   * @param {Object} config - 配置
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.issues = [];
    this.results = {
      spec: null,
      checkedAt: null,
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        warnings: 0,
      },
      coverage: {
        fr: { total: 0, covered: 0 },
        ac: { total: 0, covered: 0 },
        docs: { synced: false },
      },
      issues: [],
    };
  }

  /**
   * 执行同步检查
   * @param {string} specPath - 规格文件路径
   * @param {string} manifestPath - 清单文件路径
   * @returns {Object} 检查结果
   */
  async check(specPath, manifestPath) {
    this.results.checkedAt = new Date().toISOString();

    // 1. 加载规格
    const spec = this.parseSpec(specPath);
    this.results.spec = spec.name;

    // 2. 加载清单（如果存在）
    let manifest = null;
    if (manifestPath && existsSync(manifestPath)) {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    }

    // 3. 执行各项检查
    if (this.config.rules.frCoverage) {
      await this.checkFRCoverage(spec, manifest);
    }

    if (this.config.rules.acCoverage) {
      await this.checkACCoverage(spec, manifest);
    }

    if (this.config.rules.docSync) {
      await this.checkDocSync(spec, manifest);
    }

    if (this.config.rules.versionSync) {
      await this.checkVersionSync(spec, manifest);
    }

    // 4. 汇总结果
    this.summarize();

    return this.results;
  }

  /**
   * 解析规格文件
   * @param {string} specPath - 规格文件路径
   * @returns {Object} 解析结果
   */
  parseSpec(specPath) {
    if (!existsSync(specPath)) {
      throw new Error(`规格文件不存在: ${specPath}`);
    }

    const content = readFileSync(specPath, 'utf-8');
    const lines = content.split('\n');

    // 提取名称
    const titleLine = lines.find((line) => line.startsWith('# '));
    const name = titleLine
      ? titleLine.replace(/^# /, '').replace(/\s*规格$/, '').trim()
      : 'unknown';

    // 提取版本
    const versionMatch = content.match(/版本:\s*(\d+\.\d+\.\d+)/i);
    const version = versionMatch ? versionMatch[1] : '1.0.0';

    // 提取 FR 列表
    const frList = [];
    const frMatches = content.matchAll(/- \[[ x]\] (FR-\d{3}):\s*(.+)/g);
    for (const match of frMatches) {
      frList.push({
        id: match[1],
        description: match[2].trim(),
        completed: match[0].includes('[x]'),
      });
    }

    // 提取 AC 列表
    const acList = [];
    const acMatches = content.matchAll(/### (AC-\d{3}):\s*(.+)/g);
    for (const match of acMatches) {
      acList.push({
        id: match[1],
        title: match[2].trim(),
      });
    }

    return {
      path: specPath,
      name,
      version,
      requirements: frList,
      acceptance: acList,
    };
  }

  /**
   * 检查需求覆盖
   * @param {Object} spec - 规格
   * @param {Object} manifest - 清单
   */
  async checkFRCoverage(spec, manifest) {
    this.results.coverage.fr.total = spec.requirements.length;

    if (!manifest) {
      // 没有清单，所有 FR 都未覆盖
      for (const fr of spec.requirements) {
        this.addIssue({
          type: DriftType.MISSING,
          target: fr.id,
          severity: Severity.ERROR,
          message: `${fr.id} 未派生（无派生清单）`,
          suggestion: '运行 /mob-seed-emit 派生代码',
        });
      }
      return;
    }

    const codeOutput = manifest.outputs.find((o) => o.type === 'code');
    if (!codeOutput || !existsSync(codeOutput.path)) {
      // 代码文件不存在
      for (const fr of spec.requirements) {
        this.addIssue({
          type: DriftType.MISSING,
          target: fr.id,
          severity: Severity.ERROR,
          message: `${fr.id} 未实现（代码文件不存在）`,
          suggestion: '运行 /mob-seed-emit --code 派生代码',
        });
      }
      return;
    }

    // 读取代码文件，检查 @see 引用
    const codeContent = readFileSync(codeOutput.path, 'utf-8');

    for (const fr of spec.requirements) {
      const hasSeeRef = codeContent.includes(`@see ${fr.id}`);
      const hasFuncImpl = codeContent.includes(`function ${this.frToFuncName(fr.id)}`);

      if (hasSeeRef || hasFuncImpl) {
        this.results.coverage.fr.covered++;
      } else {
        this.addIssue({
          type: DriftType.MISSING,
          target: fr.id,
          severity: Severity.ERROR,
          message: `${fr.id} 未实现`,
          location: { spec: `${spec.path}` },
          suggestion: `在代码中添加 ${fr.id} 对应的实现`,
        });
      }
    }
  }

  /**
   * 检查验收标准覆盖
   * @param {Object} spec - 规格
   * @param {Object} manifest - 清单
   */
  async checkACCoverage(spec, manifest) {
    this.results.coverage.ac.total = spec.acceptance.length;

    if (!manifest) {
      for (const ac of spec.acceptance) {
        this.addIssue({
          type: DriftType.MISSING,
          target: ac.id,
          severity: Severity.WARNING,
          message: `${ac.id} 无测试（无派生清单）`,
          suggestion: '运行 /mob-seed-emit --test 派生测试',
        });
      }
      return;
    }

    const testOutput = manifest.outputs.find((o) => o.type === 'test');
    if (!testOutput || !existsSync(testOutput.path)) {
      for (const ac of spec.acceptance) {
        this.addIssue({
          type: DriftType.MISSING,
          target: ac.id,
          severity: Severity.WARNING,
          message: `${ac.id} 无测试（测试文件不存在）`,
          suggestion: '运行 /mob-seed-emit --test 派生测试',
        });
      }
      return;
    }

    const testContent = readFileSync(testOutput.path, 'utf-8');

    for (const ac of spec.acceptance) {
      if (testContent.includes(ac.id)) {
        this.results.coverage.ac.covered++;
      } else {
        this.addIssue({
          type: DriftType.MISSING,
          target: ac.id,
          severity: Severity.WARNING,
          message: `${ac.id} 无测试`,
          location: { spec: `${spec.path}` },
          suggestion: `添加 ${ac.id} 对应的测试用例`,
        });
      }
    }
  }

  /**
   * 检查文档同步
   * @param {Object} spec - 规格
   * @param {Object} manifest - 清单
   */
  async checkDocSync(spec, manifest) {
    if (!manifest) {
      this.addIssue({
        type: DriftType.VERSION,
        target: 'docs',
        severity: Severity.INFO,
        message: '无派生文档',
        suggestion: '运行 /mob-seed-emit --docs 派生文档',
      });
      return;
    }

    const docOutput = manifest.outputs.find((o) => o.type === 'docs');
    if (!docOutput || !existsSync(docOutput.path)) {
      this.addIssue({
        type: DriftType.VERSION,
        target: 'docs',
        severity: Severity.INFO,
        message: '文档文件不存在',
        suggestion: '运行 /mob-seed-emit --docs 派生文档',
      });
      return;
    }

    // 检查文档版本
    const docContent = readFileSync(docOutput.path, 'utf-8');
    const docVersionMatch = docContent.match(/版本:\s*(\d+\.\d+\.\d+)/i);
    const docVersion = docVersionMatch ? docVersionMatch[1] : null;

    if (docVersion !== spec.version) {
      this.addIssue({
        type: DriftType.VERSION,
        target: 'docs',
        severity: Severity.WARNING,
        message: `文档版本 (${docVersion || '未知'}) 与规格版本 (${spec.version}) 不一致`,
        suggestion: '运行 /mob-seed-emit --docs 更新文档',
      });
    } else {
      this.results.coverage.docs.synced = true;
    }
  }

  /**
   * 检查版本同步
   * @param {Object} spec - 规格
   * @param {Object} manifest - 清单
   */
  async checkVersionSync(spec, manifest) {
    if (!manifest) return;

    const codeOutput = manifest.outputs.find((o) => o.type === 'code');
    if (!codeOutput || !existsSync(codeOutput.path)) return;

    const codeContent = readFileSync(codeOutput.path, 'utf-8');
    const codeVersionMatch = codeContent.match(/@seed-version\s+(\d+\.\d+\.\d+)/);

    if (codeVersionMatch && codeVersionMatch[1] !== '1.0.0') {
      // 如果代码有版本标记且不是默认值，检查是否与规格一致
      if (codeVersionMatch[1] !== spec.version) {
        this.addIssue({
          type: DriftType.VERSION,
          target: 'code',
          severity: Severity.INFO,
          message: `代码版本 (${codeVersionMatch[1]}) 与规格版本 (${spec.version}) 不一致`,
          suggestion: '运行 /mob-seed-emit --code 更新代码',
        });
      }
    }
  }

  /**
   * FR ID 转函数名
   * @param {string} frId - FR ID
   * @returns {string} 函数名
   */
  frToFuncName(frId) {
    return frId.toLowerCase().replace(/-/g, '_');
  }

  /**
   * 添加问题
   * @param {Object} issue - 问题
   */
  addIssue(issue) {
    this.issues.push(issue);
    this.results.issues.push(issue);
  }

  /**
   * 汇总结果
   */
  summarize() {
    this.results.summary.total = this.issues.length;
    this.results.summary.failed = this.issues.filter(
      (i) => i.severity === Severity.ERROR
    ).length;
    this.results.summary.warnings = this.issues.filter(
      (i) => i.severity === Severity.WARNING
    ).length;
    this.results.summary.passed =
      this.results.summary.total -
      this.results.summary.failed -
      this.results.summary.warnings;
  }

  /**
   * 生成报告
   * @returns {string} Markdown 报告
   */
  generateReport() {
    const r = this.results;
    const timestamp = new Date().toISOString().split('T')[0];

    const errorIssues = this.issues.filter((i) => i.severity === Severity.ERROR);
    const warningIssues = this.issues.filter((i) => i.severity === Severity.WARNING);
    const infoIssues = this.issues.filter((i) => i.severity === Severity.INFO);

    return `# 守护报告: ${r.spec || '未知'}

> 检查时间: ${r.checkedAt} | 总计: ${r.summary.total} 项

## 📊 同步状态

| 检查项 | 状态 | 详情 |
|--------|------|------|
| 需求覆盖 | ${r.coverage.fr.covered === r.coverage.fr.total ? '✅' : '⚠️'} | ${r.coverage.fr.covered}/${r.coverage.fr.total} FR 已实现 |
| 测试覆盖 | ${r.coverage.ac.covered === r.coverage.ac.total ? '✅' : '⚠️'} | ${r.coverage.ac.covered}/${r.coverage.ac.total} AC 有测试 |
| 文档同步 | ${r.coverage.docs.synced ? '✅' : '⚠️'} | ${r.coverage.docs.synced ? '已同步' : '需更新'} |

## 📋 问题汇总

| 级别 | 数量 |
|------|------|
| 🔴 错误 | ${errorIssues.length} |
| 🟡 警告 | ${warningIssues.length} |
| 🔵 信息 | ${infoIssues.length} |

${errorIssues.length > 0 ? `### 🔴 错误

${errorIssues.map((i, idx) => `${idx + 1}. **${i.target}**: ${i.message}
   - 建议: ${i.suggestion}`).join('\n\n')}
` : ''}

${warningIssues.length > 0 ? `### 🟡 警告

${warningIssues.map((i, idx) => `${idx + 1}. **${i.target}**: ${i.message}
   - 建议: ${i.suggestion}`).join('\n\n')}
` : ''}

${infoIssues.length > 0 ? `### 🔵 信息

${infoIssues.map((i, idx) => `${idx + 1}. **${i.target}**: ${i.message}
   - 建议: ${i.suggestion}`).join('\n\n')}
` : ''}

---
> 📄 由 SEED 守护检查器生成 | ${timestamp}
`;
  }

  /**
   * 保存报告
   * @param {string} outputDir - 输出目录
   * @returns {Object} 报告文件路径
   */
  saveReport(outputDir = this.config.outputDir) {
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = Date.now();

    // JSON 详情
    writeFileSync(
      join(outputDir, `defend-report-${timestamp}.json`),
      JSON.stringify(this.results, null, 2),
      'utf-8'
    );

    // Markdown 摘要
    writeFileSync(
      join(outputDir, `defend-summary-${timestamp}.md`),
      this.generateReport(),
      'utf-8'
    );

    return {
      json: join(outputDir, `defend-report-${timestamp}.json`),
      md: join(outputDir, `defend-summary-${timestamp}.md`),
    };
  }

  /**
   * 检查是否通过
   * @returns {boolean}
   */
  isPassed() {
    if (this.config.strict) {
      // 严格模式：警告也算失败
      return this.results.summary.failed === 0 && this.results.summary.warnings === 0;
    }
    // 普通模式：只看错误
    return this.results.summary.failed === 0;
  }
}

/**
 * 快捷函数：执行检查
 * @param {string} specPath - 规格文件路径
 * @param {Object} options - 选项
 * @returns {Promise<Object>} 检查结果
 */
export async function defend(specPath, options = {}) {
  const checker = new DefendChecker(options.config);
  const result = await checker.check(specPath, options.manifestPath);

  if (options.saveReport !== false) {
    checker.saveReport(options.outputDir);
  }

  return {
    ...result,
    passed: checker.isPassed(),
  };
}

// 导出配置和常量
export { DEFAULT_CONFIG, Severity, DriftType };
