// English master, area "blog": the "coming soon" page shown at /blog until the public blog
// (task F.3) publishes articles (CONTENT §13, owner to confirm). Loaded with the page.
const blog = {
  eyebrow: 'Blog',
  title: 'Articles coming soon',
  sub: "We're preparing news, guides and shipping tips from the {company} team. Check back soon.",
  track: 'Track a shipment',
  contact: 'Contact us',
};

export default blog;
export type BlogMessages = typeof blog;
