# mcp README

## Features
- 展示最近更改，
- 展示页面历史版本
- 对比更改
- 编辑页面

\!\[feature\](images/feature.gif\)

## TODO
- wikitext高亮 标签提示

## Extension Settings
- `mcp.sites[].site`: 站点名（用于在拓展内区分站点）
- `mcp.sites[].index`: 接入点url index.php
- `mcp.sites[].api`: 接入点url api.php
- `mcp.sites[].rcNamespace`: 最近更改中要展示的名称空间，不填则展示全部
- `mcp.sites[].rcType`: 最近更改中展示的类型，留空展示`edit new external categorize`
- `mcp.sites[].name`: 用户名
- `mcp.sites[].password`: 密码
## Known Issues
- 最近更改的diff只支持非创建页面的edit
## Release Notes

### 1.0.0

Initial release 
