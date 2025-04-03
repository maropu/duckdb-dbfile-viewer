#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
This script creates database files with different schemas and data
for testing purposes.
"""

import os
import sys
import argparse
import random
from datetime import datetime, timedelta
import subprocess
import tempfile

def generate_test_db(target_path, version, num_tables=3, rows_per_table=100, seed=42):
    """
    Generate a test DuckDB database with the specified version

    Args:
        target_path: Path where the database file will be created
        version: DuckDB version to use (e.g., 'v1.2.0')
        num_tables: Number of tables to create
        rows_per_table: Number of rows per table
        seed: Random seed for reproducible data generation
    """
    random.seed(seed)

    # Add version suffix to the filename
    base, ext = os.path.splitext(target_path)
    # Remove 'v' prefix if present for the filename
    file_version = version
    if file_version.startswith('v'):
        file_version = file_version[1:]
    versioned_path = f"{base}_{file_version}{ext}"

    print(f"Generating DuckDB database file with version {version}")
    print(f"Target path: {versioned_path}")

    # Create a temporary directory for building
    with tempfile.TemporaryDirectory() as temp_dir:
        # Create Python virtual environment
        venv_dir = os.path.join(temp_dir, "venv")
        subprocess.run([sys.executable, "-m", "venv", venv_dir], check=True)

        # Get the Python executable in the virtual environment
        if sys.platform == 'win32':
            python_exe = os.path.join(venv_dir, "Scripts", "python.exe")
            pip_exe = os.path.join(venv_dir, "Scripts", "pip.exe")
        else:
            python_exe = os.path.join(venv_dir, "bin", "python")
            pip_exe = os.path.join(venv_dir, "bin", "pip")

        # Install the specific version of DuckDB
        # Remove 'v' prefix if present for pip install
        pip_version = version
        if pip_version.startswith('v'):
            pip_version = pip_version[1:]

        print(f"Installing DuckDB version {pip_version}")
        subprocess.run([pip_exe, "install", f"duckdb=={pip_version}"], check=True)

        # Create a Python script to generate the database
        db_script_path = os.path.join(temp_dir, "create_db.py")

        with open(db_script_path, "w") as f:
            f.write(f"""
import duckdb
import random
import string
from datetime import datetime, timedelta
import os

# Helper functions for generating random data
def random_string(length=10):
    return ''.join(random.choices(string.ascii_letters, k=length))

def random_date(start_date=datetime(2020, 1, 1), days_range=1000):
    return start_date + timedelta(days=random.randint(0, days_range))

def random_boolean():
    return random.choice([True, False])

def random_decimal(min_val=0, max_val=1000, precision=2):
    return round(random.uniform(min_val, max_val), precision)

# Make sure output directory exists
output_dir = os.path.dirname('{versioned_path}')
if output_dir and not os.path.exists(output_dir):
    os.makedirs(output_dir)

# Remove existing file if it exists
if os.path.exists('{versioned_path}'):
    os.remove('{versioned_path}')

# Connect to the database
conn = duckdb.connect('{versioned_path}')
print(f"DuckDB version: {{duckdb.__version__}}")

# Create metadata table
conn.execute('''
CREATE TABLE database_metadata (
    key VARCHAR,
    value VARCHAR
)
''')

conn.execute('''
INSERT INTO database_metadata VALUES
    ('creator', 'DuckDB Database File Viewer Test Generator'),
    ('created_at', ?),
    ('version', ?),
    ('description', 'Test database for visualization')
''', (datetime.now().isoformat(), '{version}'))

# Define different table templates
table_templates = [
    {{
        "name": "users",
        "columns": [
            ("id", "INTEGER"),
            ("username", "VARCHAR"),
            ("email", "VARCHAR"),
            ("created_at", "TIMESTAMP"),
            ("active", "BOOLEAN"),
        ],
        "generator": lambda i: (
            i + 1,
            random_string(8),
            random_string(8) + '@example.com',
            random_date(),
            random_boolean()
        )
    }},
    {{
        "name": "products",
        "columns": [
            ("id", "INTEGER"),
            ("name", "VARCHAR"),
            ("price", "DECIMAL(10,2)"),
            ("stock", "INTEGER"),
            ("category", "VARCHAR"),
        ],
        "generator": lambda i: (
            i + 1,
            random_string(15),
            random_decimal(10, 1000),
            random.randint(0, 100),
            random.choice(['Electronics', 'Clothing', 'Food', 'Books', 'Toys'])
        )
    }},
    {{
        "name": "orders",
        "columns": [
            ("id", "INTEGER"),
            ("user_id", "INTEGER"),
            ("product_id", "INTEGER"),
            ("quantity", "INTEGER"),
            ("order_date", "TIMESTAMP"),
            ("total_amount", "DECIMAL(12,2)"),
        ],
        "generator": lambda i: (
            i + 1,
            random.randint(1, {rows_per_table}),
            random.randint(1, {rows_per_table}),
            random.randint(1, 10),
            random_date(),
            random_decimal(50, 5000)
        )
    }},
    {{
        "name": "employees",
        "columns": [
            ("id", "INTEGER"),
            ("first_name", "VARCHAR"),
            ("last_name", "VARCHAR"),
            ("department", "VARCHAR"),
            ("salary", "DECIMAL(12,2)"),
            ("hire_date", "DATE"),
        ],
        "generator": lambda i: (
            i + 1,
            random_string(10),
            random_string(12),
            random.choice(['HR', 'Engineering', 'Sales', 'Marketing', 'Support']),
            random_decimal(30000, 150000),
            random_date(datetime(2015, 1, 1))
        )
    }},
    {{
        "name": "log_events",
        "columns": [
            ("id", "INTEGER"),
            ("timestamp", "TIMESTAMP"),
            ("level", "VARCHAR"),
            ("message", "VARCHAR"),
            ("source", "VARCHAR"),
        ],
        "generator": lambda i: (
            i + 1,
            random_date(datetime(2023, 1, 1), 365),
            random.choice(['INFO', 'WARNING', 'ERROR', 'DEBUG']),
            random_string(50),
            random.choice(['app', 'api', 'db', 'auth', 'worker'])
        )
    }},
]

# Create tables with different schemas
tables = []
for i in range({num_tables}):
    # Select a table template (cycling through the available ones)
    template_idx = i % len(table_templates)
    table_template = table_templates[template_idx]

    # Create table name with index to avoid duplicates
    table_name = f"{{table_template['name']}}_{{i+1}}"
    tables.append(table_name)

    # Create table definition
    columns = table_template['columns']
    column_defs = [f"{{col[0]}} {{col[1]}}" for col in columns]

    create_sql = f'''
    CREATE TABLE {{table_name}} (
        {{', '.join(column_defs)}}
    )
    '''
    conn.execute(create_sql)

    # Generate data with Python and insert using parameterized query
    placeholders = ', '.join(['?'] * len(columns))
    insert_sql = f"INSERT INTO {{table_name}} VALUES ({{placeholders}})"

    # Generate and insert data in batches for better performance
    batch_size = 50
    for batch_start in range(0, {rows_per_table}, batch_size):
        batch_end = min(batch_start + batch_size, {rows_per_table})
        batch_data = [table_template['generator'](i) for i in range(batch_start, batch_end)]
        conn.executemany(insert_sql, batch_data)

    print(f"Created table {{table_name}} with {rows_per_table} rows")

# Create a view that joins some tables
if len(tables) >= 3:
    conn.execute(f'''
    CREATE VIEW order_details AS
    SELECT
        o.id as order_id,
        u.username,
        p.name as product_name,
        o.quantity,
        o.order_date,
        o.total_amount
    FROM {{tables[2]}} o
    JOIN {{tables[0]}} u ON o.user_id = u.id
    JOIN {{tables[1]}} p ON o.product_id = p.id
    ''')
    print("Created view: order_details")

# Try to determine DuckDB version and use features available in that version
duckdb_version = duckdb.__version__
try:
    major_version = int(duckdb_version.split('.')[0])
    minor_version = int(duckdb_version.split('.')[1]) if len(duckdb_version.split('.')) > 1 else 0

    # ANALYZE command is in all versions but the PRAGMA setting was added later
    try:
        # Try setting the analyze sample param in newer versions
        conn.execute('PRAGMA analyze_sample=50')
        print("Using PRAGMA analyze_sample=50")
    except:
        # Silently continue if this PRAGMA is not available
        print("PRAGMA analyze_sample not available in this version")

    # Run ANALYZE to update statistics
    conn.execute('ANALYZE')
    print("Ran ANALYZE command")
except Exception as e:
    print(f"Could not run ANALYZE commands: {{e}}")

# Run VACUUM to reclaim space and optimize the file
try:
    conn.execute('VACUUM')
    print("Ran VACUUM command")
except Exception as e:
    print(f"Could not run VACUUM command: {{e}}")

# Close the connection
conn.close()
print(f"Database created successfully at {versioned_path}")
""")

        # Execute the script to create the database
        print("Creating database file...")
        subprocess.run([python_exe, db_script_path], check=True)

    print(f"Database file created successfully at: {versioned_path}")
    return versioned_path

def main():
    parser = argparse.ArgumentParser(description="Generate test DuckDB database files")
    parser.prog = "generate_dbfile.py"  # Update the program name in help text
    parser.add_argument("--version", default="v1.2.0", help="DuckDB version to use (e.g., v1.2.0)")
    parser.add_argument("--output", default="testdb.db", help="Output database file path")
    parser.add_argument("--tables", type=int, default=5, help="Number of tables to create")
    parser.add_argument("--rows", type=int, default=200, help="Number of rows per table")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for data generation")

    args = parser.parse_args()

    # Generate the database
    final_path = generate_test_db(
        target_path=args.output,
        version=args.version,
        num_tables=args.tables,
        rows_per_table=args.rows,
        seed=args.seed
    )

    print(f"Final database file location: {final_path}")

if __name__ == "__main__":
    main()