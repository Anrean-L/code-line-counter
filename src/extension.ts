import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import ignore from 'ignore';

type StatusBar = {
    item: vscode.StatusBarItem;
    update: (total: number) => void;
};

const countTextLines = (text: string): number => {
    return text.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
};

const countFileLines = (documentPath: string): number => {
    try {
        const document = fs.readFileSync(documentPath, 'utf8');
        return countTextLines(document);
    } catch {
        return 0;
    }
};

const loadGitignore = (workspacePath: string): ignore.Ignore => {
    const ig = ignore();
    const gitignorePath = path.join(workspacePath, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
        const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
        ig.add(gitignoreContent);
    }
    return ig;
};

const getTrackedFiles = async (workspacePath: string, ig: ignore.Ignore) => {
    const filePaths = await vscode.workspace.findFiles('**/*');
    return filePaths
        .filter(
            (filePath) =>
                !ig.ignores(path.relative(workspacePath, filePath.fsPath)),
        )
        .map((filePath) => filePath.fsPath);
};

const createStatusBar = (): StatusBar => {
    const statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        100,
    );
    statusBarItem.tooltip = 'Total non-empty lines in workspace';
    statusBarItem.show();
    return {
        item: statusBarItem,
        update: (total: number) => {
            statusBarItem.text = `Workspace lines: ${total}`;
        },
    };
};

const workspaceState = {
    path: undefined as string | undefined,
    total: 0,
    fileCounts: {} as Record<string, number>,
    ig: ignore(),

    async initialize({
        item: statusBarItem,
        update: updateStatusBar,
    }: StatusBar) {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders) {
            return;
        }
        statusBarItem.text = '$(sync~spin) Counting...';
        this.path = folders[0].uri.fsPath;
        this.ig = loadGitignore(this.path);

        this.total = 0;

        const filePaths = await getTrackedFiles(this.path, this.ig);
        for (const filePath of filePaths) {
            this.fileCounts[filePath] =
                this.fileCounts[filePath] ?? countFileLines(filePath);
            this.total += this.fileCounts[filePath];
        }
        updateStatusBar(this.total);
    },

    handleDocumentSave(docPath: string, statusBar: StatusBar) {
        if (!this.path) {
            return;
        }
        const gitignorePath = path.join(this.path, '.gitignore');
        if (docPath === gitignorePath) {
            this.initialize(statusBar);
        }
    },

    handleDocumentChange(doc: vscode.TextDocument, statusBar: StatusBar) {
        if (!this.path || doc.uri.scheme !== 'file') {
            return;
        }
        const relativePath = path.relative(this.path, doc.uri.fsPath);
        if (this.ig.ignores(relativePath)) {
            return;
        }
        const newCount = countTextLines(doc.getText());

        const filePath = doc.uri.fsPath;
        const oldCount = workspaceState.fileCounts[filePath] || 0;
        this.total += newCount - oldCount;

        this.fileCounts[filePath] = newCount;
        statusBar.update(this.total);
    },
};

export async function activate(context: vscode.ExtensionContext) {
    console.log('Code Line Counter is now active!');
    const statusBar = createStatusBar();

    const printFileLines = vscode.commands.registerCommand(
        'code-line-counter.countFileLines',
        () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage(
                    'There is no open file for analysis',
                );
                return;
            }
            const documentPath = editor.document.fileName;
            vscode.window.showInformationMessage(
                `Non-empty strings in the file: ${countFileLines(documentPath)}`,
            );
        },
    );

    const printWorkspaceLines = vscode.commands.registerCommand(
        'code-line-counter.countWorkspaceLines',
        async () => {
            if (!workspaceState.path) {
                vscode.window.showWarningMessage('No workspace is open');
                return;
            }

            vscode.window.showInformationMessage(
                `Non-empty strings in the workspace: ${workspaceState.total}`,
            );
        },
    );

    await workspaceState.initialize(statusBar);

    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument((e) =>
            workspaceState.handleDocumentChange(e.document, statusBar),
        ),
        vscode.workspace.onDidSaveTextDocument((e) =>
            workspaceState.handleDocumentSave(e.fileName, statusBar),
        ),
        printFileLines,
        printWorkspaceLines,
        statusBar.item,
    );
}

export function deactivate() {}
