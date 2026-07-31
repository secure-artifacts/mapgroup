# 智能分组地图 (Smart Group Map)

一款基于 Web GIS 的高效率、数据隐私安全的智能选址与人员分组决策工具。

![License](https://img.shields.io/badge/License-MIT-blue.svg)
![Platform](https://img.shields.io/badge/Platform-Web-success.svg)
![Privacy](https://img.shields.io/badge/Privacy-100%25%20Local-green.svg)

## 📌 项目特点

- **🔒 100% 隐私安全（纯本地运行）**：
  所有数据计算、算法分析（最少组数覆盖算法、K-Means 聚类、距离检索）、去重导出等逻辑**完全在您的浏览器本地内存中运行**。项目无后端服务器数据库，人员姓名与敏感地址数据绝不上报或泄露。

- **🗺️ 多级精准地理编码引擎**：
  支持自定义 Geoapify API Key（首选，免费 3000次/天），配合 Photon (Komoot) 和 Nominatim 多重无缝备用兜底，保障全球地址高识别率。

- **👥 灵活的人员与分组管理**：
  支持 CSV 批量导入（2列/3列/4列自动识别）、按组配色展示、单组查看/隐藏、组内成员管理、JSON 完整数据导入导出（含重名冲突检测与替换模式）。

- **🎯 选址与覆盖规划**：
  支持地图点击选址、探针雷达实时探测、辐射线条可视化、多色覆盖圈显示。

- **📊 结果导出与按人员去重**：
  支持生成格式化 TSV 剪贴板复制（支持一键按人员去重，每个成员仅匹配最近中心），以及全量 CSV 明细数据导出。

---

## 🚀 快速使用

您可以直接访问在线网页：
👉 **[https://nuosishizi.github.io/mapgroup/](https://nuosishizi.github.io/mapgroup/)**

或下载源码后在本地直接双击 `index.html` 运行（无需任何环境配置）。

---

## 🛠️ CSV 导入格式说明

支持以下三种常见的 CSV 文件格式：

1. **3列格式（推荐，带分组）**：
   ```csv
   组名, 姓名, 详细地址
   北京组, 张三, 北京市朝阳区建国门外大街1号
   上海组, 李四, 上海市浦东新区陆家嘴环路1000号
   ```

2. **2列格式（无分组）**：
   ```csv
   姓名, 详细地址
   王五, 广州市天河区天河路208号
   ```

3. **4列格式（直接经纬度）**：
   ```csv
   姓名, 纬度, 经度, 详细地址
   赵六, 39.9042, 116.4074, 北京天安门
   ```

---

## 🛡️ 安全与审计声明

1. **零第三方追踪**：无任何统计分析 SDK（如 Google Analytics、百度统计等）。
2. **依赖透明可追溯**：依赖项均来自 Cloudflare cdnjs CDN 的成熟开源 Web 库（Leaflet、FontAwesome）。
3. **API 安全**：用户输入的 Geoapify API Key 仅保存在本地 `localStorage` 中，地理解析请求仅发送目标地址文本，**绝不传输任何人员姓名**。

---

## 📄 开源协议

本项目基于 [MIT License](LICENSE) 开源。
