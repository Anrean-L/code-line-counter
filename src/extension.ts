import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import ignore from 'ignore';

/**
 * Represents a wrapper around VS Code StatusBarItem,
 * providing both the created status bar element and
 * a function to update its text;
 */
export type StatusBar = {
    item: vscode.StatusBarItem;
    update: (total: number) => void;
};

/**
 * Counts the number of non-empty lines in the given text.
 * @param text - The text as a string.
 * @returns Count of non-empty lines.
 */
export const countTextLines = (text: string): number => {
    return text.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
};

/**
 * Counts the number of non-empty lines in the given file.
 * @param documentPath - The path of the file.
 * @returns Count of non-empty lines in file or 0 in case of error.
 */
export const countFileLines = (documentPath: string): number => {
    try {
        const document = fs.readFileSync(documentPath, 'utf8');
        return countTextLines(document);
    } catch {
        return 0;
    }
};

/**
 * Loads `.gitignore` rules from the workspace.
 * If the `.gitignore` doesn't exist, returns an empty `ignore.Ignore` instance.
 * @param workspacePath - Absolute path of the workspace directory.
 * @returns An `ignore.Ignore` instance configured with `.gitignore` rules
 */
export const loadGitignore = (workspacePath: string): ignore.Ignore => {
    const ig = ignore();
    const gitignorePath = path.join(workspacePath, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
        const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
        ig.add(gitignoreContent);
    }
    return ig;
};

/**
 * Gets files from directory and filters by gitignore.
 * @param workspacePath - Absolute path of the workspace directory.
 * @param ig - A configured `ignore.Ignore` object.
 * @returns An array of tracked workspace files.
 */
export const getTrackedFiles = async (
    workspacePath: string,
    ig: ignore.Ignore,
) => {
    const filePaths = await vscode.workspace.findFiles('**/*');
    return filePaths
        .filter(
            (filePath) =>
                !ig.ignores(path.relative(workspacePath, filePath.fsPath)),
        )
        .map((filePath) => filePath.fsPath);
};

/**
 * Creates status bar item and function to set text value of it.
 * @returns StatusBar object that contains created status bar item and function to update it.
 */
export const createStatusBar = (): StatusBar => {
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

/**
 * Global state manager for the workspace.
 * Tracks the workspace path, total number of non-empty lines, individual file counts,
 * gitignore rules. Provides methods to initialize workspace, handle document changes
 * and handle savings in the `.gitignore` file.
 */
export const workspaceState = {
    /** Current workspace directory absolute path or undefined if no workspace is open */
    path: undefined as string | undefined,
    /** Total number of non-empty lines in all tracked files in the workspace */
    total: 0,
    /** A mapping from file paths to the number of non-empty lines in that file */
    fileCounts: {} as Record<string, number>,
    /** Ignore rules from the `.gitignore` file */
    ig: ignore(),

    /**
     * Initializes the workspace state.
     * Loads `.gitignore`, counts lines in all tracked files, updates the status bar.
     * @param StatusBar - The status bar object used to display total lines.
     */
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

    /**
     * Handles saving a file. If the `.gitignore` file is saved,
     * reinitializes the workspace state.
     * @param docPath - The absolute path of the saved document.
     * @param statusBar - The status bar object to update the display.
     */
    handleDocumentSave(docPath: string, statusBar: StatusBar) {
        if (!this.path) {
            return;
        }
        const gitignorePath = path.join(this.path, '.gitignore');
        if (docPath === gitignorePath) {
            this.initialize(statusBar);
        }
    },

    /**
     * Handles changes to a text document. Updates the file lines count and
     * total workspace lines count if the document is not ignored.
     * @param doc - The changed file.
     * @param statusBar - The status bar object to update the display.
     */
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

/**
 * Counts the number of non-empty lines in the current file and displays
 * it as a VS Code information message.
 */
export const countFileLinesCommand = () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('There is no open file for analysis');
        return;
    }
    const documentPath = editor.document.fileName;
    vscode.window.showInformationMessage(
        `Non-empty lines in the file: ${countFileLines(documentPath)}`,
    );
};

/**
 * Counts the number of non-empty lines in the current workspace directory
 * and displays it as a VS Code information message.
 */
export const countWorkspaceLinesCommand = async () => {
    if (!workspaceState.path) {
        vscode.window.showWarningMessage('No workspace is open');
        return;
    }

    vscode.window.showInformationMessage(
        `Non-empty lines in the workspace: ${workspaceState.total}`,
    );
};

/**
 * Entry point of the VS Code extension.
 * Registers commands, initializes workspace tracking,
 * and subscribes to file change events.
 */
export async function activate(context: vscode.ExtensionContext) {
    console.log('Code Line Counter is now active!');
    const statusBar = createStatusBar();

    const printFileLines = vscode.commands.registerCommand(
        'code-line-counter.countFileLines',
        countFileLinesCommand,
    );

    const printWorkspaceLines = vscode.commands.registerCommand(
        'code-line-counter.countWorkspaceLines',
        countWorkspaceLinesCommand,
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

/**
 * Deactivates the extension.
 *
 * VS Code automatically disposes of all resources registered through
 * `context.subscriptions`, including event listeners, status bar items,
 * and commands. No manual cleanup is needed.
 */
export function deactivate() {}
