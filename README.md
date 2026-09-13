# Git Pinned Diff

Pin any branch, tag or commit and see everything that changed since it, right in your editor: change bars in the gutter, a list of changed files, and diffs one click away.

![Git Pinned Diff in action: pinning a tag, change bars in the gutter, the changed files list, and a diff](images/demo.gif)

## Features

- **Pin from the status bar**: click `📌 Pin Reference` to search branches, remote branches, tags and recent commits, or type any commit or ref such as `a1b2c3d` or `HEAD~2`.
- **Quick in big repositories**: the picker lists the five most recent of each until you type, then searches branch and tag names and commit hashes.
- **Native change bars**: changes since the pinned ref show in the gutter like Git's own, so breakpoints still work on every line.
- **Click a change bar** to see its diff against the pinned ref, revert it, or jump to the next change.
- **Changed files list**: the Source Control view lists every file changed since the ref; click one to open its diff.
- **Follows along**: updates while you type, and when the pinned ref moves after a commit, fetch or rebase.
- **Every repository**: multi-root workspaces, nested repositories and worktrees are each compared with their own copy of the ref.
- **Submodules**: each submodule is compared with the commit its parent recorded at the pinned ref, including submodules of submodules.
- **Quiet**: nothing is highlighted until you pin a ref.

## Requirements

- VS Code 1.90 or later, with the built-in Git extension enabled.
- A folder inside a Git repository.

## Known Issues

**Note: Git's own change bars and the pinned change bars share the gutter and look the same. A line you edited back to how it was at the pinned ref still shows Git's bar, and clicking a bar may open Git's diff first (switch with the dropdown in the diff peek). In recent VS Code versions you can see only pinned changes by right-clicking a line number, opening **Diff Decorations** and turning off **Git Local Changes (Working Tree)**, as shown below; turn it back on after unpinning. The changed files list in Source Control always shows only pinned changes.**

![Right-clicking a change bar and turning off Git, so only the pinned changes stay in the gutter](images/hide-git-bars.gif)

- The pinned ref resets when the window reloads.
- One pinned ref applies to every repository in the workspace.
- In the gutter, a file renamed since the ref shows as entirely new.
- A branch or tag deleted while pinned keeps showing its last commit until you pin something else.
- Only submodules that VS Code opens are compared: they need to be checked out, and VS Code opens up to 10 per repository by default.

Report issues on [GitHub](https://github.com/mashurr/git-pinned-commit-highlighter/issues).

## Release Notes

See [CHANGELOG.md](CHANGELOG.md).
