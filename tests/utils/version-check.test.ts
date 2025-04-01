import { describe, it, expect } from 'vitest';
import { isVersionSupported } from '../../src/app/page';

// Import the function from src/app/page.tsx
// No need to recreate the function here anymore

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