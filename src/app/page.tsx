'use client';

import { useState } from 'react';
import { MainHeader, DatabaseHeader, FILE_HEADER_SIZE, parseMainHeader, parseDatabaseHeader, analyzeBlocks, Block } from './utils/duckdb-parser';
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
      const buffer = await file.arrayBuffer();
      if (buffer.byteLength < FILE_HEADER_SIZE * 3) {
        throw new Error('File size is too small');
      }

      const mainHeader = parseMainHeader(buffer);
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

  const renderValue = (value: bigint | string | bigint[]) => {
    if (Array.isArray(value)) {
      return value.map(v => v.toString()).join(', ');
    }
    if (typeof value === 'bigint' && value === BigInt("0xFFFFFFFFFFFFFFFF")) {
      return '<invalid>';
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
        <h1 className="text-3xl font-bold mb-8">DuckDB Database File Viewer</h1>

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
