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

    context.subscriptions.push(printFileLines);
}

export function deactivate() {}
