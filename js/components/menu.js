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
import { addToCart } from './cart.js';

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
                    <span>${safeName}</span>
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
            <div class="stat-row"><span>Total Produk</span><span>${cachedProducts.length}</span></div>
            <div class="stat-row"><span>Stok Rendah</span><span>${lowStockCount}</span></div>
            <div class="stat-row"><span>Habis</span><span>${outOfStockCount}</span></div>
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

    if (menuTitle) menuTitle.textContent = activeCategory === 'Semua' ? 'Semua Menu' : activeCategory;
    if (itemCount) itemCount.textContent = `${products.length} item`;

    if (products.length === 0) {
        SecurityUtils.safeSetHTML(grid, `
            <div style="grid-column: 1 / -1; text-align: center; padding: 60px 0; color: var(--text-muted);">
                <div style="font-size: 3rem; margin-bottom: 12px;">🔍</div>
                <p>Tidak ada menu yang sesuai dengan pencarian</p>
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

        return `
            <div class="menu-card ${isOutOfStock ? 'out-of-stock' : ''}" 
                 data-product-id="${safeId}" id="card-${safeId}">
                <div class="card-image">
                    <img src="${safeImage}" alt="${safeName}"
                         onerror="this.parentElement.innerHTML='<div class=\\'img-placeholder\\'>${getCategoryEmoji(product.category)}</div>'">
                    <span class="stock-badge ${isLowStock ? 'low-stock' : ''}">
                        ${isOutOfStock ? 'Habis' : `Stok: ${product.stock}`}
                    </span>
                </div>
                <div class="card-body">
                    <p class="category-tag">${safeCategory}</p>
                    <h4>${safeName}</h4>
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

    grid.querySelectorAll('.btn-add').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.addId;
            if (id) addToCart(id);
        });
    });
}
