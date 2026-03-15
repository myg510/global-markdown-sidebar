# Global Markdown Sidebar

在 VS Code 左侧边栏固定显示你关心的文档目录，无论当前打开哪个工作区都可以快速访问。

## 功能

- 全局生效，不依赖当前打开的工作区
- 支持配置多个固定目录
- 支持自定义扩展名过滤（默认 `.md`、`.markdown`）
- 只显示包含目标扩展名文件的目录树
- 单击文件：自动打开文件，并在资源管理器中定位
- 当目标目录不在当前工作区时，会自动加入工作区后再定位
- 支持刷新、添加目录、移除目录、替换全部目录
- 安装或升级后会显示当前扩展版本提示

## 0.0.5 修复

- 修复部分场景点击文件无响应的问题
- 修复在空窗口和非同路径工作区下的定位稳定性

## 配置项

在 VS Code 设置中搜索 `Global Markdown Sidebar: Folders` 或 `globalMarkdownSidebar.folders`，填入绝对路径数组。

你也可以直接在“设置 -> 扩展 -> Global Markdown Sidebar”里修改。

示例：

```json
"globalMarkdownSidebar.folders": [
  "<绝对路径目录1>",
  "<绝对路径目录2>"
]
```

扩展名过滤示例：

```json
"globalMarkdownSidebar.extensions": [
  ".md",
  ".txt"
]
```

## 使用

1. 安装扩展
2. 在左侧活动栏打开“知识库”图标
3. 首次点击“添加 Markdown 目录”或直接写设置
4. 单击任意文件，会直接在资源管理器中定位
5. 如果是首次安装或升级，会弹出版本提示

## 目录管理

视图标题栏提供以下操作：

- 刷新目录
- 添加目录
- 管理目录

根目录节点右键可直接移除该目录。

## 发布到 VS Code Marketplace

发布前需要先修改 [package.json](package.json) 中的占位信息：

1. `publisher`: 改成你在 Marketplace 创建的发布者 ID
2. `homepage`, `bugs.url`, `repository.url`: 改成你的仓库地址
3. `version`: 每次发布必须递增

### 首次发布

1. 创建发布者: [Marketplace Manage](https://marketplace.visualstudio.com/manage)
2. 在 Azure DevOps 创建 PAT，权限包含 Marketplace Manage
3. 在扩展目录登录发布者

```powershell
npx @vscode/vsce login <your-publisher-id>
```

命令执行后输入 PAT，成功会看到已登录提示。

1. 打包并检查

```powershell
npx @vscode/vsce package
```

成功判定：当前目录出现 `.vsix` 文件。

1. 发布

```powershell
npx @vscode/vsce publish
```

成功判定：终端出现 `Published` 或已发布版本信息。

### 命令行逐步发布（详细）

1. 进入扩展目录

```powershell
Push-Location "<你的扩展目录>"
```

1. 预检查 Node / npm

```powershell
node -v
npm -v
```

1. 预检查清单关键信息

```powershell
Get-Content .\package.json -Raw
```

确认 `publisher`、`version`、`repository`、`homepage` 已正确填写。

1. 登录发布者（首次或 token 更新时）

```powershell
npx @vscode/vsce login <your-publisher-id>
```

1. 本地打包验证

```powershell
npx @vscode/vsce package
```

1. 正式发布

```powershell
npx @vscode/vsce publish
```

1. 发布后校验

- 在 Marketplace 页面确认版本号
- 在 VS Code 扩展页搜索扩展 ID：`<publisher>.global-markdown-sidebar`
- 本地安装校验：

```powershell
code --install-extension <publisher>.global-markdown-sidebar
```

1. 返回原目录（可选）

```powershell
Pop-Location
```

### 快速方式（推荐）

使用仓库内脚本自动填充发布者和仓库地址，并自动递增补丁版本：

```powershell
./publish-helper.ps1
```

也可以直接传参：

```powershell
./publish-helper.ps1 -Publisher <your-publisher-id> -Repo <owner/repo>
```

先预览不写入：

```powershell
./publish-helper.ps1 -Publisher <your-publisher-id> -Repo <owner/repo> -DryRun
```

### 一键自动上传（命令行）

1. 先设置发布令牌（当前 PowerShell 会话）

```powershell
$env:VSCE_PAT = "<your_pat>"
```

1. 一条命令自动完成：更新清单、打包、登录、发布

```powershell
./auto-publish.ps1 -Publisher <your-publisher-id> -Repo <owner/repo>
```

### 后续发布

```powershell
npx @vscode/vsce publish patch
```

或

```powershell
npx @vscode/vsce publish minor
```
