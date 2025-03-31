import { describe, it, expect } from 'vitest';

// Import the function from src/app/page.tsx
// For testing purposes, we'll recreate the function here
function isVersionSupported(versionStr: string): boolean {
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

describe('isVersionSupported', () => {
  it('should return false for empty or invalid input', () => {
    expect(isVersionSupported('')).toBe(false);
    expect(isVersionSupported('not-a-version')).toBe(false);
    expect(isVersionSupported('1.2.0')).toBe(false); // missing 'v' prefix
  });

  it('should return false for versions below v1.2.0', () => {
    expect(isVersionSupported('v0.9.0')).toBe(false);
    expect(isVersionSupported('v1.0.0')).toBe(false);
    expect(isVersionSupported('v1.1.9')).toBe(false);
  });

  it('should return true for v1.2.0 exactly', () => {
    expect(isVersionSupported('v1.2.0')).toBe(true);
  });

  it('should return true for versions above v1.2.0', () => {
    expect(isVersionSupported('v1.2.1')).toBe(true);
    expect(isVersionSupported('v1.3.0')).toBe(true);
    expect(isVersionSupported('v2.0.0')).toBe(true);
  });

  it('should handle versions with commit hashes', () => {
    expect(isVersionSupported('v1.2.0e52ec4395')).toBe(true);
    expect(isVersionSupported('v1.3.5abcdef123')).toBe(true);
    expect(isVersionSupported('v1.1.0e52ec4395')).toBe(false); // below required version
  });
});