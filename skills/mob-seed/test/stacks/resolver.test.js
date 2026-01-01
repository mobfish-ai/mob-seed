/**
 * StackResolver 测试
 * @see specs/multi-language-stack.fspec.md
 * @generated-from specs/multi-language-stack.fspec.md
 * @generated-at 2026-01-01
 * @seed-version 1.1.0
 * @covers AC-004
 *
 * ⚠️ 此文件由 SEED 自动派生，请勿手动修改
 */

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const { join } = require("node:path");
const { mkdir, writeFile, rm, mkdtemp } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { StackLoader } = require("../../lib/stacks/loader.js");
const {
  StackResolver,
  parseSpecStackDeclaration,
  parseSpecOutputPath,
} = require("../../lib/stacks/resolver.js");

// 使用唯一临时目录确保测试隔离
let testStacksDir;

describe("StackResolver", () => {
  /** @type {StackLoader} */
  let loader;

  beforeEach(async () => {
    // 使用独立临时目录
    testStacksDir = await mkdtemp(join(tmpdir(), "resolver-test-"));

    // 创建测试技术栈包
    await createStackPack("vue", {
      name: "vue",
      displayName: "Vue 3",
      version: "1.0.0",
      extensions: [".vue"],
      runtime: "vite",
      commands: { test: "vitest" },
      patterns: { components: "src/components/**/*.vue" },
      features: ["composition-api"],
    });

    await createStackPack("typescript", {
      name: "typescript",
      displayName: "TypeScript",
      version: "1.0.0",
      extensions: [".ts", ".tsx"],
      runtime: "deno",
      commands: { test: "deno test" },
      patterns: {},
      features: ["strict-types"],
    });

    await createStackPack("javascript", {
      name: "javascript",
      displayName: "JavaScript",
      version: "1.0.0",
      extensions: [".js"],
      runtime: "node",
      commands: { test: "node --test" },
      patterns: {},
      features: [],
    });

    loader = new StackLoader(testStacksDir);
    await loader.discover();
  });

  afterEach(async () => {
    try {
      await rm(testStacksDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  describe("AC-004: 多目录多技术栈配置", () => {
    it("should resolve stack for path based on stack mapping", async () => {
      // Given: 项目配置声明路径映射
      /** @type {import('../../lib/stacks/types.js').ProjectStackConfig} */
      const config = {
        directory: "stacks",
        autoDiscover: true,
        default: "typescript",
        stacks: {
          "src/frontend": "vue",
          "src/api": "typescript",
          "scripts": "javascript",
        },
      };

      const resolver = new StackResolver(loader, config);

      // When: 解析不同路径
      // Then: 返回正确的技术栈包
      const vuePack = resolver.resolveForOutput("src/frontend/components/App.vue");
      assert.ok(vuePack);
      assert.strictEqual(vuePack.name, "vue");

      const tsPack = resolver.resolveForOutput("src/api/routes/user.ts");
      assert.ok(tsPack);
      assert.strictEqual(tsPack.name, "typescript");

      const jsPack = resolver.resolveForOutput("scripts/build.js");
      assert.ok(jsPack);
      assert.strictEqual(jsPack.name, "javascript");
    });

    it("should use longest path match", async () => {
      // Given: 有嵌套路径映射
      /** @type {import('../../lib/stacks/types.js').ProjectStackConfig} */
      const config = {
        directory: "stacks",
        autoDiscover: true,
        default: "typescript",
        stacks: {
          "src": "typescript",
          "src/frontend": "vue",
          "src/frontend/legacy": "javascript",
        },
      };

      const resolver = new StackResolver(loader, config);

      // Then: 最长路径优先匹配
      const legacyStack = resolver.resolveForOutput("src/frontend/legacy/old.js");
      assert.ok(legacyStack);
      assert.strictEqual(legacyStack.name, "javascript");

      const frontendStack = resolver.resolveForOutput("src/frontend/App.vue");
      assert.ok(frontendStack);
      assert.strictEqual(frontendStack.name, "vue");

      const srcStack = resolver.resolveForOutput("src/lib/utils.ts");
      assert.ok(srcStack);
      assert.strictEqual(srcStack.name, "typescript");
    });

    it("should fallback to default stack", async () => {
      /** @type {import('../../lib/stacks/types.js').ProjectStackConfig} */
      const config = {
        directory: "stacks",
        autoDiscover: true,
        default: "typescript",
        stacks: {
          "src/frontend": "vue",
        },
      };

      const resolver = new StackResolver(loader, config);

      // 未匹配路径使用默认技术栈
      const stack = resolver.resolveForOutput("lib/something.unknown");
      assert.ok(stack);
      assert.strictEqual(stack.name, "typescript");
    });
  });

  describe("getProjectStacks", () => {
    it("should return all stacks used in project", async () => {
      /** @type {import('../../lib/stacks/types.js').ProjectStackConfig} */
      const config = {
        directory: "stacks",
        autoDiscover: true,
        default: "typescript",
        stacks: {
          "src/frontend": "vue",
          "scripts": "javascript",
        },
      };

      const resolver = new StackResolver(loader, config);
      const stacks = resolver.getProjectStacks();

      assert.strictEqual(stacks.length, 3);
      const names = stacks.map((s) => s.name).sort();
      assert.deepStrictEqual(names, ["javascript", "typescript", "vue"]);
    });
  });

  describe("hasExplicitMapping", () => {
    it("should detect explicit path mappings", async () => {
      /** @type {import('../../lib/stacks/types.js').ProjectStackConfig} */
      const config = {
        directory: "stacks",
        autoDiscover: true,
        default: "typescript",
        stacks: {
          "src/frontend": "vue",
        },
      };

      const resolver = new StackResolver(loader, config);

      assert.ok(resolver.hasExplicitMapping("src/frontend/App.vue"));
      assert.ok(!resolver.hasExplicitMapping("src/backend/api.ts"));
    });
  });
});

describe("parseSpecStackDeclaration", () => {
  it("should parse Chinese format", () => {
    const content = `# 功能规格

> 版本: 1.0.0
> 技术栈: Vue 3 + TypeScript

## 概述
`;
    const result = parseSpecStackDeclaration(content);
    assert.strictEqual(result, "Vue 3 + TypeScript");
  });

  it("should parse English format", () => {
    const content = `# Feature Spec

> Version: 1.0.0
> Tech Stack: React + Node.js

## Overview
`;
    const result = parseSpecStackDeclaration(content);
    assert.strictEqual(result, "React + Node.js");
  });

  it("should return null for missing declaration", () => {
    const content = `# Feature Spec

> Version: 1.0.0

## Overview
`;
    const result = parseSpecStackDeclaration(content);
    assert.strictEqual(result, null);
  });
});

describe("parseSpecOutputPath", () => {
  it("should parse output path declaration", () => {
    const content = `# 功能规格

> 技术栈: Vue 3
> 派生路径: src/frontend/components/

## 概述
`;
    const result = parseSpecOutputPath(content);
    assert.strictEqual(result, "src/frontend/components/");
  });

  it("should return null for missing path", () => {
    const content = `# Feature Spec

> Tech Stack: Vue

## Overview
`;
    const result = parseSpecOutputPath(content);
    assert.strictEqual(result, null);
  });
});

// Helper function
/**
 * @param {string} name
 * @param {object} config
 */
async function createStackPack(name, config) {
  const packDir = join(testStacksDir, name);
  await mkdir(packDir, { recursive: true });
  await writeFile(
    join(packDir, "stack.json"),
    JSON.stringify(config, null, 2)
  );
}
