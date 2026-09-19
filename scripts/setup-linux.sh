#!/usr/bin/env bash
# ==============================================================================
# Boltt — Linux Development Environment Setup
# Supported distributions: Debian, Ubuntu, Pop!_OS, Linux Mint, Fedora, Arch
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
      echo -e "${BOLD}Boltt Linux Setup Script${RESET}"
      echo "Usage: ./scripts/setup-linux.sh [OPTIONS]"
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
echo "          Boltt — Linux Development Setup              "
echo "========================================================"
echo -e "${RESET}"

MISSING_TOOLS=()

# 1. Detect Linux Distribution
if [ -f /etc/os-release ]; then
  . /etc/os-release
  DISTRO_ID="${ID:-unknown}"
  DISTRO_LIKE="${ID_LIKE:-unknown}"
else
  echo -e "${RED}Error: Cannot detect Linux distribution (/etc/os-release not found).${RESET}"
  exit 1
fi

echo -e "${BLUE}ℹ Detected Distribution:${RESET} ${BOLD}${NAME:-$DISTRO_ID}${RESET} (${DISTRO_ID})"

# 2. Map System Packages by Package Manager
PKG_MANAGER=""
INSTALL_CMD=""
REQUIRED_PACKAGES=()
NODE_PACKAGES=()

if [[ "$DISTRO_ID" =~ ^(ubuntu|debian|pop|linuxmint|elementary|zorin)$ ]] || [[ "$DISTRO_LIKE" =~ (ubuntu|debian) ]]; then
  PKG_MANAGER="apt"
  INSTALL_CMD="sudo apt-get update && sudo apt-get install -y"
  REQUIRED_PACKAGES=(
    libwebkit2gtk-4.1-dev
    libgtk-3-dev
    libayatana-appindicator3-dev
    librsvg2-dev
    build-essential
    curl
    wget
    file
    libssl-dev
    pkg-config
  )
  NODE_PACKAGES=(nodejs npm)
elif [[ "$DISTRO_ID" =~ ^(fedora|rhel|centos|rocky|alma)$ ]] || [[ "$DISTRO_LIKE" =~ (fedora|rhel) ]]; then
  PKG_MANAGER="dnf"
  INSTALL_CMD="sudo dnf install -y"
  REQUIRED_PACKAGES=(
    webkit2gtk4.1-devel
    gtk3-devel
    libayatana-appindicator-devel
    librsvg2-devel
    openssl-devel
    @development-tools
    curl
    wget
    pkgconf-pkg-config
  )
  NODE_PACKAGES=(nodejs npm)
elif [[ "$DISTRO_ID" =~ ^(arch|manjaro|endeavouros|garuda)$ ]] || [[ "$DISTRO_LIKE" =~ arch ]]; then
  PKG_MANAGER="pacman"
  INSTALL_CMD="sudo pacman -S --needed --noconfirm"
  REQUIRED_PACKAGES=(
    webkit2gtk-4.1
    gtk3
    libappindicator-gtk3
    librsvg
    base-devel
    openssl
    curl
    wget
    pkgconf
  )
  NODE_PACKAGES=(nodejs npm)
else
  echo -e "${YELLOW}Warning: Distribution '$DISTRO_ID' is not explicitly listed.${RESET}"
  echo "You will need to manually install WebKit2GTK 4.1, GTK 3, and build tools."
  PKG_MANAGER="manual"
fi

# 3. Check System Packages and Libraries
echo ""
echo -e "${BOLD}Checking System Dependencies...${RESET}"

check_linux_libraries() {
  local all_libs_ok=true

  if ! command -v pkg-config >/dev/null 2>&1; then
    echo -e "${YELLOW}✖ pkg-config is not installed.${RESET}"
    all_libs_ok=false
  else
    # Check WebKit2GTK 4.1
    if pkg-config --exists webkit2gtk-4.1; then
      echo -e "${GREEN}✔ WebKit2GTK 4.1 dev headers installed.${RESET}"
    else
      echo -e "${YELLOW}✖ WebKit2GTK 4.1 dev headers missing.${RESET}"
      all_libs_ok=false
    fi

    # Check GTK+ 3
    if pkg-config --exists gtk+-3.0; then
      echo -e "${GREEN}✔ GTK+ 3.0 dev headers installed.${RESET}"
    else
      echo -e "${YELLOW}✖ GTK+ 3.0 dev headers missing.${RESET}"
      all_libs_ok=false
    fi

    # Check appindicator
    if pkg-config --exists ayatana-appindicator3-0.1 || pkg-config --exists appindicator3-0.1; then
      echo -e "${GREEN}✔ AppIndicator dev headers installed.${RESET}"
    else
      echo -e "${YELLOW}✖ AppIndicator dev headers missing.${RESET}"
      all_libs_ok=false
    fi

    # Check librsvg
    if pkg-config --exists librsvg-2.0; then
      echo -e "${GREEN}✔ librsvg dev headers installed.${RESET}"
    else
      echo -e "${YELLOW}✖ librsvg dev headers missing.${RESET}"
      all_libs_ok=false
    fi

    # Check openssl
    if pkg-config --exists openssl; then
      echo -e "${GREEN}✔ OpenSSL dev headers installed.${RESET}"
    else
      echo -e "${YELLOW}✖ OpenSSL dev headers missing.${RESET}"
      all_libs_ok=false
    fi
  fi

  if [ "$all_libs_ok" = false ]; then
    return 1
  fi
  return 0
}

install_system_packages() {
  if [ "$PKG_MANAGER" = "manual" ]; then
    echo -e "${YELLOW}Please install WebKit2GTK 4.1 development libraries using your package manager.${RESET}"
    MISSING_TOOLS+=("Linux C/C++ Libraries (WebKit2GTK 4.1, GTK 3)")
    return
  fi

  echo -e "${BLUE}Running:${RESET} $INSTALL_CMD ${REQUIRED_PACKAGES[*]}"
  if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}[DRY RUN] Skipping command execution.${RESET}"
    return
  fi

  eval "$INSTALL_CMD ${REQUIRED_PACKAGES[*]}"
  if check_linux_libraries; then
    echo -e "${GREEN}✔ System libraries installed successfully.${RESET}"
  else
    echo -e "${RED}✖ Failed to verify all system libraries after installation.${RESET}"
    MISSING_TOOLS+=("Linux C/C++ Libraries")
  fi
}

if ! check_linux_libraries; then
  if [ "$CHECK_ONLY" = true ]; then
    MISSING_TOOLS+=("Linux C/C++ Libraries (WebKit2GTK, GTK3, AppIndicator)")
    echo -e "Required package manager command: ${CYAN}$INSTALL_CMD ${REQUIRED_PACKAGES[*]}${RESET}"
  else
    if [ -n "$PKG_MANAGER" ] && [ "$PKG_MANAGER" != "manual" ]; then
      DO_INSTALL=false
      if [ "$YES_FLAG" = true ]; then
        DO_INSTALL=true
      else
        read -p "Install required Linux C/C++ libraries ($PKG_MANAGER)? [Y/n] " -n 1 -r || true
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
          DO_INSTALL=true
        fi
      fi

      if [ "$DO_INSTALL" = true ]; then
        install_system_packages
      else
        echo -e "${YELLOW}Skipping system package installation.${RESET}"
        MISSING_TOOLS+=("Linux C/C++ Libraries")
      fi
    else
      MISSING_TOOLS+=("Linux C/C++ Libraries")
    fi
  fi
else
  echo -e "${GREEN}✔ All required Linux native C/C++ libraries are present.${RESET}"
fi

# 4. Check Rust Toolchain (rustc + cargo)
echo ""
echo -e "${BOLD}Checking Rust Toolchain...${RESET}"
if command -v rustc >/dev/null 2>&1 && command -v cargo >/dev/null 2>&1; then
  RUST_VER=$(rustc --version)
  echo -e "${GREEN}✔ Rust is installed:${RESET} $RUST_VER"
else
  echo -e "${YELLOW}✖ Rust toolchain (rustc/cargo) is not installed.${RESET}"
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

# 5. Check Node.js and pnpm
echo ""
echo -e "${BOLD}Checking Node.js & pnpm...${RESET}"
NODE_IS_READY=false
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
    NODE_IS_READY=true
  else
    echo -e "${YELLOW}✖ Node.js version $NODE_RAW is too old. Boltt requires Node 20.19+ or 22.12+.${RESET}"
    MISSING_TOOLS+=("Node.js (v20.19+ or v22.12+)")
  fi
else
  echo -e "${RED}✖ Node.js is not installed.${RESET}"
  if [ "$CHECK_ONLY" = false ] && [ -n "$PKG_MANAGER" ] && [ "$PKG_MANAGER" != "manual" ]; then
    DO_NODE_INSTALL=false
    if [ "$YES_FLAG" = true ]; then
      DO_NODE_INSTALL=true
    else
      read -p "Install Node.js & npm via $PKG_MANAGER? [Y/n] " -n 1 -r || true
      echo ""
      if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
        DO_NODE_INSTALL=true
      fi
    fi

    if [ "$DO_NODE_INSTALL" = true ]; then
      if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}[DRY RUN] $INSTALL_CMD ${NODE_PACKAGES[*]}${RESET}"
      else
        eval "$INSTALL_CMD ${NODE_PACKAGES[*]}"
        if command -v node >/dev/null 2>&1; then
          echo -e "${GREEN}✔ Node.js installed.${RESET}"
          NODE_IS_READY=true
        else
          MISSING_TOOLS+=("Node.js (v20.19+ or v22.12+)")
        fi
      fi
    else
      MISSING_TOOLS+=("Node.js (v20.19+ or v22.12+)")
    fi
  else
    MISSING_TOOLS+=("Node.js (v20.19+ or v22.12+)")
  fi
fi

if command -v pnpm >/dev/null 2>&1; then
  PNPM_VER=$(pnpm -v)
  echo -e "${GREEN}✔ pnpm is installed:${RESET} v$PNPM_VER"
else
  echo -e "${YELLOW}✖ pnpm is not installed.${RESET}"
  if [ "$CHECK_ONLY" = false ] && [ "$NODE_IS_READY" = true ]; then
    DO_INSTALL=false
    if [ "$YES_FLAG" = true ]; then
      DO_INSTALL=true
    else
      read -p "Install pnpm globally via corepack / npm? [Y/n] " -n 1 -r || true
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

# 6. Install Project Dependencies
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

# 7. Evaluation & Status
if [ ${#MISSING_TOOLS[@]} -gt 0 ]; then
  echo ""
  echo -e "${RED}${BOLD}========================================================${RESET}"
  echo -e "${RED}${BOLD}             Linux Setup Incomplete                    ${RESET}"
  echo -e "${RED}${BOLD}========================================================${RESET}"
  echo -e "${RED}The following prerequisites are missing or incompatible:${RESET}"
  for item in "${MISSING_TOOLS[@]}"; do
    echo -e "  ${RED}✖${RESET} $item"
  done
  echo ""
  echo -e "Please install missing prerequisites and re-run: ${CYAN}bash scripts/setup-linux.sh${RESET}"
  exit 1
fi

echo ""
echo -e "${GREEN}${BOLD}========================================================${RESET}"
echo -e "${GREEN}${BOLD}             Linux Setup Complete!                      ${RESET}"
echo -e "${GREEN}${BOLD}========================================================${RESET}"
echo ""
echo -e "You can now run:"
echo -e "  ${CYAN}${BOLD}pnpm tauri dev${RESET}   - Start Boltt desktop app in development mode"
echo -e "  ${CYAN}${BOLD}pnpm doctor${RESET}      - Verify your environment at any time"
echo ""
