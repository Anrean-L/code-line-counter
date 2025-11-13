import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('Hello👋 Code Line Counter is now active!');

    const countFileLines = (document: vscode.TextDocument): number => {
        return document
            .getText()
            .split(/\r?\n/)
            .filter((line) => line.trim().length > 0).length;
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
            const document = editor.document;
            vscode.window.showInformationMessage(
                `Non-empty strings: ${countFileLines(document)}`,
            );
        },
    );

    context.subscriptions.push(printFileLines);
}

export function deactivate() {}
