# UI 设计：Independent Creative Journal

以独立创意杂志和工作室活动海报为方向。浏览中的信息分成「编辑精选」「现场活动」「社区关系」「创作成果」，让用户知道可以参与什么。

## 设计变量

| 用途     | 值                                    |
| -------- | ------------------------------------- |
| 页面底色 | #F8F9F5 暖白                          |
| 文字     | #252B25 墨黑                          |
| 强调色   | #D7F66B 黄绿色                        |
| 辅助面板 | #EDF6D8 浅黄绿                        |
| 分隔线   | #E7E9E1                               |
| 圆角     | 按钮 7–8px，卡片 10–14px，弹窗 18px   |
| 字体     | 系统无衬线；少量宋体/衬线用于标题强调 |

黄绿色用于当前导航和主要行动，暖橙色海报为视觉焦点。没有自动播放或闪烁的礼物动画。侧栏固定，内容区按 2–3 栏排列；手机切为抽屉导航和两栏卡片，直播间聊天下移。

## 素材

- Logo、橙色 MAKE SOMETHING 海报和周末专题排版由本项目用 SVG/CSS 绘制，可直接编辑。
- 照片来自 Unsplash 图片服务，下载到 `apps/web/public/images/`，运行时无需外部图片请求。

| 文件         | 来源图片                                                     |
| ------------ | ------------------------------------------------------------ |
| studio.jpg   | https://images.unsplash.com/photo-1452860606245-08befc0ff44b |
| pottery.jpg  | https://images.unsplash.com/photo-1493106641515-6b5631de4bb9 |
| camera.jpg   | https://images.unsplash.com/photo-1452587925148-ce544e77e70d |
| music.jpg    | https://images.unsplash.com/photo-1511379938547-c1f69419868d |
| art.jpg      | https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b |
| interior.jpg | https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85 |

上线品牌素材可直接替换本地文件；现有图片不代表种子主持人本人或其实际作品。没有对图片人物身份做推断。

## 研究参考

- [Awwwards 艺术类网站](https://www.awwwards.com/websites/art/)：调研编辑式构图与内容呈现，未复制具体站点。
- [Twitch 联合直播机制](https://blog.twitch.tv/en/2024/12/05/shared-viewership/)：多人社区共同参与的产品方向。
- [Discord Stage](https://discord.com/stages)：活动与长期社区关系。
- [小红书电商](https://ec.xiaohongshu.com/)：作品过程与创作者关系的呈现。

## 截图

`desktop.png` 和 `mobile.png` 是实际运行应用后使用 Chromium 截取的页面，不是效果图。移动端截图宽度 390px。浏览器自动测试还覆盖了圈子、作品、日历、工作台、直播间的移动端横向溢出。
