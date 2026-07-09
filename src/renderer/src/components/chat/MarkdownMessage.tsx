import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { CodeBlock } from './CodeBlock';

interface MarkdownMessageProps {
  readonly content: string;
}

export function MarkdownMessage({ content }: MarkdownMessageProps) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children }) {
            const language = /language-([\w-]+)/.exec(className ?? '')?.[1];
            const code =
              typeof children === 'string' || typeof children === 'number' ? String(children) : '';
            return language ? (
              <CodeBlock code={code} language={language} />
            ) : (
              <code>{children}</code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
