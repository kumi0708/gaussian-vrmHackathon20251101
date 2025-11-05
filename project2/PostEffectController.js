// PostEffectController.js
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { FilmPass } from "three/addons/postprocessing/FilmPass.js";
import { GlitchPass } from "three/addons/postprocessing/GlitchPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

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

    this._initMIDI();
  }

  // === MIDI接続 ===
  _initMIDI() {
    if (!("requestMIDIAccess" in navigator)) return;
    navigator.requestMIDIAccess().then((midi) => {
      for (const input of midi.inputs.values()) {
        const name = input.name.toLowerCase();
        if (name.includes("nanokey")) {
          console.log("🎹 Connected nanoKEY2 (for post effects)");
          input.onmidimessage = (e) => this._onNanoKEY(e);
        }
      }
    });
  }

  _onNanoKEY(e) {
    const [status, note, velocity] = e.data;
    const pressed = (status & 0xf0) === 0x90 && velocity > 0;
    if (!pressed) return;

    switch (note) {
      case 72: this.toggleEffect("bloom"); break;
      case 73: this.toggleEffect("film"); break;
      case 74: this.toggleEffect("glitch"); break;
      case 75: this.toggleEffect("scanline"); break;
      case 76: this.toggleEffect("colorShift"); break;
      case 77: this.toggleEffect("none"); break;
      case 78: this.nextEffect(); break;
      case 79: this.randomEffect(); break;
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
    const nextIndex = (currentIndex + 1) % this.effects.length;
    this.toggleEffect(this.effects[nextIndex]);
  }

  randomEffect() {
    const effects = this.effects.filter((e) => e !== "none");
    const rand = effects[Math.floor(Math.random() * effects.length)];
    this.toggleEffect(rand);
  }

  render(delta) {
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
