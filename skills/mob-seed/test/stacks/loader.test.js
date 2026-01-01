/**
 * StackLoader 测试
 * @see specs/multi-language-stack.fspec.md
 * @generated-from specs/multi-language-stack.fspec.md
 * @generated-at 2026-01-01
 * @seed-version 1.1.0
 * @covers AC-001, AC-002, AC-003
 *
 * ⚠️ 此文件由 SEED 自动派生，请勿手动修改
 */

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const { join } = require("node:path");
const { mkdir, writeFile, rm, mkdtemp } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { StackLoader } = require("../../lib/stacks/loader.js");

// 使用唯一临时目录确保测试隔离
let testStacksDir;

describe("StackLoader", () => {
  // 每个测试使用独立的临时目录
  beforeEach(async () => {
    testStacksDir = await mkdtemp(join(tmpdir(), "loader-test-"));
  });

  afterEach(async () => {
    try {
      await rm(testStacksDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  describe("AC-001: 技术栈包自动发现", () => {
    it("should discover all valid stack packs", async () => {
      // Given: stacks/ 目录下存在多个技术栈包
      await createStackPack("typescript", {
        name: "typescript",
        displayName: "TypeScript / Deno",
        version: "1.0.0",
        extensions: [".ts", ".tsx"],
        runtime: "deno",
        commands: { test: "deno test" },
        patterns: {},
        features: ["strict-types"],
      });

      await createStackPack("javascript", {
        name: "javascript",
        displayName: "JavaScript / Node.js",
        version: "1.0.0",
        extensions: [".js", ".mjs"],
        runtime: "node",
        commands: { test: "node --test" },
        patterns: {},
        features: ["esm"],
      });

      // When: 运行 discover()
      const loader = new StackLoader(testStacksDir);
      const result = await loader.discover();

      // Then: 所有包含有效 stack.json 的子目录被识别
      assert.strictEqual(result.stacks.size, 2);
      assert.ok(result.stacks.has("typescript"));
      assert.ok(result.stacks.has("javascript"));
    });

    it("should skip invalid directories and report warnings", async () => {
      // Given: 存在无效的技术栈包目录
      await mkdir(join(testStacksDir, "invalid-pack"), { recursive: true });
      // 不创建 stack.json

      await createStackPack("valid", {
        name: "valid",
        displayName: "Valid Stack",
        version: "1.0.0",
        extensions: [".valid"],
        runtime: "valid",
        commands: {},
        patterns: {},
        features: [],
      });

      // When: 运行 discover()
      const loader = new StackLoader(testStacksDir);
      const result = await loader.discover();

      // Then: 无效目录被跳过并警告
      assert.strictEqual(result.stacks.size, 1);
      assert.strictEqual(result.skipped.length, 1);
      assert.ok(result.skipped[0].reason.includes("not found"));
    });

    it("should return empty result for non-existent directory", async () => {
      // Given: 目录不存在
      const loader = new StackLoader("/non/existent/path");

      // When: 运行 discover()
      const result = await loader.discover();

      // Then: 返回空结果并报告
      assert.strictEqual(result.stacks.size, 0);
      assert.strictEqual(result.skipped.length, 1);
    });
  });

  describe("AC-002: 按扩展名匹配技术栈", () => {
    it("should match stack by file extension", async () => {
      // Given: 已加载 TypeScript 和 Vue 技术栈包
      await createStackPack("typescript", {
        name: "typescript",
        displayName: "TypeScript",
        version: "1.0.0",
        extensions: [".ts", ".tsx"],
        runtime: "deno",
        commands: {},
        patterns: {},
        features: [],
      });

      await createStackPack("vue", {
        name: "vue",
        displayName: "Vue 3",
        version: "1.0.0",
        extensions: [".vue"],
        runtime: "vite",
        commands: {},
        patterns: {},
        features: [],
      });

      const loader = new StackLoader(testStacksDir);
      await loader.discover();

      // When: 调用 matchByExtension("App.vue")
      const vuePack = loader.matchByExtension("App.vue");

      // Then: 返回 Vue 技术栈包配置
      assert.ok(vuePack);
      assert.strictEqual(vuePack.name, "vue");

      // 验证 TypeScript 匹配
      const tsPack = loader.matchByExtension("main.ts");
      assert.ok(tsPack);
      assert.strictEqual(tsPack.name, "typescript");
    });

    it("should return undefined for unknown extension", async () => {
      // Given: 只加载了有限的技术栈包
      await createStackPack("typescript", {
        name: "typescript",
        displayName: "TypeScript",
        version: "1.0.0",
        extensions: [".ts"],
        runtime: "deno",
        commands: {},
        patterns: {},
        features: [],
      });

      const loader = new StackLoader(testStacksDir);
      await loader.discover();

      // When: 查询未知扩展名
      const result = loader.matchByExtension("main.rs");

      // Then: 返回 undefined
      assert.strictEqual(result, undefined);
    });
  });

  describe("AC-003: 规格技术栈声明解析", () => {
    it("should parse stack declaration string", async () => {
      // Given: 已加载多个技术栈包
      await createStackPack("vue", {
        name: "vue",
        displayName: "Vue 3 + TypeScript",
        version: "1.0.0",
        extensions: [".vue"],
        runtime: "vite",
        commands: {},
        patterns: {},
        features: [],
      });

      await createStackPack("typescript", {
        name: "typescript",
        displayName: "TypeScript / Deno",
        version: "1.0.0",
        extensions: [".ts"],
        runtime: "deno",
        commands: {},
        patterns: {},
        features: [],
      });

      const loader = new StackLoader(testStacksDir);
      await loader.discover();

      // When: 解析 "Vue 3 + TypeScript"
      const packs = loader.parseStackDeclaration("Vue 3 + TypeScript");

      // Then: 返回两个技术栈包
      assert.strictEqual(packs.length, 2);
      assert.ok(packs.some((p) => p.name === "vue"));
      assert.ok(packs.some((p) => p.name === "typescript"));
    });

    it("should handle single stack declaration", async () => {
      await createStackPack("javascript", {
        name: "javascript",
        displayName: "JavaScript",
        version: "1.0.0",
        extensions: [".js"],
        runtime: "node",
        commands: {},
        patterns: {},
        features: [],
      });

      const loader = new StackLoader(testStacksDir);
      await loader.discover();

      const packs = loader.parseStackDeclaration("JavaScript");
      assert.strictEqual(packs.length, 1);
      assert.strictEqual(packs[0].name, "javascript");
    });
  });

  describe("Utility methods", () => {
    it("should list all available stacks", async () => {
      await createStackPack("stack1", {
        name: "stack1",
        displayName: "Stack 1",
        version: "1.0.0",
        extensions: [".s1"],
        runtime: "s1",
        commands: {},
        patterns: {},
        features: [],
      });

      const loader = new StackLoader(testStacksDir);
      await loader.discover();

      const list = loader.list();
      assert.strictEqual(list.length, 1);
      assert.strictEqual(list[0].name, "stack1");
      assert.strictEqual(list[0].displayName, "Stack 1");
    });

    it("should return correct size and names", async () => {
      await createStackPack("a", {
        name: "a",
        displayName: "A",
        version: "1.0.0",
        extensions: [".a"],
        runtime: "a",
        commands: {},
        patterns: {},
        features: [],
      });

      await createStackPack("b", {
        name: "b",
        displayName: "B",
        version: "1.0.0",
        extensions: [".b"],
        runtime: "b",
        commands: {},
        patterns: {},
        features: [],
      });

      const loader = new StackLoader(testStacksDir);
      await loader.discover();

      assert.strictEqual(loader.size, 2);
      assert.deepStrictEqual(loader.names().sort(), ["a", "b"]);
      assert.ok(loader.has("a"));
      assert.ok(!loader.has("c"));
    });
  });
});

// Helper function to create stack pack fixture
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
