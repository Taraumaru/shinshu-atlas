# 信州アトラス — GitHub Pages公開版

長野県77市町村のランドマーク・市町村境界・衆議院選挙区・県議会選挙区を表示する、HTML/CSS/JavaScript製の静的Web地図です。スマホのブラウザに対応します。

## 公開手順（GitHub Pages）

1. https://github.com/new を開いて新しいリポジトリを作成します。
2. **Repository name** は `shinshu-atlas`、**Visibility** は `Public` にします。GitHub Freeの場合は公開リポジトリが必要です。
3. リポジトリの `Add file` → `Upload files` から、この配布物の**ZIPを展開した中身すべて**をリポジトリ直下にアップロードします。ZIPファイルそのものや `shinshu-atlas-pages` フォルダごとではなく、`index.html` が一番上になる配置にしてください。
4. `Commit changes` を押します。
5. `Settings` → `Pages` → `Build and deployment` → `Source: Deploy from a branch` → `Branch: main`、`/(root)` → `Save` を選択します。
6. GitHubのデプロイが完了すると `https://<GitHubユーザー名>.github.io/shinshu-atlas/` で公開されます。GitHub Pagesの `Visit site` で公開状況を確認できます。

現在の接続済みGitHubアカウントのユーザー名を使う場合、公開URLの形式は `https://Taraumaru.github.io/shinshu-atlas/` です（リポジトリの作成・公開が完了するまではアクセスできません）。

**注意：GitHub Pagesの公開は、HTMLだけでなくプログラムのソースコードも公開します。** 個人情報・秘密鍵・APIキーは含めないでください。

## スマートフォンからの利用

公開URLをChromeまたはSafariで開きます。Android版Chromeならメニューから「ホーム画面に追加」または「アプリをインストール」、iPhoneのSafariなら「共有」→「ホーム画面に追加」でショートカットを作成できます。地図タイルと施設取得にはインターネット接続が必要です。**オフライン地図ではありません。**

## 地図の利用

- メニューからコンビニ・ガソリンスタンド・道の駅・学校など27カテゴリを選択し、ズーム10以上で施設データを取得します。
- 「区域を重ねる」で77市町村、衆議院5区、県議会23区を選びます。
- 地図上の地点をタップして区域情報を確認します。
- CSVやGeoJSONで取得済み施設を端末へ保存できます。

**施設情報は完全網羅ではありません。** OpenStreetMap / Overpass APIに登録された施設のみ取得し、各閲覧端末に蓄積します。利用者の端末間で自動同期はしません。通信の失敗、データ欠落、境界データの改定に注意してください。

## データ・利用許諾

- 施設：© OpenStreetMap contributors（ODbL） https://www.openstreetmap.org/copyright
- 背景地図：OpenStreetMapまたは国土地理院（出典表記あり）
- 市町村・選挙区境界： https://github.com/kyodo-official/japan-choropleth
- 県議会選挙区：長野県議会公式の区割りをもとに表示
- コード：MITライセンス（同梱LICENSE）
- 地図はCDN・地図タイル・OSM Overpass等の外部サービスに直接アクセスします。サービス側の利用規約やレート制限が適用されます。

## 構成

- `index.html`: サイトの入口
- `app.js`, `style.css`: アプリ本体
- `manifest.webmanifest`, `icons/`: スマホのホーム画面追加用
- `.nojekyll`: GitHub Pages用

ビルド不要です。`index.html` などを `main` ブランチのリポジトリ直下に置くだけで公開できます。