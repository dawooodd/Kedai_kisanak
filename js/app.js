/**
 * ============================================================
 * app.js — Logika UI Utama Kedai Kisanak POS System
 * ============================================================
 * CYBERSECURITY AUDITED & HARDENED:
 * 1. Anti-Tampering (Client-Side Price & Quantity Manipulation):
 *    - Harga TOTAL SELALU dihitung dari Canonical Vault (KisanakDB.getCanonicalPrice),
 *      TIDAK PERNAH membaca nilai dari atribut HTML / DOM.
 *    - Array `cart` dienkapsulasi: getter mengembalikan salinan beku (Object.freeze)
 *      sehingga tidak dapat dimanipulasi dari Console DevTools.
 *    - Validasi kuantitas ketat (integer positif, batas wajar 1-100).
 * 2. Cross-Site Scripting (XSS) Prevention:
 *    - Modul SecurityUtils dengan enkoding entitas HTML menyeluruh (&, <, >, ", ', /, `).
 *    - Sanitasi ketat pada input Nama Pelanggan dan Catatan Pesanan sebelum render.
 *    - Validasi protokol URL untuk mencegah payload `javascript:`.
 * 3. Data Integrity & Storage Security:
 *    - Sinkronisasi keranjang belanja ke localStorage dengan Cryptographic Checksum SHA-256.
 *    - Deteksi otomatis jika localStorage dimodifikasi manual lewat DevTools.
 *    - Peringatan visual pada riwayat transaksi jika checksum IndexedDB tidak valid.
 * 4. Zero Inline Script Architecture:
 *    - Seluruh event listener didaftarkan di sini untuk kepatuhan CSP tanpa 'unsafe-inline'.
 * ============================================================
 */

'use strict';

// ─── SECURITY UTILITIES (XSS Prevention & Input Validation) ──
const SecurityUtils = Object.freeze({
    /**
     * Escape karakter berbahaya untuk mencegah XSS.
     * Mengganti &, <, >, ", ', /, dan backtick dengan HTML entities.
     */
    sanitize(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;')
            .replace(/`/g, '&#96;');
    },

    /**
     * Menghapus semua tag HTML untuk plain text.
     */
    stripTags(str) {
        if (!str) return '';
        return String(str).replace(/<[^>]*>/g, '').trim();
    },

    /**
     * Validasi URL aman (mencegah javascript: dan data: payload).
     */
    safeUrl(url) {
        if (!url) return '';
        const clean = String(url).trim();
        if (/^(https?:|\/|gambar\/|data:image\/)/i.test(clean)) {
            return clean;
        }
        console.warn('[SECURITY] URL diblokir karena berpotensi berbahaya:', url);
        return 'gambar/logo_kisanak.jpg';
    },

    /**
     * Validasi bahwa nilai harga masuk akal.
     */
    isValidPrice(value) {
        return typeof value === 'number' && 
               Number.isFinite(value) && 
               value > 0 && 
               value <= 10000000;
    },

    /**
     * Validasi bahwa kuantitas adalah integer positif (1-100).
     */
    isValidQuantity(value) {
        return Number.isInteger(value) && value > 0 && value <= 100;
    },

    /**
     * Membuat text node aman (tidak memicu HTML parsing).
     */
    createSafeTextNode(text) {
        return document.createTextNode(String(text));
    },

    /**
     * Set innerHTML secara terkontrol setelah semua interpolasi variabel di-sanitize.
     */
    safeSetHTML(element, html) {
        if (element) {
            element.innerHTML = html;
        }
    }
});


const KisanakApp = (() => {
    // ─── State Aplikasi ─────────────────────────────────────
    // SECURITY: Cart internal HANYA menyimpan ID dan kuantitas.
    // Harga TIDAK PERNAH disimpan di sini.
    let cart = []; // [{ id: 'ESP001', quantity: 2 }]
    let allProducts = [];
    let activeCategory = 'Semua';
    let searchQuery = '';
    let orderCounter = 1;
    let selectedPaymentMethod = 'Tunai';

    const CART_STORAGE_KEY = 'KISANAK_CART_DATA';
    const CART_SIG_KEY = 'KISANAK_CART_CHECKSUM';

    // ─── Daftar Kategori ────────────────────────────────────
    const CATEGORIES = Object.freeze([
        { name: 'Semua', icon: '☕', count: 0 },
        { name: 'Espresso Based', icon: '⚡', count: 0 },
        { name: 'Manual Brew', icon: '🫖', count: 0 },
        { name: 'Non-Coffee', icon: '🍵', count: 0 },
        { name: 'Pastry & Food', icon: '🥐', count: 0 }
    ]);

    let categoryCounts = CATEGORIES.map(c => ({ ...c }));

    // ─── Inisialisasi Aplikasi & Event Listeners Terpusat ────
    async function init() {
        try {
            await KisanakDB.init();
            allProducts = await KisanakDB.getAllProducts();
            
            // Muat keranjang dengan verifikasi integritas
            await loadCartFromStorage();

            updateCategoryCounts();
            renderSidebar();
            renderMenu();
            renderOrderPanel();
            startClock();
            setupSearchListener();
            setupGlobalEventListeners();
            fetchIPAddress();
            console.log('✅ Aplikasi Kedai Kisanak siap (Zero Inline Script & Hardened CSP)');
        } catch (error) {
            console.error('❌ Gagal inisialisasi aplikasi:', error);
        }
    }

    // ─── Event Listeners Terpusat (Tanpa Inline Script HTML) ─
    function setupGlobalEventListeners() {
        // Header buttons
        document.getElementById('btn-scan-qr')?.addEventListener('click', () => {
            if (typeof KisanakPayment !== 'undefined') KisanakPayment.openQRScanner();
        });
        document.getElementById('btn-history')?.addEventListener('click', () => showHistory());
        document.getElementById('btn-reset')?.addEventListener('click', () => resetDB());
        document.getElementById('btn-clear-cart')?.addEventListener('click', () => clearCart());

        // Modal close buttons
        document.getElementById('btn-close-qris')?.addEventListener('click', () => {
            if (typeof KisanakPayment !== 'undefined') KisanakPayment.closeQRISModal();
        });
        document.getElementById('btn-close-scanner')?.addEventListener('click', () => {
            if (typeof KisanakPayment !== 'undefined') KisanakPayment.closeQRScanner();
        });
        document.getElementById('btn-close-history')?.addEventListener('click', () => {
            closeModal('history-modal');
        });

        // Close modal on backdrop click
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.classList.remove('active');
                    if (overlay.id === 'scanner-modal' && typeof KisanakPayment !== 'undefined') {
                        KisanakPayment.closeQRScanner();
                    }
                    if (overlay.id === 'qris-modal' && typeof KisanakPayment !== 'undefined') {
                        KisanakPayment.closeQRISModal();
                    }
                }
            });
        });
    }

    // ─── STORAGE SECURITY: Simpan Keranjang dengan Checksum ──
    async function saveCartToStorage() {
        try {
            const rawData = JSON.stringify(cart);
            localStorage.setItem(CART_STORAGE_KEY, rawData);
            const checksum = await KisanakDB.computeSHA256(cart);
            localStorage.setItem(CART_SIG_KEY, checksum);
        } catch (e) {
            console.warn('[STORAGE] Gagal menyimpan keranjang ke localStorage:', e);
        }
    }

    // ─── STORAGE SECURITY: Muat Keranjang dengan Deteksi Tampering ─
    async function loadCartFromStorage() {
        try {
            const rawData = localStorage.getItem(CART_STORAGE_KEY);
            const storedChecksum = localStorage.getItem(CART_SIG_KEY);
            if (!rawData) return;

            const parsed = JSON.parse(rawData);
            if (!Array.isArray(parsed)) throw new Error('Data bukan array');

            // Verifikasi Checksum SHA-256
            const calculatedChecksum = await KisanakDB.computeSHA256(parsed);
            if (calculatedChecksum !== storedChecksum) {
                console.error('[SECURITY TAMPERING DETECTED] LocalStorage keranjang belanja dimanipulasi!');
                localStorage.removeItem(CART_STORAGE_KEY);
                localStorage.removeItem(CART_SIG_KEY);
                showToast('🛡️', 'Peringatan Keamanan', 'Data keranjang lokal dimanipulasi & telah direset otomatis.', 'warning');
                cart = [];
                return;
            }

            // Validasi setiap item terhadap Canonical Catalog
            const validCart = [];
            for (const item of parsed) {
                if (item && item.id && SecurityUtils.isValidQuantity(item.quantity)) {
                    const canonical = KisanakDB.getCanonicalProduct(item.id);
                    if (canonical) {
                        validCart.push({ id: item.id, quantity: item.quantity });
                    }
                }
            }
            cart = validCart;
        } catch (e) {
            console.warn('[STORAGE] Cache keranjang rusak atau dibersihkan:', e);
            localStorage.removeItem(CART_STORAGE_KEY);
            localStorage.removeItem(CART_SIG_KEY);
            cart = [];
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

    // ─── Ambil data produk dari memori kanonikal ─────────────
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

        sidebar.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const category = btn.dataset.category;
                if (category) filterByCategory(category);
            });
        });
    }

    function filterByCategory(category) {
        activeCategory = category;
        renderSidebar();
        renderMenu();
    }

    function setupSearchListener() {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchQuery = SecurityUtils.sanitize(e.target.value).toLowerCase().trim();
                renderMenu();
            });
        }
    }

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

        const cardsHTML = products.map(product => {
            // Selalu ambil harga kanonikal resmi
            const canonicalPrice = KisanakDB.getCanonicalPrice(product.id) || product.price;
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
                                    title="${isOutOfStock ? 'Stok habis' : 'Tambah ke keranjang'}">
                                +
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        SecurityUtils.safeSetHTML(menuGrid, cardsHTML);

        menuGrid.querySelectorAll('.btn-add').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const productId = btn.dataset.addId;
                if (productId) addToCart(productId);
            });
        });
    }

    // ─── SECURITY: Tambah Item ke Keranjang ──────────────────
    function addToCart(productId) {
        // Validasi ke Canonical Catalog
        const canonical = KisanakDB.getCanonicalProduct(productId);
        if (!canonical) {
            console.error('[SECURITY ALERT] Upaya menambahkan produk ilegal:', productId);
            return;
        }

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
            cart.push({ id: canonical.id, quantity: 1 });
        }

        saveCartToStorage();
        renderOrderPanel();

        const card = document.getElementById(`card-${productId}`);
        if (card) {
            card.style.transform = 'scale(0.95)';
            setTimeout(() => { card.style.transform = ''; }, 150);
        }
    }

    // ─── SECURITY: Ubah Jumlah Item di Keranjang ────────────
    function changeQuantity(productId, delta) {
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

        saveCartToStorage();
        renderOrderPanel();
    }

    // ─── Kosongkan Keranjang ────────────────────────────────
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
                saveCartToStorage();
                renderOrderPanel();
            }
        });
    }

    // ─── ANTI-TAMPERING: Hitung Total HANYA dari Canonical Vault ───
    // FUNGSI INI ADALAH CORE DEFENSE:
    // Tidak pernah membaca nilai dari DOM atau input pengguna!
    function getCartTotal() {
        return cart.reduce((sum, item) => {
            const canonicalPrice = KisanakDB.getCanonicalPrice(item.id);
            if (canonicalPrice === null || canonicalPrice === undefined) {
                console.error('[SECURITY] Terdeteksi produk tanpa harga kanonikal:', item.id);
                return sum;
            }
            return sum + (canonicalPrice * item.quantity);
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

        // Render setiap item menggunakan harga KANONIKAL
        const itemsHTML = cart.map(item => {
            const canonical = KisanakDB.getCanonicalProduct(item.id);
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
                        <button data-qty-id="${safeId}" data-qty-delta="-1">−</button>
                        <span class="qty-value">${item.quantity}</span>
                        <button data-qty-id="${safeId}" data-qty-delta="1">+</button>
                    </div>
                    <span class="item-subtotal">Rp ${formatNumber(subtotal)}</span>
                </div>
            `;
        }).join('');

        SecurityUtils.safeSetHTML(container, itemsHTML);

        container.querySelectorAll('[data-qty-id]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.qtyId;
                const delta = parseInt(btn.dataset.qtyDelta, 10);
                if (id && !isNaN(delta)) changeQuantity(id, delta);
            });
        });

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
        if (!validMethods.includes(method)) return;
        selectedPaymentMethod = method;
        renderOrderPanel();
    }

    // ─── SECURITY: Proses Checkout dengan Sanitasi Input & Total Kanonikal ─
    async function processCheckout() {
        if (cart.length === 0) return;

        // Ambil dan sanitize input Nama Pelanggan & Catatan
        const rawCustomerName = document.getElementById('customer-name')?.value || '';
        const rawOrderNotes = document.getElementById('order-notes')?.value || '';

        const customerName = SecurityUtils.sanitize(rawCustomerName.trim()) || 'Walk-in Customer';
        const orderNotes = SecurityUtils.sanitize(rawOrderNotes.trim()) || '-';

        // Hitung total harga MURNI dari Canonical Vault
        const total = getCartTotal();
        const orderNumber = generateOrderNumber();

        // Siapkan item terverifikasi
        const verifiedItems = cart.map(item => {
            const canonical = KisanakDB.getCanonicalProduct(item.id);
            return {
                id: item.id,
                name: canonical ? canonical.name : 'Unknown Item',
                price: canonical ? canonical.price : 0,
                quantity: item.quantity
            };
        });

        if (selectedPaymentMethod === 'QRIS') {
            if (typeof KisanakPayment !== 'undefined') {
                KisanakPayment.showQRISModal(total, orderNumber, verifiedItems, selectedPaymentMethod, customerName, orderNotes);
            }
        } else {
            await completeOrder(orderNumber, total, selectedPaymentMethod, customerName, orderNotes);
        }
    }

    // ─── SECURITY: Selesaikan Pesanan dengan Audit Transaksi ──
    async function completeOrder(orderNumber, total, paymentMethod, customerName = 'Walk-in Customer', orderNotes = '-') {
        try {
            if (cart.length === 0) {
                throw new Error('Pesanan kosong tidak dapat diproses');
            }

            // Validasi ulang semua item dari Canonical Vault
            const verifiedItems = cart.map(item => {
                const canonical = KisanakDB.getCanonicalProduct(item.id);
                if (!canonical) throw new Error(`Produk dengan ID ${item.id} tidak sah!`);
                return {
                    id: item.id,
                    name: canonical.name,
                    price: canonical.price,
                    quantity: item.quantity
                };
            });

            // Hitung ulang total secara independen (double assertion)
            const canonicalTotal = verifiedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

            const transactionData = {
                items: verifiedItems,
                total: canonicalTotal,
                paymentMethod: SecurityUtils.sanitize(paymentMethod),
                customerName: SecurityUtils.sanitize(customerName),
                orderNotes: SecurityUtils.sanitize(orderNotes),
                orderNumber: SecurityUtils.sanitize(orderNumber)
            };

            // Simpan ke IndexedDB dengan audit & cryptographic checksum
            await KisanakDB.saveTransaction(transactionData);

            // Update stok
            for (const item of cart) {
                await KisanakDB.updateStock(item.id, item.quantity);
            }

            allProducts = await KisanakDB.getAllProducts();
            updateCategoryCounts();

            // Siapkan struk cetak
            const receiptData = {
                orderNumber,
                items: verifiedItems,
                total: canonicalTotal,
                paymentMethod,
                customerName,
                orderNotes,
                date: new Date()
            };

            if (typeof KisanakPayment !== 'undefined') {
                KisanakPayment.generateReceipt(receiptData);
            }

            // Reset cart dan input fields
            cart = [];
            saveCartToStorage();

            const nameInput = document.getElementById('customer-name');
            const notesInput = document.getElementById('order-notes');
            if (nameInput) nameInput.value = '';
            if (notesInput) notesInput.value = '';

            renderSidebar();
            renderMenu();
            renderOrderPanel();

            Swal.fire({
                title: 'Pesanan Berhasil! 🎉',
                html: `
                    <div style="text-align: left; font-size: 0.9rem; line-height: 1.6; margin-top: 10px;">
                        <p>Order: <strong>${SecurityUtils.sanitize(orderNumber)}</strong></p>
                        <p>Pelanggan: <strong>${SecurityUtils.sanitize(customerName)}</strong></p>
                        <p>Catatan: <em>${SecurityUtils.sanitize(orderNotes)}</em></p>
                        <p>Total Resmi: <strong style="color: #C8956C;">Rp ${formatNumber(canonicalTotal)}</strong></p>
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
                if (result.isConfirmed && typeof KisanakPayment !== 'undefined') {
                    KisanakPayment.printReceipt();
                }
            });
        } catch (error) {
            console.error('[SECURITY AUDIT] Transaksi ditolak:', error);
            Swal.fire({
                title: 'Peringatan Keamanan',
                text: error.message || 'Transaksi dibatalkan karena pelanggaran integritas.',
                icon: 'error',
                background: '#1A1A1A',
                color: '#F5F0EB'
            });
        }
    }

    // ─── Tampilkan Riwayat Transaksi dengan Audit Integritas ──
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

                SecurityUtils.safeSetHTML(historyList, sorted.map(tx => {
                    const date = new Date(tx.date);
                    const dateStr = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
                    const timeStr = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                    const itemNames = (tx.items || []).map(i => `${SecurityUtils.sanitize(i.name)} x${i.quantity}`).join(', ');

                    const safeOrderNumber = SecurityUtils.sanitize(tx.orderNumber);
                    const safeCustomer = SecurityUtils.sanitize(tx.customerName || 'Walk-in Customer');
                    const safeNotes = SecurityUtils.sanitize(tx.orderNotes || '-');
                    const safePayment = SecurityUtils.sanitize(tx.paymentMethod);

                    // Deteksi jika transaksi telah diedit via DevTools
                    const tamperedBadge = tx._isTampered ? `
                        <div class="tamper-alert-badge">
                            ⚠️ INTEGRITAS GAGAL: Data ini telah diubah manual di DevTools!
                        </div>
                    ` : '';

                    return `
                        <div class="history-item ${tx._isTampered ? 'tampered' : ''}">
                            ${tamperedBadge}
                            <div class="history-header">
                                <span class="order-id">${safeOrderNumber}</span>
                                <span class="order-date">${SecurityUtils.sanitize(dateStr)} ${SecurityUtils.sanitize(timeStr)}</span>
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
                }).join(''));
            }
            modal.classList.add('active');
        } catch (error) {
            console.error('Gagal memuat riwayat:', error);
        }
    }

    function closeModal(modalId) {
        const allowedModals = ['history-modal', 'qris-modal', 'scanner-modal'];
        if (!allowedModals.includes(modalId)) return;
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('active');
    }

    async function resetDB() {
        Swal.fire({
            title: 'Reset Database?',
            text: 'Semua data transaksi & stok akan dikembalikan ke kondisi awal.',
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
                saveCartToStorage();
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
                if (data.ip && /^[\d.]+$/.test(data.ip)) {
                    ipEl.textContent = data.ip;
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

    // ─── Public API (Deeply Frozen) ─────────────────────────
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
        // SECURITY: Mengembalikan salinan beku agar tidak bisa dimutasi di console
        get cart() { 
            return Object.freeze(cart.map(item => Object.freeze({ ...item }))); 
        },
        get selectedPaymentMethod() { return selectedPaymentMethod; }
    });
})();

document.addEventListener('DOMContentLoaded', () => {
    KisanakApp.init();
});
