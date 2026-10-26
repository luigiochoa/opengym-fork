import { it, expect } from 'vitest'
import { paymentsCsv } from './payment-csv.js'
it('exports private bookkeeping with exact cents and preserves absent amounts and voids', () => {
  const csv = paymentsCsv([{ id: 'one', amountMinor: 3015, currency: 'USD', note: 'Referencia, "Ana"' }, { id: 'two', amountMinor: null, voidedAt: 1 }])
  expect(csv).toContain('"30.15"')
  expect(csv).toContain('"Referencia, ""Ana"""')
  expect(csv).toContain('"Anulado"')
  expect(csv).not.toContain('undefined')
})
it('neutralizes formulas, including whitespace and control-character prefixes', () => {
  for (const note of ['=1+1', ' +1+1', '@SUM(1)', '-1+1', '\t=1+1', '\n@SUM(1)']) expect(paymentsCsv([{ note }])).toContain('"\'' + note)
})
