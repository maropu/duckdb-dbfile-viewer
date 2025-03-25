import { Block, BlockStatus } from '../utils/duckdb-parser';

interface BlockVisualizerProps {
  blocks: Block[];
}

const statusColors = {
  [BlockStatus.FREE]: 'bg-gray-200',
  [BlockStatus.USED]: 'bg-blue-500',
  [BlockStatus.METADATA]: 'bg-green-500',
  [BlockStatus.INVALID]: 'bg-red-500'
};

const statusLabels = {
  [BlockStatus.FREE]: 'フリーブロック',
  [BlockStatus.USED]: '使用中',
  [BlockStatus.METADATA]: 'メタデータ',
  [BlockStatus.INVALID]: '無効'
};

export default function BlockVisualizer({ blocks }: BlockVisualizerProps) {
  return (
    <div className="mt-8">
      <h2 className="text-xl font-semibold mb-4">ブロック使用状況</h2>

      {/* 凡例 */}
      <div className="mb-4 flex gap-4">
        {Object.entries(statusColors).map(([status, color]) => (
          <div key={status} className="flex items-center">
            <div className={`w-4 h-4 ${color} mr-2`}></div>
            <span>{statusLabels[status as BlockStatus]}</span>
          </div>
        ))}
      </div>

      {/* ブロックグリッド */}
      <div className="grid grid-cols-16 gap-1 bg-gray-100 p-4 rounded-lg">
        {blocks.map((block) => (
          <div
            key={block.id}
            className={`w-6 h-6 ${statusColors[block.status]} rounded cursor-pointer transition-colors hover:opacity-80`}
            title={`Block ${block.id}
Status: ${statusLabels[block.status]}
Offset: ${block.offset}
Checksum: ${block.checksum}`}
          />
        ))}
      </div>
    </div>
  );
}