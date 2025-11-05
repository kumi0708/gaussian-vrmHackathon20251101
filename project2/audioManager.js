// ============================================
// 🎧 AudioInputManager.js (低音・高音解析付き)
// ============================================
export class AudioInputManager {
  constructor() {
    this.audioContext = null;
    this.source = null;
    this.analyser = null;
    this.dataArray = null;
    this.freqArray = null;
    this.bufferLength = 0;
    this.isMic = false;
    this.isReady = false;
  }

  async initMic() {
    try {
      console.log("[AUDIO] Requesting microphone...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
    //   this.analyser.fftSize = 1024; // 周波数分解能アップ
      this.analyser.fftSize = 4096;  // ← 元は1024
      this.bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(this.bufferLength);
      this.freqArray = new Uint8Array(this.bufferLength);

      this.source.connect(this.analyser);
      this.isMic = true;
      this.isReady = true;
      console.log("[AUDIO] Microphone initialized");
    } catch (err) {
      console.error("[AUDIO] Microphone init failed:", err);
    }
  }

  async initMp3(url) {
    try {
      console.log("[AUDIO] Loading MP3:", url);
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

      const resumeContext = async () => {
        if (this.audioContext.state === "suspended") {
          await this.audioContext.resume();
          console.log("[AUDIO] AudioContext resumed");
        }
      };
      document.body.addEventListener("click", resumeContext, { once: true });

      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      this.source = this.audioContext.createBufferSource();
      this.source.buffer = audioBuffer;
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 1024;
      this.bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(this.bufferLength);
      this.freqArray = new Uint8Array(this.bufferLength);

      this.source.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);

      document.body.addEventListener(
        "click",
        () => {
          if (this.audioContext.state === "suspended") this.audioContext.resume();
          this.source.start(0);
          console.log("[AUDIO] MP3 playback started");
        },
        { once: true }
      );

      this.isMic = false;
      this.isReady = true;
      console.log("[AUDIO] MP3 loaded (waiting for click)");
    } catch (err) {
      console.error("[AUDIO] MP3 init failed:", err);
    }
  }

  // === 全体音量 ===
  getAudioLevel() {
    if (!this.analyser || !this.dataArray) return 0;
    this.analyser.getByteTimeDomainData(this.dataArray);

    let sum = 0;
    for (let i = 0; i < this.bufferLength; i++) {
      const val = (this.dataArray[i] - 128) / 128.0;
      sum += val * val;
    }
    const rms = Math.sqrt(sum / this.bufferLength);
    return rms;
  }

  // === 低音・中音・高音成分のレベル ===
    getFrequencyBands() {
        if (!this.analyser || !this.freqArray) return { bass: 0, mid: 0, high: 0 };

        this.analyser.getByteFrequencyData(this.freqArray);

        const nyquist = this.audioContext.sampleRate / 2;
        const step = nyquist / this.bufferLength;

        // 対数スケールを考慮した周波数範囲
        const bassRange = [40, 90];
        const midRange = [200, 2000];
        const highRange = [2000, 8000];

        let bassEnergy = 0, midEnergy = 0, highEnergy = 0;
        let totalEnergy = 0;

        for (let i = 0; i < this.bufferLength; i++) {
            const freq = i * step;
            const val = this.freqArray[i] / 255.0;
            const weighted = val * val; // エネルギーとして扱う

            totalEnergy += weighted;

            if (freq < bassRange[1]) bassEnergy += weighted * 1.5; // 低音をやや強調
            else if (freq < midRange[1]) midEnergy += weighted;
            else if (freq < highRange[1]) highEnergy += weighted * 0.8; // 高音やや抑えめ
        }

        // 正規化（比率）
        const normalize = (energy) =>
            totalEnergy > 0 ? Math.min(energy / totalEnergy * 3.0, 1.0) : 0.0;

        return {
            bass: normalize(bassEnergy),
            mid: normalize(midEnergy),
            high: normalize(highEnergy),
        };
    }
}
