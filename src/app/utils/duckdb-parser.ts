export const MAGIC_BYTES = "DUCK";
export const FILE_HEADER_SIZE = 4096;
export const MAX_VERSION_SIZE = 64;
export const CHECKSUM_SIZE = 8;
export const BLOCK_HEADER_SIZE = 8; // チェックサムのサイズ

export enum BlockStatus {
  FREE = 'free',
  USED = 'used',
  METADATA = 'metadata',
  INVALID = 'invalid'
}

export interface Block {
  id: number;
  offset: number;
  status: BlockStatus;
  checksum: bigint;
}

export interface MainHeader {
  checksum: bigint;
  magic: string;
  versionNumber: bigint;
  flags: bigint[];
  libraryVersion: string;
  sourceId: string;
}

export interface DatabaseHeader {
  checksum: bigint;
  iteration: bigint;
  metaBlock: bigint;
  freeList: bigint;
  blockCount: bigint;
  blockAllocSize: bigint;
  vectorSize: bigint;
  serializationCompatibility: bigint;
}

export function parseMainHeader(buffer: ArrayBuffer): MainHeader {
  const view = new DataView(buffer);
  let offset = 0;

  // チェックサムの読み取り
  const checksum = view.getBigUint64(offset, true);
  offset += CHECKSUM_SIZE;

  // マジックバイトのチェック
  const magic = new TextDecoder().decode(new Uint8Array(buffer, offset, 4));
  if (magic !== MAGIC_BYTES) {
    throw new Error('Invalid DuckDB file format');
  }
  offset += 4;

  // バージョン番号の読み取り
  const versionNumber = view.getBigUint64(offset, true);
  offset += 8;

  // フラグの読み取り（4つのフラグ）
  const flags: bigint[] = [];
  for (let i = 0; i < 4; i++) {
    flags.push(view.getBigUint64(offset, true));
    offset += 8;
  }

  // バージョン文字列の読み取り
  const libraryVersion = new TextDecoder().decode(new Uint8Array(buffer, offset, MAX_VERSION_SIZE)).replace(/\0+$/, '');
  offset += MAX_VERSION_SIZE;

  const sourceId = new TextDecoder().decode(new Uint8Array(buffer, offset, MAX_VERSION_SIZE)).replace(/\0+$/, '');

  return {
    checksum,
    magic,
    versionNumber,
    flags,
    libraryVersion,
    sourceId
  };
}

export function parseDatabaseHeader(buffer: ArrayBuffer, headerOffset: number): DatabaseHeader {
  const view = new DataView(buffer);
  let offset = headerOffset;

  // チェックサムの読み取り
  const checksum = view.getBigUint64(offset, true);
  offset += CHECKSUM_SIZE;

  const iteration = view.getBigUint64(offset, true);
  offset += 8;

  const metaBlock = view.getBigUint64(offset, true);
  offset += 8;

  const freeList = view.getBigUint64(offset, true);
  offset += 8;

  const blockCount = view.getBigUint64(offset, true);
  offset += 8;

  const blockAllocSize = view.getBigUint64(offset, true);
  offset += 8;

  const vectorSize = view.getBigUint64(offset, true);
  offset += 8;

  const serializationCompatibility = view.getBigUint64(offset, true);

  return {
    checksum,
    iteration,
    metaBlock,
    freeList,
    blockCount,
    blockAllocSize,
    vectorSize,
    serializationCompatibility
  };
}

export function analyzeBlocks(
  buffer: ArrayBuffer,
  dbHeader1: DatabaseHeader,
  dbHeader2: DatabaseHeader
): Block[] {
  const blocks: Block[] = [];
  const view = new DataView(buffer);

  // アクティブなヘッダーを特定（イテレーション数が大きい方）
  const activeHeader = dbHeader1.iteration > dbHeader2.iteration ? dbHeader1 : dbHeader2;

  // メタデータブロックとフリーリストを追跡するためのセット
  const metadataBlocks = new Set<number>();
  const freeBlocks = new Set<number>();

  // メタデータブロックを追加
  if (activeHeader.metaBlock !== BigInt("0xFFFFFFFFFFFFFFFF")) {
    metadataBlocks.add(Number(activeHeader.metaBlock));
  }

  // フリーリストブロックを追加
  if (activeHeader.freeList !== BigInt("0xFFFFFFFFFFFFFFFF")) {
    freeBlocks.add(Number(activeHeader.freeList));
  }

  // ブロックの解析
  const startOffset = FILE_HEADER_SIZE * 3; // ヘッダー3つ分をスキップ
  const totalBlocks = Number(activeHeader.blockCount);
  const blockSize = Number(activeHeader.blockAllocSize);

  for (let i = 0; i < totalBlocks; i++) {
    const offset = startOffset + (i * blockSize);
    if (offset + BLOCK_HEADER_SIZE > buffer.byteLength) {
      break;
    }

    const checksum = view.getBigUint64(offset, true);
    let status = BlockStatus.USED;

    if (metadataBlocks.has(i)) {
      status = BlockStatus.METADATA;
    } else if (freeBlocks.has(i)) {
      status = BlockStatus.FREE;
    }

    blocks.push({
      id: i,
      offset,
      status,
      checksum
    });
  }

  return blocks;
}