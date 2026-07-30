# 🗺️ 海外多地点智能选址与自动分组决策系统 V5.0 Pro

欢迎使用本系统！这是一个完全基于浏览器前端运行的地理选址与自动分组工具。项目已经按照**模块化架构**拆分，方便日常二次开发、编辑与长期维护，同时**完美支持一键部署至 GitHub Pages**。

---

## 📁 拆分后的文件目录结构

为了方便编辑与维护，项目已拆分为清晰的模块目录：

```text
智能分组地图/
├── index.html            # 主 HTML 页面 (语义化结构与选项卡布局)
├── README.md             # 本说明文档 (包含 GitHub Pages 部署指南)
├── css/                  # 样式文件夹
│   ├── main.css          # 全局主题变量、设计系统与通用按钮/表单样式
│   ├── sidebar.css       # 左侧面板、控制卡片、CSV 拖拽框与报告样式
│   └── map.css           # 右侧地图浮动工具、悬浮图例与进度条样式
└── js/                   # 逻辑脚本文件夹
    ├── config.js         # 全局配置、地图底图图层、颜色板与示例演示数据
    ├── geocoder.js       # 免费地理编码转换 (OpenStreetMap Nominatim 与 坐标解析)
    ├── algorithms.js     # 选址核心算法 (贪心最大半径覆盖 algorithm & K-Means 聚类)
    ├── map-manager.js    # Leaflet 地图初始化、Marker 标注、覆盖圈与 OSRM 驾驶路线
    ├── exporter.js       # Excel 粘贴格式化 (TSV) 与 CSV 文件导出逻辑
    └── app.js            # 应用初始化、UI 交互事件监听与数据持久化
```

---

## 🛠️ 如何快速修改代码？

由于代码已全部拆分，您可以轻松找到要修改的文件：

- **想要修改颜色/主题/字体/按钮外观？**
  👉 编辑 `css/main.css` 或 `css/sidebar.css`。
- **想要修改或增加新的地图底图类型？**
  👉 编辑 `js/config.js` 中的 `APP_CONFIG.TILE_PROVIDERS`。
- **想要调整默认示例演示人员名单？**
  👉 编辑 `js/config.js` 中的 `APP_CONFIG.SAMPLE_PEOPLE`。
- **想要改进或微调智能分组算法逻辑？**
  👉 编辑 `js/algorithms.js` 文件。

---

## 🌐 GitHub Pages 一键免费部署步骤

只需要 3 分钟，即可将本项目部署为一个长期有效的在线 Web 网站：

### 第一步：创建 GitHub 仓库
1. 登录您的 [GitHub 账号](https://github.com/)。
2. 点击右上角 **`+`** -> **`New repository`**（新建仓库）。
3. 仓库名称填入如：`smart-grouping-map`，选择 **`Public`**（公开），然后点击 **`Create repository`**。

### 第二步：上传项目文件
1. 在新创建的仓库页面中，点击 **`uploading an existing file`**（上传现有文件）。
2. 将 `智能分组地图` 文件夹下的所有文件和文件夹（包括 `index.html`、`css/`、`js/`、`README.md`）直接拖拽到 GitHub 的上传框中。
3. 点击底部的 **`Commit changes`** 保存上传。

### 第三步：开启 GitHub Pages 网站服务
1. 进入仓库顶部的 **`Settings`** (设置) 页面。
2. 在左侧菜单栏找到 **`Pages`** 选项。
3. 在 **`Build and deployment`** 区域：
   - **Source** 选择 `Deploy from a branch`。
   - **Branch** 选择 `main` (或 `master`)，目录选择 `/ (root)`。
4. 点击 **`Save`**。
5. 等待 1-2 分钟刷新页面，顶部即会出现您的专属网站域名链接（如 `https://yourusername.github.io/smart-grouping-map/`）！

---

## 🚀 核心功能亮点

1. **零服务器依赖**：所有地理计算、贪心算法与聚类迭代均在您的本地浏览器瞬间完成，隐私安全。
2. **数据持久化 (LocalStorage)**：输入的名单与选址点会自动保存在浏览器本地，下次打开不丢失。
3. **Excel 完美复制对齐**：点击【复制全员匹配结果】，回到 Excel 中按下 `Ctrl + V`，即可将人员匹配结果按原始表格顺序对齐粘贴！
