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
                className="relative aspect-square"
                style={{
                  ...gridStyles
                }}
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
                      const segmentColor = segment.used ?
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

      {/* Define CSS styles directly */}
      <style jsx>{`
        .aspect-square {
          aspect-ratio: 1 / 1;
        }
      `}</style>
    </div>
  );
}