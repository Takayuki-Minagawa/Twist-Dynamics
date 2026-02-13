# Twist-Dynamics

## バージョン
- `Ver1.0.0`

`HH捩れ振動評価` の Web 移植（Phase 0/1）向け実装です。  
この段階では、既存ファイル互換の I/O と差分検証を優先しています。

## 実装済み
- `BuildingModel(JSON)` パーサ
- `BuildingModel(XML)` パーサ
- `Modal(.dat)` パーサ
- `ComplexModal(.dat)` パーサ
- `RespResult(.csv)` パーサ
- 実固有値解析（3自由度/層）コア
- 複素固有値解析（状態方程式）コア
- 基準比較 CLI（`scripts/compare.ts`）
  - 比較ロジックは `src/core/compare.ts` へ分離
  - `--format json` による構造化出力をサポート
- 解析実行 CLI（`scripts/analyze.ts`）
  - `BuildingModel` (JSON/XML) から `Modal/ComplexModal` の DAT を出力
  - モードベクトルは従来と同様に読みやすい正規化（モード毎最大振幅=1）
- 簡易ブラウザ UI（ローカルファイル読込と互換確認）
- 入力モデル作成フォーム（主要項目入力 + JSON 生成/保存）
- 多言語 UI（日本語 / English）
- 簡易マニュアル表示（言語連動）
- ライト / ダークモード切替
- テーブル駆動テスト（fixture/golden 比較）による回帰検証

## 文字コード方針
- リポジトリ内のテキストファイルは `UTF-8 (BOMなし)` を基準とする
- アップロードファイルは `UTF-8 / Shift_JIS / UTF-16LE / UTF-16BE` を自動判定して読込む
- BOM 付き UTF-8/UTF-16 は読込時に BOM を除去して処理する
- 判定不能、または安全にデコードできない場合は処理を中止し、`UTF-8(BOMなし) か Shift_JIS で再保存して再アップロード` するようエラー表示する

## BuildingModel 仕様
- ルートは `format` / `version` / `model` を必須とする
- `format`: `twist-dynamics/building-model`
- `version`: `1`
- `model`: `src/core/types.ts` の `BuildingModel` 構造
- JSON / XML の両方を入力可能
- 入力時に壁方向（X/Y軸のみ）や壁特性参照整合などを検証

## サードパーティライセンス
- 利用ライブラリのライセンス一覧は `THIRD_PARTY_LICENSES.md` を参照
- runtime 配布対象（`fast-xml-parser`, `strnum`）は MIT ライセンス表記を同ファイルに記載

## 簡易マニュアル
- アプリ内の「簡易マニュアル」ボタンから表示
- 選択言語（日本語 / English）に連動して内容を切替
- 本バージョン表記: `Ver1.0.0`
- BuildingModel の JSON / XML 読込に対応
- 入力モデル作成フォームから JSON 生成・保存に対応
- 入力不整合は「形式エラー」、文字コード問題は「文字コードエラー」として表示

## セットアップ
```bash
npm install
```

## 開発サーバー
```bash
npm run dev
```

## テスト
```bash
npm run test
```

## エンコーディング検査
```bash
npm run check:encoding
```

## 比較スクリプト
```bash
npm run compare -- --type modal --reference reference/modal/test_01_eig.dat --target reference/modal/test_01_eig.dat
npm run compare -- --type complex --reference reference/complex/Test_simple_ceig.dat --target reference/complex/Test_simple_ceig.dat
npm run compare -- --type resp --reference reference/resp/test.csv --target reference/resp/test.csv
npm run compare -- --type complex --reference reference/complex/Test_simple_ceig.dat --target reference/complex/Test_simple_ceig.dat --format json
```

## 解析スクリプト
```bash
# 実固有値解析 (ModalResult DAT)
npm run analyze -- --type modal --input reference/building-model/Test_simple.json --output Work/modal_result.dat

# 複素固有値解析 (ComplexModal DAT) + 実固有値も同時出力
npm run analyze -- --type complex --input reference/building-model/Test_simple.json --output Work/complex_result.dat --modal-output Work/modal_result.dat
```

## ビルド
```bash
npm run build
```
