"use strict";

/**
 * ============================================================
 * menu.js — Komponen Katalog Menu & Navigasi Kategori
 * ============================================================
 */

import { CATEGORIES } from '../config/constants.js';
import { getAllProducts, getCanonicalPrice } from '../services/db.js';
import { SecurityUtils } from '../utils/security.js';
import { formatNumber } from '../utils/formatters.js';
import { addToCart, getCartItems } from './cart.js';

let activeCategory = 'Semua';
let searchQuery = '';
let cachedProducts = [];

export function getActiveCategory() {
    return activeCategory;
}

export function setSearchQuery(query) {
    searchQuery = SecurityUtils.sanitize(query).toLowerCase().trim();
    renderMenuGrid();
}

export async function refreshProducts() {
    cachedProducts = await getAllProducts();
    renderSidebar();
    renderMenuGrid();
}

function getCategoryEmoji(category) {
    const map = {
        'Espresso Based': '☕',
        'Manual Brew': '🫖',
        'Non-Coffee': '🍵',
        'Pastry & Food': '🥐'
    };
    return map[category] || '☕';
}

function getFilteredProducts() {
    let list = [...cachedProducts];
    if (activeCategory !== 'Semua') {
        list = list.filter(p => p.category === activeCategory);
    }
    if (searchQuery) {
        list = list.filter(p =>
            p.name.toLowerCase().includes(searchQuery) ||
            p.description.toLowerCase().includes(searchQuery)
        );
    }
    return list;
}

/**
 * Render sidebar navigasi kategori menu
 */
export function renderSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    let html = '<p class="sidebar-title">Kategori Menu</p>';

    CATEGORIES.forEach(cat => {
        const count = cat.name === 'Semua'
            ? cachedProducts.length
            : cachedProducts.filter(p => p.category === cat.name).length;

        const isActive = cat.name === activeCategory ? 'active' : '';
        const safeName = SecurityUtils.sanitize(cat.name);

        html += `
            <button class="category-btn ${isActive}" 
                    data-category="${safeName}"
                    id="cat-btn-${safeName.replace(/[^a-zA-Z]/g, '')}">
                <span class="cat-icon">${SecurityUtils.sanitize(cat.icon)}</span>
                <span class="cat-info">
                    <span class="cat-name">${safeName}</span>
                    <span class="cat-count">${count} item</span>
                </span>
            </button>
        `;
    });

    const lowStockCount = cachedProducts.filter(p => p.stock > 0 && p.stock <= 5).length;
    const outOfStockCount = cachedProducts.filter(p => p.stock === 0).length;

    html += `
        <div class="sidebar-divider"></div>
        <div class="sidebar-stats">
            <h4>Ringkasan Stok</h4>
            <div class="stat-row">
                <span class="stat-label">Total Produk</span>
                <span class="stat-value stat-total">${cachedProducts.length}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Stok Rendah</span>
                <span class="stat-value stat-warning">${lowStockCount}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Habis</span>
                <span class="stat-value stat-danger">${outOfStockCount}</span>
            </div>
        </div>
    `;

    SecurityUtils.safeSetHTML(sidebar, html);

    sidebar.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const cat = btn.dataset.category;
            if (cat) {
                activeCategory = cat;
                renderSidebar();
                renderMenuGrid();
            }
        });
    });
}

/**
 * Render grid katalog kartu menu
 */
export function renderMenuGrid() {
    const grid = document.getElementById('menu-grid');
    const menuTitle = document.getElementById('menu-title');
    const itemCount = document.getElementById('item-count');
    if (!grid) return;

    const products = getFilteredProducts();
    const currentCart = getCartItems();

    if (menuTitle) menuTitle.textContent = activeCategory === 'Semua' ? 'Semua Menu' : activeCategory;
    if (itemCount) itemCount.textContent = `${products.length} pilihan`;

    if (products.length === 0) {
        SecurityUtils.safeSetHTML(grid, `
            <div class="menu-empty-state">
                <div class="empty-icon">☕</div>
                <h3>Menu Tidak Ditemukan</h3>
                <p>Tidak ada menu yang sesuai dengan kata kunci "${SecurityUtils.sanitize(searchQuery)}". Coba cari kata kunci lain.</p>
            </div>
        `);
        return;
    }

    const cardsHTML = products.map(product => {
        const canonicalPrice = getCanonicalPrice(product.id) || product.price;
        const safeName = SecurityUtils.sanitize(product.name);
        const safeDesc = SecurityUtils.sanitize(product.description);
        const safeCategory = SecurityUtils.sanitize(product.category);
        const safeImage = SecurityUtils.safeUrl(product.image);
        const safeId = SecurityUtils.sanitize(product.id);
        const isOutOfStock = product.stock <= 0;
        const isLowStock = product.stock > 0 && product.stock <= 5;

        // Cek kuantitas item ini di keranjang saat ini
        const inCartItem = currentCart.find(i => i.id === product.id);
        const inCartQty = inCartItem ? inCartItem.quantity : 0;
        const inCartBadge = inCartQty > 0 ? `
            <span class="in-cart-badge" title="${inCartQty} item dalam pesanan">
                <span class="in-cart-icon">✓</span> ${inCartQty} di pesanan
            </span>
        ` : '';

        return `
            <div class="menu-card ${isOutOfStock ? 'out-of-stock' : ''} ${inCartQty > 0 ? 'has-in-cart' : ''}" 
                 data-product-id="${safeId}" id="card-${safeId}" tabindex="0" role="button"
                 aria-label="Pilih ${safeName}, Harga Rp ${formatNumber(canonicalPrice)}">
                <div class="card-image">
                    <img src="${safeImage}" alt="${safeName}" loading="lazy"
                         onerror="this.parentElement.innerHTML='<div class=\\'img-placeholder\\'>${getCategoryEmoji(product.category)}</div>'">
                    <span class="stock-badge ${isLowStock ? 'low-stock' : ''}">
                        ${isOutOfStock ? 'Habis' : `Stok: ${product.stock}`}
                    </span>
                    ${inCartBadge}
                </div>
                <div class="card-body">
                    <p class="category-tag">${safeCategory}</p>
                    <h4 class="card-title">${safeName}</h4>
                    <p class="card-desc">${safeDesc}</p>
                    <div class="card-footer">
                        <span class="price">Rp ${formatNumber(canonicalPrice)}</span>
                        <button class="btn-add ripple" 
                                data-add-id="${safeId}"
                                ${isOutOfStock ? 'disabled' : ''}
                                title="${isOutOfStock ? 'Stok habis' : 'Tambah ke pesanan'}"
                                aria-label="Tambah ${safeName}">
                            +
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    SecurityUtils.safeSetHTML(grid, cardsHTML);

    // Kasir dapat mengklik seluruh kartu untuk menambah item secara cepat
    grid.querySelectorAll('.menu-card:not(.out-of-stock)').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.dataset.productId;
            if (id) addToCart(id);
        });
    });

    // Cegah double-fire jika kasir mengklik tombol + langsung
    grid.querySelectorAll('.btn-add').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.addId;
            if (id) addToCart(id);
        });
    });
}

