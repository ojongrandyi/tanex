// English master, area "blog" (CONTENT §15): the public blog's index, category and article pages
// (task F.3). Loaded with the page.
const blog = {
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
    // Added with F.3 (owner to confirm).
    categories: 'Categories',
    latest: 'Latest article',
    pagination: 'Blog pages',
    pageOf: 'Page {n} of {total}',
    loadError: "We couldn't load the articles. Please try again.",
    retry: 'Try again',
    rss: 'RSS feed',
    track: 'Track a shipment',
  },
  category: {
    back: 'All articles',
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
    // Added with F.3 (owner to confirm).
    shareOn: 'Share on {network}',
    back: 'Back to the blog',
    previous: 'Previous article',
    next: 'Next article',
    moreArticles: 'More articles',
    tags: 'Tags',
    notFoundTitle: 'Article not found',
    notFoundBody: "This article doesn't exist or is no longer published.",
    loadError: "We couldn't load this article. Please try again.",
  },
};

export default blog;
export type BlogMessages = typeof blog;
