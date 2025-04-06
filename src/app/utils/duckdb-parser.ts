/**
 * Magic bytes identifier for DuckDB files
 * All valid DuckDB database files must start with this magic string
 */
export const MAGIC_BYTES: string = "DUCK";

/**
 * Size of each file header block in bytes
 * DuckDB files contain multiple header blocks of this size
 */
export const FILE_HEADER_SIZE: number = 4096;

/**
 * Maximum size for version strings in bytes
 * Used for libraryVersion and sourceId in the main header
 */
export const MAX_VERSION_SIZE: number = 64;

/**
 * Size of the checksum field in bytes
 * Used for validation of blocks and headers
 */
export const CHECKSUM_SIZE: number = 8;

/**
 * Size of the block header in bytes
 * Each block starts with a header containing checksum
 */
export const BLOCK_HEADER_SIZE: number = 8; // Size of the checksum

/**
 * Enumeration of possible block statuses
 * Represents the different types and states a block can have
 */
export enum BlockStatus {
  FREE = 'free',
  USED = 'used',
  METADATA = 'metadata',
  META_SEGMENT_USED = 'meta_segment_used',  // Used segment within a metablock
  META_SEGMENT_FREE = 'meta_segment_free',  // Free segment within a metablock
  INVALID = 'invalid'
}

/**
 * Interface representing a block in the DuckDB file
 * Contains information about the block's status, ID, and metadata
 */
export interface Block {
  id: bigint;
  status: BlockStatus;
  offset?: number;
  checksum?: bigint;
  // For metadata blocks, store usage information for all 64 segments
  metaSegments?: Array<{
    used: boolean;
    index: number;
  }>;
}

/**
 * Interface representing the main header of a DuckDB file
 * Contains file format identification and version information
 */
export interface MainHeader {
  checksum: bigint;
  magic: string;
  versionNumber: bigint;
  flags: bigint[];
  libraryVersion: string;
  sourceId: string;
}

/**
 * Interface representing a database header in a DuckDB file
 * Contains block allocation information and metadata references
 */
export interface DatabaseHeader {
  checksum: bigint;
  iteration: bigint;
  metaBlock: {
    pointer: bigint;
    blockId: bigint;
    blockIndex: number;
  };
  freeList: {
    pointer: bigint;
    blockId: bigint;
    blockIndex: number;
  };
  blockCount: bigint;
  blockAllocSize: bigint;
  vectorSize: bigint;
  serializationCompatibility: bigint;
}

/**
 * Parses the main header of a DuckDB file
 * @param buffer - The buffer containing the file data
 * @returns The parsed main header information
 * @throws Error if the file format is invalid
 */
export function parseMainHeader(buffer: ArrayBuffer): MainHeader {
  const view: DataView = new DataView(buffer);
  let offset: number = 0;

  // Read checksum
  const checksum: bigint = view.getBigUint64(offset, true);
  offset += CHECKSUM_SIZE;

  // Check magic bytes
  const magic: string = new TextDecoder().decode(new Uint8Array(buffer, offset, 4));
  if (magic !== MAGIC_BYTES) {
    throw new Error('Invalid DuckDB file format');
  }
  offset += 4;

  // Read version number
  const versionNumber: bigint = view.getBigUint64(offset, true);
  offset += 8;

  // Read flags (4 flags)
  const flags: bigint[] = [];
  for (let i: number = 0; i < 4; i++) {
    flags.push(view.getBigUint64(offset, true));
    offset += 8;
  }

  // Read version string
  const libraryVersion: string = new TextDecoder().decode(new Uint8Array(buffer, offset, MAX_VERSION_SIZE)).replace(/\0+$/, '');
  offset += MAX_VERSION_SIZE;

  const sourceId: string = new TextDecoder().decode(new Uint8Array(buffer, offset, MAX_VERSION_SIZE)).replace(/\0+$/, '');

  return {
    checksum,
    magic,
    versionNumber,
    flags,
    libraryVersion,
    sourceId
  };
}

/**
 * Extracts the actual block ID from a MetaBlockPointer value by masking out the upper 8 bits
 * This implements the equivalent of: block_id_t(block_pointer & ~(idx_t(0xFF) << 56ULL))
 *
 * @param blockPointer - The block pointer containing both ID and index information
 * @returns The block ID extracted from the pointer
 */
export function getBlockId(blockPointer: bigint): bigint {
  // Calculate idx_t(0xFF) << 56ULL
  const mask: bigint = BigInt(0xFF) << BigInt(56);

  // Apply NOT (~) to get ~(idx_t(0xFF) << 56ULL)
  const invertedMask: bigint = ~mask;

  // Return block_pointer & invertedMask
  return blockPointer & invertedMask;
}

/**
 * Extracts the block index from the upper 8 bits of a MetaBlockPointer
 *
 * @param blockPointer - The block pointer containing both ID and index information
 * @returns The block index value (0-255)
 */
export function getBlockIndex(blockPointer: bigint): number {
  // Extract the upper 8 bits
  const mask: bigint = BigInt(0xFF) << BigInt(56);
  const indexBits: bigint = blockPointer & mask;
  // Shift back to get the actual value
  return Number(indexBits >> BigInt(56));
}

/**
 * Parses a database header from the specified offset in the buffer
 *
 * @param buffer - The buffer containing the file data
 * @param headerOffset - The offset where the header begins
 * @returns The parsed database header information
 */
export function parseDatabaseHeader(buffer: ArrayBuffer, headerOffset: number): DatabaseHeader {
  const view: DataView = new DataView(buffer);
  let offset: number = headerOffset;

  // Read checksum
  const checksum: bigint = view.getBigUint64(offset, true);
  offset += CHECKSUM_SIZE;

  const iteration: bigint = view.getBigUint64(offset, true);
  offset += 8;

  const rawMetaBlock: bigint = view.getBigUint64(offset, true);
  // Store block ID and block index
  const metaBlock = {
    pointer: rawMetaBlock,
    blockId: getBlockId(rawMetaBlock),
    blockIndex: getBlockIndex(rawMetaBlock)
  };
  offset += 8;

  const rawFreeList: bigint = view.getBigUint64(offset, true);
  // Store block ID and block index
  const freeList = {
    pointer: rawFreeList,
    blockId: getBlockId(rawFreeList),
    blockIndex: getBlockIndex(rawFreeList)
  };
  offset += 8;

  const blockCount: bigint = view.getBigUint64(offset, true);
  offset += 8;

  const blockAllocSize: bigint = view.getBigUint64(offset, true);
  offset += 8;

  const vectorSize: bigint = view.getBigUint64(offset, true);
  offset += 8;

  const serializationCompatibility: bigint = view.getBigUint64(offset, true);

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
/**
 * Special value representing an invalid block pointer
 * Used to mark the end of metadata block chains
 */
const INVALID_BLOCK: bigint = BigInt("0xFFFFFFFFFFFFFFFF");

/**
 * The offset where data blocks start in the file
 * After the three header blocks (main header and two database headers)
 */
const BLOCK_START: number = FILE_HEADER_SIZE * 3;

/**
 * Number of segments per metadata block
 * Each metadata block is divided into this many segments
 */
export const META_SEGMENTS_PER_BLOCK: number = 64; // Each metablock is divided into 64 segments

/**
 * Analyzes the blocks in a DuckDB file and determines their status
 *
 * @param buffer - The buffer containing the file data
 * @param dbHeader1 - The first database header
 * @param dbHeader2 - The second database header
 * @returns An array of blocks with their statuses and metadata
 */
export function analyzeBlocks(buffer: ArrayBuffer, dbHeader1: DatabaseHeader, dbHeader2: DatabaseHeader): Block[] {
  // Define alignValueFloor as a closure inside analyzeBlocks
  const alignValueFloor = (n: number, val: number = 8): number => {
    return Math.floor(n / val) * val;
  };

  const blocks: Block[] = [];
  const blockSize: number = Number(dbHeader1.iteration > dbHeader2.iteration ? dbHeader1.blockAllocSize : dbHeader2.blockAllocSize);
  const activeHeader: DatabaseHeader = dbHeader1.iteration > dbHeader2.iteration ? dbHeader1 : dbHeader2;
  const totalBlocks: number = Number(activeHeader.blockCount);
  const freeBlocks: Set<bigint> = new Set<bigint>();

  // Calculate segment size as a constant
  const blockHeaderSize: number = 8;
  const segmentSize: number = alignValueFloor((blockSize - blockHeaderSize) / META_SEGMENTS_PER_BLOCK);

  // Track used indexes within each metablock
  const metaBlockUsedIndexes: Map<string, Set<number>> = new Map<string, Set<number>>();

  // Parse a free list in a metadata block
  if (activeHeader.freeList.pointer !== INVALID_BLOCK) {
    // Track the freelist chain
    let freeListBlockId: bigint = activeHeader.freeList.blockId;
    let freeListBlockIndex: number = activeHeader.freeList.blockIndex;

    // Add freelist index to used indexes
    const blockKey: string = freeListBlockId.toString();
    if (!metaBlockUsedIndexes.has(blockKey)) {
      metaBlockUsedIndexes.set(blockKey, new Set<number>());
    }
    metaBlockUsedIndexes.get(blockKey)!.add(freeListBlockIndex);

    const blockOffset: number = BLOCK_START + Number(freeListBlockId) * blockSize + blockHeaderSize +
                       (freeListBlockIndex * segmentSize);

    // Check if not exceeding buffer size
    if (blockOffset < 0 || blockOffset >= buffer.byteLength) {
      throw new Error(`Invalid meta block for free list: blockId=${freeListBlockId}, blockIndex=${freeListBlockIndex}`);
    }

    // Read the total number of free blocks in the first metadata block
    const view: DataView = new DataView(buffer, blockOffset);
    const freeListCount: bigint = view.getBigUint64(8, true);
    console.log(`Free list count: ${freeListCount}`);
    if (freeListCount > BigInt(Math.floor(segmentSize / 8) - 2)) {
      throw new Error(`Free list count is too large: count=${freeListCount}`);
    }

    // Read free block IDs
    for (let i: number = 0; i < freeListCount; i++) {
      const blockId: bigint = view.getBigUint64(16 + i * 8, true);
      freeBlocks.add(blockId);
    }
  }

  // Track the metadata block chain
  let currentMetaBlockPointer: bigint = activeHeader.metaBlock.pointer;
  let currentMetaBlockId: bigint = activeHeader.metaBlock.blockId;
  let currentMetaBlockIndex: number = activeHeader.metaBlock.blockIndex;
  while (currentMetaBlockPointer !== INVALID_BLOCK) {
    try {
      // Add metadata index to used indexes
      const blockKey: string = currentMetaBlockId.toString();
      if (!metaBlockUsedIndexes.has(blockKey)) {
        metaBlockUsedIndexes.set(blockKey, new Set<number>());
      }
      metaBlockUsedIndexes.get(blockKey)!.add(currentMetaBlockIndex);

      const blockOffset: number = BLOCK_START + Number(currentMetaBlockId) * blockSize + blockHeaderSize +
                         (currentMetaBlockIndex * segmentSize);
      // Check if not exceeding buffer size
      if (blockOffset < 0 || blockOffset >= buffer.byteLength) {
        throw new Error(`Invalid meta block offset: ${blockOffset}, buffer size: ${buffer.byteLength}`);
      }
      const view: DataView = new DataView(buffer, blockOffset);
      const nextBlockPointer: bigint = view.getBigUint64(0, true);
      currentMetaBlockPointer = nextBlockPointer;
      currentMetaBlockId = getBlockId(nextBlockPointer);
      currentMetaBlockIndex = getBlockIndex(nextBlockPointer);
    } catch (error) {
      console.error(`Error processing metadata block ${currentMetaBlockId}:`, error);
      break;
    }
  }

  // Set the status of blocks
  for (let i: number = 0; i < totalBlocks; i++) {
    try {
      const blockId: bigint = BigInt(i);
      const blockKey: string = blockId.toString();
      const offset: number = BLOCK_START + i * blockSize;
      // Check if not exceeding buffer size
      if (offset < 0 || offset >= buffer.byteLength) {
        console.error(`Invalid block offset for block ${i}: ${offset}, buffer size: ${buffer.byteLength}`);
        blocks.push({ id: blockId, status: BlockStatus.INVALID });
        continue;
      }
      const view: DataView = new DataView(buffer, offset);
      const checksum: bigint = view.getBigUint64(0, true);

      // Use metaBlockUsedIndexes.has(blockKey) instead of metadataBlocks.has(blockId)
      if (metaBlockUsedIndexes.has(blockKey)) {
        // This is a metadata block
        // Prepare the metaSegments array with usage information
        const usedIndexes: Set<number> = metaBlockUsedIndexes.get(blockKey) || new Set<number>();

        const metaSegments: Array<{used: boolean, index: number}> = Array.from({ length: META_SEGMENTS_PER_BLOCK }, (_, j) => ({
          used: usedIndexes.has(j),
          index: j
        }));

        // Add the metadata block with segment information
        blocks.push({
          id: blockId,
          status: BlockStatus.METADATA,
          offset,
          checksum,
          metaSegments
        });
      } else if (freeBlocks.has(blockId)) {
        blocks.push({ id: blockId, status: BlockStatus.FREE, offset, checksum });
      } else {
        blocks.push({ id: blockId, status: BlockStatus.USED, offset, checksum });
      }
    } catch (error) {
      console.error(`Error processing block ${i}:`, error);
      blocks.push({ id: BigInt(i), status: BlockStatus.INVALID });
    }
  }

  return blocks;
}