import * as vscode from 'vscode';
import * as path from 'path';
import { RefType, Status, type API as GitAPI, type Change, type GitExtension, type Repository } from './git';

const PIN_COMMAND = 'pinned-commit-highlighter.togglePinnedCommit';
// Empty documents that files added since the pinned ref are compared against
const EMPTY_SCHEME = 'pinned-commit-empty';

let pinnedRef: string | undefined;
let statusBarItem: vscode.StatusBarItem;
// What is shown for the pinned ref, per repository root
const pinnedDiffs = new Map<string, vscode.Disposable>();

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

/** The file's content at the pinned commit, for VS Code to diff the editor against. */
async function originalResource(git: GitAPI, repository: Repository, commit: string, uri: vscode.Uri): Promise<vscode.Uri | undefined> {
    // Only this repository's files; nested repositories and submodules get their own diff
    if (uri.scheme !== 'file' || git.getRepository(uri)?.rootUri.toString() !== repository.rootUri.toString()) {
        return undefined;
    }
    const relativePath = path.relative(repository.rootUri.fsPath, uri.fsPath).split(path.sep).join('/');
    if (relativePath.startsWith('../') || path.isAbsolute(relativePath) || (await hasPath(repository, commit, relativePath))) {
        return git.toGitUri(uri, commit);
    }
    // Tracked files that didn't exist at the ref are entirely new. Untracked and ignored
    // files are left alone, like in Git's own diff.
    const tracked = (await hasPath(repository, 'HEAD', relativePath))
        || repository.state.indexChanges.some((change) => change.uri.fsPath === uri.fsPath);
    return tracked ? uri.with({ scheme: EMPTY_SCHEME }) : undefined;
}

/** A row in the Source Control view for a file changed since the ref; clicking it opens the diff. */
function changedFile(git: GitAPI, ref: string, commit: string, change: Change): vscode.SourceControlResourceState {
    const uri = change.uri;
    const empty = (file: vscode.Uri) => file.with({ scheme: EMPTY_SCHEME });
    let original = git.toGitUri(uri, commit);
    let modified = uri;
    let label = 'Modified';
    let icon = 'diff-modified';
    let color = 'gitDecoration.modifiedResourceForeground';
    if (change.status === Status.INDEX_ADDED) {
        original = empty(uri);
        [label, icon, color] = ['Added', 'diff-added', 'gitDecoration.addedResourceForeground'];
    } else if (change.status === Status.DELETED) {
        modified = empty(uri);
        [label, icon, color] = ['Deleted', 'diff-removed', 'gitDecoration.deletedResourceForeground'];
    } else if (change.status === Status.INDEX_RENAMED) {
        original = git.toGitUri(change.originalUri, commit);
        [label, icon, color] = [`Renamed from ${path.basename(change.originalUri.fsPath)}`, 'diff-renamed', 'gitDecoration.renamedResourceForeground'];
    }
    return {
        resourceUri: uri,
        decorations: {
            tooltip: `${label} since ${ref}`,
            strikeThrough: change.status === Status.DELETED,
            iconPath: new vscode.ThemeIcon(icon, new vscode.ThemeColor(color)),
        },
        command: {
            command: 'vscode.diff',
            title: 'Open Changes',
            arguments: [original, modified, `${path.basename(uri.fsPath)} (since ${ref})`],
        },
    };
}

/** Runs a task one at a time; calls made while it runs make it run once more afterwards. */
function serialize(task: () => Promise<void>): () => Promise<void> {
    let running = false;
    let again = false;
    return async () => {
        if (running) {
            again = true;
            return;
        }
        running = true;
        try {
            do {
                again = false;
                await task();
            } while (again);
        } finally {
            running = false;
        }
    };
}

/**
 * Shows one repository's changes since the pinned ref: VS Code's quick diff in the gutter, drawn like
 * Git's own changes so it never takes the breakpoint column, and a "Changes since" list in Source Control.
 * Both are tied to the commit the ref points at, and rebuilt when the ref moves to another commit.
 */
function showPinnedDiff(git: GitAPI, repository: Repository, ref: string): void {
    const root = repository.rootUri.toString();
    let disposed = false;
    let shown: { commit: string; sourceControl: vscode.SourceControl; changes: vscode.SourceControlResourceGroup } | undefined;

    const update = serialize(async () => {
        const commit = (await repository.getCommit(ref).catch(() => undefined))?.hash;
        // A ref deleted while pinned keeps showing its last commit
        if (disposed || !commit) {
            return;
        }
        if (shown?.commit !== commit) {
            // VS Code only asks for a file's original content again when the quick diff provider changes
            shown?.sourceControl.dispose();
            const sourceControl = vscode.scm.createSourceControl('pinned-commit', `Pinned: ${ref}`, repository.rootUri);
            sourceControl.inputBox.visible = false;
            // Changes since the ref aren't pending commits, so they stay out of the Source Control badge
            sourceControl.count = 0;
            sourceControl.quickDiffProvider = {
                provideOriginalResource: (uri) => originalResource(git, repository, commit, uri),
            };
            shown = { commit, sourceControl, changes: sourceControl.createResourceGroup('changes', `Changes since ${ref}`) };
        }
        const { changes } = shown;
        const files = await repository.diffWith(commit).catch(() => undefined);
        if (files && !disposed) {
            changes.resourceStates = files
                .map((change) => changedFile(git, ref, commit, change))
                .sort((a, b) => a.resourceUri.fsPath.localeCompare(b.resourceUri.fsPath));
        }
    });

    const listeners: vscode.Disposable[] = [repository.state.onDidChange(update)];
    // Git's state doesn't change when only a branch or tag moves (e.g. `git fetch`), so watch the refs too
    refFolders(repository.rootUri).then((folders) => {
        for (const folder of folders) {
            const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, '{HEAD,packed-refs,refs/**}'));
            watcher.onDidChange(update);
            watcher.onDidCreate(update);
            watcher.onDidDelete(update);
            if (disposed) {
                watcher.dispose();
            } else {
                listeners.push(watcher);
            }
        }
    });
    update();

    pinnedDiffs.get(root)?.dispose();
    pinnedDiffs.set(root, {
        dispose: () => {
            disposed = true;
            listeners.forEach((listener) => listener.dispose());
            shown?.sourceControl.dispose();
        },
    });
}

/** Folders holding a repository's refs: its git folder and, for worktrees, the shared one with branches and tags. */
async function refFolders(root: vscode.Uri): Promise<vscode.Uri[]> {
    const read = async (uri: vscode.Uri) => Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8').trim();
    const dotGit = vscode.Uri.joinPath(root, '.git');
    try {
        // Worktrees and submodules have a .git file pointing at their git folder
        const gitDir = (await vscode.workspace.fs.stat(dotGit)).type === vscode.FileType.File
            ? vscode.Uri.file(path.resolve(root.fsPath, (await read(dotGit)).replace(/^gitdir:\s*/, '')))
            : dotGit;
        const commonDir = await read(vscode.Uri.joinPath(gitDir, 'commondir')).then(
            (dir) => vscode.Uri.file(path.resolve(gitDir.fsPath, dir)),
            () => undefined,
        );
        return commonDir ? [gitDir, commonDir] : [gitDir];
    } catch {
        return [];
    }
}

function clearPinnedDiffs(): void {
    for (const pinnedDiff of pinnedDiffs.values()) {
        pinnedDiff.dispose();
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
        statusBarItem.tooltip = `Click to pin a branch, tag or commit and see the changes since it`;
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

/** An entry in the ref picker: a ref to pin, or the clear action. */
interface RefItem extends vscode.QuickPickItem {
    ref?: string;
    clear?: boolean;
}

/** Branches, remote branches and tags from every open repository, most recent first, under separators. */
async function refItems(git: GitAPI): Promise<RefItem[]> {
    const refs = (await Promise.all(git.repositories.map((r) => r.getRefs({ sort: 'committerdate' }).catch(() => [])))).flat();
    const sections: [type: RefType, title: string, icon: string][] = [
        [RefType.Head, 'Branches', 'git-branch'],
        [RefType.RemoteHead, 'Remote branches', 'cloud'],
        [RefType.Tag, 'Tags', 'tag'],
    ];
    const items: RefItem[] = [];
    for (const [type, title, icon] of sections) {
        const commits = new Map<string, string | undefined>();
        for (const ref of refs) {
            // A remote's HEAD only points at one of its branches
            if (ref.type === type && ref.name && !ref.name.endsWith('/HEAD') && !commits.has(ref.name)) {
                commits.set(ref.name, ref.commit);
            }
        }
        if (commits.size > 0) {
            items.push({ label: title, kind: vscode.QuickPickItemKind.Separator });
            for (const [name, commit] of commits) {
                items.push({ label: `$(${icon}) ${name}`, description: commit?.substring(0, 7), ref: name });
            }
        }
    }
    return items;
}

/** Lets the user search branches and tags, type any other ref or commit, or clear the pin. */
async function pickRef(git: GitAPI): Promise<void> {
    const quickPick = vscode.window.createQuickPick<RefItem>();
    quickPick.placeholder = pinnedRef
        ? `Pinned: ${pinnedRef}. Pick a branch or tag, or type any commit or ref`
        : 'Pick a branch or tag, or type any commit or ref (e.g. a1b2c3d, HEAD~2)';
    const clear: RefItem[] = pinnedRef ? [{ label: '$(close) Clear pinned reference', clear: true }] : [];
    let refs: RefItem[] = [];
    const render = () => {
        const value = quickPick.value.trim();
        // Commits aren't listed, so whatever is typed can be pinned as is. The label doesn't start with
        // the typed text, so branches and tags that do start with it are ranked first.
        const typed: RefItem[] = value && !refs.some((item) => item.ref === value)
            ? [{ label: `$(git-commit) Pin "${value}"`, description: 'commit or ref', ref: value, alwaysShow: true }]
            : [];
        quickPick.items = [...typed, ...clear, ...refs];
    };
    const picked = new Promise<RefItem | undefined>((resolve) => {
        quickPick.onDidAccept(() => resolve(quickPick.selectedItems[0]));
        quickPick.onDidHide(() => resolve(undefined));
    });
    quickPick.onDidChangeValue(render);
    quickPick.busy = true;
    render();
    quickPick.show();
    refItems(git).then((items) => {
        refs = items;
        quickPick.busy = false;
        render();
    });

    const item = await picked;
    quickPick.dispose();
    if (item?.clear) {
        unpin();
    } else if (item?.ref) {
        await pin(git, item.ref);
    }
}

async function choosePinnedRef(): Promise<void> {
    const git = await getGitAPI();
    if (!git) {
        vscode.window.showErrorMessage('The built-in Git extension is disabled.');
        return;
    }
    if (git.repositories.length === 0) {
        vscode.window.showErrorMessage('Open a folder inside a Git repository to pin a reference.');
        return;
    }
    await pickRef(git);
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = PIN_COMMAND;
    updateStatusBar();
    statusBarItem.show();

    context.subscriptions.push(
        statusBarItem,
        vscode.commands.registerCommand(PIN_COMMAND, choosePinnedRef),
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
