"use strict";

/**
 * ============================================================
 * db.js — Database Service (IndexedDB + In-Memory Fallback)
 * ============================================================
 * Mengelola persistensi data katalog dan transaksi dengan
 * jaminan validasi harga kanonikal & integritas SHA-256.
 */

import { DB_CONFIG, SEED_PRODUCTS, CANONICAL_MAP } from '../config/constants.js';
import { computeSHA256 } from '../utils/crypto.js';
import { SecurityUtils } from '../utils/security.js';

let dbInstance = null;
let useMemoryFallback = false;

// Fallback in-memory stores jika IndexedDB gagal diakses (misal private browsing ketat)
const memoryDb = {
    products: new Map(SEED_PRODUCTS.map(p => [p.id, { ...p }])),
    transactions: []
};

/**
 * Inisialisasi koneksi IndexedDB dengan penanganan error komprehensif
 * @returns {Promise<IDBDatabase|null>}
 */
export function openDatabase() {
    return new Promise((resolve) => {
        if (dbInstance) {
            resolve(dbInstance);
            return;
        }

        if (typeof indexedDB === 'undefined') {
            console.warn('[DB] IndexedDB tidak didukung pada browser ini. Menggunakan memory fallback.');
            useMemoryFallback = true;
            resolve(null);
            return;
        }

        try {
            const request = indexedDB.open(DB_CONFIG.NAME, DB_CONFIG.VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(DB_CONFIG.STORES.PRODUCTS)) {
                    const productStore = db.createObjectStore(DB_CONFIG.STORES.PRODUCTS, { keyPath: 'id' });
                    productStore.createIndex('category', 'category', { unique: false });
                    productStore.createIndex('name', 'name', { unique: false });
                }
                if (!db.objectStoreNames.contains(DB_CONFIG.STORES.TRANSACTIONS)) {
                    const txStore = db.createObjectStore(DB_CONFIG.STORES.TRANSACTIONS, { keyPath: 'id', autoIncrement: true });
                    txStore.createIndex('date', 'date', { unique: false });
                    txStore.createIndex('orderNumber', 'orderNumber', { unique: true });
                }
            };

            request.onsuccess = (event) => {
                dbInstance = event.target.result;
                useMemoryFallback = false;
                resolve(dbInstance);
            };

            request.onerror = (event) => {
                console.warn('[DB] Gagal membuka IndexedDB. Mengaktifkan memory fallback:', event.target.error);
                useMemoryFallback = true;
                resolve(null);
            };
        } catch (e) {
            console.warn('[DB] Pengecualian saat inisialisasi IndexedDB:', e);
            useMemoryFallback = true;
            resolve(null);
        }
    });
}

/**
 * Seed data produk awal jika belum tersedia
 */
export async function seedProducts() {
    if (useMemoryFallback) return;

    try {
        const db = await openDatabase();
        if (!db) return;

        const count = await new Promise((resolve, reject) => {
            const tx = db.transaction(DB_CONFIG.STORES.PRODUCTS, 'readonly');
            const store = tx.objectStore(DB_CONFIG.STORES.PRODUCTS);
            const req = store.count();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });

        if (count === 0) {
            const writeTx = db.transaction(DB_CONFIG.STORES.PRODUCTS, 'readwrite');
            const writeStore = writeTx.objectStore(DB_CONFIG.STORES.PRODUCTS);
            SEED_PRODUCTS.forEach(item => {
                writeStore.add({ ...item });
            });
            await new Promise((resolve, reject) => {
                writeTx.oncomplete = () => resolve();
                writeTx.onerror = () => reject(writeTx.error);
            });
        }
    } catch (error) {
        console.warn('[DB] Gagal melakukan seeding produk:', error);
    }
}

/**
 * Mendapatkan harga kanonikal resmi dari memori beku
 * @param {string} productId
 * @returns {number|null}
 */
export function getCanonicalPrice(productId) {
    const item = CANONICAL_MAP.get(productId);
    return item ? item.price : null;
}

/**
 * Mendapatkan metadata produk resmi
 * @param {string} productId
 * @returns {object|null}
 */
export function getCanonicalProduct(productId) {
    return CANONICAL_MAP.get(productId) || null;
}

/**
 * Mengambil semua produk dengan jaminan harga kanonikal
 * @returns {Promise<Array<object>>}
 */
export async function getAllProducts() {
    if (useMemoryFallback) {
        return Array.from(memoryDb.products.values()).map(p => {
            const canonical = CANONICAL_MAP.get(p.id);
            return { ...p, price: canonical ? canonical.price : p.price };
        });
    }

    try {
        const db = await openDatabase();
        if (!db) return Array.from(memoryDb.products.values());

        const rawList = await new Promise((resolve, reject) => {
            const tx = db.transaction(DB_CONFIG.STORES.PRODUCTS, 'readonly');
            const store = tx.objectStore(DB_CONFIG.STORES.PRODUCTS);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });

        return rawList.map(prod => {
            const canonical = CANONICAL_MAP.get(prod.id);
            return {
                ...prod,
                price: canonical ? canonical.price : prod.price
            };
        });
    } catch (e) {
        console.warn('[DB] Gagal memuat produk dari IndexedDB, fallback ke memori:', e);
        return Array.from(memoryDb.products.values());
    }
}

/**
 * Mengurangi stok produk setelah transaksi berhasil
 * @param {string} productId
 * @param {number} quantity
 */
export async function updateStock(productId, quantity) {
    if (useMemoryFallback) {
        const prod = memoryDb.products.get(productId);
        if (prod) {
            prod.stock = Math.max(0, prod.stock - quantity);
        }
        return;
    }

    try {
        const db = await openDatabase();
        if (!db) return;

        const tx = db.transaction(DB_CONFIG.STORES.PRODUCTS, 'readwrite');
        const store = tx.objectStore(DB_CONFIG.STORES.PRODUCTS);
        const req = store.get(productId);

        await new Promise((resolve, reject) => {
            req.onsuccess = () => {
                const prod = req.result;
                if (prod) {
                    prod.stock = Math.max(0, prod.stock - quantity);
                    const updateReq = store.put(prod);
                    updateReq.onsuccess = () => resolve();
                    updateReq.onerror = () => reject(updateReq.error);
                } else {
                    resolve();
                }
            };
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        console.warn(`[DB] Gagal mengupdate stok produk ${productId}:`, e);
    }
}

/**
 * Menyimpan transaksi baru lengkap dengan audit SHA-256
 * @param {object} transactionData
 * @returns {Promise<object>}
 */
export async function saveTransaction(transactionData) {
    // 1. Hitung ulang total secara independen dari Canonical Vault
    let canonicalTotal = 0;
    const validatedItems = (transactionData.items || []).map(item => {
        const canonical = CANONICAL_MAP.get(item.id);
        if (!canonical) {
            throw new Error(`[SECURITY ALERT] Item ilegal terdeteksi: ${item.id}`);
        }
        canonicalTotal += canonical.price * item.quantity;
        return {
            id: item.id,
            name: SecurityUtils.sanitize(canonical.name),
            price: canonical.price,
            quantity: item.quantity
        };
    });

    const dateISO = new Date().toISOString();
    const orderNumber = SecurityUtils.sanitize(transactionData.orderNumber);
    const customerName = SecurityUtils.sanitize(transactionData.customerName || 'Walk-in Customer');
    const orderNotes = SecurityUtils.sanitize(transactionData.orderNotes || '-');
    const paymentMethod = SecurityUtils.sanitize(transactionData.paymentMethod || 'Tunai');

    // 2. Hitung tanda tangan SHA-256
    const checksumPayload = {
        orderNumber,
        date: dateISO,
        items: validatedItems.map(i => ({ id: i.id, p: i.price, q: i.quantity })),
        total: canonicalTotal,
        paymentMethod,
        customerName,
        orderNotes
    };
    const sha256Checksum = await computeSHA256(checksumPayload);

    const record = {
        date: dateISO,
        orderNumber,
        customerName,
        orderNotes,
        items: validatedItems,
        total: canonicalTotal,
        paymentMethod,
        checksum: sha256Checksum
    };

    if (useMemoryFallback) {
        record.id = memoryDb.transactions.length + 1;
        memoryDb.transactions.push(record);
        return record;
    }

    try {
        const db = await openDatabase();
        if (!db) {
            memoryDb.transactions.push(record);
            return record;
        }

        const tx = db.transaction(DB_CONFIG.STORES.TRANSACTIONS, 'readwrite');
        const store = tx.objectStore(DB_CONFIG.STORES.TRANSACTIONS);
        const req = store.add(record);

        return await new Promise((resolve, reject) => {
            req.onsuccess = () => {
                record.id = req.result;
                resolve(record);
            };
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        console.warn('[DB] Fallback simpan transaksi ke memori:', e);
        record.id = Date.now();
        memoryDb.transactions.push(record);
        return record;
    }
}

/**
 * Memverifikasi keabsahan checksum transaksi
 * @param {object} tx
 * @returns {Promise<boolean>}
 */
export async function verifyTransactionIntegrity(tx) {
    if (!tx || !tx.checksum) return false;
    try {
        const payload = {
            orderNumber: tx.orderNumber,
            date: tx.date,
            items: (tx.items || []).map(i => ({ id: i.id, p: i.price, q: i.quantity })),
            total: tx.total,
            paymentMethod: tx.paymentMethod,
            customerName: tx.customerName || 'Walk-in Customer',
            orderNotes: tx.orderNotes || '-'
        };
        const expected = await computeSHA256(payload);
        return expected === tx.checksum;
    } catch {
        return false;
    }
}

/**
 * Mengambil semua transaksi dan memeriksa indikator manipulasi
 * @returns {Promise<Array<object>>}
 */
export async function getAllTransactions() {
    let rawTransactions = [];

    if (useMemoryFallback) {
        rawTransactions = [...memoryDb.transactions];
    } else {
        try {
            const db = await openDatabase();
            if (!db) {
                rawTransactions = [...memoryDb.transactions];
            } else {
                rawTransactions = await new Promise((resolve, reject) => {
                    const tx = db.transaction(DB_CONFIG.STORES.TRANSACTIONS, 'readonly');
                    const store = tx.objectStore(DB_CONFIG.STORES.TRANSACTIONS);
                    const req = store.getAll();
                    req.onsuccess = () => resolve(req.result || []);
                    req.onerror = () => reject(req.error);
                });
            }
        } catch (e) {
            console.warn('[DB] Gagal membaca transaksi dari IndexedDB:', e);
            rawTransactions = [...memoryDb.transactions];
        }
    }

    return await Promise.all(rawTransactions.map(async (record) => {
        const isValid = await verifyTransactionIntegrity(record);
        return {
            ...record,
            _isTampered: !isValid
        };
    }));
}

/**
 * Mereset database kembali ke kondisi awal
 */
export async function resetDatabase() {
    memoryDb.products = new Map(SEED_PRODUCTS.map(p => [p.id, { ...p }]));
    memoryDb.transactions = [];

    if (useMemoryFallback) return true;

    try {
        const db = await openDatabase();
        if (!db) return true;

        const tx = db.transaction([DB_CONFIG.STORES.PRODUCTS, DB_CONFIG.STORES.TRANSACTIONS], 'readwrite');
        tx.objectStore(DB_CONFIG.STORES.PRODUCTS).clear();
        tx.objectStore(DB_CONFIG.STORES.TRANSACTIONS).clear();

        await new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });

        await seedProducts();
        return true;
    } catch (e) {
        console.warn('[DB] Error saat mereset database:', e);
        return false;
    }
}

/**
 * Status apakah database menggunakan memory fallback
 */
export function isUsingMemoryFallback() {
    return useMemoryFallback;
}
