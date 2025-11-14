# Code Line Counter

Code Line Counter is a Visual Studio Code extension that counts the number of non-empty lines in the current file and across the entire workspace.
It supports .gitignore rules, real-time updates, and displays total workspace statistics in the status bar.

## Features

### Count non-empty lines in the current file

Run the command (Ctrl+Shift+P):
`Code Line Counter: Count File Lines`
to display the number of non-empty lines in the active editor.

### Count total non-empty lines in the workspace

Run:
`Code Line Counter: Count Workspace Lines`
to compute the total line count of all tracked files in the workspace
(excluding files ignored by .gitignore).

### Real-time status bar updates

The extension shows:
`Workspace lines: <number>`
in the VS Code status bar and updates the value whenever you edit or save files.

### .gitignore support

The extension:

- automatically reads the workspace’s .gitignore.
- excludes ignored files from both manual and automatic counting.
- automatically recalculates totals when .gitignore is changed.

## Installation

### Local installation

1. Clone the repository.
2. Build the vsix package:
    `pnpm package::vsix`
    this will generate a file
    `code-line-counter-[version].vsix`
3. Open VS Code -> Ctrl+Shift+P -> select `Extensions: Install from VSIX...`
4. Choose the generated `.vsix` package.

Alternatively, you may download a prebuild VSIX package from the Realises page and perform steps 3-4.

### Development

1. Clone the repository.
2. Install dependencies:
    `pnpm install`
3. Build and run the extension using the VS Code debugger (F5).

## Commands

| Command ID | Description |
| ---------- | ----------- |
| `code-line-counter.countFileLines` | Show non-empty line count for the active file |
|`code-line-counter.countWorkspaceLines` | Show total workspace line count |

## How It Works

The extension:

- searches workspace files using `vscode.workspace.findFiles`;
- filters them using the ignore package with .gitignore rules;
- tracks per-file line counts using an internal state object;
- updates totals efficiently by recalculating only the changed file;
- displays results via the VS Code StatusBar API.

## Project Structure

```text
src/
 └── extension.ts       # Main extension entry point
 ```

## Documentation

Documentation is generated using TypeDoc.

Generate docs:
`pnpm run docs`

Output will appear in the docs/ directory.
