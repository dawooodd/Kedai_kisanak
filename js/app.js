/**
 * ============================================================
 * app.js — Logika UI Utama Kedai Kisanak POS System
 * ============================================================
 * SECURITY HARDENED:
 * - SecurityUtils: sanitasi XSS pada semua output ke DOM
 * - Harga SELALU diambil dari database, bukan dari DOM/cart
 * - Cart hanya menyimpan { id, quantity }, harga diambil saat render
 * - Input validation pada semua user-facing data
 * - Object.freeze pada public API
 * ============================================================
 */

// ─── SECURITY UTILITIES (XSS Prevention) ────────────────────
// Modul global untuk sanitasi input, tersedia untuk semua file JS
const SecurityUtils = Object.freeze({
    /**
     * Escape karakter HTML berbahaya untuk mencegah XSS.
     * Mengganti <, >, ", ', &, / dengan HTML entities.
     */
    sanitize(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    },

    /**
     * Validasi bahwa nilai adalah angka positif yang masuk akal.
     */
    isValidPrice(value) {
        return typeof value === 'number' && 
               Number.isFinite(value) && 
               value > 0 && 
               value <= 10000000; // Maks 10 juta
    },

    /**
     * Validasi bahwa quantity adalah integer positif wajar.
     */
    isValidQuantity(value) {
        return Number.isInteger(value) && value > 0 && value <= 100;
    },

    /**
     * Buat elemen teks aman (textContent, bukan innerHTML).
     */
    createSafeTextNode(text) {
        return document.createTextNode(String(text));
    },

    /**
     * Set innerHTML secara aman setelah sanitasi.
     * Hanya digunakan untuk template yang kita kontrol.
     * Semua data dinamis HARUS sudah di-sanitize sebelum masuk template.
     */
    safeSetHTML(element, html) {
        if (element) {
            element.innerHTML = html;
        }
    }
});


const KisanakApp = (() => {
    // ─── State Aplikasi ─────────────────────────────────────
    // SECURITY: Cart hanya menyimpan ID dan quantity.
    // Harga SELALU diambil dari database saat diperlukan.
    let cart = [];       // Format: [{ id: 'ESP001', quantity: 2 }, ...]
    let allProducts = [];
    let activeCategory = 'Semua';
    let searchQuery = '';
    let orderCounter = 1;
    let selectedPaymentMethod = 'Tunai';

    // ─── Daftar Kategori ────────────────────────────────────
    const CATEGORIES = Object.freeze([
        { name: 'Semua', icon: '☕', count: 0 },
        { name: 'Espresso Based', icon: '⚡', count: 0 },
        { name: 'Manual Brew', icon: '🫖', count: 0 },
        { name: 'Non-Coffee', icon: '🍵', count: 0 },
        { name: 'Pastry & Food', icon: '🥐', count: 0 }
    ]);

    // ─── Working copy of categories (counts need to update) ─
    let categoryCounts = CATEGORIES.map(c => ({ ...c }));

    // ─── Inisialisasi Aplikasi ──────────────────────────────
    async function init() {
        try {
            await KisanakDB.init();
            allProducts = await KisanakDB.getAllProducts();
            updateCategoryCounts();
            renderSidebar();
            renderMenu();
            renderOrderPanel();
            startClock();
            setupSearchListener();
            fetchIPAddress();
            console.log('Aplikasi Kedai Kisanak siap');
        } catch (error) {
            console.error('Gagal inisialisasi:', error);
        }
    }

    // ─── Update Jumlah Produk per Kategori ──────────────────
    function updateCategoryCounts() {
        categoryCounts = CATEGORIES.map(cat => {
            const count = cat.name === 'Semua'
                ? allProducts.length
                : allProducts.filter(p => p.category === cat.name).length;
            return { ...cat, count };
        });
    }

    // ─── SECURITY HELPER: Ambil data produk dari DB cache ───
    // Sumber kebenaran tunggal untuk harga dan nama produk
    function getProductFromCache(productId) {
        return allProducts.find(p => p.id === productId) || null;
    }

    // ─── Render Sidebar Kategori ────────────────────────────
    function renderSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;

        let html = '<p class="sidebar-title">Kategori Menu</p>';

        categoryCounts.forEach(cat => {
            const isActive = cat.name === activeCategory ? 'active' : '';
            // SECURITY: nama kategori di-sanitize
            const safeName = SecurityUtils.sanitize(cat.name);
            html += `
                <button class="category-btn ${isActive}" 
                        data-category="${safeName}"
                        id="cat-btn-${safeName.replace(/[^a-zA-Z]/g, '')}">
                    <span class="cat-icon">${SecurityUtils.sanitize(cat.icon)}</span>
                    <span class="cat-info">
                        <span>${safeName}</span>
                        <span class="cat-count">${cat.count} item</span>
                    </span>
                </button>
            `;
        });

        html += `
            <div class="sidebar-divider"></div>
            <div class="sidebar-stats">
                <h4>Ringkasan Stok</h4>
                <div class="stat-row"><span>Total Produk</span><span>${allProducts.length}</span></div>
                <div class="stat-row"><span>Stok Rendah</span><span>${allProducts.filter(p => p.stock > 0 && p.stock <= 5).length}</span></div>
                <div class="stat-row"><span>Habis</span><span>${allProducts.filter(p => p.stock === 0).length}</span></div>
            </div>
        `;

        SecurityUtils.safeSetHTML(sidebar, html);

        // SECURITY: Event delegation menggantikan inline onclick
        sidebar.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const category = btn.dataset.category;
                if (category) filterByCategory(category);
            });
        });
    }

    // ─── Filter Berdasarkan Kategori ────────────────────────
    function filterByCategory(category) {
        activeCategory = category;
        renderSidebar();
        renderMenu();
    }

    // ─── Setup Listener Pencarian ───────────────────────────
    function setupSearchListener() {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                // SECURITY: Sanitasi query pencarian
                searchQuery = SecurityUtils.sanitize(e.target.value).toLowerCase().trim();
                renderMenu();
            });
        }
    }

    // ─── Filter Produk ──────────────────────────────────────
    function getFilteredProducts() {
        let filtered = [...allProducts];
        if (activeCategory !== 'Semua') {
            filtered = filtered.filter(p => p.category === activeCategory);
        }
        if (searchQuery) {
            filtered = filtered.filter(p =>
                p.name.toLowerCase().includes(searchQuery) ||
                p.description.toLowerCase().includes(searchQuery)
            );
        }
        return filtered;
    }

    // ─── Emoji fallback berdasarkan kategori ────────────────
    function getCategoryEmoji(category) {
        const map = { 'Espresso Based': '☕', 'Manual Brew': '🫖', 'Non-Coffee': '🍵', 'Pastry & Food': '🥐' };
        return map[category] || '☕';
    }

    // ─── Render Menu / Katalog Produk ───────────────────────
    function renderMenu() {
        const menuGrid = document.getElementById('menu-grid');
        const menuTitle = document.getElementById('menu-title');
        const itemCount = document.getElementById('item-count');
        if (!menuGrid) return;

        const products = getFilteredProducts();

        if (menuTitle) menuTitle.textContent = activeCategory === 'Semua' ? 'Semua Menu' : activeCategory;
        if (itemCount) itemCount.textContent = `${products.length} item`;

        if (products.length === 0) {
            SecurityUtils.safeSetHTML(menuGrid, `
                <div style="grid-column: 1 / -1; text-align: center; padding: 60px 0; color: var(--text-muted);">
                    <div style="font-size: 3rem; margin-bottom: 12px;">🔍</div>
                    <p>Tidak ada menu ditemukan</p>
                </div>
            `);
            return;
        }

        // SECURITY: Semua data produk di-sanitize sebelum masuk template
        const cardsHTML = products.map(product => {
            const safeName = SecurityUtils.sanitize(product.name);
            const safeDesc = SecurityUtils.sanitize(product.description);
            const safeCategory = SecurityUtils.sanitize(product.category);
            const safeImage = SecurityUtils.sanitize(product.image);
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
                            <span class="price">Rp ${formatNumber(product.price)}</span>
                            <button class="btn-add ripple" 
                                    data-add-id="${safeId}"
                                    ${isOutOfStock ? 'disabled' : ''}
                                    title="${isOutOfStock ? 'Stok habis' : 'Tambah ke keranjang'}">
                                +
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        SecurityUtils.safeSetHTML(menuGrid, cardsHTML);

        // SECURITY: Event delegation, bukan inline onclick
        menuGrid.querySelectorAll('.btn-add').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const productId = btn.dataset.addId;
                if (productId) addToCart(productId);
            });
        });
    }

    // ─── Tambah Item ke Keranjang ────────────────────────────
    // SECURITY: Cart hanya menyimpan ID + quantity.
    // Harga TIDAK disimpan di cart — selalu diambil dari DB.
    function addToCart(productId) {
        const product = getProductFromCache(productId);
        if (!product || product.stock <= 0) return;

        const existingItem = cart.find(item => item.id === productId);

        if (existingItem) {
            if (existingItem.quantity >= product.stock) {
                showToast('⚠️', 'Stok Terbatas', `Stok ${SecurityUtils.sanitize(product.name)} hanya tersisa ${product.stock}`, 'warning');
                return;
            }
            existingItem.quantity += 1;
        } else {
            // SECURITY: Hanya ID dan quantity, bukan harga
            cart.push({ id: product.id, quantity: 1 });
        }

        renderOrderPanel();

        const card = document.getElementById(`card-${productId}`);
        if (card) {
            card.style.transform = 'scale(0.95)';
            setTimeout(() => { card.style.transform = ''; }, 150);
        }
    }

    // ─── Ubah Jumlah Item di Keranjang ──────────────────────
    function changeQuantity(productId, delta) {
        // SECURITY: Validasi delta
        if (typeof delta !== 'number' || !Number.isInteger(delta)) return;

        const item = cart.find(i => i.id === productId);
        if (!item) return;

        const product = getProductFromCache(productId);

        if (delta > 0 && product && item.quantity >= product.stock) {
            showToast('⚠️', 'Stok Terbatas', `Stok ${SecurityUtils.sanitize(product.name)} hanya tersisa ${product.stock}`, 'warning');
            return;
        }

        item.quantity += delta;
        if (item.quantity <= 0) {
            cart = cart.filter(i => i.id !== productId);
        }
        renderOrderPanel();
    }

    // ─── Bersihkan Keranjang ────────────────────────────────
    function clearCart() {
        if (cart.length === 0) return;
        Swal.fire({
            title: 'Kosongkan Keranjang?',
            text: 'Semua item akan dihapus dari pesanan',
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
                renderOrderPanel();
            }
        });
    }

    // ─── SECURITY: Hitung Total dari DATABASE, bukan cart ───
    function getCartTotal() {
        return cart.reduce((sum, item) => {
            const product = getProductFromCache(item.id);
            // Harga selalu dari database, tidak pernah dari client
            const price = product ? product.price : 0;
            return sum + (price * item.quantity);
        }, 0);
    }

    function getCartItemCount() {
        return cart.reduce((sum, item) => sum + item.quantity, 0);
    }

    function generateOrderNumber() {
        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const orderNum = String(orderCounter).padStart(4, '0');
        orderCounter++;
        return `KS-${dateStr}-${orderNum}`;
    }

    // ─── Render Panel Order / Keranjang ─────────────────────
    function renderOrderPanel() {
        const container = document.getElementById('order-items-container');
        const footer = document.getElementById('order-footer');
        if (!container) return;

        if (cart.length === 0) {
            SecurityUtils.safeSetHTML(container, `
                <div class="order-empty">
                    <span class="empty-icon">🛒</span>
                    <p>Belum ada pesanan</p>
                    <p style="font-size: 0.75rem;">Pilih menu untuk memulai</p>
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

        // SECURITY: Harga diambil dari database, bukan dari cart
        const itemsHTML = cart.map(item => {
            const product = getProductFromCache(item.id);
            if (!product) return '';

            const safeName = SecurityUtils.sanitize(product.name);
            const safeImage = SecurityUtils.sanitize(product.image);
            const safeId = SecurityUtils.sanitize(item.id);
            const subtotal = product.price * item.quantity;

            return `
                <div class="order-item">
                    <img src="${safeImage}" alt="${safeName}" class="item-image"
                         onerror="this.style.display='none'">
                    <div class="item-info">
                        <h4>${safeName}</h4>
                        <span class="item-price">Rp ${formatNumber(product.price)}</span>
                    </div>
                    <div class="qty-controls">
                        <button data-qty-id="${safeId}" data-qty-delta="-1">−</button>
                        <span class="qty-value">${item.quantity}</span>
                        <button data-qty-id="${safeId}" data-qty-delta="1">+</button>
                    </div>
                    <span class="item-subtotal">Rp ${formatNumber(subtotal)}</span>
                </div>
            `;
        }).join('');

        SecurityUtils.safeSetHTML(container, itemsHTML);

        // SECURITY: Event delegation untuk quantity buttons
        container.querySelectorAll('[data-qty-id]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.qtyId;
                const delta = parseInt(btn.dataset.qtyDelta, 10);
                if (id && !isNaN(delta)) changeQuantity(id, delta);
            });
        });

        // SECURITY: Total dihitung dari database price
        const total = getCartTotal();
        const itemCount = getCartItemCount();

        if (footer) {
            const payMethods = ['Tunai', 'QRIS', 'Kartu'];
            const payIcons = { Tunai: '💵', QRIS: '📱', Kartu: '💳' };

            const payBtnsHTML = payMethods.map(m => `
                <button class="pay-method-btn ${selectedPaymentMethod === m ? 'active' : ''}" data-pay-method="${m}">
                    <span class="pay-icon">${payIcons[m]}</span>
                    ${m}
                </button>
            `).join('');

            SecurityUtils.safeSetHTML(footer, `
                <div class="order-summary-row">
                    <span>Jumlah Item</span>
                    <span>${itemCount} pcs</span>
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

            // Event delegation for payment & checkout buttons
            footer.querySelectorAll('[data-pay-method]').forEach(btn => {
                btn.addEventListener('click', () => {
                    selectPayment(btn.dataset.payMethod);
                });
            });
            const checkoutBtn = document.getElementById('btn-process-checkout');
            if (checkoutBtn) {
                checkoutBtn.addEventListener('click', processCheckout);
            }
        }
    }

    function selectPayment(method) {
        const validMethods = ['Tunai', 'QRIS', 'Kartu'];
        if (!validMethods.includes(method)) return; // SECURITY: whitelist
        selectedPaymentMethod = method;
        renderOrderPanel();
    }

    // ─── SECURITY: Proses Checkout dengan validasi server-side-style ─
    async function processCheckout() {
        if (cart.length === 0) return;

        // SECURITY: Hitung total dari DATABASE, bukan dari DOM
        const total = getCartTotal();
        const orderNumber = generateOrderNumber();

        // Build cart items dengan harga dari database
        const verifiedItems = cart.map(item => {
            const product = getProductFromCache(item.id);
            return {
                id: item.id,
                name: product ? product.name : 'Unknown',
                price: product ? product.price : 0,
                quantity: item.quantity
            };
        });

        if (selectedPaymentMethod === 'QRIS') {
            KisanakPayment.showQRISModal(total, orderNumber, verifiedItems, selectedPaymentMethod);
        } else {
            await completeOrder(orderNumber, total, selectedPaymentMethod);
        }
    }

    // ─── Selesaikan Pesanan ─────────────────────────────────
    async function completeOrder(orderNumber, total, paymentMethod) {
        try {
            // SECURITY: Build items dari database, bukan dari DOM
            const verifiedItems = cart.map(item => {
                const product = getProductFromCache(item.id);
                return {
                    id: item.id,
                    name: product ? product.name : 'Unknown',
                    price: product ? product.price : 0,
                    quantity: item.quantity
                };
            });

            // SECURITY: Hitung ulang total dari DB (double-check)
            const verifiedTotal = verifiedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

            const transactionData = {
                items: verifiedItems,
                total: verifiedTotal, // Harga dari DB, bukan parameter
                paymentMethod: paymentMethod,
                orderNumber: orderNumber
            };

            // saveTransaction() akan melakukan validasi LAGI di db.js
            await KisanakDB.saveTransaction(transactionData);

            for (const item of cart) {
                await KisanakDB.updateStock(item.id, item.quantity);
            }

            allProducts = await KisanakDB.getAllProducts();
            updateCategoryCounts();

            const receiptData = {
                orderNumber,
                items: verifiedItems,
                total: verifiedTotal,
                paymentMethod,
                date: new Date()
            };
            KisanakPayment.generateReceipt(receiptData);

            cart = [];
            renderSidebar();
            renderMenu();
            renderOrderPanel();

            Swal.fire({
                title: 'Pesanan Berhasil! 🎉',
                html: `
                    <p style="margin-bottom: 8px;">Order: <strong>${SecurityUtils.sanitize(orderNumber)}</strong></p>
                    <p style="margin-bottom: 8px;">Total: <strong>Rp ${formatNumber(verifiedTotal)}</strong></p>
                    <p>Metode: <strong>${SecurityUtils.sanitize(paymentMethod)}</strong></p>
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
                if (result.isConfirmed) KisanakPayment.printReceipt();
            });
        } catch (error) {
            console.error('Gagal checkout:', error);
            Swal.fire({
                title: 'Error Keamanan',
                text: error.message || 'Gagal memproses pesanan.',
                icon: 'error',
                background: '#1A1A1A',
                color: '#F5F0EB'
            });
        }
    }

    // ─── Tampilkan Riwayat Transaksi ────────────────────────
    async function showHistory() {
        try {
            const transactions = await KisanakDB.getAllTransactions();
            const modal = document.getElementById('history-modal');
            const historyList = document.getElementById('history-list');
            if (!modal || !historyList) return;

            if (transactions.length === 0) {
                SecurityUtils.safeSetHTML(historyList, `
                    <div class="history-empty">
                        <div class="empty-icon">📋</div>
                        <p>Belum ada riwayat transaksi</p>
                    </div>
                `);
            } else {
                const sorted = transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
                // SECURITY: Semua data dari DB di-sanitize sebelum render
                SecurityUtils.safeSetHTML(historyList, sorted.map(tx => {
                    const date = new Date(tx.date);
                    const dateStr = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
                    const timeStr = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                    const itemNames = tx.items.map(i => `${SecurityUtils.sanitize(i.name)} x${i.quantity}`).join(', ');

                    return `
                        <div class="history-item">
                            <div class="history-header">
                                <span class="order-id">${SecurityUtils.sanitize(tx.orderNumber)}</span>
                                <span class="order-date">${SecurityUtils.sanitize(dateStr)} ${SecurityUtils.sanitize(timeStr)}</span>
                            </div>
                            <p class="history-details">${itemNames}</p>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span class="history-total">Rp ${formatNumber(tx.total)}</span>
                                <span style="font-size:0.75rem; color:var(--text-muted);">${SecurityUtils.sanitize(tx.paymentMethod)}</span>
                            </div>
                        </div>
                    `;
                }).join(''));
            }
            modal.classList.add('active');
        } catch (error) {
            console.error('Gagal memuat riwayat:', error);
        }
    }

    function closeModal(modalId) {
        // SECURITY: Validasi modalId terhadap whitelist
        const allowedModals = ['history-modal', 'qris-modal', 'scanner-modal'];
        if (!allowedModals.includes(modalId)) return;
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('active');
    }

    async function resetDB() {
        Swal.fire({
            title: 'Reset Database?',
            text: 'Semua data transaksi & stok akan dikembalikan ke awal.',
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
                await KisanakDB.resetDatabase();
                allProducts = await KisanakDB.getAllProducts();
                updateCategoryCounts();
                cart = [];
                renderSidebar();
                renderMenu();
                renderOrderPanel();
                Swal.fire({ title: 'Database Direset!', icon: 'success', background: '#1A1A1A', color: '#F5F0EB', confirmButtonColor: '#C8956C' });
            }
        });
    }

    function startClock() {
        const clockEl = document.getElementById('header-clock');
        if (!clockEl) return;
        function update() {
            const now = new Date();
            // SECURITY: Menggunakan textContent, bukan innerHTML
            clockEl.textContent = now.toLocaleDateString('id-ID', {
                weekday: 'short', day: 'numeric', month: 'short',
                hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
            });
        }
        update();
        setInterval(update, 1000);
    }

    function fetchIPAddress() {
        const ipEl = document.getElementById('ip-value');
        if (!ipEl) return;
        fetch('https://api.ipify.org?format=json')
            .then(res => res.json())
            .then(data => {
                // SECURITY: Validasi format IP sebelum render
                if (data.ip && /^[\d.]+$/.test(data.ip)) {
                    ipEl.textContent = data.ip; // textContent, bukan innerHTML
                } else {
                    ipEl.textContent = '127.0.0.1';
                }
            })
            .catch(() => { ipEl.textContent = '192.168.1.1'; });
    }

    function showToast(icon, title, message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = 'toast';
        if (type === 'warning') {
            toast.style.background = 'linear-gradient(135deg, #2e2a1a, #1f1a0d)';
            toast.style.borderColor = 'rgba(234, 179, 8, 0.3)';
        }
        // SECURITY: Semua data di-sanitize
        SecurityUtils.safeSetHTML(toast, `
            <span class="toast-icon">${SecurityUtils.sanitize(icon)}</span>
            <div class="toast-body">
                <p class="toast-title" ${type === 'warning' ? 'style="color: #eab308;"' : ''}>${SecurityUtils.sanitize(title)}</p>
                <p class="toast-message" ${type === 'warning' ? 'style="color: #fde68a;"' : ''}>${SecurityUtils.sanitize(message)}</p>
            </div>
            <button class="toast-close-btn">✕</button>
        `);
        toast.querySelector('.toast-close-btn').addEventListener('click', () => toast.remove());
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('toast-exit');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    function formatNumber(num) {
        if (typeof num !== 'number' || !Number.isFinite(num)) return '0';
        return num.toLocaleString('id-ID');
    }

    // ─── Public API (frozen) ────────────────────────────────
    return Object.freeze({
        init,
        filterByCategory,
        addToCart,
        changeQuantity,
        clearCart,
        selectPayment,
        processCheckout,
        completeOrder,
        showHistory,
        closeModal,
        resetDB,
        showToast,
        formatNumber,
        getCartTotal,
        get cart() { return cart; },
        get selectedPaymentMethod() { return selectedPaymentMethod; }
    });
})();

document.addEventListener('DOMContentLoaded', () => {
    KisanakApp.init();
});
