#!/usr/bin/env bash
#
# install.sh — install transmission-web-ui into a Transmission 4.1+ web directory.
#
# Features:
#   - the Transmission 4.0+ web dir rename handled precisely (web -> public_html)
#   - a HARD version gate: installs only on Transmission >= 4.1 (RPC >= 6.0.0)
#   - the stock UI preserved, never deleted: index.html -> index.original.html
#   - installs from local build or pre-built GitHub Release asset
#   - pipe-friendly (curl ... | bash) with /dev/tty interactive prompt fallback
#
# Install modes (first match wins):
#   1. explicit target dir:  ./install.sh /usr/share/transmission/public_html
#      (a parent dir containing public_html/ or web/ is also accepted)
#   2. $TRANSMISSION_WEB_HOME
#   3. auto-detection (distro paths, Synology, process table)
#
# Source of the build (first match wins):
#   1. --dist <dir>           explicit local build directory
#   2. local dist/            (../dist relative to this script, if exists)
#   3. GitHub Release         download from GitHub (default: QfeEBQciZg/transmission-web-ui)
#

set -euo pipefail

MIN_TR_VERSION="4.1.0"
MIN_RPC_SEMVER="6.0.0"

DEFAULT_REPO="QfeEBQciZg/transmission-web-ui"

TARGET_DIR=""
DIST_DIR=""
DOWNLOAD_URL=""
GITHUB_REPO="${GITHUB_REPO:-$DEFAULT_REPO}"
RELEASE_VERSION="${RELEASE_VERSION:-}"
FORCE_RELEASE=0
GH_PROXY="${GH_PROXY:-}"
AUTO_YES=0
DO_RESTORE=0
RPC_URL="${RPC_URL:-http://127.0.0.1:9091/transmission/rpc}"
RPC_AUTH="${RPC_AUTH:-}"
TMP_DIR=""

log() { printf '%s\n' "$*" >&2; }
die() { log "ERROR: $*"; exit 1; }

cleanup() {
  if [ -n "$TMP_DIR" ] && [ -d "$TMP_DIR" ]; then
    rm -rf "$TMP_DIR"
  fi
}
trap cleanup EXIT INT TERM

usage() {
  cat <<'EOF'
install.sh — install transmission-web-ui into a Transmission 4.1+ web directory.

Usage:
  install.sh [options] [TARGET_DIR]

Install modes (first match wins):
  1. explicit target dir:  ./install.sh /usr/share/transmission/public_html
     (a parent dir containing public_html/ or web/ is also accepted)
  2. $TRANSMISSION_WEB_HOME
  3. auto-detection (distro paths, Synology, process table)

Source of the build (first match wins):
  1. --dist <dir>           explicit local build directory
  2. local dist/            (../dist relative to this script, if exists)
  3. GitHub Release         download pre-built tarball from GitHub

Options:
  --version, -v <tag>       specify release version to download (e.g. v0.1.0, default: latest)
  --release                 force downloading release even if local dist/ exists
  --repo <owner/repo>       custom GitHub repository (default: QfeEBQciZg/transmission-web-ui)
  --url <url>               direct download URL for release tarball or zip
  --mirror, --proxy <url>   mirror/proxy prefix for GitHub downloads (e.g. https://ghfast.top/)
  --dist <dir>              install from a local build directory
  --target <dir>            explicit target web directory
  --restore                 restore the stock UI (index.original.html -> index.html)
  --rpc-url <url>           RPC endpoint for version check fallback (default: http://127.0.0.1:9091/transmission/rpc)
  --rpc-auth <user:pass>    credentials for the RPC fallback
  -y, --yes                 skip the confirmation prompt
  -h, --help                show this help message
EOF
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# ver_ge A B → success when version A >= version B (numeric, dot-separated)
ver_ge() {
  local a1 a2 a3 b1 b2 b3
  a1=$(echo "$1" | cut -d. -f1)
  a2=$(echo "$1" | cut -d. -f2)
  a3=$(echo "$1" | cut -d. -f3)
  b1=$(echo "$2" | cut -d. -f1)
  b2=$(echo "$2" | cut -d. -f2)
  b3=$(echo "$2" | cut -d. -f3)
  a1=${a1:-0}; a2=${a2:-0}; a3=${a3%%[^0-9]*}; a3=${a3:-0}
  b1=${b1:-0}; b2=${b2:-0}; b3=${b3%%[^0-9]*}; b3=${b3:-0}
  [ "$a1" -gt "$b1" ] && return 0
  [ "$a1" -lt "$b1" ] && return 1
  [ "$a2" -gt "$b2" ] && return 0
  [ "$a2" -lt "$b2" ] && return 1
  [ "$a3" -ge "$b3" ]
}

# ---------------------------------------------------------------------------
# Version detection (hard gate)
# ---------------------------------------------------------------------------

# Extract field $1 from session_get over the 409 handshake; prints the value.
rpc_session_field() {
  command -v curl >/dev/null 2>&1 || return 1
  local body auth_args resp sid
  body='{"jsonrpc":"2.0","method":"session_get","params":{"fields":["version","rpc_version_semver"]},"id":1}'
  auth_args=()
  if [ -n "$RPC_AUTH" ]; then auth_args=(--user "$RPC_AUTH"); fi
  resp=$(curl -s -i "${auth_args[@]}" -X POST -H 'Content-Type: application/json' \
    --data "$body" "$RPC_URL" 2>/dev/null) || return 1
  sid=$(printf '%s' "$resp" | sed -n 's/^[Xx]-[Tt]ransmission-[Ss]ession-[Ii]d:[[:space:]]*\(.*\)$/\1/p' | tr -d '\r')
  [ -n "$sid" ] || return 1
  resp=$(curl -s "${auth_args[@]}" -X POST -H 'Content-Type: application/json' \
    -H "X-Transmission-Session-Id: $sid" --data "$body" "$RPC_URL" 2>/dev/null) || return 1
  printf '%s' "$resp" | sed -n 's/.*"'"$1"'"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1
}

# Prints the Transmission version (e.g. 4.1.0); fails when undetectable.
detect_tr_version() {
  local v=""
  if command -v transmission-daemon >/dev/null 2>&1; then
    v=$(transmission-daemon -V 2>/dev/null | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -n 1)
  fi
  if [ -z "$v" ] && command -v transmission-remote >/dev/null 2>&1; then
    v=$(transmission-remote -V 2>/dev/null | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -n 1)
  fi
  [ -n "$v" ] || return 1
  echo "$v"
}

enforce_version_gate() {
  local v sv
  if v=$(detect_tr_version); then
    log "Detected Transmission version: $v"
    ver_ge "$v" "$MIN_TR_VERSION" && return 0
    die "Transmission $v detected, but this UI requires Transmission $MIN_TR_VERSION or newer."
  fi
  if sv=$(rpc_session_field rpc_version_semver) && [ -n "$sv" ]; then
    log "Detected RPC protocol version: $sv"
    ver_ge "$sv" "$MIN_RPC_SEMVER" && return 0
    die "RPC protocol $sv detected, but this UI requires >= $MIN_RPC_SEMVER (Transmission $MIN_TR_VERSION+)."
  fi
  die "Cannot determine the Transmission version (no local binary, RPC unreachable at $RPC_URL). Refusing to install: this UI supports Transmission $MIN_TR_VERSION+ only."
}

# ---------------------------------------------------------------------------
# Web directory resolution (4.0+: public_html)
# ---------------------------------------------------------------------------

normalize_target() {
  if [ -d "$1/public_html" ]; then echo "$1/public_html"; return; fi
  if [ -d "$1/web" ]; then echo "$1/web"; return; fi
  echo "$1"
}

daemon_prefix_root() {
  local bin
  bin=$(ps -Aww -o command= 2>/dev/null | sed -n '/[t]ransmission-da/{s/ .*//;p;q;}')
  case "$bin" in
    */bin/transmission-daemon) echo "${bin%/bin/transmission-daemon}/share/transmission" ;;
    *) return 1 ;;
  esac
}

resolve_web_dir() {
  if [ -n "$TARGET_DIR" ]; then
    TARGET_DIR=$(normalize_target "$TARGET_DIR")
    return
  fi
  if [ -n "${TRANSMISSION_WEB_HOME:-}" ]; then
    TARGET_DIR="$TRANSMISSION_WEB_HOME"
    return
  fi
  local roots proc_root
  roots="/usr/share/transmission /usr/local/share/transmission /usr/local/transmission/share/transmission /var/packages/transmission/target/share/transmission"
  proc_root=$(daemon_prefix_root || true)
  [ -n "$proc_root" ] && roots="$proc_root $roots"
  local root
  for root in $roots; do
    if [ -d "$root/public_html" ]; then TARGET_DIR="$root/public_html"; return; fi
    if [ -d "$root/web" ]; then TARGET_DIR="$root/web"; return; fi
  done
  for root in $roots; do
    # 4.1+ is guaranteed by the gate; create the 4.0-style directory.
    if [ -d "$root" ]; then TARGET_DIR="$root/public_html"; return; fi
  done
  die "Could not locate the Transmission web directory. Pass it explicitly: $0 /path/to/webdir"
}

# ---------------------------------------------------------------------------
# Source resolution (local dist or release tarball)
# ---------------------------------------------------------------------------

resolve_source() {
  local script_dir
  script_dir=$(cd "$(dirname "$0")" 2>/dev/null && pwd || echo "")

  if [ -n "$DIST_DIR" ]; then
    [ -f "$DIST_DIR/index.html" ] || die "dist dir '$DIST_DIR' has no index.html"
    echo "$DIST_DIR"
    return
  fi

  # Prefer local build if present, UNLESS --release, --version, or --url was explicitly passed
  if [ "$FORCE_RELEASE" -eq 0 ] && [ -z "$RELEASE_VERSION" ] && [ -z "$DOWNLOAD_URL" ]; then
    if [ -n "$script_dir" ] && [ -f "$script_dir/../dist/index.html" ]; then
      echo "$script_dir/../dist"
      return
    fi
  fi

  if [ -z "$DOWNLOAD_URL" ]; then
    [ -n "$GITHUB_REPO" ] || die "GitHub repo not configured. Pass --repo or --url."
    local tag="${RELEASE_VERSION:-latest}"
    if [ "$tag" = "latest" ]; then
      DOWNLOAD_URL="https://github.com/$GITHUB_REPO/releases/latest/download/transmission-web-ui-dist.tar.gz"
    else
      case "$tag" in
        v*) ;;
        *) tag="v$tag" ;;
      esac
      DOWNLOAD_URL="https://github.com/$GITHUB_REPO/releases/download/$tag/transmission-web-ui-dist.tar.gz"
    fi
  fi

  if [ -n "$GH_PROXY" ]; then
    case "$GH_PROXY" in
      */) ;;
      *) GH_PROXY="$GH_PROXY/" ;;
    esac
    DOWNLOAD_URL="${GH_PROXY}${DOWNLOAD_URL}"
  fi

  TMP_DIR=$(mktemp -d /tmp/twui-install.XXXXXX)
  log "Downloading $DOWNLOAD_URL ..."
  local archive="$TMP_DIR/dist.archive"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$DOWNLOAD_URL" -o "$archive" || die "Download failed from $DOWNLOAD_URL"
  elif command -v wget >/dev/null 2>&1; then
    wget -q "$DOWNLOAD_URL" -O "$archive" || die "Download failed from $DOWNLOAD_URL"
  else
    die "Neither curl nor wget is available."
  fi

  # Extract tar.gz or zip
  if tar -tzf "$archive" >/dev/null 2>&1; then
    tar -xzf "$archive" -C "$TMP_DIR" || die "Extract failed."
  elif command -v unzip >/dev/null 2>&1; then
    unzip -q -o "$archive" -d "$TMP_DIR" || die "Unzip failed."
  else
    tar -xf "$archive" -C "$TMP_DIR" || die "Archive extraction failed."
  fi

  local src
  src=$(find "$TMP_DIR" -maxdepth 3 -name index.html | head -n 1)
  [ -n "$src" ] || die "Downloaded package has no index.html"
  dirname "$src"
}

# ---------------------------------------------------------------------------
# UI version detection
# ---------------------------------------------------------------------------

# Detect installed or incoming UI version (e.g. 0.1.0). Returns empty if not this UI.
get_ui_version() {
  local dir="$1"
  if [ -f "$dir/version.json" ]; then
    local v
    v=$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$dir/version.json" | head -n 1)
    if [ -n "$v" ]; then echo "$v"; return; fi
  fi
  if [ -f "$dir/index.html" ]; then
    local v
    v=$(sed -n 's/.*<meta[[:space:]][^>]*name=["'\'']version["'\''][^>]*content=["'\'']\([^"'\'']*\)["'\''][^>]*>.*/\1/p' "$dir/index.html" | head -n 1)
    if [ -n "$v" ]; then echo "$v"; return; fi
    v=$(sed -n 's/.*<meta[[:space:]][^>]*content=["'\'']\([^"'\'']*\)["'\''][^>]*name=["'\'']version["'\''][^>]*>.*/\1/p' "$dir/index.html" | head -n 1)
    if [ -n "$v" ]; then echo "$v"; return; fi
    # Fallback for earlier builds of this UI (such as initial v0.1.0 release without meta tag)
    if grep -q "Transmission Web UI" "$dir/index.html" 2>/dev/null; then
      echo "0.1.0"
      return
    fi
  fi
  echo ""
}

# ---------------------------------------------------------------------------
# Install / restore
# ---------------------------------------------------------------------------

maybe_chown() {
  # Best-effort ownership fix; chmod a+rX already made the files readable.
  # Use numeric IDs — ps truncates long user NAMES (e.g. sc-transmission
  # becomes "sc-tran+"), but never numeric uid/gid.
  [ "$(id -u)" = "0" ] || return 0
  local ids uid gid
  ids=$(ps -Aww -o uid=,gid=,command= 2>/dev/null | sed -n '/[t]ransmission-da/{s/^[[:space:]]*\([0-9][0-9]*\)[[:space:]][[:space:]]*\([0-9][0-9]*\)[[:space:]].*/\1 \2/p;q;}')
  case "$ids" in
    *' '*)
      uid=${ids%% *}
      gid=${ids##* }
      ;;
    *)
      uid=$ids
      gid=
      ;;
  esac
  [ -n "$uid" ] || return 0
  chown -R "$uid${gid:+:$gid}" "$TARGET_DIR" 2>/dev/null ||
    log "WARN: chown to $uid${gid:+:$gid} failed (continuing)."
}

do_install() {
  local src="$1"
  local installed_ver="${2:-}"
  local incoming_ver="${3:-}"
  mkdir -p "$TARGET_DIR"

  # Preserve the stock UI — never overwrite its entry page or favicon.
  # Only back up on fresh installs (when this WebUI was not already installed).
  if [ -z "$installed_ver" ]; then
    if [ -f "$TARGET_DIR/index.html" ] && [ ! -f "$TARGET_DIR/index.original.html" ]; then
      log "Preserving stock UI as index.original.html"
      mv "$TARGET_DIR/index.html" "$TARGET_DIR/index.original.html"
    fi
    if [ -f "$src/favicon.ico" ] && [ -f "$TARGET_DIR/favicon.ico" ] && [ ! -f "$TARGET_DIR/favicon.original.ico" ]; then
      mv "$TARGET_DIR/favicon.ico" "$TARGET_DIR/favicon.original.ico"
    fi
  fi

  if [ -n "$installed_ver" ] && [ "$installed_ver" != "$incoming_ver" ]; then
    log "Upgrading from v$installed_ver to v$incoming_ver in $TARGET_DIR ..."
  elif [ -n "$installed_ver" ]; then
    log "Reinstalling v$installed_ver in $TARGET_DIR ..."
  else
    log "Installing into $TARGET_DIR ..."
  fi

  cp -R "$src/." "$TARGET_DIR/"
  chmod -R a+rX "$TARGET_DIR" 2>/dev/null || true
  maybe_chown

  log ""
  if [ -n "$installed_ver" ] && [ "$installed_ver" != "$incoming_ver" ]; then
    log "Done. transmission-web-ui upgraded to v$incoming_ver in $TARGET_DIR"
  else
    log "Done. transmission-web-ui${incoming_ver:+ v$incoming_ver} is now served from $TARGET_DIR"
  fi
  if [ -f "$TARGET_DIR/index.original.html" ]; then
    log "The stock UI was preserved as index.original.html (a jump button appears in the About dialog)."
    log "Restore it any time with: $0 --restore $TARGET_DIR"
  fi
}

do_restore() {
  [ -f "$TARGET_DIR/index.original.html" ] ||
    die "No index.original.html in $TARGET_DIR — nothing to restore."
  mv "$TARGET_DIR/index.original.html" "$TARGET_DIR/index.html"
  if [ -f "$TARGET_DIR/favicon.original.ico" ]; then
    mv "$TARGET_DIR/favicon.original.ico" "$TARGET_DIR/favicon.ico"
  fi
  log "Stock UI restored in $TARGET_DIR (our other files are now unreferenced and may be removed)."
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

while [ $# -gt 0 ]; do
  case "$1" in
    --restore) DO_RESTORE=1 ;;
    --dist) shift; DIST_DIR="${1:?--dist needs a value}" ;;
    --target) shift; TARGET_DIR="${1:?--target needs a value}" ;;
    --url) shift; DOWNLOAD_URL="${1:?--url needs a value}" ;;
    --repo) shift; GITHUB_REPO="${1:?--repo needs a value}" ;;
    --version | -v) shift; RELEASE_VERSION="${1:?--version needs a value}" ;;
    --release) FORCE_RELEASE=1 ;;
    --mirror | --proxy) shift; GH_PROXY="${1:?--mirror needs a value}" ;;
    --rpc-url) shift; RPC_URL="${1:?--rpc-url needs a value}" ;;
    --rpc-auth) shift; RPC_AUTH="${1:?--rpc-auth needs a value}" ;;
    -y | --yes) AUTO_YES=1 ;;
    -h | --help) usage; exit 0 ;;
    -*) die "Unknown option: $1 (see --help)" ;;
    *)
      [ -z "$TARGET_DIR" ] || die "Unexpected argument: $1"
      TARGET_DIR="$1"
      ;;
  esac
  shift
done

resolve_web_dir
log "Target web directory: $TARGET_DIR"

if [ "$DO_RESTORE" -eq 1 ]; then
  do_restore
  exit 0
fi

enforce_version_gate
SRC=$(resolve_source)

INSTALLED_UI_VER=$(get_ui_version "$TARGET_DIR")
INCOMING_UI_VER=$(get_ui_version "$SRC")

if [ -n "$INSTALLED_UI_VER" ]; then
  log "Detected installed transmission-web-ui: v$INSTALLED_UI_VER"
fi
if [ -n "$INCOMING_UI_VER" ]; then
  log "Package version to install: v$INCOMING_UI_VER"
fi

if [ "$AUTO_YES" -ne 1 ]; then
  prompt_msg="Install transmission-web-ui${INCOMING_UI_VER:+ v$INCOMING_UI_VER} into $TARGET_DIR ? [y/N] "
  if [ -n "$INSTALLED_UI_VER" ]; then
    if [ "$INSTALLED_UI_VER" = "$INCOMING_UI_VER" ]; then
      prompt_msg="transmission-web-ui v$INSTALLED_UI_VER is already installed. Reinstall into $TARGET_DIR ? [y/N] "
    else
      prompt_msg="Upgrade transmission-web-ui (v$INSTALLED_UI_VER -> v$INCOMING_UI_VER) in $TARGET_DIR ? [y/N] "
    fi
  fi

  if [ ! -t 0 ]; then
    if [ -r /dev/tty ]; then
      printf '%s' "$prompt_msg" >&2
      read -r ans < /dev/tty
    else
      die "Non-interactive environment detected. Run with -y / --yes to install without confirmation."
    fi
  else
    printf '%s' "$prompt_msg" >&2
    read -r ans
  fi
  case "$ans" in
    y | Y | yes | YES) ;;
    *) log "Aborted."; exit 1 ;;
  esac
fi

do_install "$SRC" "$INSTALLED_UI_VER" "$INCOMING_UI_VER"
