"use strict";

/**
 * ============================================================
 * formatters.js — Utilitas Format Angka, Mata Uang, & Tanggal
 * ============================================================
 */

/**
 * Format angka dengan separator ribuan gaya Indonesia (IDR)
 * @param {number} num
 * @returns {string}
 */
export function formatNumber(num) {
    if (typeof num !== 'number' || !Number.isFinite(num)) return '0';
    return num.toLocaleString('id-ID');
}

/**
 * Format mata uang lengkap Rupiah
 * @param {number} amount
 * @returns {string}
 */
export function formatCurrency(amount) {
    return `Rp ${formatNumber(amount)}`;
}

/**
 * Format tanggal dalam Bahasa Indonesia
 * @param {Date|string|number} dateInput
 * @returns {{ dateStr: string, timeStr: string, fullStr: string }}
 */
export function formatDateTime(dateInput) {
    try {
        const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
        if (isNaN(date.getTime())) throw new Error('Tanggal tidak valid');

        const dateStr = date.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
        const timeStr = date.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit'
        });
        return {
            dateStr,
            timeStr,
            fullStr: `${dateStr} ${timeStr}`
        };
    } catch {
        return {
            dateStr: '-',
            timeStr: '-',
            fullStr: '-'
        };
    }
}
