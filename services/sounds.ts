
// Simple Web Audio API synth to avoid external assets dependencies
const playTone = (freq: number, type: 'sine' | 'square' | 'sawtooth', duration: number) => {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.value = freq;
    
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
};

export const sounds = {
    success: () => {
        playTone(800, 'sine', 0.1);
        setTimeout(() => playTone(1200, 'sine', 0.3), 100);
    },
    error: () => {
        playTone(300, 'sawtooth', 0.2);
        setTimeout(() => playTone(200, 'sawtooth', 0.3), 150);
    },
    click: () => {
        playTone(1200, 'sine', 0.05);
    },
    pop: () => {
        playTone(600, 'sine', 0.05);
    },
    listening: () => {
        playTone(400, 'sine', 0.1);
        setTimeout(() => playTone(600, 'sine', 0.2), 100);
    },
    scan: () => {
        // High tech scanning sound simulation
        let i = 0;
        const interval = setInterval(() => {
            playTone(200 + (i * 100), 'square', 0.05);
            i++;
            if(i > 5) clearInterval(interval);
        }, 50);
    }
};
