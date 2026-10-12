# 素材の差し替え手順

プログラムの3D処理を書き換えなくても、`src/data/config.js` の `ASSETS` に素材ファイルの場所を記入できる。素材を置く例：`throwbattle/assets/characters/student.glb`。ファイル名は英数字にすると管理しやすい。

1. 対象フォルダーにファイルを置く。`assets/characters/`、`weapons/`、`armor/`、`accessories/`、`stages/`、`backgrounds/`、`buttons/`、`icons/`、`effects/`、`audio/` を使う。現在の仮素材はコードで描いているため、フォルダーにはまだ画像やモデルがありません。
2. `ASSETS.character.model` などの `null` を `./assets/characters/student.glb` のようなパスに変更する。
3. ローカルサーバーで `throwbattle/` を開き、モデルの大きさと向きを確認する。ファイルを直接ダブルクリックして開く方法はモジュール読み込みで失敗する場合がある。
4. 表示されない場合は開発者ツールのログとパスを確認する。ゲームは仮モデルに自動で戻る。

キャラと武器とステージはGLBを推奨。キャラの足元を原点 `(0,0,0)` にし、正面を `-Z` 向きにする。人物の高さは約2.4ゲーム単位。ステージは中央原点、幅34・奥行28単位に合わせる。ステージの当たり判定や出現地点は `STAGES.classroom` で別管理するので、見た目を大きく変えた場合はそこだけ合わせる。キャラクターのモデル指定は `CHARACTER_APPEARANCES`、HPなどは `CHARACTER_STATS`、将来の育成上限は `CHARACTER_PROGRESSION`、装飾の選択肢は `CHARACTER_COSMETICS` に分けてある。現段階では育成・装飾の画面と保存機能は未実装。

キャラGLBに `idle`、`walk`、`dash`、`jump`、`land`、`throw`、`hit`、`defeat` の名前のアニメーションがあれば再生対象になる。未収録でも仮モデル表示に戻ったりゲームを停止させたりはしない。ファイル読込失敗時は仮モデルで続行する。

タイトルロゴ・背景・メニュー背景・主ボタン画像は `ASSETS.ui` に設定。画像が読み込めなければ既存の文字・色を維持する。効果音とBGMは `ASSETS.audio` の各項目に音声ファイルのパスを設定する。現在の仮素材はコードで描画しており、外部画像や音声ファイルは必須ではない。
