# Transmission Web UI

[English](README.md)

为 **Transmission 4.1+** 打造的现代 WebUI，可替代默认控制界面。

![Transmission Web UI](.github/assets/screenshot.png)

## 要求

- **Transmission ≥ 4.1**（`rpc_version_semver ≥ 6.0.0`）。启动时会检测，低于 4.1 会在界面顶部告警。**不支持旧版 Transmission（含 4.0.x），不兼容经典 RPC 协议**。
- 浏览器：现代桌面浏览器（仅桌面端适配）。

## 安装

`scripts/install.sh` 可将构建好的 UI 安装到 Transmission 4.1+ 的 web 目录：

```bash
npm install
npm run build
scripts/install.sh                     # 自动检测 web 目录，低于 4.1 拒绝安装
scripts/install.sh /path/to/webdir     # 也可用 TRANSMISSION_WEB_HOME
scripts/install.sh --dist /path/to/dist   # 安装任意位置的构建产物（默认取 ./dist）
scripts/install.sh --restore           # 恢复官方界面
```

- web 目录检测已处理 4.0+ 的 `public_html` 布局（发行版路径、群晖、进程表推导）；传入父目录会自动归一化。
- 版本检测优先读取本地二进制（`transmission-daemon -V`），回退到 RPC 探测（`--rpc-url` / `--rpc-auth`）。低于 4.1 时脚本拒绝安装。
- 官方 UI 不会被删除：其 `index.html` 被改名为 `index.original.html` 保留在同目录，新 UI 的"关于"窗口中提供了跳转链接；`--restore` 可还原。

## 开发与维护说明

本项目使用 AI 辅助编写与维护，全程由人工进行设计指导与代码审查。

## 许可证

[MIT](LICENSE)

