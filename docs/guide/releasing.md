# mob-seed 发布指南

> 版本: 1.0.0
> 适用: mob-seed v2.1+

## 发布流程概览

```
检查 → 版本同步 → 测试 → 发布 → 验证
```

## 前置条件

1. 所有测试通过
2. 版本号已同步（package.json, marketplace.json）
3. CHANGELOG.md 已更新
4. Git 工作区干净

## 发布步骤

### 1. 版本同步

使用 `bump-version.js` 确保版本一致：

```bash
# 检查当前版本
node scripts/bump-version.js

# 升级版本（patch/minor/major）
node scripts/bump-version.js patch
node scripts/bump-version.js minor
node scripts/bump-version.js major

# 设置特定版本
node scripts/bump-version.js 2.1.0
```

同步的文件：
- `package.json`
- `skills/mob-seed/marketplace.json`

### 2. 运行测试

```bash
npm test
```

确保所有测试通过。

### 3. 一键发布

使用 `release.sh` 脚本：

```bash
# 发布 patch 版本
./scripts/release.sh patch

# 发布 minor 版本
./scripts/release.sh minor

# 发布 major 版本
./scripts/release.sh major
```

脚本会自动：
1. 检查版本一致性
2. 运行测试
3. 创建 Git tag
4. 推送到远程

### 4. GitHub Actions 自动发布

推送 tag 后，GitHub Actions 会自动：
1. 验证版本号
2. 运行完整测试
3. 创建 GitHub Release

## 版本命名规范

遵循 [SemVer](https://semver.org/)：

| 类型 | 说明 | 示例 |
|------|------|------|
| MAJOR | 不兼容的 API 变更 | 2.0.0 → 3.0.0 |
| MINOR | 向后兼容的功能新增 | 2.0.0 → 2.1.0 |
| PATCH | 向后兼容的 bug 修复 | 2.0.0 → 2.0.1 |

## 发布检查清单

发布前确认：

- [ ] 版本号已更新（package.json + marketplace.json）
- [ ] CHANGELOG.md 记录了所有变更
- [ ] 所有测试通过
- [ ] 文档已更新
- [ ] Git 工作区干净
- [ ] 已创建对应的 Git tag

## 回滚流程

如需回滚：

```bash
# 删除本地 tag
git tag -d v2.1.0

# 删除远程 tag（慎用）
git push origin :refs/tags/v2.1.0

# 恢复到上一版本
git checkout v2.0.0
```

## 常见问题

### Q: 版本号不一致怎么办？

运行版本同步工具：

```bash
node scripts/bump-version.js <正确版本号>
```

### Q: 测试失败怎么办？

1. 修复失败的测试
2. 重新运行 `npm test`
3. 确认全部通过后再发布

### Q: 推送失败怎么办？

检查：
1. Git 远程配置是否正确
2. 是否有推送权限
3. 是否已登录

## 相关文件

| 文件 | 说明 |
|------|------|
| `scripts/bump-version.js` | 版本同步工具 |
| `scripts/release.sh` | 一键发布脚本 |
| `.github/workflows/release.yml` | 自动发布工作流 |
| `CHANGELOG.md` | 变更日志 |
