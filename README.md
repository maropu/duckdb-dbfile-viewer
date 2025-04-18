# <img src="public/duckdb-dbfile-viewer-logo.png" alt="DuckDB Database File Viewer Logo" width="80" align="center" /> DuckDB Database File Viewer

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
[![Build and test](https://github.com/maropu/duckdb-dbfile-viewer/actions/workflows/build_and_tests.yml/badge.svg)](https://github.com/maropu/duckdb-dbfile-viewer/actions/workflows/build_and_tests.yml)

The DuckDB Database File Viewer is a tool for visualizing the internal structure of a DuckDB database file. This project parses the DuckDB file format and interactively displays the block structure and metadata segment usage.

> **Note:** A 99% part of the code is generated using Cursor v0.46.11 & Claude 3.7 sonnet, and the cute duck logo is generated using OpenAI ChatGPT(4o).

## Features

- Parsing and analysis of DuckDB database files
- Graphical visualization of block structures
- Detailed display of segment usage within metadata blocks
- Display of file header information

![Screenshot](resources/screenshot.png)

## Getting Started

First, run the server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

> **Note:** This tool supports DuckDB version v1.2.0 and above.

# Any Question?

If you have any question, please feel free to leave it on [Issues](https://github.com/maropu/duckdb-dbfile-viewer/issues)
or Twitter ([@maropu](http://twitter.com/#!/maropu)).
