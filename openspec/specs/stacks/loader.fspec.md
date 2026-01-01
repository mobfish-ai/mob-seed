# Feature: 技术栈包加载器

> 状态: archived
> 版本: 1.1.0
> 技术栈: JavaScript
> 派生路径: skills/mob-seed/lib/stacks/

## 概述

运行时自动扫描 stacks/ 目录，发现并加载所有技术栈包，支持扩展名匹配和派生提示获取。

## ADDED Requirements

### REQ-001: 运行时自动扫描
The system SHALL scan stacks directory at runtime to discover all stack packs.

**Scenario: 发现技术栈包**
- WHEN 调用 discover() 方法
- THEN 扫描 stacks/ 目录下所有子目录
- THEN 加载每个目录中的 stack.json 配置

**Acceptance Criteria:**
- [x] AC-001: 返回 StackDiscoveryResult，包含 stacks Map 和 skipped 数组
- [x] AC-002: 跳过无 stack.json 或配置无效的目录

### REQ-002: 技术栈包自描述
The system SHALL parse stack pack configuration from stack.json.

**Scenario: 解析 stack.json**
- WHEN 读取技术栈目录的 stack.json
- THEN 验证必需字段 name, extensions, runtime

**Acceptance Criteria:**
- [x] AC-003: 缺少必需字段时返回错误信息
- [x] AC-004: 解析错误时记录原因

### REQ-003: 扩展名匹配
The system SHALL match files to stack packs by extension.

**Scenario: 按扩展名匹配**
- WHEN 调用 matchByExtension('.ts')
- THEN 返回对应的 TypeScript 技术栈包

**Acceptance Criteria:**
- [x] AC-005: 建立扩展名到技术栈的映射
- [x] AC-006: 无匹配时返回 undefined

### REQ-004: 技术栈声明解析
The system SHALL parse stack declaration strings like "Vue 3 + TypeScript".

**Scenario: 解析声明字符串**
- WHEN 调用 parseStackDeclaration("Vue 3 + TypeScript")
- THEN 返回 [vuePack, typescriptPack] 数组

**Acceptance Criteria:**
- [x] AC-007: 支持 +, /, 逗号 分隔符
- [x] AC-008: 模糊匹配 displayName

### REQ-005: 派生提示获取
The system SHALL load prompt templates for code/test generation.

**Scenario: 获取派生提示**
- WHEN 调用 getPrompt('typescript', 'code')
- THEN 返回 code.prompt.md 文件内容

**Acceptance Criteria:**
- [x] AC-009: 根据 prompts 配置查找文件
- [x] AC-010: 文件不存在时返回 null

### REQ-006: 规格模板获取
The system SHALL load spec templates for each stack.

**Scenario: 获取规格模板**
- WHEN 调用 getTemplate('typescript')
- THEN 返回 spec.template.md 文件内容

**Acceptance Criteria:**
- [x] AC-011: 根据 template 配置查找文件
- [x] AC-012: 文件不存在时返回 null

## 导出接口

```javascript
class StackLoader {
  constructor(stacksDir)
  async discover()
  get(name)
  matchByExtension(filename)
  parseStackDeclaration(declaration)
  async getPrompt(stackName, promptType)
  async getTemplate(stackName)
  list()
  has(name)
  get size()
  names()
}

module.exports = { StackLoader };
```
