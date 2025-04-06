'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { MainHeader, DatabaseHeader, parseMainHeader, parseDatabaseHeader, analyzeBlocks, Block } from './utils/duckdb-parser';
import { DuckDBConstants } from './constants';
import { isVersionSupported } from './utils/version-utils';
import { MAX_FILE_SIZE } from './utils/file-utils';
import BlockVisualizer from './components/BlockVisualizer';

/**
 * Interface representing the analysis result of a DuckDB database file
 */
interface FileAnalysis {
  /** Main header containing file format information */
  mainHeader: MainHeader;
  /** First database header */
  dbHeader1: DatabaseHeader;
  /** Second database header */
  dbHeader2: DatabaseHeader;
  /** Array of parsed blocks with their metadata */
  blocks: Block[];
  /** Size of each block in bytes */
  blockSize: number;
  /** Reference to the active database header (the one with higher iteration) */
  activeHeader: DatabaseHeader;
}

/**
 * Types of values that can be displayed in the file analysis UI
 */
type DisplayValue = string | number | bigint | boolean | null | undefined | Array<any> | { blockId: bigint; blockIndex: number } | Record<string, any>;

/**
 * Home page component for the DuckDB Database File Viewer
 *
 * @returns React component for the main application page
 */
export default function Home(): React.ReactElement {
  // State for storing the analysis results of the uploaded file
  const [fileAnalysis, setFileAnalysis] = useState<FileAnalysis | null>(null);
  // State for storing error messages
  const [error, setError] = useState<string | null>(null);

  /**
   * Handles file upload and processes the DuckDB database file
   *
   * @param event - The change event from the file input
   */
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      // Check if file size exceeds the maximum limit
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`File size exceeds the maximum limit of 512MB`);
      }

      const buffer = await file.arrayBuffer();

      // Basic file size check
      if (buffer.byteLength < DuckDBConstants.FILE_HEADER_SIZE * 3) {
        throw new Error('File size is too small for a valid DuckDB file');
      }

      // Parse main header for initial validation
      const mainHeader = parseMainHeader(buffer);

      // Verify magic bytes and version
      if (mainHeader.magic !== DuckDBConstants.MAGIC_BYTES) {
        throw new Error('Invalid DuckDB file format: DUCK magic bytes not found');
      }

      // Check library version
      if (!isVersionSupported(mainHeader.libraryVersion)) {
        throw new Error(`Unsupported DuckDB version: ${mainHeader.libraryVersion}. This tool supports v1.2.0 and later.`);
      }

      // Now parse the rest of the file
      const dbHeader1 = parseDatabaseHeader(buffer, DuckDBConstants.FILE_HEADER_SIZE);
      const dbHeader2 = parseDatabaseHeader(buffer, DuckDBConstants.FILE_HEADER_SIZE * 2);
      const blocks = analyzeBlocks(buffer, dbHeader1, dbHeader2);
      const blockSize = Number(dbHeader1.iteration > dbHeader2.iteration ? dbHeader1.blockAllocSize : dbHeader2.blockAllocSize);
      const activeHeader = dbHeader1.iteration > dbHeader2.iteration ? dbHeader1 : dbHeader2;

      setFileAnalysis({ mainHeader, dbHeader1, dbHeader2, blocks, blockSize, activeHeader });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setFileAnalysis(null);
    }
  };

  /**
   * Renders a value from the file analysis in a human-readable format
   *
   * @param value - The value to render
   * @returns A string representation of the value
   */
  const renderValue = (value: DisplayValue): string => {
    if (value === null || value === undefined) {
      return 'N/A';
    }

    if (Array.isArray(value)) {
      return value.map(v => String(v)).join(', ');
    }

    if (typeof value === 'bigint' && value === DuckDBConstants.INVALID_BLOCK) {
      return '<invalid>';
    }

    if (typeof value === 'object' && value !== null) {
      if ('blockId' in value && 'blockIndex' in value) {
        return `Block ID: ${String(value.blockId)} | Index: ${value.blockIndex}`;
      }
      return JSON.stringify(value);
    }

    return String(value);
  };

  /**
   * Renders a section of the file analysis with a title and data
   *
   * @param title - The title of the section
   * @param data - The data to render in the section
   * @returns React component for the header section
   */
  const renderHeader = (title: string, data: Record<string, DisplayValue>): React.ReactNode => (
    <div className="mb-8">
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      <div className="bg-gray-100 p-4 rounded-lg">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="mb-2">
            <span className="font-medium">{key}: </span>
            <span className="font-mono">{renderValue(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center mb-8">
          <Image
            src="/duckdb-dbfile-viewer-logo.png"
            alt="DuckDB DB File Viewer Logo"
            width={80}
            height={80}
            className="mr-6"
          />
          <h1 className="text-4xl font-bold">DuckDB Database File Viewer</h1>
        </div>

        <div className="mb-8">
          <label className="block text-sm font-medium mb-2">
            Select a DuckDB database file:
          </label>
          <input
            type="file"
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-100 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {fileAnalysis && (
          <div>
            <div className="grid grid-cols-2 gap-8">
              <div>
                {renderHeader('Main Header', fileAnalysis.mainHeader as unknown as Record<string, DisplayValue>)}
                {renderHeader('Active Database Header', fileAnalysis.activeHeader as unknown as Record<string, DisplayValue>)}
              </div>
              <div>
                <BlockVisualizer blocks={fileAnalysis.blocks} blockSize={fileAnalysis.blockSize} />
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
