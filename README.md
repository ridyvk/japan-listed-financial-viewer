# 日本上場企業 財務指標ビューア

日本の上場企業を名前順に探し、最新の株価・財務指標を確認できるWebアプリです。ROA、ROIC、PEGレシオ、ネットキャッシュ比率、FCF利回り、バリュエーション、収益性、財務安全性、キャッシュフローなどを一覧できます。

## 起動

```bash
npm start
```

既定では `http://localhost:4180` で起動します。すでにポートが使われている場合は、次の空きポートへ自動で移動します。

## データソース

- 企業一覧: JPX Market Explorer
- 株価・チャート: Yahoo Finance
- 指標補完: Yahoo!ファイナンス / Yahoo Finance fundamentals-timeseries / EDINET DB

取得元の仕様変更やレート制限により、一部指標が未取得になる場合があります。投資判断ではなく確認用ビューアとして利用してください。

## デプロイ

Renderにデプロイする場合は `render.yaml` を使います。RuntimeはNode、Start Commandは `node server.js` です。
