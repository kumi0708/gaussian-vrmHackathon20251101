// PostEffectController.js
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { FilmPass } from "three/addons/postprocessing/FilmPass.js";
import { GlitchPass } from "three/addons/postprocessing/GlitchPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { keyboardManager } from "./KeyboardManager.js";

export class PostEffectController {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    // === 基本構成 ===
    this.composer = new EffectComposer(renderer);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    // === 標準ポストエフェクト ===
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.0, 0.5, 0.85
    );
    this.filmPass = new FilmPass(0.35, 0.025, 648, false);
    this.glitchPass = new GlitchPass();

    // === Scanline Shader ===
    const scanlineShader = {
      uniforms: {
        tDiffuse: { value: null },
        time: { value: 0 },
        intensity: { value: 0.3 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float time;
        uniform float intensity;
        varying vec2 vUv;
        void main() {
          vec4 base = texture2D(tDiffuse, vUv);
          float scan = sin(vUv.y * 800.0 + time * 10.0) * 0.5 + 0.5;
          base.rgb -= scan * intensity;
          gl_FragColor = base;
        }`,
    };
    this.scanlinePass = new ShaderPass(scanlineShader);

    // === ColorShift Shader ===
    const colorShiftShader = {
      uniforms: {
        tDiffuse: { value: null },
        amount: { value: 0.003 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float amount;
        varying vec2 vUv;
        void main() {
          vec2 offset = vec2(amount, 0.0);
          float r = texture2D(tDiffuse, vUv + offset).r;
          float g = texture2D(tDiffuse, vUv).g;
          float b = texture2D(tDiffuse, vUv - offset).b;
          gl_FragColor = vec4(r, g, b, 1.0);
        }`,
    };
    this.colorShiftPass = new ShaderPass(colorShiftShader);

    // === 状態管理 ===
    this.currentEffect = "none";
    this.effects = ["none", "bloom", "film", "glitch", "scanline", "colorShift"];
    this.enabled = false;

    // === 自動エフェクト切り替え機能 ===
    this.autoEffectMode = false;
    this.autoEffectTimer = 0;
    this.autoEffectInterval = 2.0; // 2秒間隔

    // this._initMIDI();
    this._initKeyboard();
  }

  // === MIDI接続 ===
  // _initMIDI() {
  //   if (!("requestMIDIAccess" in navigator)) return;
  //   navigator.requestMIDIAccess().then((midi) => {
  //     for (const input of midi.inputs.values()) {
  //       const name = input.name.toLowerCase();
  //       if (name.includes("nanokey")) {
  //         console.log("🎹 Connected nanoKEY2 (for post effects)");
  //         input.onmidimessage = (e) => this._onNanoKEY(e);
  //       }
  //     }
  //   });
  // }
  handleNanoKEY(e) {
    const [status, note, velocity] = e.data;
    const pressed = (status & 0xf0) === 0x90 && velocity > 0;
    if (!pressed) return;
    
    switch (note) {
      case 60: this.toggleEffect("bloom"); break;
      case 61: this.toggleEffect("film"); break;
      case 62: this.toggleEffect("glitch"); break;
      case 63: this.toggleEffect("scanline"); break;
      case 64: this.toggleEffect("colorShift"); break;
      case 65: 
        // 自動エフェクト切り替えを強制停止
        this.autoEffectMode = false;
        this.toggleEffect("none"); 
        console.log("🛑 Auto effect mode OFF - Effects cleared");
        break;
      case 66: this.nextEffect(); break;
      case 67: this.randomEffect(); break;
      case 72:
        console.log("ｃ");
        // 自動エフェクト切り替えのオン/オフ
        this.autoEffectMode = !this.autoEffectMode;
        if (this.autoEffectMode) {
          this.autoEffectTimer = 0;
          console.log("🔄 Auto effect mode ON - Effects will cycle every", this.autoEffectInterval, "seconds");
          this.nextEffect(); // 即座に最初のエフェクトを適用
        } else {
          console.log("⏹ Auto effect mode OFF");
        }
        break;
    }
  }


  _onNanoKEY(e) {
    const [status, note, velocity] = e.data;
    const pressed = (status & 0xf0) === 0x90 && velocity > 0;
    if (!pressed) return;

    switch (note) {
      case 60: this.toggleEffect("bloom"); break;
      case 61: this.toggleEffect("film"); break;
      case 62: this.toggleEffect("glitch"); break;
      case 63: this.toggleEffect("scanline"); break;
      case 64: this.toggleEffect("colorShift"); break;
      case 65:
        // 自動エフェクト切り替えを強制停止
        this.autoEffectMode = false;
        this.toggleEffect("none"); 
        console.log("🛑 Auto effect mode OFF - Effects cleared");
        break;
      case 66: this.nextEffect(); break;
      case 67: this.randomEffect(); break;
      case 72:
        // 自動エフェクト切り替えのオン/オフ
        this.autoEffectMode = !this.autoEffectMode;
        if (this.autoEffectMode) {
          this.autoEffectTimer = 0;
          console.log("🔄 Auto effect mode ON - Effects will cycle every", this.autoEffectInterval, "seconds");
          this.nextEffect(); // 即座に最初のエフェクトを適用
        } else {
          console.log("⏹ Auto effect mode OFF");
        }
        break;
    }
  }

  // キーボード初期化
  _initKeyboard() {
    keyboardManager.init();
    keyboardManager.registerHandler('postEffect', (keyCode, pressed, event) => {
      this._handleKeyPress(keyCode, pressed, event);
    });
  }

  // キーボード入力処理
  _handleKeyPress(keyCode, pressed, event) {
    if (!pressed) return;

    switch (keyCode) {
      // ポストエフェクト切り替え (数字キー)
      case 'Digit5':
        this.toggleEffect("bloom");
        break;
      case 'Digit6':
        this.toggleEffect("film");
        break;
      case 'Digit7':
        this.toggleEffect("glitch");
        break;
      case 'Digit8':
        this.toggleEffect("scanline");
        break;
      case 'Digit9':
        this.toggleEffect("colorShift");
        break;
      case 'Digit0':
        this.toggleEffect("none");
        break;

      // エフェクト制御
      case 'BracketLeft': // [
        this.nextEffect();
        break;
      case 'BracketRight': // ]
        this.randomEffect();
        break;
      case 'Backslash': // \
        this.autoEffectMode = !this.autoEffectMode;
        if (this.autoEffectMode) {
          this.autoEffectTimer = 0;
          console.log("🔄 Auto effect mode ON - Effects will cycle every", this.autoEffectInterval, "seconds");
          this.nextEffect();
        } else {
          console.log("⏹ Auto effect mode OFF");
        }
        break;
    }
  }

  toggleEffect(name) {
    this._removeAllPasses();

    switch (name) {
      case "bloom":
        this.bloomPass.strength = 1.8;
        this.bloomPass.radius = 0.5;
        this.bloomPass.threshold = 0.2;
        this.composer.addPass(this.bloomPass);
        console.log("✨ Bloom enabled");
        break;

      case "film":
        this.filmPass.uniforms.grayscale.value = false;
        this.filmPass.uniforms.intensity.value = 0.8;
        this.composer.addPass(this.filmPass);
        console.log("🎞 Film enabled");
        break;

      case "glitch":
        this.glitchPass.goWild = false;
        this.composer.addPass(this.glitchPass);
        console.log("⚡ Glitch enabled");
        break;

      case "scanline":
        this.composer.addPass(this.scanlinePass);
        console.log("📺 Scanline enabled");
        break;

      case "colorShift":
        this.composer.addPass(this.colorShiftPass);
        console.log("🌈 ColorShift enabled");
        break;

      default:
        console.log("❌ Effects cleared");
        break;
    }

    this.currentEffect = name;
    this.enabled = name !== "none";
  }

  _removeAllPasses() {
    while (this.composer.passes.length > 1) {
      this.composer.removePass(this.composer.passes[1]);
    }
  }

  nextEffect() {
    const currentIndex = this.effects.indexOf(this.currentEffect);
    let nextIndex = (currentIndex + 1) % this.effects.length;
    
    // 自動モードの場合は"none"をスキップ
    if (this.autoEffectMode && this.effects[nextIndex] === "none") {
      nextIndex = (nextIndex + 1) % this.effects.length;
    }
    
    this.toggleEffect(this.effects[nextIndex]);
  }

  randomEffect() {
    const effects = this.effects.filter((e) => e !== "none");
    const rand = effects[Math.floor(Math.random() * effects.length)];
    this.toggleEffect(rand);
  }

  render(delta) {
    // 自動エフェクト切り替え処理
    if (this.autoEffectMode) {
      this.autoEffectTimer += delta;
      if (this.autoEffectTimer >= this.autoEffectInterval) {
        this.autoEffectTimer = 0;
        this.nextEffect();
      }
    }

    if (this.enabled) {
      // timeを進める（scanline用）
      if (this.scanlinePass && this.scanlinePass.uniforms?.time) {
        this.scanlinePass.uniforms.time.value += delta;
      }
      this.composer.render(delta);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
