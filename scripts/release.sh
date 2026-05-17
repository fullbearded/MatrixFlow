#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

CURRENT_VERSION=$(node -p "require('./package.json').version")

echo "========================================="
echo "  MatrixFlow 发布工具"
echo "  当前版本: $CURRENT_VERSION"
echo "========================================="
echo ""

if [ -n "$(git status --porcelain)" ]; then
  echo "❌ 存在未提交的更改，请先提交或暂存。"
  git status --short
  exit 1
fi

echo "选择发布类型:"
echo "  1) patch (0.0.x) — 修复 bug"
echo "  2) minor (0.x.0) — 新功能（向后兼容）"
echo "  3) major (x.0.0) — 重大更新（可能不兼容）"
echo "  4) 自定义版本号"
echo ""
read -rp "输入选择 [1-4]: " choice

case "$choice" in
  1) NEW_VERSION=$(npm version patch --no-git-tag-version) ;;
  2) NEW_VERSION=$(npm version minor --no-git-tag-version) ;;
  3) NEW_VERSION=$(npm version major --no-git-tag-version) ;;
  4)
    read -rp "输入新版本号 (如 1.2.3): " custom_version
    if [[ ! "$custom_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      echo "❌ 版本号格式无效"
      exit 1
    fi
    npm version "$custom_version" --no-git-tag-version
    NEW_VERSION="v$custom_version"
    ;;
  *)
    echo "❌ 无效选择"
    exit 1
    ;;
esac

VERSION="${NEW_VERSION#v}"
echo ""
echo "新版本: $VERSION"
echo ""

read -rp "是否生成 changelog? [y/N]: " gen_changelog
if [[ "$gen_changelog" =~ ^[Yy]$ ]]; then
  PREV_TAG=$(git describe --tags --abbrev=0 HEAD 2>/dev/null || echo "")

  CHANGELOG_FILE="CHANGELOG.md"
  TEMP_CHANGELOG=$(mktemp)

  {
    echo "## $VERSION ($(date +%Y-%m-%d))"
    echo ""
    if [ -n "$PREV_TAG" ]; then
      git log "${PREV_TAG}..HEAD" --pretty=format:"- %s (%h)" --no-merges
    else
      git log --pretty=format:"- %s (%h)" --no-merges -30
    fi
    echo ""
    echo ""
    if [ -f "$CHANGELOG_FILE" ]; then
      tail -n +2 "$CHANGELOG_FILE"
    fi
  } > "$TEMP_CHANGELOG"

  echo "# Changelog" > "$CHANGELOG_FILE"
  cat "$TEMP_CHANGELOG" >> "$CHANGELOG_FILE"
  rm "$TEMP_CHANGELOG"

  echo "✅ CHANGELOG.md 已更新"
fi

echo ""
echo "即将执行以下操作:"
echo "  1. 提交版本更新"
echo "  2. 创建 git tag v$VERSION"
echo "  3. 推送到远程仓库"
echo "  4. 触发 CI/CD 构建并发布"
echo ""
read -rp "确认发布? [y/N]: " confirm

if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "已取消"
  git checkout package.json package-lock.json 2>/dev/null || true
  exit 0
fi

git add package.json package-lock.json CHANGELOG.md 2>/dev/null || true
git commit -m "chore: release v${VERSION}"
git tag "v${VERSION}"
git push origin main --tags

echo ""
echo "✅ 发布已触发！"
echo "  Tag: v${VERSION}"
echo "  查看: https://github.com/matrixflow/matrixflow/actions"
