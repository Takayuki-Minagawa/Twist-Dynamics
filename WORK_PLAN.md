# 作業計画: 構造タイプ削除・入力リファクタリング・3D表示・機能追加

作成日: 2026-07-17
対象バージョン: Ver.1.0.2 → Ver.1.1.0(構造タイプ削除・入力改善)→ Ver.1.2.0(3D表示)

---

## 1. 背景と現状整理

本ツールは「くし団子系(串団子型)モデル」による低層鉄骨造の捩れ振動評価ツール。
各層 3 自由度(並進 X / 並進 Y / ねじれ θZ)の弾性解析で、以下を実装済み:

- 実固有値解析(`src/core/analysis/modal.ts`)
- 複素固有値解析(`src/core/analysis/complex.ts`)
- 時刻歴応答解析 Newmark-β(`src/core/analysis/resp.ts`)
- 剛性・減衰マトリクス組立(`src/core/analysis/matrixAssembly.ts`)

### 着手時点のコード調査結果

| 項目 | 現状 |
| --- | --- |
| 構造タイプ `sType ("R" \| "DX")` | `structInfo` に保持されているが、**解析コアでは未使用**。I/O(JSON/XML)・バリデータ・入力フォームの選択肢・サマリ表示にのみ登場 |
| `DXPanel`(DX躯体用パネル要素) | `matrixAssembly.ts` で図心位置の方向別剛性として集計。DX躯体専用の要素であり、汎用の「方向+座標+剛性」入力(columns / walls)で代替可能 |
| 剛性入力 | `RColumn`(座標 + kx, ky)、`Wall`(2点座標 + 壁特性DB参照)、`BraceDamper`(座標 + 方向 + k, c)ですでに「方向と座標で層剛性を決める」構成になっている |
| 入力フォーム | CSV 形式のテキストエリア(1行=1要素)。書式をエラーメッセージで覚える必要があり、初見で分かりにくい |
| 3D表示 | **Web 版には未実装**(C# 版の機能)。ただし表示に必要なデータ(floors 外形、columns、walls の `isVisible`、braceDampers の width/height、massDampers)はモデルに保持済み |
| 非構造壁・外壁 | `WallCharaDB.isEigenEffectK = false` で「剛性に効かせず表示だけする壁」を表現可能。この仕組みは維持する |

---

## 2. 方針

1. **構造タイプ(R / DX)の概念を削除**する。躯体タイプに依存しない「層剛性を方向と座標で入力する汎用モデル」に一本化。
2. 入力は「1行1要素の表形式」に整理し、単位・意味をUI上に明示。テキストエリア方式は上級者向けに残してもよいが、既定は表エディタ。
3. 3D表示(three.js)を新規実装し、柱・ブレースダンパー・マスダンパー・非構造壁(外壁含む)を描画。固有モード・時刻歴応答でアニメーション。
4. 既存ファイル互換は「読込は寛容、書出は新形式」。解析結果の数値互換は accuracy-check で回帰確認。

### 採用判断（Ver.1.2.0）

- DXPanel はコアモデルから削除する。旧 `dxPanels` は無視して失うのではなく、パネル頂点の算術平均位置に同じ方向別剛性を持つ `columns` へ自動変換する。
- 旧 `sType` は JSON / XML とも警告付きで無視する。
- `BuildingModel.version` は互換性を優先して `1` のままとし、書出しは `sType` / `dxPanels` を含まない正規化形式に限定する。
- 3D 表示は three.js を採用し、解析コアから分離した `src/viz/` に実装する。
- Phase 4 は優先度 1（偏心率・比剛性）と 2（応答グラフ）までを Ver.1.2.0 の対象とし、3〜7 は次期候補として未実装のまま残す。
- 「剛性率」は法令上の `Rs` と誤解されないよう、`(K/W) / 全層平均(K/W)` の**単純な相対比剛性（非法規指標）**として実装・表示する。

---

## 3. Phase 1: 構造タイプ(R / DX)の削除

**目標: モデルから躯体タイプ概念をなくす。解析結果は不変(sType は解析未使用のため)。**

### 3.1 型・I/O

- [x] `src/core/types.ts`: `StructType` 型と `StructInfo.sType` を削除
- [x] `src/io/buildingModel/validator.ts`: `sType` 検証を削除。**旧ファイル互換のため、JSON に `sType` があっても無視して読み込む**(エラーにしない)
- [x] `src/io/buildingModel/xml.ts`: `sType` の parse / serialize を削除(読込時は同様に無視)
- [x] `src/io/buildingModel/serializer.ts`: `sType` を出力しない
- [x] `src/io/buildingModel/summary.ts`, `types.ts`: サマリから `structType` を削除
- [x] BuildingModel の `version` は `1` のまま維持し、旧 `sType` は任意・無視とする方針を採用

### 3.2 DXPanel の削除（採用済み）

DXPanel は DX 躯体専用の要素。「方向+座標+剛性」は columns(kx, ky)で同等に表現できるため、あわせて削除を推奨。

- [x] `src/core/types.ts`: `DXPanel` 型と `BuildingModel.dxPanels` を削除
- [x] `src/core/analysis/matrixAssembly.ts`: dxPanels の集計ループを削除
- [x] `src/io/buildingModel/*`(parser / xml / normalize / serializer / summary): コアモデルと書出しから dxPanels 対応を削除し、旧入力には構造化した移行警告を付与
- [x] 既存 dxPanels 入りファイルの移行: 読込時に同じ層剛性寄与を持つ方向別 `columns` へ自動変換

> 採用結果: `reference/building-model/DX_with_tmd.json` などの旧データも継続して読み込み、等価な `columns` へ自動変換する。

### 3.3 UI・フォーム

- [x] `src/app/view.ts`: `editorStructType`(select)と対応ラベルを削除
- [x] `src/app/controller.ts`: `structType` の読み書きを削除
- [x] `src/app/modelEditorState.ts`: `ModelEditorFormData.structType` / `dxPanels` を削除
- [x] `src/app/i18n.ts`: 関連文言を削除し、旧形式移行の案内を追加
- [x] 簡易マニュアルの記述更新

### 3.4 テスト・基準データ

- [x] `tests/ioFixturesTable.test.ts` / `buildingModelXml.test.ts` / `modelEditorState.test.ts` / `buildingModelValidation.test.ts` の sType / dxPanels 期待値を更新
- [x] 「sType 付き旧 JSON / XML を読んでもエラーにならない」互換テストを追加
- [x] `reference/building-model/` に `no_tmd.json` / `with_tmd.json` を追加し、旧形式を互換テスト用 fixture として保持
- [x] `npm run check:accuracy` を実行して回帰を確認（既存の複素固有値 CASE-02 の許容外差分は本変更前から継続し、レポートに記録）

---

## 4. Phase 2: 入力のわかりやすさリファクタリング

**目標: 「各階の剛性は方向と座標で設定する」という考え方がそのまま画面になるようにする。**

### 4.1 入力モデルの整理(概念の再命名)

現在の要素は維持しつつ、UI 上の見せ方を統一する:

| UI 上のグループ | 要素 | 入力項目 |
| --- | --- | --- |
| 建物概要 | structInfo | 階数、階ごとの「レベル z / 重量 W / 回転慣性重量 / 重心 (x, y)」 |
| 剛性要素 | columns | 階、位置 (x, y)、kx、ky |
| 壁(構造壁・非構造壁・外壁) | wallCharaDB + walls | 壁特性(名前、k、c、剛性を固有値に効かせるか、単位長さ特性か)+ 配置(階、始点・終点、表示可否) |
| ダンパー | braceDampers / massDampers | 現行どおり |
| 表示用形状 | floors(外形ポリゴン) | 階、頂点列 |

### 4.2 フォームの改善(本命)

- [x] **階別テーブル入力**: zLevel / weight / wMoment / wCenter を「1階=1行」の表に統合
- [x] **要素別テーブルエディタ**: columns / walls / dampers を行追加・削除できる表形式にし、列ヘッダへ項目名と単位を明示
- [x] **壁特性 DB はプルダウン参照**: walls の name 列を wallCharaDB からの選択式にし、参照切れを入力時点で防ぐ
- [x] **インラインバリデーション**: 行・セル単位でエラー表示
- [x] **2D 平面プレビュー**: 階を選び、床外形・柱・壁・ダンパー位置・重心・剛心を即時描画
- [x] **剛心・偏心のライブ表示**: 入力変更のたびに層ごとの Kx, Ky、剛心座標、偏心率、相対比剛性を集計表示
- [x] CSV / Excel TSV テキスト入力を各表の「一括貼付けモード」として実装
- [x] i18n(日英)・マニュアル更新

### 4.3 コード整理

- [x] `modelEditorSchema.ts` の要素別テーブル定義（列名・型・単位・必須）をフォーム生成・検証・シリアライズで共有
- [x] `view.ts` の要素取得を宣言的な一覧から構築

---

## 5. Phase 3: 3D 表示(新規実装)

**目標: C# 版にあった 3D 表示を Web で再現。モデル確認+結果アニメーション。**

### 5.1 技術選定

- [x] `three.js` を dependencies に追加(WebGL、ライセンス MIT、`THIRD_PARTY_LICENSES.md` 更新)
- [x] 描画モジュールは `src/viz/` に分離し、解析コア(`src/core/`)への依存は一方向に保つ

### 5.2 静的モデル表示

- [x] 床外形(floors)を zLevel の高さに枠線/半透明面で表示
- [x] 柱(columns): 下階床〜当該床を結ぶ部材として表示
- [x] 壁(walls): `isVisible` に従い表示し、`isEigenEffectK = false` の非構造壁・外壁は色/透明度で区別
- [x] ブレースダンパー(braceDampers): width / height / isLightPos を使って X 型ブレース表示
- [x] マスダンパー(massDampers): 設置階に球+ばね記号で表示
- [x] 重心(●)・剛心(○)マーカーを層ごとに表示
- [x] カメラ操作(回転・パン・ズーム)、階の表示 ON/OFF、要素種別の表示 ON/OFF

### 5.3 結果アニメーション

- [x] **固有モードアニメ**: 選択モードの固有ベクトル(DX, DY, RZ)で各層を剛体変位+回転させ正弦アニメーション。複素モードは振幅・位相で再生
- [x] **時刻歴応答アニメ**: RespResult の変位時刻歴で再生(再生/停止/速度/シーク)。平面回転の強調表示にも対応
- [ ] 応答中の層間変形角・ねじれ角の色分け表示(任意)

### 5.4 テスト

- [x] 「モデル→3D ジオメトリ変換」と結果補間を純関数化し、ユニットテスト対象にする（描画はブラウザ目視確認）

---

## 6. Phase 4: 追加機能の提案(優先度順)

1. [x] **偏心率・相対比剛性の自動計算表示**(優先度: 高)
   層ごとの剛心、偏心距離 ex/ey、弾力半径、偏心率 Re と、非法規の単純な相対比剛性を計算し、表表示・CSV 出力。
2. [x] **応答結果のグラフ表示**(優先度: 高)
   屋上変位時刻歴と、層ごとの最大変位・層間変形角・ねじれ角・加速度の高さ方向分布を表示。
3. [ ] **地震波入力の UI 整備**(優先度: 中)
   波形 CSV の読込+波形プレビュー、振幅倍率・入力方向(X/Y/斜め入力角度)の指定、簡易的な正弦波・ホワイトノイズ生成。
4. [ ] **Rayleigh 減衰の設定 UI**(優先度: 中)
   現在 `defaultDampingRatio` 等がコード/CLI 寄り。基準振動数 2 点と減衰定数を画面から指定可能に。
5. [ ] **伝達関数(周波数応答)表示**(優先度: 中)
   調和外力に対する定常応答をスイープ計算し、頂部応答倍率を周波数軸でプロット。TMD(マスダンパー)チューニング効果の確認に有効。
6. [ ] **モデル比較モード**(優先度: 低)
   2 つの BuildingModel(例: ダンパー有無)の固有値・最大応答を並列表示。`compare.ts` の資産を UI へ展開。
7. [ ] **Web Worker 化**(優先度: 低)
   時刻歴解析をワーカーで実行し UI フリーズを防止(モデル規模が小さいため現状は問題になりにくい)。

---

## 7. 互換性・品質ゲート

- 旧ファイル読込: `sType` / `dxPanels` を含む JSON / XML は**警告付きで読込可能**とする(データを失う場合はユーザーに通知)
- 各 Phase 完了時に必ず実行:
  - `npm run test`(全ユニットテスト)
  - `npm run check:accuracy`(C# 基準との数値一致確認)
  - `npm run check:encoding`
- バージョン運用: Phase 1+2 完了で `Ver.1.1.0`、Phase 3 完了で `Ver.1.2.0`。README・簡易マニュアル・`src/app/version.ts` を同期
- ブランチ運用: 従来どおり `feature/dev-VerXYZ` → main へマージ

---

## 8. 作業順序と目安

| 順序 | 内容 | 規模感 |
| --- | --- | --- |
| 1 | Phase 1: sType / DXPanel 削除+互換読込+テスト更新 | 小(1〜2 日) |
| 2 | Phase 2-A: 階別テーブル+要素別テーブルエディタ | 中(3〜5 日) |
| 3 | Phase 2-B: 2D 平面プレビュー+剛心・偏心ライブ表示 | 中(2〜3 日) |
| 4 | Phase 3: three.js 3D 表示(静的→モードアニメ→時刻歴アニメ) | 大(5〜8 日) |
| 5 | Phase 4: 追加機能(1, 2 を優先着手) | 機能単位で随時 |

### 着手前の確認事項への採用結果

1. **採用**: DXPanel は削除し、旧データは等価 `columns` へ自動変換する。
2. **採用**: 3D 表示に three.js を使用する。
3. **採用**: 旧 `sType` は警告付きで無視して読み込む。
4. **採用**: Phase 4 は提案順の 1・2 を実装し、3〜7 は未実装の次期候補とする。
