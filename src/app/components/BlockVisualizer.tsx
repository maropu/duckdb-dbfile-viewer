import { Block, BlockStatus, META_SEGMENTS_PER_BLOCK } from '../utils/duckdb-parser';

interface BlockVisualizerProps {
  blocks: Block[];
  blockSize: number;
}

const statusColors = {
  [BlockStatus.FREE]: 'bg-yellow-400',
  [BlockStatus.USED]: 'bg-blue-500',
  [BlockStatus.METADATA]: 'bg-green-500',
  [BlockStatus.META_SEGMENT_USED]: 'bg-green-500',
  [BlockStatus.META_SEGMENT_FREE]: 'bg-yellow-400',
  [BlockStatus.INVALID]: 'bg-red-500'
};

const statusLabels = {
  [BlockStatus.FREE]: 'Free',
  [BlockStatus.USED]: 'Data',
  [BlockStatus.METADATA]: 'Metadata',
  [BlockStatus.META_SEGMENT_USED]: 'Metadata',
  [BlockStatus.META_SEGMENT_FREE]: 'Free Meta Segment',
  [BlockStatus.INVALID]: 'Invalid'
};

function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export default function BlockVisualizer({ blocks, blockSize }: BlockVisualizerProps) {
  // Calculate segment size as a constant
  const segmentSize = blockSize / META_SEGMENTS_PER_BLOCK;

  return (
    <div className="mt-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Block Usage Status</h2>
        <div className="text-sm text-gray-600">
          Block Size: {formatSize(blockSize)}
        </div>
      </div>

      {/* Legend */}
      <div className="mb-4 flex flex-wrap gap-4">
        {Object.entries(statusColors)
          .filter(([status]) => status !== BlockStatus.META_SEGMENT_FREE && status !== BlockStatus.META_SEGMENT_USED)
          .map(([status, color]) => (
            <div key={status} className="flex items-center">
              <div className={`w-4 h-4 ${color} mr-2`}></div>
              <span>{statusLabels[status as BlockStatus]}</span>
            </div>
          ))}
      </div>

      {/* Main Block Grid */}
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-2">File Blocks</h3>
        <div className="grid grid-cols-16 gap-1 bg-gray-100 p-4 rounded-lg" style={{ gridAutoFlow: 'dense' }}>
          {blocks.map((block) => {
            // Check if this is a metadata block with segments
            const isMetaBlock = block.status === BlockStatus.METADATA && block.metaSegments;

            // Calculate the position in the grid
            const blockNum = Number(block.id);
            const row = Math.floor(blockNum / 16);
            const col = blockNum % 16;

            // For metadata blocks, we need a special positioning to ensure they don't overlap
            const gridStyles = {
              gridColumnStart: col + 1,
              gridRowStart: row + 1,
              gridColumnEnd: 'span 1',
              gridRowEnd: 'span 1'
            };

            return (
              <div
                key={`block-${String(block.id)}`}
                className="relative"
                style={{
                  ...gridStyles,
                  width: '100%',
                  height: '100%',
                  minHeight: '32px',
                  minWidth: '32px'
                }}
              >
                {isMetaBlock ? (
                  // Render 8x8 grid of meta segments for metadata blocks
                  <div className="grid grid-cols-8 gap-0 w-full h-full overflow-hidden">
                    {block.metaSegments?.map((segment) => (
                      <div
                        key={`segment-${String(block.id)}-${segment.index}`}
                        className="relative"
                      >
                        <div
                          className={`w-full h-full ${segment.used ? statusColors[BlockStatus.META_SEGMENT_USED] : statusColors[BlockStatus.META_SEGMENT_FREE]} cursor-pointer transition-colors hover:opacity-80`}
                          title={`Block ${String(block.id)} - Segment ${segment.index}
Status: ${segment.used ? 'Used' : 'Free'}
Offset: ${block.offset !== undefined ? block.offset + segmentSize * segment.index : 'N/A'}`}
                          style={{ minHeight: '4px', minWidth: '4px' }}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  // Render regular block
                  <div
                    className={`w-full h-full ${statusColors[block.status]} rounded cursor-pointer transition-colors hover:opacity-80`}
                    title={`Block ${String(block.id)}
Status: ${statusLabels[block.status]}
Offset: ${block.offset !== undefined ? block.offset : 'N/A'}
Checksum: ${block.checksum !== undefined ? String(block.checksum) : 'N/A'}
Size: ${formatSize(blockSize)}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}