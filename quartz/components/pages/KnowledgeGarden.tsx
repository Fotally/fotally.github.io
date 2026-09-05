import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"
import { FilePath, FullSlug, resolveRelative, slugifyFilePath } from "../../util/path"
import { QuartzPluginData } from "../../plugins/vfile"
import { getPublishedContentSnapshot } from "../../util/publishedContent"

type TopicSummary = {
  name: string
  title: string
  noteCount: number
  slug: FullSlug
}

type DomainSummary = {
  name: string
  title: string
  description?: string
  noteCount: number
  todayCharacters: number
  totalCharacters: number
  slug: FullSlug
  topics: TopicSummary[]
  directNotes: QuartzPluginData[]
}

const normalizePath = (value: string) => value.replaceAll("\\", "/")
const isIndexPage = (relativePath: string) => /(^|\/)index\.md$/i.test(relativePath)

function folderSlug(relativeDirectory: string): FullSlug {
  return slugifyFilePath(`${relativeDirectory}/index.md` as FilePath)
}

function titleForIndex(
  pages: QuartzPluginData[],
  relativeDirectory: string,
  defaultTitle: string,
): string {
  const indexPath = `${relativeDirectory}/index.md`.toLowerCase()
  return (
    pages.find((page) => normalizePath(String(page.relativePath)).toLowerCase() === indexPath)
      ?.frontmatter?.title ?? defaultTitle
  )
}

function descriptionForIndex(
  pages: QuartzPluginData[],
  relativeDirectory: string,
): string | undefined {
  const indexPath = `${relativeDirectory}/index.md`.toLowerCase()
  return pages.find((page) => normalizePath(String(page.relativePath)).toLowerCase() === indexPath)
    ?.description
}

function buildDomains({ allFiles }: QuartzComponentProps): DomainSummary[] {
  const publishedContent = getPublishedContentSnapshot()
  const publishedPaths = [...publishedContent.relativePaths]
  const sourcePaths = new Set(publishedPaths.map((path) => path.toLowerCase()))
  const sourcePages = allFiles.filter((page) => {
    const relativePath = normalizePath(String(page.relativePath ?? ""))
    return relativePath.length > 0 && sourcePaths.has(relativePath.toLowerCase())
  })
  const domainNames = new Set<string>()

  for (const relativePath of publishedPaths) {
    const segments = relativePath.split("/")
    if (segments.length > 1) {
      domainNames.add(segments[0])
    }
  }

  return [...domainNames]
    .sort((left, right) => left.localeCompare(right, "zh-CN"))
    .map((domainName) => {
      const domainPrefix = `${domainName}/`
      const publishedDomainPaths = publishedPaths.filter((path) => path.startsWith(domainPrefix))
      const domainPages = sourcePages.filter((page) =>
        normalizePath(String(page.relativePath)).startsWith(domainPrefix),
      )
      const publishedNotes = publishedDomainPaths.filter((path) => !isIndexPage(path))
      const notes = domainPages.filter((page) => {
        const relativePath = normalizePath(String(page.relativePath))
        return !isIndexPage(relativePath) && sourcePaths.has(relativePath.toLowerCase())
      })
      const topicNames = new Set<string>()

      for (const path of publishedDomainPaths) {
        const segments = path.split("/")
        if (segments.length > 2) {
          topicNames.add(segments[1])
        }
      }

      const topics = [...topicNames]
        .sort((left, right) => left.localeCompare(right, "zh-CN"))
        .map((topicName) => {
          const relativeDirectory = `${domainName}/${topicName}`
          const topicPrefix = `${relativeDirectory}/`
          const topicNoteCount = publishedNotes.filter((path) =>
            path.startsWith(topicPrefix),
          ).length

          return {
            name: topicName,
            title: titleForIndex(sourcePages, relativeDirectory, topicName),
            noteCount: topicNoteCount,
            slug: folderSlug(relativeDirectory),
          }
        })

      const directNotes = notes.filter(
        (page) => normalizePath(String(page.relativePath)).split("/").length === 2,
      )
      const statistics = publishedContent.domainStatistics.get(domainName) ?? {
        noteCount: 0,
        todayCharacters: 0,
        totalCharacters: 0,
      }

      return {
        name: domainName,
        title: titleForIndex(sourcePages, domainName, domainName),
        description: descriptionForIndex(sourcePages, domainName),
        noteCount: statistics.noteCount,
        todayCharacters: statistics.todayCharacters,
        totalCharacters: statistics.totalCharacters,
        slug: folderSlug(domainName),
        topics,
        directNotes,
      }
    })
}

function PetalIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M23.6 23.8C9.6 21.1 8 9.6 13.1 5.8c5.4-4 13.8 2 11 17.4" />
      <path d="M24.1 23.4C26.3 9.3 37.6 7.2 41.6 12c4.2 5.1-1.4 13.8-17.2 11.8" />
      <path d="M24.4 24.1c13.8 2.7 15.4 14.2 10.3 18-5.4 4-13.8-2-11-17.4" />
      <path d="M23.8 24.4C21.7 38.5 10.3 40.6 6.4 35.8c-4.2-5.1 1.4-13.8 17.2-11.8" />
      <circle cx="24" cy="24" r="3.2" />
    </svg>
  )
}

const KnowledgeGarden: QuartzComponent = (props: QuartzComponentProps) => {
  const { fileData } = props
  const domains = buildDomains(props)
  const numberFormatter = new Intl.NumberFormat("zh-CN")

  fileData.toc = [
    { depth: 0, slug: "knowledge-garden", text: "Aya's Knowledge Garden" },
    ...domains.map((domain) => ({
      depth: 1,
      slug: `domain-${slugifyFilePath(`${domain.name}.md` as FilePath).replace(/\/index$/, "")}`,
      text: domain.title,
    })),
    { depth: 1, slug: "garden-notes", text: "Notes" },
  ]

  return (
    <article class="knowledge-garden-home">
      <section class="garden-hero" id="knowledge-garden">
        <div class="hero-copy">
          <p class="garden-eyebrow">记录 · 思考 · 成长</p>
          <h1>Aya’s Knowledge Garden</h1>
          <h2>
            欢迎来到我的知识花园 <span aria-hidden="true">🌸</span>
          </h2>
          <p>这里汇聚了我在技术学习与思考过程中的笔记与总结。</p>
          <p>愿这些记录，帮助我看见成长的轨迹，也能为你带来一丝启发与温暖。</p>
        </div>
        <div class="hero-note" aria-label="知识花园理念">
          <span class="paperclip" aria-hidden="true" />
          <span>持续学习</span>
          <span>持续记录</span>
          <span>
            持续成长 <b aria-hidden="true">♡</b>
          </span>
        </div>
        <div class="hero-petals" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      </section>

      <div class="section-heading">
        <PetalIcon />
        <h2>知识领域</h2>
        <span />
      </div>

      <div class="domain-list">
        {domains.map((domain, index) => {
          const domainHref = resolveRelative(fileData.slug!, domain.slug)
          return (
            <section
              class={`domain-card domain-card-${(index % 3) + 1}`}
              id={`domain-${slugifyFilePath(`${domain.name}.md` as FilePath).replace(/\/index$/, "")}`}
            >
              <div class="domain-header">
                <div class="domain-title-wrap">
                  <PetalIcon />
                  <div>
                    <h3>{domain.title}</h3>
                    <p>{domain.description ?? `${domain.topics.length} 个主题`}</p>
                  </div>
                </div>
                <a
                  class="domain-arrow internal"
                  href={domainHref}
                  aria-label={`进入${domain.title}`}
                >
                  →
                </a>
              </div>

              <div class="domain-statistics" aria-label={`${domain.title}发布统计`}>
                <span>{domain.noteCount} 篇笔记</span>
                <span
                  class={
                    domain.todayCharacters > 0
                      ? "is-positive"
                      : domain.todayCharacters < 0
                        ? "is-negative"
                        : undefined
                  }
                >
                  今日 {domain.todayCharacters > 0 ? "+" : ""}
                  {numberFormatter.format(domain.todayCharacters)} 字
                </span>
                <span>共 {numberFormatter.format(domain.totalCharacters)} 字</span>
              </div>

              <div class="topic-grid">
                {domain.topics.map((topic) => (
                  <a class="topic-card internal" href={resolveRelative(fileData.slug!, topic.slug)}>
                    <strong>{topic.title}</strong>
                    <span>笔记 {topic.noteCount}</span>
                  </a>
                ))}
                {domain.directNotes.map((note) => (
                  <a class="topic-card internal" href={resolveRelative(fileData.slug!, note.slug!)}>
                    <strong>{note.frontmatter?.title ?? note.slug}</strong>
                    <span>笔记</span>
                  </a>
                ))}
              </div>
            </section>
          )
        })}
      </div>

      <section class="garden-note-card" id="garden-notes">
        <div>
          <span class="quote-mark" aria-hidden="true">
            “
          </span>
          <div>
            <h2>Notes</h2>
            <p>记录学习过程中的思考与感悟。</p>
            <blockquote>持续记录学习过程。</blockquote>
          </div>
        </div>
        <svg class="book-illustration" viewBox="0 0 220 130" aria-hidden="true">
          <path class="book-shadow" d="M25 105c42-10 131-9 174 0-30 15-139 17-174 0Z" />
          <path class="book-page" d="M35 86c35-28 63-32 79-19v43c-24-10-51-3-79 1Z" />
          <path class="book-page" d="M114 67c26-17 57-12 78 6l-13 39c-26-11-47-10-65-2Z" />
          <path
            class="book-line"
            d="M48 85c19-9 36-12 53-8M46 94c20-8 38-10 55-6M128 78c16-4 32-1 47 8M125 89c17-3 31 0 44 7"
          />
          <path class="book-pen" d="m142 104 43-45 9 8-45 43Z" />
          <circle class="book-flower" cx="184" cy="35" r="6" />
          <circle class="book-flower" cx="196" cy="28" r="5" />
          <path class="book-stem" d="M180 76c4-18 5-31 4-42m0 22 13-24" />
        </svg>
      </section>
    </article>
  )
}

export default (() => KnowledgeGarden) satisfies QuartzComponentConstructor
