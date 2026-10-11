import { formatRub, PAYMENT_METHOD_LABELS } from '@kirilovskiy/shared';
import type { Order, Payment } from '@prisma/client';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** HTML тестовой страницы оплаты (только PAYMENT_PROVIDER=test) */
export function renderTestPaymentPage(payment: Payment & { order: Order }): string {
  const done = payment.status !== 'PENDING';
  const isSbp = payment.method === 'SBP';
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Тестовая оплата — заказ №${payment.order.number}</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fbf6f1; color: #3b2a22; }
  main { max-width: 420px; margin: 0 auto; padding: 32px 20px; }
  .card { background: #fff; border-radius: 20px; padding: 24px; box-shadow: 0 8px 30px rgba(59,42,34,.08); }
  .badge { display: inline-block; background: #fff3cd; color: #7a5b00; border-radius: 999px; padding: 4px 12px; font-size: 13px; }
  h1 { font-size: 22px; margin: 16px 0 4px; }
  .amount { font-size: 34px; font-weight: 700; margin: 16px 0; }
  .muted { color: #8a756a; font-size: 14px; }
  .qr { margin: 16px auto; width: 160px; height: 160px; border-radius: 12px;
        background: repeating-conic-gradient(#3b2a22 0 25%, #fff 0 50%) 0 0/20px 20px; border: 8px solid #fff; outline: 1px solid #eee; }
  button { width: 100%; border: 0; border-radius: 14px; padding: 16px; font-size: 17px; font-weight: 600; margin-top: 12px; cursor: pointer; }
  .pay { background: #b5654a; color: #fff; }
  .decline { background: #f1e7e1; color: #3b2a22; }
  .status { margin-top: 16px; padding: 12px; border-radius: 12px; background: #eef7ee; }
</style>
</head>
<body>
<main>
  <div class="card">
    <span class="badge">Тестовый режим — деньги не списываются</span>
    <h1>Заказ №${payment.order.number}</h1>
    <div class="muted">Кондитерская Артёма Кирилловского · ${esc(PAYMENT_METHOD_LABELS[payment.method])}</div>
    <div class="amount">${formatRub(payment.amount)}</div>
    ${isSbp ? '<div class="qr" aria-label="Тестовый QR-код СБП"></div><p class="muted" style="text-align:center">В боевом режиме здесь откроется приложение банка</p>' : ''}
    ${
      done
        ? `<div class="status">Статус платежа: ${esc(payment.status)}</div>`
        : `<form method="post" action="/api/v1/payments/test/${payment.id}/complete">
             <button class="pay" name="result" value="success" type="submit">Оплатить ${formatRub(payment.amount)}</button>
             <button class="decline" name="result" value="fail" type="submit">Отклонить платёж</button>
           </form>`
    }
  </div>
</main>
</body>
</html>`;
}
