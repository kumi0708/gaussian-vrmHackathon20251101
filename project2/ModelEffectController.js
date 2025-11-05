// ModelEffectController.js
import * as THREE from "three";
import { GVRM } from "gvrm";

export class ModelEffectController {
  constructor(scene, camera, renderer, uiElements) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.ui = uiElements;

    // === エフェクトモード一覧 ===
    this.effectModes = ["wave", "noise", "breath"];
    this.currentMode = 0;

    // === 各エフェクトのパラメータ ===
    this.params = {
      // Wave
      waveFreq: 15.0,
      waveSpeed: 6.0,
      amp: 3.0,
      // Noise
      noiseAmp: 2.0,
      noiseSpeed: 10.0,
      // Breath
      breathSpeed: 1.5,
      breathAmp: 0.4,
    };

    this.gvrm = null;
    this.gs = null;
    this.initialized = false;
    this._initMIDI();
  }

  async loadModel(modelPath = "../assets/sample5.gvrm", fbxPath = "../assets/Idle.fbx") {
    this.gvrm = await GVRM.load(modelPath, this.scene, this.camera, this.renderer);
    await this.gvrm.changeFBX(fbxPath);
    this.gs = this.gvrm.gs;
    this.initialized = true;
    console.log("✅ GVRM loaded:", modelPath);
  }

  _updateUI() {
    if (!this.ui) return;
    this.ui.mode.textContent = this.effectModes[this.currentMode];
    this.ui.freq.textContent = this.params.waveFreq.toFixed(2);
    this.ui.speed.textContent = this.params.waveSpeed.toFixed(2);
    this.ui.amp.textContent = this.params.amp.toFixed(2);
  }

  // === WebMIDI初期化 ===
  _initMIDI() {
    if (!("requestMIDIAccess" in navigator)) {
      console.warn("⚠️ Web MIDI not supported");
      return;
    }

    navigator.requestMIDIAccess().then((midi) => {
      for (const input of midi.inputs.values()) {
        const name = input.name.toLowerCase();
        if (name.includes("nanokontrol")) {
          console.log("🎛 Connected to nanoKONTROL2");
          input.onmidimessage = (e) => this._onNanoKONTROL(e);
        }
        if (name.includes("nanokey")) {
          console.log("🎹 Connected to nanoKEY2");
          input.onmidimessage = (e) => this._onNanoKEY(e);
        }
      }
    }).catch((err) => console.warn("MIDI access failed:", err));
  }

  // === nanoKONTROL2 入力 ===
  _onNanoKONTROL(e) {
    const [status, d1, d2] = e.data;
    const type = status & 0xf0;
    if (type !== 0xb0) return; // Control Change 以外は無視

    const cc = d1;
    const v = d2 / 127;
    const clamp = (x, min, max) => Math.max(min, Math.min(max, x));

    switch (this.effectModes[this.currentMode]) {
      case "wave":
        if (cc === 0) this.params.waveFreq = clamp(5 + v * 30, 0.1, 100);
        if (cc === 1) this.params.waveSpeed = clamp(v * 10, 0.05, 20);
        if (cc === 2) this.params.amp = clamp(v * 5, 0.1, 10);
        break;

      case "noise":
        if (cc === 0) this.params.noiseSpeed = clamp(v * 20, 0.1, 50);   // 速度
        if (cc === 1) this.params.noiseAmp = clamp(v * 3.0, 0.1, 5.0);   // 強度
        if (cc === 2) this.params.amp = clamp(v * 2.0, 0.1, 3.0);        // 共通アンプ
        break;

      case "breath":
        if (cc === 0) this.params.breathSpeed = clamp(v * 3.0, 0.05, 5.0); // 呼吸スピード
        if (cc === 1) this.params.breathAmp = clamp(v * 0.8, 0.05, 1.5);   // 拡縮の強さ
        if (cc === 2) this.params.amp = clamp(v * 2.0, 0.1, 3.0);
        break;
    }

    this._updateUI();
  }

  // === nanoKEY2 入力 ===
  _onNanoKEY(e) {
    const [status, note, velocity] = e.data;
    const pressed = (status & 0xf0) === 0x90 && velocity > 0;

    if (pressed) {
      if (note >= 60 && note <= 62) {
        this.currentMode = note - 60;
        console.log("🎚 Effect mode:", this.effectModes[this.currentMode]);
        this._updateUI();
      }
    }
  }

  // === 更新 ===
  update(time) {
    if (!this.initialized || !this.gs || !this.gs.splatMesh) return;

    const baseData = this.gs.splatMesh.splatDataTextures?.baseData;
    const cov = baseData?.covariances;
    const base0 = this.gs.covariances0;
    const centers0 = this.gs.centers0;
    if (!cov || !base0 || !centers0) return;

    const t = time * 0.001;
    const {
      waveFreq, waveSpeed, amp,
      noiseAmp, noiseSpeed,
      breathSpeed, breathAmp
    } = this.params;

    switch (this.effectModes[this.currentMode]) {
      // === Wave（縦波） ===
      case "wave":
        for (let i = 0; i < cov.length; i += 6) {
          const idx = (i / 6) * 3;
          const y = centers0[idx + 1];
          const wave = 1.0 + Math.sin(y * waveFreq + t * waveSpeed) * amp;
          cov[i + 0] = base0[i + 0] * wave;
          cov[i + 3] = base0[i + 3] * wave;
          cov[i + 5] = base0[i + 5] * wave;
        }
        break;

      // === Noise（ランダム震え） ===
      case "noise": {
        for (let i = 0; i < cov.length; i += 6) {
          const n = Math.sin(i * 0.2 + t * noiseSpeed) * noiseAmp;
          cov[i + 0] = base0[i + 0] * (1.0 + n * 0.5);
          cov[i + 3] = base0[i + 3] * (1.0 + n * 0.5);
          cov[i + 5] = base0[i + 5] * (1.0 + n * 0.5);
        }
        break;
      }

      // === Breath（呼吸） ===
      case "breath": {
        const breathe = 1.0 + Math.sin(t * breathSpeed * 2.0 * Math.PI) * breathAmp;
        for (let i = 0; i < cov.length; i += 6) {
          cov[i + 0] = base0[i + 0] * breathe;
          cov[i + 3] = base0[i + 3] * breathe;
          cov[i + 5] = base0[i + 5] * breathe;
        }
        break;
      }
    }

    this.gs.splatMesh.updateDataTexturesFromBaseData(0, this.gs.splatCount - 1);
    this.gvrm.update();
  }
}
