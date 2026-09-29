"use strict";

/**
 * ============================================================
 * security.js — Modul Sanitasi Input & Pencegahan XSS
 * ============================================================
 */

import { SECURITY_CONFIG } from '../config/constants.js';

export const SecurityUtils = Object.freeze({
    /**
     * Escape seluruh karakter HTML berisiko untuk mencegah serangan XSS
     * @param {string|any} str
     * @returns {string}
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
     * Menghapus seluruh tag HTML dari string
     * @param {string} str
     * @returns {string}
     */
    stripTags(str) {
        if (!str) return '';
        return String(str).replace(/<[^>]*>/g, '').trim();
    },

    /**
     * Memvalidasi bahwa URL resource aman dan tidak mengandung skema jahat
     * @param {string} url
     * @returns {string}
     */
    safeUrl(url) {
        if (!url) return '';
        const clean = String(url).trim();
        // Izinkan path lokal relatif (./ atau /), folder gambar, HTTPS, atau data URI image
        if (/^(https?:|\/|\.\/|gambar\/|data:image\/)/i.test(clean)) {
            return clean;
        }
        console.warn('[SECURITY] URL diblokir karena berpotensi berbahaya:', url);
        return './gambar/logo_kisanak.jpg';
    },

    /**
     * Validasi angka harga agar bernilai wajar dan positif
     * @param {number} value
     * @returns {boolean}
     */
    isValidPrice(value) {
        return typeof value === 'number' && 
               Number.isFinite(value) && 
               value > 0 && 
               value <= SECURITY_CONFIG.MAX_PRICE_THRESHOLD;
    },

    /**
     * Validasi kuantitas item agar integer positif
     * @param {number} value
     * @returns {boolean}
     */
    isValidQuantity(value) {
        return Number.isInteger(value) && 
               value > 0 && 
               value <= SECURITY_CONFIG.MAX_QUANTITY_PER_ITEM;
    },

    /**
     * Membuat text node murni di DOM (aman dari interpretasi HTML)
     * @param {string} text
     * @returns {Text}
     */
    createSafeTextNode(text) {
        return document.createTextNode(String(text));
    },

    /**
     * Mengisi innerHTML secara terkontrol setelah data dinamis di-sanitize
     * @param {HTMLElement} element
     * @param {string} html
     */
    safeSetHTML(element, html) {
        if (element && typeof html === 'string') {
            element.innerHTML = html;
        }
    }
});
