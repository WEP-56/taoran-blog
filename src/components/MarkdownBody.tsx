"use client";

import React, { useState } from "react";
import { Check, Copy, X } from "lucide-react";

export interface TocHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

export function extractHeadings(markdown: string): TocHeading[] {
  if (!markdown) return [];
  const lines = markdown.split("\n");
  const result: TocHeading[] = [];
  let inCode = false;

  lines.forEach((rawLine, index) => {
    const trimmed = rawLine.trim();
    if (trimmed.startsWith("```")) {
      inCode = !inCode;
      return;
    }
    if (inCode) return;

    const h2 = trimmed.match(/^##\s+(.+)$/);
    const h3 = trimmed.match(/^###\s+(.+)$/);
    if (h2) {
      const text = h2[1].replace(/[*_`]/g, "").trim();
      result.push({
        id: `section-${index}-${text.slice(0, 16).replace(/\s+/g, "-")}`,
        text,
        level: 2,
      });
    } else if (h3) {
      const text = h3[1].replace(/[*_`]/g, "").trim();
      result.push({
        id: `section-${index}-${text.slice(0, 16).replace(/\s+/g, "-")}`,
        text,
        level: 3,
      });
    }
  });

  return result;
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div className="my-7 overflow-hidden rounded-xl surface-block">
      <div className="flex items-center justify-between px-4 py-2.5 surface-block-strong text-xs ink-secondary">
        <span className="font-mono-num uppercase tracking-wider">
          {lang || "text"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs surface-canvas ink-primary transition-opacity hover:opacity-80 cursor-pointer"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          <span>{copied ? "已复制" : "复制"}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-5 text-[13.5px] leading-relaxed font-mono-num ink-primary">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function renderInline(
  text: string,
  onPreviewImage?: (src: string, alt: string) => void
): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  // Combined regex for images, links, inline code, bold, italic
  const pattern =
    /(!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    keyIdx += 1;

    if (token.startsWith("![")) {
      const imgMatch = token.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (imgMatch) {
        const [, alt, src] = imgMatch;
        tokens.push(
          <span key={keyIdx} className="block my-7">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={/^(https?:\/\/|\/(?!\/))/.test(src) ? src : undefined}
              loading="lazy"
              decoding="async"
              alt={alt}
              onClick={() => onPreviewImage?.(src, alt)}
              className="w-full rounded-xl object-cover surface-block cursor-zoom-in transition-transform duration-500 hover:scale-[1.005]"
            />
            {alt && (
              <span className="mt-2.5 block text-center text-xs ink-muted">
                {alt}
              </span>
            )}
          </span>
        );
      }
    } else if (token.startsWith("[")) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        const [, label, href] = linkMatch;
        tokens.push(
          <a
            key={keyIdx}
            href={/^(https?:\/\/|mailto:|#|\/(?!\/))/.test(href) && !/[\u0000-\u0020\\]/.test(href) ? href : "#"}
            target={href.startsWith("http") ? "_blank" : undefined}
            rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
            className="surface-block inline-block rounded-md px-2 py-0.5 font-medium ink-primary transition-colors hover:opacity-80"
          >
            {label}
          </a>
        );
      }
    } else if (token.startsWith("`")) {
      tokens.push(
        <code
          key={keyIdx}
          className="surface-block rounded-md px-1.5 py-0.5 text-[0.88em] font-mono-num ink-primary"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("**")) {
      tokens.push(
        <strong key={keyIdx} className="font-semibold ink-primary">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("*")) {
      tokens.push(
        <em key={keyIdx} className="italic ink-primary">
          {token.slice(1, -1)}
        </em>
      );
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex));
  }

  return tokens;
}

export function MarkdownBody({ content }: { content: string }) {
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(
    null
  );

  const lines = (content || "").split("\n");
  const blocks: React.ReactNode[] = [];

  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // Fenced code block
    if (trimmed.startsWith("```")) {
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push(
        <CodeBlock key={`code-${i}`} lang={lang} code={codeLines.join("\n")} />
      );
      continue;
    }

    // Thematic pause (NO horizontal line — rendered as typographic ink pause!)
    if (/^(---|\*\*\*|___)$/.test(trimmed)) {
      blocks.push(
        <div
          key={`pause-${i}`}
          className="my-10 flex items-center justify-center gap-4 select-none ink-muted text-sm"
        >
          <span className="h-1.5 w-1.5 rounded-full surface-block-strong inline-block" />
          <span className="h-1.5 w-1.5 rounded-full surface-block-strong inline-block" />
          <span className="h-1.5 w-1.5 rounded-full surface-block-strong inline-block" />
        </div>
      );
      i += 1;
      continue;
    }

    // Headings
    const h1 = trimmed.match(/^#\s+(.+)$/);
    const h2 = trimmed.match(/^##\s+(.+)$/);
    const h3 = trimmed.match(/^###\s+(.+)$/);

    if (h1) {
      blocks.push(
        <h2
          key={`h1-${i}`}
          className="mt-11 mb-4 text-2xl font-semibold tracking-tight ink-primary"
        >
          {renderInline(h1[1], (src, alt) => setLightbox({ src, alt }))}
        </h2>
      );
      i += 1;
      continue;
    }

    if (h2) {
      const clean = h2[1].replace(/[*_`]/g, "").trim();
      const id = `section-${i}-${clean.slice(0, 16).replace(/\s+/g, "-")}`;
      blocks.push(
        <h2
          id={id}
          key={`h2-${i}`}
          className="scroll-mt-24 mt-11 mb-4 text-[19px] font-semibold tracking-tight ink-primary"
        >
          {renderInline(h2[1], (src, alt) => setLightbox({ src, alt }))}
        </h2>
      );
      i += 1;
      continue;
    }

    if (h3) {
      const clean = h3[1].replace(/[*_`]/g, "").trim();
      const id = `section-${i}-${clean.slice(0, 16).replace(/\s+/g, "-")}`;
      blocks.push(
        <h3
          id={id}
          key={`h3-${i}`}
          className="scroll-mt-24 mt-8 mb-3 text-base font-semibold ink-primary"
        >
          {renderInline(h3[1], (src, alt) => setLightbox({ src, alt }))}
        </h3>
      );
      i += 1;
      continue;
    }

    // Blockquote -> pure solid tonal block (zero border-left!)
    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push(
        <blockquote
          key={`quote-${i}`}
          className="my-7 rounded-xl surface-block px-6 py-5 font-editorial text-[15.5px] leading-8 ink-primary"
        >
          {renderInline(quoteLines.join(" "), (src, alt) =>
            setLightbox({ src, alt })
          )}
        </blockquote>
      );
      continue;
    }

    // Table -> alternating monochrome tonal row blocks (zero grid lines!)
    if (
      trimmed.includes("|") &&
      i + 1 < lines.length &&
      /^\s*\|?[\s:-]+\|[\s|:-]*$/.test(lines[i + 1])
    ) {
      const parseCells = (rowStr: string) =>
        rowStr
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((c) => c.trim());

      const headers = parseCells(lines[i]);
      i += 2; // skip separator row
      const bodyRows: string[][] = [];
      while (i < lines.length && lines[i].trim().includes("|")) {
        bodyRows.push(parseCells(lines[i]));
        i += 1;
      }

      blocks.push(
        <div
          key={`table-${i}`}
          className="my-7 overflow-x-auto rounded-xl surface-block p-2"
        >
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="surface-block-strong rounded-lg">
                {headers.map((h, hIdx) => (
                  <th
                    key={hIdx}
                    className="px-4 py-3 font-medium ink-primary first:rounded-l-lg last:rounded-r-lg"
                  >
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  className={rIdx % 2 === 1 ? "surface-canvas" : ""}
                >
                  {row.map((cell, cIdx) => (
                    <td
                      key={cIdx}
                      className="px-4 py-3 ink-secondary first:rounded-l-lg last:rounded-r-lg"
                    >
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Unordered list
    if (/^[-*+]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*+]\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="my-5 space-y-2.5 pl-1">
          {items.map((item, idx) => (
            <li
              key={idx}
              className="flex items-start gap-3 text-[15.5px] leading-7 ink-secondary"
            >
              <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full surface-invert inline-block opacity-70" />
              <span>
                {renderInline(item, (src, alt) => setLightbox({ src, alt }))}
              </span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ol key={`ol-${i}`} className="my-5 space-y-3 pl-1">
          {items.map((item, idx) => (
            <li
              key={idx}
              className="flex items-start gap-3 text-[15.5px] leading-7 ink-secondary"
            >
              <span className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md surface-block font-mono-num text-xs ink-primary">
                {idx + 1}
              </span>
              <span>
                {renderInline(item, (src, alt) => setLightbox({ src, alt }))}
              </span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Standard Paragraph (collect consecutive non-special lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^#{1,3}\s+/.test(lines[i].trim()) &&
      !lines[i].trim().startsWith("```") &&
      !lines[i].trim().startsWith(">") &&
      !/^[-*+]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !/^(---|\*\*\*|___)$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i].trim());
      i += 1;
    }

    blocks.push(
      <p
        key={`p-${i}`}
        className="my-5 text-[15.5px] leading-[1.92] tracking-[0.01em] ink-secondary"
      >
        {renderInline(paraLines.join(" "), (src, alt) =>
          setLightbox({ src, alt })
        )}
      </p>
    );
  }

  return (
    <>
      <div className="markdown-flow">{blocks}</div>

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6 backdrop-blur-sm cursor-zoom-out"
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="fixed top-6 right-6 rounded-full bg-white/15 p-2.5 text-white transition-opacity hover:opacity-80 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="max-h-[88vh] max-w-5xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.src}
              alt={lightbox.alt}
              className="max-h-[82vh] w-auto rounded-xl object-contain"
            />
            {lightbox.alt && (
              <p className="mt-3 text-center text-xs text-white/75">
                {lightbox.alt}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
