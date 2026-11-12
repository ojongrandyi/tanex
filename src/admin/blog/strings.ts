// Blog studio copy (docs/CONTENT.md §10.4, owner to confirm). The console is English until phase I
// moves its text into the dictionaries; kept in one object, like AUTH_TEXT and IAM_TEXT, so that
// move is a straight copy.
import { BLOG_MENU } from './menuText';

export const BLOG_TEXT = {
  menu: BLOG_MENU.menu,
  description: BLOG_MENU.description,
  tabs: { posts: 'Posts', categories: 'Categories', media: 'Media' },
  status: {
    ALL: 'All',
    DRAFT: 'Draft',
    IN_REVIEW: 'In review',
    SCHEDULED: 'Scheduled',
    PUBLISHED: 'Published',
    ARCHIVED: 'Archived'
  },
  language: { all: 'All languages', en: 'English', fr: 'French' },
  list: {
    newPost: 'New post',
    search: 'Search titles',
    mine: 'Only my posts',
    columns: { title: 'Title', language: 'Language', author: 'Author', category: 'Category', status: 'Status', date: 'Date' },
    translation: { missingFr: 'FR missing', missingEn: 'EN missing', linked: 'Linked' },
    empty: 'No posts yet.',
    emptyFiltered: 'No posts match these filters.',
    scheduledFor: 'Goes live {date}',
    updated: 'Edited {date}',
    page: 'Page {page} of {pages}',
    prev: 'Previous',
    next: 'Next',
    loadFailed: "The posts couldn't be loaded."
  },
  newPost: {
    title: 'New post',
    titleLabel: 'Title',
    language: 'Language',
    create: 'Create draft',
    cancel: 'Cancel'
  },
  editor: {
    back: 'All posts',
    title: 'Title',
    titlePlaceholder: 'Article title',
    bodyPlaceholder: 'Write the article. Use H2 for sections.',
    words: '{n} words',
    readingTime: '{n} min read',
    saved: 'Saved {time}',
    saving: 'Saving…',
    unsaved: 'Unsaved changes',
    saveFailed: "Couldn't save: {error}",
    conflict: 'Someone else saved this post. Reload it to see their version; your changes here are not saved.',
    reload: 'Reload',
    readOnly: 'You can read this post but not change it.',
    locked: 'This post is scheduled or published; an editor can change it.',
    leaveConfirm: 'You have unsaved changes. Leave anyway?',
    toolbar: {
      label: 'Formatting',
      paragraph: 'Paragraph',
      h2: 'Heading 2',
      h3: 'Heading 3',
      h4: 'Heading 4',
      bold: 'Bold',
      italic: 'Italic',
      link: 'Link',
      unlink: 'Remove link',
      bullet: 'Bulleted list',
      ordered: 'Numbered list',
      quote: 'Quote',
      rule: 'Divider',
      image: 'Image',
      table: 'Table',
      callout: 'Callout',
      undo: 'Undo',
      redo: 'Redo'
    },
    table: { addRow: 'Add row', addColumn: 'Add column', deleteRow: 'Delete row', deleteColumn: 'Delete column', deleteTable: 'Delete table' },
    callout: { info: 'Info', tip: 'Tip', warning: 'Warning', remove: 'Remove callout' },
    link: {
      title: 'Link',
      url: 'Address',
      urlHint: 'A full address (https://…), a site path (/services), an email (mailto:) or a phone (tel:).',
      nofollow: 'Ask search engines not to follow (sponsored or user links)',
      apply: 'Apply',
      remove: 'Remove link',
      invalid: 'Enter a full address starting with https://, a path starting with /, mailto: or tel:.'
    },
    image: {
      title: 'Image',
      alt: 'Alt text (required)',
      altHint: 'Describe the picture for people who cannot see it.',
      caption: 'Caption (optional)',
      insert: 'Insert',
      update: 'Update',
      edit: 'Edit image',
      missingAlt: 'Alt text missing'
    }
  },
  panel: {
    label: 'Post settings',
    status: 'Status',
    slug: 'Slug',
    slugHint: 'The end of the address. Lower-case letters, digits and hyphens.',
    slugFromTitle: 'Use the title',
    excerpt: 'Excerpt',
    excerptHint: 'Shown on cards and in search results. Aim for about 160 characters.',
    cover: 'Cover image',
    coverAlt: 'Cover alt text',
    coverChoose: 'Choose image',
    coverRemove: 'Remove',
    categories: 'Categories',
    noCategories: 'No categories in this language yet.',
    tags: 'Tags',
    tagsHint: 'Separate with commas.',
    author: 'Author',
    seo: 'Search and sharing',
    seoTitle: 'SEO title',
    seoTitleHint: 'Leave empty to use the title.',
    seoDescription: 'SEO description',
    seoDescriptionHint: 'Leave empty to use the excerpt.',
    previewGoogle: 'Google',
    previewWhatsApp: 'WhatsApp',
    readingTime: 'Reading time',
    language: 'Language',
    translation: 'Translation',
    createFrench: 'Create French version',
    createEnglish: 'Create English version',
    openTranslation: 'Open {lang} version',
    chars: '{n}/{max}'
  },
  actions: {
    save: 'Save draft',
    preview: 'Preview',
    submit: 'Submit for review',
    publish: 'Publish now',
    schedule: 'Schedule',
    scheduleAt: 'Go-live date and time (Africa/Douala)',
    scheduleConfirm: 'Schedule',
    unpublish: 'Unpublish',
    archive: 'Archive',
    delete: 'Delete',
    deleteConfirm: 'Delete this post? This cannot be undone.',
    archiveConfirm: 'Archive this post? It leaves the public blog.',
    unpublishConfirm: 'Unpublish this post? It leaves the public blog and becomes a draft.',
    cancel: 'Cancel',
    done: {
      submit: 'Submitted for review.',
      publish: 'Published.',
      schedule: 'Scheduled.',
      unpublish: 'Unpublished.',
      archive: 'Archived.',
      translation: 'French draft created.'
    },
    previewBlocked: 'Your browser blocked the preview window. Allow pop-ups for this site, then try again.'
  },
  media: {
    title: 'Media library',
    upload: 'Upload image',
    uploading: 'Uploading…',
    hint: 'Images are resized in your browser to 1600 px and 800 px wide WebP before upload.',
    empty: 'No images yet.',
    select: 'Use this image',
    delete: 'Delete',
    deleteConfirm: 'Delete this image?',
    inUse: 'A post still uses this image.',
    close: 'Close'
  },
  categories: {
    title: 'Categories',
    add: 'Add category',
    edit: 'Edit category',
    name: 'Name',
    slug: 'Slug',
    description: 'Description',
    order: 'Order',
    posts: 'Posts',
    language: 'Language',
    translation: 'Translation',
    addTranslation: 'Add {lang} version',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    deleteConfirm: 'Delete "{name}"? Posts keep existing; they just lose this category.',
    empty: 'No categories yet.',
    noPermission: 'Only staff with "Manage blog categories" can change categories.'
  },
  preview: {
    banner: 'Preview of an unpublished version. This link stops working at {time}.',
    bannerPublic: 'Preview of the current version. This link stops working at {time}.',
    expired: 'This preview link is invalid or has expired. Open the post in the Blog studio and click Preview again.',
    loading: 'Loading preview…',
    by: 'By {author}'
  }
};

/** Replaces {name} placeholders. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m));
}
