"use strict";

/**
 * ============================================================
 * main.js — Application Orchestrator & Entry Point (ES6 Module)
 * ============================================================
 * Titik masuk utama aplikasi POS Kedai Kisanak.
 * Menghubungkan seluruh modul service, komponen UI, dan
 * mengelola event listener terpusat tanpa inline script HTML.
 */

import { openDatabase, seedProducts, saveTransaction, updateStock, resetDatabase, getCanonicalProduct } from './services/db.js';
import { initCart, getCartItems, getCartTotal, resetCart, clearCart, registerCartUpdateListener } from './components/cart.js';
import { refreshProducts, setSearchQuery, renderMenuGrid } from './components/menu.js';
import { openQRISModal, closeQRISModal, openQRScanner, closeQRScanner, showToast } from './components/payment.js';
import { showHistoryModal, closeHistoryModal } from './components/history.js';
import { generateReceipt, printReceipt } from './components/receipt.js';
import { SecurityUtils } from './utils/security.js';
import { formatNumber } from './utils/formatters.js';

let orderSequence = 1;

/**
 * Inisialisasi Aplikasi POS
 */
async function bootstrapApp() {
    try {
        console.log('🚀 Menginisialisasi Kedai Kisanak POS System (ES6 Modules)...');

        // 1. Inisialisasi Database
        await openDatabase();
        await seedProducts();

        // 2. Inisialisasi Keranjang Belanja
        await initCart();

        // 3. Render Katalog & Menu
        await refreshProducts();

        // 4. Sinkronisasi perubahan stok saat keranjang dimutasi
        registerCartUpdateListener(() => {
            renderMenuGrid();
        });

        // 5. Setup Seluruh Event Listener DOM Terpusat
        setupEventListeners();

        // 6. Jalankan Jam Operasional Kasir
        startLiveClock();

        console.log('✅ Kedai Kisanak POS siap melayani pesanan.');
    } catch (criticalError) {
        console.error('[CRITICAL] Gagal menjalankan inisialisasi aplikasi:', criticalError);
        displayFallbackUI(criticalError);
    }
}

/**
 * Fallback UI jika terjadi kegagalan sistem kritis pada browser
 */
function displayFallbackUI(error) {
    const mainContainer = document.querySelector('.main-container');
    if (mainContainer) {
        mainContainer.innerHTML = `
            <div style="grid-column: 1 / -1; padding: 60px 20px; text-align: center; color: var(--text-primary);">
                <div style="font-size: 3rem; margin-bottom: 16px;">⚠️</div>
                <h2 style="font-family: 'Playfair Display', serif; margin-bottom: 8px;">Pemberitahuan Sistem</h2>
                <p style="color: var(--text-secondary); max-width: 500px; margin: 0 auto 20px;">
                    Aplikasi mendeteksi pembatasan pada browser Anda (${SecurityUtils.sanitize(error?.message || 'Inisialisasi terbatas')}).
                    Sistem beralih ke mode operasional memori.
                </p>
                <button class="btn-checkout" style="max-width: 200px; margin: 0 auto;" onclick="location.reload()">
                    Muat Ulang Halaman
                </button>
            </div>
        `;
    }
}

/**
 * Menghubungkan seluruh interaksi tombol & modal secara terpusat
 */
function setupEventListeners() {
    // Tombol Header
    document.getElementById('btn-scan-qr')?.addEventListener('click', () => {
        openQRScanner();
    });

    document.getElementById('btn-history')?.addEventListener('click', () => {
        showHistoryModal();
    });

    document.getElementById('btn-reset')?.addEventListener('click', () => {
        handleResetDatabase();
    });

    document.getElementById('btn-clear-cart')?.addEventListener('click', () => {
        clearCart();
    });

    // Modal Close Buttons
    document.getElementById('btn-close-qris')?.addEventListener('click', () => {
        closeQRISModal();
    });

    document.getElementById('btn-close-scanner')?.addEventListener('click', () => {
        closeQRScanner();
    });

    document.getElementById('btn-close-history')?.addEventListener('click', () => {
        closeHistoryModal();
    });

    // Menutup modal jika backdrop diklik
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
                if (modal.id === 'scanner-modal') closeQRScanner();
                if (modal.id === 'qris-modal') closeQRISModal();
            }
        });
    });

    // Search Input
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            setSearchQuery(e.target.value);
        });
    }

    // Listener Event Checkout dari komponen Cart
    window.addEventListener('kisanak:checkout', (event) => {
        handleCheckoutFlow(event.detail);
    });
}

/**
 * Menghasilkan nomor nota transaksi unik (Contoh: KS-20260929-0001)
 */
function createOrderNumber() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const seq = String(orderSequence++).padStart(4, '0');
    return `KS-${year}${month}${day}-${seq}`;
}

/**
 * Alur Proses Checkout Lengkap
 */
async function handleCheckoutFlow({ paymentMethod }) {
    const cartItems = getCartItems();
    if (cartItems.length === 0) {
        showToast('⚠️', 'Keranjang Kosong', 'Silakan pilih menu sebelum melanjutkan pesanan.', 'warning');
        return;
    }

    // Ambil input pelanggan dan catatan
    const nameInput = document.getElementById('customer-name');
    const notesInput = document.getElementById('order-notes');

    const customerName = SecurityUtils.sanitize(nameInput?.value.trim()) || 'Walk-in Customer';
    const orderNotes = SecurityUtils.sanitize(notesInput?.value.trim()) || '-';

    const orderNumber = createOrderNumber();
    const canonicalTotal = getCartTotal();

    if (paymentMethod === 'QRIS') {
        openQRISModal(canonicalTotal, orderNumber, async () => {
            await finalizeOrder(orderNumber, canonicalTotal, paymentMethod, customerName, orderNotes);
        });
    } else {
        await finalizeOrder(orderNumber, canonicalTotal, paymentMethod, customerName, orderNotes);
    }
}

/**
 * Finalisasi Pesanan, Simpan Transaksi & Cetak Struk
 */
async function finalizeOrder(orderNumber, total, paymentMethod, customerName, orderNotes) {
    try {
        const cartItems = getCartItems();

        // Siapkan item dengan nama dan harga kanonikal
        const finalItems = cartItems.map(item => {
            const canonical = getCanonicalProduct(item.id);
            return {
                id: item.id,
                name: canonical ? canonical.name : 'Unknown',
                price: canonical ? canonical.price : 0,
                quantity: item.quantity
            };
        });

        const txPayload = {
            orderNumber,
            items: finalItems,
            total,
            paymentMethod,
            customerName,
            orderNotes
        };

        // 1. Simpan ke Database dengan tanda tangan SHA-256
        await saveTransaction(txPayload);

        // 2. Kurangi stok produk
        for (const item of cartItems) {
            await updateStock(item.id, item.quantity);
        }

        // 3. Render struk belanja
        generateReceipt({
            orderNumber,
            items: finalItems,
            total,
            paymentMethod,
            customerName,
            orderNotes,
            date: new Date()
        });

        // 4. Bersihkan form & keranjang
        resetCart();
        const nameInput = document.getElementById('customer-name');
        const notesInput = document.getElementById('order-notes');
        if (nameInput) nameInput.value = '';
        if (notesInput) notesInput.value = '';

        // 5. Perbarui tampilan menu & stok
        await refreshProducts();

        // 6. Tampilkan konfirmasi sukses SweetAlert2
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Pesanan Berhasil! 🎉',
                html: `
                    <div style="text-align: left; font-size: 0.9rem; line-height: 1.6; margin-top: 10px;">
                        <p>Order: <strong>${SecurityUtils.sanitize(orderNumber)}</strong></p>
                        <p>Pelanggan: <strong>${SecurityUtils.sanitize(customerName)}</strong></p>
                        <p>Catatan: <em>${SecurityUtils.sanitize(orderNotes)}</em></p>
                        <p>Total: <strong style="color: #C8956C;">Rp ${formatNumber(total)}</strong></p>
                        <p>Metode: <strong>${SecurityUtils.sanitize(paymentMethod)}</strong></p>
                    </div>
                `,
                icon: 'success',
                showCancelButton: true,
                confirmButtonColor: '#C8956C',
                cancelButtonColor: '#6B5F54',
                confirmButtonText: '🖨️ Cetak Struk',
                cancelButtonText: 'Tutup',
                background: '#1A1A1A',
                color: '#F5F0EB'
            }).then((result) => {
                if (result.isConfirmed) {
                    printReceipt();
                }
            });
        }
    } catch (error) {
        console.error('[CHECKOUT ERROR]', error);
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Peringatan Keamanan',
                text: error.message || 'Gagal memproses transaksi.',
                icon: 'error',
                background: '#1A1A1A',
                color: '#F5F0EB'
            });
        }
    }
}

/**
 * Konfirmasi reset database
 */
function handleResetDatabase() {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'Reset Database?',
            text: 'Semua data transaksi & stok akan dikembalikan ke kondisi awal pabrik.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6B5F54',
            confirmButtonText: 'Ya, Reset',
            cancelButtonText: 'Batal',
            background: '#1A1A1A',
            color: '#F5F0EB'
        }).then(async (result) => {
            if (result.isConfirmed) {
                await resetDatabase();
                resetCart();
                await refreshProducts();
                Swal.fire({
                    title: 'Database Direset!',
                    icon: 'success',
                    background: '#1A1A1A',
                    color: '#F5F0EB',
                    confirmButtonColor: '#C8956C'
                });
            }
        });
    }
}

/**
 * Jam real-time pada header
 */
function startLiveClock() {
    const clockEl = document.getElementById('header-clock');
    if (!clockEl) return;

    function tick() {
        const now = new Date();
        clockEl.textContent = now.toLocaleDateString('id-ID', {
            weekday: 'short', day: 'numeric', month: 'short',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        });
    }
    tick();
    setInterval(tick, 1000);
}


// Inisialisasi saat DOM siap
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapApp);
} else {
    bootstrapApp();
}
