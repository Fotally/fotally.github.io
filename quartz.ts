import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"
import { KnowledgeGardenPage } from "./quartz/plugins/pageTypes/knowledgeGarden"
import { componentRegistry } from "./quartz/components/registry"
import { PublishedOnly } from "./quartz/plugins/filters/publishedOnly"

componentRegistry.setOptionOverrides("@quartz-community/recent-notes", {
  filter: (page: { slug?: string }) => page.slug !== "404" && page.slug !== "index",
})

const config = await loadQuartzConfig()
config.plugins.filters.unshift(PublishedOnly())
config.plugins.pageTypes ??= []
config.plugins.pageTypes.unshift(KnowledgeGardenPage())
export default config
export const layout = await loadQuartzLayout()
