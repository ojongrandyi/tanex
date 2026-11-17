# Graph Report - Tanex  (2026-11-17)

## Corpus Check
- Large corpus: 526 files · ~507,205 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 3826 nodes · 11075 edges · 136 communities (126 shown, 10 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 111 edges (avg confidence: 0.84)
- Token cost: 546,373 input · 0 output

## Community Hubs (Navigation)
- API Routes & Middleware
- i18n Dictionaries
- Server Test Suites
- Blog Studio Editor
- App Shell & Navigation
- Email Outbox & Templates
- Console Auth & IAM UI
- Auth Routes & Uploads
- Locale Runtime & Header
- NPM Dependencies
- Shipment Creation & Quotes
- Brand Config & DB Core
- Company Pages & UI Kit
- Blender Model Scripts
- Home & Contact Pages
- Dispatch Board
- Page Meta & SEO Head
- Public Blog & Feeds
- Tracking Events & Planning
- Courier & User Management
- Tariffs & Dispatch Settings
- Leaflet Maps
- Admin Shipment Data
- 3D Stage Core
- Tariffs Console UI
- Dispatch Job Writer
- Dispatch Status Machine
- Roles & Permissions Schema
- Track Result Pages
- Blog API Routes
- Job Drawer & Create Dialog
- City-to-City Scene
- Payment Requests
- Blog Doc Renderer
- Units & Measurements
- Courier API & Cash Handover
- Local Delivery Booking
- Admin Data Context
- Public Tracking & Masking
- Public Blog Pages
- Settings & Currency
- Hero Globe Scene
- Journey Easing & Phases
- Stage Camera & Draw
- Image Optimisation Pipeline
- Server Entry & Previews
- Path Router
- Couriers Console
- Courier Offline Queue
- Super Admin Bootstrap
- Admin Layout & Views
- Routing Engine
- Payment Method Validation
- Shipment Progress & Time Zones
- Document Center & POD
- Public Payment Section
- Great-Circle Simulation
- Payment Proof Review
- Content Deck (EN/FR)
- TipTap Extensions
- Courier App Shell
- Motion & 3D Spec
- Dispatch Jobs Tests
- Courier Job Detail
- Page Motion Hooks
- Deployment Spec
- Geocoding & Hubs
- Parcel Label 3D
- Legal Pages
- Payments & Images Update Spec
- Dispatch Transition Routes
- Local Pricing & POD Docs
- Tracking ID Generation
- Courier Screens & API Types
- Dispatch Spec
- Project Tracker
- Blog SEO & Sitemap
- Journey Controller Logic
- Journey Store & Route Rail
- Arrival Door Scene
- TS Config (client)
- IAM & RBAC Spec
- 3D Assets & Bike Loader
- In-Town Phone Map Scene
- Brand Guide
- Platform Plan & I18N Routes
- Design Direction Doc
- 3D Model Brief
- Blog Tests
- Scroll Glide & Progress
- Shipment Images API
- Courier Sheets
- TS Config (server)
- Company Facts & Hours
- Home Mock Design
- Console & Dispatch Copy
- Auth Tests
- Permissions Tests
- Home & Blog Copy
- Motion Capabilities
- Project Docs Index
- Session Store
- Multipart Parser
- Blog Spec
- Track & Payment Copy
- NPM Scripts
- Payment Icons
- Payment Proof Validation
- Courier Profile & PWA
- Services Road Scene
- I18N Spec & Stack
- Motion Spec Overview
- Notifications Spec
- Index.html & Rebrand
- Dev Dependencies
- Reference Number Formats
- Public Tracking & Blog API Docs
- Owner Brand Assets
- Courier Location Sharing
- Smooth Scroll (Lenis)
- Pause Motion Control
- IAM Phase Summary
- Service Card Photos
- Stock Photo Sources
- Vite Build
- Courier Service Worker
- Brand Fonts
- Quote & Booking Copy
- Nodemailer
- bcryptjs Types
- Graphify Rules
- City-to-City Chapter
- Services Chapter
- Blog Phase

## God Nodes (most connected - your core abstractions)
1. `react` - 134 edges
2. `lucide-react` - 86 edges
3. `useAreaT()` - 57 edges
4. `MainAppContent()` - 50 edges
5. `useAuth()` - 49 edges
6. `useLocale()` - 44 edges
7. `express` - 42 edges
8. `shipmentStatusLabel()` - 39 edges
9. `useAdminData()` - 37 edges
10. `HomePage()` - 35 edges

## Surprising Connections (you probably didn't know these)
- `Ch 2 In town (bike delivery, from 500 FCFA)` --references--> `Company facts (single source of truth)`  [INFERRED]
  design/home.html → CLAUDE.md
- `formatMessage()` --calls--> `getGateway()`  [EXTRACTED]
  server/routes/messages.ts → src/data/gateways.ts
- `Named pivot hierarchy (front_wheel, handlebar, rider_torso, box_lid, parcel_socket)` --shares_data_with--> `Primitives-built placeholder bike`  [INFERRED]
  design/3d-brief.md → PROMPTS.md
- `startApp()` --indirect_call--> `requireAuth()`  [INFERRED]
  scripts/auth.test.ts → server/middleware/auth.ts
- `startApp()` --indirect_call--> `requireJsonOrMultipart()`  [INFERRED]
  scripts/auth.test.ts → server/middleware/auth.ts

## Import Cycles
- 2-file cycle: `server/db.ts -> server/mail/outbox.ts -> server/db.ts`

## Hyperedges (group relationships)
- **Homepage Journey chapters 0-8 (bike rides the route)** — design_home_hero_chapter, design_home_services_chapter, design_home_in_town_chapter, design_home_city_to_city_chapter, design_home_network_chapter, design_home_labels_chapter, design_home_contact_chapter, design_home_faq_blog_chapter, design_home_footer_delivered [EXTRACTED 1.00]
- **3D bike specification chain (reference sheet -> brief -> placeholder -> Stage)** — design_direction_bike_reference_sheet, design_3d_brief_bike_model, design_3d_brief_pivot_hierarchy, prompts_primitives_bike, prompts_stage [INFERRED 0.85]
- **Opening hours source conflict (24/7 vs 9-4)** — claude_opening_hours_24_7, prompts_opening_hours_9_4, design_home_contact_chapter [INFERRED 0.85]
- **Local delivery job flow: booking, pricing, assignment, courier app, live tracking, POD, cash** — docs_dispatch_spec_public_booking, docs_dispatch_spec_local_pricing, docs_dispatch_spec_dispatch_board, docs_dispatch_spec_courier_app, docs_dispatch_spec_local_track_page, docs_dispatch_spec_proof_of_delivery, docs_dispatch_spec_cash_and_handover [EXTRACTED 1.00]
- **Bilingual copy pipeline: EN master, FR translation, French typography, brand voice** — docs_content_content_deck, docs_content_fr_contenus_du_site, docs_content_fr_french_typography, docs_brand_guide_voice_and_tone, docs_content_placeholders [INFERRED 0.85]
- **Blog publishing flow: studio, sanitisation, public API, public pages, SEO** — docs_blog_spec_blog_studio, docs_blog_spec_html_sanitisation, docs_blog_spec_public_blog_api, docs_blog_spec_public_blog_pages, docs_blog_spec_blog_seo [EXTRACTED 1.00]
- **Server-side IAM enforcement** — docs_iam_rbac_spec_requirepermission, docs_iam_rbac_spec_permission_catalogue, docs_iam_rbac_spec_sqlite_session_store, docs_iam_rbac_spec_audit_log, docs_iam_rbac_spec_roles [EXTRACTED 1.00]
- **Proof of payment flow** — docs_update_shipment_payments, docs_update_payment_proofs, docs_update_payment_method_registry, docs_prompt_update_dashboard_notifications, docs_prompt_update_proof_submission [EXTRACTED 1.00]
- **Journey motion stack** — docs_motion_3d_spec_stage, src_motion_journeycontroller, docs_motion_3d_spec_route_rail, docs_motion_3d_spec_posters, docs_motion_3d_spec_capabilities, docs_motion_3d_spec_gsap, docs_motion_3d_spec_three [EXTRACTED 1.00]

## Communities (136 total, 10 thin omitted)

### Community 0 - "API Routes & Middleware"
Cohesion: 0.04
Nodes (89): express, startApp(), registerApiRoutes(), audit(), AuditActor, audited(), FromReq, param() (+81 more)

### Community 1 - "i18n Dictionaries"
Cohesion: 0.04
Nodes (75): app, leaves(), PAIRS, SAME_IN_BOTH, server, tmpDir, Tree, addErrorCodes() (+67 more)

### Community 2 - "Server Test Suites"
Cohesion: 0.03
Nodes (70): bcryptjs@^3.0.3, bcryptjs, bits, cameroon, cameroonFeature, cm, data, iso() (+62 more)

### Community 3 - "Blog Studio Editor"
Cohesion: 0.07
Nodes (67): blogApi, BlogCategory, BlogCover, BlogLocale, BlogMedia, BlogPost, BlogPostSummary, DocNode (+59 more)

### Community 4 - "App Shell & Navigation"
Cohesion: 0.05
Nodes (69): AboutPage, AdminApp, AdminLogin, App(), BlogPage, BlogPostPage, CareersPage, consoleKind() (+61 more)

### Community 5 - "Email Outbox & Templates"
Cohesion: 0.07
Nodes (55): escapeHtml(), MailLocale, Paragraph, paragraphHtml(), paragraphText(), RenderedEmail, renderEmail(), Segment (+47 more)

### Community 6 - "Console Auth & IAM UI"
Cohesion: 0.07
Nodes (62): AdminLogin(), AdminLoginProps, AuthCard(), AuthError(), ForgotPassword(), readResetToken(), ResetPassword(), ForcedPasswordChange() (+54 more)

### Community 7 - "Auth Routes & Uploads"
Cohesion: 0.05
Nodes (64): BCRYPT_COST, consumeResetToken(), createResetToken(), findResetUser(), findValidToken(), hashResetToken(), RESET_REQUESTS_PER_HOUR, RESET_TOKEN_TTL_MS (+56 more)

### Community 8 - "Locale Runtime & Header"
Cohesion: 0.06
Nodes (60): footerColumns(), hasMenu(), Header(), HeaderProps, LanguageSwitch(), NavItem, navItems(), servicesLinks() (+52 more)

### Community 9 - "NPM Dependencies"
Cohesion: 0.04
Nodes (67): dependencies, compression@^1.8.2, cors@^2.8.6, dotenv@^17.4.2, express@^5.2.1, express-rate-limit@^8.7.0, express-session@^1.19.0, gsap@^3.15.1 (+59 more)

### Community 10 - "Shipment Creation & Quotes"
Cohesion: 0.08
Nodes (59): libphonenumber-js, draftFromPayment(), draftToRequest(), emptyPaymentDraft(), PaymentDraft, paymentDraftErrors(), paymentDraftSummary(), ShipmentPaymentPanel() (+51 more)

### Community 11 - "Brand Config & DB Core"
Cohesion: 0.05
Nodes (53): createBlogTables(), DB_FILE, initDatabase(), createDispatchTables(), createMailTables(), FooterProps, POWERED_BY, SOCIAL_LINKS (+45 more)

### Community 12 - "Company Pages & UI Kit"
Cohesion: 0.05
Nodes (51): Button, ButtonAsButton, ButtonAsLink, buttonClass(), ButtonProps, ButtonSize, ButtonVariant, CommonProps (+43 more)

### Community 13 - "Blender Model Scripts"
Cohesion: 0.08
Nodes (36): activate(), arc_band(), box(), decal(), disc(), ellipsoid(), empty(), finish() (+28 more)

### Community 14 - "Home & Contact Pages"
Cohesion: 0.07
Nodes (55): largest(), ResponsiveImage(), ResponsiveImageProps, srcSet(), Checkbox(), Choice(), ChoiceProps, FieldShellProps (+47 more)

### Community 15 - "Dispatch Board"
Cohesion: 0.06
Nodes (51): app, call(), createJob(), HASH, NOW, now0, place(), server (+43 more)

### Community 16 - "Page Meta & SEO Head"
Cohesion: 0.08
Nodes (45): doc, blogRender(), POST_META, render(), TEMPLATE, absolute(), BLOG_NAME, blogHead() (+37 more)

### Community 17 - "Public Blog & Feeds"
Cohesion: 0.09
Nodes (46): blogFeedsRouter(), FEED_SIZE, MIME, rssXml(), blogSitemapEntries(), categoryVersions(), listPage(), postVersions() (+38 more)

### Community 18 - "Tracking Events & Planning"
Cohesion: 0.09
Nodes (47): ControlAction, ShipmentControlModal(), STANDARD_HUBS, EVENT_TIME_ZONES, formatLocationStr(), getCurrentTimeStr(), getEventColors(), getEventTheme() (+39 more)

### Community 19 - "Courier & User Management"
Cohesion: 0.07
Nodes (43): canGrant(), canManageUser(), countOtherActiveSuperAdmins(), generateTempPassword(), holdsSuperAdminRole(), isAllPowerful(), lockedRoleIds(), rolesPermissions() (+35 more)

### Community 20 - "Tariffs & Dispatch Settings"
Cohesion: 0.06
Nodes (39): ALIASES_MAX, BANDS_MAX, citiesAll(), cityNameTaken(), cityOut(), CityRow, Fail, fail() (+31 more)

### Community 21 - "Leaflet Maps"
Cohesion: 0.09
Nodes (38): leaflet@^1.9.4, leaflet, DispatchMap(), esc(), MapCourier, MapRoute, OVERVIEW, drawLanesOnReveal() (+30 more)

### Community 22 - "Admin Shipment Data"
Cohesion: 0.09
Nodes (35): lucide-react, react, DeleteShipmentModal(), DeleteShipmentModalProps, EditShipmentModal(), EditShipmentModalProps, RecentlyDeletedModal(), RecentlyDeletedModalProps (+27 more)

### Community 23 - "3D Stage Core"
Cohesion: 0.08
Nodes (40): Prim, CAMERA_KEYS, CameraKey, CameraRail, DOOR_METRES, DOOR_REACH, DOOR_VIEW, gate() (+32 more)

### Community 24 - "Tariffs Console UI"
Cohesion: 0.09
Nodes (41): app, call(), HASH, now0, server, signIn(), tmpDir, PlaceState (+33 more)

### Community 25 - "Dispatch Job Writer"
Cohesion: 0.07
Nodes (44): allocateCashRef(), CASH_METHODS, CashEntryInput, CashMethod, checkJobShape(), CityRow, createJobShipment(), defaultVehicle() (+36 more)

### Community 26 - "Dispatch Status Machine"
Cohesion: 0.07
Nodes (41): ACTIONS, ACTORS, EXPECTED, FROMS, FULL_INPUT, RATES, tmpDir, BEFORE_PICKUP (+33 more)

### Community 27 - "Roles & Permissions Schema"
Cohesion: 0.08
Nodes (35): freshDb(), HASH, silent, SPEC_KEYS, createIamTables(), initIamSchema(), seedRoles(), syncPermissions() (+27 more)

### Community 28 - "Track Result Pages"
Cohesion: 0.10
Nodes (34): JourneyMap(), JourneyMapProps, markerRoleText(), positionAt(), RoutePoint, splitRouteAt(), GalleryImage, PackageGallery() (+26 more)

### Community 29 - "Blog API Routes"
Cohesion: 0.07
Nodes (38): requestHasPermission(), slugTaken(), uniqueSlug(), parseDoc(), PMNode, ADMIN_PAGE_SIZE, ALT_MAX, ANY_POST_ACCESS (+30 more)

### Community 30 - "Job Drawer & Create Dialog"
Cohesion: 0.12
Nodes (37): JobInput, IamDialog(), boardApi, BoardCity, BoardCourier, BoardZone, DispatchJob, DispatchSummary (+29 more)

### Community 31 - "City-to-City Scene"
Cohesion: 0.08
Nodes (27): ARRIVE_METRES, canvas(), CARGO_SPOT, CITY_TIMELINE, cityFocus(), CityInput, CityScene, COLORS (+19 more)

### Community 32 - "Payment Requests"
Cohesion: 0.09
Nodes (36): btc, paypal, AccountEditor, accountSummary(), blankDetails(), inputType(), newAccount(), newKey() (+28 more)

### Community 33 - "Blog Doc Renderer"
Cohesion: 0.08
Nodes (25): ATTACKS, render(), cleanTags(), BLOG_MEDIA_PREFIX, BLOG_MEDIA_SRC, CALLOUT_TONES, countWords(), DocCheck (+17 more)

### Community 34 - "Units & Measurements"
Cohesion: 0.14
Nodes (33): QuoteRequestsView(), asNumber(), ConvertedNumberInput(), ConvertedNumberInputProps, MeasureInput(), MeasureProps, NumberValue, WeightText() (+25 more)

### Community 35 - "Courier API & Cash Handover"
Cohesion: 0.07
Nodes (30): actionTime(), deliveryCodeMatches(), loadJob(), ACTION_KEY_RETENTION_MS, insertLocations(), LOCATION_RETENTION_MS, LocationPoint, MAX_POINTS_PER_REQUEST (+22 more)

### Community 36 - "Local Delivery Booking"
Cohesion: 0.10
Nodes (31): readUserInput(), MapPin, emptyPlace(), ErrorKey, LocalDeliveryPage(), LocalDeliveryPageProps, localInputValue(), PinMap (+23 more)

### Community 37 - "Admin Data Context"
Cohesion: 0.11
Nodes (30): AdminDataContext, AdminDataContextType, INITIAL_ADMIN_DOCUMENTS, INITIAL_QUOTE_REQUESTS, INITIAL_SHIPMENTS, withTrackingId(), findServiceOption(), SERVICE_OPTIONS (+22 more)

### Community 38 - "Public Tracking & Masking"
Cohesion: 0.11
Nodes (31): CityRow, CourierRow, point(), publicCourierPhoto(), publicLocalDelivery(), shipmentJob(), ZoneRow, readStoredDispatchSettings() (+23 more)

### Community 39 - "Public Blog Pages"
Cohesion: 0.14
Nodes (30): articleClick(), BlogCard(), BlogCardProps, NetworkMapPanelProps, SpeedLines(), Locale, BlogPage(), BlogPageProps (+22 more)

### Community 40 - "Settings & Currency"
Cohesion: 0.11
Nodes (28): EmailSettingsPanel(), OutboxTable(), STATUS_CHIP, when(), Filter, FILTERS, formatReceived(), MessagesView() (+20 more)

### Community 41 - "Hero Globe Scene"
Cohesion: 0.10
Nodes (27): DEPART_METRES, DOOR_Z, HERO_TIMELINE, HeroFrame, LOGO_AT, ORBIT, REST, ROLL_METRES (+19 more)

### Community 42 - "Journey Easing & Phases"
Cohesion: 0.14
Nodes (24): TANEX_LOCATIONS, LatePhase, CityPhase, cityPhase(), HeroPhase, heroPhase(), InTownPhase, inTownPhase() (+16 more)

### Community 43 - "Stage Camera & Draw"
Cohesion: 0.12
Nodes (7): loadAssets(), readyChapters(), CameraView, Focus, headerOffset(), shadowPlane(), Stage

### Community 44 - "Image Optimisation Pipeline"
Cohesion: 0.09
Nodes (29): TanEx logo and derived assets, BRAND_OUT, buildBrand(), buildIcons(), buildPhotos(), CARD_STEP_SIZES, CLEAR, CREAM (+21 more)

### Community 45 - "Server Entry & Previews"
Cohesion: 0.08
Nodes (23): dir, entries, JPEG, PNG, tmp, WEBP, resolveSessionSecret(), SESSION_SECRET_FILE (+15 more)

### Community 46 - "Path Router"
Cohesion: 0.13
Nodes (26): app, indexPath, server, tmpDir, BlogPageResult, isAllowedOrigin(), appUrl(), consoleUrl() (+18 more)

### Community 47 - "Couriers Console"
Cohesion: 0.11
Nodes (28): ProfileInput, call(), send(), CourierAvatar(), CourierEditor(), CouriersView(), initials(), Notice (+20 more)

### Community 48 - "Courier Offline Queue"
Cohesion: 0.09
Nodes (17): RawResult, AppliedListener, CourierSync, isRetryable(), Listener, loadItems(), memoryCache, memoryQueue (+9 more)

### Community 49 - "Super Admin Bootstrap"
Cohesion: 0.14
Nodes (26): ask(), askNewPassword(), confirm(), isTTY, lines, main(), rl, rlInternal (+18 more)

### Community 50 - "Admin Layout & Views"
Cohesion: 0.14
Nodes (25): AdminApp(), AdminAppProps, AdminConsole(), BlogPreview, blogPreviewToken(), BlogStudio, CouriersView, DispatchBoardView (+17 more)

### Community 51 - "Routing Engine"
Cohesion: 0.13
Nodes (27): arcPoints(), assembleRoute(), calculateRouteGeometry(), cumulativeMiles(), DISTANCE_FACTOR, draftLeg(), EstimatedPositionResult, fetchLiveRoadRoute() (+19 more)

### Community 52 - "Payment Method Validation"
Cohesion: 0.24
Nodes (21): DetailsValidation, PAYMENT_METHOD_TYPES, PaymentFieldKind, PaymentGroup, PaymentMethodDefinition, validateField(), CryptoCoin, fail() (+13 more)

### Community 53 - "Shipment Progress & Time Zones"
Cohesion: 0.18
Nodes (22): SEP_28_2026_1400_UTC, EventTime, eventTime(), MOVING_STATUSES, PRE_TRANSIT_STATUSES, ProgressRow, shipmentTransportMode(), syncTimeBasedProgress() (+14 more)

### Community 54 - "Document Center & POD"
Cohesion: 0.17
Nodes (20): DocumentCenterView(), DocumentCenterViewProps, loadPdfTools(), waitForImagesToLoad(), place(), PodDetails, PodPaper, readDetails() (+12 more)

### Community 55 - "Public Payment Section"
Cohesion: 0.14
Nodes (20): PaymentMethodCard(), Field, FIELD_ORDER, PaymentProofForm(), PaymentProofFormProps, PaymentQr(), PaymentQrProps, formatDueDate() (+12 more)

### Community 56 - "Great-Circle Simulation"
Cohesion: 0.12
Nodes (20): HONG_KONG, HOUSTON, LAGOS, LONDON, LOS_ANGELES, MANCHESTER, milesBetween(), NEW_YORK (+12 more)

### Community 57 - "Payment Proof Review"
Cohesion: 0.21
Nodes (19): NewProofsPanel(), NewProofsPanelProps, formatProofReceived(), proofAmountMismatch(), ProofFacts(), proofMethodView(), ProofReviewControls(), ProofReviewControlsProps (+11 more)

### Community 58 - "Content Deck (EN/FR)"
Cohesion: 0.12
Nodes (21): Add-ons: Express, COD, Delivery code, Packing (§3.4), API error code messages (§1.4), Careers and CSR Policy (§16), TanEx Content Deck (English master), Footer (§1.3), Carrières et Politique RSE (§16), Centre d'aide et Contact (§8), TanEx Contenus du site (French) (+13 more)

### Community 59 - "TipTap Extensions"
Cohesion: 0.09
Nodes (22): @tiptap/core@^3.33.1, @tiptap/extension-image@^3.33.1, @tiptap/extension-link@^3.33.1, @tiptap/extension-table@^3.33.1, @tiptap/extensions@^3.33.1, @tiptap/pm@^3.33.1, @tiptap/starter-kit@^3.33.1, @tiptap/core (+14 more)

### Community 60 - "Courier App Shell"
Cohesion: 0.16
Nodes (21): ACTIVE, alertNewJob(), CourierApp(), CourierRoot(), CourierShell(), readSeen(), seenKey(), SyncPill() (+13 more)

### Community 61 - "Motion & 3D Spec"
Cohesion: 0.13
Nodes (18): TanEx bike + rider model (tanex-bike.glb), capabilities.ts (canAnimate / canUseStage), Journey chapters 0-8, Globe (stage/globe.ts, Natural Earth dots), GSAP (ScrollTrigger, SplitText, CustomEase), Lenis smooth scroll, Motion & 3D Specification: The Journey, Pause motion control (tx_motion_paused) (+10 more)

### Community 62 - "Dispatch Jobs Tests"
Cohesion: 0.12
Nodes (15): act(), addCourier(), addUser(), app, call(), createJob(), HASH, json() (+7 more)

### Community 63 - "Courier Job Detail"
Cohesion: 0.21
Nodes (18): CourierPlace, JobDetail(), JobMap, PlaceCard(), courierActions(), deliveryCollect(), mapsLink(), pickupCollect() (+10 more)

### Community 64 - "Page Motion Hooks"
Cohesion: 0.18
Nodes (15): parallaxAt(), loadedGsap(), loadGsap(), GsapKit, findHero(), INNER_REVEAL, InnerPageMotion(), isFirstView() (+7 more)

### Community 65 - "Deployment Spec"
Cohesion: 0.11
Nodes (19): Courier app UI rules (56px buttons, one-handed), Reference formats (TX-TKT, TX-INV, TX-SL, TX-CSH, QR-YYYY), UI details (grid, radius, elevation, motifs, focus), Generated documents: waybill, BOL, invoice, POD (§11), After launch: backups, retention, monitoring, security, Deployment: GitHub to Hostinger, Domain and paths (apex, /private-user/ noindex), Email DNS (MX, SPF, DKIM, DMARC) (+11 more)

### Community 66 - "Geocoding & Hubs"
Cohesion: 0.13
Nodes (19): NetworkMapLabels, TransportMode, getRoutingHub(), ROUTING_HUBS, RoutingHub, AddressQuery, fold(), gatewayToLocation() (+11 more)

### Community 67 - "Parcel Label 3D"
Cohesion: 0.12
Nodes (16): CENTRE, LABEL_TIMELINE, LabelPose, LabelRig, code128B(), PATTERNS, buildParcel(), COLORS (+8 more)

### Community 68 - "Legal Pages"
Cohesion: 0.14
Nodes (18): Mentions légales (§13), Legal pages: Privacy, Terms, Shipping Terms, Cookies, Accessibility (§13), DOMAIN, HQ_ADDRESS_FR, LEGAL_DOC_IDS, LEGAL_LAST_UPDATED, LEGAL_URL, LegalBlock (+10 more)

### Community 69 - "Payments & Images Update Spec"
Cohesion: 0.17
Nodes (13): In-app channel (console badges, toasts, dispatch board), Dashboard notifications (badge, bell, toast, ngf_seen_proofs), Files & storage requirements (UPLOADS_DIR, magic bytes), Prompt: Package Images, Payment Methods & Proof of Payment, Proof submission rules (POST /api/track/:id/payment-proof), Workflow per task and report back, Public GET /media/:id route, Payment method registry src/shared/paymentMethods.ts (+5 more)

### Community 70 - "Dispatch Transition Routes"
Cohesion: 0.14
Nodes (15): applyTransition(), DELIVERY_CODE_TRIES, hashDeliveryCode(), NOTE_MAX, actorOf(), BEFORE_PICKUP, canManage, canView (+7 more)

### Community 71 - "Local Pricing & POD Docs"
Cohesion: 0.17
Nodes (18): JobRow, priceJob(), createPodDocument(), newPodId(), PodDetails, IntercityRate, intercityRateFromRow(), isSizeClass() (+10 more)

### Community 72 - "Tracking ID Generation"
Cohesion: 0.18
Nodes (14): db, generateUniqueTrackingId(), generateTrackingId(), ID_LENGTH, isValidTrackingId(), normalizeTrackingInput(), ParsedTrackingInput, parsePieceLabel() (+6 more)

### Community 73 - "Courier Screens & API Types"
Cohesion: 0.19
Nodes (15): EMPTY, CashBalance, CashEntry, CashInput, CashMethod, CashState, courierApi, CourierJob (+7 more)

### Community 74 - "Dispatch Spec"
Cohesion: 0.16
Nodes (16): Blog SEO (hreflang, OG, JSON-LD BlogPosting, sitemap, RSS), Tracking ID format (TX + 6 safe chars), Launch checklist, COD, cash balance and 7-day handover (cashHandover.ts), cash_ledger table (TX-CSH), Courier (BIKE/VAN/TRUCK, rider vs driver), couriers table, delivery_cities and delivery_zones tables (+8 more)

### Community 75 - "Project Tracker"
Cohesion: 0.14
Nodes (14): Blocked / Needs owner list, Blog (F.1-F.3: studio, public blog, RSS), Change log, Courier app (G.4, offline queue, location sharing), DB_PATH ignored when set only in .env (import order), Decisions log, Dispatch board (G.5), domGuard and ErrorBoundary fix (removeChild crash) (+6 more)

### Community 76 - "Blog SEO & Sitemap"
Cohesion: 0.13
Nodes (11): app, conn, indexPath, now, render, server, ADMIN_PREFIX, extraEntries() (+3 more)

### Community 77 - "Journey Controller Logic"
Cohesion: 0.16
Nodes (12): beatOf(), BEATS, clamp01(), headerOffset(), PIN_VH, setBeat(), setupJourney(), STEPS (+4 more)

### Community 78 - "Journey Store & Route Rail"
Cohesion: 0.17
Nodes (15): INITIAL, initialState(), JourneyContext, JourneyControllerProps, JourneyModule, useJourney(), useJourneyChapter(), useJourneyStore() (+7 more)

### Community 79 - "Arrival Door Scene"
Cohesion: 0.16
Nodes (9): ArrivalScene, HeroScene, buildDoor(), COLORS, Door, fadeTexture(), glowTexture(), linearToSrgb() (+1 more)

### Community 80 - "TS Config (client)"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+9 more)

### Community 81 - "IAM & RBAC Spec"
Cohesion: 0.16
Nodes (15): audit_log and audit() helper, IAM & RBAC Specification, Login by email or phone with lockout (5 failures / 15 min), Password reset tokens (password_resets), Permission catalogue src/shared/permissions.ts, requirePermission / requireAuth middleware, Roles and role_permissions / user_roles, Mapping existing routes to permissions (B.3) (+7 more)

### Community 82 - "3D Assets & Bike Loader"
Cohesion: 0.15
Nodes (14): three, ASSETS, BIKE_MODEL_URL, gltfExtensions(), loadGltf(), StageAsset, TRUCK_MODEL_URL, BIKE_COLORS (+6 more)

### Community 83 - "In-Town Phone Map Scene"
Cohesion: 0.15
Nodes (12): IN_TOWN_TIMELINE, inTownDistance(), MAP, mapRoutePoint(), mapTexture(), ON_THE_WAY_METRES, PHONE_FOCUS, PhoneMap (+4 more)

### Community 84 - "Brand Guide"
Cohesion: 0.12
Nodes (12): BRAND_COLORS in brand.ts, TanEx Brand Guide & Design System, Name usage (TanEx vs Tanex SARL), Palette (Chocolate, Cream, Orange #F48800), Secondary slogan: Saving Situations, Tagline: From Your Door to the World, .tx-dark context and --tx-accent-text, --tx-* design tokens (tokens.css) (+4 more)

### Community 85 - "Platform Plan & I18N Routes"
Cohesion: 0.17
Nodes (13): Stable API error codes mapped by the client, Intl formatting format.ts (en-CM / fr-CM, XAF 0 decimals), Languages, Routing & Page Meta Specification (EN/FR), Server page meta injection server/render/pageMeta.ts, Route table src/router/routes.ts, Bilingual sitemap with hreflang alternates, Tracking event title_key / title_vars_json, EN/FR URL scheme (/ and /fr/) (+5 more)

### Community 86 - "Design Direction Doc"
Cohesion: 0.15
Nodes (12): docs/BRAND_GUIDE.md, Approval decisions and open items, Components (buttons, track field, chips, cards) light/dark, Live WCAG contrast table (lum/ratio), TanEx Design Direction (C.1, approved 7 Nov 2026), Palette scales (chocolate, cream, orange, status), Role tokens (--tx-bg, --tx-text, --tx-accent...), Ch 7 FAQ + Blog (no sample posts) (+4 more)

### Community 87 - "3D Model Brief"
Cohesion: 0.16
Nodes (12): tanex_bike model (bike + rider + top box), Blender blockout scripts (build_tanex_bike.py / build_tanex_truck.py), 3D colour specification (brand palette), Deliverables (.blend + .glb, textures, renders), Milestones M1-M3 and acceptance check, phone_screen 'screen' material (live map), Named pivot hierarchy (front_wheel, handlebar, rider_torso, box_lid, parcel_socket), TanEx 3D Model Brief and RFQ (+4 more)

### Community 88 - "Blog Tests"
Cohesion: 0.19
Nodes (11): app, as(), call(), cookies, createPost(), doc(), HASH, now0 (+3 more)

### Community 89 - "Scroll Glide & Progress"
Cohesion: 0.29
Nodes (12): clamp01(), easeInOutCubic(), glide(), GLIDE_MS, glideAt(), HERO_PARALLAX_PX, isLongPage(), LONG_PAGE_SCREENS (+4 more)

### Community 90 - "Shipment Images API"
Cohesion: 0.16
Nodes (9): deleteAllShipmentImages(), formatImage(), ImageRow, listImages(), MAX_CAPTION_LENGTH, MAX_IMAGES_PER_SHIPMENT, publicShipmentImages(), shipmentImagesRouter (+1 more)

### Community 91 - "Courier Sheets"
Cohesion: 0.36
Nodes (12): CashScreen(), useCourierText(), CourierStep, draftFor(), FailSheet(), PickupSheet(), PodSheet(), readCash() (+4 more)

### Community 92 - "TS Config (server)"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, module, moduleResolution, noUnusedLocals, noUnusedParameters, outDir, resolveJsonModule (+5 more)

### Community 93 - "Company Facts & Hours"
Cohesion: 0.22
Nodes (13): Company facts (single source of truth), Console at /private-user/ (staff + courier app), Opening hours 24/7 (supersedes flyer 9-4), Reference prefixes TX-TKT/INV/SL/CSH, QR-YYYY, Tracking ID format (TX + 6 = 8 chars), Ch 6 Contact (channels + form), Ch 5 Smart label (barcode TX7K2M9P), Cash & Mobile Money ledger (TX-CSH) (+5 more)

### Community 94 - "Home Mock Design"
Cohesion: 0.18
Nodes (12): docs/CONTENT.md / CONTENT_FR.md, Camera use per chapter, Homepage mock frames (desktop iframe + phone), design/tx.css + sprite.js (shared mock assets), Bike lane (alternating 3D lane beside content), Ch 8 Footer: Delivered (arrival at a door), Ch 0 Hero: Your door (track field, globe), postMessage tx-height / tx-guides bridge (+4 more)

### Community 95 - "Console & Dispatch Copy"
Cohesion: 0.15
Nodes (13): Admin console strings (§10), Blog studio and author profile copy (§10.4), Courier app copy (§10.3), Dispatch board and tariffs copy (§10.2), Application livreur (§10.3), Seeded roles (Super Admin, Operations Manager, Dispatch Manager, Courier, Marketing, Finance, Customer Support), Staff sign-in, accounts, roles, audit (§10.1), Courier assignment suggestions (+5 more)

### Community 96 - "Auth Tests"
Cohesion: 0.17
Nodes (7): DB_FILE, HASH, login(), openApps, sidCookie(), TestApp, tmpDir

### Community 97 - "Permissions Tests"
Cohesion: 0.17
Nodes (11): app, call(), cookieFor(), cookies, HASH, now, PermissionKey, Probe (+3 more)

### Community 98 - "Home & Blog Copy"
Cohesion: 0.18
Nodes (10): Public blog pages (/blog, /fr/blog, /blog/<slug>), Bike delivery section (§2.3), Blog pages copy (§15), Page d'accueil (§2), Pages du blog (§15), From the blog home section (§2.9), Home page copy (§2), The Journey chapter beats and route rail (§2.10) (+2 more)

### Community 99 - "Motion Capabilities"
Cohesion: 0.35
Nodes (10): afterLoadIdle(), canAnimate(), canSmoothScroll(), canUseStage(), matches(), pauseListeners, prefersReducedMotion(), saveData() (+2 more)

### Community 100 - "Project Docs Index"
Cohesion: 0.24
Nodes (9): docs/DEPLOYMENT.md, docs/PROJECT_TRACKER.md, docs/TANEX_PLAN.md, Deploy from GitHub to Hostinger Node.js app, TanEx / Tanex SARL, TanEx Platform (CLAUDE.md), TanEx Build Prompt Pack, Phase J: QA, security & launch (+1 more)

### Community 102 - "Multipart Parser"
Cohesion: 0.24
Nodes (10): malformed, MultipartBody, multipartBoundary(), MultipartFile, MultipartLimits, MultipartResult, parseMultipart(), readBody() (+2 more)

### Community 103 - "Blog Spec"
Cohesion: 0.24
Nodes (9): blog_categories table, Blog media pipeline (browser WebP compression, /media/blog), blog_media table, Blog permissions (blog.view/write/edit_any/publish/categories), blog_posts table, blog_slug_redirects (301 old slugs), Blog Specification, Blog studio (console, lazy chunk) (+1 more)

### Community 104 - "Track & Payment Copy"
Cohesion: 0.27
Nodes (9): Événements écrits par le système (§6.11), Moyens de paiement et section paiement (§6.7, §6.8, §6.10), Suivi, résultat du suivi (§6), Suivi : livraisons locales et entre villes (§6.9), Track Result: local and intercity deliveries (§6.9), Payment methods (§6.7, §6.10 incl. MTN MoMo / Orange Money), Track Result payment section and proof of payment (§6.8), System timeline event titles (§6.11, eventTitles.ts) (+1 more)

### Community 105 - "NPM Scripts"
Cohesion: 0.20
Nodes (10): scripts, build, create-super-admin, dev, dev:vite, postinstall, preview, server (+2 more)

### Community 106 - "Payment Icons"
Cohesion: 0.27
Nodes (7): dir, LUCIDE_FALLBACKS, PAYMENT_ICON_PATHS, FALLBACKS, ICON_COLORS, PaymentIconProps, PAYMENT_METHODS

### Community 107 - "Payment Proof Validation"
Cohesion: 0.24
Nodes (8): ids, PROOF_LIMITS, PROOF_STATUSES, ProofStatus, ProofSubmission, ProofValidation, validateProofSubmission(), PAYMENT_LIMITS

### Community 108 - "Courier Profile & PWA"
Cohesion: 0.36
Nodes (8): CourierLang, ProfileScreen(), BeforeInstallPromptEvent, canInstall(), installListeners, onInstallChange(), promptInstall(), errorText()

### Community 109 - "Services Road Scene"
Cohesion: 0.24
Nodes (8): bandFrame(), COLORS, endsTexture(), rideProgress(), roadTexture(), ServicesOutput, ServicesPose, ServicesScene

### Community 110 - "I18N Spec & Stack"
Cohesion: 0.22
Nodes (7): docs/I18N_SPEC.md, Public/ static assets folder (capital P), Tech stack (React 18/Vite 6, Express 5, node:sqlite), Type system (Plus Jakarta Sans 800 + italic word, Inter, JetBrains Mono), tx:head markers (server-replaced head), server/render/pageMeta.ts head injection, Phase D: Routing & languages (path routing, page meta, i18n)

### Community 111 - "Motion Spec Overview"
Cohesion: 0.33
Nodes (6): docs/MOTION_3D_SPEC.md, Journey storyboard (9 key frames, chapters 0-8), JourneyController (ScrollTrigger per chapter), Phase H: The Journey (GSAP + Three.js), 3D Stage (src/motion/stage/), H0: 3D models brief

### Community 112 - "Notifications Spec"
Cohesion: 0.39
Nodes (8): buildWhatsAppLink (src/shared/whatsapp.ts), email_outbox with retry worker, Later upgrade: WhatsApp Business Cloud API / SMS, notification_log table, Notifications Specification (email + free WhatsApp), SMTP mailer via nodemailer (Hostinger), Notification templates (auth.reset, booking.confirmed, local.*, payment.*), G.8 Cash ledger, Finance confirmation and notifications wiring (open)

### Community 113 - "Index.html & Rebrand"
Cohesion: 0.25
Nodes (8): Brand favicons and manifest links (?v=7), index.html SPA shell, noscript 'Powered by Coretex Core Group' credit, Open Graph / Twitter meta, Organization JSON-LD (TanEx, Tanex SARL), Phase A: Separation & rebrand foundation, A2: Brand config, IDs and metadata, A3: Logo and icons pipeline

### Community 114 - "Dev Dependencies"
Cohesion: 0.22
Nodes (9): devDependencies, concurrently@^10.0.5, gltfpack@^1.3.0, sharp@^0.35.4, tsx@^4.23.12, concurrently, gltfpack, sharp (+1 more)

### Community 115 - "Reference Number Formats"
Cohesion: 0.33
Nodes (6): REFERENCE_PREFIX, generateReference(), REFERENCE_PATTERN, REFERENCE_PREFIXES, referenceFor(), ReferenceKind

### Community 116 - "Public Tracking & Blog API Docs"
Cohesion: 0.25
Nodes (5): server/routes/blog.ts and publicBlog.ts, Public blog API (/api/blog), Positioning pillars (Door to world, Live visibility, Accountable hands, Local roots), Track page for local/intercity jobs (stepper, live marker), server/dispatch/publicTracking.ts and src/shared/localTracking.ts

### Community 117 - "Owner Brand Assets"
Cohesion: 0.29
Nodes (8): #118 Domain conflict tanexsarl.com vs tanexx.com, Brand colours: dark chocolate, cream, small orange, Owner notes info.txt, Site link www.tanexsarl.com, TanEx logo.png (owner), Managing Director portrait, Owner's flyer, notes and brief (info.png, info.txt, image.png), images/tanex files sources (owner-supplied)

### Community 118 - "Courier Location Sharing"
Cohesion: 0.32
Nodes (7): courierUrls, sendRaw(), distanceM(), LocationPermission, Point, useLocationSharing(), WakeLockSentinelLike

### Community 119 - "Smooth Scroll (Lenis)"
Cohesion: 0.43
Nodes (5): lenis, whenIdle(), headerOffset(), keepNative(), SmoothScroll()

### Community 120 - "Pause Motion Control"
Cohesion: 0.48
Nodes (6): isMotionPaused(), setMotionPaused(), subscribeMotionPaused(), PauseMotionButton(), PauseMotionButtonProps, useMotionPaused()

### Community 121 - "IAM Phase Summary"
Cohesion: 0.50
Nodes (4): docs/IAM_RBAC_SPEC.md, audit() / audit_log, Phase B: Identity & access (IAM/RBAC), SQLite session store (tx.sid cookie)

### Community 122 - "Service Card Photos"
Cohesion: 0.40
Nodes (5): #146 Credit for Local delivery card photo (CC BY-SA 4.0), Owner decisions (2026-11-06), Six service card photos (Unsplash License), Homepage service card photos sources, UB Junction, Molyko, Buea photo (Adesolive, CC BY-SA 4.0)

### Community 123 - "Stock Photo Sources"
Cohesion: 0.40
Nodes (5): Free images (CC0) sources, Free images (Pexels License) sources, locations-hero photo (console sign-in background), Free stock photos (Pexels License) sources, Unsplash photos sources (retired hero photos)

### Community 124 - "Vite Build"
Cohesion: 0.40
Nodes (4): vite@^6.1.0, @vitejs/plugin-react@^4.3.4, vite, @vitejs/plugin-react

### Community 126 - "Brand Fonts"
Cohesion: 0.40
Nodes (5): Inter font licence (SIL OFL 1.1), JetBrains Mono font licence (SIL OFL 1.1), Plus Jakarta Sans font licence (SIL OFL 1.1), Brand fonts (self-hosted) README, Self-hosted WOFF2 Latin/Latin-ext subsets from @fontsource v5

### Community 127 - "Quote & Booking Copy"
Cohesion: 0.67
Nodes (4): Devis, Expédier (§7), Réserver une livraison à moto (§7.5), Local delivery booking copy (§7.5), Quote, Ship, Quote Result (§7)

## Ambiguous Edges - Review These
- `Fresh site, fresh identity (no previous-client traces)` → `noscript 'Powered by Coretex Core Group' credit`  [AMBIGUOUS]
  index.html · relation: conceptually_related_to

## Knowledge Gaps
- **66 isolated node(s):** `Public/ static assets folder (capital P)`, `graphify knowledge graph usage rules`, `SQLite session store (tx.sid cookie)`, `audit() / audit_log`, `Phase E: Public site rebuild` (+61 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1077 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Admin Shipment Data` to `Blog Studio Editor`, `App Shell & Navigation`, `Console Auth & IAM UI`, `Locale Runtime & Header`, `NPM Dependencies`, `Shipment Creation & Quotes`, `Brand Config & DB Core`, `Company Pages & UI Kit`, `Home & Contact Pages`, `Dispatch Board`, `Tracking Events & Planning`, `Leaflet Maps`, `Tariffs Console UI`, `Track Result Pages`, `Job Drawer & Create Dialog`, `Payment Requests`, `Units & Measurements`, `Local Delivery Booking`, `Admin Data Context`, `Public Blog Pages`, `Settings & Currency`, `Couriers Console`, `Admin Layout & Views`, `Document Center & POD`, `Public Payment Section`, `Payment Proof Review`, `Courier App Shell`, `Courier Job Detail`, `Page Motion Hooks`, `Legal Pages`, `Courier Screens & API Types`, `Journey Store & Route Rail`, `Scroll Glide & Progress`, `Courier Sheets`, `Motion Capabilities`, `Payment Icons`, `Courier Profile & PWA`, `Courier Location Sharing`, `Smooth Scroll (Lenis)`, `Pause Motion Control`?**
  _High betweenness centrality (0.108) - this node is a cross-community bridge._
- **What connects `Public/ static assets folder (capital P)`, `graphify knowledge graph usage rules`, `SQLite session store (tx.sid cookie)` to the rest of the system?**
  _66 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `API Routes & Middleware` be split into smaller, more focused modules?**
  _Cohesion score 0.035434173669467786 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `Admin Shipment Data` to `Blog Studio Editor`, `App Shell & Navigation`, `Console Auth & IAM UI`, `Locale Runtime & Header`, `NPM Dependencies`, `Shipment Creation & Quotes`, `Brand Config & DB Core`, `Company Pages & UI Kit`, `Home & Contact Pages`, `Dispatch Board`, `Tracking Events & Planning`, `Leaflet Maps`, `Tariffs Console UI`, `Track Result Pages`, `Job Drawer & Create Dialog`, `Payment Requests`, `Local Delivery Booking`, `Admin Data Context`, `Public Blog Pages`, `Settings & Currency`, `Couriers Console`, `Admin Layout & Views`, `Document Center & POD`, `Public Payment Section`, `Payment Proof Review`, `Courier App Shell`, `Courier Job Detail`, `Legal Pages`, `Courier Screens & API Types`, `Journey Store & Route Rail`, `Scroll Glide & Progress`, `Courier Sheets`, `Payment Icons`, `Courier Profile & PWA`, `Pause Motion Control`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Should `i18n Dictionaries` be split into smaller, more focused modules?**
  _Cohesion score 0.043156245549067086 - nodes in this community are weakly interconnected._
- **Why does `Company facts (single source of truth)` connect `Company Facts & Hours` to `Index.html & Rebrand`, `Brand Config & DB Core`, `Project Docs Index`, `3D Model Brief`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `Fresh site, fresh identity (no previous-client traces)` and `noscript 'Powered by Coretex Core Group' credit`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._