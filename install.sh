#!/bin/bash

# mob-seed installer
# Installs mob-seed plugin for Claude Code

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🌱 mob-seed installer${NC}"
echo ""

# Detect installation scope
SCOPE="${1:-user}"
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

case "$SCOPE" in
  user|--user|-u)
    INSTALL_DIR="$HOME/.claude/plugins/mob-seed"
    echo -e "Installing to user scope: ${GREEN}$INSTALL_DIR${NC}"
    ;;
  project|--project|-p)
    if [ -d ".git" ]; then
      INSTALL_DIR="./.claude/plugins/mob-seed"
      echo -e "Installing to project scope: ${GREEN}$INSTALL_DIR${NC}"
    else
      echo -e "${RED}Error: Not in a git repository root.${NC}"
      echo "Run this command from your project root, or use 'user' scope."
      exit 1
    fi
    ;;
  *)
    echo "Usage: ./install.sh [user|project]"
    echo ""
    echo "  user (default)  Install to ~/.claude/plugins/"
    echo "  project         Install to ./.claude/plugins/"
    exit 1
    ;;
esac

# Check if already installed
if [ -d "$INSTALL_DIR" ]; then
  echo -e "${YELLOW}Warning: mob-seed already installed at $INSTALL_DIR${NC}"
  read -p "Overwrite? [y/N] " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
  fi
  rm -rf "$INSTALL_DIR"
fi

# Create plugin directory
mkdir -p "$(dirname "$INSTALL_DIR")"

# Copy plugin files
echo "Copying plugin files..."
cp -r "$REPO_DIR" "$INSTALL_DIR"

# Remove git and development files from installed copy
rm -rf "$INSTALL_DIR/.git"
rm -rf "$INSTALL_DIR/.gitignore"
rm -f "$INSTALL_DIR/install.sh"

echo ""
echo -e "${GREEN}✅ mob-seed installed successfully!${NC}"
echo ""
echo "Next steps:"
echo "  1. Restart Claude Code to load the plugin"
echo "  2. Run /mob-seed-init in your project to initialize SEED"
echo ""
echo "Commands available:"
echo "  /mob-seed-init     Initialize SEED (OpenSpec default)"
echo "  /mob-seed-spec     Create specifications"
echo "  /mob-seed-emit     Auto-derive code/tests/docs"
echo "  /mob-seed-status   Check sync status"
echo ""
