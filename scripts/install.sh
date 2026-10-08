#!/usr/bin/env bash
set -eo pipefail

REPO="Utkarsh049/boltt"
OS="$(uname -s)"
ARCH="$(uname -m)"

# Formatting
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
RESET='\033[0m'

echo ""
echo -e "${BLUE}${BOLD}========================================================${RESET}"
echo -e "${BLUE}${BOLD}             Boltt Installer (macOS & Linux)            ${RESET}"
echo -e "${BLUE}${BOLD}========================================================${RESET}"
echo ""

# Helper to query GitHub latest release asset
get_latest_release_info() {
  local asset_pattern="$1"
  local api_url="https://api.github.com/repos/${REPO}/releases/latest"
  local download_url=""
  
  if command -v curl >/dev/null 2>&1; then
    download_url=$(curl -sSL "$api_url" 2>/dev/null | grep -o "https://github.com/${REPO}/releases/download/[^\"]*${asset_pattern}[^\"]*" | head -n 1 || true)
  fi
  echo "$download_url"
}

# ------------------------------------------------------------------------------
# macOS Installation
# ------------------------------------------------------------------------------
if [ "$OS" = "Darwin" ]; then
  if [ "$ARCH" != "arm64" ] && [ "$ARCH" != "aarch64" ]; then
    echo -e "${YELLOW}Warning: Current pre-built releases target Apple Silicon (arm64/M-series).${RESET}"
    echo -e "${YELLOW}Detected architecture: $ARCH.${RESET}"
  fi

  echo -e "${BLUE}ℹ Fetching latest macOS release...${RESET}"
  
  # Try GitHub API first, fallback to standard naming
  DOWNLOAD_URL=$(get_latest_release_info "aarch64.app.tar.gz")
  if [ -z "$DOWNLOAD_URL" ]; then
    DOWNLOAD_URL="https://github.com/${REPO}/releases/latest/download/boltt_aarch64.app.tar.gz"
  fi

  TMP_DIR=$(mktemp -d)
  cleanup() {
    rm -rf "$TMP_DIR"
  }
  trap cleanup EXIT

  ARCHIVE_FILE="$TMP_DIR/boltt.app.tar.gz"
  echo -e "${BLUE}ℹ Downloading Boltt from:${RESET} $DOWNLOAD_URL"
  if ! curl -fL --progress-bar "$DOWNLOAD_URL" -o "$ARCHIVE_FILE"; then
    echo -e "${RED}✖ Failed to download macOS release archive.${RESET}"
    exit 1
  fi

  echo -e "${BLUE}ℹ Extracting application...${RESET}"
  tar -xzf "$ARCHIVE_FILE" -C "$TMP_DIR"

  APP_SOURCE=""
  if [ -d "$TMP_DIR/Boltt.app" ]; then
    APP_SOURCE="$TMP_DIR/Boltt.app"
  elif [ -d "$TMP_DIR/boltt.app" ]; then
    APP_SOURCE="$TMP_DIR/boltt.app"
  fi

  if [ -z "$APP_SOURCE" ]; then
    echo -e "${RED}✖ Could not find Boltt.app inside archive.${RESET}"
    exit 1
  fi

  DEST_DIR="/Applications"
  TARGET_APP="$DEST_DIR/Boltt.app"

  echo -e "${BLUE}ℹ Installing to $TARGET_APP...${RESET}"
  if [ -w "$DEST_DIR" ]; then
    rm -rf "$TARGET_APP"
    cp -R "$APP_SOURCE" "$TARGET_APP"
  else
    echo -e "${YELLOW}Elevated permissions required to write to /Applications.${RESET}"
    sudo rm -rf "$TARGET_APP"
    sudo cp -R "$APP_SOURCE" "$TARGET_APP"
  fi

  # Clear Gatekeeper quarantine flag so macOS launches without security errors
  echo -e "${BLUE}ℹ Clearing macOS Gatekeeper quarantine flag...${RESET}"
  xattr -cr "$TARGET_APP" 2>/dev/null || true

  echo ""
  echo -e "${GREEN}${BOLD}========================================================${RESET}"
  echo -e "${GREEN}${BOLD}        Boltt was successfully installed!               ${RESET}"
  echo -e "${GREEN}${BOLD}========================================================${RESET}"
  echo ""
  echo -e "You can open Boltt from Spotlight, Applications folder, or terminal:"
  echo -e "  ${BOLD}open -a Boltt${RESET}"
  echo ""
  exit 0
fi

# ------------------------------------------------------------------------------
# Linux Installation
# ------------------------------------------------------------------------------
if [ "$OS" = "Linux" ]; then
  if [ "$ARCH" != "x86_64" ]; then
    echo -e "${RED}Error: Pre-built Linux releases are currently available for x86_64 only.${RESET}"
    echo -e "${RED}Detected architecture: $ARCH.${RESET}"
    exit 1
  fi

  TMP_DIR=$(mktemp -d)
  cleanup() {
    rm -rf "$TMP_DIR"
  }
  trap cleanup EXIT

  # 1. Debian / Ubuntu (.deb package)
  if command -v dpkg >/dev/null 2>&1; then
    echo -e "${BLUE}ℹ Debian/Ubuntu system detected. Fetching latest .deb package...${RESET}"
    DOWNLOAD_URL=$(get_latest_release_info "amd64.deb")
    if [ -z "$DOWNLOAD_URL" ]; then
      DOWNLOAD_URL=$(curl -sSL "https://api.github.com/repos/${REPO}/releases/latest" 2>/dev/null | grep "browser_download_url" | grep -E "amd64\.deb" | cut -d '"' -f 4 | head -n 1 || true)
    fi

    if [ -n "$DOWNLOAD_URL" ]; then
      DEB_FILE="$TMP_DIR/boltt.deb"
      echo -e "${BLUE}ℹ Downloading package:${RESET} $DOWNLOAD_URL"
      if curl -fL --progress-bar "$DOWNLOAD_URL" -o "$DEB_FILE"; then
        echo -e "${BLUE}ℹ Installing Debian package...${RESET}"
        if [ "$(id -u)" -eq 0 ]; then
          dpkg -i "$DEB_FILE" || apt-get install -f -y
        elif command -v sudo >/dev/null 2>&1; then
          sudo dpkg -i "$DEB_FILE" || sudo apt-get install -f -y
        else
          echo -e "${RED}Error: Root or sudo access required to install .deb package.${RESET}"
          exit 1
        fi

        echo ""
        echo -e "${GREEN}${BOLD}========================================================${RESET}"
        echo -e "${GREEN}${BOLD}        Boltt was successfully installed!               ${RESET}"
        echo -e "${GREEN}${BOLD}========================================================${RESET}"
        echo ""
        echo -e "You can launch Boltt from your application launcher or terminal:"
        echo -e "  ${BOLD}boltt${RESET}"
        echo ""
        exit 0
      fi
    fi
  fi

  # 2. Standalone AppImage for all Linux distributions
  echo -e "${BLUE}ℹ Fetching latest Linux AppImage...${RESET}"
  DOWNLOAD_URL=$(get_latest_release_info "amd64.AppImage")
  if [ -z "$DOWNLOAD_URL" ]; then
    DOWNLOAD_URL=$(curl -sSL "https://api.github.com/repos/${REPO}/releases/latest" 2>/dev/null | grep "browser_download_url" | grep -E "amd64\.AppImage" | cut -d '"' -f 4 | head -n 1 || true)
  fi

  if [ -z "$DOWNLOAD_URL" ]; then
    echo -e "${RED}✖ Unable to resolve AppImage download URL.${RESET}"
    exit 1
  fi

  INSTALL_DIR="$HOME/.local/bin"
  mkdir -p "$INSTALL_DIR"
  APPIMAGE_PATH="$INSTALL_DIR/boltt"

  echo -e "${BLUE}ℹ Downloading Boltt AppImage to $APPIMAGE_PATH...${RESET}"
  curl -fL --progress-bar "$DOWNLOAD_URL" -o "$APPIMAGE_PATH"
  chmod +x "$APPIMAGE_PATH"

  # Create desktop entry
  DESKTOP_DIR="$HOME/.local/share/applications"
  mkdir -p "$DESKTOP_DIR"
  cat > "$DESKTOP_DIR/boltt.desktop" <<EOF
[Desktop Entry]
Name=Boltt
Comment=Local-first HTTP Client
Exec=$APPIMAGE_PATH
Terminal=false
Type=Application
Categories=Development;Network;
StartupWMClass=boltt
EOF

  echo ""
  echo -e "${GREEN}${BOLD}========================================================${RESET}"
  echo -e "${GREEN}${BOLD}        Boltt was successfully installed!               ${RESET}"
  echo -e "${GREEN}${BOLD}========================================================${RESET}"
  echo ""
  echo -e "Installed binary to: ${BOLD}$APPIMAGE_PATH${RESET}"
  echo -e "Added desktop entry to: ${BOLD}$DESKTOP_DIR/boltt.desktop${RESET}"
  echo ""
  echo -e "Make sure ${BOLD}~/.local/bin${RESET} is in your PATH to run '${BOLD}boltt${RESET}' from terminal."
  echo ""
  exit 0
fi

echo -e "${RED}Unsupported operating system: $OS${RESET}"
exit 1
