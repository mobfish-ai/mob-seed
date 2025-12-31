/**
 * 技术栈包类型定义
 * @module stacks/types
 * @see specs/multi-language-stack.fspec.md
 * @generated-from specs/multi-language-stack.fspec.md
 * @generated-at 2025-12-31
 * @seed-version 1.1.0
 *
 * ⚠️ 此文件由 SEED 自动派生，请勿手动修改
 */

/**
 * 技术栈包元数据
 * @typedef {Object} StackPackMeta
 * @property {string} name - 唯一标识: "typescript", "vue"
 * @property {string} displayName - 显示名: "TypeScript / Deno", "Vue 3 + TypeScript"
 * @property {string} version - 版本: "1.0.0"
 * @property {string[]} extensions - 扩展名: [".ts", ".tsx"], [".vue"]
 * @property {string} runtime - 运行时: "deno" | "node" | "vite" | "browser"
 * @property {StackCommands} commands - 命令配置
 * @property {Object<string, string>} patterns - 文件模式
 * @property {string[]} features - 特性标签: ["composition-api", "script-setup"]
 * @property {string[]} [dependencies] - 依赖的其他技术栈包: ["typescript"]
 */

/**
 * 技术栈命令配置
 * @typedef {Object} StackCommands
 * @property {string} [test] - 测试命令
 * @property {string} [build] - 构建命令
 * @property {string} [lint] - 检查命令
 * @property {string} [dev] - 开发服务器命令
 */

/**
 * 技术栈包完整配置（包含路径）
 * @typedef {StackPackMeta & { path: string }} StackPack
 */

/**
 * 技术栈包摘要（用于列表显示）
 * @typedef {Object} StackPackSummary
 * @property {string} name - 名称
 * @property {string} displayName - 显示名
 * @property {string} version - 版本
 * @property {string[]} extensions - 扩展名
 * @property {string[]} features - 特性标签
 */

/**
 * 技术栈发现结果
 * @typedef {Object} StackDiscoveryResult
 * @property {Map<string, StackPack>} stacks - 发现的技术栈包
 * @property {Array<{path: string, reason: string}>} skipped - 跳过的目录
 */

/**
 * 项目技术栈配置
 * @typedef {Object} ProjectStackConfig
 * @property {string} directory - 技术栈包目录
 * @property {boolean} autoDiscover - 是否自动发现
 * @property {string} default - 默认技术栈
 * @property {Object<string, string>} [stacks] - 路径 → 技术栈映射
 */

/**
 * 提示类型
 * @typedef {'code' | 'test'} PromptType
 */

module.exports = {};
