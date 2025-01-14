# Universal Disk Explorer

Universal Disk Explorer is a powerful cross-platform application for disk content analysis, file management, and video analysis. The project is divided into two main components: a **back-end application** built with FastAPI and a **front-end application** using Tauri, React, and TypeScript.

## Overview

- **Back-End**: Provides the core functionality through a RESTful API, enabling advanced file scanning, video metadata extraction, and batch file operations.  
  - Technologies: Python (FastAPI), `ffmpeg`
  - More details: [Back-End README](./back-end/README.md)

- **Front-End**: Offers an intuitive and responsive desktop interface for interacting with the back-end services.
  - Technologies: Tauri, React, TypeScript, Vite
  - More details: [Front-End README](./front-end/README.md)

## Features

### Core Features
- Comprehensive **disk scanning** to retrieve detailed file metadata.
- **Video analysis** for resolution, duration, bitrate, and codec information.
- File management capabilities, including:
  - Deleting multiple files.
  - Moving files to specific directories.
  - Renaming files.
  
### Modular Architecture
- The back-end exposes APIs to support file and video management.
- The front-end provides a desktop user experience, leveraging the back-end for heavy processing.

## Installation and Setup

### Back-End
Refer to the [Back-End README](./back-end/README.md) for installation, API usage, and development setup.

### Front-End
Refer to the [Front-End README](./front-end/README.md) for development environment setup and front-end specific configurations.

## Development Workflow

1. Clone the repository:
   ```bash
   git clone https://github.com/haroonabbasi/universal-disk-explorer.git
   cd universal-disk-explorer


##  License
This project is licensed under the MIT License. See the LICENSE file for details.