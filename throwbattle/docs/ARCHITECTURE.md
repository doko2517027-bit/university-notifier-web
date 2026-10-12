# 構成

- `index.html`：タイトル、メニュー、対戦、結果の画面要素。
- `style.css` / `responsive.css` / `phase5.css`：仮デザイン、画面サイズ調整、育成画面。
- `src/main.js`：画面遷移と試合の生成・終了。
- `src/data/config.js`：数値、キャラ・武器・ステージ、素材パスを集約。
- `src/data/i18n.js`：将来の多言語表示用辞書。現段階の全UIは未切替。
- `src/data/progression.js`：経験値、能力、初期防具・スキルの定義。
- `src/services/profile.js`：独立したローカル試作プロフィール、装備変更、試合報酬の一回限りの反映。
- `src/core/assets.js`：GLB読込、仮モデル、アニメーションと破棄。
- `src/stages/classroom.js`：教室の仮モデルと、見た目に依存しない当たり判定。
- `src/ui/InputController.js`：PC・タッチ入力。試合終了時にイベント登録を解除。
- `src/battle/BattleSession.js`：HP、残機、復活、時間切れ、勝敗の計算。
- `src/game/GameApp.js`：Three.js描画、キャラ移動、CPU、投擲、命中、カメラ。
- `src/screens/MenuPreview.js`：メニュー専用3Dプレビュー。
- `src/audio/AudioManager.js`：任意のBGM・効果音パスを再生。

`GameApp.destroy()` は描画ループ・入力・ResizeObserver・3D資源を解放する。Phase 5の保存先はブラウザ内の `localStorage` キー `throb:standalone-profile:v1` のみで、CareMateの学習ポイント・認証・Firestoreに触れない。別端末との同期やサーバー側の不正防止はPhase 6以降に `integrations/` と信頼できる処理で実装する。
