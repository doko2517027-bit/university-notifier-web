# Throb 完全2D・対戦システム試験版

現在の画面にはキャラクターを実装せず、青・橙の操作マーカーで2D横視点のCPU対戦を試せます。既存のハルト画像や定義は消さず保管していますが、ゲームでは読み込み・表示しません。CareMateの認証済み学籍番号2510044だけがゲームを起動でき、同アカウントではリクエストタブがThrobに変わります。他の学生のリクエストタブは従来どおりです。ゲームデータのクラウド保存やポイント連携はまだありません。

ローカル実行：このリポジトリのルートで静的HTTPサーバーを起動し、CareMateへ2510044でログインして `/throwbattle/` を開きます。未認証・別アカウント・Firebaseに接続できない場合は対戦画面を開きません。`file://` では認証と設定ファイル取得が動きません。

限定公開の範囲：GitHub Pagesの静的ファイル自体は公開URLから取得可能です。今回のゲームは端末内のCPU対戦のみで、ポイント・戦績・所持品の保存を行いません。将来クラウドデータや対人戦を追加する際には、画面の本人確認だけでなくサーバー側の認可が必要です。

自動テスト：`cd throwbattle && npm test`

操作：PC は A/D・Space・J・K・L・Esc。スマホは横画面で左スティック＋右ボタン。3ストック、HP 0 または場外落下で1ストック消費、10秒後に復活、復活後3秒無敵です。ジャンプを上段足場に届く高さへ調整しました。Kは3.2秒間の投擲強化です。オンライン対戦、ガチャ、保存、正式キャラクター・防具は未実装です。

構成：`js/core/Match.js` が描画エンジンから独立した対戦ルール、`js/rendering/CanvasRenderer.js` がCanvas 2D描画、`js/input/InputManager.js` がPC/タッチ入力、`js/data.js` と `assets/characters/*/character.json` が設定です。Canvas 2Dを選んだのは、現行の静的配信環境で追加のビルド・CDN依存なく動作検証できるためです。正式画像の大量追加時は描画層のみPixiJSへ交換できます。

正式画像の共通規格・追加手順は [SPRITE_ASSET_SPEC.md](docs/SPRITE_ASSET_SPEC.md) を参照してください。ハルトの正式デザイン基準は [HARUTO_DESIGN.md](docs/HARUTO_DESIGN.md) と [設計図](docs/reference/haruto_design.png) です。

全動作の確認ツール：`/throwbattle/tools/animation_preview.html`（ローカルWebサーバー経由で開く）。再生、一時停止、コマ送り、FPS、背景色、足元基準線、当たり判定、装備アンカーを確認できます。作業と検証の内訳は [HARUTO_IMPLEMENTATION.md](docs/HARUTO_IMPLEMENTATION.md) にまとめています。

正式品質に向けた44コマの点検結果、改善前後、追加制作が必要なポーズは [HARUTO_QUALITY_REVIEW.md](docs/HARUTO_QUALITY_REVIEW.md) を参照してください。画像形式・足元の一括検査は `node tools/audit_haruto_frames.mjs` で実行できます。現状の画像はまだ正式品質の完成判定ではありません。
