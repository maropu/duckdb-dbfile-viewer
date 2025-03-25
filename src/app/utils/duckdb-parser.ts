export const MAGIC_BYTES = "DUCK";
export const FILE_HEADER_SIZE = 4096;
export const MAX_VERSION_SIZE = 64;
export const CHECKSUM_SIZE = 8;
export const BLOCK_HEADER_SIZE = 8; // Size of the checksum

export enum BlockStatus {
  FREE = 'free',
  USED = 'used',
  METADATA = 'metadata',
  INVALID = 'invalid'
}

export interface Block {
  id: number;
  status: BlockStatus;
  offset?: number;
  checksum?: bigint;
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

  // Read checksum
  const checksum = view.getBigUint64(offset, true);
  offset += CHECKSUM_SIZE;

  // Check magic bytes
  const magic = new TextDecoder().decode(new Uint8Array(buffer, offset, 4));
  if (magic !== MAGIC_BYTES) {
    throw new Error('Invalid DuckDB file format');
  }
  offset += 4;

  // Read version number
  const versionNumber = view.getBigUint64(offset, true);
  offset += 8;

  // Read flags (4 flags)
  const flags: bigint[] = [];
  for (let i = 0; i < 4; i++) {
    flags.push(view.getBigUint64(offset, true));
    offset += 8;
  }

  // Read version string
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

  // Read checksum
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

// Adding constants
const INVALID_BLOCK = Number("0xFFFFFFFFFFFFFFFF");
const BLOCK_START = FILE_HEADER_SIZE * 3;

export function analyzeBlocks(buffer: ArrayBuffer, dbHeader1: DatabaseHeader, dbHeader2: DatabaseHeader): Block[] {
  const blocks: Block[] = [];
  const blockSize = Number(dbHeader1.iteration > dbHeader2.iteration ? dbHeader1.blockAllocSize : dbHeader2.blockAllocSize);
  const activeHeader = dbHeader1.iteration > dbHeader2.iteration ? dbHeader1 : dbHeader2;
  const totalBlocks = Number(activeHeader.blockCount);
  const freeBlocks = new Set<number>();
  const metadataBlocks = new Set<number>();

  // Calculate the size of a metadata block (block size minus header part)
  const metadataBlockSize = blockSize - 8; // 8 bytes for the pointer to the next block

  // Function to safely convert BigInt to Number
  const safeToNumber = (bigIntValue: bigint): number => {
    if (bigIntValue === BigInt("0xFFFFFFFFFFFFFFFF")) {
      return INVALID_BLOCK;
    }
    // Treat values larger than MAX_SAFE_INTEGER as INVALID_BLOCK
    if (bigIntValue > BigInt(Number.MAX_SAFE_INTEGER)) {
      console.warn(`Unsafe BigInt conversion: ${bigIntValue} is larger than ${Number.MAX_SAFE_INTEGER}`);
      return INVALID_BLOCK;
    }
    return Number(bigIntValue);
  };

  // Track the freelist chain
  let currentFreeListBlock = safeToNumber(activeHeader.freeList);
  let remainingFreeBlocks = 0; // Number of remaining free blocks to read

  while (currentFreeListBlock !== INVALID_BLOCK) {
    try {
      const blockOffset = BLOCK_START + currentFreeListBlock * blockSize;
      // Check if not exceeding buffer size
      if (blockOffset < 0 || blockOffset >= buffer.byteLength) {
        console.error(`Invalid block offset: ${blockOffset}, buffer size: ${buffer.byteLength}`);
        break;
      }
      const view = new DataView(buffer, blockOffset);

      // Read pointer to the next metablock (first 8 bytes of all metablocks)
      const nextBlock = safeToNumber(view.getBigUint64(0, true));
      let offset = 8; // After the next pointer

      if (currentFreeListBlock === safeToNumber(activeHeader.freeList)) {
        // Only for the first metablock, read the total number of free blocks
        const freeListCount = Number(view.getBigUint64(offset, true));
        // Check for invalid values
        if (freeListCount < 0) {
          console.error(`Invalid freeListCount: ${freeListCount}`);
          break;
        }
        remainingFreeBlocks = freeListCount; // Set the total count
        offset += 8;
      }

      if (remainingFreeBlocks > 0) {
        // Calculate how many free block IDs can be read from this block
        const maxIdsInBlock = Math.floor((blockSize - offset) / 8);
        const idsToRead = Math.min(maxIdsInBlock, remainingFreeBlocks);

        // Read free block IDs
        for (let i = 0; i < idsToRead; i++) {
          const blockId = safeToNumber(view.getBigUint64(offset, true));
          if (blockId !== INVALID_BLOCK) {
            freeBlocks.add(blockId);
          }
          offset += 8;
        }
        remainingFreeBlocks -= idsToRead;
      }

      // Move to the next metablock
      currentFreeListBlock = nextBlock;
    } catch (error) {
      console.error(`Error processing free list block ${currentFreeListBlock}:`, error);
      break;
    }
  }

  // Track the metadata block chain
  let currentMetaBlock = safeToNumber(activeHeader.metaBlock);
  while (currentMetaBlock !== INVALID_BLOCK) {
    try {
      metadataBlocks.add(currentMetaBlock);
      const blockOffset = BLOCK_START + currentMetaBlock * blockSize;
      // Check if not exceeding buffer size
      if (blockOffset < 0 || blockOffset >= buffer.byteLength) {
        console.error(`Invalid meta block offset: ${blockOffset}, buffer size: ${buffer.byteLength}`);
        break;
      }
      const view = new DataView(buffer, blockOffset);
      currentMetaBlock = safeToNumber(view.getBigUint64(0, true));
    } catch (error) {
      console.error(`Error processing metadata block ${currentMetaBlock}:`, error);
      break;
    }
  }

  // Set the status of blocks
  for (let i = 0; i < totalBlocks; i++) {
    try {
      const offset = BLOCK_START + i * blockSize;
      // Check if not exceeding buffer size
      if (offset < 0 || offset >= buffer.byteLength) {
        console.error(`Invalid block offset for block ${i}: ${offset}, buffer size: ${buffer.byteLength}`);
        blocks.push({ id: i, status: BlockStatus.INVALID });
        continue;
      }
      const view = new DataView(buffer, offset);
      const checksum = view.getBigUint64(0, true);

      if (metadataBlocks.has(i)) {
        blocks.push({ id: i, status: BlockStatus.METADATA, offset, checksum });
      } else if (freeBlocks.has(i)) {
        blocks.push({ id: i, status: BlockStatus.FREE, offset, checksum });
      } else {
        blocks.push({ id: i, status: BlockStatus.USED, offset, checksum });
      }
    } catch (error) {
      console.error(`Error processing block ${i}:`, error);
      blocks.push({ id: i, status: BlockStatus.INVALID });
    }
  }

  return blocks;
}