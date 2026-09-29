"use strict";

/**
 * ============================================================
 * cart.js — Komponen Keranjang Belanja & Logika Transaksi
 * ============================================================
 */

import { PAYMENT_METHODS } from '../config/constants.js';
import { getCanonicalProduct, getCanonicalPrice, getAllProducts } from '../services/db.js';
import { saveCartState, loadCartState, clearCartState } from '../services/storage.js';
import { SecurityUtils } from '../utils/security.js';
import { formatNumber } from '../utils/formatters.js';
import { showToast } from './payment.js';

let cart = []; // [{ id: 'ESP001', quantity: 2 }]
let selectedPaymentMethod = 'Tunai';
let onCartUpdatedCallback = null;

export function registerCartUpdateListener(callback) {
    onCartUpdatedCallback = callback;
}

function notifyCartUpdate() {
    saveCartState(cart);
    renderOrderPanel();
    if (typeof onCartUpdatedCallback === 'function') {
        onCartUpdatedCallback();
    }
}

/**
 * Mengembalikan salinan beku agar aman dari manipulasi DevTools Console
 */
export function getCartItems() {
    return Object.freeze(cart.map(item => Object.freeze({ ...item })));
}

export function getSelectedPaymentMethod() {
    return selectedPaymentMethod;
}

export async function initCart() {
    const { cart: restoredCart, wasTampered } = await loadCartState();
    cart = restoredCart;

    if (wasTampered) {
        showToast('🛡️', 'Peringatan Keamanan', 'Data keranjang lokal dimanipulasi & telah direset otomatis.', 'warning');
    }
    renderOrderPanel();
}

/**
 * Menambahkan item ke keranjang belanja
 * @param {string} productId
 */
export async function addToCart(productId) {
    const canonical = getCanonicalProduct(productId);
    if (!canonical) {
        console.error('[SECURITY ALERT] Produk tidak sah:', productId);
        return;
    }

    const allProducts = await getAllProducts();
    const currentProduct = allProducts.find(p => p.id === productId);
    if (!currentProduct || currentProduct.stock <= 0) return;

    const existing = cart.find(item => item.id === productId);

    if (existing) {
        if (existing.quantity >= currentProduct.stock) {
            showToast('⚠️', 'Stok Terbatas', `Stok ${SecurityUtils.sanitize(canonical.name)} hanya tersisa ${currentProduct.stock}`, 'warning');
            return;
        }
        existing.quantity += 1;
    } else {
        cart.push({ id: canonical.id, quantity: 1 });
    }

    notifyCartUpdate();

    // Animasi klik pada kartu menu
    const card = document.getElementById(`card-${productId}`);
    if (card) {
        card.style.transform = 'scale(0.96)';
        setTimeout(() => { card.style.transform = ''; }, 150);
    }
}

/**
 * Mengubah jumlah item pada keranjang belanja
 * @param {string} productId
 * @param {number} delta
 */
export async function changeQuantity(productId, delta) {
    if (typeof delta !== 'number' || !Number.isInteger(delta)) return;

    const item = cart.find(i => i.id === productId);
    if (!item) return;

    const allProducts = await getAllProducts();
    const currentProduct = allProducts.find(p => p.id === productId);

    if (delta > 0 && currentProduct && item.quantity >= currentProduct.stock) {
        showToast('⚠️', 'Stok Terbatas', `Stok hanya tersisa ${currentProduct.stock}`, 'warning');
        return;
    }

    item.quantity += delta;
    if (item.quantity <= 0) {
        cart = cart.filter(i => i.id !== productId);
    }

    notifyCartUpdate();
}

/**
 * Mengosongkan keranjang belanja
 */
export function clearCart() {
    if (cart.length === 0) return;

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'Kosongkan Keranjang?',
            text: 'Semua item akan dihapus dari pesanan saat ini.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#C8956C',
            cancelButtonColor: '#6B5F54',
            confirmButtonText: 'Ya, Kosongkan',
            cancelButtonText: 'Batal',
            background: '#1A1A1A',
            color: '#F5F0EB'
        }).then((result) => {
            if (result.isConfirmed) {
                cart = [];
                clearCartState();
                notifyCartUpdate();
            }
        });
    } else {
        if (confirm('Kosongkan semua pesanan?')) {
            cart = [];
            clearCartState();
            notifyCartUpdate();
        }
    }
}

/**
 * Reset internal keranjang setelah pesanan selesai
 */
export function resetCart() {
    cart = [];
    clearCartState();
    notifyCartUpdate();
}

/**
 * Menghitung total harga MURNI dari Canonical Vault
 * @returns {number}
 */
export function getCartTotal() {
    return cart.reduce((total, item) => {
        const canonicalPrice = getCanonicalPrice(item.id);
        if (canonicalPrice === null || canonicalPrice === undefined) {
            return total;
        }
        return total + (canonicalPrice * item.quantity);
    }, 0);
}

export function getCartItemCount() {
    return cart.reduce((count, item) => count + item.quantity, 0);
}

/**
 * Render visual panel keranjang belanja
 */
export function renderOrderPanel() {
    const container = document.getElementById('order-items-container');
    const footer = document.getElementById('order-footer');
    if (!container) return;

    if (cart.length === 0) {
        SecurityUtils.safeSetHTML(container, `
            <div class="order-empty">
                <span class="empty-icon">🛒</span>
                <p>Belum ada pesanan</p>
                <p style="font-size: 0.75rem; color: var(--text-muted);">Pilih menu untuk memulai transaksi</p>
            </div>
        `);
        if (footer) {
            SecurityUtils.safeSetHTML(footer, `
                <div class="order-total-row">
                    <span>Total</span>
                    <span class="total-amount">Rp 0</span>
                </div>
                <button class="btn-checkout" disabled>Proses Pesanan</button>
            `);
        }
        return;
    }

    const itemsHTML = cart.map(item => {
        const canonical = getCanonicalProduct(item.id);
        if (!canonical) return '';

        const safeName = SecurityUtils.sanitize(canonical.name);
        const safeImage = SecurityUtils.safeUrl(canonical.image);
        const safeId = SecurityUtils.sanitize(item.id);
        const subtotal = canonical.price * item.quantity;

        return `
            <div class="order-item">
                <img src="${safeImage}" alt="${safeName}" class="item-image"
                     onerror="this.style.display='none'">
                <div class="item-info">
                    <h4>${safeName}</h4>
                    <span class="item-price">Rp ${formatNumber(canonical.price)}</span>
                </div>
                <div class="qty-controls">
                    <button data-qty-id="${safeId}" data-qty-delta="-1" aria-label="Kurangi">−</button>
                    <span class="qty-value">${item.quantity}</span>
                    <button data-qty-id="${safeId}" data-qty-delta="1" aria-label="Tambah">+</button>
                </div>
                <span class="item-subtotal">Rp ${formatNumber(subtotal)}</span>
            </div>
        `;
    }).join('');

    SecurityUtils.safeSetHTML(container, itemsHTML);

    // Event delegation untuk tombol kuantitas
    container.querySelectorAll('[data-qty-id]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.qtyId;
            const delta = parseInt(btn.dataset.qtyDelta, 10);
            if (id && !isNaN(delta)) changeQuantity(id, delta);
        });
    });

    const total = getCartTotal();
    const count = getCartItemCount();

    if (footer) {
        const payIcons = { Tunai: '💵', QRIS: '📱', Kartu: '💳' };
        const payBtnsHTML = PAYMENT_METHODS.map(method => `
            <button class="pay-method-btn ${selectedPaymentMethod === method ? 'active' : ''}" 
                    data-pay-method="${method}">
                <span class="pay-icon">${payIcons[method] || '💳'}</span>
                ${method}
            </button>
        `).join('');

        SecurityUtils.safeSetHTML(footer, `
            <div class="order-summary-row">
                <span>Jumlah Item</span>
                <span>${count} pcs</span>
            </div>
            <div class="order-total-row">
                <span>Total Pembayaran</span>
                <span class="total-amount">Rp ${formatNumber(total)}</span>
            </div>
            <div class="payment-methods">${payBtnsHTML}</div>
            <button class="btn-checkout ripple" id="btn-process-checkout"
                    ${cart.length === 0 ? 'disabled' : ''}>
                Proses Pesanan — Rp ${formatNumber(total)}
            </button>
        `);

        footer.querySelectorAll('[data-pay-method]').forEach(btn => {
            btn.addEventListener('click', () => {
                const method = btn.dataset.payMethod;
                if (PAYMENT_METHODS.includes(method)) {
                    selectedPaymentMethod = method;
                    renderOrderPanel();
                }
            });
        });

        document.getElementById('btn-process-checkout')?.addEventListener('click', () => {
            const event = new CustomEvent('kisanak:checkout', {
                detail: { total, paymentMethod: selectedPaymentMethod }
            });
            window.dispatchEvent(event);
        });
    }
}
