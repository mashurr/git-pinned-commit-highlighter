// The parts of the built-in Git extension's API that this extension uses
// (see extensions/git/src/api/git.d.ts in the VS Code repository)
import { Event, Uri } from 'vscode';

export interface Commit {
    readonly hash: string;
    readonly message: string;
    readonly authorDate?: Date;
    readonly commitDate?: Date;
}

export interface LogOptions {
    readonly maxEntries?: number;
}

export const enum RefType {
    Head,
    RemoteHead,
    Tag,
}

export interface Ref {
    readonly type: RefType;
    readonly name?: string;
    readonly commit?: string;
}

export interface RefQuery {
    readonly sort?: 'alphabetically' | 'committerdate';
}

export const enum Status {
    INDEX_MODIFIED,
    INDEX_ADDED,
    INDEX_DELETED,
    INDEX_RENAMED,
    INDEX_COPIED,

    MODIFIED,
    DELETED,
}

export interface Change {
    readonly uri: Uri;
    readonly originalUri: Uri;
    readonly status: Status;
}

export interface Submodule {
    readonly path: string;
}

export interface RepositoryState {
    readonly indexChanges: Change[];
    readonly submodules: Submodule[];
    readonly onDidChange: Event<void>;
}

export interface Repository {
    readonly rootUri: Uri;
    readonly state: RepositoryState;
    getCommit(ref: string): Promise<Commit>;
    getObjectDetails(treeish: string, path: string): Promise<{ mode: string; object: string; size: number }>;
    diffWith(ref: string): Promise<Change[]>;
    getRefs(query: RefQuery): Promise<Ref[]>;
    log(options?: LogOptions): Promise<Commit[]>;
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
