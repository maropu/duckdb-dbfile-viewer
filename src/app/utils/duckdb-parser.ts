export const MAGIC_BYTES = "DUCK";
export const FILE_HEADER_SIZE = 4096;
export const MAX_VERSION_SIZE = 64;
export const CHECKSUM_SIZE = 8;
export const BLOCK_HEADER_SIZE = 8; // Size of the checksum

export enum BlockStatus {
  FREE = 'free',
  USED = 'used',
  METADATA = 'metadata',
  META_SEGMENT_USED = 'meta_segment_used',  // Used segment within a metablock
  META_SEGMENT_FREE = 'meta_segment_free',  // Free segment within a metablock
  INVALID = 'invalid'
}

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

/**
 * Extracts the actual block ID from a MetaBlockPointer value by masking out the upper 8 bits
 * This implements the equivalent of: block_id_t(block_pointer & ~(idx_t(0xFF) << 56ULL))
 */
export function getBlockId(blockPointer: bigint): bigint {
  // Calculate idx_t(0xFF) << 56ULL
  const mask = BigInt(0xFF) << BigInt(56);

  // Apply NOT (~) to get ~(idx_t(0xFF) << 56ULL)
  const invertedMask = ~mask;

  // Return block_pointer & invertedMask
  return blockPointer & invertedMask;
}

/**
 * Extracts the block index from the upper 8 bits of a MetaBlockPointer
 */
export function getBlockIndex(blockPointer: bigint): number {
  // Extract the upper 8 bits
  const mask = BigInt(0xFF) << BigInt(56);
  const indexBits = blockPointer & mask;
  // Shift back to get the actual value
  return Number(indexBits >> BigInt(56));
}

export function parseDatabaseHeader(buffer: ArrayBuffer, headerOffset: number): DatabaseHeader {
  const view = new DataView(buffer);
  let offset = headerOffset;

  // Read checksum
  const checksum = view.getBigUint64(offset, true);
  offset += CHECKSUM_SIZE;

  const iteration = view.getBigUint64(offset, true);
  offset += 8;

  const rawMetaBlock = view.getBigUint64(offset, true);
  // Store block ID and block index
  const metaBlock = {
    pointer: rawMetaBlock,
    blockId: getBlockId(rawMetaBlock),
    blockIndex: getBlockIndex(rawMetaBlock)
  };
  offset += 8;

  const rawFreeList = view.getBigUint64(offset, true);
  // Store block ID and block index
  const freeList = {
    pointer: rawFreeList,
    blockId: getBlockId(rawFreeList),
    blockIndex: getBlockIndex(rawFreeList)
  };
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
const INVALID_BLOCK = BigInt("0xFFFFFFFFFFFFFFFF");
const BLOCK_START = FILE_HEADER_SIZE * 3;
export const META_SEGMENTS_PER_BLOCK = 64; // Each metablock is divided into 64 segments

export function analyzeBlocks(buffer: ArrayBuffer, dbHeader1: DatabaseHeader, dbHeader2: DatabaseHeader): Block[] {
  const blocks: Block[] = [];
  const blockSize = Number(dbHeader1.iteration > dbHeader2.iteration ? dbHeader1.blockAllocSize : dbHeader2.blockAllocSize);
  const activeHeader = dbHeader1.iteration > dbHeader2.iteration ? dbHeader1 : dbHeader2;
  const totalBlocks = Number(activeHeader.blockCount);
  const freeBlocks = new Set<bigint>();

  // Calculate segment size as a constant
  const segmentSize = blockSize / META_SEGMENTS_PER_BLOCK;

  // Track used indexes within each metablock
  const metaBlockUsedIndexes = new Map<string, Set<number>>();

  // Track the freelist chain
  let currentFreeListBlockPointer = activeHeader.freeList.pointer;
  let currentFreeListBlockId = activeHeader.freeList.blockId;
  let currentFreeListBlockIndex = activeHeader.freeList.blockIndex;
  let remainingFreeBlocks = BigInt(0); // Number of remaining free blocks to read

  while (currentFreeListBlockPointer !== INVALID_BLOCK) {
    try {
      // Add freelist index to used indexes
      const blockKey = currentFreeListBlockId.toString();
      if (!metaBlockUsedIndexes.has(blockKey)) {
        metaBlockUsedIndexes.set(blockKey, new Set<number>());
      }
      metaBlockUsedIndexes.get(blockKey)!.add(currentFreeListBlockIndex);

      const blockOffset = BLOCK_START + Number(currentFreeListBlockId) * blockSize +
                         (currentFreeListBlockIndex * segmentSize);

      // Check if not exceeding buffer size
      if (blockOffset < 0 || blockOffset >= buffer.byteLength) {
        console.error(`Invalid block offset: ${blockOffset}, buffer size: ${buffer.byteLength}`);
        break;
      }
      const view = new DataView(buffer, blockOffset);

      // Read pointer to the next metablock (first 8 bytes of all metablocks)
      const nextBlockPointer = view.getBigUint64(0, true);
      const nextBlockId = getBlockId(nextBlockPointer);
      const nextBlockIndex = getBlockIndex(nextBlockPointer);
      let offset = 8; // After the next pointer

      if (currentFreeListBlockId === activeHeader.freeList.blockId) {
        // Only for the first metablock, read the total number of free blocks
        const freeListCount = view.getBigUint64(offset, true);
        remainingFreeBlocks = freeListCount; // Set the total count
        offset += 8;
      }

      if (remainingFreeBlocks > BigInt(0)) {
        // Calculate how many free block IDs can be read from this block
        const maxIdsInBlock = Math.floor((segmentSize - offset) / 8);
        const idsToRead = Number(remainingFreeBlocks < BigInt(maxIdsInBlock) ? remainingFreeBlocks : BigInt(maxIdsInBlock));

        // Read free block IDs
        for (let i = 0; i < idsToRead; i++) {
          const rawBlockId = view.getBigUint64(offset, true);
          const blockId = getBlockId(rawBlockId);
          if (blockId !== getBlockId(INVALID_BLOCK)) {
            freeBlocks.add(blockId);
          }
          offset += 8;
        }
        remainingFreeBlocks -= BigInt(idsToRead);
      }

      // Move to the next metablock
      currentFreeListBlockPointer = nextBlockPointer;
      currentFreeListBlockId = nextBlockId;
      currentFreeListBlockIndex = nextBlockIndex;
    } catch (error) {
      console.error(`Error processing free list block ${currentFreeListBlockId}:`, error);
      break;
    }
  }

  // Track the metadata block chain
  let currentMetaBlockPointer = activeHeader.metaBlock.pointer;
  let currentMetaBlockId = activeHeader.metaBlock.blockId;
  let currentMetaBlockIndex = activeHeader.metaBlock.blockIndex;
  while (currentMetaBlockPointer !== INVALID_BLOCK) {
    try {
      // Add metadata index to used indexes
      const blockKey = currentMetaBlockId.toString();
      if (!metaBlockUsedIndexes.has(blockKey)) {
        metaBlockUsedIndexes.set(blockKey, new Set<number>());
      }
      metaBlockUsedIndexes.get(blockKey)!.add(currentMetaBlockIndex);

      const blockOffset = BLOCK_START + Number(currentMetaBlockId) * blockSize +
                         (currentMetaBlockIndex * segmentSize);
      // Check if not exceeding buffer size
      if (blockOffset < 0 || blockOffset >= buffer.byteLength) {
        console.error(`Invalid meta block offset: ${blockOffset}, buffer size: ${buffer.byteLength}`);
        break;
      }
      const view = new DataView(buffer, blockOffset);
      const nextBlockPointer = view.getBigUint64(0, true);
      currentMetaBlockPointer = nextBlockPointer;
      currentMetaBlockId = getBlockId(nextBlockPointer);
      currentMetaBlockIndex = getBlockIndex(nextBlockPointer);
    } catch (error) {
      console.error(`Error processing metadata block ${currentMetaBlockId}:`, error);
      break;
    }
  }

  // Set the status of blocks
  for (let i = 0; i < totalBlocks; i++) {
    try {
      const blockId = BigInt(i);
      const blockKey = blockId.toString();
      const offset = BLOCK_START + i * blockSize;
      // Check if not exceeding buffer size
      if (offset < 0 || offset >= buffer.byteLength) {
        console.error(`Invalid block offset for block ${i}: ${offset}, buffer size: ${buffer.byteLength}`);
        blocks.push({ id: blockId, status: BlockStatus.INVALID });
        continue;
      }
      const view = new DataView(buffer, offset);
      const checksum = view.getBigUint64(0, true);

      // Use metaBlockUsedIndexes.has(blockKey) instead of metadataBlocks.has(blockId)
      if (metaBlockUsedIndexes.has(blockKey)) {
        // This is a metadata block
        // Prepare the metaSegments array with usage information
        const usedIndexes = metaBlockUsedIndexes.get(blockKey) || new Set<number>();

        const metaSegments = Array.from({ length: META_SEGMENTS_PER_BLOCK }, (_, j) => ({
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