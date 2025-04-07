import { Block, BlockStatus } from '../utils/duckdb-parser';
import { DuckDBConstants } from '../constants';
import React from 'react';

/**
 * Props for the BlockVisualizer component
 * @interface BlockVisualizerProps
 */
interface BlockVisualizerProps {
  /** Array of blocks to visualize */
  blocks: Block[];
  /** Size of each block in bytes */
  blockSize: number;
}

/**
 * Mapping of block statuses to their display colors
 * @type {Record<BlockStatus, string>}
 */
const statusColors: Record<BlockStatus, string> = {
  [BlockStatus.FREE]: 'bg-yellow-400',
  [BlockStatus.USED]: 'bg-blue-500',
  [BlockStatus.METADATA]: 'bg-green-500',
  [BlockStatus.META_SEGMENT_USED]: 'bg-green-500',
  [BlockStatus.META_SEGMENT_FREE]: 'bg-yellow-400',
  [BlockStatus.INVALID]: 'bg-red-500'
};

/**
 * Mapping of block statuses to their display labels
 * @type {Record<BlockStatus, string>}
 */
const statusLabels: Record<BlockStatus, string> = {
  [BlockStatus.FREE]: 'Free',
  [BlockStatus.USED]: 'Data',
  [BlockStatus.METADATA]: 'Metadata',
  [BlockStatus.META_SEGMENT_USED]: 'Metadata',
  [BlockStatus.META_SEGMENT_FREE]: 'Free Meta Segment',
  [BlockStatus.INVALID]: 'Invalid'
};

/**
 * Formats a byte size to a human-readable string with appropriate units
 *
 * @param bytes - The size in bytes to format
 * @returns A formatted string with units (e.g., "1.5 MB")
 */
function formatSize(bytes: number): string {
  const units: string[] = ['B', 'KB', 'MB', 'GB'];
  let size: number = bytes;
  let unitIndex: number = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

// Function to determine the color based on usage percentage
function getUsageColor(block: Block, blockSize: number): string {
  if (block.status !== BlockStatus.USED || block.unusedBytes === undefined) {
    return statusColors[block.status];
  }

  const usedBytes = blockSize - block.unusedBytes;
  const usagePercentage = (usedBytes / blockSize) * 100;

  if (usagePercentage >= 75) {
    return 'bg-blue-800'; // Very high usage (75-100%)
  } else if (usagePercentage >= 50) {
    return 'bg-blue-600'; // High usage (50-75%)
  } else if (usagePercentage >= 25) {
    return 'bg-blue-400'; // Medium usage (25-50%)
  } else {
    return 'bg-blue-200'; // Low usage (0-25%)
  }
}

/**
 * BlockVisualizer component
 *
 * Renders a visual representation of DuckDB database file blocks,
 * showing their status and layout. Metadata blocks are displayed as
 * a grid of segments, while regular blocks are shown as solid squares.
 *
 * @param props - The component props
 * @returns A React component for visualizing DuckDB blocks
 */
export default function BlockVisualizer({ blocks, blockSize }: BlockVisualizerProps): React.ReactElement {
  // Calculate segment size as a constant
  const segmentSize: number = blockSize / DuckDBConstants.META_SEGMENTS_PER_BLOCK;

  // Check if there are any invalid blocks
  const hasInvalidBlocks = blocks.some(block => block.status === BlockStatus.INVALID);

  return (
    <div className="mt-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Block Usage Status</h2>
        <div className="text-sm text-gray-600">
          Block Size: {formatSize(blockSize)}
        </div>
      </div>

      {/* Legend */}
      <div className="mb-4">
        {/* Single row with all block types */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {/* Data usage levels */}
          <div className="flex items-center">
            <div className="w-4 h-4 bg-blue-800 mr-2"></div>
            <span>Data (75-100%)</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-blue-600 mr-2"></div>
            <span>Data (50-75%)</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-blue-400 mr-2"></div>
            <span>Data (25-50%)</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-blue-200 mr-2"></div>
            <span>Data (0-25%)</span>
          </div>
          {/* Other block types */}
          <div className="flex items-center">
            <div className={`w-4 h-4 ${statusColors[BlockStatus.METADATA]} mr-2`}></div>
            <span>Metadata</span>
          </div>
          <div className="flex items-center">
            <div className={`w-4 h-4 ${statusColors[BlockStatus.FREE]} mr-2`}></div>
            <span>Free</span>
          </div>
          {hasInvalidBlocks && (
            <div className="flex items-center">
              <div className={`w-4 h-4 ${statusColors[BlockStatus.INVALID]} mr-2`}></div>
              <span>Invalid</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Block Grid */}
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-2">File Blocks</h3>
        <div
          className="grid gap-1 bg-gray-100 p-4 rounded-lg"
          style={{
            gridTemplateColumns: 'repeat(16, minmax(0, 1fr))',
            gridAutoRows: '1fr',
            gridAutoFlow: 'dense'
          }}
        >
          {blocks.map((block) => {
            // Check if this is a metadata block with segments
            const isMetaBlock: boolean = block.status === BlockStatus.METADATA && !!block.metaSegments;

            // Calculate the position in the grid
            const blockNum: number = Number(block.id);
            const row: number = Math.floor(blockNum / 16);
            const col: number = blockNum % 16;

            // For metadata blocks, we need a special positioning to ensure they don't overlap
            const gridStyles: React.CSSProperties = {
              gridColumnStart: col + 1,
              gridRowStart: row + 1,
              gridColumnEnd: 'span 1',
              gridRowEnd: 'span 1'
            };

            return (
              <div
                key={`block-${String(block.id)}`}
                className="relative aspect-square"
                style={gridStyles}
              >
                {isMetaBlock ? (
                  // Render 8x8 grid of meta segments for metadata blocks
                  <div
                    className="grid w-full h-full"
                    style={{
                      gridTemplateColumns: 'repeat(8, 1fr)',
                      gridTemplateRows: 'repeat(8, 1fr)',
                    }}
                  >
                    {block.metaSegments?.map((segment) => {
                      const segmentColor: string = segment.used ?
                        statusColors[BlockStatus.META_SEGMENT_USED] :
                        statusColors[BlockStatus.META_SEGMENT_FREE];

                      return (
                        <div
                          key={`segment-${String(block.id)}-${segment.index}`}
                          className={`${segmentColor} cursor-pointer transition-colors hover:opacity-80`}
                          title={`Block ${String(block.id)} - Segment ${segment.index}
Status: ${segment.used ? 'Used' : 'Free'}
Offset: ${block.offset !== undefined ? block.offset + segmentSize * segment.index : 'N/A'}`}
                        />
                      );
                    })}
                  </div>
                ) : (
                  // Render regular block
                  <div
                    className={`w-full h-full ${getUsageColor(block, blockSize)} rounded cursor-pointer transition-colors hover:opacity-80`}
                    title={`Block ${String(block.id)}
Status: ${statusLabels[block.status]}
Offset: ${block.offset !== undefined ? block.offset : 'N/A'}
Checksum: ${block.checksum !== undefined ? String(block.checksum) : 'N/A'}
Size: ${formatSize(blockSize)}
${block.status === BlockStatus.USED && block.unusedBytes !== undefined ?
  `Used: ${formatSize(blockSize - block.unusedBytes)} (${Math.round((blockSize - block.unusedBytes) / blockSize * 100)}%)` : ''}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Define CSS styles directly */}
      <style jsx>{`
        .aspect-square {
          aspect-ratio: 1 / 1;
        }
      `}</style>
    </div>
  );
}