/**
 * 项目技术栈解析器
 * @module stacks/resolver
 * @see specs/multi-language-stack.fspec.md
 * @generated-from specs/multi-language-stack.fspec.md
 * @generated-at 2026-01-01
 * @seed-version 1.1.0
 *
 * ⚠️ 此文件由 SEED 自动派生，请勿手动修改
 */

const { normalize, sep } = require("node:path");

/**
 * @typedef {import('./types.js').StackPack} StackPack
 * @typedef {import('./types.js').ProjectStackConfig} ProjectStackConfig
 * @typedef {import('./loader.js').StackLoader} StackLoader
 */

/**
 * 项目技术栈解析器
 * 根据项目配置和路径映射解析目标技术栈
 *
 * @see FR-007 项目级配置
 * @see FR-008 目录技术栈映射
 */
class StackResolver {
  /** @type {StackLoader} */
  #loader;

  /** @type {ProjectStackConfig} */
  #config;

  /** @type {string[]} 按路径长度降序排列，用于最长匹配 */
  #sortedPaths;

  /**
   * @param {StackLoader} loader - 技术栈加载器
   * @param {ProjectStackConfig} config - 项目技术栈配置
   */
  constructor(loader, config) {
    this.#loader = loader;
    this.#config = config;

    // 预处理路径映射，按长度降序排列实现最长匹配
    this.#sortedPaths = Object.keys(config.stacks || {}).sort(
      (a, b) => b.length - a.length
    );
  }

  /**
   * 根据规格文件路径解析目标技术栈
   * @param {string} specPath - 规格文件路径
   * @returns {StackPack | undefined}
   * @see FR-008, AC-004
   */
  resolveForSpec(specPath) {
    // 1. 首先尝试从规格文件内容解析技术栈声明
    // （此处需要读取文件，由调用方处理）

    // 2. 根据输出路径匹配
    const outputPath = this.#getOutputPathForSpec(specPath);
    if (outputPath) {
      const stack = this.resolveForOutput(outputPath);
      if (stack) return stack;
    }

    // 3. 回退到默认技术栈
    return this.#loader.get(this.#config.default);
  }

  /**
   * 根据输出路径解析目标技术栈
   * @param {string} outputPath - 输出文件路径
   * @returns {StackPack | undefined}
   * @see FR-008
   */
  resolveForOutput(outputPath) {
    const normalizedPath = normalize(outputPath).split(sep).join("/");

    // 最长路径匹配
    for (const stackPath of this.#sortedPaths) {
      if (normalizedPath.startsWith(stackPath)) {
        const stackName = this.#config.stacks?.[stackPath];
        if (stackName) {
          return this.#loader.get(stackName);
        }
      }
    }

    // 尝试按文件扩展名匹配
    const stack = this.#loader.matchByExtension(outputPath);
    if (stack) return stack;

    // 回退到默认技术栈
    return this.#loader.get(this.#config.default);
  }

  /**
   * 根据规格文件推断输出路径
   * （简单实现，实际可能需要读取规格文件的派生路径声明）
   * @param {string} specPath - 规格文件路径
   * @returns {string | undefined}
   */
  #getOutputPathForSpec(specPath) {
    // 从 specs/xxx.fspec.md 推断为 src/xxx
    const match = specPath.match(/specs\/(.+)\.fspec\.md$/);
    if (match) {
      return `src/${match[1]}`;
    }
    return undefined;
  }

  /**
   * 获取项目所有使用的技术栈
   * @returns {StackPack[]}
   * @see FR-007
   */
  getProjectStacks() {
    /** @type {Set<StackPack>} */
    const stacks = new Set();

    // 添加默认技术栈
    const defaultStack = this.#loader.get(this.#config.default);
    if (defaultStack) {
      stacks.add(defaultStack);
    }

    // 添加所有路径映射的技术栈
    if (this.#config.stacks) {
      for (const stackName of Object.values(this.#config.stacks)) {
        const stack = this.#loader.get(stackName);
        if (stack) {
          stacks.add(stack);
        }
      }
    }

    return Array.from(stacks);
  }

  /**
   * 获取项目所有使用的技术栈（别名，保持兼容）
   * @returns {StackPack[]}
   * @deprecated 使用 getProjectStacks() 代替
   */
  getProjectLanguages() {
    return this.getProjectStacks();
  }

  /**
   * 获取指定路径的技术栈配置
   * @param {string} path - 文件路径
   * @returns {StackPack | undefined}
   */
  getStackForPath(path) {
    return this.resolveForOutput(path);
  }

  /**
   * 获取所有路径映射
   * @returns {Record<string, string>}
   */
  getStackMappings() {
    return { ...this.#config.stacks };
  }

  /**
   * 检查路径是否有明确的技术栈映射
   * @param {string} path - 文件路径
   * @returns {boolean}
   */
  hasExplicitMapping(path) {
    const normalizedPath = normalize(path).split(sep).join("/");
    for (const stackPath of this.#sortedPaths) {
      if (normalizedPath.startsWith(stackPath)) {
        return true;
      }
    }
    return false;
  }
}

/**
 * 从规格文件内容解析技术栈声明
 * @param {string} specContent - 规格文件内容
 * @returns {string | null}
 * @see FR-004, AC-003
 */
function parseSpecStackDeclaration(specContent) {
  // 匹配 "技术栈: xxx" 或 "Tech Stack: xxx"
  const patterns = [
    /^>\s*技术栈:\s*(.+)$/m,
    /^>\s*Tech Stack:\s*(.+)$/im,
    /^>\s*模板:\s*(.+)$/m,
  ];

  for (const pattern of patterns) {
    const match = specContent.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * 从规格文件内容解析派生路径
 * @param {string} specContent - 规格文件内容
 * @returns {string | null}
 * @see FR-010
 */
function parseSpecOutputPath(specContent) {
  // 匹配 "派生路径: xxx"
  const patterns = [
    /^>\s*派生路径:\s*(.+)$/m,
    /^>\s*Output Path:\s*(.+)$/im,
  ];

  for (const pattern of patterns) {
    const match = specContent.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
}

module.exports = {
  StackResolver,
  parseSpecStackDeclaration,
  parseSpecOutputPath,
};
