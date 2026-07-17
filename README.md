# Twist-Dynamics

## バージョン

- `Ver.1.2.0`

`Twist-Dynamics` は、低層建物を各層 3 自由度（並進 X、並進 Y、ねじれ θZ）のくし団子系として扱い、偏心・固有モード・時刻歴応答を確認する Web ツールです。単位系は kN・cm・s です。

## Ver.1.2.0 の主な機能

### モデル入力と互換性

- 建物概要、階情報、床外形、柱、壁特性、壁、マスダンパー、ブレースダンパーを表形式で編集
- 行追加・削除、セル単位のインライン検証、CSV / Excel TSV の一括貼付け
- 壁配置から壁特性 DB をプルダウン参照し、参照切れを入力時に検出
- JSON / XML の読込、正規化した BuildingModel JSON の表示・保存
- UTF-8 / Shift_JIS / UTF-16LE / UTF-16BE の自動判定と読込レポート
- 日本語 / English、ライト / ダークテーマ、言語連動の簡易マニュアル

旧形式の `sType` は警告付きで無視します。旧 `dxPanels` は、パネル頂点の算術平均位置に同じ方向別剛性を持つ `columns` へ警告付きで自動変換し、層剛性への寄与を維持します。書出しは `sType` / `dxPanels` を含まない新形式だけです。

### 解析と可視化

- 実固有値解析（3 自由度/層）
- 複素固有値解析（状態方程式）
- Newmark-β 法による時刻歴応答解析
- 層ごとの剛性、剛心、偏心距離、弾力半径、偏心率のライブ表示と CSV 出力
- 床外形・柱・壁・ダンパー・重心・剛心を確認できる階別 2D 平面プレビュー
- three.js による 3D モデル表示
  - 構造壁と非構造壁の表示区分
  - 要素種別・階ごとの表示 ON/OFF
  - 回転・パン・ズーム、視点リセット
  - 実固有モード、複素固有モード、時刻歴応答のアニメーション
  - 変形倍率、ねじれ強調、再生速度、シーク操作
- RespResult CSV の屋上変位時刻歴と、最大変位・最大層間変形角・最大ねじれ角・最大加速度の高さ方向分布

### 相対比剛性について

画面と層サマリ CSV の `relativeSpecificStiffnessX/Y` は、各層の比剛性 `K/W` を建物全層の平均 `K/W` で除した単純な相対値です。

これは日本の法令・告示で定められる剛性率 `Rs` ではありません。本ツールの偏心率・相対比剛性はモデル確認と比較検討を補助する指標であり、法適合判定や設計者による検証を代替しません。

## BuildingModel 仕様

- ルートの必須項目: `format` / `version` / `model`
- `format`: `twist-dynamics/building-model`
- `version`: `1`（互換性維持のため継続）
- `model`: [src/core/types.ts](src/core/types.ts) の `BuildingModel`
- JSON / XML の両方を入力可能
- 壁方向（X/Y 軸のみ）、階参照、壁特性参照などを読込・編集時に検証
- `WallCharaDB.isEigenEffectK = false` は解析剛性に含めない壁、`Wall.isVisible` は表示可否として独立に扱う

新形式のサンプルと旧形式の移行 fixture は [reference/README.md](reference/README.md) を参照してください。

## セットアップと基本コマンド

Vite 8 の要件に合わせ、Node.js `^20.19.0` または `>=22.12.0` を使用してください。開発環境と CI の標準バージョンは [.nvmrc](.nvmrc) の Node.js 22.18.0 です。

```bash
nvm use
npm ci
```

TypeScript 製の解析・比較・品質検査 CLI は `jiti` で実行します。個別の `esbuild` バージョン上書きは不要です。

```bash
npm run dev
npm run build
npm run check:licenses
npm run test
npm run check:encoding
npm run check:accuracy
```

`npm run check:accuracy` は失敗ケースがあっても `reference/accuracy/` にレポートを出力し、終了コード 0 で完了します。CI 等で失敗ケースを終了コード 1 にする場合は次を使用します。

```bash
npm run check:accuracy -- --strict
```

## 解析 CLI

```bash
# 実固有値解析 (ModalResult DAT)
npm run analyze -- --type modal \
  --input reference/building-model/Test_simple.json \
  --output Work/modal_result.dat

# 複素固有値解析 (ComplexModal DAT) + 実固有値も同時出力
npm run analyze -- --type complex \
  --input reference/building-model/Test_simple.json \
  --output Work/complex_result.dat \
  --modal-output Work/modal_result.dat

# 時刻歴応答解析 (RespResult CSV)
npm run analyze -- --type resp \
  --input reference/building-model/Test_simple.json \
  --wave Work/wave.csv \
  --output Work/resp_result.csv
```

解析 CLI は `--damping-ratio` を指定できます。時刻列のない 1 列地震波 CSV では `--wave-dt` も指定してください。

## 結果比較 CLI

```bash
npm run compare -- --type modal \
  --reference reference/modal/test_01_eig.dat \
  --target reference/modal/test_01_eig.dat

npm run compare -- --type complex \
  --reference reference/complex/Test_simple_ceig.dat \
  --target reference/complex/Test_simple_ceig.dat \
  --format json

npm run compare -- --type resp \
  --reference reference/resp/test.csv \
  --target reference/resp/test.csv
```

許容差は `--rtol` / `--atol`、表示件数は `--max-issues` で変更できます。

## 精度レポート

- JSON: `reference/accuracy/accuracy-report.json`
- Markdown: `reference/accuracy/accuracy-report.md`
- 生成データ: `reference/accuracy/generated/*.dat|*.csv`

## 文字コード方針

- リポジトリ内のテキストファイルは UTF-8（BOM なし）を基準とする
- アップロードファイルは UTF-8 / Shift_JIS / UTF-16LE / UTF-16BE を自動判定する
- BOM 付き UTF-8 / UTF-16 は読込時に BOM を除去する
- 安全に判定・デコードできない場合は処理を中止し、UTF-8（BOM なし）または Shift_JIS での再保存を案内する

## サードパーティライセンス

利用ライブラリとライセンスは [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) を参照してください。3D 表示には MIT ライセンスの three.js を使用しています。ビルド時には全文ライセンスとバンドル証跡が `dist/` に生成され、`npm run check:licenses` で配布物を検証できます。
