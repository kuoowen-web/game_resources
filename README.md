# Game Resources

個人理財研究筆記 + 自用的資產追蹤小工具。

---

## 這是什麼？

一個跑在你自己電腦上的網頁小工具，用來：
- 記錄每個時間點的資產狀況（存款、保險、股票、債券等）
- 比較不同時間點的資產變化
- 假設「如果我全部放定存 / 買指數基金」會怎樣，跟實際表現比較
- 看資產趨勢圖表

所有資料都存在你自己電腦上，不會上傳到任何地方。

打開的時候預設用遊戲用語顯示（金幣、鑽石、護盾...），別人看到也不知道是資產管理工具。輸入密碼才會切換成真實模式。

## 怎麼安裝？（只需要做一次）

### 第 1 步：安裝 Python

如果你的電腦還沒有 Python：
1. 到 https://www.python.org/downloads/ 下載最新版
2. 安裝時**務必勾選「Add Python to PATH」**
3. 裝完重開電腦

### 第 2 步：下載這個專案

把整個資料夾放到你電腦上的任意位置，例如 `C:\Users\你的名字\projects\game_resources`。

### 第 3 步：安裝必要套件

1. 打開「終端機」（Terminal）：
   - **Windows**：按 `Win + R`，輸入 `cmd`，按 Enter
   - **Mac**：打開「終端機」app
2. 輸入以下指令（把路徑換成你實際的位置）：

```
cd C:\Users\你的名字\projects\game_resources
pip install -r requirements.txt
```

看到一堆文字跑完沒有紅色錯誤就是成功了。

### 第 4 步：建立個人檔案

在專案資料夾裡：
1. 把 `player_stats.example.md` 複製一份，改名為 `player_stats.md`，填入自己的財務背景資料
2. 把 `insights.example.md` 複製一份，改名為 `insights.md`，用來記錄研究結論

這兩個檔案只存在你電腦上，不會被上傳。

## 怎麼使用？

### 啟動

雙擊專案資料夾裡的 **`start.bat`**。

會跳出一個黑色視窗（那是正常的，不要關掉它）。然後打開瀏覽器，輸入：

```
http://localhost:5000
```

就會看到工具畫面了。

### 基本操作

- **總覽**：選一個時間點的快照，看資產明細
- **比較**：選兩個時間點，看資產怎麼變化。可以加「假設策略」來比較（例如：如果全放 2% 定存會怎樣）
- **趨勢**：看所有時間點的資產變化折線圖
- **現金流**：記錄大筆收入或支出（年收入進帳、繳稅等），讓比較功能能正確區分「新錢進來」跟「投資賺的錢」

### 偽裝模式

打開時預設是遊戲風格（金幣、鑽石...）。在畫面上用鍵盤連續輸入 `werwer` 就會切換成真實模式，再輸入一次切回來。

### 關閉

關掉那個黑色視窗就好了。

## 隱私注意事項

以下檔案包含你的個人財務資料，**絕對不要分享或上傳**：
- `player_stats.md` — 個人財務背景
- `insights.md` — 研究結論
- `discussion-points.md` — 討論中的決策
- `data/cashflows.json` — 收入/支出事件
- `data/snapshots/` 裡面除了 `example.json` 以外的所有檔案

---

## For Developers

以下內容是給想要用 AI 工具（如 Claude Code）繼續開發這個專案的人看的。把這整個 repo 丟給你的 AI agent 就好。

### 技術架構

- **後端**：Python Flask，API server（`server/app.py`）
- **前端**：純 HTML/CSS/JS + Chart.js（`web/` 目錄），無框架
- **資料庫**：JSON 檔案（`data/snapshots/YYYY-MM-DD.json`、`data/cashflows.json`）
- **測試**：pytest（`server/test_app.py`）

### 開發環境安裝

```bash
pip install -r requirements-dev.txt   # Flask + pytest
```

### 跑測試

```bash
cd server
python -m pytest test_app.py -v
```

### 設計文件

- 原始設計：`docs/2026-03-17-asset-tracker-design.md`
- 假設比較功能：`docs/superpowers/specs/2026-03-18-hypothetical-comparison-design.md`
- 實作計畫：`docs/superpowers/plans/` 目錄

### AI 開發流程（Claude Code Skills）

本專案的開發流程使用以下 skills，需透過 [superpowers](https://github.com/anthropics/superpowers) 或自行安裝：

| Skill | 用途 |
|-------|------|
| superpowers:brainstorming | 設計新功能前探索需求 |
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
