const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

const SECTION = 'globalMarkdownSidebar';
const FOLDERS_KEY = 'folders';
const EXTENSIONS_KEY = 'extensions';
const DEFAULT_EXTENSIONS = ['.md', '.markdown'];
const LAST_VERSION_NOTICE_KEY = 'lastVersionNotice';

class MarkdownNode extends vscode.TreeItem {
  constructor(options) {
    super(options.label, options.collapsibleState ?? vscode.TreeItemCollapsibleState.None);
    this.nodeType = options.nodeType;
    this.fullPath = options.fullPath;
    this.contextValue = options.contextValue;
    this.description = options.description;
    this.tooltip = options.tooltip;
    this.resourceUri = options.resourceUri;
    this.command = options.command;
    this.iconPath = options.iconPath;
  }
}

class MarkdownSidebarProvider {
  constructor() {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this.markdownCache = new Map();
  }

  refresh() {
    this.markdownCache.clear();
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element) {
    return element;
  }

  async getChildren(element) {
    if (!element) {
      return this.getRootItems();
    }

    if (element.nodeType === 'root' || element.nodeType === 'folder') {
      return this.getDirectoryChildren(element.fullPath);
    }

    return [];
  }

  async getRootItems() {
    const folders = getConfiguredFolders();

    if (folders.length === 0) {
      return [
        new MarkdownNode({
          label: '还没有配置目录',
          nodeType: 'message',
          tooltip: '点击后添加一个或多个根目录。',
          command: {
            command: 'globalMarkdownSidebar.addFolders',
            title: '添加目录'
          },
          iconPath: new vscode.ThemeIcon('info')
        })
      ];
    }

    return folders.map((folderPath) => {
      const exists = fs.existsSync(folderPath);
      const label = path.basename(folderPath) || folderPath;

      if (!exists) {
        return new MarkdownNode({
          label,
          description: '目录不存在',
          nodeType: 'root',
          fullPath: folderPath,
          contextValue: 'rootFolder',
          tooltip: folderPath,
          collapsibleState: vscode.TreeItemCollapsibleState.None,
          iconPath: new vscode.ThemeIcon('warning')
        });
      }

      return new MarkdownNode({
        label,
        description: folderPath,
        nodeType: 'root',
        fullPath: folderPath,
        contextValue: 'rootFolder',
        tooltip: folderPath,
        collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
        iconPath: vscode.ThemeIcon.Folder
      });
    });
  }

  async getDirectoryChildren(directoryPath) {
    let entries;

    try {
      entries = await fs.promises.readdir(directoryPath, { withFileTypes: true });
    } catch (error) {
      return [
        new MarkdownNode({
          label: '无法读取目录',
          description: error instanceof Error ? error.message : String(error),
          nodeType: 'message',
          tooltip: directoryPath,
          iconPath: new vscode.ThemeIcon('error')
        })
      ];
    }

    const directories = [];
    const files = [];

    for (const entry of entries) {
      const fullPath = path.join(directoryPath, entry.name);

      if (entry.isDirectory()) {
        const hasTargetFiles = await this.directoryContainsTargetFiles(fullPath);
        if (hasTargetFiles) {
          directories.push(fullPath);
        }
        continue;
      }

      if (entry.isFile() && isIncludedFile(entry.name)) {
        files.push(fullPath);
      }
    }

    directories.sort((left, right) => left.localeCompare(right, 'zh-CN'));
    files.sort((left, right) => left.localeCompare(right, 'zh-CN'));

    const directoryNodes = directories.map((fullPath) => new MarkdownNode({
      label: path.basename(fullPath),
      nodeType: 'folder',
      fullPath,
      contextValue: 'folder',
      tooltip: fullPath,
      collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
      iconPath: vscode.ThemeIcon.Folder
    }));

    const fileNodes = files.map((fullPath) => {
      const resourceUri = vscode.Uri.file(fullPath);
      return new MarkdownNode({
        label: path.basename(fullPath),
        nodeType: 'file',
        fullPath,
        contextValue: 'file',
        tooltip: fullPath,
        resourceUri,
        command: {
          command: 'globalMarkdownSidebar.openAndReveal',
          title: '打开并定位文件',
          arguments: [resourceUri]
        },
        iconPath: new vscode.ThemeIcon('file')
      });
    });

    if (directoryNodes.length === 0 && fileNodes.length === 0) {
      return [
        new MarkdownNode({
          label: '此目录下没有匹配文件',
          nodeType: 'message',
          tooltip: directoryPath,
          iconPath: new vscode.ThemeIcon('info')
        })
      ];
    }

    return [...directoryNodes, ...fileNodes];
  }

  async directoryContainsTargetFiles(directoryPath) {
    if (this.markdownCache.has(directoryPath)) {
      return this.markdownCache.get(directoryPath);
    }

    let containsTargetFile = false;

    try {
      const entries = await fs.promises.readdir(directoryPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && isIncludedFile(entry.name)) {
          containsTargetFile = true;
          break;
        }

        if (entry.isDirectory()) {
          const nestedPath = path.join(directoryPath, entry.name);
          const nestedContainsTargetFiles = await this.directoryContainsTargetFiles(nestedPath);
          if (nestedContainsTargetFiles) {
            containsTargetFile = true;
            break;
          }
        }
      }
    } catch {
      containsTargetFile = false;
    }

    this.markdownCache.set(directoryPath, containsTargetFile);
    return containsTargetFile;
  }
}

function normalizeExtension(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) {
    return '';
  }

  if (normalized.startsWith('.')) {
    return normalized;
  }

  return `.${normalized}`;
}

function getConfiguredExtensions() {
  const configured = vscode.workspace.getConfiguration(SECTION).get(EXTENSIONS_KEY, DEFAULT_EXTENSIONS);
  const normalized = configured.map(normalizeExtension).filter(Boolean);
  if (normalized.length === 0) {
    return [...DEFAULT_EXTENSIONS];
  }

  return [...new Set(normalized)];
}

function isIncludedFile(fileName) {
  const extension = path.extname(fileName).toLowerCase();
  return getConfiguredExtensions().includes(extension);
}

function normalizeFolderPath(folderPath) {
  return path.normalize(folderPath.trim());
}

function getConfiguredFolders() {
  const folders = vscode.workspace.getConfiguration(SECTION).get(FOLDERS_KEY, []);
  return [...new Set(folders.map(normalizeFolderPath).filter(Boolean))];
}

async function updateConfiguredFolders(nextFolders) {
  const normalizedFolders = [...new Set(nextFolders.map(normalizeFolderPath).filter(Boolean))];
  await vscode.workspace.getConfiguration(SECTION).update(
    FOLDERS_KEY,
    normalizedFolders,
    vscode.ConfigurationTarget.Global
  );
}

async function addFolders(provider) {
  const selected = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: true,
    openLabel: '添加目录'
  });

  if (!selected || selected.length === 0) {
    return;
  }

  const currentFolders = getConfiguredFolders();
  const selectedFolders = selected.map((item) => item.fsPath);
  await updateConfiguredFolders([...currentFolders, ...selectedFolders]);
  provider.refresh();
}

async function replaceFolders(provider) {
  const selected = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: true,
    openLabel: '替换目录'
  });

  if (!selected) {
    return;
  }

  await updateConfiguredFolders(selected.map((item) => item.fsPath));
  provider.refresh();
}

async function removeFolders(provider, folderNode) {
  const currentFolders = getConfiguredFolders();
  if (currentFolders.length === 0) {
    return;
  }

  if (folderNode && folderNode.fullPath) {
    const nextFolders = currentFolders.filter((item) => item !== folderNode.fullPath);
    await updateConfiguredFolders(nextFolders);
    provider.refresh();
    return;
  }

  const picks = currentFolders.map((folderPath) => ({
    label: path.basename(folderPath) || folderPath,
    description: folderPath,
    picked: false
  }));

  const selected = await vscode.window.showQuickPick(picks, {
    canPickMany: true,
    placeHolder: '选择要移除的根目录'
  });

  if (!selected || selected.length === 0) {
    return;
  }

  const toRemove = new Set(selected.map((item) => item.description));
  const nextFolders = currentFolders.filter((item) => !toRemove.has(item));
  await updateConfiguredFolders(nextFolders);
  provider.refresh();
}

async function manageFolders(provider) {
  const action = await vscode.window.showQuickPick(
    [
      { label: '添加目录', action: 'add' },
      { label: '移除目录', action: 'remove' },
      { label: '替换全部目录', action: 'replace' },
      { label: '打开目录设置', action: 'settingsFolders' },
      { label: '打开扩展名设置', action: 'settingsExtensions' }
    ],
    { placeHolder: '选择要执行的目录管理操作' }
  );

  if (!action) {
    return;
  }

  if (action.action === 'add') {
    await addFolders(provider);
    return;
  }

  if (action.action === 'remove') {
    await removeFolders(provider);
    return;
  }

  if (action.action === 'replace') {
    await replaceFolders(provider);
    return;
  }

  if (action.action === 'settingsExtensions') {
    await vscode.commands.executeCommand('workbench.action.openSettings', `${SECTION}.${EXTENSIONS_KEY}`);
    return;
  }

  await vscode.commands.executeCommand('workbench.action.openSettings', `${SECTION}.${FOLDERS_KEY}`);
}

async function revealInExplorer(uri, silent = false) {
  try {
    await vscode.commands.executeCommand('workbench.view.explorer');
    await vscode.commands.executeCommand('revealInExplorer', uri);
    return true;
  } catch (error) {
    if (!silent) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showWarningMessage(`无法在资源管理器中定位: ${message}`);
    }
    return false;
  }
}

function normalizePath(value) {
  return path.normalize(value).toLowerCase();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findOwningConfiguredFolder(filePath) {
  const normalizedFilePath = normalizePath(filePath);
  const candidates = getConfiguredFolders()
    .filter((folderPath) => normalizedFilePath.startsWith(`${normalizePath(folderPath)}${path.sep}`) || normalizedFilePath === normalizePath(folderPath))
    .sort((left, right) => right.length - left.length);

  return candidates[0];
}

function ensureFolderInWorkspace(folderPath) {
  if (!folderPath || !fs.existsSync(folderPath)) {
    return false;
  }

  const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
  const normalizedTarget = normalizePath(folderPath);
  const alreadyExists = workspaceFolders.some((folder) => normalizePath(folder.uri.fsPath) === normalizedTarget);
  if (alreadyExists) {
    return true;
  }

  const name = path.basename(folderPath) || folderPath;
  return vscode.workspace.updateWorkspaceFolders(workspaceFolders.length, 0, {
    uri: vscode.Uri.file(folderPath),
    name
  });
}

async function ensureRevealContext(uri) {
  const ownerFolder = findOwningConfiguredFolder(uri.fsPath);
  const folderToAdd = ownerFolder || path.dirname(uri.fsPath);
  const added = ensureFolderInWorkspace(folderToAdd);
  if (added) {
    // 等待资源管理器树刷新，避免刚加入工作区时立即定位失败。
    await sleep(220);
  }
  return added;
}

async function tryRevealActiveFileInExplorer() {
  try {
    await vscode.commands.executeCommand('workbench.view.explorer');
    await vscode.commands.executeCommand('workbench.files.action.showActiveFileInExplorer');
    return true;
  } catch {
    return false;
  }
}

async function revealWithRetry(uri) {
  let revealed = await revealInExplorer(uri, true);
  if (revealed) {
    return true;
  }

  await ensureRevealContext(uri);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await sleep(180);
    revealed = await revealInExplorer(uri, true);
    if (revealed) {
      return true;
    }
  }

  return tryRevealActiveFileInExplorer();
}

async function openAndReveal(uri) {
  if (!uri) {
    vscode.window.showWarningMessage('未获取到目标文件路径。');
    return;
  }

  try {
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document, {
      preview: true,
      preserveFocus: false
    });

    const revealed = await revealWithRetry(uri);
    if (!revealed) {
      vscode.window.showInformationMessage('文件已打开，但当前未能在资源管理器定位。你可以在编辑器标签上右键选择“在资源管理器中显示”。');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`打开文件失败: ${message}`);
  }
}

function showVersionOnActivate(context) {
  const extension = vscode.extensions.getExtension('local.global-markdown-sidebar');
  const version = extension?.packageJSON?.version;
  if (!version) {
    return;
  }

  const lastShownVersion = context.globalState.get(LAST_VERSION_NOTICE_KEY);
  if (lastShownVersion === version) {
    return;
  }

  vscode.window.showInformationMessage(`Global Markdown Sidebar v${version} 已就绪。`);
  context.globalState.update(LAST_VERSION_NOTICE_KEY, version);
}

function activate(context) {
  const provider = new MarkdownSidebarProvider();

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('globalMarkdownSidebarView', provider),
    vscode.commands.registerCommand('globalMarkdownSidebar.refresh', () => provider.refresh()),
    vscode.commands.registerCommand('globalMarkdownSidebar.addFolders', () => addFolders(provider)),
    vscode.commands.registerCommand('globalMarkdownSidebar.manageFolders', () => manageFolders(provider)),
    vscode.commands.registerCommand('globalMarkdownSidebar.removeFolder', (node) => removeFolders(provider, node)),
    vscode.commands.registerCommand('globalMarkdownSidebar.openAndReveal', openAndReveal),
    vscode.commands.registerCommand('globalMarkdownSidebar.revealInExplorer', (nodeOrUri) => {
      const uri = nodeOrUri?.resourceUri ?? nodeOrUri;
      if (uri) {
        return revealInExplorer(uri, false);
      }
      return undefined;
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(SECTION)) {
        provider.refresh();
      }
    })
  );

  showVersionOnActivate(context);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
