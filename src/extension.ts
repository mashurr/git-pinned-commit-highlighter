import * as vscode from 'vscode';
import * as path from 'path';
import type { API as GitAPI, GitExtension, Repository } from './git';

const TOGGLE_COMMAND = 'pinned-commit-highlighter.togglePinnedCommit';
const REF_PLACEHOLDER = 'e.g., main, origin/develop, a1b2c3d, HEAD~2';
// Empty documents that files added since the pinned ref are compared against
const EMPTY_SCHEME = 'pinned-commit-empty';

let pinnedRef: string | undefined;
let statusBarItem: vscode.StatusBarItem;
// One source control per repository root. VS Code draws each one's quick diff in the
// gutter the same way as Git's own changes, so it never takes the breakpoint column.
const pinnedDiffs = new Map<string, vscode.SourceControl>();

/** The built-in Git extension's API, or undefined when it is disabled. */
async function getGitAPI(): Promise<GitAPI | undefined> {
    const extension = vscode.extensions.getExtension<GitExtension>('vscode.git');
    if (!extension) {
        return undefined;
    }
    const git = extension.isActive ? extension.exports : await extension.activate();
    return git.enabled ? git.getAPI(1) : undefined;
}

async function hasRef(repository: Repository, ref: string): Promise<boolean> {
    try {
        await repository.getCommit(ref);
        return true;
    } catch {
        return false;
    }
}

/** Whether a path, relative to the repository root, exists at a ref. */
async function hasPath(repository: Repository, ref: string, relativePath: string): Promise<boolean> {
    try {
        await repository.getObjectDetails(ref, relativePath);
        return true;
    } catch {
        return false;
    }
}

/** The file's content at the pinned ref, for VS Code to diff the editor against. */
async function originalResource(git: GitAPI, repository: Repository, ref: string, uri: vscode.Uri): Promise<vscode.Uri | undefined> {
    // Only this repository's files; nested repositories and submodules get their own diff
    if (uri.scheme !== 'file' || git.getRepository(uri)?.rootUri.toString() !== repository.rootUri.toString()) {
        return undefined;
    }
    const relativePath = path.relative(repository.rootUri.fsPath, uri.fsPath).split(path.sep).join('/');
    if (relativePath.startsWith('../') || path.isAbsolute(relativePath) || (await hasPath(repository, ref, relativePath))) {
        return git.toGitUri(uri, ref);
    }
    // Tracked files that didn't exist at the ref are entirely new. Untracked and ignored
    // files are left alone, like in Git's own diff.
    const tracked = (await hasPath(repository, 'HEAD', relativePath))
        || repository.state.indexChanges.some((change) => change.uri.fsPath === uri.fsPath);
    return tracked ? uri.with({ scheme: EMPTY_SCHEME }) : undefined;
}

function showPinnedDiff(git: GitAPI, repository: Repository, ref: string): void {
    const root = repository.rootUri.toString();
    const sourceControl = vscode.scm.createSourceControl('pinned-commit', `Pinned: ${ref}`, repository.rootUri);
    sourceControl.inputBox.visible = false;
    sourceControl.quickDiffProvider = {
        provideOriginalResource: (uri) => originalResource(git, repository, ref, uri),
    };
    pinnedDiffs.get(root)?.dispose();
    pinnedDiffs.set(root, sourceControl);
}

function clearPinnedDiffs(): void {
    for (const sourceControl of pinnedDiffs.values()) {
        sourceControl.dispose();
    }
    pinnedDiffs.clear();
}

function updateStatusBar(): void {
    if (pinnedRef) {
        const displayRef = pinnedRef.length > 10 ? pinnedRef.substring(0, 7) : pinnedRef;
        statusBarItem.text = `📌 ${displayRef}`;
        statusBarItem.tooltip = `Pinned reference: ${pinnedRef}. Click to change or clear.`;
    } else {
        statusBarItem.text = `📌 Pin Reference`;
        statusBarItem.tooltip = `Click to pin a commit SHA, branch, or remote reference for highlighting changes`;
    }
}

/** Pins a ref in every open repository that has it. Returns false if none do. */
async function pin(git: GitAPI, ref: string): Promise<boolean> {
    // A ref starting with "-" would be read by git as an option
    const repositories = ref.startsWith('-')
        ? []
        : (await Promise.all(git.repositories.map(async (r) => ((await hasRef(r, ref)) ? r : undefined))))
            .filter((r): r is Repository => r !== undefined);
    if (repositories.length === 0) {
        vscode.window.showErrorMessage(`Invalid git reference: ${ref}`);
        return false;
    }
    clearPinnedDiffs();
    pinnedRef = ref;
    for (const repository of repositories) {
        showPinnedDiff(git, repository, ref);
    }
    updateStatusBar();
    return true;
}

function unpin(): void {
    clearPinnedDiffs();
    pinnedRef = undefined;
    updateStatusBar();
}

async function promptForRef(git: GitAPI, value?: string): Promise<string | undefined> {
    const input = await vscode.window.showInputBox({
        prompt: 'Enter git reference to pin',
        placeHolder: REF_PLACEHOLDER,
        value,
    });
    const ref = input?.trim();
    return ref && (await pin(git, ref)) ? ref : undefined;
}

async function togglePinnedRef(): Promise<void> {
    const git = await getGitAPI();
    if (!git) {
        vscode.window.showErrorMessage('The built-in Git extension is disabled.');
        return;
    }
    if (git.repositories.length === 0) {
        vscode.window.showErrorMessage('Open a folder inside a Git repository to pin a reference.');
        return;
    }

    if (!pinnedRef) {
        const ref = await promptForRef(git);
        if (ref) {
            vscode.window.showInformationMessage(`Reference pinned: ${ref}`);
        }
        return;
    }

    const choice = await vscode.window.showQuickPick(
        ['Change pinned reference', 'Clear pinned reference'],
        { placeHolder: `Current pinned reference: ${pinnedRef}` }
    );
    if (choice === 'Clear pinned reference') {
        unpin();
        vscode.window.showInformationMessage('Pinned reference cleared.');
    } else if (choice === 'Change pinned reference') {
        const ref = await promptForRef(git, pinnedRef);
        if (ref) {
            vscode.window.showInformationMessage(`Pinned reference updated to: ${ref}`);
        }
    }
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = TOGGLE_COMMAND;
    updateStatusBar();
    statusBarItem.show();

    context.subscriptions.push(
        statusBarItem,
        vscode.commands.registerCommand(TOGGLE_COMMAND, togglePinnedRef),
        vscode.workspace.registerTextDocumentContentProvider(EMPTY_SCHEME, { provideTextDocumentContent: () => '' }),
        { dispose: clearPinnedDiffs },
    );

    const git = await getGitAPI();
    if (!git) {
        return;
    }
    context.subscriptions.push(
        // Repositories can open after the ref was pinned, e.g. while VS Code is still scanning the workspace
        git.onDidOpenRepository(async (repository) => {
            const ref = pinnedRef;
            if (ref && !ref.startsWith('-') && (await hasRef(repository, ref)) && pinnedRef === ref) {
                showPinnedDiff(git, repository, ref);
            }
        }),
        git.onDidCloseRepository((repository) => {
            const root = repository.rootUri.toString();
            pinnedDiffs.get(root)?.dispose();
            pinnedDiffs.delete(root);
        }),
    );
}

export function deactivate(): void {}
