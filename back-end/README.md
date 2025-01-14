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

3. Activate the virtual environment:
   ```bash
   poetry shell
   ```

4. Run the FastAPI application:
   ```bash
   uvicorn universal_disk_explorer.main:app --reload
   ```

## API Endpoints

### Scan Directory

**GET** `/scan/{path:path}`

Retrieve metadata for all files in a directory.

#### Query Parameters:
- `include_video_metadata` (bool, optional): Include video metadata if the file is a video.

#### Response:
A list of file metadata objects:
```json
[
  {
    "path": "string",
    "name": "string",
    "size": 0,
    "created_time": "2023-01-01T00:00:00",
    "modified_time": "2023-01-01T00:00:00",
    "file_type": "string",
    "mime_type": "string",
    "hash": "string",
    "perceptual_hash": "string",
    "is_directory": false,
    "video_metadata": {
      "width": 0,
      "height": 0,
      "duration": 0.0,
      "bitrate": 0,
      "codec": "string",
      "fps": 0.0
    }
  }
]
```

### Delete Files

**POST** `/files/delete`

Delete a list of files.

#### Request Body:
```json
[
  "path/to/file1",
  "path/to/file2"
]
```

#### Response:
A dictionary with file paths and their deletion status:
```json
{
  "path/to/file1": "deleted",
  "path/to/file2": "not a file"
}
```

### Move Files

**POST** `/files/move`

Move files to a target directory.

#### Request Body:
```json
{
  "files": [
    "path/to/file1",
    "path/to/file2"
  ],
  "target_directory": "path/to/target"
}
```

#### Response:
A dictionary with file paths and their new locations:
```json
{
  "path/to/file1": "path/to/target/file1",
  "path/to/file2": "error: Permission denied"
}
```

### Rename File

**POST** `/files/rename`

Rename a file.

#### Request Body:
```json
{
  "file_path": "path/to/file",
  "new_name": "new_name.ext"
}
```

#### Response:
A string with the new file path:
```json
"path/to/new_name.ext"
```

## Development

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

