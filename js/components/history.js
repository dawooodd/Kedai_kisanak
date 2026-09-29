"use strict";

/**
 * ============================================================
 * history.js — Komponen Riwayat Transaksi & Audit Integritas
 * ============================================================
 */

import { getAllTransactions } from '../services/db.js';
import { SecurityUtils } from '../utils/security.js';
import { formatNumber, formatDateTime } from '../utils/formatters.js';

/**
 * Membuka modal riwayat transaksi dengan verifikasi integritas
 */
export async function showHistoryModal() {
    const modal = document.getElementById('history-modal');
    const historyList = document.getElementById('history-list');
    if (!modal || !historyList) return;

    modal.classList.add('active');
    SecurityUtils.safeSetHTML(historyList, `
        <div class="history-empty">
            <div class="spinner" style="margin: 0 auto 12px;"></div>
            <p>Memuat dan memverifikasi integritas data...</p>
        </div>
    `);

    try {
        const transactions = await getAllTransactions();

        if (transactions.length === 0) {
            SecurityUtils.safeSetHTML(historyList, `
                <div class="history-empty">
                    <div class="empty-icon">📋</div>
                    <p>Belum ada riwayat transaksi</p>
                </div>
            `);
            return;
        }

        const sorted = transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        const cardsHTML = sorted.map(tx => {
            const { fullStr } = formatDateTime(tx.date);
            const itemNames = (tx.items || []).map(i => `${SecurityUtils.sanitize(i.name)} x${i.quantity}`).join(', ');

            const safeOrderNum = SecurityUtils.sanitize(tx.orderNumber);
            const safeCustomer = SecurityUtils.sanitize(tx.customerName || 'Walk-in Customer');
            const safeNotes = SecurityUtils.sanitize(tx.orderNotes || '-');
            const safePayment = SecurityUtils.sanitize(tx.paymentMethod);

            const tamperBadge = tx._isTampered ? `
                <div class="tamper-alert-badge">
                    ⚠️ INTEGRITAS GAGAL: Data ini terdeteksi telah dimodifikasi manual di DevTools!
                </div>
            ` : '';

            return `
                <div class="history-item ${tx._isTampered ? 'tampered' : ''}">
                    ${tamperBadge}
                    <div class="history-header">
                        <span class="order-id">${safeOrderNum}</span>
                        <span class="order-date">${fullStr}</span>
                    </div>
                    <div class="history-customer-info">
                        <span>👤 ${safeCustomer}</span>
                        ${safeNotes !== '-' ? `<span>📝 <em>${safeNotes}</em></span>` : ''}
                    </div>
                    <p class="history-details">${itemNames}</p>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
                        <span class="history-total">Rp ${formatNumber(tx.total)}</span>
                        <span style="font-size:0.75rem; color:var(--text-muted);">${safePayment}</span>
                    </div>
                </div>
            `;
        }).join('');

        SecurityUtils.safeSetHTML(historyList, cardsHTML);
    } catch (error) {
        console.error('[HISTORY] Gagal memuat riwayat:', error);
        SecurityUtils.safeSetHTML(historyList, `
            <div class="history-empty" style="color:#ef4444;">
                <p>⚠️ Gagal memuat riwayat transaksi.</p>
            </div>
        `);
    }
}

export function closeHistoryModal() {
    const modal = document.getElementById('history-modal');
    if (modal) modal.classList.remove('active');
}
