import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ReflowEngine } from './ReflowEngine'
import { DEFAULT_PAGINATION_CONFIG } from './types'

describe('ReflowEngine', () => {
  let engine: ReflowEngine

  beforeEach(() => {
    engine = new ReflowEngine()
  })

  afterEach(() => {
    engine.destroy()
  })

  describe('constructor', () => {
    it('creates with default config', () => {
      const config = engine.getConfig()

      expect(config.pageSize).toBe('a4')
      expect(config.orientation).toBe('portrait')
      expect(config.reflowDebounceMs).toBe(100)
    })

    it('accepts custom config', () => {
      const customEngine = new ReflowEngine({
        pageSize: 'letter',
        orientation: 'landscape',
        reflowDebounceMs: 200,
      })

      const config = customEngine.getConfig()

      expect(config.pageSize).toBe('letter')
      expect(config.orientation).toBe('landscape')
      expect(config.reflowDebounceMs).toBe(200)

      customEngine.destroy()
    })
  })

  describe('getModel', () => {
    it('returns null initially', () => {
      expect(engine.getModel()).toBeNull()
    })
  })

  describe('getDimensions', () => {
    it('returns page dimensions', () => {
      const dims = engine.getDimensions()

      expect(dims.width).toBeGreaterThan(0)
      expect(dims.height).toBeGreaterThan(0)
      expect(dims.contentWidth).toBeGreaterThan(0)
      expect(dims.contentHeight).toBeGreaterThan(0)
    })

    it('matches A4 dimensions for default config', () => {
      const dims = engine.getDimensions()

      // A4 is 595.28 x 841.89 points
      expect(dims.width).toBeCloseTo(595.28, 1)
      expect(dims.height).toBeCloseTo(841.89, 1)
    })
  })

  describe('setConfig', () => {
    it('updates configuration', () => {
      engine.setConfig({
        pageSize: 'legal',
        reflowDebounceMs: 50,
      })

      const config = engine.getConfig()

      expect(config.pageSize).toBe('legal')
      expect(config.reflowDebounceMs).toBe(50)
    })

    it('updates dimensions when page size changes', () => {
      const dimsBefore = engine.getDimensions()

      engine.setConfig({ pageSize: 'letter' })

      const dimsAfter = engine.getDimensions()

      // Letter is different from A4
      expect(dimsAfter.width).not.toBe(dimsBefore.width)
    })
  })

  describe('event handlers', () => {
    it('registers and unregisters onPagesChanged handler', () => {
      const handler = vi.fn()

      const unregister = engine.onPagesChanged(handler)

      // Should be registered
      expect(typeof unregister).toBe('function')

      // Unregister
      unregister()
    })

    it('registers and unregisters onReflowStart handler', () => {
      const handler = vi.fn()

      const unregister = engine.onReflowStart(handler)
      unregister()

      expect(typeof unregister).toBe('function')
    })

    it('registers and unregisters onReflowEnd handler', () => {
      const handler = vi.fn()

      const unregister = engine.onReflowEnd(handler)
      unregister()

      expect(typeof unregister).toBe('function')
    })
  })

  describe('getStats', () => {
    it('returns statistics', () => {
      const stats = engine.getStats()

      expect(stats).toHaveProperty('lastReflowTime')
      expect(stats).toHaveProperty('pageCount')
      expect(stats).toHaveProperty('cacheStats')
      expect(stats).toHaveProperty('isReflowing')
      expect(stats).toHaveProperty('pendingChanges')
    })

    it('shows zero page count without reflow', () => {
      const stats = engine.getStats()

      expect(stats.pageCount).toBe(0)
      expect(stats.isReflowing).toBe(false)
      expect(stats.pendingChanges).toBe(0)
    })
  })

  describe('getPageForPosition', () => {
    it('returns 1 without model', () => {
      expect(engine.getPageForPosition(0)).toBe(1)
      expect(engine.getPageForPosition(100)).toBe(1)
    })
  })

  describe('getPositionRangeForPage', () => {
    it('returns null without model', () => {
      expect(engine.getPositionRangeForPage(1)).toBeNull()
    })
  })

  describe('destroy', () => {
    it('cleans up resources', () => {
      const handler = vi.fn()
      engine.onPagesChanged(handler)

      engine.destroy()

      // Engine should be in clean state
      expect(engine.getModel()).toBeNull()
    })
  })

  describe('requestReflow', () => {
    it('accepts reflow request without view', () => {
      // Should not throw
      engine.requestReflow()
    })

    it('accepts reflow request with change data', () => {
      engine.requestReflow({
        type: 'insert',
        pos: 10,
        range: { from: 10, to: 20 },
      })

      const stats = engine.getStats()
      expect(stats.pendingChanges).toBe(1)
    })
  })

  describe('forceFullReflow', () => {
    it('clears model and cache', () => {
      engine.forceFullReflow()

      // Should not throw and model should be null (no view)
      expect(engine.getModel()).toBeNull()
    })
  })
})

describe('ReflowEngine integration', () => {
  // Note: Full integration tests would require a DOM environment
  // and ProseMirror EditorView setup. These are placeholder tests
  // for the interface.

  it('provides complete pagination API', () => {
    const engine = new ReflowEngine()

    // Check all public methods exist
    expect(typeof engine.setView).toBe('function')
    expect(typeof engine.setConfig).toBe('function')
    expect(typeof engine.getModel).toBe('function')
    expect(typeof engine.getConfig).toBe('function')
    expect(typeof engine.getDimensions).toBe('function')
    expect(typeof engine.requestReflow).toBe('function')
    expect(typeof engine.requestImmediateReflow).toBe('function')
    expect(typeof engine.handleTransaction).toBe('function')
    expect(typeof engine.forceFullReflow).toBe('function')
    expect(typeof engine.getPageForPosition).toBe('function')
    expect(typeof engine.getPositionRangeForPage).toBe('function')
    expect(typeof engine.onReflowStart).toBe('function')
    expect(typeof engine.onReflowEnd).toBe('function')
    expect(typeof engine.onPagesChanged).toBe('function')
    expect(typeof engine.getStats).toBe('function')
    expect(typeof engine.destroy).toBe('function')

    engine.destroy()
  })
})
