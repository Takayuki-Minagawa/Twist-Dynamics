# Reference Data

このフォルダには C# 実装の基準データを配置します。

- `building-model/Test_simple.json` (R / TMDあり)
- `building-model/Test_simple.xml` (XML読込検証用、内容は Test_simple.json 相当)
- `building-model/R_no_tmd.json` (R / TMDなし)
- `building-model/DX_with_tmd.json` (DX / TMDあり / DXパネルあり)
- `building-model/Boundary_minimal.json` (境界最小ケース)
- `modal/test_01_eig.dat`
- `complex/Test_simple_ceig.dat`
- `resp/test.csv`

用途:
- パーサ回帰テスト
- 既存結果との比較検証

ケースの期待値:
- `R_no_tmd.json`: `sType=R`, `massDampers=0`
- `DX_with_tmd.json`: `sType=DX`, `massDampers>=1`, `dxPanels>=1`
- `Boundary_minimal.json`: `massN=1` の最小成立ケース
