<h1 align="center">
  <img src="resources/duckdb-viz.png" alt="DuckDB DBFile Visualizer Logo" width="60" style="vertical-align: middle; margin-right: 10px;" />
  DuckDB DBFile Visualizer
</h1>

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
[![Build and test](https://github.com/maropu/duckdb-dbfile-viz/actions/workflows/build_and_tests.yml/badge.svg)](https://github.com/maropu/duckdb-dbfile-viz/actions/workflows/build_and_tests.yml)

The DuckDB DBFile Visualizer is a tool for visualizing the internal structure of DuckDB database files. This project parses the DuckDB file format and interactively displays the block structure and metadata segment usage.

## Features

- Parsing and analysis of DuckDB database files
- Graphical visualization of block structures
- Detailed display of segment usage within metadata blocks
- Display of file header information

## Getting Started

First, run the server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

> **Note:** This tool supports DuckDB version v1.2.0 and above.

# Any Question?

If you have any question, please feel free to leave it on [Issues](https://github.com/maropu/duckdb-dbfile-viz/issues)
or Twitter ([@maropu](http://twitter.com/#!/maropu)).