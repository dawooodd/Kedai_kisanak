/**
 * ============================================================
 * db.js — Modul Database (IndexedDB) untuk Kedai Kisanak POS
 * ============================================================
 * SECURITY HARDENED:
 * - Data harga bersumber HANYA dari database, bukan DOM
 * - Validasi integritas data sebelum simpan transaksi
 * - Checksum sederhana untuk deteksi tampering pada data stok
 * - Object.freeze() pada data produk agar tidak bisa dimutasi
 * ============================================================
 */

const KisanakDB = (() => {
    const DB_NAME = 'KedaiKisanakDB';
    const DB_VERSION = 1;
    let db = null;

    // ─── SECURITY: Secret key untuk checksum integritas ─────
    // Di production, ini sebaiknya di-obfuscate atau dihasilkan server-side
    const INTEGRITY_SALT = 'KS_2016_POS_SECURE';

    // ─── Data Seed Menu Kedai Kopi ───────────────────────────
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

    // ─── SECURITY: Checksum sederhana untuk integritas data ──
    // Menghasilkan hash dasar dari data untuk deteksi tampering
    function computeChecksum(data) {
        const str = JSON.stringify(data) + INTEGRITY_SALT;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }

    // ─── SECURITY: Validasi harga produk terhadap database ──
    // Selalu merujuk ke SEED_PRODUCTS sebagai sumber kebenaran
    function getCanonicalPrice(productId) {
        const seedProduct = SEED_PRODUCTS.find(p => p.id === productId);
        return seedProduct ? seedProduct.price : null;
    }

    // ─── SECURITY: Validasi item transaksi sebelum simpan ───
    // Memastikan harga pada cart cocok dengan harga di database
    async function validateCartPrices(cartItems) {
        const errors = [];
        for (const item of cartItems) {
            const dbProduct = await getProductById(item.id);
            if (!dbProduct) {
                errors.push(`Produk "${item.id}" tidak ditemukan di database`);
                continue;
            }
            // Bandingkan harga cart vs harga database
            if (item.price !== dbProduct.price) {
                errors.push(
                    `TAMPERING DETECTED: Harga ${item.name} di cart (${item.price}) ` +
                    `tidak cocok dengan database (${dbProduct.price})`
                );
            }
            // Validasi stok cukup
            if (item.quantity > dbProduct.stock) {
                errors.push(
                    `Stok ${item.name} tidak cukup: diminta ${item.quantity}, tersisa ${dbProduct.stock}`
                );
            }
            // Validasi quantity masuk akal (positif, integer, tidak berlebihan)
            if (!Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > 100) {
                errors.push(`Quantity "${item.name}" tidak valid: ${item.quantity}`);
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
                }
            };

            request.onsuccess = (event) => { db = event.target.result; resolve(db); };
            request.onerror = (event) => {
                console.error('Gagal membuka IndexedDB:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    // ─── Seed data produk ke IndexedDB (hanya jika kosong) ──
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
                    // Deep-clone dari frozen seed agar bisa disimpan ke IDB
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

    // ─── Ambil semua produk ──────────────────────────────────
    async function getAllProducts() {
        const database = await openDB();
        const tx = database.transaction('products', 'readonly');
        const store = tx.objectStore('products');
        const request = store.getAll();
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
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
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // ─── Ambil produk berdasarkan kategori ────────────────────
    async function getProductsByCategory(category) {
        const database = await openDB();
        const tx = database.transaction('products', 'readonly');
        const store = tx.objectStore('products');
        const index = store.index('category');
        const request = index.getAll(category);
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // ─── Update stok produk (kurangi setelah checkout) ───────
    async function updateStock(productId, quantitySold) {
        // SECURITY: Validasi parameter
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

    // ─── SECURITY: Simpan transaksi dengan validasi penuh ───
    async function saveTransaction(transactionData) {
        // 1. Validasi harga semua item terhadap database
        const validationErrors = await validateCartPrices(transactionData.items);
        if (validationErrors.length > 0) {
            console.error('SECURITY VIOLATION:', validationErrors);
            throw new Error('Integritas data gagal: ' + validationErrors.join('; '));
        }

        // 2. Hitung ulang total dari harga DATABASE (bukan dari client)
        let verifiedTotal = 0;
        for (const item of transactionData.items) {
            const dbProduct = await getProductById(item.id);
            verifiedTotal += dbProduct.price * item.quantity;
        }

        // 3. Bandingkan total client vs total terverifikasi
        if (verifiedTotal !== transactionData.total) {
            console.error(
                `PRICE TAMPERING DETECTED: Client total=${transactionData.total}, ` +
                `Verified total=${verifiedTotal}`
            );
            // Gunakan total terverifikasi, abaikan total dari client
            transactionData.total = verifiedTotal;
        }

        const database = await openDB();
        const tx = database.transaction('transactions', 'readwrite');
        const store = tx.objectStore('transactions');

        const record = {
            date: new Date().toISOString(),
            items: transactionData.items.map(item => ({
                id: item.id,
                name: SecurityUtils.sanitize(item.name),
                price: item.price,
                quantity: item.quantity
            })),
            total: verifiedTotal,
            paymentMethod: SecurityUtils.sanitize(transactionData.paymentMethod),
            customerName: SecurityUtils.sanitize(transactionData.customerName || 'Walk-in Customer'),
            orderNumber: SecurityUtils.sanitize(transactionData.orderNumber),
            checksum: computeChecksum({
                items: transactionData.items,
                total: verifiedTotal,
                orderNumber: transactionData.orderNumber
            })
        };

        const request = store.add(record);
        return new Promise((resolve, reject) => {
            request.onsuccess = () => { record.id = request.result; resolve(record); };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // ─── Ambil semua riwayat transaksi ───────────────────────
    async function getAllTransactions() {
        const database = await openDB();
        const tx = database.transaction('transactions', 'readonly');
        const store = tx.objectStore('transactions');
        const request = store.getAll();
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
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
            console.log('Database Kedai Kisanak siap');
            return true;
        } catch (error) {
            console.error('Gagal inisialisasi database:', error);
            return false;
        }
    }

    // ─── Public API (Object.freeze mencegah penambahan method) ─
    return Object.freeze({
        init,
        getAllProducts,
        getProductById,
        getProductsByCategory,
        updateStock,
        saveTransaction,
        getAllTransactions,
        resetDatabase,
        getCanonicalPrice,
        validateCartPrices
    });
})();
