import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { analyzeBlocks, META_SEGMENTS_PER_BLOCK, BlockStatus } from '../../src/app/utils/duckdb-parser';
import { DatabaseHeader } from '../../src/app/utils/duckdb-parser';

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
    // Create a buffer large enough for a few blocks
    const blockSize = 4096;
    const numBlocks = 8; // Increase buffer size
    const buffer = new ArrayBuffer(BLOCK_START + blockSize * numBlocks);
    const view = new DataView(buffer);

    // Initialize file headers with some dummy data (3 * FILE_HEADER_SIZE bytes)
    for (let i = 0; i < BLOCK_START; i += 8) {
      view.setBigUint64(i, BigInt(0), true);
    }

    // Set up a metadata block at position 1
    const metaBlockId = 1;
    const metaBlockOffset = BLOCK_START + blockSize * metaBlockId;

    // Set up a few used segments in the metadata block
    const usedSegments = [0, 2, 5, 10, 20, 30, 40, 63]; // Example segments that are used

    // Mark segments as used and set the next segment pointer properly
    usedSegments.forEach((segmentIndex, arrayIndex) => {
      const segmentOffset = metaBlockOffset + 8 + segmentIndex * 8;

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

  describe('DuckDB Parser Tests', () => {
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
});