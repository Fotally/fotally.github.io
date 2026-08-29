import { QuartzFilterPlugin } from "../types"
import { getPublishedContentSnapshot } from "../../util/publishedContent"

export const PublishedOnly: QuartzFilterPlugin = () => {
  const publishedPaths = new Set(
    [...getPublishedContentSnapshot().relativePaths].map((path) => path.toLowerCase()),
  )

  return {
    name: "PublishedOnly",
    shouldPublish(_ctx, [_tree, vfile]) {
      const relativePath = String(vfile.data.relativePath ?? "")
        .replaceAll("\\", "/")
        .toLowerCase()
      return relativePath.length > 0 && publishedPaths.has(relativePath)
    },
  }
}
