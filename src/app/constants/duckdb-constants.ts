/**
 * Constants related to DuckDB file format and parsing
 * Contains all the fixed values used in DuckDB file processing
 */
export namespace DuckDBConstants {
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
   * Number of segments per metadata block
   * Each metadata block is divided into this many segments
   */
  export const META_SEGMENTS_PER_BLOCK: number = 64;

  /**
   * Special value representing an invalid block pointer
   * Used to mark the end of metadata block chains
   */
  export const INVALID_BLOCK: bigint = BigInt("0xFFFFFFFFFFFFFFFF");

  /**
   * The offset where data blocks start in the file
   * After the three header blocks (main header and two database headers)
   */
  export const BLOCK_START: number = FILE_HEADER_SIZE * 3;
}