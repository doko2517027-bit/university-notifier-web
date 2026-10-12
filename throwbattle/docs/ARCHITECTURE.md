# 構成

- `index.html`：タイトル、メニュー、対戦、結果の画面要素。
- `style.css` / `responsive.css`：仮デザイン、画面サイズ調整。
- `src/main.js`：画面遷移と試合の生成・終了。
- `src/data/config.js`：数値、キャラ・武器・ステージ、素材パスを集約。
- `src/data/i18n.js`：将来の多言語表示用辞書。現段階の全UIは未切替。
- `src/core/assets.js`：GLB読込、仮モデル、アニメーションと破棄。
- `src/stages/classroom.js`：教室の仮モデルと、見た目に依存しない当たり判定。
- `src/ui/InputController.js`：PC・タッチ入力。試合終了時にイベント登録を解除。
- `src/battle/BattleSession.js`：HP、残機、復活、時間切れ、勝敗の計算。
- `src/game/GameApp.js`：Three.js描画、キャラ移動、CPU、投擲、命中、カメラ。
- `src/screens/MenuPreview.js`：メニュー専用3Dプレビュー。
- `src/audio/AudioManager.js`：任意のBGM・効果音パスを再生。

`GameApp.destroy()` は描画ループ・入力・ResizeObserver・3D資源を解放する。対戦データの永続化とCareMate連携は後続Phaseで、独立した `services/`・`integrations/` に追加する。
