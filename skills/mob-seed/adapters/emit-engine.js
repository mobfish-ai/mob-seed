/**
 * SEED 派生引擎
 *
 * 负责从规格文件派生代码、测试、文档
 *
 * @module emit-engine
 * @see SKILL.md
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

/**
 * 派生引擎配置
 */
const DEFAULT_CONFIG = {
  targets: {
    code: { enabled: true, path: 'src/', overwrite: false },
    test: { enabled: true, path: 'test/', overwrite: false },
    docs: { enabled: true, path: 'docs/', overwrite: true },
  },
  manifestPath: 'output/mob-seed/seed-manifest.json',
};

/**
 * 规格解析器
 * 解析 .fspec.md 文件，提取结构化数据
 */
export class SpecParser {
  /**
   * 解析规格文件
   * @param {string} specPath - 规格文件路径
   * @returns {ParsedSpec} 解析后的规格对象
   */
  static parse(specPath) {
    if (!existsSync(specPath)) {
      throw new Error(`规格文件不存在: ${specPath}`);
    }

    const content = readFileSync(specPath, 'utf-8');
    const lines = content.split('\n');

    const spec = {
      path: specPath,
      name: this.extractName(lines),
      version: this.extractVersion(content),
      overview: this.extractSection(content, '概述', 'Overview'),
      requirements: this.extractRequirements(content),
      constraints: this.extractSection(content, '约束', 'Constraints'),
      acceptance: this.extractAcceptanceCriteria(content),
      derivedOutputs: this.extractDerivedOutputs(content),
    };

    return spec;
  }

  /**
   * 提取规格名称
   */
  static extractName(lines) {
    const titleLine = lines.find((line) => line.startsWith('# '));
    if (!titleLine) return 'unknown';
    return titleLine
      .replace(/^# /, '')
      .replace(/\s*规格$/, '')
      .replace(/\s*Spec$/, '')
      .trim();
  }

  /**
   * 提取版本号
   */
  static extractVersion(content) {
    const match = content.match(/版本:\s*(\d+\.\d+\.\d+)|version:\s*(\d+\.\d+\.\d+)/i);
    return match ? match[1] || match[2] : '1.0.0';
  }

  /**
   * 提取章节内容
   */
  static extractSection(content, ...sectionNames) {
    for (const name of sectionNames) {
      const regex = new RegExp(`## ${name}[\\s\\S]*?(?=\\n## |$)`, 'i');
      const match = content.match(regex);
      if (match) {
        return match[0]
          .replace(/^## .+\n/, '')
          .trim();
      }
    }
    return '';
  }

  /**
   * 提取需求列表
   */
  static extractRequirements(content) {
    const requirements = {
      functional: [],
      nonFunctional: [],
    };

    // 功能需求 FR-xxx
    const frMatches = content.matchAll(/- \[[ x]\] (FR-\d{3}):\s*(.+)/g);
    for (const match of frMatches) {
      requirements.functional.push({
        id: match[1],
        description: match[2].trim(),
        completed: match[0].includes('[x]'),
      });
    }

    // 非功能需求 NFR-xxx
    const nfrMatches = content.matchAll(/- \[[ x]\] (NFR-\d{3}):\s*(.+)/g);
    for (const match of nfrMatches) {
      requirements.nonFunctional.push({
        id: match[1],
        description: match[2].trim(),
        completed: match[0].includes('[x]'),
      });
    }

    return requirements;
  }

  /**
   * 提取验收标准
   */
  static extractAcceptanceCriteria(content) {
    const criteria = [];
    const acRegex = /### (AC-\d{3}):\s*(.+)\n([\s\S]*?)(?=\n### |$)/g;

    let match;
    while ((match = acRegex.exec(content)) !== null) {
      const acContent = match[3];
      criteria.push({
        id: match[1],
        title: match[2].trim(),
        given: this.extractGWT(acContent, 'Given'),
        when: this.extractGWT(acContent, 'When'),
        then: this.extractGWT(acContent, 'Then'),
      });
    }

    return criteria;
  }

  /**
   * 提取 Given/When/Then
   */
  static extractGWT(content, type) {
    const regex = new RegExp(`\\*\\*${type}\\*\\*:\\s*(.+)`, 'i');
    const match = content.match(regex);
    return match ? match[1].trim() : '';
  }

  /**
   * 提取派生产物配置
   */
  static extractDerivedOutputs(content) {
    const outputs = [];
    const tableRegex = /\|\s*(\w+)\s*\|\s*([^\|]+)\s*\|\s*([^\|]+)\s*\|/g;

    let match;
    let headerPassed = false;

    while ((match = tableRegex.exec(content)) !== null) {
      // 跳过表头和分隔行
      if (match[1].includes('类型') || match[1].includes('---')) {
        headerPassed = true;
        continue;
      }

      if (headerPassed) {
        outputs.push({
          type: match[1].trim().toLowerCase(),
          path: match[2].trim(),
          description: match[3].trim(),
        });
      }
    }

    return outputs;
  }
}

/**
 * 派生引擎
 * 根据解析的规格生成代码/测试/文档
 */
export class EmitEngine {
  /**
   * @param {Object} config - 配置
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.manifest = {
      spec: null,
      emittedAt: null,
      outputs: [],
    };
  }

  /**
   * 执行派生
   * @param {string} specPath - 规格文件路径
   * @param {Object} options - 选项
   * @returns {EmitResult}
   */
  async emit(specPath, options = {}) {
    const { types = ['code', 'test', 'docs'], dryRun = false } = options;

    // 1. 解析规格
    const spec = SpecParser.parse(specPath);
    this.manifest.spec = specPath;
    this.manifest.emittedAt = new Date().toISOString();

    const results = {
      spec: spec.name,
      emitted: [],
      skipped: [],
      errors: [],
    };

    // 2. 执行各类型派生
    for (const type of types) {
      if (!this.config.targets[type]?.enabled) {
        results.skipped.push({ type, reason: 'disabled in config' });
        continue;
      }

      try {
        const output = await this.emitType(spec, type, dryRun);
        if (output) {
          results.emitted.push(output);
          this.manifest.outputs.push(output);
        }
      } catch (error) {
        results.errors.push({ type, error: error.message });
      }
    }

    // 3. 保存清单
    if (!dryRun) {
      this.saveManifest();
    }

    return results;
  }

  /**
   * 派生特定类型
   */
  async emitType(spec, type, dryRun) {
    const targetConfig = this.config.targets[type];
    const outputPath = this.resolveOutputPath(spec, type, targetConfig.path);

    // 检查是否已存在
    if (existsSync(outputPath) && !targetConfig.overwrite) {
      return { type, path: outputPath, status: 'skipped', reason: 'exists' };
    }

    // 生成内容
    const content = this.generateContent(spec, type);

    if (dryRun) {
      return { type, path: outputPath, status: 'dry-run', content };
    }

    // 写入文件
    this.writeOutput(outputPath, content);

    return {
      type,
      path: outputPath,
      status: 'created',
    };
  }

  /**
   * 解析输出路径
   */
  resolveOutputPath(spec, type, basePath) {
    const moduleName = spec.name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    const extensions = {
      code: '.js',
      test: '.test.js',
      docs: '.md',
    };

    return join(basePath, moduleName, `index${extensions[type]}`);
  }

  /**
   * 生成内容
   */
  generateContent(spec, type) {
    const generators = {
      code: this.generateCode.bind(this),
      test: this.generateTest.bind(this),
      docs: this.generateDocs.bind(this),
    };

    return generators[type](spec);
  }

  /**
   * 生成代码提示（供 Claude 参考）
   *
   * 注意：这只是生成代码骨架的辅助函数。
   * 实际派生时，Claude 应该根据 prompts/emit-code.md 生成完整实现代码，
   * 而不是使用这个模板生成空壳。
   *
   * 如果需要程序化生成，调用者应提供实现逻辑。
   */
  generateCode(spec, implementations = {}) {
    const header = this.generateHeader(spec);
    const requirements = spec.requirements.functional;

    const functions = requirements.map((req) => {
      const funcName = this.reqToFunctionName(req.id);
      const impl = implementations[req.id] || implementations[funcName];

      if (impl) {
        // 如果提供了实现，使用它
        return `
/**
 * ${req.description}
 * @see ${req.id}
 */
export async function ${funcName}(${impl.params || ''}) {
${impl.body.split('\n').map(line => '  ' + line).join('\n')}
}
`;
      } else {
        // 没有提供实现时，生成需要 Claude 填充的占位
        return `
/**
 * ${req.description}
 * @see ${req.id}
 *
 * ⚠️ 需要 Claude 根据规格实现此函数
 * 规格要求：${req.description}
 */
export async function ${funcName}(/* 根据规格添加参数 */) {
  // Claude 应该根据 ${req.id} 规格实现完整逻辑
  // 参考: prompts/emit-code.md
}
`;
      }
    }).join('\n');

    return `${header}
${functions}
`;
  }

  /**
   * 生成测试提示（供 Claude 参考）
   *
   * 注意：这只是生成测试骨架的辅助函数。
   * 实际派生时，Claude 应该根据 prompts/emit-test.md 生成完整测试代码，
   * 包含真实断言和完整的 Given/When/Then 实现。
   */
  generateTest(spec, testImplementations = {}) {
    const header = this.generateHeader(spec);

    const tests = spec.acceptance.map((ac) => {
      const impl = testImplementations[ac.id];

      if (impl) {
        // 如果提供了实现，使用它
        return `
  describe('${ac.id}: ${ac.title}', () => {
    it('should ${ac.title.toLowerCase()}', async () => {
      // Given: ${ac.given}
${impl.given ? impl.given.split('\n').map(l => '      ' + l).join('\n') : ''}

      // When: ${ac.when}
${impl.when ? impl.when.split('\n').map(l => '      ' + l).join('\n') : ''}

      // Then: ${ac.then}
${impl.then ? impl.then.split('\n').map(l => '      ' + l).join('\n') : ''}
    });
  });
`;
      } else {
        // 没有提供实现时，生成需要 Claude 填充的结构
        return `
  describe('${ac.id}: ${ac.title}', () => {
    /**
     * ⚠️ 需要 Claude 根据验收标准实现此测试
     *
     * Given: ${ac.given}
     * When: ${ac.when}
     * Then: ${ac.then}
     *
     * 参考: prompts/emit-test.md
     */
    it('should ${ac.title.toLowerCase()}', async () => {
      // Claude 应该根据 AC 实现完整测试逻辑
    });
  });
`;
      }
    }).join('\n');

    return `${header}
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

describe('${spec.name}', () => {
  beforeEach(async () => {
    // 测试前置设置
  });

  afterEach(async () => {
    // 测试清理
  });
${tests}
});
`;
  }

  /**
   * 生成文档
   */
  generateDocs(spec) {
    const timestamp = new Date().toISOString().split('T')[0];

    return `# ${spec.name}

> 版本: ${spec.version} | 最后更新: ${timestamp}

## 简介

${spec.overview || '待补充'}

## 功能特点

${spec.requirements.functional.map((r) => `- ${r.description}`).join('\n')}

## 快速开始

\`\`\`javascript
// 示例代码
import { module } from './${spec.name.toLowerCase().replace(/\s+/g, '-')}';

// TODO: 添加使用示例
\`\`\`

## 详细说明

${spec.requirements.functional.map((r) => `### ${r.id}: ${r.description}

待补充详细说明。
`).join('\n')}

## 注意事项

${spec.constraints || '暂无特殊注意事项。'}

---

> 此文档由 SEED 自动派生自 ${spec.path}
> 生成时间: ${new Date().toISOString()}
`;
  }

  /**
   * 生成文件头
   */
  generateHeader(spec) {
    const timestamp = new Date().toISOString();
    return `/**
 * @generated-from ${spec.path}
 * @generated-at ${timestamp}
 * @seed-version 1.0.0
 *
 * 此文件由 SEED 自动派生，请勿手动修改
 * 如需修改，请更新规格文件后重新派生
 */
`;
  }

  /**
   * 需求 ID 转函数名
   */
  reqToFunctionName(reqId) {
    return reqId.toLowerCase().replace(/-/g, '_');
  }

  /**
   * 写入输出文件
   */
  writeOutput(filePath, content) {
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(filePath, content, 'utf-8');
  }

  /**
   * 保存派生清单
   */
  saveManifest() {
    const dir = dirname(this.config.manifestPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(
      this.config.manifestPath,
      JSON.stringify(this.manifest, null, 2),
      'utf-8'
    );
  }
}

/**
 * 快捷函数：执行派生
 * @param {string} specPath - 规格文件路径
 * @param {Object} options - 选项
 * @returns {EmitResult}
 */
export async function emit(specPath, options = {}) {
  const engine = new EmitEngine(options.config);
  return engine.emit(specPath, options);
}

// 导出默认配置
export { DEFAULT_CONFIG };
