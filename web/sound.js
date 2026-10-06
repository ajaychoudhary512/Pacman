// sound.js - Pure Web Audio API Sound Synthesizer for Pacman (No external audio files needed)
class SoundManager {
    constructor() {
        this.ctx = null;
        this.muted = false;
        this.wakaAlt = false;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        return this.muted;
    }

    playWaka() {
        if (this.muted) return;
        this.init();
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const now = this.ctx.currentTime;
            
            this.wakaAlt = !this.wakaAlt;
            const startFreq = this.wakaAlt ? 400 : 260;
            const endFreq = this.wakaAlt ? 650 : 480;

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(startFreq, now);
            osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.08);

            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.09);
        } catch (e) {}
    }

    playPowerPellet() {
        if (this.muted) return;
        this.init();
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const now = this.ctx.currentTime;

            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(950, now + 0.15);

            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.18);
        } catch (e) {}
    }

    playEatGhost() {
        if (this.muted) return;
        this.init();
        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'square';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.linearRampToValueAtTime(800, now + 0.25);

            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.3);
        } catch (e) {}
    }

    playDeath() {
        if (this.muted) return;
        this.init();
        try {
            const now = this.ctx.currentTime;
            const freqs = [500, 470, 440, 410, 380, 350, 320, 290, 260, 230, 200, 160];
            freqs.forEach((freq, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                const t = now + idx * 0.07;

                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(freq, t);

                gain.gain.setValueAtTime(0.18, t);
                gain.gain.exponentialRampToValueAtTime(0.01, t + 0.06);

                osc.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start(t);
                osc.stop(t + 0.07);
            });
        } catch (e) {}
    }

    playStart() {
        if (this.muted) return;
        this.init();
        try {
            const notes = [
                { f: 493.88, d: 0.12 }, // B4
                { f: 987.77, d: 0.12 }, // B5
                { f: 739.99, d: 0.12 }, // F#5
                { f: 622.25, d: 0.12 }, // D#5
                { f: 987.77, d: 0.12 }, // B5
                { f: 739.99, d: 0.18 }, // F#5
                { f: 622.25, d: 0.25 }  // D#5
            ];
            let time = this.ctx.currentTime;
            notes.forEach(note => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(note.f, time);
                gain.gain.setValueAtTime(0.18, time);
                gain.gain.exponentialRampToValueAtTime(0.01, time + note.d);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(time);
                osc.stop(time + note.d);
                time += note.d;
            });
        } catch (e) {}
    }

    playVictory() {
        if (this.muted) return;
        this.init();
        try {
            const notes = [523, 659, 783, 1046];
            let time = this.ctx.currentTime;
            notes.forEach(f => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(f, time);
                gain.gain.setValueAtTime(0.2, time);
                gain.gain.exponentialRampToValueAtTime(0.01, time + 0.14);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(time);
                osc.stop(time + 0.15);
                time += 0.12;
            });
        } catch (e) {}
    }
}

window.soundManager = new SoundManager();
