/**
 * ============================================================
 * payment.js — Modul Pembayaran Kedai Kisanak POS System
 * ============================================================
 * SECURITY HARDENED:
 * - Sanitasi semua output ke DOM
 * - Validasi data sebelum generate struk
 * - QR Scanner result di-sanitize dan divalidasi
 * - Web Audio API fallback (no external audio dependency)
 * ============================================================
 */

const KisanakPayment = (() => {
    let html5QrcodeScanner = null;
    let qrisPaymentTimeout = null;

    const RANDOM_NAMES = Object.freeze([
        'Ahmad Rizki', 'Siti Nurhaliza', 'Budi Santoso', 'Dewi Anggraeni',
        'Fajar Ramadhan', 'Rina Marlina', 'Dian Saputra', 'Maya Indah',
        'Eko Prasetyo', 'Lina Kusuma', 'Agus Hermawan', 'Putri Ayu',
        'Hendra Wijaya', 'Novia Sari', 'Bambang Gunawan', 'QRIS Payment'
    ]);

    // ─── Tampilkan Modal QRIS ───────────────────────────────
    function showQRISModal(total, orderNumber, cartItems, paymentMethod) {
        const modal = document.getElementById('qris-modal');
        const qrisAmount = document.getElementById('qris-amount');
        const qrisOrderNum = document.getElementById('qris-order-num');
        if (!modal) return;

        // SECURITY: Validasi total adalah angka positif
        if (typeof total !== 'number' || total <= 0) {
            console.error('Total pembayaran tidak valid');
            return;
        }

        // SECURITY: textContent, bukan innerHTML
        if (qrisAmount) qrisAmount.textContent = `Rp ${KisanakApp.formatNumber(total)}`;
        if (qrisOrderNum) qrisOrderNum.textContent = SecurityUtils.sanitize(orderNumber);

        modal.classList.add('active');

        // Simulasi pembayaran masuk (3-7 detik)
        const randomDelay = Math.floor(Math.random() * 4000) + 3000;
        qrisPaymentTimeout = setTimeout(() => {
            const randomName = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
            modal.classList.remove('active');
            showPaymentNotification(total, randomName);
            playChimeSound();
            KisanakApp.completeOrder(orderNumber, total, paymentMethod);
        }, randomDelay);
    }

    function closeQRISModal() {
        const modal = document.getElementById('qris-modal');
        if (modal) modal.classList.remove('active');
        if (qrisPaymentTimeout) {
            clearTimeout(qrisPaymentTimeout);
            qrisPaymentTimeout = null;
        }
    }

    // ─── Toast Notifikasi Pembayaran ────────────────────────
    function showPaymentNotification(amount, senderName) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = 'toast';
        // SECURITY: Sanitasi nama pengirim
        const safeName = SecurityUtils.sanitize(senderName);
        SecurityUtils.safeSetHTML(toast, `
            <span class="toast-icon">✅</span>
            <div class="toast-body">
                <p class="toast-title">Pembayaran Berhasil!</p>
                <p class="toast-message">💰 Dana masuk: Rp ${KisanakApp.formatNumber(amount)} dari ${safeName}</p>
            </div>
            <button class="toast-close-btn">✕</button>
        `);
        toast.querySelector('.toast-close-btn').addEventListener('click', () => toast.remove());
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('toast-exit');
            setTimeout(() => toast.remove(), 300);
        }, 6000);
    }

    // ─── Audio Chime (Web Audio API) ────────────────────────
    function playChimeSound() {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            const ctx = new AudioCtx();
            playTone(ctx, 523, 0, 0.15);
            playTone(ctx, 659, 0.15, 0.15);
            playTone(ctx, 784, 0.3, 0.25);
        } catch (e) {
            console.warn('Web Audio API tidak tersedia');
        }
    }

    function playTone(ctx, frequency, startDelay, duration) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0, ctx.currentTime + startDelay);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + startDelay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + startDelay + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + startDelay);
        osc.stop(ctx.currentTime + startDelay + duration);
    }

    // ─── QR Scanner ─────────────────────────────────────────
    function openQRScanner() {
        const modal = document.getElementById('scanner-modal');
        const resultDiv = document.getElementById('scanner-result');
        if (!modal) return;
        if (resultDiv) {
            resultDiv.classList.remove('show');
            resultDiv.textContent = '';
        }
        modal.classList.add('active');

        if (typeof Html5Qrcode !== 'undefined') {
            try {
                html5QrcodeScanner = new Html5Qrcode('qr-reader');
                html5QrcodeScanner.start(
                    { facingMode: 'environment' },
                    { fps: 10, qrbox: { width: 250, height: 250 } },
                    onScanSuccess,
                    () => {} // onScanError: diabaikan, terus scan
                ).catch(() => {
                    document.getElementById('qr-reader').textContent = '📷 Kamera tidak tersedia. Pastikan izin kamera diberikan.';
                });
            } catch (e) {
                console.error('Error inisialisasi scanner:', e);
            }
        } else {
            const reader = document.getElementById('qr-reader');
            if (reader) reader.textContent = '📷 QR Scanner library tidak tersedia';
        }
    }

    function onScanSuccess(decodedText) {
        const resultDiv = document.getElementById('scanner-result');

        // SECURITY: Sanitasi dan validasi hasil scan QR
        const safeText = SecurityUtils.sanitize(decodedText);

        // Validasi panjang maksimum untuk mencegah abuse
        if (decodedText.length > 500) {
            console.warn('QR code terlalu panjang, diabaikan');
            return;
        }

        let message = '';
        if (decodedText.startsWith('VOUCHER-') && /^VOUCHER-\d{1,3}$/.test(decodedText)) {
            const discount = decodedText.split('-')[1];
            message = `🎟️ Voucher Diskon ${SecurityUtils.sanitize(discount)}% terdeteksi!`;
        } else if (decodedText.startsWith('LOYALTY-') && /^LOYALTY-[A-Z0-9]{1,20}$/.test(decodedText)) {
            message = `⭐ Kartu Loyalty terdeteksi! ID: ${safeText}`;
        } else {
            message = `📋 QR Code terbaca: ${safeText}`;
        }

        if (resultDiv) {
            // SECURITY: textContent, bukan innerHTML
            resultDiv.textContent = message;
            resultDiv.classList.add('show');
        }

        Swal.fire({
            title: 'QR Code Terbaca!',
            text: message,
            icon: 'success',
            confirmButtonColor: '#C8956C',
            background: '#1A1A1A',
            color: '#F5F0EB'
        });

        stopQRScanner();
    }

    function stopQRScanner() {
        if (html5QrcodeScanner) {
            html5QrcodeScanner.stop().then(() => {
                html5QrcodeScanner.clear();
                html5QrcodeScanner = null;
            }).catch(() => {});
        }
    }

    function closeQRScanner() {
        stopQRScanner();
        const modal = document.getElementById('scanner-modal');
        if (modal) modal.classList.remove('active');
    }

    // ─── Generate Struk Cetak (Thermal Receipt) ─────────────
    function generateReceipt(data) {
        const container = document.getElementById('receipt-container');
        if (!container) return;

        // SECURITY: Validasi data struk
        if (!data || !Array.isArray(data.items) || typeof data.total !== 'number') {
            console.error('Data struk tidak valid');
            return;
        }

        const date = data.date || new Date();
        const dateStr = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        const timeStr = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        // SECURITY: Semua data di-sanitize
        const safeOrderNum = SecurityUtils.sanitize(data.orderNumber);
        const safePayment = SecurityUtils.sanitize(data.paymentMethod);
        const safeDateStr = SecurityUtils.sanitize(dateStr);
        const safeTimeStr = SecurityUtils.sanitize(timeStr);

        const itemsHTML = data.items.map(item => `
            <div class="receipt-item">
                <span class="item-qty">${item.quantity}x</span>
                <span class="item-name">${SecurityUtils.sanitize(item.name)}</span>
                <span class="item-total">Rp ${KisanakApp.formatNumber(item.price * item.quantity)}</span>
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
                <div style="display:flex;justify-content:space-between;"><span>Tanggal:</span><span>${safeDateStr}</span></div>
                <div style="display:flex;justify-content:space-between;"><span>Waktu:</span><span>${safeTimeStr}</span></div>
                <div style="display:flex;justify-content:space-between;"><span>Bayar:</span><span>${safePayment}</span></div>
            </div>
            <div class="receipt-divider"></div>
            <div class="receipt-items">${itemsHTML}</div>
            <div class="receipt-divider"></div>
            <div class="receipt-total"><span>TOTAL</span><span>Rp ${KisanakApp.formatNumber(data.total)}</span></div>
            <div class="receipt-footer">
                <p>════════════════════════════</p>
                <p>Terima kasih telah berkunjung!</p>
                <p>Semoga harimu menyenangkan ☕</p>
                <p>────────────────────────────</p>
                <p style="font-size:9px;margin-top:4px;">www.kedaikisanak.id</p>
            </div>
        `);
    }

    function printReceipt() {
        const container = document.getElementById('receipt-container');
        if (container && container.innerHTML.trim() !== '') {
            window.print();
        } else {
            Swal.fire({ title: 'Tidak ada struk', text: 'Lakukan checkout terlebih dahulu.', icon: 'info', background: '#1A1A1A', color: '#F5F0EB', confirmButtonColor: '#C8956C' });
        }
    }

    return Object.freeze({
        showQRISModal,
        closeQRISModal,
        openQRScanner,
        closeQRScanner,
        generateReceipt,
        printReceipt,
        showPaymentNotification,
        playChimeSound
    });
})();
