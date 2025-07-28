import { vi } from 'vitest';

// Mock console.log to reduce test output noise
vi.spyOn(console, 'log').mockImplementation(() => {});

// Mock console.error to capture error calls in tests
vi.spyOn(console, 'error').mockImplementation(() => {});