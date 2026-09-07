# Transmission Web UI

[中文文档](README.zh-CN.md)

A modern web UI for **Transmission 4.1+**, designed as a replacement for the default web interface.

![Transmission Web UI](.github/assets/screenshot.png)

## Requirements

- **Transmission ≥ 4.1** (`rpc_version_semver ≥ 6.0.0`). The version is checked on startup; older daemons trigger a banner warning. **Older Transmission versions (incl. 4.0.x) and the classic RPC protocol are not supported.**
- A modern desktop browser (desktop only).

## Installation

`scripts/install.sh` installs the built UI into a Transmission 4.1+ web directory:

```bash
npm install
npm run build
scripts/install.sh                     # auto-detect the web dir, hard-stop below Transmission 4.1
scripts/install.sh /path/to/webdir     # or set TRANSMISSION_WEB_HOME
scripts/install.sh --dist /path/to/dist   # install a build from any directory (default: ./dist)
scripts/install.sh --restore           # put the stock UI back
```

- Web dir detection handles the Transmission 4.0+ `public_html` layout (distro paths, Synology, process table); a parent dir passed as argument is normalized.
- The Transmission version is detected from the local binary (`transmission-daemon -V`), falling back to the RPC endpoint (`--rpc-url` / `--rpc-auth`). Below 4.1 the script refuses to install.
- The stock UI is never deleted: its `index.html` is renamed to `index.original.html`, and the About dialog links to it. `--restore` moves it back.

## Development & Maintenance

This project is written and maintained with the assistance of AI, under human direction and code review.

## License

[MIT](LICENSE)

