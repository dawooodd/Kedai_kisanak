"use strict";

/**
 * ============================================================
 * receipt.js — Komponen Cetak Struk Belanja (Thermal Receipt)
 * ============================================================
 */

import { SecurityUtils } from '../utils/security.js';
import { formatNumber, formatDateTime } from '../utils/formatters.js';

/**
 * Menghasilkan struk belanja di elemen tersembunyi #receipt-container
 * @param {object} data
 */
export function generateReceipt(data) {
    const container = document.getElementById('receipt-container');
    if (!container) return;

    if (!data || !Array.isArray(data.items) || typeof data.total !== 'number') {
        console.error('[RECEIPT] Data struk belanja tidak valid');
        return;
    }

    const { dateStr, timeStr } = formatDateTime(data.date || new Date());
    const safeOrderNum = SecurityUtils.sanitize(data.orderNumber);
    const safePayment = SecurityUtils.sanitize(data.paymentMethod);
    const safeCustomer = SecurityUtils.sanitize(data.customerName || 'Walk-in Customer');
    const safeNotes = SecurityUtils.sanitize(data.orderNotes || '-');

    const itemsHTML = data.items.map(item => `
        <div class="receipt-item">
            <span class="item-qty">${item.quantity}x</span>
            <span class="item-name">${SecurityUtils.sanitize(item.name)}</span>
            <span class="item-total">Rp ${formatNumber(item.price * item.quantity)}</span>
        </div>
    `).join('');

    SecurityUtils.safeSetHTML(container, `
        <div class="receipt-header">
            <h2>KEDAI KISANAK</h2>
            <p>Since 2016 &bull; Specialty Coffee</p>
            <p>Jl. Kopi Nusantara No. 88</p>
            <p>────────────────────────────</p>
        </div>
        <div style="font-size:11px;margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;"><span>Order:</span><span>${safeOrderNum}</span></div>
            <div style="display:flex;justify-content:space-between;"><span>Pelanggan:</span><span>${safeCustomer}</span></div>
            <div style="display:flex;justify-content:space-between;"><span>Catatan:</span><span>${safeNotes}</span></div>
            <div style="display:flex;justify-content:space-between;"><span>Tanggal:</span><span>${dateStr}</span></div>
            <div style="display:flex;justify-content:space-between;"><span>Waktu:</span><span>${timeStr}</span></div>
            <div style="display:flex;justify-content:space-between;"><span>Bayar:</span><span>${safePayment}</span></div>
        </div>
        <div class="receipt-divider"></div>
        <div class="receipt-items">${itemsHTML}</div>
        <div class="receipt-divider"></div>
        <div class="receipt-total"><span>TOTAL</span><span>Rp ${formatNumber(data.total)}</span></div>
        <div class="receipt-footer">
            <p>════════════════════════════</p>
            <p>Terima kasih telah berkunjung!</p>
            <p>Semoga harimu menyenangkan ☕</p>
            <p>────────────────────────────</p>
            <p style="font-size:9px;margin-top:4px;">www.kedaikisanak.id</p>
        </div>
    `);
}

/**
 * Mencetak struk belanja ke printer thermal browser
 */
export function printReceipt() {
    const container = document.getElementById('receipt-container');
    if (container && container.innerHTML.trim() !== '') {
        window.print();
    } else {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Tidak Ada Struk',
                text: 'Selesaikan transaksi terlebih dahulu untuk mencetak struk.',
                icon: 'info',
                background: '#1A1A1A',
                color: '#F5F0EB',
                confirmButtonColor: '#C8956C'
            });
        }
    }
}
