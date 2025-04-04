import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { analyzeBlocks, META_SEGMENTS_PER_BLOCK, BlockStatus, parseMainHeader, parseDatabaseHeader } from '../../src/app/utils/duckdb-parser';
import { DatabaseHeader } from '../../src/app/utils/duckdb-parser';
import fs from 'fs';
import path from 'path';

describe('DuckDB Parser Tests', () => {
  // Constants for testing
  const FILE_HEADER_SIZE = 4096;
  const BLOCK_START = FILE_HEADER_SIZE * 3;

  // Spy on console.error to suppress errors during tests
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Create a more realistic test buffer
  const setupTestBuffer = () => {
    // Define alignValueFloor as a closure inside analyzeBlocks
    const alignValueFloor = (n: number, val = 8) => {
      return Math.floor(n / val) * val;
    };

    // Create a buffer large enough for a few blocks
    const blockSize = 4096;
    const blockHeaderSize = 8;
    const numBlocks = 8; // Increase buffer size
    const buffer = new ArrayBuffer(BLOCK_START + blockSize * numBlocks);
    const view = new DataView(buffer);

    // Initialize file headers with some dummy data (3 * FILE_HEADER_SIZE bytes)
    for (let i = 0; i < BLOCK_START; i += 8) {
      view.setBigUint64(i, BigInt(0), true);
    }

    const segmentSize = alignValueFloor((blockSize - blockHeaderSize) / META_SEGMENTS_PER_BLOCK);

    // Set up a metadata block at position 1
    const metaBlockId = 1;
    const metaBlockOffset = BLOCK_START + blockSize * metaBlockId + blockHeaderSize;

    // Set up a few used segments in the metadata block
    const usedSegments = [0, 2, 5, 10, 20, 30, 40, 63]; // Example segments that are used

    // Mark segments as used and set the next segment pointer properly
    usedSegments.forEach((segmentIndex, arrayIndex) => {
      const segmentOffset = metaBlockOffset + segmentIndex * segmentSize;

      // Correctly encode the next segment pointer
      // Format: [8 bits = segment index (0-63)] [56 bits = block id]
      let nextSegmentPointer: bigint;

      if (arrayIndex < usedSegments.length - 1) {
        // For all segments except the last one, point to the next segment in the same block
        // Encode: High 8 bits = next segment index, Low 56 bits = same block ID (metaBlockId)
        const nextSegmentIndex = usedSegments[arrayIndex + 1];
        nextSegmentPointer = (BigInt(nextSegmentIndex) << BigInt(56)) | (BigInt(metaBlockId) & BigInt("0x00FFFFFFFFFFFFFF"));
      } else {
        // For the last segment, use INVALID_BLOCK pointer
        nextSegmentPointer = BigInt("0xFFFFFFFFFFFFFFFF");
      }

      // Write the next segment pointer to the first 8 bytes of the segment
      view.setBigUint64(segmentOffset, nextSegmentPointer, true);
    });

    // Define all blocks except metadata block as data blocks
    const dataBlockIds = Array.from({length: numBlocks}, (_, i) => i).filter(i => i !== metaBlockId);

    return {
      buffer,
      usedSegments,
      metaBlockId,
      dataBlockIds
    };
  };

  const createMockHeader = (metaBlockPointer: bigint, freeListPointer: bigint): DatabaseHeader => {
    // Create a mock pointer with block ID and index
    const createPointer = (blockId: bigint) => {
      // Use a special encoding for the pointer that matches the implementation
      // Combine the block ID with a 0 index (low 56 bits for block ID, high 8 bits for index)
      const pointer = blockId === BigInt(-1)
        ? BigInt("0xFFFFFFFFFFFFFFFF") // INVALID_BLOCK
        : blockId;

      return {
        pointer,
        blockId,
        blockIndex: 0
      };
    };

    return {
      checksum: BigInt(0),
      iteration: BigInt(1),
      metaBlock: createPointer(metaBlockPointer),
      freeList: createPointer(freeListPointer),
      blockCount: BigInt(8), // Match buffer size
      blockAllocSize: BigInt(4096),
      vectorSize: BigInt(1024),
      serializationCompatibility: BigInt(0)
    };
  };

  describe('In-Memory Tests', () => {
    it('should identify metadata blocks correctly', () => {
      const { buffer, usedSegments, metaBlockId, dataBlockIds } = setupTestBuffer();
      const mockHeader = createMockHeader(BigInt(metaBlockId), BigInt(-1));

      const blocks = analyzeBlocks(buffer, mockHeader, mockHeader);

      // Verify that there is exactly one metadata block
      const metadataBlocks = blocks.filter(block => block.status === BlockStatus.METADATA);
      expect(metadataBlocks.length).toBe(1);

      // Verify that the correct number of data blocks are identified
      const dataBlocks = blocks.filter(block => block.status === BlockStatus.USED);
      expect(dataBlocks.length).toBe(dataBlockIds.length);

      // Verify that each data block has the correct ID
      dataBlockIds.forEach(dataBlockId => {
        const dataBlock = blocks.find(block => block.id === BigInt(dataBlockId));
        expect(dataBlock).toBeDefined();
        expect(dataBlock?.status).toBe(BlockStatus.USED);
      });

      const metaBlock = metadataBlocks[0];

      // Verify the block was identified correctly
      expect(metaBlock?.id.toString()).toBe(metaBlockId.toString());
      expect(metaBlock?.status).toBe(BlockStatus.METADATA);
      expect(metaBlock?.metaSegments).toBeDefined();

      // Verify metaSegments content is correct
      if (metaBlock && metaBlock.metaSegments) {
        const segments = metaBlock.metaSegments;

        // Make sure we have the correct number of segments
        expect(segments.length).toBe(META_SEGMENTS_PER_BLOCK);

        // Check that we have exactly the right number of used segments
        const usedSegmentCount = segments.filter(segment => segment.used).length;
        expect(usedSegmentCount).toBe(usedSegments.length);

        // Verify each used segment is marked correctly
        usedSegments.forEach(segmentIndex => {
          expect(segments[segmentIndex].used).toBe(true);
          expect(segments[segmentIndex].index).toBe(segmentIndex);
        });
      }
    }, 2000); // 2 second timeout
  });

  describe('Real DuckDB Files Tests', () => {
    const loadDbFile = (filename: string): ArrayBuffer => {
      const filePath = path.resolve(__dirname, '../fixtures', filename);
      const fileData = fs.readFileSync(filePath);
      // Use explicit type assertion to ensure it's treated as ArrayBuffer
      return fileData.buffer.slice(fileData.byteOffset, fileData.byteOffset + fileData.byteLength) as ArrayBuffer;
    };

    // Updated test function to remove redundant libraryVersionPattern parameter
    const testDuckDBFile = (
      version: string,
      totalBlocks: number,
      metadataBlocks: number,
      usedBlocks: number,
      freeBlocks: number
    ) => {
      it(`should correctly parse blocks in DuckDB ${version} database file`, () => {
        const filename = `testdb_t5_r200_${version}.db`;
        const buffer = loadDbFile(filename);

        // Parse headers
        const mainHeader = parseMainHeader(buffer);
        const dbHeader1 = parseDatabaseHeader(buffer, FILE_HEADER_SIZE);
        const dbHeader2 = parseDatabaseHeader(buffer, FILE_HEADER_SIZE * 2);

        // Get active header (the one with higher iteration)
        const activeHeader = dbHeader1.iteration > dbHeader2.iteration ? dbHeader1 : dbHeader2;

        // Analyze blocks
        const blocks = analyzeBlocks(buffer, dbHeader1, dbHeader2);

        // Test total block count
        expect(blocks.length).toBe(totalBlocks);

        // Verify that the metablock from the header is identified correctly
        const metaBlockId = activeHeader.metaBlock.blockId;
        const metaBlock = blocks.find(block => block.id === metaBlockId && block.status === BlockStatus.METADATA);
        expect(metaBlock).toBeDefined();

        // Count blocks by status
        const metadataBlocksFound = blocks.filter(b => b.status === BlockStatus.METADATA);
        const usedBlocksFound = blocks.filter(b => b.status === BlockStatus.USED);
        const freeBlocksFound = blocks.filter(b => b.status === BlockStatus.FREE);

        // Test block counts by status - using specific numeric values
        expect(metadataBlocksFound.length).toBe(metadataBlocks);
        expect(usedBlocksFound.length).toBe(usedBlocks);
        expect(freeBlocksFound.length).toBe(freeBlocks);

        // Check that we have metadata segments
        expect(metaBlock?.metaSegments).toBeDefined();
        expect(metaBlock?.metaSegments?.length).toBe(META_SEGMENTS_PER_BLOCK);

        // Check if we have some used metadata segments
        if (metaBlock && metaBlock.metaSegments) {
          const usedSegments = metaBlock.metaSegments.filter(segment => segment.used);
          expect(usedSegments.length).toBeGreaterThan(0);
        }

        // Generate library version pattern from version and validate
        const libraryVersionPattern = new RegExp(`^v${version}`);
        expect(mainHeader.libraryVersion).toMatch(libraryVersionPattern);

        // Log some info about the database file
        console.log(`DuckDB ${version} - Library version: ${mainHeader.libraryVersion}`);
        console.log(`DuckDB ${version} - Block count: ${activeHeader.blockCount}`);
        console.log(`DuckDB ${version} - Total blocks parsed: ${blocks.length}`);
        console.log(`DuckDB ${version} - Metadata blocks: ${metadataBlocksFound.length}`);
        console.log(`DuckDB ${version} - Used blocks: ${usedBlocksFound.length}`);
        console.log(`DuckDB ${version} - Free blocks: ${freeBlocksFound.length}`);
      }, 5000); // 5 second timeout for file operations
    };

    // Specify expected values for each version without redundancy
    testDuckDBFile('1.2.0', 7, 1, 6, 0);
    testDuckDBFile('1.2.1', 7, 1, 6, 0);
  });
});