/**
 * Checks if the provided version string is at least v1.2.0
 * Handles version strings like 'v1.2.0' and 'v1.2.18e52ec4395'
 */
export function isVersionSupported(versionStr: string): boolean {
  // If empty or not starting with 'v', reject
  if (!versionStr || !versionStr.startsWith('v')) {
    return false;
  }

  try {
    // Extract version numbers, ignoring commit hash if present
    const versionMatch = versionStr.match(/^v(\d+)\.(\d+)\.(\d+)/);
    if (!versionMatch) {
      return false;
    }

    const major = parseInt(versionMatch[1], 10);
    const minor = parseInt(versionMatch[2], 10);
    const patch = parseInt(versionMatch[3], 10);

    // v1.2.0 or higher
    if (major > 1) return true;
    if (major === 1 && minor > 2) return true;
    if (major === 1 && minor === 2 && patch >= 0) return true;

    return false;
  } catch (e) {
    return false;
  }
}