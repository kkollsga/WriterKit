/**
 * DOMReadinessChecker - Waits for DOM to be ready for measurement
 *
 * Ensures that the editor DOM has actually rendered before attempting
 * to measure block heights for pagination. Uses double RAF + exponential
 * backoff to handle various rendering scenarios.
 */

import type { EditorView } from 'prosemirror-view'

/**
 * Configuration for DOM readiness checking
 */
export interface DOMReadinessConfig {
  /** Maximum number of retry attempts */
  maxRetries: number
  /** Base delay in milliseconds (will be doubled each retry) */
  baseDelayMs: number
  /** Minimum height threshold to consider block rendered */
  minHeightThreshold: number
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: DOMReadinessConfig = {
  maxRetries: 5,
  baseDelayMs: 16, // ~1 frame at 60fps
  minHeightThreshold: 1, // pixels
}

/**
 * Result of a DOM readiness check
 */
export interface DOMReadinessResult {
  /** Whether the DOM is ready for measurement */
  ready: boolean
  /** Number of attempts made */
  attempts: number
  /** Time taken in milliseconds */
  timeMs: number
  /** First measured block height (for debugging) */
  firstBlockHeight?: number
}

/**
 * Waits for the editor DOM to be ready for pagination measurement.
 *
 * The DOM might not be rendered immediately after mounting the editor
 * component. This utility waits until content has actual dimensions.
 *
 * @example
 * ```typescript
 * const checker = new DOMReadinessChecker()
 *
 * // Wait for DOM to be ready
 * const result = await checker.waitForReady(editorView)
 * if (result.ready) {
 *   reflowEngine.forceFullReflow()
 * }
 * ```
 */
export class DOMReadinessChecker {
  private config: DOMReadinessConfig

  constructor(config: Partial<DOMReadinessConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Wait for the DOM to be ready for measurement
   *
   * Uses double requestAnimationFrame to ensure we're past the paint cycle,
   * then checks if content has rendered with retries.
   *
   * @param view - The ProseMirror EditorView
   * @returns Promise resolving to readiness result
   */
  waitForReady(view: EditorView): Promise<DOMReadinessResult> {
    const startTime = performance.now()

    return new Promise((resolve) => {
      // Double RAF ensures we're past the current paint cycle
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.checkWithRetry(view, 0, startTime, resolve)
        })
      })
    })
  }

  /**
   * Check if DOM is ready, with exponential backoff retry
   */
  private checkWithRetry(
    view: EditorView,
    attempt: number,
    startTime: number,
    resolve: (result: DOMReadinessResult) => void
  ): void {
    const timeMs = performance.now() - startTime

    // Check if max retries exceeded
    if (attempt >= this.config.maxRetries) {
      resolve({
        ready: false,
        attempts: attempt,
        timeMs,
      })
      return
    }

    // Try to find and measure the first block
    try {
      const measureResult = this.measureFirstBlock(view)

      if (measureResult.ready) {
        resolve({
          ready: true,
          attempts: attempt + 1,
          timeMs,
          firstBlockHeight: measureResult.height,
        })
        return
      }
    } catch {
      // View may have been destroyed - return not ready
      resolve({
        ready: false,
        attempts: attempt + 1,
        timeMs,
      })
      return
    }

    // Not ready - retry with exponential backoff
    const delay = this.config.baseDelayMs * Math.pow(2, attempt)
    setTimeout(() => {
      this.checkWithRetry(view, attempt + 1, startTime, resolve)
    }, delay)
  }

  /**
   * Measure the first block in the editor
   */
  private measureFirstBlock(view: EditorView): { ready: boolean; height?: number } {
    // Check if view and DOM exist
    if (!view || !view.dom) {
      return { ready: false }
    }

    // Find the ProseMirror content container
    const proseMirror = view.dom
    if (!proseMirror) {
      return { ready: false }
    }

    // Find first child element (first block)
    const firstBlock = proseMirror.querySelector(':scope > *')
    if (!firstBlock) {
      // No content yet - might be empty document
      // Check if the container itself has height
      const containerRect = proseMirror.getBoundingClientRect()
      if (containerRect.height > this.config.minHeightThreshold) {
        return { ready: true, height: containerRect.height }
      }
      return { ready: false }
    }

    // Measure the first block
    const rect = firstBlock.getBoundingClientRect()
    if (rect.height >= this.config.minHeightThreshold) {
      return { ready: true, height: rect.height }
    }

    return { ready: false }
  }

  /**
   * Quick check if DOM appears ready (no waiting)
   */
  isReady(view: EditorView): boolean {
    return this.measureFirstBlock(view).ready
  }
}

/**
 * Singleton instance for convenience
 */
export const domReadinessChecker = new DOMReadinessChecker()
