# DuckDB Test Database Generation Tool

This directory contains utilities for generating test database files for the DuckDB Database File Viewer.

## Test DB File Generation Script

The `generate_dbfile.py` script automatically generates test database files using a specified version of DuckDB.

### Requirements

- Python 3.6 or higher
- `venv` module (normally included with Python by default)

### Usage

Basic usage:

```bash
python generate_dbfile.py --version v1.2.0 --output tests/fixtures/testdb-new.db
```

All available options:

```bash
python generate_dbfile.py --help
```

```
usage: generate_dbfile.py [-h] [--version VERSION] [--output OUTPUT] [--tables TABLES] [--rows ROWS] [--seed SEED]

Generate test DuckDB database files

optional arguments:
  -h, --help         show this help message and exit
  --version VERSION  DuckDB version to use (e.g., v1.2.0)
  --output OUTPUT    Output database file path
  --tables TABLES    Number of tables to create
  --rows ROWS        Number of rows per table
  --seed SEED        Random seed for data generation
```

### Generated Data

The script generates the following data:

1. `database_metadata` table - Stores database metadata
2. Multiple data tables - Generated with schema variations like:
   - `users_X` - User information
   - `products_X` - Product information
   - `orders_X` - Order information
   - `employees_X` - Employee information
   - `log_events_X` - Log events
3. `order_details` view - A view that joins multiple tables

### Generation Examples

Examples of generating database files with different versions:

```bash
# Generate a v1.2.0 database (small)
python generate_dbfile.py --version v1.2.0 --output tests/fixtures/testdb-v1.2.0-small.db --tables 3 --rows 100

# Generate a v1.2.0 database (large)
python generate_dbfile.py --version v1.2.0 --output tests/fixtures/testdb-v1.2.0-large.db --tables 10 --rows 1000
```

## Notes

- The size of the generated database file is proportional to the number of tables and rows
- The script creates a temporary virtual environment for each execution and installs the specified version of DuckDB
- Generating large amounts of data may take some time to process