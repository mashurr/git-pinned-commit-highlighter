import * as vscode from 'vscode';
import { execSync } from 'child_process';

interface Decorations {
    modified: vscode.TextEditorDecorationType;
    added: vscode.TextEditorDecorationType;
    removed: vscode.TextEditorDecorationType;
}

interface DiffLines {
    modified: number[];
    added: number[];
    removed: number[];
}

let pinnedCommitSha: string | null = null;
let statusBarItem: vscode.StatusBarItem | undefined;
let decorations: Decorations | undefined;

/**
 * Gets git diff for a file compared to HEAD or pinned reference
 */
function getGitDiff(filePath: string): string {
    try {
        const compareTarget = pinnedCommitSha || 'HEAD';
        const diff = execSync(`git diff -U0 ${compareTarget} -- "${filePath}"`, {
            cwd: vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath,
            encoding: 'utf8'
        });
        return diff;
    } catch (error) {
        console.error('Git diff error:', (error as Error).message);
        return '';
    }
}

/**
 * Parses git diff output to extract line numbers
 */
function parseDiff(diff: string): DiffLines {
    const modified: number[] = [];
    const added: number[] = [];
    const removed: number[] = [];

    const regex = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(diff)) !== null) {
        const oldCount = match[2] ? parseInt(match[2], 10) : 1;
        const newStart = parseInt(match[3], 10);
        const newCount = match[4] ? parseInt(match[4], 10) : 1;

        if (oldCount > 0 && newCount > 0) {
            // Modified lines
            for (let i = newStart; i < newStart + newCount; i++) {
                modified.push(i - 1); // VS Code uses 0-based indexing
            }
        } else if (newCount > 0) {
            // Added lines
            for (let i = newStart; i < newStart + newCount; i++) {
                added.push(i - 1);
            }
        } else if (oldCount > 0) {
            // Removed lines - add a red underscore at the deletion point
            removed.push(Math.max(0, newStart - 1));
        }
    }

    return { modified, added, removed };
}

/**
 * Builds a gutter icon from an SVG
 */
function gutterIcon(svg: string): vscode.Uri {
    return vscode.Uri.parse('data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64'));
}

/**
 * Creates decoration types if they don't exist
 */
function getDecorations(): Decorations {
    decorations ??= {
        modified: vscode.window.createTextEditorDecorationType({
            overviewRulerColor: 'rgba(255, 200, 0, 0.8)',
            overviewRulerLane: vscode.OverviewRulerLane.Left,
            gutterIconPath: gutterIcon(`<svg width="16" height="16" xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="0" width="5" height="16" fill="#FFC83D"/>
        </svg>`),
            gutterIconSize: 'contain'
        }),
        added: vscode.window.createTextEditorDecorationType({
            overviewRulerColor: 'rgba(0, 200, 0, 0.8)',
            overviewRulerLane: vscode.OverviewRulerLane.Left,
            gutterIconPath: gutterIcon(`<svg width="16" height="16" xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="0" width="5" height="16" fill="#4CAF50"/>
        </svg>`),
            gutterIconSize: 'contain'
        }),
        removed: vscode.window.createTextEditorDecorationType({
            overviewRulerColor: 'rgba(200, 0, 0, 0.8)',
            overviewRulerLane: vscode.OverviewRulerLane.Left,
            gutterIconPath: gutterIcon(`<svg width="16" height="16" xmlns="http://www.w3.org/2000/svg">
          <text x="8" y="12" font-family="monospace" font-size="14" font-weight="bold" text-anchor="middle" fill="#F44336">▼</text>
        </svg>`),
            gutterIconSize: 'contain'
        })
    };
    return decorations;
}

/**
 * Highlights differences in the current editor
 */
function highlightDiff(editor: vscode.TextEditor | undefined): void {
    if (!editor || !editor.document) {
        return;
    }

    // Clear existing decorations
    if (decorations) {
        editor.setDecorations(decorations.modified, []);
        editor.setDecorations(decorations.added, []);
        editor.setDecorations(decorations.removed, []);
    }

    const filePath = editor.document.uri.fsPath;
    const diff = getGitDiff(filePath);

    if (!diff) {
        return;
    }

    const { modified, added, removed } = parseDiff(diff);

    const { modified: modifiedDecoration, added: addedDecoration, removed: removedDecoration } = getDecorations();

    const toRange = (line: number): vscode.Range | null => {
        if (line >= 0 && line < editor.document.lineCount) {
            return new vscode.Range(line, 0, line, editor.document.lineAt(line).text.length);
        }
        return null;
    };
    const isRange = (range: vscode.Range | null): range is vscode.Range => range !== null;

    editor.setDecorations(modifiedDecoration, modified.map(toRange).filter(isRange));
    editor.setDecorations(addedDecoration, added.map(toRange).filter(isRange));
    editor.setDecorations(removedDecoration, removed.map(toRange).filter(isRange));
}

/**
 * Creates or updates the status bar item
 */
function updateStatusBar(): void {
    if (!statusBarItem) {
        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        statusBarItem.command = 'pinned-commit-highlighter.togglePinnedCommit';
        statusBarItem.show();
    }

    if (pinnedCommitSha) {
        const displayRef = pinnedCommitSha.length > 10 ? pinnedCommitSha.substring(0, 7) : pinnedCommitSha;
        statusBarItem.text = `📌 ${displayRef}`;
        statusBarItem.tooltip = `Pinned reference: ${pinnedCommitSha}. Click to change or clear.`;
    } else {
        statusBarItem.text = `📌 Pin Reference`;
        statusBarItem.tooltip = `Click to pin a commit SHA, branch, or remote reference for highlighting changes`;
    }
}

/**
 * Command: Toggle pinned reference
 */
async function togglePinnedCommit(): Promise<void> {
    if (pinnedCommitSha) {
        const displayRef = pinnedCommitSha.length > 10 ? pinnedCommitSha.substring(0, 7) + '...' : pinnedCommitSha;
        const choice = await vscode.window.showQuickPick(
            ['Change pinned reference', 'Clear pinned reference'],
            {
                placeHolder: `Current pinned reference: ${displayRef}`
            }
        );

        if (choice === 'Clear pinned reference') {
            pinnedCommitSha = null;
            vscode.window.showInformationMessage('Pinned reference cleared. Now comparing against HEAD.');
        } else if (choice === 'Change pinned reference') {
            const newRef = await vscode.window.showInputBox({
                prompt: 'Enter git reference to pin',
                placeHolder: 'e.g., main, origin/develop, a1b2c3d, HEAD~2',
                value: pinnedCommitSha
            });

            if (newRef && newRef.trim()) {
                const trimmedRef = newRef.trim();
                // Validate the reference
                try {
                    execSync(`git rev-parse --verify ${trimmedRef}`, {
                        cwd: vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath,
                        encoding: 'utf8'
                    });
                    pinnedCommitSha = trimmedRef;
                    const displayRef = trimmedRef.length > 10 ? trimmedRef.substring(0, 7) + '...' : trimmedRef;
                    vscode.window.showInformationMessage(`Pinned reference updated to: ${displayRef}`);
                } catch {
                    vscode.window.showErrorMessage(`Invalid git reference: ${trimmedRef}`);
                }
            }
        }
    } else {
        const newRef = await vscode.window.showInputBox({
            prompt: 'Enter git reference to pin',
            placeHolder: 'e.g., main, origin/develop, a1b2c3d, HEAD~2'
        });

        if (newRef && newRef.trim()) {
            const trimmedRef = newRef.trim();
            // Validate the reference
            try {
                execSync(`git rev-parse --verify ${trimmedRef}`, {
                    cwd: vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath,
                    encoding: 'utf8'
                });
                pinnedCommitSha = trimmedRef;
                const displayRef = trimmedRef.length > 10 ? trimmedRef.substring(0, 7) + '...' : trimmedRef;
                vscode.window.showInformationMessage(`Reference pinned: ${displayRef}`);
            } catch {
                vscode.window.showErrorMessage(`Invalid git reference: ${trimmedRef}`);
            }
        }
    }

    updateStatusBar();

    // Refresh highlighting for current editor
    if (vscode.window.activeTextEditor) {
        highlightDiff(vscode.window.activeTextEditor);
    }
}

/**
 * Activate extension
 */
export function activate(context: vscode.ExtensionContext): void {
    // Register command
    const toggleCmd = vscode.commands.registerCommand(
        'pinned-commit-highlighter.togglePinnedCommit',
        togglePinnedCommit
    );
    context.subscriptions.push(toggleCmd);

    // Set up event listeners
    const onEditorChange = vscode.window.onDidChangeActiveTextEditor((editor) => {
        highlightDiff(editor);
    });

    const onDocumentSave = vscode.workspace.onDidSaveTextDocument(() => {
        highlightDiff(vscode.window.activeTextEditor);
    });

    context.subscriptions.push(onEditorChange, onDocumentSave);

    // Initialize status bar
    updateStatusBar();

    // Highlight current editor if available
    if (vscode.window.activeTextEditor) {
        highlightDiff(vscode.window.activeTextEditor);
    }
}

/**
 * Deactivate extension
 */
export function deactivate(): void {
    statusBarItem?.dispose();
    if (decorations) {
        decorations.modified.dispose();
        decorations.added.dispose();
        decorations.removed.dispose();
    }
}
