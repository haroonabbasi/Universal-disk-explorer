# Universal Disk Explorer

Universal Disk Explorer is a comprehensive tool designed to analyze disk contents, with advanced capabilities for file and video analysis. Built with FastAPI, it provides a powerful and user-friendly interface for scanning, managing, and processing files.

## Features

- **File Scanning**: Recursive directory scanning to retrieve detailed file metadata.
- **Video Analysis**: Extract metadata from videos (e.g., resolution, duration, bitrate) using `ffmpeg`.
- **File Operations**:
  - Delete multiple files.
  - Move files to a target directory.
  - Rename files.
- **API-based Architecture**: Access features through a RESTful API built with FastAPI.

## Requirements

- Python 3.12+
- `ffmpeg` installed and available in the system's PATH.

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/haroonabbasi/universal-disk-explorer.git
   cd universal-disk-explorer

2. Install dependencies using Poetry:
   ```bash
   poetry install
   ```

## Development

3. Activate the virtual environment:
   ```bash
   poetry shell
   ```

4. Run the FastAPI application:
   ```bash
   poetry run uvicorn universal_disk_explorer.main:app --reload
   ```

## libmagic Installation
-  If you're using python-magic for handling file types, libmagic is required on your system. On macOS, you can install it using:

    ```bash
      sudo port install libmagic
    ```





### Testing

Run tests using `pytest`:
```bash
pytest
```

### Code Formatting

- Format code with `black`:
  ```bash
  black .
  ```
- Sort imports with `isort`:
  ```bash
  isort .
  ```

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request with your changes.

## Acknowledgments

- [FastAPI](https://fastapi.tiangolo.com/) for the web framework.
- [ffmpeg-python](https://github.com/kkroening/ffmpeg-python) for video processing.
- [Pillow](https://python-pillow.org/) for image processing.

