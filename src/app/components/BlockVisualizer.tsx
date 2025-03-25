import { Block, BlockStatus } from '../utils/duckdb-parser';

interface BlockVisualizerProps {
  blocks: Block[];
  blockSize: number;
}

const statusColors = {
  [BlockStatus.FREE]: 'bg-gray-200',
  [BlockStatus.USED]: 'bg-blue-500',
  [BlockStatus.METADATA]: 'bg-green-500',
  [BlockStatus.INVALID]: 'bg-red-500'
};

const statusLabels = {
  [BlockStatus.FREE]: 'Free Block',
  [BlockStatus.USED]: 'In Use',
  [BlockStatus.METADATA]: 'Metadata',
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
  // Calculate the sub-block size for metadata blocks
  const metadataBlockSize = Math.floor(blockSize / 64);

  return (
    <div className="mt-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Block Usage Status</h2>
        <div className="text-sm text-gray-600">
          Block Size: {formatSize(blockSize)}
          {blocks.some(block => block.status === BlockStatus.METADATA) && (
            <span className="ml-2">
              (Metadata Sub-block: {formatSize(metadataBlockSize)})
            </span>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="mb-4 flex gap-4">
        {Object.entries(statusColors).map(([status, color]) => (
          <div key={status} className="flex items-center">
            <div className={`w-4 h-4 ${color} mr-2`}></div>
            <span>{statusLabels[status as BlockStatus]}</span>
          </div>
        ))}
      </div>

      {/* Block Grid */}
      <div className="grid grid-cols-16 gap-1 bg-gray-100 p-4 rounded-lg">
        {blocks.map((block) => (
          <div key={block.id} className="relative w-6 h-6">
            {block.status === BlockStatus.METADATA ? (
              <div className="absolute inset-0 grid grid-cols-8 gap-[0.5px] bg-gray-300 p-[0.5px] rounded">
                {Array.from({ length: 64 }).map((_, i) => (
                  <div
                    key={i}
                    className={`${statusColors[BlockStatus.METADATA]}`}
                    title={`Metadata Sub-block ${i}
Block ${block.id}
Status: ${statusLabels[block.status]}
Offset: ${block.offset !== undefined ? block.offset + (i * metadataBlockSize) : 'N/A'}
Size: ${formatSize(metadataBlockSize)}`}
                  />
                ))}
              </div>
            ) : (
              <div
                className={`w-full h-full ${statusColors[block.status]} rounded cursor-pointer transition-colors hover:opacity-80`}
                title={`Block ${block.id}
Status: ${statusLabels[block.status]}
Offset: ${block.offset !== undefined ? block.offset : 'N/A'}
Checksum: ${block.checksum !== undefined ? block.checksum : 'N/A'}
Size: ${formatSize(blockSize)}`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}