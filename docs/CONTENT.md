# TanEx: Content Deck (English master)

> **Context:** the platform is already built and working; TanEx is a rebrand + redesign + new features
> (`docs/TANEX_PLAN.md`). This file is the **only** source of English marketing and UI copy. French lives in
> `docs/CONTENT_FR.md` with the **same section numbers**. Code dictionaries (`src/i18n/en.ts`, `fr.ts`) are filled
> from these two files. Don't invent claims in code; if copy is missing, add it here first.

**Section numbers are stable** (code comments cite them, e.g. "CONTENT §6.3"). New material is added as new
subsections or as §14+.

**Placeholders.** `{{…}}` values come from `src/config/brand.ts` or the owner. Never ship a visible `{{…}}`; hide the
element if the value is empty.

| Placeholder | Value |
|---|---|
| `{{COMPANY}}` | TanEx |
| `{{LEGAL_NAME}}` | Tanex SARL |
| `{{TAGLINE}}` | From Your Door to the World |
| `{{EMAIL}}` | info@tanexsarl.com |
| `{{DOMAIN}}` | tanexsarl.com |
| `{{HQ_ADDRESS}}` | Check Point, opposite Molyko Omnisport Stadium, Buea, Cameroon |
| `{{DOUALA_OFFICE}}` | Kotto, La Canadienne, Douala, Cameroon |
| `{{PHONE}}` · `{{PHONE_2}}` | +237 651 05 93 45 · +237 691 19 46 63 |
| `{{WHATSAPP}}` | TBD: which of the two numbers is on WhatsApp (hidden until confirmed) |
| `{{HOURS}}` | 9:00 AM – 4:00 PM (days TBD; show the hours without days until confirmed) |
| `{{SLOGAN}}` | Saving Situations (from the owner flyer) |
| `{{WALL_LINE}}` | Office wall sign line, probably "Saving situations across continents": TBD |
| `{{SOCIAL}}` | Handle `Tanex_2025` on Facebook, Instagram, LinkedIn: profile URLs TBD (no icons until real URLs) |
| `{{MD_NAME}}` | Perry Tanyoh (owner, 2026-11-09) |
| `{{YEAR_FOUNDED}}` | TBD (owner). If unknown, no "years" stat |
| `{{JURISDICTION}}` | Republic of Cameroon (Tanex SARL), lawyer to confirm |
| `{{LOCAL_CITIES}}` | Buea, Limbe and Douala (from the active delivery cities in the database) |

**Claims policy.** "Open 24/7" is confirmed by the owner (2026-11-09) and is used only for opening hours. No response-time promises, statistics, testimonials, partner logos or certifications
unless the owner confirms them. Items marked **[confirm]** are best-knowledge drafts the owner must approve
(tracker #104).

---

## 1. Global: metadata, header, footer

### 1.1 Default and per-page meta
- **Default title:** `TanEx | Door-to-Door Delivery in Cameroon & Worldwide Shipping`
- **Default description:** `TanEx picks up from your door and delivers across Buea, Limbe and Douala by bike, between cities by truck, and worldwide by air, sea, rail and road, with one tracking ID.`
- **OG title:** `TanEx: From Your Door to the World` · **OG image:** `/brand/og-image.jpg`

| Page | `<title>` | Meta description |
|---|---|---|
| Home | (default) | (default) |
| Track | Track a Shipment \| TanEx | Enter your 8-character TanEx tracking ID to see where your parcel is, including live rider location for in-town deliveries. |
| Services | Logistics Services \| TanEx | Air, maritime, rail and road freight, warehousing, and same-city bike delivery in Buea, Limbe and Douala. |
| Local delivery | Bike Delivery in Buea, Limbe & Douala \| TanEx | Book a TanEx rider to collect and deliver across town, and follow the delivery live. |
| Quote | Get a Quote \| TanEx | Tell us what you're sending and where. Our team will send you a clear price. |
| Ship | Book a Shipment \| TanEx | Book a collection, add every piece and get your tracking ID straight away. |
| About | About TanEx | Who we are, how we work, and the team behind TanEx in Buea. |
| Locations | Our Network \| TanEx | From our base in Buea and the gateway of Douala to the world's main trade hubs. |
| Help | Help Centre \| TanEx | Answers on tracking, bike delivery, booking, customs, payments and documents. |
| Contact | Contact Us \| TanEx | Talk to the TanEx team in Buea by email, phone or WhatsApp. |
| Legal | Policies \| TanEx | Privacy, terms of service, shipping terms, cookies and accessibility. |
| Blog | Blog \| TanEx | News, guides and shipping tips from the TanEx team. |

### 1.1a Page not found (404)
- **Title:** `Page Not Found | TanEx` (noindex) · **Eyebrow:** `Error 404` · **H1:** `Page not found`
- **Sub:** `The page you're looking for doesn't exist or may have moved. Check the address, or use one of the links below.`
- **Buttons:** `Back to Home` · `Track a Shipment` · **Help line:** `Need help?` → `Contact us`

### 1.2 Header
- Nav (**owner's menu, 2026-11-09**): **Home** · **About Us** · **Track Shipment** · **Our Services** (menu: Air transport ·
  Road transport · Warehousing · Maritime transport · Rail transport · Local delivery · All services) · **Blog** · **Contact Us**.
  Ship (`Book a shipment`) and Network moved to the footer. The owner's note lists "Road Transport" twice; the second is read
  as **Rail transport** (owner to confirm).
- Primary button: **Get a Quote** · Language switch: `EN | FR`. A **Marketplace** button joins the header once the owner
  supplies its link (tracker #140).
- Utility bar (desktop): `{{PHONE}}` · `{{EMAIL}}` · `Open {{HOURS}}` · `Buea · Douala`
- Mobile drawer footer: `Need help? {{EMAIL}}`
- Interface strings added with C.3 (**owner to confirm**): drawer `Home` (first entry) · last item of the Services
  menu `All services` · `Menu` / `Open menu` / `Close menu` · `Skip to main content` · utility bar label `Contact details`
  · language switch label `Language`, French option hint `French version coming soon` (until the French site is live).
- Shown later: **Blog** (with the public blog, F.3); **Ship** becomes a menu when **Book a bike delivery** exists (G.6).
  Until the Services page has a section per service (E.2), the Services menu items open the Services page.

### 1.3 Footer
**Brand block:** TanEx logo (light) + `From Your Door to the World`
`Bike delivery across town, trucks between cities, and air, sea, rail and road freight to the world, with one tracking ID from the first door to the last.`

**Trust strip (4):**
1. **Door to world.** Across town, across Cameroon, across the world.
2. **Live tracking.** Follow your rider on the map in town.
3. **Photo proof.** Every delivery recorded with a photo and a name.
4. **English & French.** Our team serves you in both.

**Columns**
- *Services:* Air transport · Road transport · Warehousing · Maritime transport · Rail transport · Local delivery
- *Company:* About TanEx · Our network · Blog · Contact
- *Support:* Track a shipment · Book a shipment · Book a bike delivery · Help centre · Get a Quote
- *Legal:* Privacy Policy · Terms of Service · Shipping Terms · Cookie Policy · Accessibility

**Offices block:** `Buea (head office)`: `{{HQ_ADDRESS}}` · `Douala`: `{{DOUALA_OFFICE}}` · `Call {{PHONE}} · {{PHONE_2}}` · `Open {{HOURS}}`

**Bottom line:** `© {year} Tanex SARL. All rights reserved.` · social icons only with real URLs.

Built with C.3: *Company* shows **Blog** from F.3 and *Support* shows **Book a bike delivery** from G.6 (hidden until those
pages exist). Hidden headings for screen readers (**owner to confirm**): `Offices`, `Social media`.

### 1.4 Language, common messages and API errors (added 2026-11-08 with D.3, **owner to confirm**)
- **Language switch:** `EN | FR`; option names `English` · `Français`; group label `Language`; main navigation label `Main`; logo label `{{COMPANY}} home`.
- **French suggestion banner** (English home page, French browser; always shown in French, see CONTENT_FR §1.4). Its English twin, kept for parity: `This site is also available in English.` · `View the site in English` · `Close`.
- **Error messages** (shown for the API's error `code`; English pages keep the server's own, more specific English text):

| Code | Message |
|---|---|
| `BAD_REQUEST` | Some details aren't right. Check them and try again. |
| `AUTH_REQUIRED` | Please sign in to continue. |
| `FORBIDDEN` | You don't have permission to do this. |
| `NOT_FOUND` | We couldn't find what you were looking for. |
| `CONFLICT` | This was changed in the meantime. Refresh the page and try again. |
| `PAYLOAD_TOO_LARGE` | The file is too large. |
| `UNSUPPORTED_MEDIA_TYPE` · `MALFORMED_BODY` | This request couldn't be read. Refresh the page and try again. |
| `RATE_LIMITED` | Too many attempts. Please wait a while and try again. (§6.8) |
| `SERVER_ERROR` | Something went wrong on our side. Please try again. |
| `NETWORK` | We couldn't reach our server. Check your connection and try again. |
| `INVALID_TRACKING_ID` | Tracking IDs start with TX and are 8 characters long, e.g. TX7K2M9P. (§6.1) |
| `SHIPMENT_NOT_FOUND` | We couldn't find a shipment with this ID. Check the characters and try again. |
| `QUOTE_NOT_FOUND` | We couldn't find a quote with this reference. |
| `NO_PAYMENT_REQUEST` | This shipment has no payment request. |
| `NOT_ACCEPTING` · `TOO_MANY_OPEN` | as in §6.8 |
| `VALIDATION_FAILED` | Some details need fixing. |
| `MISSING_FIELDS` | Name and message are required. |
| `CONTACT_REQUIRED` | Please enter an email address or a phone number with its country code. |
| `INVALID_EMAIL` | Please enter a valid email address. |

- No cookie or consent banner exists: the public site sets no cookies (Legal → Cookie Policy). If one is added, its text goes here first.

---

## 2. Home page (owner's outline, 2026-11-06)

Order: 2.1 Hero · 2.2 Services · 2.3 Bike delivery · 2.4 Truck delivery · 2.5 Global network · 2.6 Smart labels ·
2.7 Get in touch · 2.8 FAQ · 2.9 Blog · Footer (§1.3). The whole page is one scroll journey: MOTION_3D_SPEC §6, copy §2.10.

### 2.1 Hero
- **Eyebrow:** `DOOR-TO-DOOR · CAMEROON & WORLDWIDE`
- **H1:** `From your door` / **`to the world.`** (second line takes the italic emphasis)
- **Sub:** `Same-day bike delivery across Buea, Limbe and Douala, trucks between cities, and air, sea, rail and road freight to anywhere you need to reach. One tracking ID, from pickup to proof of delivery.` **[confirm "same-day"]**
- **Track field:** label `Track a shipment` · placeholder `Enter your tracking ID, e.g. TX7K2M9P` · button `Track`
- **Buttons:** `Get a Quote` (primary) · `Book a bike delivery` (secondary)
- **Mini facts under the buttons (no numbers):** `Live rider tracking in town` · `Photo proof of delivery` · `English & French support`
- **Motion control:** see §2.10

### 2.2 Services (6 cards)
- **Eyebrow:** `OUR SERVICES` · **H2:** `Every way to move it, under one roof`
- **Intro:** `From a document across Buea to a container across the ocean, choose the mode that fits your cargo. We handle the booking, the paperwork and every hand-off.`
1. **Air freight.** Fast international shipping for documents, parcels and urgent cargo, with customs documents prepared for you. → `Air freight`
2. **Maritime freight.** Full (FCL) and shared (LCL) container shipping for heavier and larger loads, through Cameroon's ports. → `Maritime freight`
3. **Rail freight.** Cost-effective inland transport for heavy and bulk cargo on routes served by rail. **[confirm]** → `Rail freight`
4. **Road freight.** Trucks and vans between cities in Cameroon and across borders in the region. **[confirm cross-border]** → `Road freight`
5. **Warehousing.** Secure storage, stock checks, packing and dispatch when you're ready. **[confirm facilities]** → `Warehousing`
6. **Local delivery.** Bike couriers across Buea, Limbe and Douala, with live tracking and photo proof. → `Book a bike delivery`

### 2.3 Bike delivery
- **Eyebrow:** `IN-TOWN DELIVERY` · **H2:** `Across town, while you watch.`
- **Body:** `Need something taken from one side of Buea to the other? A TanEx rider collects it from your door and takes it straight to the recipient. You follow the ride live on the map, and you get a photo and a name when it's delivered.`
- **Steps (match the scene chips):** `Picked up` · `On the way` · `Delivered`
- **Price line:** `Anywhere in Buea from 500 FCFA.` (owner flyer; actual prices come from the admin tariffs)
- **Points:** `Riders in Buea, Limbe and Douala` · `Live location while on the way` · `Pay cash on delivery or by Mobile Money` · `Photo proof on every delivery`
- **CTA:** `Book a bike delivery` · secondary link `How pricing works` (→ Help, local delivery)

### 2.4 Truck delivery
- **Eyebrow:** `CITY TO CITY` · **H2:** `Bigger loads, between cities.`
- **Body:** `When it won't fit on a bike, our trucks and vans carry it between Limbe, Buea, Douala and beyond. We collect, load with care and deliver to the door, with the same tracking ID all the way.`
- **Points:** `Furniture, stock and pallets` · `Collection and delivery at both ends` · `Tracked city to city`
- **City pins (scene):** `Limbe` · `Buea` · `Douala` · `and beyond`
- **CTA:** `Get a truck quote` (→ Quote with Road selected)

### 2.5 Global network
- **Eyebrow:** `OUR NETWORK` · **H2:** `From Buea to the world's trade hubs`
- **Intro:** `Our base is in Buea, with the port and airport of Douala as our gateway to the world. From there we connect to the main hubs of Europe, Africa, the Middle East, Asia and the Americas.` **[confirm lanes, §9]**
- **Legend:** `TanEx base` · `Gateway` · `Trade lane` · **CTA:** `See our network →`

### 2.6 Smart labels
- **Eyebrow:** `SMART LABELS` · **H2:** `One label. Every checkpoint.`
- **Body:** `Every TanEx parcel carries a barcode label linked to its tracking ID. Each scan, at pickup, at our office, at the gateway, through customs and at the door, updates your tracking page.`
- **Capability tiles:** **8-character** "Tracking ID" · **Every piece** "Individually labelled" · **Live** "Status updates"
- **Demo label:** header `TANEX` + mark · `ORIGIN: DLA (DOUALA)` · `DESTINATION: CDG (PARIS)` · `WEIGHT: 12.5 KG` · `SERVICE: AIR FREIGHT` · barcode `TX7K2M9P` · caption `TRACKING ID: TX7K2M9P`

### 2.7 Get in touch (replaces "Need an urgent collection")
- **H2:** `Get in touch with us`
- **Body:** `Questions about a delivery, a price or a partnership? Send us a message and the TanEx team will get back to you.`
- **Channels (only those set):** `Call {{PHONE}}` · `Call {{PHONE_2}}` · `WhatsApp {{WHATSAPP}}` · `Email {{EMAIL}}` · `Visit us in Buea: {{HQ_ADDRESS}}` · `Visit us in Douala: {{DOUALA_OFFICE}}` · `Open {{HOURS}}`
- **Quick form:** Name · Phone or email · Message · button `Send message`
- **Success:** **Message received.** `Your reference is TX-TKT-######. We'll get back to you as soon as possible.`

### 2.8 FAQ (home, 6 items)
- **Eyebrow / H2:** `COMMON QUESTIONS` · `Frequently asked questions`
1. **Do I need an account to track a shipment?** No. Enter your 8-character tracking ID (for example TX7K2M9P) on the Track page. Personal details are hidden for privacy.
2. **Where do you deliver in town?** Our riders deliver within Buea, Limbe and Douala, for example from one Buea neighbourhood to another. Choose your city and areas when you book to see the price.
3. **Can I follow my rider live?** Yes. Once your parcel is picked up, your tracking page shows the rider's position on the map until it's delivered.
4. **How can I pay?** Pay in cash to the rider, or by MTN Mobile Money or Orange Money to the TanEx company accounts shown when you book. Other payment options are available for international shipments.
5. **Do you ship internationally?** Yes. We ship worldwide by air, sea, rail and road, and prepare the export documents with you.
6. **Can I write to you in French?** Yes. Our team works in English and French.

### 2.9 From the blog
- **Eyebrow:** `FROM THE BLOG` · **H2:** `News and shipping tips` · **Link:** `All articles →`
- Shows the latest 3 published posts in the current language; the section is hidden when there are none.

### 2.10 The Journey: chapter beats and route rail (MOTION_3D_SPEC §6–§7)
- **Route rail label (screen readers):** `Page sections` · **Chapters:** `Your door` · `Services` · `In town` · `City to city` · `The world` · `Smart label` · `Contact` · `Delivered`
- **Motion control:** `Pause motion` / `Play motion`
- **Hero dive caption (as the camera reaches the door):** `It starts at your door.`
- **Bike chapter beats:** `Picked up.` · `On the way.` · `Delivered.`
- **Truck chapter caption:** `Too big for the bike? The truck takes it from here.`
- **World chapter caption:** `And when it has to cross borders, it flies.`
- **Label chapter caption:** `Every step, one label: TX7K2M9P.`
- **Footer arrival:** `Delivered. From your door to the world, and back to a door.`

### 2.11 Interface strings added with E.1 (**owner to confirm**)
- **Get in touch form:** heading `Send us a message` · busy `Sending…` · errors `Please fill in your name, a phone number or email, and your message.` · `Please enter an email address or a phone number with its country code.` · `We couldn't send your message. Please try again.` · after success `Send another message` · channel labels `Call` · `WhatsApp` · `Email` · `Open` · list name (screen readers) `Ways to reach us`
- **Bike chapter:** steps list name (screen readers) `Delivery steps`
- **Network map:** region name `Map of the TanEx network: Buea, Douala and the trade hubs we connect to` · place picker `Choose a place` · selected place card: modes `Air` · `Sea` · `Road` · `Local time` · `Contact us about this lane` (§5)
- **Smart label demo:** name (screen readers) `Example of a TanEx parcel label` · field names `Origin` · `Destination` · `Weight` · `Service`
- Until the bike booking page exists (G.6), every `Book a bike delivery` button opens the Local delivery section of the Services page.
- The motion control (`Pause motion` / `Play motion`, §2.10) appears with the motion in phase H; before that the page has no motion to pause.

---

## 3. Services page

- **Hero eyebrow:** `OUR SERVICES` · **H1:** `Every way to move it, under one roof.`
- **Sub:** `Choose the mode that fits your cargo and your timeline. We take care of the route, the paperwork and every hand-off.`
- **Section eyebrows:** `SERVICES` · `COMPARE` · `HOW IT WORKS` · `ADD-ONS`
- **Panel labels:** `Highlights` · `Good for` · buttons `Get a Quote` · `Track a Shipment`

### 3.1 Services (all **[confirm]**: drafted from best available knowledge, no numbers)

**Air freight**
- *Summary:* International air shipping for documents, parcels and time-sensitive cargo.
- *Highlights:* Collection from your door · Export documents prepared with you · Customs clearance support · Tracked from pickup to delivery
- *Good for:* documents, samples, spare parts, e-commerce orders, personal parcels abroad

**Maritime freight**
- *Summary:* Ocean shipping in full containers (FCL) or shared containers (LCL) for larger and heavier loads.
- *Highlights:* FCL and LCL · Port handling and documentation · Import and export · Delivery to the door after clearance
- *Good for:* business stock, machinery, vehicles, household moves

**Rail freight**
- *Summary:* Inland transport for heavy and bulk cargo on routes served by rail, combined with road delivery at each end.
- *Highlights:* Cost-effective for heavy loads · Booked and tracked by our team · Road collection and delivery to complete the trip
- *Good for:* bulk goods, construction materials, agricultural produce

**Road freight**
- *Summary:* Truck and van transport between cities in Cameroon and to neighbouring countries.
- *Highlights:* Full and part loads · Door-to-door collection and delivery · Tracked city to city
- *Good for:* furniture, retail stock, pallets, deliveries between Limbe, Buea, Douala and beyond

**Warehousing**
- *Summary:* Secure storage for your goods, with receiving, stock checks, packing and dispatch.
- *Highlights:* Short- and long-term storage · Goods checked in and recorded · Pick, pack and dispatch on request · Combined with any of our transport services
- *Good for:* traders, online sellers, importers waiting for onward delivery

**Local delivery (bike)**
- *Summary:* Same-city delivery by TanEx riders in Buea, Limbe and Douala, with live tracking.
- *Highlights:* Collected from your door · Live rider location · Photo proof of delivery · Cash or Mobile Money
- *Good for:* documents, food orders, phones and small parcels, online shop deliveries

### 3.2 Compare (table)
| Service | Best for | Speed | Tracking |
|---|---|---|---|
| Local delivery | Small items within one city | Fastest, same city | Live rider location |
| Road freight | Bigger loads between cities | Scheduled trips | City-to-city updates |
| Air freight | Urgent international shipments | Fastest international | Every milestone |
| Maritime freight | Large or heavy international loads | Scheduled sailings | Every milestone |
| Rail freight | Heavy and bulk cargo inland | Scheduled departures | Every milestone |
| Warehousing | Storing goods before delivery | n/a | Stock records |

### 3.3 How it works (4 steps; also used on Home motion captions and Ship)
1. **Book.** Book online, on WhatsApp or at our office. You get your 8-character tracking ID straight away.
2. **Collect.** We collect from your door, check and label every piece.
3. **Move.** By bike, truck, air, sea or rail. Every hand-off is recorded.
4. **Deliver.** Delivered to the door, with a photo and the recipient's name as proof.

### 3.4 Add-ons **[confirm]**
1. **Express (in town).** Priority pickup for urgent same-city deliveries.
2. **Cash on delivery.** The rider collects payment for your goods from the recipient and we pay it to you.
3. **Delivery code.** The recipient gives a 4-digit code to the rider before handover.
4. **Packing.** We pack and protect your items before shipping.

### 3.5 Process strip
Uses §3.3.

### 3.6 CTA (also on About)
- **H2:** `Ready to send something?` · **Body:** `Get a clear price, or book a bike delivery in a few minutes.` · **Buttons:** `Get a Quote` · `Book a bike delivery`

### 3.7 Interface strings added with E.2 (**owner to confirm**)
- **Section headings** under the eyebrows: `Six ways to move it` (SERVICES) · `Which service fits?` (COMPARE) · `From booking to the door` (HOW IT WORKS) · `Extras when you need them` (ADD-ONS)
- In-page menu name (screen readers) `Services on this page` · table caption (screen readers) `Our services compared` · table headers as in §3.2
- Each service has a stable address: `/services/air`, `/services/maritime`, `/services/rail`, `/services/road`, `/services/warehousing`, `/services/local-delivery` (French: `/fr/services/…`). Until the bike booking page exists (G.6), the Local delivery panel offers `Get a Quote`.

---

## 4. About page

- **Hero eyebrow:** `ABOUT TANEX` · **H1:** `From our door in Buea to yours, wherever it is.`
- **Sub:** `TanEx is a delivery and logistics company based in Buea, with an office in Douala. We move parcels across town by bike, between cities by truck, and from Cameroon to the world by air, sea, rail and road.`
- **Slogan line (small, under the H1):** `{{SLOGAN}}.`
- **Our approach (4):**
  1. **One tracking ID.** From the first door to the last.
  2. **Named couriers.** Every delivery has a TanEx rider or driver accountable for it.
  3. **Proof, not promises.** Photo and name at every delivery.
  4. **Two languages.** We serve you in English and French.
- **Leadership:** eyebrow `LEADERSHIP` · photo `about-md` · name `{{MD_NAME}}` · title `Managing Director` · then `Enoh Arnold`, `Head of Operations` and `Eyoung Delgo`, `Regional Manager` (owner, 2026-11-09) · a short message only if the owner supplies it (never written for him).
- **Opening hours:** `Open 24/7` (header, footer, About, Contact, homepage).
- **Our team:** `The TanEx team wears the brown and orange you'll see at your door.` (photo `about-team` when supplied)
- **Story:** **H2** `Why TanEx` · `{{WALL_LINE}}` shown as a pull quote when supplied. Story text: owner to supply (founding year, first routes). Until then this block is hidden; don't invent a timeline.
- **CTA:** §3.6.

### 4.1 Interface strings added with E.3 (**owner to confirm**)
- Approach heading `How we work` (under `OUR APPROACH`) · team eyebrow `OUR TEAM`
- While `{{MD_NAME}}` is not supplied, the leadership block's heading is the title `Managing Director`; the name replaces it when known.
- Offices block `Where to find us`: `Buea, head office` · `Douala` with the addresses, `Open {{HOURS}}` and the link `Contact us`
- The slogan line under the hero shows `Saving Situations.` in both languages until #102 is answered.

---

## 5. Locations / Network page

- **Hero eyebrow:** `OUR NETWORK` · **H1:** `Local roots. Global reach.`
- **Sub:** `We deliver every day in Buea, Limbe and Douala, and connect through Douala to the world's main trade hubs.`
- **Blocks:** `Where our riders deliver` (active delivery cities and zones from the database) · `Our gateways and trade lanes` (map + list, §9)
- **Card fields:** Name · City, Country · Modes · Local time (live) · `Contact us about this lane`
- **Note:** `Don't see your destination? We ship well beyond these hubs. Ask us about your route.`

### 5.1 Interface strings added with E.3 (**owner to confirm**)
- Riders block intro `Bike delivery inside each city, and trucks between them.` · role chips `Head office` · `Office` · `Bike delivery` · `Airport and port gateway`
- Gateways block intro `Trade hubs we ship to from Douala. They are gateways we serve, not TanEx offices.` · region names `Africa` · `Europe` · `Middle East` · `Asia` · `Americas` · `Modes` (`Air` · `Sea` · `Road`) · `Show on the map` (screen readers: `Show on the map: {place}`) · `Choose a place` · note button `Ask about your route`
- Gateway names in French: CONTENT_FR §9.

---
## 6. Track, Track Result, loading, support

### 6.1 Track page
- **H1:** `Track your shipment`
- **Sub:** `Enter your 8-character TanEx tracking ID to see where your shipment is right now.`
- **Input placeholder:** `e.g. TX7K2M9P` · **Button:** `Track`
- **Validation:** `Tracking IDs start with TX and are 8 characters long, e.g. TX7K2M9P.`
- **Not found:** `We couldn't find a shipment with ID {id}. Check the characters and try again, or contact us and we'll look it up for you.`
- **"Where to find your ID" (3 cards):**
  1. **Booking confirmation.** It's in the email or WhatsApp message we sent when your shipment was booked.
  2. **Waybill / label.** Printed at the top of your waybill and on every piece label.
  3. **Your coordinator.** Any TanEx coordinator can find it from your name, reference or phone number.
- **Multi-track (if kept):** **Track several shipments** · `Enter up to 10 tracking IDs, one per line.`
- **Help banner:** **Need help with an active shipment?** `Our team is here to help.` → `Contact Support`

### 6.2 Loading screen
Rotating lines: `Locating your shipment…` · `Checking the latest scans…` · `Plotting the route…`

### 6.3 Track Result: labels
- Status names: **Booked** · **Collected** · **At origin gateway** · **Departed** · **In transit** · **Arrived at destination gateway** · **Customs clearance** · **Out for delivery** · **Delivered** · **On hold** · **Delayed** · **Returning to sender**
- Panels: **Shipment summary** · **Route** · **Journey timeline** · **Pieces** · **Documents** · **Need help?**
- Mode labels on legs: `By air` · `By sea` · `By road`
- Public facility for admin actions: `TanEx Operations Centre`
- ETA line: `Estimated delivery: {date}, {window} ({local time zone})`
- Delivered line: `Delivered {date} at {time}. Signed by {masked name}.`

### 6.4 Support modal
- **H3:** `How can we help with this shipment?`
- Fields: Tracking ID (pre-filled) · Issue type (Delay · Address change · Damage · Customs question · Other) · Message · Email
- **Success:** `Ticket TX-TKT-###### opened for {tracking ID}. We'll reply to {email} shortly.`
- Also a **Name** field (the Messages inbox needs a name to reply to; owner approved 2026-09-29). Submit button: `Open ticket`.

### 6.5 Interface labels (owner approved 2026-09-29)
- Track page tabs: `One ID` · `Track several shipments` · recent searches: `Recently tracked`
- Several-shipments results: `Open tracking` (button) · `Last seen` · `{n} of {m} found`
- Track Result: `Back to tracking` · `Last scan` · `Show scan history` / `Hide scan history`
- Admin quick action (records a scan at a hub; shown publicly as In transit): `Hub scan`
- Older status codes are shown as: Exception → On hold · Delivery attempted → Delayed · At facility (intermediate hub) → In transit · Created / Awaiting pickup → Booked · Cancelled → `Cancelled`

### 6.6 Track Result: package images (added 2026-10-10 with update B.5, **owner to confirm**)
- **Heading:** `Package images`
- **Intro:** `Photos our team has added for this shipment.`
- **Empty state:** `No photos have been added for this shipment yet.` (Not shown by default: the section is hidden when there are no photos.)
- **Each photo:** the caption the admin wrote, shown under the photo and used as its alt text. Older photos saved without a caption: `Shipment photo {n}`.
- **Full-screen viewer:** `Photo {n} of {total}` · buttons `Previous photo` · `Next photo` · `Close` · open-button label `Open photo: {caption}`

### 6.7 Payment methods: names, field labels, buttons, warnings (added 2026-10-10 with update C.1, **owner to confirm**)
Source of truth in code: `src/shared/paymentMethods.ts`. The admin can override a method's display name per account.
The rest of the payment section (heading, status labels, proof form) is in §6.8.

| Method name | Fields shown to the customer (each with a Copy button) | Button / extra |
|---|---|---|
| `PayPal` | `PayPal email` · `Account name` | `Open PayPal` (when a PayPal.Me link is set) + QR |
| `Bitcoin (BTC)` | `Network` · `Wallet address` | QR + network warning |
| `USDT (Tether)` | `Network` · `Wallet address` | QR + network warning |
| `Ethereum (ETH)` | `Network` · `Wallet address` | QR + network warning |
| `Zelle` | `Zelle email` · `Zelle phone (US)` · `Recipient name` | |
| `Cash App` | `$Cashtag` · `Name` | `Open Cash App` |
| `Venmo` | `Venmo username` · `Name` | `Open Venmo` |
| `Apple Pay / Apple Cash` | `Phone` · `Email` · `Name` | |
| `Google Pay` | `Phone` · `Email` · `Name` | |
| `US bank transfer (ACH / wire)` | `Account name` · `Bank` · `Routing number` · `Account number` · `Account type` · `Bank address` | |
| `UK bank transfer (Faster Payments)` | `Account name` · `Bank` · `Sort code` · `Account number` | |
| `International wire (SWIFT / IBAN)` | `Beneficiary` · `Bank` · `IBAN` · `Account number` · `SWIFT/BIC` · `Bank address` · `Bank country` | |
| `Wise` | `Wise email` · `Wisetag` · `Name` | |
| `Revolut` | `Revtag` · `Phone` · `Name` | |
| `Card payment link` | (none) | `Pay by card` + QR |
| `Western Union` | `Receiver full name` · `Country` · `City` | note below |
| `MoneyGram` | `Receiver full name` · `Country` · `City` | note below |

- **Crypto network warning:** `Send only {coin} on the {network} network. Funds sent on another network can be lost.`
- **Western Union note:** `After sending, enter the MTCN (money transfer control number) as your payment reference.`
- **MoneyGram note:** `After sending, enter the MoneyGram reference number as your payment reference.`
- Optional fields the admin leaves empty are not shown.
- **Copy buttons:** `Copy` → `Copied` (2 seconds) · screen-reader announcement `{field} copied` · if the browser blocks copying: `Could not copy. Select the {field} and copy it manually.`
- The admin's own **instructions** for an account appear at the bottom of its card, as written.

### 6.8 Track Result: payment section (added 2026-10-10 with update E.1, **owner to confirm**)
Shown only when the shipment has a payment request. Hidden completely when the request is cancelled.

**Summary**
- **Heading:** `Payment`
- **Intro (awaiting payment):** `A payment is due for this shipment. Pay using any one of the accounts below, then send us your proof of payment.`
- **Labels:** `Amount due` · `For` (the charge reason the admin wrote) · `Due by` (date, only when set) · `Note from our team` (the customer note, only when set)
- **Status badges:** `Awaiting payment` · `Proof under review` · `Paid` · `Cancelled`

**Payment accounts**
- **Tab (update I.2, closed by default):** title `How to pay` · sub `Choose one of {n} payment options` (one account: `1 payment option`). Opening it shows the sub-line and the accounts below.
- **Heading:** `How to pay`
- **Sub:** `Choose one account. You only need to pay once.`
- **Mobile accordion:** each method name is a button; screen-reader state `Show details` / `Hide details`. One open at a time.
- **QR code:** button `Show QR code` / `Hide QR code` · image alt `QR code for {method}` · caption `Scan with your wallet or camera app.`
- **Copy toast (visible, 2 seconds):** `{field} copied` (same text as the screen-reader announcement in §6.7)

**Paid**
- **Heading line:** `Payment received`
- **Text:** `Thank you. We received your payment on {date}.` · without a date: `Thank you. We have received your payment.`
- Accounts are collapsed: `Show payment accounts` / `Hide payment accounts` (same tab design as above, update I.2)

**Proof of payment (update F.3, F.4)**
- **Tab (update I.3, closed by default):** title `Send proof of payment` · sub `Already paid? Upload your receipt so we can confirm it.` Opening it shows the form.
- **Heading:** `Send proof of payment`
- **Intro:** `After paying, upload a screenshot or photo of the receipt so our team can confirm it.`
- **Fields:** `Account you paid to` (placeholder `Choose an account`) · `Your name` (hint `The name the payment was sent from`) · `Amount sent` · `Payment reference (optional)` (hint `Transaction ID, MTCN or reference number`) · `Screenshot of the payment` (hint `JPG, PNG, WebP or HEIC. Only our team can see it.`)
- **Buttons:** `Choose image` · `Change image` · `Remove image` · `Send proof` · while sending `Sending…`
- **Field errors:** `Choose the account you paid to.` · `Enter the name the payment was sent from.` · `Enter the amount you sent.` · `Add a screenshot of the payment.` · `This file isn't an image. Upload a JPG, PNG, WebP or HEIC.` · `This image could not be read. Try another file or take a new screenshot.`
- **Success:** `Thank you. Your proof of payment was sent. We'll check it and update this page.`
- **Under review:** `Proof under review` · `We received your proof on {date} at {time}. Our team will check it and update this page.`
- **Rejected:** `Proof not accepted: {reason}` · `Please check the details and send a new proof below.`
- **Tracking event when the admin approves a proof** (update F.6, optional, on by default): title `Payment confirmed` · description `Payment received for: {charge reason}.` · facility `{{COMPANY_SHORT}} Operations Centre` (as in §6.3)
- **Errors:** `We couldn't send your proof. Check your connection and try again.` · too many attempts: `Too many attempts. Please wait a while and try again.` · too many open proofs: `We already have proofs waiting for review for this payment. Our team will check them first.` · status changed: `This payment is no longer waiting for a proof. Refresh the page to see its current status.`

### 6.9 Track Result: local and intercity deliveries (added 2026-11-06, DISPATCH_SPEC §8)
- **Stepper:** `Requested` · `Courier assigned` · `Picked up` · `On the way` · `Delivered` (failed attempt shows `Delivery attempt unsuccessful` in amber with the reason)
- **Courier card:** `Your rider` / `Your driver` · `{first name}` · vehicle `Bike` / `Van` / `Truck` · photo only with consent
- **Live map:** heading `Live location` · `Updated {n} seconds ago` · when stale: `Waiting for the rider's next location update` · after delivery the map shows the route only
- **ETA:** `Arriving in about {n} min` · `Approximate, based on the rider's current position`
- **Delivered:** `Delivered at {time}, received by {masked name}.` · `Photo proof recorded`
- **Share:** `Share tracking on WhatsApp`

### 6.10 Payment methods added for TanEx (extends §6.7)
| Method name | Fields shown to the customer (each with Copy) | Extra |
|---|---|---|
| `MTN Mobile Money` | `Account name` · `MoMo number` · `Merchant code` (optional) | admin instructions, e.g. the USSD steps |
| `Orange Money` | `Account name` · `Orange Money number` · `Merchant code` (optional) | admin instructions |
| `Cash on delivery` | (none) | `Pay the rider in cash when your parcel arrives. Ask for your receipt reference.` |
- **Reference hint for MoMo/OM proofs:** `Enter the transaction ID from your confirmation SMS.`
- *Added with E.6 (owner to confirm):* payment requests are in XAF by default and shown as `15,000 FCFA` / `15 000 FCFA`; cash on delivery is not offered as an account to send proof for. French texts for every method, field and note: CONTENT_FR §6.7 / `src/i18n/paymentTerms.ts`.
- *Console (E.6):* Settings field `Business registration (RCCM / NIU)` (optional; replaces the U.S. carrier number, #39) with the hint `Optional. Shown on the public Contact page when filled in.`

### 6.11 Timeline events written by the system (added 2026-11-08 with D.3, **owner to confirm**)
Titles the server writes itself (`src/shared/eventTitles.ts`); stored with a key so the French track page shows the
French title. These are the existing English titles, unchanged; events staff type keep their own text.
`Consignment Registered & Barcode Issued` (booking) · `Consignment Registered from Rate Quote` (quote converted) ·
`Return Shipment Registered` · `Returning to sender: {reason}` · `Departed Facility — Transit Underway` (automatic) ·
`Payment confirmed` (§6.8) · `Checkpoint Scan Verified` (event added without a title) · a status change without a title
shows the status name (§6.3).

### 6.12 Interface strings added with E.5 (**owner to confirm**)
- **Track page:** eyebrow `Track` · tabs name `How to track` · `Clear` · batch filter name `Show` · `All ({n})` · results `Origin` · `Destination` · `Last seen` · `Estimated delivery` · `Open tracking` · `{n} of {m} found` · `Close`. The help band says `Our team is here to help.` (§6.1; the earlier "24/7" line was an unconfirmed claim and is gone). "Where to find your ID" says email or WhatsApp, as §6.1.
- **Support dialog:** `Cancel` · `Close` · without a tracking ID: `Ticket TX-TKT-###### opened. We'll reply to {email} shortly.`
- **Track Result:** metric labels `Service` · `Estimated delivery` · `Distance` · `Current status`; `Tracking ID` · `Copy tracking ID` · `Copied` · `Last scan` · `Revised` · `On schedule` · `Shipment type` · `Total weight`; route `Total route {distance} · {mode}` · `{n}% complete`; map `Origin` · `Destination` · `Current position` · `Estimated position` · `Zoom in` · `Zoom out` · `Show the whole route` · map style `Streets` / `Satellite` / `Dark` · `Estimated position (based on the schedule):` · `Progressing along the planned route near {place}`; timeline `{n} of {m} milestones` · `Confirmed` · `Current` · `Estimated` · `All scans` · `No scans recorded yet.`; cards `Sender and recipient` · `From (sender)` · `To (recipient)` · `Special handling` · `Fragile:` · `Signature required:` · `Oversized:` · `Yes` / `No`; cargo-type detail labels (pets, pallets, containers, freight, documents) as in the code.
- Removed in E.5 (they promised things that don't happen or showed invented values): the "Get Delivery Alerts" form (#46, it saved nothing), "Transport type: Open Auto Carrier", "Vehicle handling: Standard No Liftgate Required", and the "New York" / "Los Angeles" placeholders shown when a city was missing.

---

## 7. Quote, Ship, Public Quote Result

### 7.1 Quote page
- **H1:** `Get a rate quote`
- **Sub:** `Tell us what you're moving and where. A coordinator will confirm your rate, usually the same business day. [confirm]`
- **Form sections:** Route (from country/city → to country/city) · Cargo (pieces, weight in kg/lb, dimensions, contents, declared value) · Service (Express / Freight / Vehicle / Secure Vault) · Your details
- **Side card:** **Straight answers, no surprises.** `Your quote includes the service, estimated transit time and every known charge, so the price you accept is the price you pay (duties and taxes as applicable).`
- **Success H2:** `Quote request received`
- **What happens next:** 1. A coordinator reviews your lane and cargo. 2. You receive your rate by email with a secure quote link. 3. Accept it online and we'll book your collection.

### 7.2 Public Quote Result
- **H1:** `Your TanEx quote` · Labels: Quote reference · Valid until · Route · Service · Estimated transit · Charges breakdown · Total
- Footer line: `{{DOMAIN}} · Secure quote link`
- Buttons: `Accept & Book` · `Download PDF` · `Ask a question`

### 7.3 Ship page
- **H1:** `Book a shipment`
- Steps: **1. Sender & collection** · **2. Recipient & delivery** · **3. Pieces** · **4. Service & extras** · **Summary**
- **Success H2:** `Shipment booked`. Body: `Your tracking ID is {ID}. Labels for each piece are ready to print.`
- **Next steps:** Print and attach a label to each piece · Have the shipment ready at the collection time · Track progress any time with your ID
- **How booking works:** Booking → Gateway scan → Linehaul & border crossing → Proof of delivery

### 7.4 Interface labels (added 2026-09-29 with 3.6/3.7, **owner to confirm**)
Reused where possible: service names and summaries (§3.1), add-ons (§3.4), stage bodies (§2.3, as on Services §3.5), the §7.1 side card as the quote's terms.
- **Quote form:** sections `1. Route` (`From` / `To`) · `2. Cargo` · `3. Service` · `4. Your details`; fields `Pieces` · `Weight` · `Declared value` · `Dimensions` · `Contents` · `Service` · `Transport mode` · `Special instructions` · `Name` · `Company` · `Email` · `Phone`; submit `Request a Quote` (§8.1 quick link).
- **Quote success:** `Quote reference {ref}` · `What happens next` · buttons `View your quote` · `Request another quote`.
- **Quote Result:** status names `In review` · `Ready` · `Accepted` · `Booked` · `Declined` · `Expired`; while in review: `Quote request received` + the §7.1 next steps; charge lines `Transport ({route})` · `Oversize handling` · `Special handling` (only lines the coordinator filled in); after accepting: `Quote accepted` · `We'll book your collection.` (from §7.1 step 3) or `Tracking ID {ID}` once booked; `Copy reference`; side cards `Your details` · `TanEx Operations Desk`. "Download PDF" opens the browser's print dialog (Save as PDF).
- **Ship page:** collection choice `Book a Collection` (§8.1) · `Drop-off at the TanEx office` · `Collection time`; field labels `Sender name` · `Recipient name` · `Phone` · `Street address` · `Company` · `Delivery instructions` · `Contents`; buttons `Continue` · `Back` · `Add a piece` · `Book shipment` · `Print labels` · `Copy tracking ID` · `Book another shipment`.
- **Ship summary note:** `Your coordinator confirms the rate before collection.`

### 7.6 Quote changes with E.5 (**owner to confirm**)
- **Services on the Quote and Ship forms** are TanEx's six (§3.1): `Air freight` · `Maritime freight` · `Rail freight` · `Road freight` · `Warehousing` · `Local delivery` (they replace the previous Express / Freight / Vehicle / Secure Vault list; older quotes keep the name they were saved with). "Get a Quote" on a service preselects it.
- Defaults: origin country Cameroon, phone calling code +237. Placeholders `e.g. Buea` (from) · `e.g. Paris` (to) · contents `e.g. Machine spare parts`.
- Field labels: `Country` · `Search country…` · `City` · `State` / `Province` / `Region` · `ZIP code` / `Postal code` / `Postcode` · `(optional)` · `Units` · `Weight ({unit})` · `Declared value ({currency})` · `Dimensions (L × W × H, {unit})` · `Length` / `Width` / `Height ({unit})` · `Transport mode` · `Let TanEx recommend` · modes `Air` · `Sea` · `Road` · `Phone number` · `Country calling code`.
- Messages: `Please complete all required fields (origin and destination country and city, weight, contents, name and email).` · `We couldn't send your quote request: {reason}. Nothing was saved; please try again.` · `{n} piece` / `{n} pieces`.
- Quote Result: the side card is `TanEx Operations Desk` (§7.4; the earlier "24/7 Operations Desk" was an unconfirmed claim) · charge `Transport` when there is no route · print table headers `Charge` · `Amount ({currency})`.

### 7.7 Ship page changes with E.5 (**owner to confirm**, closes #33)
- Collection choice `Book a Collection` / `Drop-off at the TanEx office` (§7.4). **Collection time** `Today` · `Tomorrow morning` · `Tomorrow afternoon` with the hint `Your coordinator confirms the exact time.` (the previous fixed hour windows were not TanEx's).
- Extras: `Signature confirmation` (`Delivery is released only against a named signature.`). **Weekend delivery is not offered** until the opening days are known (#119).
- "How booking works" uses the four steps of §3.3 (`Book.` · `Collect.` · `Move.` · `Deliver.`).
- A booking no longer stamps "{city} Regional Gateway" or a fixed "2-3 Business Days / by 5:00 PM" estimate: the first scan shows the city, and the estimate stays empty ("—") until staff set it. Messages: `Each piece must have a valid weight ({unit}).` · `We couldn't find {place}. Check the city and country, then try again.` · `We couldn't register your shipment: {reason}. Nothing was saved; please try again.` · `Remove piece {n}` · `Piece {n} of {total}` · `{n} ({weight} gross)`.

### 7.5 Local delivery booking (`/local-delivery`, added 2026-11-06, DISPATCH_SPEC §8)
- **H1:** `Book a bike delivery` · **Sub:** `Across Buea, Limbe or Douala. A TanEx rider collects from the door and delivers to the recipient, and you follow the ride live.`
- **Steps:** `1. City` · `2. Pickup` · `3. Drop-off` · `4. Parcel` · `5. Payment` · `Summary`
- **Fields:** `City` · `Area` (zone list) · `Landmark or directions` (hint `For example: "Opposite the Total station, blue gate"`) · `Contact name` · `Contact phone` · `Pin on map (optional)` · `Recipient name` · `Recipient phone` · `Parcel size` (`Small: fits in a backpack` · `Medium: fits in the rider's box` · `Large: needs a van`) · `What is it?` · `Express pickup` · `Who pays?` (`I pay` / `The recipient pays`) · `Collect money for my goods (cash on delivery)` + `Amount` · `Preferred pickup time` · `Your email (optional, for the receipt)`
- **Price box:** `Delivery price: {amount}` · when no rate: `We'll confirm your price by phone or WhatsApp before pickup.`
- **Submit:** `Book delivery` · while sending `Booking…`
- **Success:** **Delivery booked.** `Your tracking ID is {ID}.` · buttons `Track this delivery` · `Send tracking to the recipient on WhatsApp` · `Book another delivery`
- **Large parcels:** `Large items travel by van. We'll confirm the price before pickup.`

---

## 8. Help Centre and Contact

### 8.1 Help: hero and quick links
- **H1:** `How can we help?` · Search placeholder: `Search for answers, e.g. customs, delivery time, documents`
- Quick links: **Track a Shipment** · **Book a Collection** · **Request a Quote** · **TanEx Operations Desk**
- Empty search: **No matching answers.** `Try different words, or contact us and we'll answer directly.`
- Footer banner: **Still need help with a shipment?** → `Contact Support`

### 8.2 Help: knowledge base (heading `Answers to common questions`)
**Tracking**
- *Where do I find my tracking ID?* On your booking confirmation, at the top of your waybill and on every piece label. It's 8 characters and starts with TX (e.g. TX7K2M9P).
- *Why hasn't my tracking updated?* Updates appear at each scan. On long air or ocean legs there can be several hours between scans. The estimated position keeps moving in the meantime.
- *How do multi-piece shipments work?* All pieces share one tracking ID. Each piece has its own label ending in -01, -02 and so on.

**Booking & collection**
- *What's the cut-off for same-day collection?* It depends on your city and service. Your coordinator confirms it at booking. [confirm the standard cut-off]
- *How should I pack my shipment?* Use a strong outer box, cushion every item and seal all seams. For high-value items, ask for our Secure Vault packaging.
- *Can I change the delivery address?* Yes, before the shipment reaches the destination gateway. Contact us with your tracking ID.

**Customs & international**
- *Who pays duties and taxes?* That's agreed at booking: either the sender (duties paid) or the recipient (duties unpaid).
- *What documents do I need?* Usually a commercial invoice and, for some goods, permits or certificates. We'll tell you exactly what your lane needs.
- *What can't I ship?* Prohibited and restricted items vary by country. See our Shipping Terms, or ask us before you book.

**Documents & delivery**
- *Where's my proof of delivery?* On your tracking page as soon as the shipment is delivered, available to download as a PDF.
- *What if my shipment is damaged?* Tell us within 7 days of delivery, with photos [confirm the period]. We'll open a claim and keep you updated.

### 8.3 Contact page
- **H1:** `Talk to TanEx`
- **Sub:** `Questions, quotes or a shipment that needs attention: a real coordinator will get back to you.`
- **Channels:** Phone `{{PHONE}}` · `{{PHONE_2}}` · WhatsApp `{{WHATSAPP}}` · Email `{{EMAIL}}` (hide any that are empty)
- **Offices (cards with map pin and a `Get directions` link):** **Buea, head office** · `Check Point, directly opposite Molyko Omnisport Stadium` · **Douala** · `Kotto, La Canadienne` · **Opening hours** `{{HOURS}}`
- **Form title:** `Send us a message`. Fields: Name · Email · Phone (optional) · Topic (Quote · Active shipment · Billing · Partnership · Other) · Tracking ID (optional) · Message
- **Success:** **Message received.** `Your reference is TX-TKT-######. We'll reply to {email} as soon as possible.`
- **Help card:** **TanEx Operations Desk.** `For active shipments, include your tracking ID for the fastest help.` (Say "Average response under 30 minutes" only if confirmed.)
- **FAQ block heading:** `Quick answers` (reuse 3–4 items from §8.2)

### 8.4 Interface labels (added 2026-09-29 with 3.9/3.10, **owner to confirm**)
- **Help:** category filter `All topics ({n})` + the four §8.2 group names; empty-search button `Clear search`; `Call {{PHONE}}` next to `Contact Support` (only when a phone is set).
- **Contact:** Topic placeholder `Choose a topic`; the existing optional **Gateway** field (pre-filled by "Contact this gateway" on Locations) is kept; submit `Send message`; success buttons `Send another message` · `Track a Shipment`. Quick answers shown: where to find the tracking ID, changing the delivery address, duties and taxes, damaged shipments.

### 8.5 Help: local delivery and payments (added 2026-11-06)
**Local delivery**
- *Which areas do your riders cover?* Buea, Limbe and Douala. When you book, choose your city and the pickup and drop-off areas to see the price.
- *How is the price worked out?* By city, the pickup and drop-off areas, and the parcel size. Express pickup costs extra. If your areas aren't listed yet, we confirm the price before pickup.
- *Can the rider collect money from the recipient?* Yes. Choose cash on delivery when you book and enter the amount. We pay it to you as agreed.
- *What if the recipient isn't available?* The rider tries to reach them. If the delivery can't be made, your tracking page shows why and our team contacts you to arrange a new time.
- *Why can't I see the rider on the map?* The location appears once your parcel is picked up and updates every few seconds while the rider is on the way.

**Payments**
- *Which payment methods do you accept?* Cash to the rider, MTN Mobile Money and Orange Money to the TanEx company accounts, and for international shipments the options shown on your payment request.
- *How do I prove a Mobile Money payment?* Upload a screenshot of the confirmation SMS on your tracking page, with the transaction ID.

### 8.6 Interface strings added with E.4 (**owner to confirm**)
- **Help:** search label (screen readers) `Search the help centre` · quick links name `Quick links` · topic filter name `Topics` · topics `Local delivery` · `Payments` (§8.5) · result count (screen readers) `{n} answers`. The search also matches the topic names.
- **Contact:** channel labels `Phone` · `WhatsApp` · `Email` · list name `Ways to reach us` · offices card `Our offices` · `Opening hours` · `Get directions` (opens Google Maps searching the written address; screen readers: `Get directions: {office} (opens Google Maps)`; no map pin until #120) · `(optional)` · tracking hint `For example TX7K2M9P` · gateway `No gateway` · errors `Please fill in your name, email, topic and message.` · `Please enter a valid email address.` · `We couldn't send your message. Please try again, or email us at {email}.` · quick answers link `More answers in the Help Centre`.

---

## 9. Network list (owner to confirm or edit, tracker #105)

Presented as "where we operate" (TanEx locations) and "gateways and trade lanes we serve" (not TanEx-owned
facilities). Replaces the previous list in `src/data/gateways.ts` during E.6.

**TanEx locations**

| Code | Name | Country | ISO | Lat | Lng | Time zone | Role |
|---|---|---|---|---|---|---|---|
| BUE | Buea head office (Check Point, opposite Molyko Omnisport Stadium) | Cameroon | CM | 4.1530 | 9.2410 | Africa/Douala | Base · bike delivery (city coordinates; exact office pin to confirm) |
| DLO | Douala office (Kotto, La Canadienne) | Cameroon | CM | 4.0700 | 9.7700 | Africa/Douala | Office · bike delivery (approximate; exact office pin to confirm) |
| LMB | Limbe | Cameroon | CM | 4.0186 | 9.2043 | Africa/Douala | Bike delivery |
| DLA | Douala (airport and port gateway) | Cameroon | CM | 4.0061 | 9.7195 | Africa/Douala | Bike delivery · Air · Ocean · Road |

**Gateways and lanes** (from Douala)

| Code | Gateway | Country | ISO | Lat | Lng | Time zone | Modes |
|---|---|---|---|---|---|---|---|
| CDG | Paris | France | FR | 49.0097 | 2.5479 | Europe/Paris | Air · Ocean (via Le Havre) |
| BRU | Brussels | Belgium | BE | 50.9010 | 4.4844 | Europe/Brussels | Air |
| LHR | London | United Kingdom | GB | 51.4700 | -0.4543 | Europe/London | Air |
| FRA | Frankfurt | Germany | DE | 50.0379 | 8.5622 | Europe/Berlin | Air |
| IST | Istanbul | Türkiye | TR | 41.2753 | 28.7519 | Europe/Istanbul | Air |
| DXB | Dubai | United Arab Emirates | AE | 25.2532 | 55.3657 | Asia/Dubai | Air · Ocean |
| CAN | Guangzhou | China | CN | 23.3924 | 113.2988 | Asia/Shanghai | Air · Ocean |
| PVG | Shanghai | China | CN | 31.1443 | 121.8083 | Asia/Shanghai | Air · Ocean |
| LOS | Lagos | Nigeria | NG | 6.5774 | 3.3212 | Africa/Lagos | Air · Road |
| ABJ | Abidjan | Côte d'Ivoire | CI | 5.2614 | -3.9263 | Africa/Abidjan | Air · Ocean |
| JNB | Johannesburg | South Africa | ZA | -26.1337 | 28.2420 | Africa/Johannesburg | Air |
| JFK | New York | United States | US | 40.6413 | -73.7781 | America/New_York | Air · Ocean |
| IAH | Houston | United States | US | 29.9902 | -95.3368 | America/Chicago | Air · Ocean |

**Hero-globe arcs:** DLA–CDG, DLA–BRU, DLA–IST, DLA–DXB, DLA–CAN, DLA–LOS, DLA–JNB, DLA–JFK, DLA–LHR.

---

## 10. Admin console strings
- Login: white logo above the card · **TanEx Operations Console** · `Sign in to manage shipments, tracking and documents.` · Button `Sign in` · Error `Incorrect password. Please try again.`
- *Added 2026-10-12 (owner request):* Settings → Company & Carrier Identity shows a read-only field `Admin console address` with `{{ADMIN_URL}}` and the hint `Bookmark this address. It isn't linked from the public site.`
- Sidebar brand: logo + `Operations Console`
- Role label: `Administrator` (replaces "Super Admin" in the UI)
- Default intake sender: `TanEx Intake Desk`
- Settings defaults: company `TanEx`, email `{{EMAIL}}`, phone `{{PHONE}}`, address `{{HQ_ADDRESS}}`, currency `XAF` (editable)
- *Added 2026-09-29 with 3.13 (owner to confirm):* login field placeholder `Password`, busy state `Signing in…`; the operator card and profile menu show `Administrator` · `Operations Console` (replacing "Terminal Dispatcher #01" / "Root Dispatch"); menu links `Settings` · `Document Center`.

> The single-password strings above are superseded by §10.1 once phase B ships.

### 10.1 Staff sign-in and accounts (added 2026-11-06, IAM_RBAC_SPEC §9)
- **Login:** `TanEx Operations Console` · `Sign in with your work email or phone number.` · fields `Email or phone` · `Password` · button `Sign in` · busy `Signing in…` · error `Incorrect sign-in details. Please try again.` · link `Forgot password?`
  - A locked account (5 wrong passwords, 15 minutes) shows the same error as any failed sign-in; there is no separate lockout message (decided 2026-11-07, tracker #123). The per-IP limit keeps `Too many login attempts. Try again in a few minutes.`
- **Forced change:** `Choose a new password` · `For your security, set your own password before you continue.` · `New password` · `Confirm new password` · hint `At least 10 characters.` · button `Save and continue`
  - *Added 2026-11-07 with B.4 (owner to confirm):* first field `Temporary password` (the server checks it before accepting the new one) · busy `Saving…` · errors `The passwords don't match.` · `The current password is incorrect.` · `The new password can't be your email address or phone number.` · link `Sign out`
- **Forgot:** `Reset your password` · `Enter your work email. If it matches an account, we'll send a reset link.` · success `If that email has an account, a reset link is on its way.`
  - *Added 2026-11-07 with B.4 (owner to confirm):* field `Work email` · button `Send reset link` · link `Back to sign in`
- **Set a new password** (opened from the emailed link; *added 2026-11-07 with B.6, owner to confirm*): `Set a new password` · `Choose a new password for your TanEx account.` · `New password` · `Confirm new password` · hint `At least 10 characters.` · button `Save new password` · busy `Saving…` · success `Your password has been changed. Sign in with your new password.` · button `Sign in` · error `This reset link is invalid or has expired. Ask for a new one.` · button `Ask for a new link` · link `Back to sign in`
- **Settings → Email** (*added 2026-11-07 with B.6, owner to confirm*): tab and title `Email` · intro `Emails to customers and staff go out from the company mailbox. They wait in a queue and are tried again if sending fails.` · status `Email is on` / `Email is off` · off hint `Add the mail settings (SMTP_HOST, SMTP_USER, SMTP_PASS, MAIL_FROM) to the server and restart the app. Until then no emails are sent and "Forgot password?" is hidden.` · fields `Server` · `Sender` · `Reply-to` · `Signs in as` · figures `Waiting to send` · `Failed` · `Sent in the last 24 hours` · `Last sent` · `Never` · `Send a test email` · `Send to` · button `Send test email` · busy `Sending…` · `Test email sent to {to}.` · `The test email could not be sent: {error}. It will be tried again automatically.` · `Sending a test email needs the permission to manage settings.` · `Failed emails` · `No failed emails.` · button `Try again` · `Queued again.` · `Password reset emails can't be sent again. Ask for a new link instead.` · `Recent emails` · `No emails yet.` · columns `Queued` · `To` · `Subject` · `Status` · `Attempts` · `Last error` · statuses `Waiting` · `Sending` · `Sent` · `Failed` · `Refresh` · `Loading…`
- **My account** *(added 2026-11-07 with B.4, owner to confirm):* menu `My account` · title `My account` · `Signed in as {email or phone}` · `Roles` · `Name` · `Language` (`English` / `Français`) · hint `Used for the console and the emails we send you.` · button `Save` · `Saved.` · section `Change password` · `Current password` · `New password` · `Confirm new password` · button `Change password` · success `Password changed. Your other devices have been signed out.` · `Sign out`
  - *Where you are signed in (added 2026-11-07 after B.5, owner to confirm, #125):* `Where you are signed in` · `This device` · `Last active {when}` · `Signed in {when}` · `Unknown device` · `{browser} on {system}` · button `Sign out other devices` · confirm `Sign out on every other device? This device stays signed in.` · `Signed out on {n} other device(s).` · `You are only signed in on this device.`
- **Courier accounts until the courier app ships (G.4)** *(added 2026-11-07 with B.4, owner to confirm):* `Courier app coming soon` · `Your account is set up. The courier app will open here as soon as it is ready.` · `Sign out`
- **Account with no console access** *(added 2026-11-07 with B.4, owner to confirm):* `No access yet` · `Your account has no permissions yet. Ask an administrator to give you a role.` · `Sign out`
- **Users:** `Users` · `Add user` · columns `Name` · `Email / phone` · `Roles` · `Status` · `Last sign-in` · statuses `Active` · `Disabled` · actions `Edit` · `Reset password` · `Disable` · `Enable` · `Sign out everywhere` · temp-password dialog `Temporary password` · `Shown once. Share it securely; they'll choose their own at first sign-in.` · `Copy` · `Send on WhatsApp`
- **Roles:** `Roles` · `New role` · `Permissions` · `Users with this role: {n}` · `System role` · `The Super Admin role can't be changed.`
- **Audit log:** `Audit log` · filters `Person` · `Action` · `Record` · `Date` · detail `Before` · `After`
- **Users, roles and audit: additions** *(added 2026-11-07 with B.5, owner to confirm, tracker #125)*:
  - Users: search `Search by name, email or phone` · `Edit user` · fields `Name` · `Email` · `Phone` · `Language` · `Roles` · hint `Enter an email address, a phone number or both. Phone numbers without a country code are read as Cameroonian.` · `You can't give this role: it has permissions you don't hold.` · buttons `Create user` · `Save` · `Cancel` · busy `Saving…` · `Saved.` · `No accounts yet.` · `Loading…` · `You` · `No role` · `Never` · status extras `Locked` · `Password change pending` · column `Actions`
  - Confirmations: `Disable {name}? They are signed out at once and can't sign in until enabled again.` · `Give {name} a new temporary password? Their current password stops working and they are signed out.` · `Sign {name} out on every device?` · result `Signed out of {n} session(s).`
  - Temporary password dialog: `Signs in with` · `Copied` · `Opens WhatsApp with the message ready. You still tap Send.` · `Add a valid phone number to this account to send it on WhatsApp.` · `Done` (message text: §14 `auth.temp_password`)
  - Roles: `Name` · `Description` · `Every permission, including users, roles and settings.` · `You can't change this permission because you don't hold it.` · `Create role` · `Delete role` · `Delete the role {name}?` · `Choose a role to see its permissions.` (permission names: the descriptions in `src/shared/permissions.ts`)
  - Audit log: `Record ID` · `From` · `To` · `Everyone` · `All actions` · `All records` · `Clear filters` · columns `When` · `Person` · `Action` · `Record` · `Summary` · `IP address` · `No field changes recorded for this entry.` · `Not signed in` · `No entries match these filters.` · `{n} entries` · `Page {p} of {n}` · `Previous` · `Next` · `Show details` / `Hide details`
  - Errors: `You can't give permissions you don't hold.` · `You can't change an account that has permissions you don't hold.` · `This is the last active Super Admin. Give the role to someone else first.` · `You can't disable your own account.` · `Use My account to change your own password.` · `Another account already uses this email address.` · `Another account already uses this phone number.` · `Enter an email address or a phone number.` · `Enter a valid email address.` · `Enter a valid phone number.` · `Enter a name.` · `A role with this name already exists.` · `System roles can't be deleted. You can rename them or change their permissions.` · `Some accounts have this role. Remove it from them first.`
- **Role names (seeded):** `Super Admin` · `Operations Manager` · `Dispatch Manager` · `Courier` · `Marketing` · `Finance` · `Customer Support`

### 10.2 Dispatch board and tariffs
- **Board columns:** `Requested` · `To assign` · `Assigned` · `In progress` · `Problems` · `Done today`
- **Actions:** `Confirm & price` · `Assign` · `Reassign` · `Cancel job` · `Mark returned` · `Send on WhatsApp` · `Override price` (reason required)
- **Courier status:** `On duty` · `Off duty` · `Last seen {n} min ago`
- **Tariffs:** `Delivery cities` · `Areas` · `Rates` · `From area` · `To area` · `Any other area` · `Size` · `Price` · `Express surcharge` · `Intercity rates` · `Import suggested areas (no prices)`
- **Cash:** `Cash & Mobile Money` · `Collected` · `Handed over` · `Balance` · `Confirm handover` · `Adjustment` (reason required) · `Export CSV`

### 10.3 Courier app
- **Today:** `Today's jobs` · `On duty` / `Off duty` · empty `No jobs yet. New jobs appear here.` · new-job banner `New job assigned`
- **Job:** `Pickup` · `Drop-off` · `Call` · `WhatsApp` · `Open in Maps` · `Cash to collect: {amount}` · `Express`
- **Actions:** `Accept job` · `Decline` · `Picked up` · `On my way` · `Delivered` · `Couldn't deliver`
- **Proof of delivery:** `Recipient's name` · `Take photo` · `Retake` · `Signature (optional)` · `Delivery code` · `Cash collected` · `Method` (`Cash` / `MTN MoMo` / `Orange Money`) · `Transaction ID` · button `Confirm delivery`
- **Failure reasons:** `Recipient unreachable` · `Recipient not available` · `Wrong address` · `Refused` · `Unsafe to deliver` · `Vehicle problem` · `Other` (note required)
- **Sync:** `Saved on phone, will sync` · `Synced` · `Offline` · **Location:** `Keep the app open while delivering so the customer can follow you.` · `Location is off. Turn it on to share your position during deliveries.`
- **Cash:** `My cash` · `Balance` · `Record handover` · `Waiting for confirmation` · `Confirmed`

---

## 11. Generated documents (waybill, BOL, invoice, POD, seal label)
- Header: logo + `TanEx` + `{{HQ_ADDRESS}} · {{EMAIL}} · {{DOMAIN}}`
- Title labels: `Air Waybill / House Waybill` (air), `Bill of Lading` (ocean/road), `Commercial Invoice`, `Proof of Delivery`, `Security Seal Record`
- ID line: `Tracking ID / Waybill No.: TX7K2M9P`
- Pouch line: `TanEx Tamper-Evident Document Pouch · Seal No. TX-SL-######`
- Footer: `This document was generated by TanEx. Carriage is subject to TanEx's Shipping Terms at {{DOMAIN}}/legal/shipping-terms.`
- *Added 2026-09-29 with 3.12 (owner to confirm):* the Document Center also produces three types not named above, titled `Shipping Label`, `Shipment Receipt` and `Certificate of Cargo Insurance`. Charge lines: `Transport` · `Oversize handling` · `Special handling`, totals `TOTAL DUE` / `TOTAL PAID`. Insurance certificate text: `The cargo described below is insured by {insurer} under policy {policy no.}, subject to that policy's terms, conditions and exclusions.` and claims line `Tell TanEx about any loss or damage within 7 days of delivery, quoting the tracking ID above, with photos and proof of value.` (7 days: same [confirm] as Help §8.2). **Proof of Delivery** and **Security Seal Record** have no document type yet (see tracker Blocked).

---

## 12. Image alt text (TanEx; rebuilt in E.7)

Real TanEx photos replace stock as soon as the owner supplies them (tracker #103). Stock photos must not show any
company's branding. Every slot keeps explicit width/height. Sources and licences in `images/*/SOURCES.md`.

| Slot | Source | Alt |
|---|---|---|
| hero poster | rendered from the hero globe (MOTION §5.1) | (decorative; the headline carries the meaning) |
| about-md | `images/tanex files/Managing Director.png` (crop to 4:5, logo wall visible) | `{{MD_NAME}}, Managing Director of TanEx, at the TanEx office in Buea` (until the name is known: `The Managing Director of TanEx at the TanEx office in Buea`) |
| about-team | owner photo, TBD | describe what is shown |
| service-air / -maritime / -rail / -road / -warehousing / -local | free-licence or owner photos, chosen in E.7 | describe what is shown, no brand claims |
| bike / truck scenes | in-house SVG illustration | (decorative; the section text carries the meaning) |
| og-image | logo on Chocolate 950 | (social preview) |

---

## 13. Legal pages: structure (plain-language draft; **lawyer review under Cameroonian law required before launch**, tracker #11)
Tabs: **Privacy Policy · Terms of Service · Shipping Terms · Cookie Policy · Accessibility**

- **Privacy Policy:** who we are ({{LEGAL_NAME}}, {{HQ_ADDRESS}}, {{EMAIL}}) · what we collect (sender/recipient details, shipment data, contact messages, basic analytics) · why (to carry shipments, customs, support, legal duties) · public tracking masks names and addresses · who we share with (carriers, agents, customs authorities, only as needed) · international transfers · how long we keep it · your rights (access, correction, deletion, objection) under applicable law, e.g. Cameroon's Law No. 2024/017 on personal data protection, EU/UK GDPR · contact for privacy requests.
- **Terms of Service:** acceptance · use of the website and tracking · accounts and quotes · payment and invoicing · limitation of liability · governing law: {{JURISDICTION}}.
- **Shipping Terms:** booking and acceptance of goods · prohibited and restricted items · packaging responsibilities · dimensional weight (kg: L×W×H cm ÷ 5000 [confirm the divisor]) · surcharges (fuel, remote area, customs) · duties and taxes · delivery and proof of delivery · liability limits and declared value · claims (notification window, documents required) · return to sender.
- **Cookie Policy:** essential cookies only (admin session). Add analytics disclosure if analytics are added.
- **Accessibility:** commitment to WCAG 2.2 AA · reduced-motion support · how to report a barrier ({{EMAIL}}).

### 13.1 Draft text (added 2026-09-29 with 3.11, **lawyer review required**)
The text below is rendered from `src/data/legalDocs.ts` (English and French, CONTENT_FR §13); change them together. Page H1: `Legal`. Each tab shows `Last updated: 8 November 2026` (updated with E.4). The Head-office sentence is left out while {{HQ_ADDRESS}} is empty. Governing law names the Republic of Cameroon (lawyer to confirm, #112). Differences from the outline above: no analytics are installed, so Privacy and Cookies say so; Cookies lists the real cookie and browser-storage keys of the public pages (audited in E.4) and the third-party services the pages load. Live chat is off (#109), so the Smartsupp sentence was removed; add it back if chat is switched on.
- *E.4 interface (owner to confirm):* menu name (screen readers) `Legal pages` · French H1 `Mentions légales`.

**Privacy Policy**
1. *Who we are.*
   Tanex SARL ("TanEx", "we") runs this website and carries the shipments booked through it. Our head office is at {{HQ_ADDRESS}}. For anything about your personal data, write to {{EMAIL}}.
2. *What we collect.*
   - Sender and recipient details you give us when you book or ask for a quote: names, company, phone numbers, email and delivery addresses.
   - Shipment data: contents, weights, sizes, declared value, and the scans and events recorded as the shipment moves.
   - Messages you send us through the contact and support forms.
   - Basic technical data: when your browser loads our pages and maps, the servers involved receive your IP address. We do not use analytics or advertising tools.
3. *Why we use it.*
   - To collect, carry and deliver your shipments.
   - To prepare customs and shipping documents.
   - To answer your questions, handle claims and keep you updated.
   - To meet our legal, tax and customs duties.
4. *Public tracking.*
   Anyone with a tracking ID can follow a shipment. The public tracking page shows only the city and country for each end of the journey, and masks names, phone numbers and email addresses.
5. *Who we share it with.*
   We share only what each party needs to move your shipment: carriers, agents and handlers on the route, and customs and other authorities. We do not sell personal data.
6. *International transfers.*
   Because we move goods across borders, shipment details travel with them to the countries on the route. We share only what carriage and customs require.
7. *How long we keep it.*
   We keep personal data only as long as we need it for the purposes above, including the periods set by tax, customs and transport record-keeping rules.
8. *Your rights.*
   Depending on where you live (for example under Cameroon's Law No. 2024/017 of 23 December 2024 on personal data protection [lawyer to confirm], or the EU or UK GDPR), you can ask to see the personal data we hold about you, correct it, delete it, or object to how we use it. You can also complain to your data protection authority.
9. *Privacy requests.*
   Email {{EMAIL}} with your request and, if it concerns a shipment, its tracking ID. We may ask you to confirm your identity before we act on it.

**Terms of Service**
1. *Accepting these terms.*
   By using this website you agree to these terms. When you book a shipment, our Shipping Terms also apply.
2. *Using the website and tracking.*
   You can use this website to ask for quotes, book shipments and track them. Please don't misuse it: no automated collection of tracking data, and no attempts to reach other people's shipments or our internal systems.
   Tracking updates depend on scans along the route and can be delayed. They are for information and are not a guarantee of delivery times.
3. *Quotes and bookings.*
   A quote is valid until the date shown on it and covers the shipment you described. If the shipment turns out different (for example heavier, larger or with other contents), the price may change. A booking is confirmed when you receive a tracking ID.
4. *Payment and invoicing.*
   We invoice each shipment, or as agreed with you in writing. Payment is due as stated on the invoice. Duties, taxes and charges set by authorities are extra unless your quote says otherwise.
5. *Limitation of liability.*
   As far as the law allows, we are not liable for indirect or consequential losses arising from your use of this website. Our liability for shipments is set out in the Shipping Terms.
6. *Changes to these terms.*
   We may update these terms. The date at the top of this page shows the current version.
7. *Governing law.*
   These terms are governed by the laws of the Republic of Cameroon [lawyer to confirm]. Nothing in them takes away rights you have under the consumer law of the country where you live.

**Shipping Terms**
1. *Booking and acceptance.*
   We accept a shipment when we collect it, or you hand it to us, and it has a tracking ID. We may inspect, refuse or hold any shipment that does not meet these terms or the law.
2. *Prohibited and restricted items.*
   You must not send anything that is illegal in the origin, transit or destination country. Items such as dangerous goods, cash, weapons, live animals and perishables are either prohibited or need our agreement before booking. Rules vary by country, so ask us before you book.
3. *Packaging.*
   You are responsible for packing your shipment to withstand normal handling: use a strong outer box, cushion every item and seal all seams. For high-value items, ask for our Secure Vault packaging.
4. *Chargeable weight.*
   We charge on the greater of the actual weight and the dimensional weight. Dimensional weight in kg = length × width × height in cm ÷ 5000.
5. *Surcharges.*
   Fuel, remote-area and customs-related surcharges may apply. Every known surcharge is shown on your quote.
6. *Duties and taxes.*
   Who pays duties and taxes is agreed at booking: either the sender (duties paid) or the recipient (duties unpaid).
7. *Delivery and proof of delivery.*
   We deliver to the address on the booking. The delivery time and the name of the person who signed are recorded against your tracking ID as proof of delivery.
8. *Liability and declared value.*
   Our liability for loss or damage is limited. Unless you declare a value and take extended cover when you book, compensation is limited to the standard liability for your service and route, as confirmed at booking. We are not liable for delays or for indirect losses.
9. *Claims.*
   Tell us within 7 days of delivery. Include your tracking ID, a description of the problem, photos of the goods and the packaging, and proof of value (for example the commercial invoice). We will open a claim and keep you updated.
10. *Return to sender.*
   If a shipment cannot be delivered or cleared through customs, we contact the sender. It may be returned at the sender's cost; a return gets its own tracking ID.

**Cookie Policy**
1. *Cookies we use.*
   We use one essential cookie, tx.sid. It keeps TanEx staff signed in to our operations console for up to 12 hours. It is not set for visitors to the public website.
   We do not use analytics or advertising cookies. If we add analytics, we will update this page and ask for your consent where the law requires it.
2. *Choices saved in your browser.*
   Some pages remember a few choices in your browser's local storage. This data stays on your device and is not sent to us:
   - tx_locale: the language you chose for this website (English or French).
   - ngf_recent_tracking: tracking IDs you looked up recently, so you can open them again.
   - ngf_units: whether you prefer metric or imperial units.
   - ngf_live_shipment_stream: the latest update for a shipment you are viewing, so other open tabs stay in step.
   You can clear these at any time in your browser settings.
3. *Other services our pages use.*
   Our pages load map tiles from Esri (ArcGIS) and use OpenStreetMap Nominatim and OSRM to look up addresses and routes. Fonts and photos are served from our own site. These services receive your IP address when your browser contacts them.

**Accessibility**
1. *Our commitment.*
   We want everyone to be able to track, book and contact us. We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA across this website.
2. *What we do.*
   - Forms, buttons and menus work with a keyboard, and form fields have labels.
   - Images have text alternatives, and text is sized and coloured to stay readable.
   - Animated maps respect your device's reduced-motion setting.
   - Tracking pages give the route and every scan as text, not only on the map.
3. *Report a barrier.*
   If something on this website is hard to use, email {{EMAIL}}. Tell us the page and what happened, and we will help you get what you need another way while we fix it.

Still **[confirm]** (shown as written): the dimensional-weight divisor 5000 (Shipping Terms 4) and the 7-day claims window (Shipping Terms 9, same as Help §8.2).

---

## 14. Notification templates (NOTIFICATIONS_SPEC §4)

Plain text, short, signed `— TanEx`. `{link}` = the public tracking URL in the recipient's language.

| Key | English |
|---|---|
| `booking.confirmed` | `Hello {name}, your TanEx booking is confirmed. Tracking ID: {id}. Follow it here: {link}` |
| `local.share_recipient` | `Hello {name}, {sender} is sending you a parcel with TanEx. Follow the delivery live: {link}` |
| `local.assigned` | `Your TanEx rider {rider} is on the job for {id}. Track: {link}` |
| `local.on_the_way` | `Your parcel {id} is on the way with {rider}. Follow live: {link}` |
| `local.delivered` | `Delivered: {id} was received by {masked} at {time}. Thank you for choosing TanEx.` |
| `local.failed` | `We couldn't deliver {id}: {reason}. Our team will contact you to arrange a new time.` |
| `auth.temp_password` | `Your TanEx console account is ready. Sign in at {url} with {identifier} and this temporary password: {password}. You'll choose your own when you sign in.` |
| `auth.reset` (email) | Subject `Reset your TanEx password` · body `Someone asked to reset the password for your TanEx account. Use this link within 30 minutes: {url}. If it wasn't you, ignore this email.` |
| `quote.received` (email) | Subject `We've received your quote request {ref}` · body `Thank you, {name}. Our team will review your request and send you a price. View it any time: {url}` |
| `quote.ready` (email) | Subject `Your TanEx quote {ref} is ready` · body `Your price is ready to view and accept: {url}` |
| `contact.received` (email) | Subject `We've received your message ({ref})` · body `Thank you, {name}. We'll get back to you as soon as possible.` |
| `payment.confirmed` (email) | Subject `Payment received for {id}` · body `Thank you. We've confirmed your payment for {reason}.` |
| `contact.staff_alert` (email to `MAIL_STAFF_ALERTS_TO`, *added after B.6, owner to confirm*) | Subject `New message from {name} ({ref})` · body `{name} sent a message through the website (topic: {subject}). Read and answer it in the console: {url}` (the visitor's message itself is not copied into the email) |
| `payment.proof_received` (email to `MAIL_STAFF_ALERTS_TO`, *added after B.6, owner to confirm*) | Subject `Proof of payment received for {id}` · body `A customer uploaded a proof of payment for {id}. Check it in the console under Payments: {url}` |
| `mail.test` (email, *added with B.6, owner to confirm*) | Subject `TanEx test email` · body `This is a test email from the TanEx Operations Console. If you can read it, email sending works.` |

---

## 15. Blog pages (BLOG_SPEC §6)
- **Until F.3 ("coming soon" page at /blog, noindex; added 2026-11-09, owner to confirm):** eyebrow `Blog` · H1 `Articles coming soon` · sub `We're preparing news, guides and shipping tips from the {{COMPANY}} team. Check back soon.` · buttons `Track a shipment` · `Contact us`
- **Index:** eyebrow `TANEX BLOG` · H1 `News, guides and shipping tips` · sub `Practical advice on sending parcels in Cameroon and abroad, and news from the TanEx team.` · category chip `All` · empty state `Our first articles are on their way.` · `Read more` · `{n} min read` · pagination `Newer` · `Older`
- **Article:** `By {author}` · `{date}` · `{n} min read` · `Share` (`WhatsApp` · `Facebook` · `LinkedIn` · `X` · `Copy link` → `Link copied`) · `Related articles` · `Read in French` / `Lire en anglais` (only when a translation exists) · end CTA `Need to send something? Get a Quote`

## 16. Careers and CSR Policy (footer only; added 2026-11-09, **draft: owner to approve before launch**)
Owner's note: "Extra pages to be added only on footer: CSR Policy, Careers, Privacy Policy" (Privacy Policy = /legal).
Commitments only: no figures, open positions, certifications or partners. Footer *Company*: `Careers` · `CSR Policy`.

**Careers (/careers):** eyebrow `Careers` · H1 `Work with {{COMPANY}}` · sub `We move parcels from doors in Buea, Limbe and Douala to the rest of the world. If you are reliable, careful and good with people, we'd like to hear from you.`
- `Where you could fit` / `Teams at {{COMPANY}}`: **Riders** Collect and deliver parcels across town by bike. · **Drivers** Carry larger loads between cities by truck and van. · **Operations and office** Book shipments, prepare documents, help customers and keep every parcel moving.
- `What matters to us` / `How we work`: **Reliability** Being on time and doing what we promised. · **Care** Handling every parcel as if it were our own. · **Service** Friendly, clear help for every customer, in English or French.
- `How to apply`: `No open positions are listed here at the moment. Send your CV and a short message to {{EMAIL}}, saying which team and which city (Buea, Limbe or Douala) interest you. We'll contact you if there's a match.` · button `Email your CV` (email subject `Job application`)

**CSR Policy (/csr-policy):** eyebrow `CSR Policy` · H1 `Our responsibility` · sub `How {{COMPANY}} works to be a safe, fair and responsible company in the communities we serve.`
- **Safety on the road.** Our riders and drivers follow the traffic rules and wear the right safety equipment. We plan loads and routes so that no delivery is worth taking a risk for.
- **Fair work.** We treat our staff and couriers with respect, pay them on time, and give them the training and equipment the job needs.
- **Honest service.** A clear price before you ship, tracking you can check yourself, and proof of every delivery. We protect your personal data as our Privacy Policy explains. → `Read our Privacy Policy`
- **Environment.** Bikes for short trips in town, combined loads between cities and fewer empty journeys. Where we can, we reuse packaging and reduce waste.
- **Local community.** We are based in Buea and work with businesses across Buea, Limbe and Douala, helping them reach customers at home and abroad.
- `Questions or suggestions about how we work? Write to us at {{EMAIL}}.`
