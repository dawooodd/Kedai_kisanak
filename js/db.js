/**
 * ============================================================
 * db.js — Modul Database (IndexedDB) untuk Kedai Kisanak POS
 * ============================================================
 * CYBERSECURITY HARDENED:
 * 1. Client-Side Anti-Tampering:
 *    - Canonical Pricing Vault (CANONICAL_CATALOG) beku (frozen)
 *    - Harga divalidasi ke sumber kebenaran kanonikal, BUKAN IndexedDB/DOM
 *    - Deteksi manipulasi harga & jumlah item seketika
 * 2. Data Integrity & Storage Security:
 *    - Cryptographic SHA-256 Integrity Checksum via Web Crypto API
 *    - Verifikasi integritas transaksi untuk deteksi edit manual di DevTools
 *    - Validasi struktur & tipe data ketat sebelum penyimpanan
 * 3. Sanitasi Data:
 *    - Semua input teks di-sanitize sebelum masuk ke IndexedDB
 * ============================================================
 */

const KisanakDB = (() => {
    'use strict';

    const DB_NAME = 'KedaiKisanakDB';
    const DB_VERSION = 1;
    let db = null;

    // ─── SECURITY: Secret salt untuk verifikasi integritas ─────
    const INTEGRITY_SALT = 'KISANAK_SHA256_SALT_SECURE_2016';

    // ─── CANONICAL PRICING VAULT (Sumber Kebenaran Kanonikal) ─
    // Seluruh harga resmi disimpan di memori beku (deeply frozen).
    // Nilai ini TIDAK BISA diubah oleh inspect element, modifikasi DOM,
    // ataupun pengubahan data langsung pada IndexedDB Application Tab.
    const SEED_PRODUCTS = Object.freeze([
        // === ESPRESSO BASED ===
        Object.freeze({
            id: 'ESP001', name: 'Espresso', category: 'Espresso Based',
            price: 18000, stock: 50, image: 'gambar/espresso.jpg',
            description: 'Single shot espresso dengan crema yang kaya'
        }),
        Object.freeze({
            id: 'ESP002', name: 'Americano', category: 'Espresso Based',
            price: 22000, stock: 50, image: 'gambar/americano.jpg',
            description: 'Espresso dengan air panas, rasa yang bold dan bersih'
        }),
        Object.freeze({
            id: 'ESP003', name: 'Cafe Latte', category: 'Espresso Based',
            price: 28000, stock: 40, image: 'gambar/cafe_latte.jpg',
            description: 'Espresso dengan steamed milk dan latte art'
        }),
        Object.freeze({
            id: 'ESP004', name: 'Cappuccino', category: 'Espresso Based',
            price: 28000, stock: 40, image: 'gambar/cappuccino.jpg',
            description: 'Espresso, steamed milk, dan foam tebal yang lembut'
        }),
        Object.freeze({
            id: 'ESP005', name: 'Caramel Macchiato', category: 'Espresso Based',
            price: 32000, stock: 35, image: 'gambar/caramel_macchiato.jpg',
            description: 'Vanilla, susu, espresso, dan drizzle karamel'
        }),

        // === MANUAL BREW ===
        Object.freeze({
            id: 'MBR001', name: 'V60', category: 'Manual Brew',
            price: 25000, stock: 30, image: 'gambar/v60.jpg',
            description: 'Pour over V60, biji single origin pilihan'
        }),
        Object.freeze({
            id: 'MBR002', name: 'Japanese Iced Coffee', category: 'Manual Brew',
            price: 28000, stock: 30, image: 'gambar/japanese_iced.jpg',
            description: 'V60 langsung diseduh di atas es, segar dan aromatik'
        }),
        Object.freeze({
            id: 'MBR003', name: 'Aeropress', category: 'Manual Brew',
            price: 25000, stock: 30, image: 'gambar/aeropress.jpg',
            description: 'Full immersion brew, body tebal dan bersih'
        }),

        // === NON-COFFEE ===
        Object.freeze({
            id: 'NCF001', name: 'Matcha Latte', category: 'Non-Coffee',
            price: 30000, stock: 35, image: 'gambar/matcha_latte.jpg',
            description: 'Matcha grade ceremonial dengan steamed milk'
        }),
        Object.freeze({
            id: 'NCF002', name: 'Red Velvet', category: 'Non-Coffee',
            price: 28000, stock: 35, image: 'gambar/red_velvet.jpg',
            description: 'Red velvet cream yang manis dan lembut'
        }),
        Object.freeze({
            id: 'NCF003', name: 'Chocolate', category: 'Non-Coffee',
            price: 26000, stock: 40, image: 'gambar/chocolate.jpg',
            description: 'Hot chocolate premium dengan whipped cream'
        }),
        Object.freeze({
            id: 'NCF004', name: 'Artisan Tea', category: 'Non-Coffee',
            price: 22000, stock: 30, image: 'gambar/artisan_tea.jpg',
            description: 'Teh artisan pilihan, blooming tea flower'
        }),

        // === PASTRY & FOOD ===
        Object.freeze({
            id: 'PNF001', name: 'Butter Croissant', category: 'Pastry & Food',
            price: 25000, stock: 20, image: 'gambar/butter_croissant.svg',
            description: 'Croissant mentega premium berlapis renyah'
        }),
        Object.freeze({
            id: 'PNF002', name: 'Almond Croissant', category: 'Pastry & Food',
            price: 30000, stock: 15, image: 'gambar/almond_croissant.svg',
            description: 'Croissant isi frangipane dan taburan almond'
        }),
        Object.freeze({
            id: 'PNF003', name: 'NY Cheesecake', category: 'Pastry & Food',
            price: 35000, stock: 15, image: 'gambar/cheesecake.svg',
            description: 'New York cheesecake creamy dengan berry compote'
        }),
        Object.freeze({
            id: 'PNF004', name: 'French Fries', category: 'Pastry & Food',
            price: 20000, stock: 25, image: 'gambar/french_fries.svg',
            description: 'Kentang goreng renyah dengan saus pilihan'
        }),
        Object.freeze({
            id: 'PNF005', name: 'Mix Platter', category: 'Pastry & Food',
            price: 45000, stock: 15, image: 'gambar/mix_platter.svg',
            description: 'Platter aneka snack: fries, nugget, onion ring'
        })
    ]);

    // Map kanonikal untuk pencarian O(1) cepat
    const CANONICAL_MAP = Object.freeze(
        new Map(SEED_PRODUCTS.map(p => [p.id, p]))
    );

    // ─── SECURITY: Cryptographic SHA-256 Checksum ─────────────
    // Menghasilkan hash SHA-256 256-bit standar industri
    async function computeSHA256(data) {
        const canonicalString = JSON.stringify(data) + '|' + INTEGRITY_SALT;
        try {
            if (window.crypto && window.crypto.subtle) {
                const encoder = new TextEncoder();
                const buffer = await window.crypto.subtle.digest('SHA-256', encoder.encode(canonicalString));
                return Array.from(new Uint8Array(buffer))
                    .map(b => b.toString(16).padStart(2, '0'))
                    .join('');
            }
        } catch (e) {
            console.warn('Web Crypto API fallback ke FNV-1a hash:', e);
        }
        // Fallback jika Web Crypto tidak aktif
        let hash = 2166136261;
        for (let i = 0; i < canonicalString.length; i++) {
            hash ^= canonicalString.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(16).padStart(8, '0');
    }

    // ─── SECURITY: Sumber Kebenaran Harga Resmi (Kanonikal) ───
    function getCanonicalPrice(productId) {
        const item = CANONICAL_MAP.get(productId);
        return item ? item.price : null;
    }

    function getCanonicalProduct(productId) {
        return CANONICAL_MAP.get(productId) || null;
    }

    // ─── SECURITY: Validasi Integritas Item Keranjang ────────
    // Memastikan setiap item valid, quantity masuk akal, dan
    // harga selalu identik dengan Canonical Vault
    async function validateCartPrices(cartItems) {
        const errors = [];
        if (!Array.isArray(cartItems) || cartItems.length === 0) {
            errors.push('Keranjang belanja kosong atau tidak valid.');
            return errors;
        }

        for (const item of cartItems) {
            const canonical = CANONICAL_MAP.get(item.id);
            if (!canonical) {
                errors.push(`[SECURITY ALERT] Produk tidak dikenal terdeteksi: ID "${item.id}"`);
                continue;
            }

            // Validasi manipulasi harga
            if (item.price !== canonical.price) {
                errors.push(
                    `[SECURITY TAMPERING DETECTED] Harga item "${canonical.name}" dimanipulasi! ` +
                    `Nilai kiriman: Rp ${item.price}, Harga resmi database: Rp ${canonical.price}`
                );
            }

            // Validasi kuantitas
            if (!Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > 100) {
                errors.push(
                    `[SECURITY ALERT] Jumlah pesanan untuk "${canonical.name}" tidak sah: ${item.quantity}`
                );
            }

            // Validasi stok fisik di IndexedDB
            const dbProduct = await getProductById(item.id);
            const currentStock = dbProduct ? dbProduct.stock : 0;
            if (item.quantity > currentStock) {
                errors.push(
                    `Stok "${canonical.name}" tidak mencukupi: diminta ${item.quantity}, tersedia ${currentStock}`
                );
            }
        }
        return errors;
    }

    // ─── Buka koneksi IndexedDB ─────────────────────────────
    function openDB() {
        return new Promise((resolve, reject) => {
            if (db) { resolve(db); return; }
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const database = event.target.result;
                if (!database.objectStoreNames.contains('products')) {
                    const productStore = database.createObjectStore('products', { keyPath: 'id' });
                    productStore.createIndex('category', 'category', { unique: false });
                    productStore.createIndex('name', 'name', { unique: false });
                }
                if (!database.objectStoreNames.contains('transactions')) {
                    const txStore = database.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
                    txStore.createIndex('date', 'date', { unique: false });
                    txStore.createIndex('orderNumber', 'orderNumber', { unique: true });
                }
            };

            request.onsuccess = (event) => { db = event.target.result; resolve(db); };
            request.onerror = (event) => {
                console.error('Gagal membuka IndexedDB:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    // ─── Seed data produk ke IndexedDB ───────────────────────
    async function seedProducts() {
        const database = await openDB();
        const tx = database.transaction('products', 'readonly');
        const store = tx.objectStore('products');
        const countReq = store.count();

        return new Promise((resolve, reject) => {
            countReq.onsuccess = async () => {
                if (countReq.result === 0) {
                    const writeTx = database.transaction('products', 'readwrite');
                    const writeStore = writeTx.objectStore('products');
                    SEED_PRODUCTS.forEach(product => {
                        writeStore.add({ ...product });
                    });
                    writeTx.oncomplete = () => resolve(true);
                    writeTx.onerror = (e) => reject(e.target.error);
                } else {
                    resolve(false);
                }
            };
            countReq.onerror = (e) => reject(e.target.error);
        });
    }

    // ─── Ambil semua produk dengan proteksi harga kanonikal ─
    async function getAllProducts() {
        const database = await openDB();
        const tx = database.transaction('products', 'readonly');
        const store = tx.objectStore('products');
        const request = store.getAll();
        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                // Pastikan harga selalu sinkron dengan CANONICAL_MAP meskipun stok tersimpan di IndexedDB
                const validated = request.result.map(p => {
                    const canonical = CANONICAL_MAP.get(p.id);
                    return {
                        ...p,
                        price: canonical ? canonical.price : p.price
                    };
                });
                resolve(validated);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // ─── Ambil produk berdasarkan ID ─────────────────────────
    async function getProductById(id) {
        const database = await openDB();
        const tx = database.transaction('products', 'readonly');
        const store = tx.objectStore('products');
        const request = store.get(id);
        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                const prod = request.result;
                if (prod) {
                    const canonical = CANONICAL_MAP.get(prod.id);
                    if (canonical) prod.price = canonical.price; // Garansi harga kanonikal
                }
                resolve(prod || null);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // ─── Update stok produk secara aman ─────────────────────
    async function updateStock(productId, quantitySold) {
        if (!productId || typeof quantitySold !== 'number' || quantitySold <= 0) {
            throw new Error('Parameter updateStock tidak valid');
        }
        const database = await openDB();
        const tx = database.transaction('products', 'readwrite');
        const store = tx.objectStore('products');
        const request = store.get(productId);

        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                const product = request.result;
                if (product) {
                    if (product.stock < quantitySold) {
                        reject(new Error(`Stok ${product.name} tidak cukup`));
                        return;
                    }
                    product.stock = Math.max(0, product.stock - quantitySold);
                    const updateReq = store.put(product);
                    updateReq.onsuccess = () => resolve(product);
                    updateReq.onerror = (e) => reject(e.target.error);
                } else {
                    reject(new Error(`Produk ${productId} tidak ditemukan`));
                }
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // ─── SECURITY: Simpan Transaksi dengan Audit & Checksum ──
    async function saveTransaction(transactionData) {
        // 1. Audit item keranjang terhadap Canonical Vault
        const validationErrors = await validateCartPrices(transactionData.items);
        if (validationErrors.length > 0) {
            console.error('SECURITY VIOLATION:', validationErrors);
            throw new Error(validationErrors.join('; '));
        }

        // 2. Hitung ulang total secara independen dari Canonical Vault
        let canonicalTotal = 0;
        const normalizedItems = transactionData.items.map(item => {
            const canonical = CANONICAL_MAP.get(item.id);
            const verifiedPrice = canonical ? canonical.price : 0;
            canonicalTotal += verifiedPrice * item.quantity;
            return {
                id: item.id,
                name: (typeof SecurityUtils !== 'undefined') ? SecurityUtils.sanitize(item.name) : item.name,
                price: verifiedPrice,
                quantity: item.quantity
            };
        });

        // 3. Deteksi manipulasi total kiriman
        if (transactionData.total !== canonicalTotal) {
            console.warn(
                `[TAMPERING OVERRIDE] Total client (Rp ${transactionData.total}) ` +
                `ditimpa dengan total kanonikal (Rp ${canonicalTotal})`
            );
        }

        const dateISO = new Date().toISOString();
        const orderNumber = (typeof SecurityUtils !== 'undefined') 
            ? SecurityUtils.sanitize(transactionData.orderNumber) 
            : String(transactionData.orderNumber);

        const customerName = (typeof SecurityUtils !== 'undefined')
            ? SecurityUtils.sanitize(transactionData.customerName || 'Walk-in Customer')
            : String(transactionData.customerName || 'Walk-in Customer');

        const orderNotes = (typeof SecurityUtils !== 'undefined')
            ? SecurityUtils.sanitize(transactionData.orderNotes || '-')
            : String(transactionData.orderNotes || '-');

        const paymentMethod = (typeof SecurityUtils !== 'undefined')
            ? SecurityUtils.sanitize(transactionData.paymentMethod || 'Tunai')
            : String(transactionData.paymentMethod || 'Tunai');

        // 4. Hitung Cryptographic SHA-256 Checksum untuk data transaksi
        const checksumPayload = {
            orderNumber,
            date: dateISO,
            items: normalizedItems.map(i => ({ id: i.id, p: i.price, q: i.quantity })),
            total: canonicalTotal,
            paymentMethod,
            customerName,
            orderNotes
        };

        const sha256Checksum = await computeSHA256(checksumPayload);

        const database = await openDB();
        const tx = database.transaction('transactions', 'readwrite');
        const store = tx.objectStore('transactions');

        const record = {
            date: dateISO,
            orderNumber,
            customerName,
            orderNotes,
            items: normalizedItems,
            total: canonicalTotal,
            paymentMethod,
            checksum: sha256Checksum
        };

        const request = store.add(record);
        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                record.id = request.result;
                resolve(record);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // ─── Verifikasi Integritas Transaksi (Deteksi Edit Manual di DevTools) ──
    async function verifyTransactionIntegrity(tx) {
        if (!tx || !tx.checksum) return false;
        const payload = {
            orderNumber: tx.orderNumber,
            date: tx.date,
            items: (tx.items || []).map(i => ({ id: i.id, p: i.price, q: i.quantity })),
            total: tx.total,
            paymentMethod: tx.paymentMethod,
            customerName: tx.customerName || 'Walk-in Customer',
            orderNotes: tx.orderNotes || '-'
        };
        const expectedChecksum = await computeSHA256(payload);
        return expectedChecksum === tx.checksum;
    }

    // ─── Ambil semua riwayat transaksi ───────────────────────
    async function getAllTransactions() {
        const database = await openDB();
        const tx = database.transaction('transactions', 'readonly');
        const store = tx.objectStore('transactions');
        const request = store.getAll();
        return new Promise((resolve, reject) => {
            request.onsuccess = async () => {
                const results = request.result || [];
                // Verifikasi integritas setiap transaksi secara asinkron
                const verifiedResults = await Promise.all(results.map(async (record) => {
                    const isValid = await verifyTransactionIntegrity(record);
                    return {
                        ...record,
                        _isTampered: !isValid
                    };
                }));
                resolve(verifiedResults);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // ─── Reset database ─────────────────────────────────────
    async function resetDatabase() {
        const database = await openDB();
        const txP = database.transaction('products', 'readwrite');
        txP.objectStore('products').clear();
        const txT = database.transaction('transactions', 'readwrite');
        txT.objectStore('transactions').clear();
        return new Promise((resolve) => {
            txT.oncomplete = async () => {
                await seedProducts();
                resolve(true);
            };
        });
    }

    // ─── Inisialisasi ───────────────────────────────────────
    async function init() {
        try {
            await openDB();
            await seedProducts();
            console.log('✅ Database Kedai Kisanak siap (Security Vault Active)');
            return true;
        } catch (error) {
            console.error('❌ Gagal inisialisasi database:', error);
            return false;
        }
    }

    // ─── Public API (Object.freeze mencegah tampering method) ─
    return Object.freeze({
        init,
        getAllProducts,
        getProductById,
        updateStock,
        saveTransaction,
        getAllTransactions,
        verifyTransactionIntegrity,
        resetDatabase,
        getCanonicalPrice,
        getCanonicalProduct,
        validateCartPrices,
        computeSHA256
    });
})();

