# Universal Disk Explorer (Frontend)

A powerful desktop application for disk content analysis and file management, built with Tauri, React, and TypeScript.

## Tech Stack

- [Tauri](https://tauri.app/) - Desktop application framework
- [React](https://reactjs.org/) - UI library
- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript
- [Vite](https://vitejs.dev/) - Frontend build tool

## Prerequisites

- [Node.js](https://nodejs.org/) (v16 or later)
- [pnpm](https://pnpm.io/) - Package manager
- [Rust](https://www.rust-lang.org/) - Required for Tauri

### System-specific Requirements

#### Windows
- Microsoft Visual Studio C++ Build Tools
- WebView2

#### macOS
- Xcode Command Line Tools

#### Linux
- `build-essential` package
- `libwebkit2gtk-4.0-dev`
- `libssl-dev`
- `libgtk-3-dev`
- `libayatana-appindicator3-dev`
- `librsvg2-dev`

## Development Setup

1. Install dependencies:
```bash
pnpm install
```

2. Start development server:
```bash
pnpm tauri dev
```

## Building for Production

Create platform-specific builds:
```bash
pnpm tauri build
```

This generates installers in `src-tauri/target/release/bundle`:
- Windows: `.msi` and `.exe`
- macOS: `.dmg` and `.app`
- Linux: `.deb`, `.AppImage`

## Project Structure

```
src/
├── assets/         # Static assets
├── components/     # React components
├── pages/         # Page components
├── styles/        # CSS/SCSS styles
├── types/         # TypeScript types
└── main.tsx       # Application entry point

src-tauri/         # Tauri configuration
```

## Available Commands

```bash
# Start development
pnpm tauri dev

# Build for production
pnpm tauri build

# Format code
pnpm format

# Type checking
pnpm type-check

# Run tests
pnpm test
```

## IDE Setup

Recommended IDE setup:
- [VS Code](https://code.visualstudio.com/)
- [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Features

- Modern React with TypeScript
- Fast refresh in development
- Cross-platform desktop application
- Native system integration via Tauri
- Efficient build process with Vite
