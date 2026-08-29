import { spawnSync } from "node:child_process"
import { unified } from "unified"
import remarkParse from "remark-parse"
import { visit } from "unist-util-visit"

export type PublishedMarkdownSource = {
  relativePath: string
  source: string
}

export type PublishedDomainStatistics = {
  noteCount: number
  todayCharacters: number
  totalCharacters: number
}

export type PublishedContentSnapshot = {
  head: string
  relativePaths: ReadonlySet<string>
  domainStatistics: ReadonlyMap<string, PublishedDomainStatistics>
}

type GitTreeEntry = {
  objectId: string
  relativePath: string
}

let cachedSnapshot: PublishedContentSnapshot | undefined

const normalizePath = (value: string) => value.replaceAll("\\", "/")
const isIndexPage = (relativePath: string) => /(^|\/)index\.md$/i.test(relativePath)

function runGit(args: string[], input?: string): Buffer {
  const result = spawnSync("git", args, {
    cwd: process.cwd(),
    input,
    encoding: null,
    windowsHide: true,
  })

  if (result.error) {
    throw new Error(`无法读取 Git 发布内容：${result.error.message}`)
  }

  if (result.status !== 0) {
    const message = result.stderr?.toString("utf8").trim() || `git ${args.join(" ")} 执行失败`
    throw new Error(`无法读取 Git 发布内容：${message}`)
  }

  return result.stdout
}

function runGitText(args: string[]): string {
  return runGit(args).toString("utf8").trim()
}

function listMarkdownEntries(commit: string): GitTreeEntry[] {
  const output = runGit(["ls-tree", "-r", "-z", commit, "--", "content"])

  return output
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map((entry) => {
      const separator = entry.indexOf("\t")
      const metadata = entry.slice(0, separator).split(" ")
      const repositoryPath = normalizePath(entry.slice(separator + 1))

      return {
        objectId: metadata[2],
        relativePath: repositoryPath.replace(/^content\//i, ""),
      }
    })
    .filter((entry) => entry.relativePath.toLowerCase().endsWith(".md"))
}

function readMarkdownSources(commit: string | undefined): PublishedMarkdownSource[] {
  if (!commit) return []

  const entries = listMarkdownEntries(commit)
  if (entries.length === 0) return []

  const output = runGit(
    ["cat-file", "--batch"],
    `${entries.map((entry) => entry.objectId).join("\n")}\n`,
  )
  const sources: PublishedMarkdownSource[] = []
  let offset = 0

  for (const entry of entries) {
    const lineEnd = output.indexOf(10, offset)
    if (lineEnd < 0) throw new Error("无法读取 Git 发布内容：对象头不完整")

    const header = output.subarray(offset, lineEnd).toString("utf8").split(" ")
    const byteLength = Number(header[2])
    if (header[1] !== "blob" || !Number.isFinite(byteLength)) {
      throw new Error(`无法读取 Git 发布内容：${entry.relativePath} 不是有效的文本对象`)
    }

    const contentStart = lineEnd + 1
    const contentEnd = contentStart + byteLength
    sources.push({
      relativePath: entry.relativePath,
      source: output.subarray(contentStart, contentEnd).toString("utf8"),
    })
    offset = contentEnd + 1
  }

  return sources
}

function stripFrontmatter(source: string): string {
  return source.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "")
}

export function countPublishedCharacters(source: string): number {
  const tree = unified().use(remarkParse).parse(stripFrontmatter(source))
  let text = ""

  visit(tree, (node) => {
    if (
      (node.type === "text" || node.type === "inlineCode" || node.type === "code") &&
      "value" in node &&
      typeof node.value === "string"
    ) {
      text += node.value
    }
  })

  return Array.from(text.replace(/\s/gu, "")).length
}

function totalsByDomain(files: PublishedMarkdownSource[]): Map<string, PublishedDomainStatistics> {
  const result = new Map<string, PublishedDomainStatistics>()

  for (const file of files) {
    const relativePath = normalizePath(file.relativePath)
    const segments = relativePath.split("/")
    if (segments.length < 2 || isIndexPage(relativePath)) continue

    const domain = segments[0]
    const statistics = result.get(domain) ?? {
      noteCount: 0,
      todayCharacters: 0,
      totalCharacters: 0,
    }
    statistics.noteCount += 1
    statistics.totalCharacters += countPublishedCharacters(file.source)
    result.set(domain, statistics)
  }

  return result
}

export function calculatePublishedDomainStatistics(
  currentFiles: PublishedMarkdownSource[],
  startOfDayFiles: PublishedMarkdownSource[],
): Map<string, PublishedDomainStatistics> {
  const current = totalsByDomain(currentFiles)
  const startOfDay = totalsByDomain(startOfDayFiles)
  const domains = new Set([...current.keys(), ...startOfDay.keys()])

  return new Map(
    [...domains].map((domain) => {
      const currentStatistics = current.get(domain) ?? {
        noteCount: 0,
        todayCharacters: 0,
        totalCharacters: 0,
      }
      const startOfDayTotal = startOfDay.get(domain)?.totalCharacters ?? 0

      return [
        domain,
        {
          ...currentStatistics,
          todayCharacters: currentStatistics.totalCharacters - startOfDayTotal,
        },
      ]
    }),
  )
}

export function startOfTodayInShanghai(now = new Date()): string {
  const shanghaiTime = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  const year = shanghaiTime.getUTCFullYear()
  const month = String(shanghaiTime.getUTCMonth() + 1).padStart(2, "0")
  const day = String(shanghaiTime.getUTCDate()).padStart(2, "0")
  return `${year}-${month}-${day}T00:00:00+08:00`
}

export function getPublishedContentSnapshot(): PublishedContentSnapshot {
  const head = runGitText(["rev-parse", "HEAD"])
  if (cachedSnapshot?.head === head) return cachedSnapshot

  const currentFiles = readMarkdownSources(head)
  const startOfDayCommit = runGitText([
    "rev-list",
    "-1",
    `--before=${startOfTodayInShanghai()}`,
    head,
  ])
  const startOfDayFiles = readMarkdownSources(startOfDayCommit || undefined)

  cachedSnapshot = {
    head,
    relativePaths: new Set(currentFiles.map((file) => normalizePath(file.relativePath))),
    domainStatistics: calculatePublishedDomainStatistics(currentFiles, startOfDayFiles),
  }
  return cachedSnapshot
}
