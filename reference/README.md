# Reference Data

このフォルダには C# 実装の基準データを配置します。

- `building-model/Test_simple.json` (基本ケース / TMDあり)
- `building-model/Test_simple.xml` (XML読込検証用、内容は Test_simple.json 相当)
- `building-model/no_tmd.json` (TMDなし・新形式)
- `building-model/with_tmd.json` (TMDあり・新形式)
- `building-model/R_no_tmd.json` (旧 `sType` 互換確認用)
- `building-model/DX_with_tmd.json` (旧 `sType` / `dxPanels` 自動移行確認用)
- `building-model/legacy_dx_panel.xml` (旧 XML の `sType` / `dxPanels` 自動移行確認用)
- `building-model/Boundary_minimal.json` (境界最小ケース)
- `modal/test_01_eig.dat`
- `complex/Test_simple_ceig.dat`
- `resp/test.csv`

用途:
- パーサ回帰テスト
- 既存結果との比較検証

新形式の書出しは `BuildingModel.version = 1` を維持しつつ、`sType` / `dxPanels` を含めません。旧 `dxPanels` の変換位置は各パネル頂点の算術平均で、X パネルは `kx`、Y パネルは `ky` を持つ `columns` として取り込みます。

ケースの期待値:
- `no_tmd.json`: `massDampers=0`
- `with_tmd.json`: `massDampers>=1`、旧 DXPanel 相当の剛性は方向別 `columns` へ変換済み
- `R_no_tmd.json`: 旧 `sType` を警告付きで無視
- `DX_with_tmd.json`: 旧 `sType` を無視し、`dxPanels>=1` を等価 `columns` へ警告付きで変換
- `legacy_dx_panel.xml`: XML でも同じ旧フィールド移行規則を確認
- `Boundary_minimal.json`: `massN=1` の最小成立ケース
