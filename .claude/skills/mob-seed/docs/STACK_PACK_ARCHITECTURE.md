# 技术栈包架构设计 (Stack Pack Architecture)

> 版本: 1.1.0
> 设计原则: 技术栈无关、配置驱动、零代码扩展

---

## 核心思想

**增加技术栈支持 = 创建技术栈包目录，不需要修改任何代码**

```
新增技术栈 = mkdir stacks/{stack} + 4个配置文件
```

---

## 目录结构

```
.claude/skills/mob-seed/
├── config/
│   └── seed.config.json      # 核心配置（技术栈无关）
├── stacks/                    # 技术栈包目录（自动扫描）
│   ├── javascript/
│   │   ├── stack.json        # 技术栈元数据
│   │   ├── spec.template.md  # 规格模板
│   │   ├── code.prompt.md    # 代码派生提示
│   │   └── test.prompt.md    # 测试派生提示
│   ├── typescript/
│   │   └── ...
│   └── vue/
│       └── ...
└── lib/
    └── stacks/
        ├── types.js          # 类型定义
        ├── loader.js         # 技术栈包加载器（运行时扫描）
        └── resolver.js       # 项目技术栈解析器
```

---

## 技术栈包规范

### stack.json（必需）

```json
{
  "$schema": "../schemas/stack.schema.json",

  "name": "typescript",
  "displayName": "TypeScript / Deno",
  "version": "1.0.0",

  "extensions": [".ts", ".tsx"],
  "runtime": "deno",

  "commands": {
    "test": "deno test",
    "build": "deno check",
    "lint": "deno lint",
    "format": "deno fmt"
  },

  "patterns": {
    "source": "src/**/*.ts",
    "test": "test/**/*.test.ts",
    "types": "src/**/*.types.ts"
  },

  "features": [
    "strict-types",
    "esm-only",
    "jsr-imports"
  ],

  "prompts": {
    "code": "code.prompt.md",
    "test": "test.prompt.md"
  },

  "template": "spec.template.md"
}
```

### spec.template.md（必需）

规格模板，包含该技术栈特定的：
- 技术约束
- 编码规范
- 依赖管理方式
- 派生产物路径

### code.prompt.md（必需）

代码派生指导，包含：
- 类型系统规范
- 导入规范
- 命名约定
- 代码模板

### test.prompt.md（可选）

测试派生指导，包含：
- 测试框架
- 断言库
- Mock/Stub 模式
- 覆盖率要求

---

## 核心配置简化

### seed.config.json（技术栈无关）

```json
{
  "$schema": "./seed.config.schema.json",
  "version": "1.0.0",

  "spec": {
    "format": "fspec",
    "extension": ".fspec.md",
    "directory": "specs",
    "required_sections": ["overview", "requirements", "constraints", "acceptance"]
  },

  "emit": {
    "engine": "internal",
    "targets": {
      "code": { "enabled": true, "path": "src/", "overwrite": false },
      "test": { "enabled": true, "path": "test/", "overwrite": false },
      "docs": { "enabled": true, "path": "docs/", "overwrite": true }
    }
  },

  "execute": {
    "ci_trigger": "manual",
    "auto_commit": false,
    "auto_pr": false
  },

  "defend": {
    "enabled": true,
    "check_on_commit": true,
    "forbidden_patterns": ["TODO: sync", "FIXME: update"]
  },

  "stacks": {
    "directory": "stacks",
    "autoDiscover": true,
    "default": "javascript"
  }
}
```

**注意**：`stacks` 节只指定目录和默认技术栈，具体配置完全由技术栈包自描述。

---

## 运行时技术栈发现

### StackLoader (lib/stacks/loader.js)

```javascript
const { StackLoader } = require('./lib/stacks/loader.js');

const loader = new StackLoader('./stacks');
await loader.discover();

// 列出所有技术栈
console.log(loader.list());

// 按扩展名匹配
const stack = loader.matchByExtension('App.vue');

// 获取派生提示
const prompt = await loader.getPrompt('typescript', 'code');
```

---

## 使用示例

### 1. 添加新技术栈（Rust）

```bash
# 只需创建目录和配置文件
mkdir -p .claude/skills/mob-seed/stacks/rust

# 创建 stack.json
cat > .claude/skills/mob-seed/stacks/rust/stack.json << 'EOF'
{
  "name": "rust",
  "displayName": "Rust",
  "version": "1.0.0",
  "extensions": [".rs"],
  "runtime": "cargo",
  "commands": {
    "test": "cargo test",
    "build": "cargo build --release",
    "lint": "cargo clippy",
    "format": "cargo fmt"
  },
  "patterns": {
    "source": "src/**/*.rs",
    "test": "tests/**/*.rs"
  },
  "features": ["ownership", "lifetimes", "traits"],
  "prompts": {
    "code": "code.prompt.md",
    "test": "test.prompt.md"
  },
  "template": "spec.template.md"
}
EOF

# 创建对应的模板和提示文件
# ...

# 完成！无需修改任何代码
```

### 2. 运行时自动发现

```javascript
const { StackLoader } = require('./lib/stacks/loader.js');

const loader = new StackLoader('./stacks');
await loader.discover();

console.log(loader.list());
// [
//   { name: 'javascript', displayName: 'JavaScript', ... },
//   { name: 'typescript', displayName: 'TypeScript / Deno', ... },
//   { name: 'vue', displayName: 'Vue 3', ... },
//   { name: 'rust', displayName: 'Rust', ... }  // 自动发现新增的
// ]
```

### 3. 按文件扩展名匹配

```javascript
const stack = loader.matchByExtension('main.rs');
// { name: 'rust', displayName: 'Rust', runtime: 'cargo', ... }

const testPrompt = await loader.getPrompt('rust', 'test');
// 返回 Rust 测试派生提示内容
```

---

## 架构优势

| 特性 | 旧架构 | 新架构 |
|------|--------|--------|
| 添加技术栈 | 修改 config + 创建多个文件 | 只创建技术栈包目录 |
| 配置位置 | 分散在中央配置 | 技术栈包自包含 |
| 发现机制 | 硬编码列表 | 运行时扫描 |
| 第三方扩展 | 需要 PR 修改核心 | 直接添加技术栈包 |
| 版本管理 | 混在一起 | 每个技术栈包独立版本 |

---

## 迁移路径

### 从旧架构迁移

1. 创建 `stacks/` 目录
2. 将现有模板迁移到技术栈包
3. 更新 `seed.config.json` 移除技术栈详情
4. 使用 `StackLoader`

### 兼容性

- 保持 `templates/` 目录作为回退（可选）
- 优先使用技术栈包，无技术栈包时使用旧模板

---

## 检查清单

创建新技术栈包时：
- [ ] `stack.json` 包含所有必需字段
- [ ] `spec.template.md` 包含技术栈特定约束
- [ ] `code.prompt.md` 包含代码派生指导
- [ ] `test.prompt.md` 包含测试派生指导（如适用）
- [ ] 扩展名不与其他技术栈冲突
