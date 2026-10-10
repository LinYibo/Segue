export default {
  meta: {
    title: 'Segue — an AI-assisted reading workbench for PDF & EPUB',
    description:
      'Drop in a PDF or EPUB and read with the answers at hand — cited answers, an on-device index, no account. Try it in your browser.',
  },
  nav: {
    features: 'Features',
    try: 'Try in browser',
    github: 'GitHub repository',
    language: 'Language',
  },
  hero: {
    tagline: 'Read with the answers at hand.',
    lead: 'Segue is a reading workbench for PDF and EPUB. Import a file, read it with page- and chapter-aware navigation, and ask questions that answer from retrieved excerpts with citations — an agent can search, read, and jump through the book when it needs more.',
    ctaTry: 'Try it in your browser',
    ctaGithub: 'View on GitHub',
    note: 'No account, nothing to install — parsing, indexing, and search happen on your device.',
    mockAlt: 'The Segue workbench: document tabs, a library rail, the book, and a cited answer',
  },
  features: {
    title: 'Built around the open book',
    subtitle: 'Retrieval, highlights, and answers all reference the document you are reading — never a cloud corpus.',
    items: [
      {
        title: 'A reader that knows where you are',
        body: 'Positions read like p.4 in a PDF and chapter marks in an EPUB. Search, outline, and highlights all share the same coordinates, so a citation click lands exactly where the answer came from.',
      },
      {
        title: 'Answers with citations',
        body: 'Every answer quotes retrieved excerpts with [C1]-style chips that jump back to the passage. When the first excerpts run thin, an agent loop searches the document, reads sections, and navigates for you.',
      },
      {
        title: 'On-device by default',
        body: 'Documents live in IndexedDB and are chunked and searched locally (BM25 over the open book only). Nothing is uploaded — the model just receives the assembled context window.',
      },
      {
        title: 'Your choice of model',
        body: 'xAI, DeepSeek, OpenRouter, Anthropic, Google Gemini, or a local Ollama / LM Studio. Configured in-app; the API key stays on your side.',
      },
    ],
    webTitle: 'The web demo',
    webBody: 'One document at a time, in your browser — the activity rail sits on the left and the reader scrolls natively. The desktop app adds a library, multiple documents, and a custom reading scrollbar.',
  },
  footer: {
    github: 'GitHub',
    releases: 'Releases',
    copyright: '© 2026 Segue',
  },
}
