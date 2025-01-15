#!/bin/bash

poetry run uvicorn universal_disk_explorer.main:app --reload --port 8000
