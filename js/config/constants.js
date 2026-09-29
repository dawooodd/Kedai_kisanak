"use strict";

/**
 * ============================================================
 * constants.js — Konfigurasi & Data Master Kedai Kisanak
 * ============================================================
 */

export const DB_CONFIG = Object.freeze({
    NAME: 'KedaiKisanakDB',
    VERSION: 1,
    STORES: {
        PRODUCTS: 'products',
        TRANSACTIONS: 'transactions'
    }
});

export const SECURITY_CONFIG = Object.freeze({
    INTEGRITY_SALT: 'KISANAK_SHA256_SALT_SECURE_2016',
    MAX_QUANTITY_PER_ITEM: 100,
    MAX_PRICE_THRESHOLD: 10000000, // 10 juta
    MAX_SEARCH_LENGTH: 100,
    MAX_NAME_LENGTH: 50,
    MAX_NOTES_LENGTH: 100
});

export const STORAGE_KEYS = Object.freeze({
    CART_DATA: 'KISANAK_CART_DATA_V2',
    CART_CHECKSUM: 'KISANAK_CART_CHECKSUM_V2'
});

export const CATEGORIES = Object.freeze([
    { name: 'Semua', icon: '☕', count: 0 },
    { name: 'Espresso Based', icon: '⚡', count: 0 },
    { name: 'Manual Brew', icon: '🫖', count: 0 },
    { name: 'Non-Coffee', icon: '🍵', count: 0 },
    { name: 'Pastry & Food', icon: '🥐', count: 0 }
]);

export const PAYMENT_METHODS = Object.freeze(['Tunai', 'QRIS', 'Kartu']);

export const RANDOM_CUSTOMER_NAMES = Object.freeze([
    'Ahmad Rizki', 'Siti Nurhaliza', 'Budi Santoso', 'Dewi Anggraeni',
    'Fajar Ramadhan', 'Rina Marlina', 'Dian Saputra', 'Maya Indah',
    'Eko Prasetyo', 'Lina Kusuma', 'Agus Hermawan', 'Putri Ayu',
    'Hendra Wijaya', 'Novia Sari', 'Bambang Gunawan', 'QRIS Customer'
]);

/**
 * Sumber Kebenaran Kanonikal Produk (Canonical Pricing Vault)
 * Seluruh path gambar menggunakan relative path (./gambar/...) untuk Live Server
 */
export const SEED_PRODUCTS = Object.freeze([
    // === ESPRESSO BASED ===
    Object.freeze({
        id: 'ESP001', name: 'Espresso', category: 'Espresso Based',
        price: 18000, stock: 50, image: './gambar/espresso.jpg',
        description: 'Single shot espresso dengan crema yang kaya'
    }),
    Object.freeze({
        id: 'ESP002', name: 'Americano', category: 'Espresso Based',
        price: 22000, stock: 50, image: './gambar/americano.jpg',
        description: 'Espresso dengan air panas, rasa yang bold dan bersih'
    }),
    Object.freeze({
        id: 'ESP003', name: 'Cafe Latte', category: 'Espresso Based',
        price: 28000, stock: 40, image: './gambar/cafe_latte.jpg',
        description: 'Espresso dengan steamed milk dan latte art'
    }),
    Object.freeze({
        id: 'ESP004', name: 'Cappuccino', category: 'Espresso Based',
        price: 28000, stock: 40, image: './gambar/cappuccino.jpg',
        description: 'Espresso, steamed milk, dan foam tebal yang lembut'
    }),
    Object.freeze({
        id: 'ESP005', name: 'Caramel Macchiato', category: 'Espresso Based',
        price: 32000, stock: 35, image: './gambar/caramel_macchiato.jpg',
        description: 'Vanilla, susu, espresso, dan drizzle karamel'
    }),

    // === MANUAL BREW ===
    Object.freeze({
        id: 'MBR001', name: 'V60', category: 'Manual Brew',
        price: 25000, stock: 30, image: './gambar/v60.jpg',
        description: 'Pour over V60, biji single origin pilihan'
    }),
    Object.freeze({
        id: 'MBR002', name: 'Japanese Iced Coffee', category: 'Manual Brew',
        price: 28000, stock: 30, image: './gambar/japanese_iced.jpg',
        description: 'V60 langsung diseduh di atas es, segar dan aromatik'
    }),
    Object.freeze({
        id: 'MBR003', name: 'Aeropress', category: 'Manual Brew',
        price: 25000, stock: 30, image: './gambar/aeropress.jpg',
        description: 'Full immersion brew, body tebal dan bersih'
    }),

    // === NON-COFFEE ===
    Object.freeze({
        id: 'NCF001', name: 'Matcha Latte', category: 'Non-Coffee',
        price: 30000, stock: 35, image: './gambar/matcha_latte.jpg',
        description: 'Matcha grade ceremonial dengan steamed milk'
    }),
    Object.freeze({
        id: 'NCF002', name: 'Red Velvet', category: 'Non-Coffee',
        price: 28000, stock: 35, image: './gambar/red_velvet.jpg',
        description: 'Red velvet cream yang manis dan lembut'
    }),
    Object.freeze({
        id: 'NCF003', name: 'Chocolate', category: 'Non-Coffee',
        price: 26000, stock: 40, image: './gambar/chocolate.jpg',
        description: 'Hot chocolate premium dengan whipped cream'
    }),
    Object.freeze({
        id: 'NCF004', name: 'Artisan Tea', category: 'Non-Coffee',
        price: 22000, stock: 30, image: './gambar/artisan_tea.jpg',
        description: 'Teh artisan pilihan, blooming tea flower'
    }),

    // === PASTRY & FOOD ===
    Object.freeze({
        id: 'PNF001', name: 'Butter Croissant', category: 'Pastry & Food',
        price: 25000, stock: 20, image: './gambar/butter_croissant.svg',
        description: 'Croissant mentega premium berlapis renyah'
    }),
    Object.freeze({
        id: 'PNF002', name: 'Almond Croissant', category: 'Pastry & Food',
        price: 30000, stock: 15, image: './gambar/almond_croissant.svg',
        description: 'Croissant isi frangipane dan taburan almond'
    }),
    Object.freeze({
        id: 'PNF003', name: 'NY Cheesecake', category: 'Pastry & Food',
        price: 35000, stock: 15, image: './gambar/cheesecake.svg',
        description: 'New York cheesecake creamy dengan berry compote'
    }),
    Object.freeze({
        id: 'PNF004', name: 'French Fries', category: 'Pastry & Food',
        price: 20000, stock: 25, image: './gambar/french_fries.svg',
        description: 'Kentang goreng renyah dengan saus pilihan'
    }),
    Object.freeze({
        id: 'PNF005', name: 'Mix Platter', category: 'Pastry & Food',
        price: 45000, stock: 15, image: './gambar/mix_platter.svg',
        description: 'Platter aneka snack: fries, nugget, onion ring'
    })
]);

export const CANONICAL_MAP = Object.freeze(
    new Map(SEED_PRODUCTS.map(product => [product.id, product]))
);
