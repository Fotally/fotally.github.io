# 自定义样式维护

## 右侧目录层级

右侧目录由 `@quartz-community/table-of-contents` 生成。插件使用 `depth-0`、`depth-1` 等类记录标题深度；`quartz.config.yaml` 将 `maxDepth` 设为 `6`，收录 Markdown 的六级标题。

主题会把普通列表项的左内边距重置为 `0`。自定义目录样式因此在 `.sidebar.right .toc` 范围内为 `depth-0` 至 `depth-5` 显式设置逐级增加的缩进，同时维护间距、左侧竖线、字号和颜色。
