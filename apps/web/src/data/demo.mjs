export const demo = {
  zh: {
    name: '[网站名称]', title: '技术、创作，与一点独立精神', description: '记录 AI 视频、网站与小程序的创作实践。从一个想法开始，把技术变成可用的作品。',
    eyebrow: '独立创作者的数字工作室', headline: ['认真探索技术，', '也认真创造。'], intro: '这里记录 AI、设计与开发的实践。分享从想法到作品的过程，也为值得做的事，搭建恰到好处的数字体验。',
    nav: ['技术笔记', '作品与探索', '服务', '关于'], contact: '聊聊你的想法', read: '阅读技术笔记', work: '看看作品',
    notes: '在实践中，留下笔记。', notesIntro: '关于工具，也关于工具背后的思考。', noteLabel: '技术笔记', sample: '示例内容', preview: '展开示例摘要',
    articles: [
      { category: 'AI 视频', title: '从一句提示词，到一个有叙事的镜头', summary: '不急着生成。先梳理故事、分镜与画面语言，再让 AI 成为创作过程的一部分。', detail: '示例选题：从场景、主体、动作和镜头运动四个维度拆解提示词，并记录多次生成中需要人工判断和调整的环节。本文尚未正式发布。', kind: 'feature' },
      { category: '网站开发', title: '一个内容网站，为什么从静态开始？', summary: '用更少的复杂度，换来更专注的阅读体验。聊聊 Astro 与内容驱动的网站。', detail: '示例选题：区分构建时数据和运行时交互，探索 SQLite 内容快照与静态页面之间的边界。本文尚未正式发布。' },
      { category: '工具与思考', title: '把重复的事情交给工具，把判断留给自己', summary: '让 AI 进入日常工作流，不是为了做得更多，而是为了把重要的事做得更好。', detail: '示例选题：从一个可核验的小任务开始自动化，保留人工检查点，而不是用自动生成替代判断。本文尚未正式发布。' }
    ],
    projectsTitle: '让想法，有一个落点。', projectsIntro: '一些正在探索的方向。以下均为概念项目，并非客户案例。', projectLabel: '作品与探索', concept: '概念项目 · 示例',
    projects: [{ title: '一个人的内容工作室', summary: '让写作、作品与服务在同一个空间里自然生长。以 Astro + SQLite 探索轻量、可持续的内容发布。', tags: '网站设计 / Astro / 内容系统', visual: 'web' }, { title: '日常，也可以是一段电影', summary: '从日常场景出发，探索 AI 视频的叙事节奏。用分镜与镜头设计，让生成画面拥有连贯的表达。', tags: 'AI 视频 / 分镜 / 视觉探索', visual: 'film' }],
    servicesTitle: '技术与创意，落到实处。', serviceLabel: '可以一起做的事', services: [{ title: 'AI 视频创作', text: '从创意梳理、分镜设计到 AI 生成与剪辑，探索适合内容本身的视觉表达。' }, { title: '网站设计与开发', text: '为内容、产品与个人品牌搭建清晰、好用的网站，兼顾设计、性能与长期维护。' }, { title: '小程序设计与开发', text: '从实际使用场景出发，梳理核心流程，用轻量的产品解决具体问题。' }],
    aboutLabel: '关于这个空间', aboutTitle: '保持好奇，也保持独立。', aboutText: '这是一个独立创作者网站的首页示例。希望把探索过程写下来，把有用的东西做出来。真实的个人介绍、作品和联系信息，将在正式发布前补充。',
    contactTitle: '有个想法，想一起聊聊？', contactText: '无论是一个网站、一段视频，还是尚未成形的点子。', contactEmpty: '联系渠道待补充', contactNote: '暂未开放咨询入口；不会收集或提交你的个人信息。', footer: '认真记录，持续创造。', notice: '预览版本 · 文章与作品均为示例，非真实发布记录。', illustration: '鹅形象占位 · 等待正式品牌素材', skip: '跳到正文', menu: '菜单', close: '收起菜单', footerNav: '页脚导航', lang: '选择语言', back: '回到顶部'
  },
  en: {
    name: '[Site name]', title: 'Technology, craft & an independent spirit', description: 'Notes on AI video, web development and digital craft. Turning considered ideas into useful things.',
    eyebrow: 'An independent digital studio', headline: ['Explore with purpose.', 'Create with care.'], intro: 'Field notes on AI, design and development. Sharing the journey from an idea to a working product—and building thoughtful digital experiences along the way.',
    nav: ['Field notes', 'Explorations', 'Services', 'About'], contact: 'Let’s talk ideas', read: 'Read the field notes', work: 'Explore the work',
    notes: 'Learn by making. Leave a note.', notesIntro: 'The tools, the process, and the thinking behind them.', noteLabel: 'Field notes', sample: 'Sample content', preview: 'Read sample outline',
    articles: [
      { category: 'AI VIDEO', title: 'From a prompt to a shot that tells a story', summary: 'Before generating, consider the story, the storyboard and the visual language. Make AI part of the craft, not a shortcut around it.', detail: 'Sample outline: break a prompt into scene, subject, action and camera movement. Document the choices that still need human judgment. This article has not been published.', kind: 'feature' },
      { category: 'WEB DEVELOPMENT', title: 'Why start a content website with static pages?', summary: 'Less complexity. More room for reading. Exploring Astro and a content-first approach to the web.', detail: 'Sample outline: separate build-time data from runtime interaction, and explore the boundary between SQLite snapshots and static pages. This article has not been published.' },
      { category: 'TOOLS & THOUGHTS', title: 'Automate the repetition. Keep the judgment.', summary: 'Bringing AI into everyday work is not about doing more. It is about giving the important things more attention.', detail: 'Sample outline: automate one verifiable task at a time and keep human review checkpoints. This article has not been published.' }
    ],
    projectsTitle: 'Give an idea somewhere to live.', projectsIntro: 'Directions worth exploring. These are concept projects, not client work.', projectLabel: 'Work & explorations', concept: 'Concept project · Sample',
    projects: [{ title: 'A studio for one', summary: 'A home where writing, work and services grow together. Exploring sustainable publishing with Astro and SQLite.', tags: 'Web design / Astro / Content systems', visual: 'web' }, { title: 'A little cinema in the everyday', summary: 'Exploring visual storytelling through everyday scenes. Bringing continuity to AI-generated video with storyboards and considered camera work.', tags: 'AI video / Storyboards / Visual exploration', visual: 'film' }],
    servicesTitle: 'Thoughtful ideas. Practical craft.', serviceLabel: 'What we can make', services: [{ title: 'AI video creation', text: 'From the first idea and storyboard to generation and editing. Finding the visual language that fits the story.' }, { title: 'Web design & development', text: 'Clear, useful websites for content, products and personal brands. Built with design, performance and maintenance in mind.' }, { title: 'Mini app development', text: 'Start with a real use case, simplify the core journey, and build a focused product around it.' }],
    aboutLabel: 'Behind this space', aboutTitle: 'Stay curious. Stay independent.', aboutText: 'This is a sample homepage for an independent creator. A space to share the process and make useful things. A real biography, portfolio and contact details will be added before launch.',
    contactTitle: 'Something on your mind?', contactText: 'A website, a video, or an idea that is still taking shape.', contactEmpty: 'Contact details coming soon', contactNote: 'Enquiries are not open yet. No personal information is collected or submitted.', footer: 'Keep exploring. Make with care.', notice: 'Preview · All articles and projects are samples, not published work.', illustration: 'Goose placeholder · Final brand asset pending', skip: 'Skip to content', menu: 'Menu', close: 'Close menu', footerNav: 'Footer navigation', lang: 'Choose language', back: 'Back to top'
  }
};
