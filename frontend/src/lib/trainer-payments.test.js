import { describe, it, expect } from 'vitest'
import { parsePaymentAmount, suggestedDueDate, needsRenewal } from './trainer-payments.js'

describe('manual payment entry', () => {
  it('stores exact minor amounts, supports decimal comma, and leaves an omitted amount empty', () => {
    expect(parsePaymentAmount('30,50')).toBe(3050)
    expect(parsePaymentAmount('10.05')).toBe(1005)
    expect(parsePaymentAmount('20')).toBe(2000)
    expect(parsePaymentAmount('')).toBe(null)
    for (const value of ['-20', '1.234', '0', '1,500.00', '1e3', '2x']) expect(() => parsePaymentAmount(value)).toThrow()
  })
  it('suggests a calendar month with end-of-month clamping, and supports shorter periods', () => {
    expect(suggestedDueDate('2026-01-31', 'month')).toBe('2026-02-28')
    expect(suggestedDueDate('2028-01-31', 'month')).toBe('2028-02-29')
    expect(suggestedDueDate('2026-12-26', 'month')).toBe('2027-01-26')
    expect(suggestedDueDate('2026-10-26', 'week')).toBe('2026-11-02')
    expect(suggestedDueDate('2026-10-26', 'fortnight')).toBe('2026-11-10')
    expect(suggestedDueDate('2026-02-30', 'month')).toBe('')
  })
  it('does not treat missing or future coverage as a renewal due now', () => {
    expect(needsRenewal({ status: 'none' })).toBe(false)
    expect(needsRenewal({ status: 'scheduled' })).toBe(false)
    expect(needsRenewal({ status: 'overdue' })).toBe(true)
    expect(needsRenewal({ status: 'due' })).toBe(true)
    expect(needsRenewal({ status: 'upcoming' })).toBe(true)
  })
})
