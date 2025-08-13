# Git Pinned Commit Highlighter

[![Visual Studio Marketplace](https://img.shields.io/badge/VS%20Code-Extension-blue)](https://marketplace.visualstudio.com/items?itemName=mashurr.git-pinned-commit-highlighter)
[![GitHub](https://img.shields.io/badge/GitHub-Repository-green)](https://github.com/mashurr/git-pinned-commit-highlighter)

**The ultimate VS Code extension for visual git diff comparison!** Pin any commit, branch, or reference and instantly see what's changed in your files with elegant gutter indicators.

## 🚀 Why You Need This Extension

Ever wished you could easily compare your current work against a specific commit or branch? Tired of switching between terminal and editor to see git diffs? This extension transforms your VS Code editor into a powerful visual diff tool that highlights changes right in the gutter - just like VS Code's native git integration, but for ANY reference you choose!

## ✨ Key Features

### 📌 **Flexible Reference Pinning**
- Pin **any git reference**: commits, branches, remote branches, tags
- Smart validation ensures your reference exists
- One-click toggle from the status bar
- Support for relative references (`HEAD~2`, `main~5`)

### 🎨 **Visual Change Indicators**
- **🟡 Yellow bars** for modified lines
- **🟢 Green bars** for added lines  
- **🔻 Red down arrows** for deleted content
- Clean, VSCode-native styling that doesn't interfere with your code

### ⚡ **Real-time Updates**
- Automatic highlighting when switching files
- Instant refresh on file save
- Seamless integration with your workflow

### 🎯 **Smart Comparison**
- Compare against `HEAD` by default
- Switch to any pinned reference instantly
- Perfect for feature branch development, code reviews, and refactoring

## 🎬 See It In Action

![Feature Demo](images/demo.gif)

*Pin a commit and see your changes highlighted instantly*

## 🛠 How It Works

1. **Click the pin icon** (📌) in your status bar (bottom right)
2. **Enter any git reference** - branch name, commit SHA, or remote branch
3. **Watch the magic happen** - your file changes are highlighted immediately!

### Example References You Can Pin:
```bash
main                    # Branch name
origin/develop         # Remote branch
a1b2c3d                # Commit SHA (short or full)
HEAD~5                 # Relative reference
v1.0.0                 # Tag
upstream/master        # Upstream branch
```

## 🎯 Perfect Use Cases

### 🔍 **Code Reviews**
Pin the base branch and see exactly what changed in your feature branch

### 🚧 **Feature Development**  
Compare your work-in-progress against the original starting point

### 🔄 **Refactoring**
Keep track of modifications while restructuring code

### 🐛 **Bug Investigation**
Compare current state with known good commits

### 📊 **Release Preparation**
Review all changes since the last release tag

## 🚀 Getting Started

1. Install the extension from the VS Code Marketplace
2. Open any git repository in VS Code
3. Click the 📌 icon in the bottom-right status bar
4. Enter a git reference to pin (e.g., `main`, `origin/develop`)
5. Start coding and see your changes highlighted!

## ⚙️ Requirements

- **Git repository**: Your project must be a git repository
- **VS Code 1.90.0+**: Latest VS Code for the best experience
- **Git CLI**: Must be available in your system PATH

## 🎛️ Commands

| Command | Description |
|---------|-------------|
| `Toggle Pinned Commit` | Pin a git reference for comparison |
| `Change/Clear` | Modify or remove the current pinned reference |

Access via:
- Status bar click (📌 icon)
- Command Palette: `Toggle Pinned Commit`

## 🔧 Extension Settings

This extension works out of the box with no configuration required! The pinned reference is maintained per workspace session.

## ⚠️ Known Issues

- Gutter icons may not appear in some VS Code themes (working on universal compatibility)
- Large repositories might experience slight delays when switching references
- Binary files are not highlighted (git limitation)
- Down arrow indicators for deletions appear in gutter area

## 🔄 Release Notes

### 1.0.0 - Initial Release
- ✅ Pin any git reference (commits, branches, remotes)
- ✅ Visual gutter indicators for all change types
- ✅ Real-time file highlighting
- ✅ Status bar integration
- ✅ Reference validation

### Future Plans
- 🔮 Multi-reference comparison
- 🔮 Customizable colors and indicators
- 🔮 File-level change statistics
- 🔮 Integration with git timeline

## 🤝 Contributing

Found a bug or have a feature request? We'd love to hear from you!

- 🐛 [Report Issues](https://github.com/mashurr/git-pinned-commit-highlighter/issues)
- 💡 [Request Features](https://github.com/mashurr/git-pinned-commit-highlighter/issues)
- 🔧 [Contribute Code](https://github.com/mashurr/git-pinned-commit-highlighter/pulls)

## 📄 License

MIT License - feel free to use this extension in your projects!

## ⭐ Love This Extension?

If this extension saves you time and makes your development workflow smoother, consider:
- ⭐ **Rating it** on the VS Code Marketplace
- 🐦 **Sharing it** with your developer friends
- 💝 **Contributing** to make it even better

---

**Happy coding!** 🚀

*Transform your git workflow with visual diff highlighting - pin any reference and code with confidence.*