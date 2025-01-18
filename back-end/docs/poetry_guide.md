# Poetry Package Management Guide

This guide covers all aspects of using Poetry for package management in the Universal Disk Explorer project.

## Table of Contents
- [Installation](#installation)
- [Basic Commands](#basic-commands)
- [Virtual Environment Management](#virtual-environment-management)
- [Advanced Usage](#advanced-usage)
- [Troubleshooting](#troubleshooting)

## Installation

Install Poetry globally on your system:

```bash
curl -sSL https://install.python-poetry.org | python3 -
```

Verify the installation:
```bash
poetry --version
```

## Basic Commands

### Project Setup
```bash
# Initialize a new project (if starting from scratch)
poetry init

# Install all dependencies
poetry install

# Add new packages
poetry add package-name
poetry add package-name==1.2.3  # Specific version
poetry add package-name@^2.0.0  # Version constraint
poetry add --dev pytest         # Dev dependency

# Remove packages
poetry remove package-name

# Update packages
poetry update                   # Update all packages
poetry update package-name      # Update specific package
```

### Dependency Management
```bash
# Show installed packages
poetry show
poetry show --tree             # Show dependency tree

# Export dependencies
poetry export -f requirements.txt --output requirements.txt
```

## Virtual Environment Management

```bash
# Activate virtual environment
poetry shell

# Run commands in virtual environment without activation
poetry run python script.py
poetry run pytest

# Show environment information
poetry env info

# Create a new virtual environment
poetry env use python3.12

# List all virtual environments
poetry env list

# Remove virtual environments
poetry env remove python3.12
```

## Advanced Usage

### Custom PyPI Configuration
```bash
# Add custom repository
poetry source add private https://private-pypi.org

# Publish to custom repository
poetry publish --repository private
```

### Project Building
```bash
# Build the project
poetry build

# Publish to PyPI
poetry publish
```

### Configuration
```bash
# Show current configuration
poetry config --list

# Set configuration values
poetry config virtualenvs.in-project true
```

## Troubleshooting

### Common Issues

1. **Lock file conflicts**
   ```bash
   # Resolve lock file conflicts
   poetry lock --no-update
   ```

2. **Cache issues**
   ```bash
   # Clear Poetry's cache
   poetry cache clear pypi --all
   ```

3. **Virtual environment problems**
   ```bash
   # Remove and recreate virtual environment
   poetry env remove python3.12
   poetry install
   ```

### Best Practices

1. Always commit `poetry.lock` file to version control
2. Use `poetry.lock` file to ensure consistent installations across environments
3. Regularly update dependencies with `poetry update`
4. Use version constraints appropriately in `pyproject.toml`

## Project-Specific Guidelines

For the Universal Disk Explorer project:

1. Use Python 3.12+ as specified in `pyproject.toml`
2. Development dependencies should be added with `--dev` flag
3. Run all commands through Poetry to ensure consistent environment usage
4. Update dependencies regularly but verify compatibility with existing codebase

For more information, visit the [official Poetry documentation](https://python-poetry.org/docs/).