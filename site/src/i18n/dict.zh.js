export default {
  meta: {
    title: 'Segue — 面向 PDF 与 EPUB 的 AI 阅读工作台',
    description:
      '拖入一个 PDF 或 EPUB，边读边问——回答附带引用、检索在本机完成、无需账号。可以直接在浏览器里试用。',
  },
  nav: {
    features: '功能',
    try: '浏览器试用',
    github: 'GitHub 仓库',
    language: '语言',
  },
  hero: {
    tagline: '边读，边问，答案就在手边。',
    lead: 'Segue 是一个面向 PDF 与 EPUB 的阅读工作台：导入文件，按页码和章节定位阅读，提问得到的回答引用书内检索片段——需要更多上下文时，代理会自己搜索、阅读并跳转到书中位置。',
    ctaTry: '在浏览器中试用',
    ctaGithub: '在 GitHub 上查看',
    note: '无需账号、无需安装——解析、索引和检索都发生在你的设备上。',
    mockAlt: 'Segue 工作台：文档标签页、资料库侧栏、书页和带引用的回答',
  },
  features: {
    title: '围绕正在读的那本书构建',
    subtitle: '检索、高亮和回答都指向你眼前的文档，而不是某个云端语料库。',
    items: [
      {
        title: '知道你读到哪的阅读器',
        body: 'PDF 里位置读作 p.4，EPUB 里是章节标记。搜索、目录、高亮共用同一套坐标，所以点击引用会精确落回到答案出处的那一段。',
      },
      {
        title: '带引用的回答',
        body: '每个回答都引用检索到的片段，[C1] 这样的标记可以跳回原文。当第一轮片段不够用时，代理循环会搜索文档、阅读章节、替你跳转。',
      },
      {
        title: '默认留在本机',
        body: '文档存在 IndexedDB，分块和检索（只针对当前这本书的 BM25）都在本地完成。没有任何上传——模型只收到组装好的上下文窗口。',
      },
      {
        title: '模型自己选',
        body: 'xAI、DeepSeek、OpenRouter、Anthropic、Google Gemini，或本地 Ollama / LM Studio。全部在应用内配置，API key 留在你这边。',
      },
    ],
    webTitle: '网页试用版',
    webBody: '在浏览器里一次读一个文档——活动栏在左侧，阅读区使用浏览器原生滚动条。桌面版则多出资料库、多文档标签页和自定义阅读滚动条。',
  },
  footer: {
    github: 'GitHub',
    releases: '发布页',
    copyright: '© 2026 Segue',
  },
}
