---
name: "electron-release-publisher"
description: "Publishes the BattleLedger website and Electron release. Invoke when user asks to release a new desktop version, update the download page, or sync latest release metadata."
---

# BattleLedger 发布助手

这个 Skill 用来统一执行 `战痕仪` 的官网发布、Electron 安装包发布、版本元数据同步和发布结果校验。

## 适用场景

在以下情况必须调用这个 Skill：

- 用户要求发布新的 Electron 版本
- 用户要求同步官网下载页到最新版本
- 用户要求构建安装包并上线
- 用户要求检查官网与下载链接是否一致

## 发布前检查

1. 读取并确认 `package.json` 中的版本号是否正确。
2. 读取 `website/public/releases/latest.json` 和 `website/public/releases/changelog.json`。
3. 确认本次版本号、标题、更新说明是否齐全。
4. 确认 `electron-builder.json` 和 `.github/workflows/release.yml` 存在。

## 标准发布流程

1. 更新版本号：
   - 如有需要，先执行 `npm version <version> --no-git-tag-version`
2. 生成发布元数据：
   - 设置环境变量：
     - `RELEASE_VERSION`
     - `RELEASE_TITLE`
     - `RELEASE_NOTES`
     - `RELEASE_DOWNLOAD_URL`
     - `RELEASE_PAGE_URL`
   - 运行：

```bash
npm run release:manifest
```

3. 构建桌面端：

```bash
npm run dist:win
```

4. 构建官网：

```bash
npm run website:build
```

5. 如果使用 GitHub Actions：
   - 打开 `Release BattleLedger` 工作流
   - 输入版本号、标题、更新说明
   - 等待安装包上传和 GitHub Pages 部署完成

## 发布后校验

发布完成后必须检查：

1. `website/public/releases/latest.json` 中的版本号和下载链接是否正确
2. 下载页展示的版本号是否与 Release 一致
3. GitHub Release 中是否存在 `.exe` 安装包
4. 官网下载按钮是否跳转到正确地址

## 输出格式

发布完成后，返回以下信息：

- 发布版本号
- 官网地址
- 最新下载地址
- Release 页面地址
- 本次更新说明
- 是否存在需要人工补充处理的事项

## 注意事项

- 不要伪造线上地址；如果仓库、GitHub Pages 或 Release 还未配置完成，要明确说明阻塞点。
- 不要跳过版本元数据同步，否则官网会显示旧版本。
- 如果当前目录不是 Git 仓库，要先提示用户补齐远端仓库后再执行真正上线。
