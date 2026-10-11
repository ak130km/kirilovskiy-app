import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canTransition, formatPhone, formatRub, formatSlot, getNextStatuses, normalizePhone } from './index';

test('formatRub', () => {
  assert.equal(formatRub(125000), '1 250 ₽');
  assert.equal(formatRub(12550), '125,50 ₽');
  assert.equal(formatRub(0), '0 ₽');
});

test('normalizePhone', () => {
  assert.equal(normalizePhone('8 (916) 123-45-67'), '+79161234567');
  assert.equal(normalizePhone('+7 916 123 45 67'), '+79161234567');
  assert.equal(normalizePhone('9161234567'), '+79161234567');
  assert.equal(normalizePhone('12345'), null);
  assert.equal(formatPhone('+79161234567'), '+7 916 123-45-67');
});

test('status transitions', () => {
  assert.ok(canTransition('NEW', 'CONFIRMED', 'DELIVERY'));
  assert.ok(!canTransition('NEW', 'READY', 'DELIVERY'));
  assert.ok(canTransition('READY', 'HANDED_TO_COURIER', 'DELIVERY'));
  assert.ok(!canTransition('READY', 'HANDED_TO_COURIER', 'PICKUP'));
  assert.ok(canTransition('READY', 'COMPLETED', 'PICKUP'));
  assert.ok(!canTransition('READY', 'COMPLETED', 'DELIVERY'));
  assert.deepEqual(getNextStatuses('COMPLETED', 'PICKUP'), []);
});

test('formatSlot', () => {
  assert.equal(formatSlot(600, 720), '10:00–12:00');
});
