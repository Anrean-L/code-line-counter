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

export function activate(context: vscode.ExtensionContext) {
    console.log('Hello👋 Code Line Counter is now active!');

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
            const folders = vscode.workspace.workspaceFolders;
            if (!folders) {
                vscode.window.showWarningMessage('No workspace is open');
                return;
            }
            const workspacePath = folders[0].uri.fsPath;

            const ig = loadGitignore(workspacePath);
            const filePaths = await getTrackedFiles(workspacePath, ig);
            const totalLines = filePaths.reduce(
                (accumulator, filePath) =>
                    accumulator + countFileLines(filePath),
                0,
            );
            vscode.window.showInformationMessage(
                `Non-empty strings in the workspace: ${totalLines}`,
            );
        },
    );

    context.subscriptions.push(printFileLines);
    context.subscriptions.push(printWorkspaceLines);
}

export function deactivate() {}
