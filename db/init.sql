CREATE TABLE IF NOT EXISTS entries (
    id              TEXT PRIMARY KEY,
    url             TEXT NOT NULL,
    title           TEXT NOT NULL,
    category        TEXT NOT NULL,
    summary         JSONB NOT NULL DEFAULT '[]',
    tags            JSONB NOT NULL DEFAULT '[]',
    click_count     INTEGER NOT NULL DEFAULT 0,
    heart_count     INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    submitter_name  TEXT,
    reading_time    INTEGER
);

INSERT INTO entries (id, url, title, category, summary, tags, click_count, heart_count, created_at, submitter_name, reading_time)
VALUES
    (
        'introduction-to-model-context-protocol-mcp',
        'https://modelcontextprotocol.io/introduction',
        'Introduction to Model Context Protocol (MCP)',
        'Technology',
        '["Standardizes how AI models connect to external data sources and tools","Works like a USB-C port for AI — one protocol, many integrations","Dramatically reduces custom integration work for AI-powered apps"]',
        '["mcp","integrations","architecture"]',
        47, 12, '2026-04-03T08:30:00Z', 'Kevin F.', 8
    ),
    (
        'ux-principles-for-ai-powered-interfaces',
        'https://www.nngroup.com/articles/ai-ux-principles/',
        'UX Principles for AI-Powered Interfaces',
        'Design Studio',
        '["AI outputs must be transparent and explainable to build user trust","Progressive disclosure works better than overwhelming users with AI capabilities upfront","Design for graceful failure — AI will be wrong and the UX must handle it"]',
        '["ux","ai-design","trust"]',
        31, 9, '2026-04-02T14:15:00Z', 'Hannah G.', 12
    ),
    (
        'openai-prompt-engineering-guide',
        'https://platform.openai.com/docs/guides/prompt-engineering',
        'OpenAI Prompt Engineering Guide',
        'Digital Solutioning',
        '["Clear, specific instructions consistently outperform vague prompts","Using delimiters like triple quotes prevents prompt injection attacks","Chain-of-thought prompting significantly improves accuracy on complex reasoning tasks"]',
        '["prompt-engineering","openai","best-practices"]',
        62, 18, '2026-04-01T09:00:00Z', 'Rachel K.', 15
    ),
    (
        'building-ai-products-what-pms-need-to-know',
        'https://review.firstround.com/building-ai-products-what-product-managers-need-to-know/',
        'Building AI Products: What PMs Need to Know',
        'Product Management & Partnerships',
        '["Product teams must design for AI capability improvements over time, not a fixed snapshot","Avoid hardcoding AI behavior — build flexible evaluation frameworks instead","User research looks different when outputs are non-deterministic"]',
        '["product-strategy","ai-pm","evaluation"]',
        28, 7, '2026-03-31T16:00:00Z', 'Chris D.', 10
    ),
    (
        'building-effective-agents',
        'https://www.anthropic.com/research/building-effective-agents',
        'Building Effective Agents',
        'Technology',
        '["Agentic AI works best for well-defined, repetitive multi-step tasks","Human-in-the-loop checkpoints reduce risk in automated workflows","Start with the simplest architecture that works — complexity compounds failure modes"]',
        '["agents","automation","architecture"]',
        55, 21, '2026-03-30T11:00:00Z', 'Alex A.', 20
    ),
    (
        'deconstructing-rag',
        'https://blog.langchain.dev/deconstructing-rag/',
        'Deconstructing RAG',
        'Technology',
        '["RAG combines retrieval systems with LLMs to ground responses in real, current data","Chunking strategy is critical — poor chunking tanks retrieval accuracy","Hybrid search (vector + keyword) outperforms pure vector search in most production cases"]',
        '["rag","vector-search","llm"]',
        44, 15, '2026-03-28T09:30:00Z', 'Tariq S.', 18
    ),
    (
        'demoing-ai-to-enterprise-clients-what-actually-works',
        'https://www.salesforce.com/blog/ai-enterprise-demos/',
        'Demoing AI to Enterprise Clients: What Actually Works',
        'Client Solutions',
        '["Live demos beat static slides — clients want to see AI respond to their specific problems","Anchor the demo to a business outcome the client already cares about","Always have a graceful recovery plan for when the demo goes sideways"]',
        '["client-demos","enterprise","presentations"]',
        19, 6, '2026-03-26T13:00:00Z', 'Amy D.', 6
    ),
    (
        'ethical-guidelines-for-ai-generated-imagery',
        'https://www.creativebloq.com/ai/ai-art/ai-generated-imagery-ethics-guidelines',
        'Ethical Guidelines for AI-Generated Imagery in Client Work',
        'Design Studio',
        '["Disclose AI image use in deliverables — clients are increasingly asking","Train your eye to spot common AI artifacts before presenting work","Build a pre-approved prompt library to maintain brand consistency across AI tools"]',
        '["ai-imagery","ethics","brand","design"]',
        22, 11, '2026-03-24T10:00:00Z', 'Sam S.', 9
    ),
    (
        'using-ai-to-improve-project-estimation-accuracy',
        'https://www.pmi.org/learning/library/ai-project-estimation-accuracy',
        'Using AI to Improve Project Estimation Accuracy',
        'Project Management',
        '["AI can analyze historical project data to surface estimation blind spots","LLMs are useful for breaking vague requirements into estimable tasks","Treat AI estimates as a starting point, not a final answer — human judgment is still essential"]',
        '["estimation","project-planning","ai-tools"]',
        16, 4, '2026-03-22T14:00:00Z', 'Megan F.', 11
    ),
    (
        'ai-powered-research-for-account-planning',
        'https://hbr.org/2024/03/how-to-use-ai-for-better-account-planning',
        'AI-Powered Research for Account Planning',
        'Client Development',
        '["AI dramatically accelerates competitive research and account mapping","Use AI to synthesize earnings calls and news into digestible client context briefs","Personalization at scale: AI can tailor outreach to specific industry pain points"]',
        '["account-planning","sales","research"]',
        14, 5, '2026-03-20T09:00:00Z', 'Josh L.', 8
    )
ON CONFLICT (id) DO NOTHING;
