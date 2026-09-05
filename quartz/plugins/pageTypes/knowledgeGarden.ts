import KnowledgeGarden from "../../components/pages/KnowledgeGarden"
import { QuartzPageTypePlugin } from "../types"

export const KnowledgeGardenPage: QuartzPageTypePlugin = () => ({
  name: "KnowledgeGardenPage",
  priority: 100,
  match: ({ slug }) => slug === "index",
  layout: "home",
  body: KnowledgeGarden,
})
