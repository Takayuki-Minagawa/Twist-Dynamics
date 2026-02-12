# Twist-Dynamics

`HH捩れ振動評価` の Web 移植（Phase 0/1）向け実装です。  
この段階では、既存ファイル互換の I/O と差分検証を優先しています。

## 実装済み
- `BuildingModel(XML)` パーサ
- `Modal(.dat)` パーサ
- `ComplexModal(.dat)` パーサ
- `RespResult(.csv)` パーサ
- `JSON -> BuildingModel(XML)` 変換
- 基準比較 CLI（`scripts/compare.ts`）
- 簡易ブラウザ UI（ローカルファイル読込と変換確認）

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

## 比較スクリプト
```bash
npm run compare -- --type modal --reference reference/modal/test_01_eig.dat --target reference/modal/test_01_eig.dat
npm run compare -- --type complex --reference reference/complex/Test_simple_ceig.dat --target reference/complex/Test_simple_ceig.dat
npm run compare -- --type resp --reference reference/resp/test.csv --target reference/resp/test.csv
```

## ビルド
```bash
npm run build
```
