# 自定义样式维护

## 右侧目录层级

右侧目录由 `@quartz-community/table-of-contents` 生成。插件使用 `depth-0`、`depth-1` 等类记录标题深度，并负责为不同深度设置缩进。

自定义目录样式只维护间距、左侧竖线、字号和颜色，不在通用 `.toc-content li` 规则中设置 `padding-left`，避免覆盖插件的层级缩进。
