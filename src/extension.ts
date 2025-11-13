import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import ignore from 'ignore';

const countFileLines = (documentPath: string): number => {
    try {
        const document = fs.readFileSync(documentPath, 'utf8');
        return document.split(/\r?\n/).filter((line) => line.trim().length > 0)
            .length;
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

export async function activate(context: vscode.ExtensionContext) {
    console.log('Code Line Counter is now active!');
    const statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        100,
    );
    statusBarItem.tooltip = 'Total non-empty lines in workspace';
    statusBarItem.show();

    let workspacePath: string | undefined;
    let workspaceTotal: number;
    let fileCounts: Record<string, number> = {};

    let ig: ignore.Ignore;

    const updateStatusBar = () => {
        statusBarItem.text = `Workspace lines: ${workspaceTotal}`;
    };

    const initializeWorkspace = async () => {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders) {
            return;
        }
        statusBarItem.text = '$(sync~spin) Counting...';
        workspacePath = folders[0].uri.fsPath;
        ig = loadGitignore(workspacePath);

        workspaceTotal = 0;

        const filePaths = await getTrackedFiles(workspacePath, ig);
        for (const filePath of filePaths) {
            fileCounts[filePath] =
                fileCounts[filePath] ?? countFileLines(filePath);
            workspaceTotal += fileCounts[filePath];
        }
        updateStatusBar();
    };

    const handleDocumentChange = (doc: vscode.TextDocument) => {
        if (!workspacePath || doc.uri.scheme !== 'file') {
            return;
        }
        const relativePath = path.relative(workspacePath, doc.uri.fsPath);
        if (ig.ignores(relativePath)) {
            return;
        }
        const newCount = doc
            .getText()
            .split(/\r?\n/)
            .filter((line) => line.trim().length > 0).length;

        const filePath = doc.uri.fsPath;
        const oldCount = fileCounts[filePath] || 0;
        workspaceTotal += newCount - oldCount;

        fileCounts[filePath] = newCount;
        updateStatusBar();
    };

    const handleDocumentSave = (docPath: string) => {
        if (!workspacePath) {
            return;
        }
        const gitignorePath = path.join(workspacePath, '.gitignore');
        if (docPath === gitignorePath) {
            initializeWorkspace();
        }
    };

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
            if (!workspacePath) {
                vscode.window.showWarningMessage('No workspace is open');
                return;
            }

            vscode.window.showInformationMessage(
                `Non-empty strings in the workspace: ${workspaceTotal}`,
            );
        },
    );

    await initializeWorkspace();

    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument((e) =>
            handleDocumentChange(e.document),
        ),
        vscode.workspace.onDidSaveTextDocument((e) =>
            handleDocumentSave(e.fileName),
        ),
        printFileLines,
        printWorkspaceLines,
        statusBarItem,
    );
}

export function deactivate() {}
