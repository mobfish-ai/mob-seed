#!/bin/bash
#
# release.sh - 一键发布脚本
# @see openspec/changes/v2.1-release-automation/specs/automation/release-flow.fspec.md
#
# 用法:
#   ./scripts/release.sh v2.1.0           # 发布指定版本
#   ./scripts/release.sh v2.1.0 --dry-run # 预览模式
#   ./scripts/release.sh v2.1.0 --skip-tests # 跳过测试（紧急修复时）
#

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 图标
CHECK="${GREEN}✓${NC}"
CROSS="${RED}✗${NC}"
INFO="${BLUE}ℹ${NC}"
WARN="${YELLOW}⚠${NC}"

# 打印带颜色的消息
log_info() { echo -e "${INFO} $1"; }
log_success() { echo -e "${CHECK} $1"; }
log_warn() { echo -e "${WARN} $1"; }
log_error() { echo -e "${CROSS} $1"; }

# 显示帮助
show_help() {
    cat << EOF
release.sh - One-click release script

Usage:
    ./scripts/release.sh <version> [options]

Arguments:
    <version>       Version to release (e.g., v2.1.0 or 2.1.0)

Options:
    --dry-run       Preview changes without modifying anything
    --skip-tests    Skip running tests (use for emergency fixes only)
    --help          Show this help message

Examples:
    ./scripts/release.sh v2.1.0
    ./scripts/release.sh 2.1.0 --dry-run
    ./scripts/release.sh v2.1.0 --skip-tests

Release Process:
    1. Validate version format (semver)
    2. Check working directory is clean
    3. Run tests (unless --skip-tests)
    4. Update all version files
    5. Update CHANGELOG.md
    6. Create commit: "chore(release): vX.Y.Z"
    7. Create tag: vX.Y.Z
    8. Push to remote (triggers CI)
EOF
}

# 验证 semver 格式
validate_version() {
    local version="$1"
    # 移除 'v' 前缀
    version="${version#v}"

    if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$ ]]; then
        log_error "Invalid version format: $1"
        echo "    Expected: x.y.z (e.g., 2.1.0)"
        return 1
    fi

    echo "$version"
}

# 检查工作目录是否干净
check_clean_working_dir() {
    if [[ -n $(git status --porcelain) ]]; then
        log_error "Working directory is not clean"
        echo "    Please commit or stash your changes first"
        git status --short
        return 1
    fi
    log_success "Working directory is clean"
}

# 检查是否在 main 分支
check_main_branch() {
    local branch=$(git branch --show-current)
    if [[ "$branch" != "main" && "$branch" != "master" ]]; then
        log_warn "Not on main branch (current: $branch)"
        read -p "    Continue anyway? [y/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            return 1
        fi
    else
        log_success "On branch: $branch"
    fi
}

# 运行测试
run_tests() {
    log_info "Running tests..."
    if npm test; then
        log_success "All tests passed"
    else
        log_error "Tests failed"
        return 1
    fi
}

# 更新版本文件
update_versions() {
    local version="$1"
    local dry_run="$2"

    log_info "Updating version files to $version..."

    if [[ "$dry_run" == "true" ]]; then
        node scripts/bump-version.js "$version" --dry-run
    else
        node scripts/bump-version.js "$version"
    fi
}

# 更新 CHANGELOG
update_changelog() {
    local version="$1"
    local dry_run="$2"
    local date=$(date +%Y-%m-%d)

    log_info "Updating CHANGELOG.md..."

    if [[ "$dry_run" == "true" ]]; then
        echo "    Would add entry: ## [$version] - $date"
        return 0
    fi

    # 检查 CHANGELOG.md 是否存在
    if [[ ! -f "CHANGELOG.md" ]]; then
        log_warn "CHANGELOG.md not found, skipping"
        return 0
    fi

    # 检查版本是否已存在
    if grep -q "## \[$version\]" CHANGELOG.md; then
        log_warn "Version $version already exists in CHANGELOG.md"
        return 0
    fi

    # 在 [Unreleased] 后插入新版本
    # 使用 sed 替换 [Unreleased] 部分
    local temp_file=$(mktemp)

    awk -v ver="$version" -v date="$date" '
    /^## \[Unreleased\]/ {
        print $0
        print ""
        print "---"
        print ""
        print "## [" ver "] - " date
        next
    }
    { print }
    ' CHANGELOG.md > "$temp_file"

    mv "$temp_file" CHANGELOG.md
    log_success "Added version $version to CHANGELOG.md"
}

# 创建 commit
create_commit() {
    local version="$1"
    local dry_run="$2"

    log_info "Creating release commit..."

    if [[ "$dry_run" == "true" ]]; then
        echo "    Would run: git add -A"
        echo "    Would run: git commit -m \"chore(release): v$version\""
        return 0
    fi

    git add -A
    git commit -m "chore(release): v$version"
    log_success "Created commit: chore(release): v$version"
}

# 创建 tag
create_tag() {
    local version="$1"
    local dry_run="$2"

    log_info "Creating tag v$version..."

    # 检查 tag 是否已存在
    if git rev-parse "v$version" >/dev/null 2>&1; then
        log_error "Tag v$version already exists"
        return 1
    fi

    if [[ "$dry_run" == "true" ]]; then
        echo "    Would run: git tag v$version"
        return 0
    fi

    git tag "v$version"
    log_success "Created tag: v$version"
}

# 推送到远程
push_to_remote() {
    local version="$1"
    local dry_run="$2"

    log_info "Pushing to remote..."

    if [[ "$dry_run" == "true" ]]; then
        echo "    Would run: git push"
        echo "    Would run: git push --tags"
        return 0
    fi

    git push
    git push --tags
    log_success "Pushed to remote (CI will create GitHub Release)"
}

# 主函数
main() {
    local version=""
    local dry_run="false"
    local skip_tests="false"

    # 解析参数
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --help|-h)
                show_help
                exit 0
                ;;
            --dry-run)
                dry_run="true"
                shift
                ;;
            --skip-tests)
                skip_tests="true"
                shift
                ;;
            -*)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
            *)
                if [[ -z "$version" ]]; then
                    version="$1"
                else
                    log_error "Too many arguments"
                    show_help
                    exit 1
                fi
                shift
                ;;
        esac
    done

    # 检查版本参数
    if [[ -z "$version" ]]; then
        log_error "Version is required"
        show_help
        exit 1
    fi

    # 验证版本格式
    version=$(validate_version "$version") || exit 1

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    if [[ "$dry_run" == "true" ]]; then
        echo -e "  🔍 ${YELLOW}DRY RUN${NC}: Release v$version"
    else
        echo -e "  🚀 Release v$version"
    fi
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    # 执行发布流程
    log_info "Step 1/8: Validating version format"
    log_success "Version format valid: $version"

    log_info "Step 2/8: Checking working directory"
    if [[ "$dry_run" != "true" ]]; then
        check_clean_working_dir || exit 1
        check_main_branch || exit 1
    else
        echo "    Would check working directory and branch"
    fi

    log_info "Step 3/8: Running tests"
    if [[ "$skip_tests" == "true" ]]; then
        log_warn "Skipping tests (--skip-tests)"
    elif [[ "$dry_run" == "true" ]]; then
        echo "    Would run: npm test"
    else
        run_tests || exit 1
    fi

    log_info "Step 4/8: Updating version files"
    update_versions "$version" "$dry_run" || exit 1

    log_info "Step 5/8: Updating CHANGELOG"
    update_changelog "$version" "$dry_run" || exit 1

    log_info "Step 6/8: Creating commit"
    if [[ "$dry_run" != "true" ]]; then
        create_commit "$version" "$dry_run" || exit 1
    else
        create_commit "$version" "$dry_run"
    fi

    log_info "Step 7/8: Creating tag"
    create_tag "$version" "$dry_run" || exit 1

    log_info "Step 8/8: Pushing to remote"
    push_to_remote "$version" "$dry_run" || exit 1

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    if [[ "$dry_run" == "true" ]]; then
        echo -e "  ${YELLOW}DRY RUN COMPLETE${NC}"
        echo "  No changes were made. Run without --dry-run to release."
    else
        echo -e "  ${GREEN}RELEASE COMPLETE${NC}: v$version"
        echo "  GitHub Actions will create the release automatically."
    fi
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
}

main "$@"
