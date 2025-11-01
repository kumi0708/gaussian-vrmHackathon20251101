// SceneManager.js
import * as THREE from "three";
import { GVRM } from "gvrm";
import { keyboardManager } from "./KeyboardManager.js";

export class SceneManager {
  constructor(renderer, scene, camera, statusElement) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.status = statusElement;

    this.gvrmFiles = [
      "sample1.gvrm", "sample2.gvrm", "sample3.gvrm",
      "sample4.gvrm", "sample5.gvrm", "sample6.gvrm",
      "sample7.gvrm", "sample8.gvrm", "sample9.gvrm",
    ];

    this.animations = [
      "Idle.fbx", "Walking.fbx", "Breathing.fbx", "Gangnam Style.fbx",
      "Warrior.fbx", "Listening.fbx", "Shrugging.fbx", "Chicken Dance.fbx",
      "Pointing.fbx", "Around.fbx", "Acknowledging.fbx",
      "Dizzy Idle.fbx", "Happy Idle.fbx", "Jab Cross.fbx"
    ];

    this.idleFBX = "../assets/Idle.fbx";
    this.currentGvrm = null;
    this.currentModelIndex = -1;
    this.currentScene = 1;
    this.isSwitching = false;

    // 参照をあとで登録する
    this.modelEffectController = null;
    this.postEffectController = null;

    // キーボード操作用の状態
    this.keyPressed = {};
    this._initKeyboard();
  }

  setModelEffectController(controller) {
    this.modelEffectController = controller;
  }

  setPostEffectController(controller) {
    this.postEffectController = controller;
  }

  showStatus(text, color = "#00ffcc") {
    if (this.status) {
      this.status.style.color = color;
      this.status.textContent = text;
    }
  }

  detectSceneFromNote(note) {
    if (note >= 36 && note < 52) return 1;
    if (note >= 52 && note < 68) return 2;
    if (note >= 68 && note < 84) return 3;
    if (note >= 84 && note < 100) return 4;
    return 0;
  }

  async fullyPreloadModel(index) {
    const file = this.gvrmFiles[index];
    this.showStatus(`⏳ Loading ${file} ...`);
    console.log("🔄 Preloading:", file);

    const tempScene = new THREE.Scene();
    const model = await GVRM.load(`../assets/${file}`, tempScene, this.camera, this.renderer);
    model.currentFbxPath = null;
    return model;
  }

  async switchModel(index) {
    if (this.isSwitching) return;
    if (index === this.currentModelIndex) return;
    this.isSwitching = true;

    const file = this.gvrmFiles[index];
    this.showStatus(`🔄 Loading ${file} ...`);

    // 現在のアニメーションを保持
    let currentFBX = this.idleFBX;
    let currentTime = 0;
    if (this.currentGvrm?.currentFbxPath) {
      currentFBX = this.currentGvrm.currentFbxPath;
      const action = this.currentGvrm.character?.currentAction;
      if (action) currentTime = action.time || 0;
    }

    // 新しいモデルをロード
    const newModel = await this.fullyPreloadModel(index);

    // アニメーションを引き継ぎ
    await newModel.changeFBX(currentFBX);
    const newAction = newModel.character?.currentAction;
    if (newAction) {
      newAction.play();
      newAction.time = currentTime;
    }
    newModel.currentFbxPath = currentFBX;

    // 古いモデルを削除
    if (this.currentGvrm) {
      this.scene.remove(this.currentGvrm.character?.currentVrm?.scene);
      this.scene.remove(this.currentGvrm.gs?.splatMesh);
    }

    // 新しいモデルを追加
    if (newModel.character?.currentVrm?.scene)
      this.scene.add(newModel.character.currentVrm.scene);
    if (newModel.gs?.splatMesh)
      this.scene.add(newModel.gs.splatMesh);

    this.currentGvrm = newModel;
    this.currentModelIndex = index;

    // ✅ モデルエフェクト再接続
    if (this.modelEffectController) {
      this.modelEffectController.attachGvrm(newModel);
      console.log("🎨 ModelEffectController reattached to new model");
    }

    this.showStatus(
      `✅ Loaded ${file}\n🎞 ${currentFBX.split('/').pop()} (continued)`,
      "#00ff88"
    );

    this.isSwitching = false;
  }

  async switchAnimation(index) {
    if (!this.currentGvrm) return;
    const fbx = "../assets/" + this.animations[index];
    this.showStatus(`🎞 Changing animation: ${this.animations[index]}`);
    await this.currentGvrm.changeFBX(fbx);
    this.currentGvrm.currentFbxPath = fbx;
  }

  async handlePadInput(note, value) {
    if (value === 0) return;
    const sceneNum = this.detectSceneFromNote(note);
    if (sceneNum === 0) return;

    this.currentScene = sceneNum;
    const padMode = sceneNum % 2 === 1 ? 0 : 1;

    if (padMode === 0) {
      const base = sceneNum === 1 ? 36 : 68;
      const index = (note - base) % this.gvrmFiles.length;
      await this.switchModel(index);
    } else {
      const base = sceneNum === 2 ? 52 : 84;
      const index = (note - base) % this.animations.length;
      await this.switchAnimation(index);
    }
  }

  // キーボード初期化
  _initKeyboard() {
    keyboardManager.init();
    keyboardManager.registerHandler('sceneManager', (keyCode, pressed, event) => {
      this._handleKeyPress(keyCode, pressed, event);
    });
  }

  // キーボード入力処理
  _handleKeyPress(keyCode, pressed, event) {
    if (!pressed) return;

    switch (keyCode) {
      // アニメーション切り替え (テンキー)
      case 'Numpad0':
        this.switchAnimation(0); // Idle
        break;
      case 'Numpad1':
        this.switchAnimation(1); // Walking
        break;
      case 'Numpad2':
        this.switchAnimation(2); // Breathing
        break;
      case 'Numpad3':
        this.switchAnimation(3); // Gangnam Style
        break;
      case 'Numpad4':
        this.switchAnimation(4); // Warrior
        break;
      case 'Numpad5':
        this.switchAnimation(5); // Listening
        break;
      case 'Numpad6':
        this.switchAnimation(6); // Shrugging
        break;
      case 'Numpad7':
        this.switchAnimation(7); // Chicken Dance
        break;
      case 'Numpad8':
        this.switchAnimation(8); // Pointing
        break;
      case 'Numpad9':
        this.switchAnimation(9); // Around
        break;

      // 追加のアニメーション (Shift + テンキー)
      case 'NumpadDecimal': // . キー
        if (event.shiftKey) {
          this.switchAnimation(10); // Acknowledging
        }
        break;
      case 'NumpadAdd': // + キー
        if (event.shiftKey) {
          this.switchAnimation(11); // Dizzy Idle
        }
        break;
      case 'NumpadSubtract': // - キー
        if (event.shiftKey) {
          this.switchAnimation(12); // Happy Idle
        }
        break;
      case 'NumpadMultiply': // * キー
        if (event.shiftKey) {
          this.switchAnimation(13); // Jab Cross
        }
        break;

      // 次/前のモデル (Page Up/Down)
      case 'PageUp':
        const nextModelIndex = (this.currentModelIndex + 1) % this.gvrmFiles.length;
        this.switchModel(nextModelIndex);
        break;
      case 'PageDown':
        const prevModelIndex = (this.currentModelIndex - 1 + this.gvrmFiles.length) % this.gvrmFiles.length;
        this.switchModel(prevModelIndex);
        break;

      // 次/前のアニメーション (Home/End)
      case 'Home':
        if (this.currentGvrm) {
          const currentAnimIndex = this.animations.findIndex(anim => this.currentGvrm.currentFbxPath?.includes(anim));
          const nextAnimIndex = (currentAnimIndex + 1) % this.animations.length;
          this.switchAnimation(nextAnimIndex);
        }
        break;
      case 'End':
        if (this.currentGvrm) {
          const currentAnimIndex = this.animations.findIndex(anim => this.currentGvrm.currentFbxPath?.includes(anim));
          const prevAnimIndex = (currentAnimIndex - 1 + this.animations.length) % this.animations.length;
          this.switchAnimation(prevAnimIndex);
        }
        break;
    }
  }

  /** 🎛 MIDI入力をデバイス名で判定 */
  async initMIDI() {
    if (!navigator.requestMIDIAccess) {
      this.showStatus("⚠️ MIDI not supported", "#ff4444");
      return;
    }

    const midiAccess = await navigator.requestMIDIAccess();
    midiAccess.inputs.forEach((input) => {
      console.log("🎛 Connected:", input.name);

      input.onmidimessage = (event) => {
        const [status, note, value] = event.data;
        const deviceName = (event.target.name || "").toLowerCase();

        if (deviceName.includes("nanopad")) {
          // nanoPAD2 → モデル・アニメーション切替
          if (status === 144 && value > 0) this.handlePadInput(note, value);

        } else if (deviceName.includes("nanokontrol")) {
          // nanoKONTROL2 → モデルエフェクト制御
          if (this.modelEffectController) {
            this.modelEffectController.handleNanoKONTROL(event);
          }

        } else if (deviceName.includes("nanokey")) {
          // nanoKEY2 → ポストエフェクト制御
          if (this.postEffectController) {
            this.postEffectController.handleNanoKEY(event);
          }           
          if (this.modelEffectController) {
            this.modelEffectController.handleNanoKEY(event);
          }
        }
      };
    });
  }

  update(delta) {
    if (this.currentGvrm) this.currentGvrm.update(delta);
  }
}
