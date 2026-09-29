"use strict";

/**
 * ============================================================
 * audio.js — Service Notifikasi Suara (Web Audio API)
 * ============================================================
 * Menghasilkan suara chime pembayaran secara sintesis tanpa perlu
 * ketergantungan file audio eksternal. Aman terhadap CORS & offline.
 */

let audioContext = null;

function getAudioContext() {
    try {
        if (!audioContext) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                audioContext = new AudioCtx();
            }
        }
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }
        return audioContext;
    } catch (e) {
        console.warn('[AUDIO] Web Audio Context tidak dapat diinisialisasi:', e);
        return null;
    }
}

function playTone(ctx, frequency, startDelay, duration) {
    try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = frequency;

        const startTime = ctx.currentTime + startDelay;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.25, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.005, startTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration);
    } catch (e) {
        console.warn('[AUDIO] Gagal memainkan tone audio:', e);
    }
}

/**
 * Memainkan alunan notifikasi pembayaran berhasil (tri-tone chime)
 */
export function playChimeSound() {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        // Tiga nada harmonis: C5 (523Hz), E5 (659Hz), G5 (784Hz)
        playTone(ctx, 523, 0.00, 0.15);
        playTone(ctx, 659, 0.12, 0.15);
        playTone(ctx, 784, 0.24, 0.30);
    } catch (e) {
        console.warn('[AUDIO] Notifikasi audio gagal diputar:', e);
    }
}
