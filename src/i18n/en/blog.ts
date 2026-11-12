// English master, area "blog" (CONTENT §15). `eyebrow`…`contact` are the "coming soon" page shown
// at /blog until the public blog (task F.3) publishes articles; `index` and `article` are the
// public blog's labels, added with F.2 for F.3 to use. Loaded with the page.
const blog = {
  eyebrow: 'Blog',
  title: 'Articles coming soon',
  sub: "We're preparing news, guides and shipping tips from the {company} team. Check back soon.",
  track: 'Track a shipment',
  contact: 'Contact us',
  index: {
    eyebrow: '{company} Blog',
    title: 'News, guides and shipping tips',
    sub: 'Practical advice on sending parcels in Cameroon and abroad, and news from the {company} team.',
    all: 'All',
    empty: 'Our first articles are on their way.',
    readMore: 'Read more',
    minRead: '{n} min read',
    newer: 'Newer',
    older: 'Older',
  },
  article: {
    by: 'By {author}',
    minRead: '{n} min read',
    share: 'Share',
    whatsapp: 'WhatsApp',
    facebook: 'Facebook',
    linkedin: 'LinkedIn',
    x: 'X',
    copyLink: 'Copy link',
    linkCopied: 'Link copied',
    related: 'Related articles',
    /** Shown only when the other-language version exists. */
    readTranslation: 'Read in French',
    ctaText: 'Need to send something?',
    ctaButton: 'Get a Quote',
  },
};

export default blog;
export type BlogMessages = typeof blog;
