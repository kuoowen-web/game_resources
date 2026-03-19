# Game Resources

研究理財與金錢相關的事情，製作自用的理財小工具。

## 工具：Game Resource Tracker

本地 webapp，用來記錄和分析個人資產快照。

**功能：** 資產總覽、多幣別切換（原幣/TWD/USD）、即時市值計算機、Snapshot 比較（含類別小計、匯率影響拆解）、假設策略比較（定存/指數/混合，Modified Dietz 績效歸因）、現金流事件管理、趨勢圖表、inline 編輯

**隱私保護：** 預設以遊戲用語顯示（金幣/鑽石/護盾...），隱藏真實資產名稱與編輯功能。在總覽頁面鍵盤輸入密碼即可切換。

**技術：** Flask + 純 HTML/CSS/JS + Chart.js，JSON 檔案當資料庫

**啟動：** 雙擊 `start.bat`，或手動：

```bash
venv\Scripts\activate
cd server
python app.py
```

開啟 http://localhost:5000

**設計文件：** `docs/2026-03-17-asset-tracker-design.md`

## 開始使用

1. 複製 `player_stats.example.md` 為 `player_stats.md`，填入自己的財務資料
2. 複製 `insights.example.md` 為 `insights.md`，記錄研究結論
3. 執行 `pip install -r requirements.txt` 安裝依賴（首次使用）

這兩個檔案已加入 `.gitignore`，不會被 commit。

## 隱私規則

- `player_stats.md` 和 `insights.md` 包含個人財務資料，不可 commit
- `discussion-points.md` 包含討論中的財務決策，不可 commit
- `data/cashflows.json` 包含現金流事件（收入、繳稅等），不可 commit
- `insights.md` 中不得包含可識別個人的財務數字，只記錄通用的研究結論

## 所需 Skills

本專案的 Claude Code 工作流程使用以下 skills，需透過 [superpowers](https://github.com/anthropics/superpowers) 或自行安裝：

| Skill | 用途 |
|-------|------|
| superpowers:brainstorming | 設計新工具前探索需求 |
| superpowers:writing-plans | 拆解實作計畫 |
| superpowers:executing-plans | 按計畫執行 |
| superpowers:test-driven-development | 先寫測試再寫實作 |
| superpowers:systematic-debugging | 系統化除錯 |
| superpowers:verification-before-completion | 完成前驗證 |
| simplify | 檢查程式碼品質 |
| plan-discuss | 技術方案討論 |
| daily-recap | 回顧工作進度 |
| cleanup-docs | 清除暫存檔 |
| skill-from-masters | 探討理財方法論 |
| update-docs | 掃描並更新專案文件 |
