"use strict";

/**
 * ============================================================
 * payment.js — Komponen Pembayaran, QRIS, & QR Scanner
 * ============================================================
 */

import { RANDOM_CUSTOMER_NAMES } from '../config/constants.js';
import { SecurityUtils } from '../utils/security.js';
import { formatNumber } from '../utils/formatters.js';
import { playChimeSound } from '../services/audio.js';

let html5QrcodeScanner = null;
let qrisTimeoutId = null;

/**
 * Menampilkan notifikasi popup toast
 */
export function showToast(icon, title, message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    if (type === 'warning') {
        toast.style.background = 'linear-gradient(135deg, #2e2a1a, #1f1a0d)';
        toast.style.borderColor = 'rgba(234, 179, 8, 0.3)';
    }

    SecurityUtils.safeSetHTML(toast, `
        <span class="toast-icon">${SecurityUtils.sanitize(icon)}</span>
        <div class="toast-body">
            <p class="toast-title" ${type === 'warning' ? 'style="color: #eab308;"' : ''}>${SecurityUtils.sanitize(title)}</p>
            <p class="toast-message" ${type === 'warning' ? 'style="color: #fde68a;"' : ''}>${SecurityUtils.sanitize(message)}</p>
        </div>
        <button class="toast-close-btn" aria-label="Tutup">✕</button>
    `);

    toast.querySelector('.toast-close-btn')?.addEventListener('click', () => toast.remove());
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 300);
    }, 4500);
}

/**
 * Membuka modal pembayaran QRIS dan mensimulasikan dana masuk
 */
export function openQRISModal(total, orderNumber, onPaymentSuccess) {
    const modal = document.getElementById('qris-modal');
    const qrisAmount = document.getElementById('qris-amount');
    const qrisOrderNum = document.getElementById('qris-order-num');
    if (!modal) return;

    if (qrisAmount) qrisAmount.textContent = `Rp ${formatNumber(total)}`;
    if (qrisOrderNum) qrisOrderNum.textContent = SecurityUtils.sanitize(orderNumber);

    modal.classList.add('active');

    // Simulasi penerimaan dana (3-6 detik)
    const delay = Math.floor(Math.random() * 3000) + 3000;
    qrisTimeoutId = setTimeout(() => {
        const randomPayer = RANDOM_CUSTOMER_NAMES[Math.floor(Math.random() * RANDOM_CUSTOMER_NAMES.length)];
        closeQRISModal();
        showToast('✅', 'Pembayaran QRIS Berhasil!', `Dana diterima sebesar Rp ${formatNumber(total)} dari ${randomPayer}`, 'success');
        playChimeSound();
        if (typeof onPaymentSuccess === 'function') {
            onPaymentSuccess();
        }
    }, delay);
}

export function closeQRISModal() {
    const modal = document.getElementById('qris-modal');
    if (modal) modal.classList.remove('active');
    if (qrisTimeoutId) {
        clearTimeout(qrisTimeoutId);
        qrisTimeoutId = null;
    }
}

/**
 * Membuka kamera untuk scan QR Code (voucher / loyalty)
 */
export function openQRScanner(onVoucherDetected) {
    const modal = document.getElementById('scanner-modal');
    const resultDiv = document.getElementById('scanner-result');
    const readerDiv = document.getElementById('qr-reader');
    if (!modal) return;

    if (resultDiv) {
        resultDiv.classList.remove('show');
        resultDiv.textContent = '';
    }
    modal.classList.add('active');

    if (typeof Html5Qrcode === 'undefined') {
        if (readerDiv) {
            readerDiv.innerHTML = '<div style="padding:20px;color:var(--text-muted);">📷 Library Scanner sedang dimuat atau tidak tersedia.</div>';
        }
        return;
    }

    try {
        html5QrcodeScanner = new Html5Qrcode('qr-reader');
        html5QrcodeScanner.start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 240, height: 240 } },
            (decodedText) => {
                handleScanSuccess(decodedText, onVoucherDetected);
            },
            () => {} // Abaikan frame tanpa barcode
        ).catch((err) => {
            console.warn('[SCANNER] Akses kamera ditolak atau tidak didukung:', err);
            if (readerDiv) {
                readerDiv.innerHTML = `
                    <div style="padding:30px 20px;text-align:center;color:var(--text-secondary);">
                        <p style="font-size:2rem;margin-bottom:8px;">📷</p>
                        <p style="font-weight:600;margin-bottom:4px;">Kamera Tidak Dapat Diakses</p>
                        <p style="font-size:0.8rem;color:var(--text-muted);">Pastikan izin kamera telah diberikan pada browser Anda.</p>
                    </div>
                `;
            }
        });
    } catch (e) {
        console.error('[SCANNER] Inisialisasi kamera gagal:', e);
    }
}

function handleScanSuccess(decodedText, callback) {
    const resultDiv = document.getElementById('scanner-result');
    const safeText = SecurityUtils.sanitize(decodedText);

    if (decodedText.length > 500) {
        console.warn('[SCANNER] Payload QR melebihi batas wajar.');
        return;
    }

    let message = '';
    if (decodedText.startsWith('VOUCHER-') && /^VOUCHER-\d{1,3}$/.test(decodedText)) {
        const discount = decodedText.split('-')[1];
        message = `🎟️ Voucher Diskon ${SecurityUtils.sanitize(discount)}% terdeteksi!`;
        if (typeof callback === 'function') callback(parseInt(discount, 10));
    } else if (decodedText.startsWith('LOYALTY-') && /^LOYALTY-[A-Z0-9]{1,20}$/.test(decodedText)) {
        message = `⭐ Kartu Loyalty terdeteksi! ID: ${safeText}`;
    } else {
        message = `📋 QR Code terbaca: ${safeText}`;
    }

    if (resultDiv) {
        resultDiv.textContent = message;
        resultDiv.classList.add('show');
    }

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'QR Code Terbaca!',
            text: message,
            icon: 'success',
            confirmButtonColor: '#C8956C',
            background: '#1A1A1A',
            color: '#F5F0EB'
        });
    }

    closeQRScanner();
}

export function closeQRScanner() {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.stop().then(() => {
            html5QrcodeScanner.clear();
            html5QrcodeScanner = null;
        }).catch(() => {
            html5QrcodeScanner = null;
        });
    }
    const modal = document.getElementById('scanner-modal');
    if (modal) modal.classList.remove('active');
}
