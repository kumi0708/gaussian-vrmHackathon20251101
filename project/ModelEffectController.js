// ModelEffectController.js
import * as THREE from "three";
import { GVRM } from "gvrm";
import { keyboardManager } from "./KeyboardManager.js";

export class ModelEffectController {
  constructor(scene, camera, renderer, uiElements) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.ui = uiElements;

    // 4 modes
    this.effectModes = ["wave", "noise", "breath", "bubble"];
    this.currentMode = 0;

    this.bassCooldown = 0;
    this.level = 0;

    // カメラ回転用のパラメータ
    this.cameraRotation = {
      x: 0,
      y: 0
    };
    
    // カメラ移動用のパラメータ
    this.cameraOffset = {
      x: 0,
      y: 0,
      z: 0
    };
    
    // カメラの初期位置を保存
    this.initialCameraPosition = this.camera.position.clone();
    this.cameraDistance = this.initialCameraPosition.length();

    // アニメーションスピード制御
    this.animationSpeed = 1.0; // デフォルトは1.0（通常速度）

    // Params (MIDIで可変)
    this.params = {
      // wave
      waveFreq: 15.0,
      waveSpeed: 6.0,
      amp: 3.0,
      // noise
      noiseAmp: 2.0,
      noiseSpeed: 10.0,
      // breath
      breathSpeed: 1.5,
      breathAmp: 0.4,
      // bubble (個別のベース振る舞いに使う振幅)
      bubbleWaveAmp: 1.0,
      bubbleNoiseAmp: 1.0,
      bubbleBreathAmp: 0.5,
    };

    this.gvrm = null;
    this.gs = null;
    this.initialized = false;

    // キーボード操作用の状態
    this.keyPressed = {};
    this.keyboardStep = 0.1; // キーボード操作時のステップサイズ

    // this._initMIDI();
    this._updateUI();
    this._initKeyboard();
  }

  async loadModel(modelPath = "../assets/sample5.gvrm", fbxPath = "../assets/Idle.fbx") {
    this.gvrm = await GVRM.load(modelPath, this.scene, this.camera, this.renderer);
    await this.gvrm.changeFBX(fbxPath);
    this.gs = this.gvrm.gs;
    this.initialized = true;
    console.log("GVRM loaded:", modelPath);
  }

  attachGvrm(gvrm) {
    this.gvrm = gvrm;
    this.gs = gvrm.gs;
    this.initialized = true;
  }

  _updateUI() {
    if (!this.ui) return;
    if (this.ui.mode) this.ui.mode.textContent = this.effectModes[this.currentMode];
    if (this.ui.freq) this.ui.freq.textContent = this.params.waveFreq.toFixed(2);
    if (this.ui.speed) this.ui.speed.textContent = this.params.waveSpeed.toFixed(2);
    if (this.ui.amp) this.ui.amp.textContent = this.params.amp.toFixed(2);
  }

  // _initMIDI() {
  //   if (!("requestMIDIAccess" in navigator)) {
  //     console.warn("Web MIDI not supported");
  //     return;
  //   }
  //   navigator.requestMIDIAccess()
  //     .then((midi) => {
  //       for (const input of midi.inputs.values()) {
  //         const name = (input.name || "").toLowerCase();
  //         if (name.includes("nanokontrol")) {
  //           console.log("Connected: nanoKONTROL2");
  //           input.onmidimessage = (e) => this._onNanoKONTROL(e);
  //         }
  //         if (name.includes("nanokey")) {
  //           console.log("Connected: nanoKEY2");
  //           input.onmidimessage = (e) => this._onNanoKEY(e);
  //         }
  //       }
  //     })
  //     .catch((err) => console.warn("MIDI access failed:", err));
  // }

  // 🎚 nanoKONTROL2 の入力を処理
  handleNanoKONTROL(e) {
    const [status, d1, d2] = e.data;
    const type = status & 0xf0;
    if (type !== 0xb0) return;

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
        if (cc === 0) this.params.noiseSpeed = clamp(v * 20, 0.1, 50);
        if (cc === 1) this.params.noiseAmp = clamp(v * 3.0, 0.1, 5.0);
        if (cc === 2) this.params.amp = clamp(v * 2.0, 0.1, 3.0);
        break;

      case "breath":
        if (cc === 0) this.params.breathSpeed = clamp(v * 3.0, 0.05, 5.0);
        if (cc === 1) this.params.breathAmp = clamp(v * 0.8, 0.05, 1.5);
        if (cc === 2) this.params.amp = clamp(v * 2.0, 0.1, 3.0);
        break;

      case "bubble":
        if (cc === 0) this.params.amp = clamp(v * 10, 0.1, 20);
        break;
    }
    
    // カメラ移動制御 (CC 19, 20, 21)
    if (cc === 19) {
      // CC 19: X軸移動 -2.0〜2.0
      this.cameraOffset.x = (v - 0.5) * 4.0;
    }
    if (cc === 20) {
      // CC 20: Y軸移動 -1.0〜2.0
      this.cameraOffset.y = (v - 0.3) * 3.0;
    }
    if (cc === 21) {
      // CC 21: Z軸移動 -2.0〜2.0
      this.cameraOffset.z = (v - 0.5) * 4.0;
    }
    
    // カメラ回転制御 (CC 22, 23)
    if (cc === 22) {
      // CC 22: Y軸回転 (水平回転) -180度〜180度
      this.cameraRotation.y = (v - 0.5) * 2 * Math.PI;
    }
    if (cc === 23) {
      // CC 23: X軸回転 (垂直回転) -60度〜60度
      this.cameraRotation.x = (v - 0.5) * Math.PI * 0.67; // 少し制限
    }

    // アニメーションスピード制御 (CC 7)
    if (cc === 7) {
      // CC 7: アニメーションスピード 0.8〜3.0倍速
      this.animationSpeed = clamp(0.8 + v * 2.2, 0.8, 3.0);
      console.log(`🎬 Animation speed: ${this.animationSpeed.toFixed(2)}x`);
    }

    this._updateUI();
  }

  // 🎹 nanoKEY2 の入力を処理
  handleNanoKEY(e) {
    const [status, note, velocity] = e.data;
    const pressed = (status & 0xf0) === 0x90 && velocity > 0;
    if (!pressed) return;

    if (note >= 48 && note <= 51) {
      this.currentMode = note - 48;
      console.log("🎚 Effect mode:", this.effectModes[this.currentMode]);
      this._updateUI();
    }
  }

  // キーボード初期化
  _initKeyboard() {
    keyboardManager.init();
    keyboardManager.registerHandler('modelEffect', (keyCode, pressed, event) => {
      this._handleKeyPress(keyCode, pressed, event);
    });
  }

  // キーボード入力処理
  _handleKeyPress(keyCode, pressed, event) {
    if (!pressed) return;

    const clamp = (x, min, max) => Math.max(min, Math.min(max, x));

    switch (keyCode) {
      // エフェクトモード切り替え (Q-T キー)
      case 'KeyQ':
        this.currentMode = 0;
        console.log("🎚 Effect mode:", this.effectModes[this.currentMode]);
        this._updateUI();
        break;
      case 'KeyW':
        this.currentMode = 1;
        console.log("🎚 Effect mode:", this.effectModes[this.currentMode]);
        this._updateUI();
        break;
      case 'KeyE':
        this.currentMode = 2;
        console.log("🎚 Effect mode:", this.effectModes[this.currentMode]);
        this._updateUI();
        break;
      case 'KeyT':
        this.currentMode = 3;
        console.log("🎚 Effect mode:", this.effectModes[this.currentMode]);
        this._updateUI();
        break;

      // カメラ移動 (WASD + I/O) - Ctrlキーと組み合わせ
      case 'KeyA': // X軸 -
        if (event.ctrlKey) {
          this.cameraOffset.x = clamp(this.cameraOffset.x - this.keyboardStep, -2.0, 2.0);
        }
        break;
      case 'KeyD': // X軸 +
        if (event.ctrlKey) {
          this.cameraOffset.x = clamp(this.cameraOffset.x + this.keyboardStep, -2.0, 2.0);
        }
        break;
      case 'KeyS': // Y軸 -
        if (event.ctrlKey) {
          this.cameraOffset.y = clamp(this.cameraOffset.y - this.keyboardStep, -1.0, 2.0);
        }
        break;
      case 'KeyI': // Y軸 + (WをIに変更)
        if (event.ctrlKey) {
          this.cameraOffset.y = clamp(this.cameraOffset.y + this.keyboardStep, -1.0, 2.0);
        }
        break;
      case 'KeyU': // Z軸 - (QをUに変更)
        if (event.ctrlKey) {
          this.cameraOffset.z = clamp(this.cameraOffset.z - this.keyboardStep, -2.0, 2.0);
        }
        break;
      case 'KeyO': // Z軸 + (EをOに変更)
        if (event.ctrlKey) {
          this.cameraOffset.z = clamp(this.cameraOffset.z + this.keyboardStep, -2.0, 2.0);
        }
        break;

      // カメラ回転 (矢印キー)
      case 'ArrowLeft': // Y軸回転 -
        this.cameraRotation.y = clamp(this.cameraRotation.y - this.keyboardStep, -Math.PI, Math.PI);
        break;
      case 'ArrowRight': // Y軸回転 +
        this.cameraRotation.y = clamp(this.cameraRotation.y + this.keyboardStep, -Math.PI, Math.PI);
        break;
      case 'ArrowUp': // X軸回転 -
        this.cameraRotation.x = clamp(this.cameraRotation.x - this.keyboardStep * 0.5, -Math.PI/3, Math.PI/3);
        break;
      case 'ArrowDown': // X軸回転 +
        this.cameraRotation.x = clamp(this.cameraRotation.x + this.keyboardStep * 0.5, -Math.PI/3, Math.PI/3);
        break;

      // アニメーションスピード (- / + キー)
      case 'Minus':
        this.animationSpeed = clamp(this.animationSpeed - 0.1, 0.1, 3.0);
        console.log(`🎬 Animation speed: ${this.animationSpeed.toFixed(2)}x`);
        break;
      case 'Equal': // + キー
        this.animationSpeed = clamp(this.animationSpeed + 0.1, 0.1, 3.0);
        console.log(`🎬 Animation speed: ${this.animationSpeed.toFixed(2)}x`);
        break;

      // カメラリセット (R キー)
      case 'KeyR':
        this.cameraOffset = { x: 0, y: 0, z: 0 };
        this.cameraRotation = { x: 0, y: 0 };
        this.animationSpeed = 1.0;
        console.log("📷 Camera reset");
        break;
    }
  }


  // // nanoKONTROL2: CCで各パラメータを動かす
  // _onNanoKONTROL(e) {
  //   const [status, d1, d2] = e.data;
  //   if ((status & 0xf0) !== 0xb0) return; // CCのみ
  //   const cc = d1;
  //   const v = d2 / 127;
  //   const clamp = (x, min, max) => Math.max(min, Math.min(max, x));

  //   switch (this.effectModes[this.currentMode]) {
  //     case "wave":
  //       if (cc === 0) this.params.waveFreq = clamp(5 + v * 30, 0.1, 100);
  //       if (cc === 1) this.params.waveSpeed = clamp(v * 10, 0.05, 20);
  //       if (cc === 2) this.params.amp = clamp(v * 5, 0.1, 10);
  //       break;

  //     case "noise":
  //       if (cc === 0) this.params.noiseSpeed = clamp(v * 20, 0.1, 50);
  //       if (cc === 1) this.params.noiseAmp = clamp(v * 3.0, 0.1, 6.0);
  //       if (cc === 2) this.params.amp = clamp(v * 3.0, 0.1, 6.0);
  //       break;

  //     case "breath":
  //       if (cc === 0) this.params.breathSpeed = clamp(v * 3.0, 0.05, 5.0);
  //       if (cc === 1) this.params.breathAmp = clamp(v * 1.2, 0.05, 2.0);
  //       if (cc === 2) this.params.amp = clamp(v * 2.5, 0.1, 5.0);
  //       break;

  //     case "bubble":
  //       if (cc === 0) this.params.waveSpeed = clamp(v * 12.0, 0.05, 24.0);
  //       if (cc === 1) this.params.bubbleNoiseAmp = clamp(v * 2.5, 0.0, 4.0);
  //       if (cc === 2) this.params.bubbleBreathAmp = clamp(v * 1.2, 0.0, 2.0);
  //       break;
  //   }

  //   this._updateUI();
  // }

  // // nanoKEY2: ノートでモード切り替え
  // _onNanoKEY(e) {
  //   const [status, note, velocity] = e.data;
  //   const pressed = (status & 0xf0) === 0x90 && velocity > 0;
  //   if (!pressed) return;

  //   // 48..51 で wave, noise, breath, bubble
  //   if (note >= 48 && note <= 51) {
  //     this.currentMode = note - 48;
  //     console.log("Effect mode:", this.effectModes[this.currentMode]);
  //     this._updateUI();
  //   }
  // }

  /**
   * 音反応付きのモード別エフェクト
   * time: ms
   * audioBands: { bass, mid, high } 0..1
   */
  update(time, audioBands = { bass: 0, mid: 0, high: 0 }) {
    if (!this.initialized || !this.gs || !this.gs.splatMesh) return;

    const baseData = this.gs.splatMesh.splatDataTextures?.baseData;
    const cov = baseData?.covariances;
    const base0 = this.gs.covariances0;
    const centers0 = this.gs.centers0;
    if (!cov || !base0 || !centers0) return;

    const t = time * 0.001;
    const { bass, mid, high } = audioBands;

    // 全モード共通の音反応係数（必ず掛ける）
    // クールタイム処理：クールタイム中は強制的に0を代入
    if (this.bassCooldown > 0) {
      this.bassCooldown -= 0.01;
      this.level = 0.0; // クールタイム中は0を代入
    } else {
      // 閾値チェック：bassが0.15を超えたらlevelを1.0に設定してクールタイム開始
      if (bass > 0.13) {
        this.level = 0.8;
        this.bassCooldown = 0.1; // 0.5秒のクールタイム開始
        // console.log("Bass detected! Level set to:", this.level);
      } else {
        this.level = 0.0;
      }
    }

    const ampFactor = 1.0 + this.level * 10.0;
    const {
      waveFreq, waveSpeed, amp,
      noiseAmp, noiseSpeed,
      breathSpeed, breathAmp,
      bubbleWaveAmp, bubbleNoiseAmp, bubbleBreathAmp
    } = this.params;


    switch (this.effectModes[this.currentMode]) {
      // 縦に走る波
      case "wave": {
        for (let i = 0; i < cov.length; i += 6) {
          const idx = (i / 6) * 3;
          const y = centers0[idx + 1];
          const wave = 1.0 + Math.sin(y * waveFreq + t * waveSpeed) * amp;
          const scaled = wave * ampFactor;
          cov[i + 0] = base0[i + 0] * scaled;
          cov[i + 3] = base0[i + 3] * scaled;
          cov[i + 5] = base0[i + 5] * scaled;
        }
        break;
      }

      // 全体がざわめくノイズ
      case "noise": {
        for (let i = 0; i < cov.length; i += 6) {
          const n = Math.sin(i * 0.2 + t * noiseSpeed) * noiseAmp;
          const scaled = (1.0 + n * 0.4) * ampFactor;
          cov[i + 0] = base0[i + 0] * scaled;
          cov[i + 3] = base0[i + 3] * scaled;
          cov[i + 5] = base0[i + 5] * scaled;
        }
        break;
      }

      // 呼吸拡縮
      case "breath": {
        const breathe = 1.0 + Math.sin(t * breathSpeed * 2.0 * Math.PI) * breathAmp;
        const scaledFactor = breathe * ampFactor;
        for (let i = 0; i < cov.length; i += 6) {
          cov[i + 0] = base0[i + 0] * scaledFactor;
          cov[i + 3] = base0[i + 3] * scaledFactor;
          cov[i + 5] = base0[i + 5] * scaledFactor;
        }
        break;
      }

      // 複合の泡っぽい揺れ
      case "bubble": {
        for (let i = 0; i < cov.length; i += 6) {
          const idx = (i / 6) * 3;
          const y = centers0[idx + 1];

          const waveTerm = Math.sin(y * (waveFreq * 0.6) + t * (waveSpeed * 1.2)) * bubbleWaveAmp;
          const noiseTerm = Math.sin(i * 0.18 + t * (noiseSpeed * 1.3)) * bubbleNoiseAmp;
          const breathTerm = Math.sin(t * breathSpeed * 2.0 * Math.PI) * bubbleBreathAmp;

          const total = 1.0 + (waveTerm + noiseTerm + breathTerm) * 0.08; // ベース揺れ
          const scaled = total * ampFactor;                               // 音で膨張
          cov[i + 0] = base0[i + 0] * scaled;
          cov[i + 3] = base0[i + 3] * scaled;
          cov[i + 5] = base0[i + 5] * scaled;
        }
        break;
      }
    }

    // アニメーションスピードの適用
    if (this.gvrm && this.gvrm.character && this.gvrm.character.currentAction) {
      this.gvrm.character.currentAction.timeScale = this.animationSpeed;
    }

    // シンプルなカメラ回転・移動
    if (this.camera&&false) {
      const target = new THREE.Vector3(0, 1.0, 0); // モデルの中心を見る
      
      // シンプルな球面座標での位置計算
      const theta = this.cameraRotation.y; // 水平回転
      const phi = this.cameraRotation.x;   // 垂直回転
      
      // 基本位置（距離は一定）
      const x = this.cameraDistance * Math.cos(phi) * Math.cos(theta);
      const y = this.cameraDistance * Math.sin(phi) + target.y;
      const z = this.cameraDistance * Math.cos(phi) * Math.sin(theta);
      
      // オフセットを単純に加算
      this.camera.position.set(
        x + this.cameraOffset.x,
        y + this.cameraOffset.y,
        z + this.cameraOffset.z
      );
      
      this.camera.lookAt(target);
    }

    // GPUへ反映
    this.gs.splatMesh.updateDataTexturesFromBaseData(0, this.gs.splatCount - 1);
    this.gvrm.update();
  }
}
