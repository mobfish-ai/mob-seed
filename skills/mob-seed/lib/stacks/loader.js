/**
 * 技术栈包加载器
 * @module stacks/loader
 * @see specs/multi-language-stack.fspec.md
 * @generated-from specs/multi-language-stack.fspec.md
 * @generated-at 2025-12-31
 * @seed-version 1.1.0
 *
 * ⚠️ 此文件由 SEED 自动派生，请勿手动修改
 */

const { readdir, readFile } = require("node:fs/promises");
const { join, extname } = require("node:path");

/**
 * @typedef {import('./types.js').StackPack} StackPack
 * @typedef {import('./types.js').StackPackMeta} StackPackMeta
 * @typedef {import('./types.js').StackPackSummary} StackPackSummary
 * @typedef {import('./types.js').StackDiscoveryResult} StackDiscoveryResult
 * @typedef {import('./types.js').PromptType} PromptType
 */

/**
 * 技术栈包加载器
 * 运行时扫描 stacks/ 目录，自动发现所有技术栈包
 *
 * @see FR-001 运行时自动扫描
 * @see FR-002 技术栈包自描述
 * @see FR-003 扩展名匹配
 */
class StackLoader {
  /** @type {string} */
  #stacksDir;

  /** @type {Map<string, StackPack>} */
  #stacks;

  /** @type {Map<string, string>} extension → stack name */
  #extensionMap;

  /**
   * @param {string} stacksDir - 技术栈包目录路径
   */
  constructor(stacksDir) {
    this.#stacksDir = stacksDir;
    this.#stacks = new Map();
    this.#extensionMap = new Map();
  }

  /**
   * 扫描并加载所有技术栈包
   * @returns {Promise<StackDiscoveryResult>}
   * @see AC-001
   */
  async discover() {
    /** @type {Array<{path: string, reason: string}>} */
    const skipped = [];

    try {
      const entries = await readdir(this.#stacksDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const stackDir = join(this.#stacksDir, entry.name);
        const result = await this.#loadStackConfig(stackDir);

        if (result.success && result.config) {
          /** @type {StackPack} */
          const pack = {
            ...result.config,
            path: stackDir,
          };
          this.#stacks.set(pack.name, pack);

          // 建立扩展名映射
          for (const ext of pack.extensions) {
            this.#extensionMap.set(ext, pack.name);
          }
        } else {
          skipped.push({ path: stackDir, reason: result.error || "Unknown error" });
        }
      }
    } catch (error) {
      // 目录不存在等情况
      if (error.code === "ENOENT") {
        skipped.push({
          path: this.#stacksDir,
          reason: "Stacks directory not found",
        });
      } else {
        throw error;
      }
    }

    return { stacks: this.#stacks, skipped };
  }

  /**
   * 加载单个技术栈包配置
   * @param {string} stackDir - 技术栈包目录
   * @returns {Promise<{success: boolean, config?: StackPackMeta, error?: string}>}
   * @see FR-002
   */
  async #loadStackConfig(stackDir) {
    const configPath = join(stackDir, "stack.json");

    try {
      const content = await readFile(configPath, "utf-8");
      /** @type {StackPackMeta} */
      const config = JSON.parse(content);

      // 验证必需字段
      if (!config.name || !config.extensions || !config.runtime) {
        return {
          success: false,
          error: "Missing required fields: name, extensions, or runtime",
        };
      }

      return { success: true, config };
    } catch (error) {
      if (error.code === "ENOENT") {
        return { success: false, error: "stack.json not found" };
      }
      return {
        success: false,
        error: `Parse error: ${error.message}`,
      };
    }
  }

  /**
   * 按名称获取技术栈包
   * @param {string} name - 技术栈名称
   * @returns {StackPack | undefined}
   */
  get(name) {
    return this.#stacks.get(name);
  }

  /**
   * 根据文件扩展名匹配技术栈
   * @param {string} filename - 文件名
   * @returns {StackPack | undefined}
   * @see FR-003, AC-002
   */
  matchByExtension(filename) {
    const ext = extname(filename);
    if (!ext) return undefined;

    const stackName = this.#extensionMap.get(ext);
    if (!stackName) return undefined;

    return this.#stacks.get(stackName);
  }

  /**
   * 解析技术栈声明字符串
   * @param {string} declaration - 技术栈声明，如 "Vue 3 + TypeScript"
   * @returns {StackPack[]}
   * @see FR-004, AC-003
   * @example "Vue 3 + TypeScript" → [vuePack, typescriptPack]
   */
  parseStackDeclaration(declaration) {
    /** @type {StackPack[]} */
    const packs = [];

    // 清理并分割声明
    const parts = declaration
      .split(/[+\/,]/)
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean);

    for (const part of parts) {
      // 尝试直接匹配名称
      for (const [name, pack] of this.#stacks) {
        if (
          name.toLowerCase() === part ||
          pack.displayName.toLowerCase().includes(part)
        ) {
          if (!packs.includes(pack)) {
            packs.push(pack);
          }
          break;
        }
      }
    }

    return packs;
  }

  /**
   * 获取技术栈的派生提示
   * @param {string} stackName - 技术栈名称
   * @param {PromptType} promptType - 提示类型
   * @returns {Promise<string | null>}
   * @see FR-002
   */
  async getPrompt(stackName, promptType) {
    const stack = this.#stacks.get(stackName);
    if (!stack) return null;

    const promptFile = stack.prompts?.[promptType];
    if (!promptFile) return null;

    try {
      const promptPath = join(stack.path, promptFile);
      return await readFile(promptPath, "utf-8");
    } catch {
      return null;
    }
  }

  /**
   * 获取技术栈的规格模板
   * @param {string} stackName - 技术栈名称
   * @returns {Promise<string | null>}
   * @see FR-002
   */
  async getTemplate(stackName) {
    const stack = this.#stacks.get(stackName);
    if (!stack || !stack.template) return null;

    try {
      const templatePath = join(stack.path, stack.template);
      return await readFile(templatePath, "utf-8");
    } catch {
      return null;
    }
  }

  /**
   * 列出所有可用技术栈
   * @returns {StackPackSummary[]}
   * @see FR-001
   */
  list() {
    return Array.from(this.#stacks.values()).map((stack) => ({
      name: stack.name,
      displayName: stack.displayName,
      version: stack.version,
      extensions: stack.extensions,
      features: stack.features,
    }));
  }

  /**
   * 检查是否已加载技术栈包
   * @param {string} name - 技术栈名称
   * @returns {boolean}
   */
  has(name) {
    return this.#stacks.has(name);
  }

  /**
   * 获取已加载技术栈包数量
   * @returns {number}
   */
  get size() {
    return this.#stacks.size;
  }

  /**
   * 获取所有技术栈名称
   * @returns {string[]}
   */
  names() {
    return Array.from(this.#stacks.keys());
  }
}

module.exports = { StackLoader };
