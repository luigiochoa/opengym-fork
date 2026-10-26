import { PAYMENT_LABELS } from '../lib/trainer-payments.js'
export default function PaymentBadge({ summary }) {
  const status = summary?.status || 'none'
  return <span className={`tag trainer-payment-badge ${status}`} aria-label={`Pago: ${PAYMENT_LABELS[status]}`}>{PAYMENT_LABELS[status]}</span>
}
