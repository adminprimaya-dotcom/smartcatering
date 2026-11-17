import { jsPDF } from 'jspdf';
import { CateringOrder, SiteContentSettings } from '../types/erp';
import { DEFAULT_SITE_SETTINGS } from '../data/seedData';
import { formatRupiah, formatTanggalIndonesia } from './calculations';

export function downloadOrderInvoicePdf(
  order: CateringOrder,
  siteSettings: SiteContentSettings = DEFAULT_SITE_SETTINGS
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;

  const brandName = siteSettings.brandName || 'Smart Catering Nusantara';
  const erpTitle = siteSettings.erpSystemTitle || 'Smart Catering Management System';
  const companyAddress =
    siteSettings.companyAddress || 'Jl. Proklamasi No. 42, Menteng, Jakarta Pusat 10320';
  const companyWa = siteSettings.whatsappDisplay || '0811-9823-401';

  // 1. Header Band (Dark Slate + Emerald Accent Strip)
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 34, 'F');
  doc.setFillColor(4, 120, 87); // emerald-700
  doc.rect(0, 34, pageWidth, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(brandName.toUpperCase(), margin, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(erpTitle, margin, 20);
  doc.text(`${companyAddress} · WA: ${companyWa}`, margin, 25.5, { maxWidth: 112 });

  // Right header: INVOICE title & Number
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('INVOICE PESANAN', pageWidth - margin, 14, { align: 'right' });

  doc.setFont('courier', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(110, 231, 183); // emerald-300
  doc.text(order.orderNumber, pageWidth - margin, 21, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(
    `Tgl Pesan: ${formatTanggalIndonesia(order.orderDate)}`,
    pageWidth - margin,
    27,
    { align: 'right' }
  );

  // 2. Payment Status Ribbon
  let y = 43;
  const isLunas = order.paymentStatus === 'Lunas';
  const isDp = order.paymentStatus === 'DP Masuk';
  const paidAmount = isLunas ? order.totalPayment : Math.max(0, order.downPayment || 0);
  const remainingDebt = isLunas ? 0 : Math.max(0, order.totalPayment - paidAmount);

  if (isLunas) {
    doc.setFillColor(236, 253, 245); // emerald-50
    doc.setDrawColor(110, 231, 183);
  } else if (isDp) {
    doc.setFillColor(255, 251, 235); // amber-50
    doc.setDrawColor(252, 211, 77);
  } else {
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(203, 213, 225);
  }
  doc.roundedRect(margin, y, contentWidth, 11, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  if (isLunas) {
    doc.setTextColor(6, 95, 70);
  } else if (isDp) {
    doc.setTextColor(146, 64, 14);
  } else {
    doc.setTextColor(51, 65, 85);
  }
  doc.text(`STATUS PEMBAYARAN: ${order.paymentStatus.toUpperCase()}`, margin + 4, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    `Metode: ${order.paymentMethod || 'Transfer Bank'}  ·  Status Pesanan: ${order.status}`,
    pageWidth - margin - 4,
    y + 7,
    { align: 'right' }
  );

  // 3. Two-Column Customer & Schedule Details
  y += 16;
  const colWidth = (contentWidth - 6) / 2;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, colWidth, 34, 2, 2, 'FD');
  doc.roundedRect(margin + colWidth + 6, y, colWidth, 34, 2, 2, 'FD');

  // Left card: Customer
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('DITAGIHKAN KEPADA', margin + 4, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  const custLines = doc.splitTextToSize(order.customerName, colWidth - 8);
  doc.text(custLines.slice(0, 2), margin + 4, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`WhatsApp: ${order.whatsapp || '-'}`, margin + 4, y + 21);

  const addrText = order.deliveryAddress || order.deliveryMethod || 'Sesuai catatan pengiriman';
  const addrLines = doc.splitTextToSize(`Alamat: ${addrText}`, colWidth - 8);
  doc.text(addrLines.slice(0, 2), margin + 4, y + 26.5);

  // Right card: Schedule & Event
  const rightX = margin + colWidth + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('JADWAL ACARA & PENGIRIMAN', rightX, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `${formatTanggalIndonesia(order.deliveryDate)}${
      order.deliveryTime ? ` · ${order.deliveryTime}` : ''
    }`,
    rightX,
    y + 12
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Kategori Acara: ${order.eventType}`, rightX, y + 18.5);
  doc.text(
    `Pengiriman: ${order.deliveryMethod || 'Pengiriman ke alamat'}`,
    rightX,
    y + 24
  );
  doc.text(`Total Porsi: ${order.portions.toLocaleString('id-ID')} porsi`, rightX, y + 29.5);

  // 4. Itemized Order Table
  y += 41;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('RINCIAN MENU & PAKET PESANAN', margin, y);
  y += 4;

  // Table header
  doc.setFillColor(241, 245, 249); // slate-100
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, y, contentWidth, 9, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text('No', margin + 3, y + 6);
  doc.text('Nama Paket / Menu', margin + 12, y + 6);
  doc.text('Porsi', margin + 108, y + 6, { align: 'right' });
  doc.text('Harga Satuan', margin + 140, y + 6, { align: 'right' });
  doc.text('Subtotal', pageWidth - margin - 3, y + 6, { align: 'right' });
  y += 9;

  const lineItems =
    order.items && order.items.length > 0
      ? order.items.map((item) => ({
          name: item.name,
          subLabel: item.packageName || item.category,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.unitPrice * item.quantity,
        }))
      : [
          {
            name: order.packageName,
            subLabel: order.eventType,
            quantity: order.portions,
            unitPrice: order.unitPrice,
            subtotal: order.portions * order.unitPrice,
          },
        ];

  let itemsSubtotal = 0;
  lineItems.forEach((row, index) => {
    itemsSubtotal += row.subtotal;
    const nameLines = doc.splitTextToSize(row.name, 78);
    const rowHeight = Math.max(11, nameLines.length * 4.5 + 5);

    if (y + rowHeight > pageHeight - 55) {
      doc.addPage();
      y = 20;
    }

    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentWidth, rowHeight, 'F');
    }
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(String(index + 1), margin + 3, y + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(nameLines, margin + 12, y + 5.5);

    if (row.subLabel) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(row.subLabel, margin + 12, y + 5.5 + nameLines.length * 4);
    }

    doc.setFont('courier', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`${row.quantity.toLocaleString('id-ID')}`, margin + 108, y + 6, { align: 'right' });
    doc.text(formatRupiah(row.unitPrice), margin + 140, y + 6, { align: 'right' });

    doc.setFont('courier', 'bold');
    doc.text(formatRupiah(row.subtotal), pageWidth - margin - 3, y + 6, { align: 'right' });

    y += rowHeight;
  });

  // 5. Financial Totals Summary Box
  y += 6;
  if (y > pageHeight - 75) {
    doc.addPage();
    y = 20;
  }

  const summaryBoxWidth = 88;
  const summaryX = pageWidth - margin - summaryBoxWidth;
  const summaryRows: { label: string; value: string; accent?: 'bold' | 'emerald' | 'amber' }[] = [
    { label: 'Subtotal Menu', value: formatRupiah(itemsSubtotal) },
  ];

  if ((order.shippingCost || 0) > 0) {
    summaryRows.push({ label: 'Ongkos Kirim', value: formatRupiah(order.shippingCost || 0) });
  }
  if ((order.discount || 0) > 0) {
    summaryRows.push({ label: 'Diskon / Promo', value: `- ${formatRupiah(order.discount)}` });
  }
  summaryRows.push({
    label: 'TOTAL TAGIHAN',
    value: formatRupiah(order.totalPayment),
    accent: 'bold',
  });
  summaryRows.push({
    label: 'Sudah Dibayar / DP',
    value: formatRupiah(paidAmount),
    accent: 'emerald',
  });
  summaryRows.push({
    label: remainingDebt > 0 ? 'SISA TAGIHAN (UTANG)' : 'SISA TAGIHAN',
    value: remainingDebt > 0 ? formatRupiah(remainingDebt) : 'Rp 0 (Lunas)',
    accent: remainingDebt > 0 ? 'amber' : 'emerald',
  });

  const summaryBoxHeight = summaryRows.length * 7 + 6;

  // Notes & payment instruction on left side beside summary box
  const leftNoteWidth = contentWidth - summaryBoxWidth - 6;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, leftNoteWidth, summaryBoxHeight, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('CATATAN & INFO PEMBAYARAN', margin + 4, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  const noteContent = order.notes?.trim()
    ? `Catatan: ${order.notes}`
    : 'Pesanan diproses sesuai jadwal pengiriman yang disepakati.';
  const wrappedNotes = doc.splitTextToSize(noteContent, leftNoteWidth - 8);
  doc.text(wrappedNotes.slice(0, 3), margin + 4, y + 11.5);

  const bankInfo = `Bank: ${siteSettings.bankName || 'Bank Mandiri'} (${
    siteSettings.bankAccountNumber || '123-00-0987654-3'
  }) a.n. ${siteSettings.bankAccountHolder || brandName}`;
  const wrappedBank = doc.splitTextToSize(bankInfo, leftNoteWidth - 8);
  doc.text(wrappedBank.slice(0, 2), margin + 4, y + summaryBoxHeight - 11);

  doc.text(
    `QRIS: ${siteSettings.qrisMerchantName || brandName} (NMID: ${
      siteSettings.qrisNmid || 'ID102026098765432'
    })`,
    margin + 4,
    y + summaryBoxHeight - 3.5,
    { maxWidth: leftNoteWidth - 8 }
  );

  // Right summary box
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(summaryX, y, summaryBoxWidth, summaryBoxHeight, 2, 2, 'FD');

  let sy = y + 7;
  summaryRows.forEach((item, idx) => {
    if (idx === summaryRows.length - 3) {
      doc.setDrawColor(226, 232, 240);
      doc.line(summaryX + 3, sy - 4, summaryX + summaryBoxWidth - 3, sy - 4);
    }

    doc.setFont('helvetica', item.accent === 'bold' ? 'bold' : 'normal');
    doc.setFontSize(item.accent === 'bold' ? 9 : 8.5);
    if (item.accent === 'emerald') doc.setTextColor(4, 120, 87);
    else if (item.accent === 'amber') doc.setTextColor(180, 83, 9);
    else doc.setTextColor(15, 23, 42);

    doc.text(item.label, summaryX + 4, sy);
    doc.setFont('courier', item.accent ? 'bold' : 'normal');
    doc.text(item.value, summaryX + summaryBoxWidth - 4, sy, { align: 'right' });
    sy += 7;
  });

  // 6. Footer
  const footerY = pageHeight - 14;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  const printedAt = new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).format(new Date());
  doc.text(
    `Invoice resmi diterbitkan otomatis oleh ${brandName} · Dicetak: ${printedAt} WIB`,
    margin,
    footerY
  );
  doc.text('Terima kasih atas kepercayaan Anda.', pageWidth - margin, footerY, {
    align: 'right',
  });

  doc.save(`Invoice-${order.orderNumber}.pdf`);
}
