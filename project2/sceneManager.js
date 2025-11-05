import * as THREE from "three";
import { GVRM } from "gvrm";

export class SceneManager {
  constructor(renderer, scene, camera, statusElement) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.status = statusElement;

    this.gvrmFiles = [
      "sample1.gvrm",
      "sample2.gvrm",
      "sample3.gvrm",
      "sample4.gvrm",
      "sample5.gvrm",
      "sample6.gvrm",
      "sample7.gvrm",
      "sample8.gvrm",
      "sample9.gvrm",
    ];

    this.animations = [
      "Idle.fbx",
      "Walking.fbx",
      "Breathing.fbx",
      "Gangnam Style.fbx",
      "Warrior.fbx",
      "Listening.fbx",
      "Shrugging.fbx",
      "Chicken Dance.fbx",
      "Pointing.fbx",
      "Around.fbx",
      "Acknowledging.fbx",
      "Dizzy Idle.fbx",
      "Happy Idle.fbx",
      "Jab Cross.fbx"
    ];
    this.idleFBX = "../assets/Idle.fbx";
    this.currentGvrm = null;
    this.currentModelIndex = -1;
    this.currentScene = 1;
    this.isSwitching = false;
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

        // Idle.fbx は呼ばない！(ここではモデルのみロード)
        model.currentFbxPath = null;

        return model;
    }

    async switchModel(index) {
        if (this.isSwitching) return;
        if (index === this.currentModelIndex) return;
        this.isSwitching = true;

        const file = this.gvrmFiles[index];
        this.showStatus(`🔄 Loading ${file} ...`);

        // 現在のアニメーション情報を保持
        let currentFBX = this.idleFBX;
        let currentTime = 0;
        if (this.currentGvrm?.currentFbxPath) {
            currentFBX = this.currentGvrm.currentFbxPath;
            const action = this.currentGvrm.character?.currentAction;
            if (action) currentTime = action.time || 0;
        }

        // 🔹 モデルだけロード
        const newModel = await this.fullyPreloadModel(index);

        // 🔹 前回のアニメーションを引き継ぎ
        await newModel.changeFBX(currentFBX);
        const newAction = newModel.character?.currentAction;
        if (newAction) {
            newAction.play();
            newAction.time = currentTime;
        }
        newModel.currentFbxPath = currentFBX;

        // 🔹 古いモデルを削除して新モデルを追加
        if (this.currentGvrm) {
            this.scene.remove(this.currentGvrm.character?.currentVrm?.scene);
            this.scene.remove(this.currentGvrm.gs?.splatMesh);
        }
        if (newModel.character?.currentVrm?.scene)
            this.scene.add(newModel.character.currentVrm.scene);
        if (newModel.gs?.splatMesh)
            this.scene.add(newModel.gs.splatMesh);

        this.currentGvrm = newModel;
        this.currentModelIndex = index;

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

  async initMIDI() {
    if (!navigator.requestMIDIAccess) {
      this.showStatus("⚠️ MIDI not supported", "#ff4444");
      return;
    }

    const midiAccess = await navigator.requestMIDIAccess();
    midiAccess.inputs.forEach((input) => {
      console.log("🎛 Connected:", input.name);
      input.onmidimessage = (msg) => {
        const [status, note, value] = msg.data;
        if (status === 144 && value > 0) this.handlePadInput(note, value);
      };
    });
  }

  update(delta) {
    if (this.currentGvrm) {
      this.currentGvrm.update(delta);
    }
  }
}
