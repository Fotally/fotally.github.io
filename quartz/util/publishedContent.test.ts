import assert from "node:assert"
import test, { describe } from "node:test"
import {
  calculatePublishedDomainStatistics,
  countPublishedCharacters,
  startOfTodayInShanghai,
} from "./publishedContent"

describe("published content statistics", () => {
  test("counts rendered Markdown text without frontmatter or markup", () => {
    const source = `---
title: 示例
---
# 标题

你好 **Quartz**。

\`代码\`
`

    assert.strictEqual(countPublishedCharacters(source), 13)
  })

  test("calculates positive and negative daily changes by domain", () => {
    const current = [
      { relativePath: "AI/index.md", source: "领域首页不计数" },
      { relativePath: "AI/Agent/a.md", source: "今天新增内容" },
      { relativePath: "Engineering/a.md", source: "精简" },
    ]
    const startOfDay = [
      { relativePath: "AI/Agent/a.md", source: "内容" },
      { relativePath: "Engineering/a.md", source: "需要精简的内容" },
    ]

    const result = calculatePublishedDomainStatistics(current, startOfDay)

    assert.deepStrictEqual(result.get("AI"), {
      noteCount: 1,
      todayCharacters: 4,
      totalCharacters: 6,
    })
    assert.deepStrictEqual(result.get("Engineering"), {
      noteCount: 1,
      todayCharacters: -5,
      totalCharacters: 2,
    })
  })

  test("uses the Asia/Shanghai calendar day", () => {
    assert.strictEqual(
      startOfTodayInShanghai(new Date("2026-08-28T17:00:00.000Z")),
      "2026-08-29T00:00:00+08:00",
    )
  })
})
