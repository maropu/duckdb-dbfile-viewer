/**
 * Checks if the provided version string is at least v1.2.0
 *
 * This function validates DuckDB version strings and determines if the version
 * meets the minimum supported version requirement (v1.2.0 or higher).
 *
 * @param versionStr - The version string to check (e.g. 'v1.2.0', 'v1.3.4', 'v1.2.18e52ec4395')
 * @returns True if the version is supported (v1.2.0 or higher), false otherwise
 *
 * @example
 * ```ts
 * isVersionSupported('v1.2.0'); // true
 * isVersionSupported('v1.3.4'); // true
 * isVersionSupported('v1.1.0'); // false
 * isVersionSupported('invalid'); // false
 * ```
 */
export function isVersionSupported(versionStr: string): boolean {
  // If empty or not starting with 'v', reject
  if (!versionStr || !versionStr.startsWith('v')) {
    return false;
  }

  try {
    // Extract version numbers, ignoring commit hash if present
    const versionMatch: RegExpMatchArray | null = versionStr.match(/^v(\d+)\.(\d+)\.(\d+)/);
    if (!versionMatch) {
      return false;
    }

    const major: number = parseInt(versionMatch[1], 10);
    const minor: number = parseInt(versionMatch[2], 10);
    const patch: number = parseInt(versionMatch[3], 10);

    // Check for v1.2.0 or higher using semantic versioning comparison
    if (major > 1) return true;
    if (major === 1 && minor > 2) return true;
    if (major === 1 && minor === 2 && patch >= 0) return true;

    return false;
  } catch (e: unknown) {
    // In case of any parsing errors, consider the version unsupported
    return false;
  }
}