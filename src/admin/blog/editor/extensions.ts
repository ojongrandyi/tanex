// Editor schema for blog posts (BLOG_SPEC §4): exactly the blocks server/blog/render.ts renders:
// H2–H4, paragraphs, bold/italic, links, bulleted/numbered lists, quote, image with caption + alt,
// horizontal rule, simple table and callout. No raw HTML, code, strike or underline.
import { Node, mergeAttributes, type Extensions } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import { CharacterCount, Placeholder } from '@tiptap/extensions';
import type { DOMOutputSpec } from '@tiptap/pm/model';

/** Blog library files only (the server drops any other image source). */
export const BLOG_IMAGE_SRC = /^\/media\/blog\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|png|avif)$/;

export const CALLOUT_TONES = ['info', 'tip', 'warning'] as const;
export type CalloutTone = (typeof CALLOUT_TONES)[number];

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    blogImage: {
      insertBlogImage: (attrs: { src: string; alt: string; caption?: string }) => ReturnType;
    };
    callout: {
      toggleCallout: (tone?: CalloutTone) => ReturnType;
      setCalloutTone: (tone: CalloutTone) => ReturnType;
    };
  }
}

/** Image with alt (required to publish) and an optional caption, shown as a figure. */
export const BlogImage = Image.extend({
  name: 'image',
  draggable: true,
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: '' },
      caption: {
        default: '',
        parseHTML: (el) => el.closest('figure')?.querySelector('figcaption')?.textContent ?? ''
      }
    };
  },
  parseHTML() {
    // Pasted images from other sites are left out at once, as the server would drop them anyway.
    return [{
      tag: 'img[src]',
      getAttrs: (el) => (BLOG_IMAGE_SRC.test((el as HTMLElement).getAttribute('src') ?? '') ? null : false)
    }];
  },
  renderHTML({ HTMLAttributes }) {
    const { caption, ...img } = HTMLAttributes as { caption?: string; src: string; alt: string };
    const missingAlt = !String(img.alt ?? '').trim();
    return [
      'figure',
      { class: `tx-blog-figure${missingAlt ? ' is-missing-alt' : ''}` },
      ['img', mergeAttributes(this.options.HTMLAttributes, img)],
      ...(caption ? [['figcaption', {}, caption]] : [])
    ] as DOMOutputSpec;
  },
  addCommands() {
    return {
      ...this.parent?.(),
      insertBlogImage: (attrs) => ({ commands }) =>
        commands.insertContent({ type: this.name, attrs: { src: attrs.src, alt: attrs.alt, caption: attrs.caption ?? '' } })
    };
  }
}).configure({ inline: false, allowBase64: false });

/** A highlighted note: info, tip or warning. Holds paragraphs and lists. */
export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: '(paragraph | bulletList | orderedList)+',
  defining: true,
  addAttributes() {
    return {
      tone: {
        default: 'info',
        parseHTML: (el) => CALLOUT_TONES.find((t) => el.classList.contains(`tx-callout--${t}`)) ?? 'info',
        renderHTML: () => ({})
      }
    };
  },
  parseHTML() {
    return [{ tag: 'aside.tx-callout' }];
  },
  renderHTML({ node }) {
    const tone = CALLOUT_TONES.includes(node.attrs.tone) ? node.attrs.tone : 'info';
    return ['aside', { class: `tx-callout tx-callout--${tone}`, 'data-tone': tone }, 0];
  },
  addCommands() {
    return {
      toggleCallout: (tone = 'info') => ({ commands, editor }) =>
        editor.isActive(this.name) ? commands.lift(this.name) : commands.wrapIn(this.name, { tone }),
      setCalloutTone: (tone) => ({ commands }) => commands.updateAttributes(this.name, { tone })
    };
  }
});

/** Links keep a `nofollow` flag; the server adds rel="nofollow ugc" only when it is set. */
export const BlogLink = Link.extend({
  addAttributes() {
    return {
      href: { default: null },
      nofollow: {
        default: false,
        parseHTML: (el) => /\bnofollow\b/.test(el.getAttribute('rel') ?? ''),
        renderHTML: () => ({})
      }
    };
  }
}).configure({
  openOnClick: false,
  autolink: true,
  linkOnPaste: true,
  protocols: ['mailto', 'tel'],
  HTMLAttributes: { rel: 'noopener', target: null }
});

/** Same rule as the server's safeHref: http(s), mailto:, tel:, a site path or an #anchor. */
export function safeHref(value: string): string | null {
  const href = value.trim();
  if (!href || href.length > 2000 || /[\u0000-\u001f\u007f\s\\]/.test(href)) return null;
  if (href.startsWith('#')) return /^#[\w-]+$/.test(href) ? href : null;
  if (href.startsWith('/')) return href.startsWith('//') ? null : href;
  if (/^(mailto|tel):/i.test(href)) return href;
  try {
    const url = new URL(href);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function blogExtensions(placeholder: string): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3, 4] },
      code: false,
      codeBlock: false,
      strike: false,
      underline: false,
      link: false
    }),
    BlogLink,
    BlogImage,
    Callout,
    TableKit.configure({ table: { resizable: false } }),
    Placeholder.configure({ placeholder }),
    CharacterCount
  ];
}
