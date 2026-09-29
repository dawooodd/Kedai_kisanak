"use strict";

/**
 * ============================================================
 * crypto.js — Utilitas Kriptografi & Hashing Integritas SHA-256
 * ============================================================
 */

import { SECURITY_CONFIG } from '../config/constants.js';

/**
 * Menghasilkan hash SHA-256 (256-bit hexadecimal) dari data
 * Menggunakan Web Crypto API native browser dengan fallback FNV-1a
 * @param {any} data
 * @returns {Promise<string>}
 */
export async function computeSHA256(data) {
    const canonicalString = JSON.stringify(data) + '|' + SECURITY_CONFIG.INTEGRITY_SALT;
    try {
        if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
            const encoder = new TextEncoder();
            const buffer = await window.crypto.subtle.digest('SHA-256', encoder.encode(canonicalString));
            return Array.from(new Uint8Array(buffer))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
        }
    } catch (e) {
        console.warn('[CRYPTO] Web Crypto API tidak tersedia, beralih ke fallback hash:', e);
    }

    // Fallback: 32-bit FNV-1a Hash
    let hash = 2166136261;
    for (let i = 0; i < canonicalString.length; i++) {
        hash ^= canonicalString.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}
