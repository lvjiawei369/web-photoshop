# Web Photoshop

一个用 React + TypeScript + 原生 Canvas 复刻的网页版 Photoshop。不依赖任何 Canvas 框架（Fabric/Konva），图层合成引擎、选区系统、工具系统全部手写，纯前端单页应用。

A Photoshop clone for the browser, built with React + TypeScript and the raw Canvas API — no canvas frameworks. The layer compositor, pixel-mask selection system, and tool engine are all hand-rolled.

## 功能

**图层**
- 多图层：新建 / 删除 / 复制 / 重命名 / 拖拽排序 / 可见性 / 不透明度
- 16 种混合模式（正片叠底、滤色、叠加、柔光……）
- 向下合并、拼合图像
- 实时缩略图

**工具**（含 PS 同款快捷键）
- 移动 (V)、自由变换 (⌘T)：缩放 / 旋转 / 移动，Shift 等比与 15° 吸附
- 矩形 / 椭圆选框 (M)、套索 (L)、魔棒 (W，容差可调)——基于像素蒙版的统一选区系统，支持全选 (⌘A)、反选 (⇧⌘I)、蚂蚁线动画
- 裁剪 (C)、吸管 (I，Alt 取背景色)
- 画笔 / 橡皮擦 (B/E)：大小、不透明度、硬度（软边笔刷），笔触级不透明度与 PS 语义一致
- 仿制图章 (S)：Alt 取样
- 渐变 (G)：线性 / 径向，前景色 → 背景色
- 油漆桶：容差可调的洪水填充
- 形状 (U)：矩形 / 椭圆 / 直线，填充 + 描边
- 文字 (T)：画布上直接输入，栅格化为独立图层
- 抓手 (H)、缩放 (Z)，⌘+/− 缩放、⌘0 适合窗口

**调整与滤镜**（全部支持选区内应用 + 实时预览）
- 亮度、对比度、饱和度、色相/饱和度、色阶
- 高斯模糊、锐化、浮雕、像素化、添加噪点、灰度、反相、棕褐色

**图像**
- 图像大小（约束比例）、画布大小（九宫格定位）、旋转 / 翻转画布与图层

**其他**
- 历史记录面板（30 步，可点击跳转任意状态）+ ⌘Z / ⇧⌘Z
- 打开图片（文件选择或拖拽到窗口）、导出 PNG / JPEG
- 全套 PS 风格深色界面

## 运行

```bash
npm install
npm run dev
```

## 架构速览

```
src/
  core/
    compositor.ts   # 图层合成：混合模式、笔触/变换预览、棋盘格
    selection.ts    # 像素蒙版选区 + 边界追踪（蚂蚁线 Path2D）
    transform.ts    # 自由变换的几何运算与手柄命中测试
    history.ts      # 命令式撤销栈，支持任意跳转
  tools/            # 每个工具一个模块，统一 down/move/up 接口
  filters/          # 像素级调整与卷积滤镜
  state/store.ts    # zustand：元数据进状态，像素留在离屏 canvas
  components/       # 菜单栏 / 工具栏 / 画布 / 图层面板 / 历史面板
```

核心设计：每个图层是一个离屏 canvas，React 状态只存元数据和版本号；笔触先以全透明度画进临时 canvas，提交时按笔刷不透明度、经选区蒙版合入图层——与 Photoshop 的笔触语义一致。

## 不在范围内

PSD 读写、矢量图层、智能对象、图层蒙版与样式。这是一个演示原型，不是 Adobe 的替代品 :)

## License

MIT
