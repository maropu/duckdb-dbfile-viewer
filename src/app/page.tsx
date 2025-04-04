'use client';

import { useState } from 'react';
import Image from 'next/image';
import { MainHeader, DatabaseHeader, FILE_HEADER_SIZE, parseMainHeader, parseDatabaseHeader, analyzeBlocks, Block } from './utils/duckdb-parser';
import { isVersionSupported } from './utils/version-utils';
import { MAX_FILE_SIZE } from './utils/file-utils';
import BlockVisualizer from './components/BlockVisualizer';

interface FileAnalysis {
  mainHeader: MainHeader;
  dbHeader1: DatabaseHeader;
  dbHeader2: DatabaseHeader;
  blocks: Block[];
  blockSize: number;
  activeHeader: DatabaseHeader;
}

export default function Home() {
  const [fileAnalysis, setFileAnalysis] = useState<FileAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      // Check if file size exceeds the maximum limit
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`File size exceeds the maximum limit of 512MB`);
      }

      const buffer = await file.arrayBuffer();

      // Basic file size check
      if (buffer.byteLength < FILE_HEADER_SIZE * 3) {
        throw new Error('File size is too small for a valid DuckDB file');
      }

      // Parse main header for initial validation
      const mainHeader = parseMainHeader(buffer);

      // Verify magic bytes and version
      if (mainHeader.magic !== 'DUCK') {
        throw new Error('Invalid DuckDB file format: DUCK magic bytes not found');
      }

      // Check library version
      if (!isVersionSupported(mainHeader.libraryVersion)) {
        throw new Error(`Unsupported DuckDB version: ${mainHeader.libraryVersion}. This tool supports v1.2.0 and later.`);
      }

      // Now parse the rest of the file
      const dbHeader1 = parseDatabaseHeader(buffer, FILE_HEADER_SIZE);
      const dbHeader2 = parseDatabaseHeader(buffer, FILE_HEADER_SIZE * 2);
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

  const renderValue = (value: any) => {
    if (Array.isArray(value)) {
      return value.map(v => v.toString()).join(', ');
    }
    if (typeof value === 'bigint' && value === BigInt("2449958197289549827")) {
      return '<invalid>';
    }
    if (typeof value === 'object' && value !== null) {
      if ('blockId' in value && 'blockIndex' in value) {
        return `Block ID: ${value.blockId.toString()} | Index: ${value.blockIndex}`;
      }
      return JSON.stringify(value);
    }
    return value.toString();
  };

  const renderHeader = (title: string, data: Record<string, any>) => (
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
                {renderHeader('Main Header', fileAnalysis.mainHeader)}
                {renderHeader('Active Database Header', fileAnalysis.activeHeader)}
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
