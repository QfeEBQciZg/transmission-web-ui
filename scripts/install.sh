#!/usr/bin/env bash
#
# install.sh — install transmission-web-ui into a Transmission 4.1+ web directory.
#
# Features:
#   - the Transmission 4.0+ web dir rename handled precisely (web -> public_html)
#   - a HARD version gate: installs only on Transmission >= 4.1 (RPC >= 6.0.0)
#   - the stock UI preserved, never deleted: index.html -> index.original.html
#
# Install modes (first match wins):
#   1. explicit target dir:  ./install.sh /usr/share/transmission/public_html
#      (a parent dir containing public_html/ or web/ is also accepted)
#   2. $TRANSMISSION_WEB_HOME
#   3. auto-detection (distro paths, Synology, process table)
#
# Source of the build (first match wins):
#   1. --dist <dir>           (default: ../dist relative to this script)
#   2. --url <tarball>        (or --repo owner/name → latest release asset)
#
# Other flags:
#   --restore                 restore the stock UI (index.original.html -> index.html)
#   --rpc-url URL             RPC endpoint for the version check fallback
#   --rpc-auth user:pass      credentials for the RPC fallback
#   -y, --yes                 skip the confirmation prompt
#   -h, --help                show this text

set -euo pipefail

MIN_TR_VERSION="4.1.0"
MIN_RPC_SEMVER="6.0.0"

TARGET_DIR=""
DIST_DIR=""
DOWNLOAD_URL=""
GITHUB_REPO="${GITHUB_REPO:-}"
AUTO_YES=0
DO_RESTORE=0
RPC_URL="${RPC_URL:-http://127.0.0.1:9091/transmission/rpc}"
RPC_AUTH="${RPC_AUTH:-}"

log() { printf '%s\n' "$*" >&2; }
die() { log "ERROR: $*"; exit 1; }

usage() { sed -n '2,29p' "$0"; }

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
  script_dir=$(cd "$(dirname "$0")" && pwd)
  if [ -n "$DIST_DIR" ]; then
    [ -f "$DIST_DIR/index.html" ] || die "dist dir '$DIST_DIR' has no index.html"
    echo "$DIST_DIR"
    return
  fi
  if [ -f "$script_dir/../dist/index.html" ]; then
    echo "$script_dir/../dist"
    return
  fi
  if [ -z "$DOWNLOAD_URL" ]; then
    [ -n "$GITHUB_REPO" ] ||
      die "No local dist found (expected $script_dir/../dist). Run 'npm run build' first, or pass --dist/--url/--repo."
    DOWNLOAD_URL="https://github.com/$GITHUB_REPO/releases/latest/download/transmission-web-ui-dist.tar.gz"
  fi
  local tmp src
  tmp=$(mktemp -d /tmp/twui-install.XXXXXX)
  log "Downloading $DOWNLOAD_URL ..."
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$DOWNLOAD_URL" -o "$tmp/dist.tar.gz" || die "Download failed."
  elif command -v wget >/dev/null 2>&1; then
    wget -q "$DOWNLOAD_URL" -O "$tmp/dist.tar.gz" || die "Download failed."
  else
    die "Neither curl nor wget is available."
  fi
  tar -xzf "$tmp/dist.tar.gz" -C "$tmp" || die "Extract failed."
  src=$(find "$tmp" -maxdepth 3 -name index.html | head -n 1)
  [ -n "$src" ] || die "Downloaded package has no index.html"
  dirname "$src"
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
  mkdir -p "$TARGET_DIR"

  # Preserve the stock UI — never overwrite its entry page or favicon.
  local already_installed=0
  if [ -f "$TARGET_DIR/index.html" ] && grep -q "Transmission Web UI" "$TARGET_DIR/index.html" 2>/dev/null; then
    already_installed=1
  fi
  if [ "$already_installed" -eq 0 ]; then
    if [ -f "$TARGET_DIR/index.html" ] && [ ! -f "$TARGET_DIR/index.original.html" ]; then
      log "Preserving stock UI as index.original.html"
      mv "$TARGET_DIR/index.html" "$TARGET_DIR/index.original.html"
    fi
    if [ -f "$src/favicon.ico" ] && [ -f "$TARGET_DIR/favicon.ico" ] && [ ! -f "$TARGET_DIR/favicon.original.ico" ]; then
      mv "$TARGET_DIR/favicon.ico" "$TARGET_DIR/favicon.original.ico"
    fi
  fi

  log "Installing into $TARGET_DIR ..."
  cp -R "$src/." "$TARGET_DIR/"
  chmod -R a+rX "$TARGET_DIR" 2>/dev/null || true
  maybe_chown

  log ""
  log "Done. transmission-web-ui is now served from $TARGET_DIR"
  if [ -f "$TARGET_DIR/index.original.html" ]; then
    log "The stock UI was preserved as index.original.html (a jump button appears in the new UI's header)."
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

if [ "$AUTO_YES" -ne 1 ]; then
  printf 'Install transmission-web-ui into %s ? [y/N] ' "$TARGET_DIR" >&2
  read -r ans
  case "$ans" in
    y | Y | yes | YES) ;;
    *) log "Aborted."; exit 1 ;;
  esac
fi

do_install "$SRC"
