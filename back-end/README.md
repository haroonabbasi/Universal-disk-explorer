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
- libmagic (for file type detection)

## Documentation

- [Poetry Setup and Commands](docs/poetry_guide.md) - Comprehensive guide for Poetry package management

- API Documentation
   - Swagger UI: http://localhost:8000/docs
   - ReDoc: http://localhost:8000/redoc

## Quick Start

1. Clone the repository:
   ```bash
   git clone https://github.com/haroonabbasi/universal-disk-explorer.git
   cd universal-disk-explorer
   ```

2. Install dependencies:
   ```bash
   poetry install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env file with your configurations
   ```

4. Run the FastAPI application:
   ```bash
   poetry run uvicorn universal_disk_explorer.main:app --reload
   ```


## Project Structure

```
back-end/
├── universal_disk_explorer/
│   ├── api/            # API routes
│   ├── core/           # Core functionality
│   ├── models/         # Pydantic models
│   ├── services/       # Business logic
│   ├── utils/          # Utility functions
│   └── tests/          # Test cases
├── docs/               # Documentation
├── .env.example        # Example environment variables
├── pyproject.toml      # Project dependencies and metadata
└── README.md          # Project documentation
```

## Local Development

1. Activate the virtual environment:
   ```bash
   poetry shell
   ```

2. Install development dependencies:
   ```bash
   poetry install --with dev
   ```

3. Set up pre-commit hooks:
   ```bash
   pre-commit install
   ```

### Testing

Run tests with pytest:
```bash
pytest
pytest --cov=app tests/  # With coverage report
```

### Code Quality

```bash
# Format code
black .

# Sort imports
isort .

# Run linting
flake8
```

## Dependencies Setup

### libmagic Installation

For macOS:
```bash
sudo port install libmagic
```

For Linux:
```bash
sudo apt-get install libmagic1
```

For Windows:
- Download and install the latest release from [Windows Binaries for Python](https://sourceforge.net/projects/gnuwin32/files/file/)

## Configuration

The application can be configured using environment variables:

```env
APP_NAME=universal-disk-explorer
FFMPEG_PATH=
DEBUG=False
APP_ENV=development
LOG_LEVEL=INFO
```

See `.env.example` for all available configuration options.

## Error Handling

The API uses standard HTTP status codes and returns error responses in the following format:

```json
{
    "detail": "Error message",
    "code": "ERROR_CODE",
    "status": 400
}
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and development process.


## Acknowledgments

- [FastAPI](https://fastapi.tiangolo.com/) for the web framework
- [ffmpeg-python](https://github.com/kkroening/ffmpeg-python) for video processing
- [Pillow](https://python-pillow.org/) for image processing
- [python-magic](https://github.com/ahupp/python-magic) for file type detection




# Debugging knowlege (will organize thoughts later to create proper instructions for debugging)
Ensure VSCode Uses the Poetry Environment
$ poetry env info --path
/Users/haroonabbasi/Library/Caches/pypoetry/virtualenvs/universal-disk-explorer-fTv5dNzX-py3.12