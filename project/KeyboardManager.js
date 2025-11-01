// KeyboardManager.js - 統合キーボード管理システム
export class KeyboardManager {
  constructor() {
    this.keyPressed = {};
    this.handlers = new Map();
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;

    document.addEventListener('keydown', (e) => {
      this.keyPressed[e.code] = true;
      this._handleKeyPress(e.code, true, e);
    });

    document.addEventListener('keyup', (e) => {
      this.keyPressed[e.code] = false;
    });

    this.initialized = true;
    console.log("🎹 KeyboardManager initialized");
  }

  // ハンドラー登録
  registerHandler(name, handler) {
    this.handlers.set(name, handler);
    console.log(`🎹 Registered handler: ${name}`);
  }

  // ハンドラー削除
  unregisterHandler(name) {
    this.handlers.delete(name);
    console.log(`🎹 Unregistered handler: ${name}`);
  }

  // キー処理の実行
  _handleKeyPress(keyCode, pressed, event) {
    if (!pressed) return;

    // 全てのハンドラーに処理を委譲
    for (const [name, handler] of this.handlers) {
      try {
        handler(keyCode, pressed, event);
      } catch (error) {
        console.error(`🎹 Handler error in ${name}:`, error);
      }
    }
  }

  // キーが押されているかチェック
  isKeyPressed(keyCode) {
    return !!this.keyPressed[keyCode];
  }

  // 現在押されているキー一覧
  getPressedKeys() {
    return Object.keys(this.keyPressed).filter(key => this.keyPressed[key]);
  }
}

// グローバルインスタンス
export const keyboardManager = new KeyboardManager();