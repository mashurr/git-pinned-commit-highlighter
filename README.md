# Git Pinned Diff

Pin any branch, tag or commit and see everything that changed since it, right in your editor: change bars in the gutter, a list of changed files, and diffs one click away.

![Git Pinned Diff in action: pinning a branch, change bars in the gutter, the changed files list, and a diff](images/demo.gif)

## Features

- **Pin from the status bar**: click `📌 Pin Reference` to search branches, remote branches and tags, or type any commit or ref such as `a1b2c3d` or `HEAD~2`.
- **Native change bars**: changes since the pinned ref show in the gutter like Git's own, so breakpoints still work on every line.
- **Click a change bar** to see its diff against the pinned ref, revert it, or jump to the next change.
- **Changed files list**: the Source Control view lists every file changed since the ref; click one to open its diff.
- **Follows along**: updates while you type, and when the pinned ref moves after a commit, fetch or rebase.
- **Every repository**: multi-root workspaces, nested repositories and worktrees are each compared with their own copy of the ref.
- **Quiet**: nothing is highlighted until you pin a ref.

## Requirements

- VS Code 1.90 or later, with the built-in Git extension enabled.
- A folder inside a Git repository.

## Known Issues

- The pinned ref resets when the window reloads.
- In the gutter, a file renamed since the ref shows as entirely new.

Report issues on [GitHub](https://github.com/mashurr/git-pinned-commit-highlighter/issues).

## Release Notes

See [CHANGELOG.md](CHANGELOG.md).
