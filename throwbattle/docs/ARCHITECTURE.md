# 構成

- `index.html`：タイトル、メニュー、対戦、結果の画面要素。
- `style.css` / `responsive.css` / `phase5.css`：仮デザイン、画面サイズ調整、育成画面。
- `src/main.js`：画面遷移と試合の生成・終了。
- `src/data/config.js`：数値、キャラ・武器・ステージ、素材パスを集約。
- `src/data/progression.js`：経験値、能力、初期防具・スキルの定義。
- `src/services/profile.js`：独立したローカル試作プロフィール、装備変更、試合報酬の一回限りの反映。
- `src/services/cloudSync.js`：試作記録の競合検出と同期。既存の記録を無断で上書きしない。
- `src/integrations/caremate.js`：既存Firebase認証を確認し、本人限定のFirestore読み書きと学習ポイントの読み取りを行う。
- `src/core/assets.js`：GLB読込、仮モデル、アニメーションと破棄。
- `src/stages/classroom.js`：教室の仮モデルと、見た目に依存しない当たり判定。
- `src/ui/InputController.js`：PC・タッチ入力。試合終了時にイベント登録を解除。
- `src/battle/BattleSession.js`：HP、残機、復活、時間切れ、勝敗の計算。
- `src/game/GameApp.js`：Three.js描画、キャラ移動、CPU、投擲、命中、カメラ。
- `src/screens/MenuPreview.js`：メニュー専用3Dプレビュー。
- `src/audio/AudioManager.js`：任意のBGM・効果音パスを再生。

`GameApp.destroy()` は描画ループ・入力・ResizeObserver・3D資源を解放する。ローカル保存は `localStorage` キー `throb:standalone-profile:v1`。Phase 6では認証済み `2510044` だけが `throbPrototypeProfiles/2510044` に同期するコードとルールを用意した。本番ルールは未公開なので、現時点の画面では同期不能なら端末内保存を続ける。変更競合が起きたら自動上書きせず、利用者が記録を選ぶ。クラウド記録はクライアントで編集可能な「非公式試作データ」であり、公式学習ポイント・順位・課金残高へ転用しない。将来の対戦報酬はサーバー側で検証・確定する。
