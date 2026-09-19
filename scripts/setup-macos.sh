#!/usr/bin/env bash
# ==============================================================================
# Boltt — macOS Development Environment Setup
# ==============================================================================

set -eo pipefail

# ANSI Color Codes
BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
BLUE="\033[0;34m"
RED="\033[0;31m"
CYAN="\033[0;36m"
RESET="\033[0m"

DRY_RUN=false
CHECK_ONLY=false
YES_FLAG=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true; YES_FLAG=true ;;
    --check) CHECK_ONLY=true ;;
    -y|--yes) YES_FLAG=true ;;
    -h|--help)
      echo -e "${BOLD}Boltt macOS Setup Script${RESET}"
      echo "Usage: ./scripts/setup-macos.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  -y, --yes   Auto-confirm all prompts without asking"
      echo "  --check     Check missing prerequisites without installing"
      echo "  --dry-run   Show commands that would be executed without running them"
      echo "  -h, --help  Show this help message"
      exit 0
      ;;
  esac
done

echo -e "${CYAN}${BOLD}"
echo "========================================================"
echo "          Boltt — macOS Development Setup               "
echo "========================================================"
echo -e "${RESET}"

echo -e "${BLUE}ℹ macOS Environment Note:${RESET} WebKit is built directly into macOS (WKWebView)."
echo "No external C-libraries (like GTK or WebKit2GTK) are required on macOS."
echo ""

MISSING_TOOLS=()

# 1. Check Xcode Command Line Tools
echo -e "${BOLD}Checking Xcode Command Line Tools...${RESET}"
if xcode-select -p >/dev/null 2>&1; then
  CLT_PATH=$(xcode-select -p)
  echo -e "${GREEN}✔ Xcode Command Line Tools are installed:${RESET} $CLT_PATH"
else
  echo -e "${YELLOW}✖ Xcode Command Line Tools are missing.${RESET}"
  if [ "$CHECK_ONLY" = false ]; then
    DO_INSTALL=false
    if [ "$YES_FLAG" = true ]; then
      DO_INSTALL=true
    else
      read -p "Install Xcode Command Line Tools now? [Y/n] " -n 1 -r || true
      echo ""
      if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
        DO_INSTALL=true
      fi
    fi

    if [ "$DO_INSTALL" = true ]; then
      if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}[DRY RUN] xcode-select --install${RESET}"
      else
        xcode-select --install || true
        echo -e "${YELLOW}Follow the on-screen installer, then re-run this script when finished.${RESET}"
        exit 0
      fi
    else
      echo -e "${RED}Error: Xcode Command Line Tools (clang, make) are required by Tauri.${RESET}"
      MISSING_TOOLS+=("Xcode Command Line Tools")
    fi
  else
    MISSING_TOOLS+=("Xcode Command Line Tools")
  fi
fi

# 2. Check Homebrew (Optional convenience)
echo ""
echo -e "${BOLD}Checking Homebrew...${RESET}"
if command -v brew >/dev/null 2>&1; then
  echo -e "${GREEN}✔ Homebrew is installed.${RESET}"
else
  echo -e "${YELLOW}ℹ Homebrew is not installed (recommended for managing tools on macOS: https://brew.sh).${RESET}"
fi

# 3. Check Rust Toolchain (rustc + cargo)
echo ""
echo -e "${BOLD}Checking Rust Toolchain...${RESET}"
if command -v rustc >/dev/null 2>&1 && command -v cargo >/dev/null 2>&1; then
  RUST_VER=$(rustc --version)
  echo -e "${GREEN}✔ Rust is installed:${RESET} $RUST_VER"
else
  echo -e "${YELLOW}✖ Rust is not installed.${RESET}"
  if [ "$CHECK_ONLY" = false ]; then
    DO_INSTALL=false
    if [ "$YES_FLAG" = true ]; then
      DO_INSTALL=true
    else
      read -p "Install Rust via rustup now? [Y/n] " -n 1 -r || true
      echo ""
      if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
        DO_INSTALL=true
      fi
    fi

    if [ "$DO_INSTALL" = true ]; then
      if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}[DRY RUN] curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y${RESET}"
      else
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
        if [ -f "$HOME/.cargo/env" ]; then
          . "$HOME/.cargo/env"
        fi
        if command -v rustc >/dev/null 2>&1 && command -v cargo >/dev/null 2>&1; then
          echo -e "${GREEN}✔ Rust installed successfully.${RESET}"
        else
          MISSING_TOOLS+=("Rust Toolchain (rustc + cargo)")
        fi
      fi
    else
      echo -e "${RED}Warning: Rust is required to compile and run Boltt.${RESET}"
      MISSING_TOOLS+=("Rust Toolchain (rustc + cargo)")
    fi
  else
    MISSING_TOOLS+=("Rust Toolchain (rustc + cargo)")
  fi
fi

# 4. Check Node.js and pnpm
echo ""
echo -e "${BOLD}Checking Node.js & pnpm...${RESET}"
if command -v node >/dev/null 2>&1; then
  NODE_RAW=$(node -v)
  NODE_MAJOR=$(echo "$NODE_RAW" | sed -E 's/^v([0-9]+).*/\1/')
  NODE_MINOR=$(echo "$NODE_RAW" | sed -E 's/^v[0-9]+\.([0-9]+).*/\1/')
  NODE_OK=false
  if [ "$NODE_MAJOR" -gt 22 ]; then
    NODE_OK=true
  elif [ "$NODE_MAJOR" -eq 22 ] && [ "$NODE_MINOR" -ge 12 ]; then
    NODE_OK=true
  elif [ "$NODE_MAJOR" -eq 20 ] && [ "$NODE_MINOR" -ge 19 ]; then
    NODE_OK=true
  fi

  if [ "$NODE_OK" = true ]; then
    echo -e "${GREEN}✔ Node.js is installed:${RESET} $NODE_RAW"
  else
    echo -e "${YELLOW}✖ Node.js version $NODE_RAW is too old. Boltt requires Node 20.19+ or 22.12+.${RESET}"
    MISSING_TOOLS+=("Node.js (v20.19+ or v22.12+)")
  fi
else
  echo -e "${RED}✖ Node.js is not installed.${RESET}"
  echo "Please install Node.js 20.19+ or 22.12+ (e.g., 'brew install node' or via nvm)."
  MISSING_TOOLS+=("Node.js (v20.19+ or v22.12+)")
fi

if command -v pnpm >/dev/null 2>&1; then
  PNPM_VER=$(pnpm -v)
  echo -e "${GREEN}✔ pnpm is installed:${RESET} v$PNPM_VER"
else
  echo -e "${YELLOW}✖ pnpm is not installed.${RESET}"
  if [ "$CHECK_ONLY" = false ]; then
    DO_INSTALL=false
    if [ "$YES_FLAG" = true ]; then
      DO_INSTALL=true
    else
      read -p "Install pnpm globally? [Y/n] " -n 1 -r || true
      echo ""
      if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
        DO_INSTALL=true
      fi
    fi

    if [ "$DO_INSTALL" = true ]; then
      if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}[DRY RUN] corepack enable || npm install -g pnpm${RESET}"
      else
        if command -v corepack >/dev/null 2>&1; then
          corepack enable >/dev/null 2>&1 || npm install -g pnpm || true
        elif command -v npm >/dev/null 2>&1; then
          npm install -g pnpm || true
        fi
        if command -v pnpm >/dev/null 2>&1; then
          echo -e "${GREEN}✔ pnpm installed successfully.${RESET}"
        else
          MISSING_TOOLS+=("pnpm")
        fi
      fi
    else
      MISSING_TOOLS+=("pnpm")
    fi
  else
    MISSING_TOOLS+=("pnpm")
  fi
fi

# 5. Install Project Dependencies
if [ "$CHECK_ONLY" = false ] && command -v pnpm >/dev/null 2>&1 && [ ${#MISSING_TOOLS[@]} -eq 0 ]; then
  echo ""
  echo -e "${BOLD}Installing Project Dependencies...${RESET}"
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

  if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}[DRY RUN] cd $PROJECT_ROOT && pnpm install${RESET}"
  else
    (cd "$PROJECT_ROOT" && pnpm install)
    echo -e "${GREEN}✔ Project dependencies installed.${RESET}"
  fi
fi

# 6. Evaluation & Status
if [ ${#MISSING_TOOLS[@]} -gt 0 ]; then
  echo ""
  echo -e "${RED}${BOLD}========================================================${RESET}"
  echo -e "${RED}${BOLD}             macOS Setup Incomplete                    ${RESET}"
  echo -e "${RED}${BOLD}========================================================${RESET}"
  echo -e "${RED}The following prerequisites are missing or incompatible:${RESET}"
  for item in "${MISSING_TOOLS[@]}"; do
    echo -e "  ${RED}✖${RESET} $item"
  done
  echo ""
  echo -e "Please install missing prerequisites and re-run: ${CYAN}bash scripts/setup-macos.sh${RESET}"
  exit 1
fi

echo ""
echo -e "${GREEN}${BOLD}========================================================${RESET}"
echo -e "${GREEN}${BOLD}             macOS Setup Complete!                      ${RESET}"
echo -e "${GREEN}${BOLD}========================================================${RESET}"
echo ""
echo -e "You can now run:"
echo -e "  ${CYAN}${BOLD}pnpm tauri dev${RESET}   - Start Boltt desktop app in development mode"
echo -e "  ${CYAN}${BOLD}pnpm doctor${RESET}      - Verify your environment at any time"
echo ""
