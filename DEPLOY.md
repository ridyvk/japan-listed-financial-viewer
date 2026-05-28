# 独立した公開リンクにする方法

このアプリは財務データをサーバー側で取得するため、PCに依存しないリンクにするには Node.js を動かせるホスティングへデプロイします。

## Renderで公開する

1. GitHubにこのフォルダの内容をリポジトリとしてアップロードします。
2. Renderで `New` → `Blueprint` を選びます。
3. GitHubリポジトリを選ぶと、`render.yaml` が読み込まれます。
4. 作成すると `https://japan-listed-financial-viewer-....onrender.com` のような独立リンクが発行されます。

手動でWeb Serviceを作る場合は次の設定にします。

- Runtime: `Node`
- Build Command: 空欄
- Start Command: `node server.js`
- Health Check Path: `/`
- Environment: `NODE_VERSION=20`

## ホーム画面追加

公開URLはHTTPSなので、ChromeやSafariからホーム画面に追加できます。

## 注意

無料プランではアクセスが少ない時間にスリープすることがあります。最初のアクセスだけ起動に少し時間がかかる場合があります。
