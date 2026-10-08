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

TMP_DIR=$(mktemp -d)
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

# 1. Fetch release metadata (cached once, with redirect fallback to bypass rate limits)
RELEASE_JSON="$TMP_DIR/release.json"
LATEST_TAG=""

if command -v curl >/dev/null 2>&1; then
  # Try API first
  curl -sSL "https://api.github.com/repos/${REPO}/releases/latest" -o "$RELEASE_JSON" 2>/dev/null || true
fi

# If API was rate limited or empty, resolve latest tag from GitHub redirect
if [ ! -s "$RELEASE_JSON" ] || grep -q "API rate limit exceeded" "$RELEASE_JSON" 2>/dev/null; then
  EFFECTIVE_URL=$(curl -sIL -o /dev/null -w '%{url_effective}' "https://github.com/${REPO}/releases/latest" 2>/dev/null || true)
  LATEST_TAG=$(echo "$EFFECTIVE_URL" | sed -E 's#.*/tag/v?##')
else
  LATEST_TAG=$(grep -m1 '"tag_name":' "$RELEASE_JSON" | sed -E 's/.*"tag_name": *"v?([^"]+)".*/\1/' || true)
fi

# Helper to find download URL matching asset extension (excluding .sig files)
resolve_asset_url() {
  local asset_suffix="$1"
  local url=""

  if [ -s "$RELEASE_JSON" ] && ! grep -q "API rate limit exceeded" "$RELEASE_JSON"; then
    url=$(grep -oE "https://github.com/${REPO}/releases/download/[^\"]+${asset_suffix}" "$RELEASE_JSON" | grep -v '\.sig$' | head -n 1 || true)
  fi

  # Fallback to direct latest/download URL if API didn't resolve
  if [ -z "$url" ] && [ -n "$LATEST_TAG" ]; then
    url="https://github.com/${REPO}/releases/download/v${LATEST_TAG}/${asset_suffix}"
  elif [ -z "$url" ]; then
    url="https://github.com/${REPO}/releases/latest/download/${asset_suffix}"
  fi
  echo "$url"
}

# ------------------------------------------------------------------------------
# macOS Installation
# ------------------------------------------------------------------------------
if [ "$OS" = "Darwin" ]; then
  if [ "$ARCH" != "arm64" ] && [ "$ARCH" != "aarch64" ]; then
    echo -e "${RED}Error: Pre-built macOS releases currently target Apple Silicon (arm64/M-series).${RESET}"
    echo -e "${RED}Detected architecture: $ARCH.${RESET}"
    exit 1
  fi

  echo -e "${BLUE}ℹ Fetching latest Apple Silicon macOS release...${RESET}"
  DOWNLOAD_URL=$(resolve_asset_url "boltt_aarch64.app.tar.gz")

  ARCHIVE_FILE="$TMP_DIR/boltt.app.tar.gz"
  echo -e "${BLUE}ℹ Downloading Boltt from:${RESET} $DOWNLOAD_URL"
  if ! curl -fL --progress-bar "$DOWNLOAD_URL" -o "$ARCHIVE_FILE"; then
    echo -e "${RED}✖ Failed to download macOS release archive.${RESET}"
    exit 1
  fi

  echo -e "${BLUE}ℹ Verifying archive integrity...${RESET}"
  if ! tar -tzf "$ARCHIVE_FILE" >/dev/null 2>&1; then
    echo -e "${RED}✖ Downloaded archive is corrupted or invalid.${RESET}"
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
    echo -e "${RED}✖ Could not find application bundle inside archive.${RESET}"
    exit 1
  fi

  DEST_DIR="/Applications"
  TARGET_APP="$DEST_DIR/Boltt.app"
  STAGE_APP="$TMP_DIR/Boltt.app.staged"

  # Stage application before moving to destination (atomic replacement)
  cp -R "$APP_SOURCE" "$STAGE_APP"
  xattr -cr "$STAGE_APP" 2>/dev/null || true

  echo -e "${BLUE}ℹ Installing to $TARGET_APP...${RESET}"
  if [ -w "$DEST_DIR" ]; then
    rm -rf "$TARGET_APP"
    mv "$STAGE_APP" "$TARGET_APP"
  else
    echo -e "${YELLOW}Elevated permissions required to write to /Applications.${RESET}"
    sudo rm -rf "$TARGET_APP"
    sudo mv "$STAGE_APP" "$TARGET_APP"
  fi

  # Final quarantine attribute clear on target
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

  # 1. Debian / Ubuntu (.deb package)
  if command -v dpkg >/dev/null 2>&1; then
    echo -e "${BLUE}ℹ Debian/Ubuntu system detected. Fetching latest .deb package...${RESET}"
    DEB_PATTERN="amd64.deb"
    DOWNLOAD_URL=""
    if [ -s "$RELEASE_JSON" ]; then
      DOWNLOAD_URL=$(grep -oE "https://github.com/${REPO}/releases/download/[^\"]+${DEB_PATTERN}" "$RELEASE_JSON" | grep -v '\.sig$' | head -n 1 || true)
    fi
    if [ -z "$DOWNLOAD_URL" ] && [ -n "$LATEST_TAG" ]; then
      DOWNLOAD_URL="https://github.com/${REPO}/releases/download/v${LATEST_TAG}/boltt_${LATEST_TAG}_amd64.deb"
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
  APPIMAGE_PATTERN="amd64.AppImage"
  DOWNLOAD_URL=""
  if [ -s "$RELEASE_JSON" ]; then
    DOWNLOAD_URL=$(grep -oE "https://github.com/${REPO}/releases/download/[^\"]+${APPIMAGE_PATTERN}" "$RELEASE_JSON" | grep -v '\.sig$' | head -n 1 || true)
  fi
  if [ -z "$DOWNLOAD_URL" ] && [ -n "$LATEST_TAG" ]; then
    DOWNLOAD_URL="https://github.com/${REPO}/releases/download/v${LATEST_TAG}/boltt_${LATEST_TAG}_amd64.AppImage"
  fi

  if [ -z "$DOWNLOAD_URL" ]; then
    echo -e "${RED}✖ Unable to resolve AppImage download URL.${RESET}"
    exit 1
  fi

  INSTALL_DIR="$HOME/.local/bin"
  mkdir -p "$INSTALL_DIR"
  APPIMAGE_PATH="$INSTALL_DIR/boltt"
  STAGE_FILE="$TMP_DIR/boltt.AppImage"

  echo -e "${BLUE}ℹ Downloading Boltt AppImage...${RESET}"
  curl -fL --progress-bar "$DOWNLOAD_URL" -o "$STAGE_FILE"
  chmod +x "$STAGE_FILE"

  # Verify executable format before replacing
  if command -v file >/dev/null 2>&1; then
    if ! file "$STAGE_FILE" | grep -qi "ELF"; then
      echo -e "${RED}✖ Downloaded AppImage is not a valid ELF executable.${RESET}"
      exit 1
    fi
  fi

  # Atomic replacement
  mv "$STAGE_FILE" "$APPIMAGE_PATH"

  # Create desktop entry with explicit managed marker
  DESKTOP_DIR="$HOME/.local/share/applications"
  mkdir -p "$DESKTOP_DIR"
  cat > "$DESKTOP_DIR/boltt.desktop" <<EOF
[Desktop Entry]
# Managed by Boltt
Name=Boltt
Comment=Local-first HTTP Client
Exec="$APPIMAGE_PATH"
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
