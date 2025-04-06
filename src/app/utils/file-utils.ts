/**
 * Maximum file size limit for DuckDB database files (512 MB)
 * This constant defines the upper limit for files that can be processed
 * by the application, preventing memory issues with excessively large files.
 *
 * The value is expressed in bytes: 512 * 1024 * 1024 = 536,870,912 bytes
 */
export const MAX_FILE_SIZE: number = 512 * 1024 * 1024;