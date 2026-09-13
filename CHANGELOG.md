# Change Log

## [0.1.0]

- Renamed to Git Pinned Diff.
- Changes since the pinned ref use VS Code's own change bars, so breakpoints can be set on changed lines again.
- Nothing is highlighted until a ref is pinned.
- Click a change bar to see its diff against the pinned ref, revert it, or jump between changes.
- The Source Control view lists the files changed since the pinned ref; click one to open its diff.
- Pick the ref from a searchable list of branches, remote branches and tags, or type any commit or ref.
- Updates while you type, and when the pinned ref moves after a commit, fetch or rebase.
- Works across multi-root workspaces, nested repositories and worktrees.
- Refs are checked through the Git extension and can't be passed to git as options.
- Rewritten in TypeScript.

## [0.0.1]

- Initial release: pin a commit, branch or tag and highlight changes against it in the gutter.
