/**
 * SEED 执行引擎
 *
 * 负责执行派生的代码和测试
 *
 * @module exec-runner
 * @see SKILL.md
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { spawn } from 'child_process';

/**
 * 执行引擎配置
 */
const DEFAULT_CONFIG = {
  timeout: 60000,
  ci: {
    coverage: {
      lines: 80,
      branches: 70,
    },
    lint: {
      maxWarnings: 0,
    },
  },
  outputDir: 'output/mob-seed',
};

/**
 * 执行引擎
 * 根据派生清单执行测试和构建
 */
export class ExecRunner {
  /**
   * @param {Object} config - 配置
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.results = {
      spec: null,
      executedAt: null,
      duration: 0,
      tests: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        failures: [],
      },
      build: {
        syntax: 'pending',
        lint: { errors: 0, warnings: 0 },
      },
    };
  }

  /**
   * 加载派生清单
   * @param {string} manifestPath - 清单路径
   * @returns {Object} 清单数据
   */
  loadManifest(manifestPath) {
    if (!existsSync(manifestPath)) {
      throw new Error(`派生清单不存在: ${manifestPath}`);
    }

    const content = readFileSync(manifestPath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * 执行测试
   * @param {string} testPath - 测试文件路径
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 测试结果
   */
  async runTests(testPath, options = {}) {
    const { timeout = this.config.timeout } = options;

    if (!existsSync(testPath)) {
      return {
        status: 'skipped',
        reason: `测试文件不存在: ${testPath}`,
      };
    }

    return new Promise((resolve) => {
      const startTime = Date.now();
      let output = '';
      let errorOutput = '';

      const proc = spawn('node', ['--test', testPath], {
        timeout,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      proc.stdout.on('data', (data) => {
        output += data.toString();
      });

      proc.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      proc.on('close', (code) => {
        const duration = Date.now() - startTime;
        const result = this.parseTestOutput(output);

        resolve({
          status: code === 0 ? 'passed' : 'failed',
          exitCode: code,
          duration,
          ...result,
          output: output,
          errorOutput: errorOutput,
        });
      });

      proc.on('error', (err) => {
        resolve({
          status: 'error',
          error: err.message,
          duration: Date.now() - startTime,
        });
      });
    });
  }

  /**
   * 解析测试输出
   * @param {string} output - node --test 输出
   * @returns {Object} 解析结果
   */
  parseTestOutput(output) {
    const result = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      failures: [],
    };

    // 解析 node:test 输出格式
    const lines = output.split('\n');

    for (const line of lines) {
      // ℹ tests 18
      if (line.includes('ℹ tests')) {
        const match = line.match(/tests\s+(\d+)/);
        if (match) result.total = parseInt(match[1], 10);
      }
      // ℹ pass 18
      if (line.includes('ℹ pass')) {
        const match = line.match(/pass\s+(\d+)/);
        if (match) result.passed = parseInt(match[1], 10);
      }
      // ℹ fail 0
      if (line.includes('ℹ fail')) {
        const match = line.match(/fail\s+(\d+)/);
        if (match) result.failed = parseInt(match[1], 10);
      }
      // ℹ skipped 0
      if (line.includes('ℹ skipped')) {
        const match = line.match(/skipped\s+(\d+)/);
        if (match) result.skipped = parseInt(match[1], 10);
      }
      // ✖ test name
      if (line.includes('✖')) {
        result.failures.push({
          name: line.replace('✖', '').trim(),
        });
      }
    }

    return result;
  }

  /**
   * 执行语法检查
   * @param {string} codePath - 代码文件路径
   * @returns {Promise<Object>} 检查结果
   */
  async checkSyntax(codePath) {
    if (!existsSync(codePath)) {
      return {
        status: 'skipped',
        reason: `代码文件不存在: ${codePath}`,
      };
    }

    return new Promise((resolve) => {
      const proc = spawn('node', ['--check', codePath], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let errorOutput = '';

      proc.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      proc.on('close', (code) => {
        resolve({
          status: code === 0 ? 'passed' : 'failed',
          error: code !== 0 ? errorOutput : null,
        });
      });

      proc.on('error', (err) => {
        resolve({
          status: 'error',
          error: err.message,
        });
      });
    });
  }

  /**
   * 执行完整检查
   * @param {string} manifestPath - 清单路径
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 执行结果
   */
  async execute(manifestPath, options = {}) {
    const { types = ['test', 'build'], ci = false } = options;

    const startTime = Date.now();
    this.results.executedAt = new Date().toISOString();

    // 1. 加载清单
    const manifest = this.loadManifest(manifestPath);
    this.results.spec = manifest.spec;

    // 2. 查找派生产物
    const testOutput = manifest.outputs.find((o) => o.type === 'test');
    const codeOutput = manifest.outputs.find((o) => o.type === 'code');

    // 3. 执行测试
    if (types.includes('test') && testOutput) {
      const testResult = await this.runTests(testOutput.path, {
        timeout: ci ? this.config.ci.timeout : this.config.timeout,
      });
      this.results.tests = {
        ...this.results.tests,
        ...testResult,
      };
    }

    // 4. 执行构建检查
    if (types.includes('build') && codeOutput) {
      const syntaxResult = await this.checkSyntax(codeOutput.path);
      this.results.build.syntax = syntaxResult.status;
      if (syntaxResult.error) {
        this.results.build.syntaxError = syntaxResult.error;
      }
    }

    this.results.duration = Date.now() - startTime;

    // 5. CI 模式额外检查
    if (ci) {
      this.results.ci = this.checkCiThresholds();
    }

    return this.results;
  }

  /**
   * 检查 CI 阈值
   * @returns {Object} CI 检查结果
   */
  checkCiThresholds() {
    const checks = [];
    let passed = true;

    // 测试必须全部通过
    if (this.results.tests.failed > 0) {
      checks.push({
        name: 'tests',
        status: 'failed',
        message: `${this.results.tests.failed} 个测试失败`,
      });
      passed = false;
    } else {
      checks.push({
        name: 'tests',
        status: 'passed',
      });
    }

    // 语法检查必须通过
    if (this.results.build.syntax === 'failed') {
      checks.push({
        name: 'syntax',
        status: 'failed',
        message: this.results.build.syntaxError,
      });
      passed = false;
    } else if (this.results.build.syntax === 'passed') {
      checks.push({
        name: 'syntax',
        status: 'passed',
      });
    }

    return {
      passed,
      checks,
      exitCode: passed ? 0 : 1,
    };
  }

  /**
   * 生成可读报告
   * @returns {string} Markdown 报告
   */
  generateReport() {
    const r = this.results;
    const timestamp = new Date().toISOString().split('T')[0];

    return `# 执行报告: ${r.spec || '未知'}

> 执行时间: ${r.executedAt} | 耗时: ${(r.duration / 1000).toFixed(2)}s

## 📊 测试结果

| 指标 | 数值 |
|------|------|
| 总数 | ${r.tests.total} |
| ✅ 通过 | ${r.tests.passed} |
| ❌ 失败 | ${r.tests.failed} |
| ⏭️ 跳过 | ${r.tests.skipped} |

${r.tests.failures.length > 0 ? `### 失败详情

${r.tests.failures.map((f, i) => `${i + 1}. **${f.name}**`).join('\n')}
` : ''}

## 🔨 构建结果

| 检查项 | 状态 |
|--------|------|
| 语法检查 | ${r.build.syntax === 'passed' ? '✅ 通过' : r.build.syntax === 'failed' ? '❌ 失败' : '⏭️ 跳过'} |

${r.ci ? `## 🚦 CI 状态

**总体状态**: ${r.ci.passed ? '✅ 通过' : '❌ 失败'}

| 检查项 | 状态 |
|--------|------|
${r.ci.checks.map((c) => `| ${c.name} | ${c.status === 'passed' ? '✅' : '❌'} ${c.message || ''} |`).join('\n')}
` : ''}

---
> 📄 由 SEED 执行引擎生成 | ${timestamp}
`;
  }

  /**
   * 保存报告
   * @param {string} outputDir - 输出目录
   */
  saveReport(outputDir = this.config.outputDir) {
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = Date.now();

    // JSON 详情
    writeFileSync(
      join(outputDir, `exec-report-${timestamp}.json`),
      JSON.stringify(this.results, null, 2),
      'utf-8'
    );

    // Markdown 摘要
    writeFileSync(
      join(outputDir, `exec-summary-${timestamp}.md`),
      this.generateReport(),
      'utf-8'
    );

    return {
      json: join(outputDir, `exec-report-${timestamp}.json`),
      md: join(outputDir, `exec-summary-${timestamp}.md`),
    };
  }
}

/**
 * 快捷函数：执行检查
 * @param {string} manifestPath - 清单路径
 * @param {Object} options - 选项
 * @returns {Promise<Object>} 执行结果
 */
export async function execute(manifestPath, options = {}) {
  const runner = new ExecRunner(options.config);
  const result = await runner.execute(manifestPath, options);

  if (options.saveReport !== false) {
    runner.saveReport(options.outputDir);
  }

  return result;
}

// 导出默认配置
export { DEFAULT_CONFIG };
