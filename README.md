# Game Resources

研究理財與金錢相關的事情，製作自用的理財小工具。

## 開始使用

1. 複製 `player_stats.example.md` 為 `player_stats.md`，填入自己的財務資料
2. 複製 `insights.example.md` 為 `insights.md`，記錄研究結論

這兩個檔案已加入 `.gitignore`，不會被 commit。

## 隱私規則

- `player_stats.md` 和 `insights.md` 包含個人財務資料，不可 commit
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
