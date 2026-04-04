import '@testing-library/jest-dom'

// ── Pointer Events polyfill (required for Radix UI in jsdom) ──────────────
window.Element.prototype.hasPointerCapture = vi.fn(() => false)
window.Element.prototype.setPointerCapture = vi.fn()
window.Element.prototype.releasePointerCapture = vi.fn()
window.HTMLElement.prototype.scrollIntoView = vi.fn()
window.HTMLElement.prototype.showPopover = vi.fn()
window.HTMLElement.prototype.hidePopover = vi.fn()

// ResizeObserver stub (Radix needs it)
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// ── Recharts stub — prevents SVG measurement errors in jsdom ──────────────
vi.mock('recharts', () => {
  const React = require('react')
  const stub = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'recharts-stub' }, children)
  return {
    LineChart: stub,
    BarChart: stub,
    AreaChart: stub,
    PieChart: stub,
    RadarChart: stub,
    ComposedChart: stub,
    Line: stub,
    Bar: stub,
    Area: stub,
    Pie: stub,
    Cell: stub,
    XAxis: stub,
    YAxis: stub,
    CartesianGrid: stub,
    Tooltip: stub,
    Legend: stub,
    ResponsiveContainer: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', { 'data-testid': 'responsive-container' }, children),
  }
})
