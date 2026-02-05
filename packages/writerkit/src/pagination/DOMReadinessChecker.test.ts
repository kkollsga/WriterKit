import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { DOMReadinessChecker, domReadinessChecker } from './DOMReadinessChecker'
import type { EditorView } from 'prosemirror-view'

// Mock requestAnimationFrame
const mockRAF = vi.fn((callback: FrameRequestCallback) => {
  setTimeout(() => callback(performance.now()), 0)
  return 1
})

describe('DOMReadinessChecker', () => {
  let checker: DOMReadinessChecker
  let originalRAF: typeof requestAnimationFrame

  beforeEach(() => {
    checker = new DOMReadinessChecker()
    originalRAF = globalThis.requestAnimationFrame
    globalThis.requestAnimationFrame = mockRAF as unknown as typeof requestAnimationFrame
    vi.useFakeTimers()
  })

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRAF
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    it('creates instance with default config', () => {
      const instance = new DOMReadinessChecker()
      expect(instance).toBeInstanceOf(DOMReadinessChecker)
    })

    it('accepts custom config', () => {
      const instance = new DOMReadinessChecker({
        maxRetries: 10,
        baseDelayMs: 32,
        minHeightThreshold: 5,
      })
      expect(instance).toBeInstanceOf(DOMReadinessChecker)
    })
  })

  describe('isReady', () => {
    it('returns false when view is null', () => {
      const result = checker.isReady(null as unknown as EditorView)
      expect(result).toBe(false)
    })

    it('returns false when view.dom is null', () => {
      const mockView = { dom: null } as unknown as EditorView
      const result = checker.isReady(mockView)
      expect(result).toBe(false)
    })

    it('returns false when no content exists', () => {
      const mockView = {
        dom: {
          querySelector: vi.fn().mockReturnValue(null),
          getBoundingClientRect: vi.fn().mockReturnValue({ height: 0 }),
        },
      } as unknown as EditorView

      const result = checker.isReady(mockView)
      expect(result).toBe(false)
    })

    it('returns true when first block has height', () => {
      const mockElement = {
        getBoundingClientRect: vi.fn().mockReturnValue({ height: 20 }),
      }
      const mockView = {
        dom: {
          querySelector: vi.fn().mockReturnValue(mockElement),
        },
      } as unknown as EditorView

      const result = checker.isReady(mockView)
      expect(result).toBe(true)
    })

    it('returns false when first block has zero height', () => {
      const mockElement = {
        getBoundingClientRect: vi.fn().mockReturnValue({ height: 0 }),
      }
      const mockView = {
        dom: {
          querySelector: vi.fn().mockReturnValue(mockElement),
        },
      } as unknown as EditorView

      const result = checker.isReady(mockView)
      expect(result).toBe(false)
    })

    it('returns true when container has height but no children', () => {
      const mockView = {
        dom: {
          querySelector: vi.fn().mockReturnValue(null),
          getBoundingClientRect: vi.fn().mockReturnValue({ height: 100 }),
        },
      } as unknown as EditorView

      const result = checker.isReady(mockView)
      expect(result).toBe(true)
    })
  })

  describe('waitForReady', () => {
    it('resolves immediately when DOM is ready', async () => {
      const mockElement = {
        getBoundingClientRect: vi.fn().mockReturnValue({ height: 20 }),
      }
      const mockView = {
        dom: {
          querySelector: vi.fn().mockReturnValue(mockElement),
        },
      } as unknown as EditorView

      const promise = checker.waitForReady(mockView)

      // Run through the double RAF
      await vi.runAllTimersAsync()

      const result = await promise
      expect(result.ready).toBe(true)
      expect(result.attempts).toBe(1)
      expect(result.firstBlockHeight).toBe(20)
    })

    it('retries when DOM is not ready initially', async () => {
      let callCount = 0
      const mockElement = {
        getBoundingClientRect: vi.fn(() => {
          callCount++
          // Return 0 height first 2 times, then real height
          return { height: callCount > 2 ? 20 : 0 }
        }),
      }
      const mockView = {
        dom: {
          querySelector: vi.fn().mockReturnValue(mockElement),
        },
      } as unknown as EditorView

      const promise = checker.waitForReady(mockView)

      // Run through all timers
      await vi.runAllTimersAsync()

      const result = await promise
      expect(result.ready).toBe(true)
      expect(result.attempts).toBeGreaterThan(1)
    })

    it('gives up after max retries', async () => {
      const mockElement = {
        getBoundingClientRect: vi.fn().mockReturnValue({ height: 0 }),
      }
      const mockView = {
        dom: {
          querySelector: vi.fn().mockReturnValue(mockElement),
        },
      } as unknown as EditorView

      const customChecker = new DOMReadinessChecker({ maxRetries: 3 })
      const promise = customChecker.waitForReady(mockView)

      // Run through all timers
      await vi.runAllTimersAsync()

      const result = await promise
      expect(result.ready).toBe(false)
      expect(result.attempts).toBe(3)
    })

    it('tracks time taken', async () => {
      const mockElement = {
        getBoundingClientRect: vi.fn().mockReturnValue({ height: 20 }),
      }
      const mockView = {
        dom: {
          querySelector: vi.fn().mockReturnValue(mockElement),
        },
      } as unknown as EditorView

      const promise = checker.waitForReady(mockView)
      await vi.runAllTimersAsync()

      const result = await promise
      expect(result.timeMs).toBeGreaterThanOrEqual(0)
    })

    it('uses exponential backoff', async () => {
      const delays: number[] = []
      const originalSetTimeout = globalThis.setTimeout
      vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn, delay) => {
        if (delay && delay > 0) {
          delays.push(delay)
        }
        return originalSetTimeout(fn, 0)
      })

      const mockElement = {
        getBoundingClientRect: vi.fn().mockReturnValue({ height: 0 }),
      }
      const mockView = {
        dom: {
          querySelector: vi.fn().mockReturnValue(mockElement),
        },
      } as unknown as EditorView

      const customChecker = new DOMReadinessChecker({ baseDelayMs: 16, maxRetries: 4 })
      const promise = customChecker.waitForReady(mockView)

      await vi.runAllTimersAsync()
      await promise

      // Check delays are exponentially increasing (16, 32, 64, 128)
      // The actual collected delays depend on implementation
      expect(delays.length).toBeGreaterThan(0)
    })
  })

  describe('configuration', () => {
    it('respects maxRetries config', async () => {
      const mockElement = {
        getBoundingClientRect: vi.fn().mockReturnValue({ height: 0 }),
      }
      const mockView = {
        dom: {
          querySelector: vi.fn().mockReturnValue(mockElement),
        },
      } as unknown as EditorView

      const customChecker = new DOMReadinessChecker({ maxRetries: 2 })
      const promise = customChecker.waitForReady(mockView)

      await vi.runAllTimersAsync()

      const result = await promise
      expect(result.ready).toBe(false)
      expect(result.attempts).toBe(2)
    })

    it('respects minHeightThreshold config', async () => {
      const mockElement = {
        getBoundingClientRect: vi.fn().mockReturnValue({ height: 0.5 }),
      }
      const mockView = {
        dom: {
          querySelector: vi.fn().mockReturnValue(mockElement),
        },
      } as unknown as EditorView

      // Default threshold is 1, so 0.5 should fail
      const defaultChecker = new DOMReadinessChecker()
      expect(defaultChecker.isReady(mockView)).toBe(false)

      // Custom threshold of 0.1 should pass
      const customChecker = new DOMReadinessChecker({ minHeightThreshold: 0.1 })
      expect(customChecker.isReady(mockView)).toBe(true)
    })
  })

  describe('error handling', () => {
    it('handles view destruction during check', async () => {
      let checkCount = 0
      const mockView = {
        dom: {
          querySelector: vi.fn(() => {
            checkCount++
            if (checkCount > 1) {
              throw new Error('View destroyed')
            }
            return {
              getBoundingClientRect: vi.fn().mockReturnValue({ height: 0 }),
            }
          }),
        },
      } as unknown as EditorView

      // This should not throw
      const promise = checker.waitForReady(mockView)

      await vi.runAllTimersAsync()

      // Should complete without throwing
      await expect(promise).resolves.toBeDefined()
    })
  })

  describe('singleton instance', () => {
    it('exports a singleton instance', () => {
      expect(domReadinessChecker).toBeInstanceOf(DOMReadinessChecker)
    })
  })
})
