// The parts of the built-in Git extension's API that this extension uses
// (see extensions/git/src/api/git.d.ts in the VS Code repository)
import { Event, Uri } from 'vscode';

export interface Commit {
    readonly hash: string;
}

export interface Change {
    readonly uri: Uri;
}

export interface RepositoryState {
    readonly indexChanges: Change[];
}

export interface Repository {
    readonly rootUri: Uri;
    readonly state: RepositoryState;
    getCommit(ref: string): Promise<Commit>;
    getObjectDetails(treeish: string, path: string): Promise<{ mode: string; object: string; size: number }>;
}

export interface API {
    readonly repositories: Repository[];
    readonly onDidOpenRepository: Event<Repository>;
    readonly onDidCloseRepository: Event<Repository>;
    toGitUri(uri: Uri, ref: string): Uri;
    getRepository(uri: Uri): Repository | null;
}

export interface GitExtension {
    readonly enabled: boolean;
    getAPI(version: 1): API;
}
