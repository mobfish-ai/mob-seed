# v3.5 Runtime Version - 任务清单

> 提案: v3.5-runtime-version
> 状态: archived
> 更新时间: 2026-01-04
> 归档日期: 2026-01-04

## 进度概览

| 阶段 | 状态 | 进度 |
|------|------|------|
| S - 规格定义 | ✅ 完成 | 100% |
| E - 代码派生 | ✅ 完成 | 100% |
| E - 测试执行 | ✅ 完成 | 100% |
| D - 验证归档 | ✅ 完成 | 100% |

---

## Phase 1: S - 规格定义

### 1.1 架构决策
- [x] 完成架构决策检查清单
- [x] 确定版本检查策略
- [x] 确定缓存机制设计
- [x] 确定更新方式

### 1.2 规格编写
- [x] 创建 `runtime-version.fspec.md`
- [x] 定义功能需求 (7 FR + 3 NFR)
- [x] 定义验收标准 (7 AC)
- [x] 定义派生产物路径

### 1.3 规格审查
- [x] 检查规格完整性
- [x] 验证与现有模块兼容性

---

## Phase 2: E - 代码派生

### 2.1 核心模块
- [x] `lib/runtime/version-checker.js` - 版本管理核心
- [x] `lib/runtime/version-display.js` - 版本显示格式化
- [x] `lib/runtime/index.js` - 模块导出

### 2.2 集成
- [x] 更新 pre-commit hook 添加版本显示
- [x] 更新 pre-push hook 添加版本显示

---

## Phase 3: E - 测试执行

### 3.1 单元测试
- [x] `test/runtime/version-checker.test.js` - 13 tests pass
- [x] `test/runtime/version-display.test.js` - 14 tests pass

### 3.2 集成测试
- [x] 验证版本显示
- [x] 验证更新检查
- [x] 验证缓存机制

---

## Phase 4: D - 验证归档

### 4.1 验证同步
- [x] 运行 `/mob-seed:defend`
- [x] 确认 AC 全部通过

### 4.2 归档
- [x] 执行 `/mob-seed:archive`
- [ ] 更新 CHANGELOG

---

## 测试统计

| 模块 | 通过 | 失败 | 跳过 |
|------|------|------|------|
| runtime/version-checker | 12 | 0 | 0 |
| runtime/version-display | 15 | 0 | 0 |
| runtime/version-updater | 10 | 0 | 0 |
| **runtime 模块合计** | 37 | 0 | 0 |

---

## 产物清单

### 代码文件
- `skills/mob-seed/lib/runtime/version-checker.js` (233 行)
- `skills/mob-seed/lib/runtime/version-display.js` (142 行)
- `skills/mob-seed/lib/runtime/version-updater.js` (131 行)
- `skills/mob-seed/lib/runtime/index.js` (93 行)

### 测试文件
- `skills/mob-seed/test/runtime/version-checker.test.js` (237 行)
- `skills/mob-seed/test/runtime/version-display.test.js` (231 行)
- `skills/mob-seed/test/runtime/version-updater.test.js` (120 行)

### 规格文件
- `openspec/changes/v3.5-runtime-version/specs/runtime-version.fspec.md` (330 行)

### 钩子更新
- `skills/mob-seed/hooks/pre-commit` (+24 行)
- `skills/mob-seed/hooks/pre-push` (+24 行)

---

## 显示效果示例

### Git Hooks 输出
```bash
🔍 SEED 快速检查... v3.5.0 [开发模式] mob-seed dogfooding
✅ SEED 快速检查通过
```

### 更新提示
```bash
💡 新版本 v3.6.0 可用，运行 git pull 更新
```
