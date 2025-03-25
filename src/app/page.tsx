'use client';

import { useState } from 'react';
import { MainHeader, DatabaseHeader, FILE_HEADER_SIZE, parseMainHeader, parseDatabaseHeader } from './utils/duckdb-parser';

interface FileAnalysis {
  mainHeader: MainHeader;
  dbHeader1: DatabaseHeader;
  dbHeader2: DatabaseHeader;
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
        throw new Error('ファイルサイズが小さすぎます');
      }

      const mainHeader = parseMainHeader(buffer);
      const dbHeader1 = parseDatabaseHeader(buffer, FILE_HEADER_SIZE);
      const dbHeader2 = parseDatabaseHeader(buffer, FILE_HEADER_SIZE * 2);

      setFileAnalysis({ mainHeader, dbHeader1, dbHeader2 });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '不明なエラーが発生しました');
      setFileAnalysis(null);
    }
  };

  const renderValue = (value: bigint | string | bigint[]) => {
    if (Array.isArray(value)) {
      return value.map(v => v.toString()).join(', ');
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
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">DuckDB DBファイルビューアー</h1>

        <div className="mb-8">
          <label className="block text-sm font-medium mb-2">
            DuckDBのDBファイルを選択してください:
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
            {renderHeader('メインヘッダー', fileAnalysis.mainHeader)}
            {renderHeader('データベースヘッダー 1', fileAnalysis.dbHeader1)}
            {renderHeader('データベースヘッダー 2', fileAnalysis.dbHeader2)}
          </div>
        )}
      </div>
    </main>
  );
}
