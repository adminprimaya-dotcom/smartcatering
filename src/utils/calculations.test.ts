import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateGuestCartCheckout,
  calculateMenuProfit,
  calculateOrderFinancials,
  calculateRawMaterialRequirement,
  computeDashboardMetrics,
  deriveOrderTrackingDetails,
  formatRupiah,
  generateOrderNumber,
  normalizeWhatsappNumber,
  validateOrderTrackingMatch,
} from './calculations';
import { createInitialErpSeed } from '../data/seedData';

test('calculateMenuProfit returns accurate margin in IDR', () => {
  assert.equal(calculateMenuProfit(38000, 23500), 14500);
  assert.equal(calculateMenuProfit(150000, 95000), 55000);
});

test('calculateOrderFinancials computes total, remaining balance, and payment status', () => {
  const dpOrder = calculateOrderFinancials({
    portions: 200,
    unitPrice: 35000,
    discount: 500000,
    downPayment: 3000000,
  });
  assert.equal(dpOrder.grossTotal, 7000000);
  assert.equal(dpOrder.totalPayment, 6500000);
  assert.equal(dpOrder.remainingBalance, 3500000);
  assert.equal(dpOrder.paymentStatus, 'DP Masuk');

  const paidOrder = calculateOrderFinancials({
    portions: 100,
    unitPrice: 40000,
    discount: 0,
    downPayment: 4000000,
  });
  assert.equal(paidOrder.totalPayment, 4000000);
  assert.equal(paidOrder.remainingBalance, 0);
  assert.equal(paidOrder.paymentStatus, 'Lunas');
});

test('generateOrderNumber formats Indonesian catering order code consistently', () => {
  assert.equal(generateOrderNumber('2026-11-16', 7), 'ORD-20261116-007');
});

test('calculateRawMaterialRequirement computes ingredients and production cost accurately', () => {
  const schoolCalc = calculateRawMaterialRequirement(500, 'Sekolah Rakyat');
  assert.ok(schoolCalc.rawMaterialNeed.includes('Beras 60 kg'));
  assert.ok(schoolCalc.rawMaterialNeed.includes('Susu UHT 500 kotak'));
  assert.equal(schoolCalc.estimatedProductionCost, 8250000);
});

test('computeDashboardMetrics aggregates all 12 ERP KPIs from seed data', () => {
  const seed = createInitialErpSeed('demo-owner');
  const metrics = computeDashboardMetrics(seed, 'Semua Unit', 'Semua');

  assert.ok(metrics.totalPendapatanCatering > 0);
  assert.ok(metrics.totalPendapatanSekolah > 0);
  assert.ok(metrics.totalPengeluaran > 0);
  assert.equal(
    metrics.keuntunganBersih,
    metrics.totalPendapatanCatering + metrics.totalPendapatanSekolah - metrics.totalPengeluaran
  );
  assert.ok(metrics.pesananAktifCount >= 1);
  assert.ok(metrics.produksiHariIniPorsi >= 500);
  assert.ok(metrics.totalPorsiTerdistribusi >= 500);
  assert.ok(metrics.jumlahPelanggan >= 3);
  assert.ok(metrics.jumlahSekolahDilayani >= 4);
  assert.ok(formatRupiah(metrics.saldoKasDanBank).includes('Rp'));
});

test('normalizeWhatsappNumber and validateOrderTrackingMatch enforce strict backend matching', () => {
  assert.equal(normalizeWhatsappNumber('+62 811-9823-401'), '08119823401');
  assert.equal(normalizeWhatsappNumber('628119823401'), '08119823401');
  assert.equal(normalizeWhatsappNumber('08119823401'), '08119823401');

  const sampleOrder = {
    orderNumber: 'ORD-20261116-001',
    whatsapp: '08119823401',
  };

  assert.equal(validateOrderTrackingMatch(sampleOrder, 'ord-20261116-001', '+62 811-9823-401'), true);
  assert.equal(validateOrderTrackingMatch(sampleOrder, 'ORD-20261116-001', '08120000000'), false);
  assert.equal(validateOrderTrackingMatch(sampleOrder, 'ORD-20261116-999', '08119823401'), false);
});

test('calculateGuestCartCheckout and deriveOrderTrackingDetails compute customer totals and status stages', () => {
  const totals = calculateGuestCartCheckout({
    items: [
      {
        menuId: 'menu-1',
        name: 'Nasi Kotak Ayam Bakar',
        category: 'Nasi kotak',
        packageName: 'Paket A',
        unitPrice: 38000,
        quantity: 50,
        imageUrl: '/test.jpg',
      },
    ],
    promo: {
      id: 'p1',
      ownerId: 'u1',
      promoCode: 'RAPAT2026',
      title: 'Promo Rapat',
      targetSegment: 'Rapat',
      discountPercent: 10,
      maxDiscountAmount: 500000,
      validUntil: '2026-12-31',
      active: true,
      usageCount: 1,
    },
    deliveryMethod: 'Pengiriman ke alamat',
    distanceKm: 6,
  });

  assert.equal(totals.totalPortions, 50);
  assert.equal(totals.subtotal, 1900000);
  assert.equal(totals.discountAmount, 190000);
  assert.equal(totals.shippingCost, 30000);
  assert.equal(totals.grandTotal, 1740000);

  const seed = createInitialErpSeed('demo-owner');
  const tracking = deriveOrderTrackingDetails(seed.cateringOrders[0]);
  assert.ok(tracking.productionStatus.length > 5);
  assert.ok(tracking.deliveryStatus.length > 5);
  assert.ok(tracking.estimatedDelivery.includes('2026'));
});
