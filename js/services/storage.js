"use strict";

/**
 * ============================================================
 * storage.js — Storage Service dengan SHA-256 Anti-Tamper & Error Handling
 * ============================================================
 */

import { STORAGE_KEYS, CANONICAL_MAP } from '../config/constants.js';
import { computeSHA256 } from '../utils/crypto.js';
import { SecurityUtils } from '../utils/security.js';

// In-memory fallback jika LocalStorage diblokir atau private mode bermasalah
const memoryStorage = new Map();

function isLocalStorageAvailable() {
    try {
        const testKey = '__storage_test__';
        localStorage.setItem(testKey, '1');
        localStorage.removeItem(testKey);
        return true;
    } catch {
        return false;
    }
}

/**
 * Menyimpan data keranjang belanja ke LocalStorage dengan tanda tangan SHA-256
 * @param {Array<{ id: string, quantity: number }>} cart
 */
export async function saveCartState(cart) {
    try {
        const serialized = JSON.stringify(cart);
        const checksum = await computeSHA256(cart);

        if (isLocalStorageAvailable()) {
            localStorage.setItem(STORAGE_KEYS.CART_DATA, serialized);
            localStorage.setItem(STORAGE_KEYS.CART_CHECKSUM, checksum);
        } else {
            memoryStorage.set(STORAGE_KEYS.CART_DATA, serialized);
            memoryStorage.set(STORAGE_KEYS.CART_CHECKSUM, checksum);
        }
    } catch (error) {
        console.warn('[STORAGE] Gagal menyimpan data keranjang:', error);
    }
}

/**
 * Membaca data keranjang belanja dengan verifikasi tanda tangan SHA-256
 * @returns {Promise<{ cart: Array<{ id: string, quantity: number }>, wasTampered: boolean }>}
 */
export async function loadCartState() {
    try {
        let serialized = null;
        let storedChecksum = null;

        if (isLocalStorageAvailable()) {
            serialized = localStorage.getItem(STORAGE_KEYS.CART_DATA);
            storedChecksum = localStorage.getItem(STORAGE_KEYS.CART_CHECKSUM);
        } else {
            serialized = memoryStorage.get(STORAGE_KEYS.CART_DATA);
            storedChecksum = memoryStorage.get(STORAGE_KEYS.CART_CHECKSUM);
        }

        if (!serialized) {
            return { cart: [], wasTampered: false };
        }

        const parsed = JSON.parse(serialized);
        if (!Array.isArray(parsed)) {
            throw new Error('Format keranjang bukan array');
        }

        // Verifikasi checksum SHA-256 untuk mendeteksi edit manual di DevTools
        const calculatedChecksum = await computeSHA256(parsed);
        if (calculatedChecksum !== storedChecksum) {
            console.error('[SECURITY AUDIT] LocalStorage cart checksum mismatch! Resetting cart.');
            clearCartState();
            return { cart: [], wasTampered: true };
        }

        // Filter hanya item yang sah dan terdapat di Canonical Vault
        const sanitizedCart = [];
        for (const item of parsed) {
            if (item && item.id && SecurityUtils.isValidQuantity(item.quantity)) {
                if (CANONICAL_MAP.has(item.id)) {
                    sanitizedCart.push({
                        id: item.id,
                        quantity: item.quantity
                    });
                }
            }
        }

        return { cart: sanitizedCart, wasTampered: false };
    } catch (error) {
        console.warn('[STORAGE] Error saat membaca keranjang belanja:', error);
        clearCartState();
        return { cart: [], wasTampered: false };
    }
}

/**
 * Menghapus data keranjang dari storage
 */
export function clearCartState() {
    try {
        if (isLocalStorageAvailable()) {
            localStorage.removeItem(STORAGE_KEYS.CART_DATA);
            localStorage.removeItem(STORAGE_KEYS.CART_CHECKSUM);
        }
        memoryStorage.delete(STORAGE_KEYS.CART_DATA);
        memoryStorage.delete(STORAGE_KEYS.CART_CHECKSUM);
    } catch (error) {
        console.warn('[STORAGE] Gagal menghapus storage keranjang:', error);
    }
}
