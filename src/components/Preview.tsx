"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

/**
 * READMEs lean heavily on raw HTML (centered headers, badge rows, <details>).
 * We allow it, then sanitize with an extended GitHub-style schema so pasted
 * content can never inject script or event handlers into the app.
 */
const schema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "div",
    "span",
    "details",
    "summary",
    "picture",
    "source",
    "sub",
    "sup",
    "kbd",
    "b",
    "i",
    "u",
    "small",
    "center",
  ],
  attributes: {
    ...defaultSchema.attributes,
    /*
     * No `style`. GitHub strips inline styles from rendered READMEs, so
     * allowing them here made the preview less accurate, not more, and
     * hast-util-sanitize does not parse CSS values: it only decides whether
     * the attribute survives. Allowing it on every element handed any pasted
     * node control over position and stacking, which is enough to cover the
     * app with an overlay. `align` covers the centering READMEs actually use.
     */
    "*": [...(defaultSchema.attributes?.["*"] ?? []), "align", "className"],
    img: [
      ...(defaultSchema.attributes?.img ?? []),
      "src",
      "alt",
      "width",
      "height",
      "align",
    ],
    a: [...(defaultSchema.attributes?.a ?? []), "href", "target", "rel"],
    source: ["srcSet", "media", "type"],
    details: ["open"],
  },
  protocols: {
    ...defaultSchema.protocols,
    src: ["http", "https"],
    href: ["http", "https", "mailto"],
  },
};

export default function Preview({
  markdown,
  theme,
  embedded = false,
  scrollRef,
}: {
  markdown: string;
  theme: "light" | "dark";
  /** Render bare, letting the caller own the `.gh` container and padding. */
  embedded?: boolean;
  /** Handle on the scrolling element, so callers can sync it to an editor. */
  scrollRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const body = (
    <Markdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]}
      components={{
        a: ({ href, children, ...rest }) => (
          <a href={href} target="_blank" rel="noreferrer noopener" {...rest}>
            {children}
          </a>
        ),
      }}
    >
      {markdown}
    </Markdown>
  );

  if (embedded) return body;

  return (
    <div ref={scrollRef} className="gh h-full overflow-auto px-8 py-7" data-theme={theme}>
      <div className="mx-auto max-w-[880px]">{body}</div>
    </div>
  );
}
