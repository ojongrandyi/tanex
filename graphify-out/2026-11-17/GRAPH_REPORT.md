# Graph Report - Tanex  (2026-11-17)

## Corpus Check
- 146 files · ~533,959 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 4208 nodes · 11701 edges · 165 communities (143 shown, 22 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 136 edges (avg confidence: 0.83)
- Token cost: 474,560 input · 0 output

## Community Hubs (Navigation)
- Server Test Suites
- API Routes & Middleware
- Shipment Booking Forms
- Email Outbox & Templates
- Brand Config & Site Chrome
- Auth Routes & Uploads
- Blog Studio Editor
- Public Pages & Blog Views
- Dispatch Job Engine
- UI Kit & Services Pages
- Database & Server Boot Tests
- Blender 3D Model Scripts
- Dispatch Board Logic
- Console Auth Context
- Permissions & Super Admin
- Couriers & Users Routes
- i18n Provider & Navigation
- Routing Engine & Journey Map
- French Site Content
- Track Result & Documents
- Blog API Routes
- Server Page Meta
- Dispatch Job Drawer
- Blog Rendering
- Admin Data Types
- Dispatch Status Machine
- App Shell
- 3D Arrival & Stage Assets
- Shop Spec
- Tariffs Routes
- City-to-City 3D Scene
- Payment Proofs Console
- Dispatch Spec
- Payment Requests
- Home Page
- Admin Console Layout
- Project Tracker: Launch & Owner Items
- Motion Easing Utils
- Shipments Console
- Brand Image Pipeline
- Shipment Progress & Time
- Shipment Planning Engine
- 3D Stage & Lanes
- Payment Methods & Validation
- Content Deck Overview
- Public Blog & RSS
- Stage Rendering Loop
- Public Payment Section
- Courier API Routes
- Tariffs Console
- Courier Offline Queue
- Tracker: Decisions & Dispatch
- Dispatch & Delivery API Client
- Network Map & Locations
- 3D Hero Globe
- Geocoding & Hubs
- Public Local Tracking
- Cash Console
- Content: Console & Tracking Copy
- Cash Report Logic
- Runtime Dependencies
- i18n Area Dictionaries
- WhatsApp Job Messages
- Tracking Events Console
- Page Motion & Reveals
- Server Dependencies
- TipTap Editor Dependencies
- Tanex Master Plan
- Design Direction Mocks
- Couriers Console & WhatsApp Log
- Dispatch Jobs Tests
- 3D Hero & Door
- 3D Label & Parcel
- Leaflet Maps
- Smooth Scroll & Route Rail
- Courier App Shell
- Courier Sheets & Cash
- Tracker: Design & Console Phases
- Roles Routes
- 3D Model Brief
- Payments Update Spec
- Tracking IDs
- Courier Jobs Screens
- Content: Home & Blog Copy
- Tracker: Journey Phase
- Local Pricing & POD
- TypeScript Config
- Router Route Table
- Legal Pages
- Courier Location Sharing
- Journey Scroll Store
- Brand Guide
- Motion & 3D Spec
- Tracker: Shop Phase M
- Image Compression
- Password Reset Tests
- Courier Profile & PWA
- i18n Types
- Project Rules (CLAUDE.md)
- Blog Spec
- IAM & RBAC Spec
- Glide & Page Progress
- Cash API Routes
- Local Delivery Booking Page
- i18n Home & Delivery Copy
- In-Town 3D Scene
- Tracker: Public Site Phase
- Tracker: IAM Phase
- API Error Codes
- i18n Runtime Loader
- Server TS Config
- Company Facts & Launch
- Notifications Spec
- Auth Tests
- Motion Capabilities
- Journey Controller & QA
- Users Tests
- I18N Spec
- SQLite Session Store
- Multipart Parsing
- Dispatch Settings
- Deployment Guide
- Tracker: Routing Phase
- App Shell HTML
- npm Scripts
- Dev Dependencies
- Reference Numbers
- Event Titles & Typography
- Blog Preview Tokens
- Stock Image Sources
- PDF Tools
- Vite Build
- Courier Service Worker
- Self-hosted Fonts
- i18n Blog
- i18n Company
- i18n Help
- i18n Network
- i18n Not Found
- i18n Quote
- i18n Services
- i18n Track
- i18n Track Result
- Prompts: IAM Phase
- Prompts: Dispatch Phase
- dotenv
- Rate Limiting
- Express Session
- GSAP
- Dev Proxy
- Nodemailer
- QR Codes
- React DOM
- HTML Sanitizer
- Compression Types
- Sanitizer Types
- Prompts Pack Intro
- Prompts: Routing Phase
- Design: City to City
- Design: Smart Label
- Design: Services
- Prompts: Blog Phase
- Prompts: Launch Phase
- Prompts: Utilities

## God Nodes (most connected - your core abstractions)
1. `react` - 135 edges
2. `lucide-react` - 87 edges
3. `useAreaT()` - 56 edges
4. `MainAppContent()` - 50 edges
5. `docs/SHOP_SPEC.md` - 46 edges
6. `useAuth()` - 44 edges
7. `express` - 44 edges
8. `useLocale()` - 43 edges
9. `renderEmail()` - 41 edges
10. `docs/DISPATCH_SPEC.md` - 41 edges

## Surprising Connections (you probably didn't know these)
- `Ch 2 In town (bike delivery, from 500 FCFA)` --references--> `Company facts (single source of truth)`  [INFERRED]
  design/home.html → CLAUDE.md
- `formatMessage()` --calls--> `getGateway()`  [EXTRACTED]
  server/routes/messages.ts → src/data/gateways.ts
- `Six service card photos (Unsplash License)` --conceptually_related_to--> `Owner decisions (2026-11-06)`  [INFERRED]
  images/services/SOURCES.md → docs/TANEX_PLAN.md
- `Approval decisions and open items` --conceptually_related_to--> `No fabricated facts rule`  [INFERRED]
  design/direction.html → CLAUDE.md
- `Ch 6 Contact (channels + form)` --shares_data_with--> `Company facts (single source of truth)`  [INFERRED]
  design/home.html → CLAUDE.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Blog publishing flow: studio, sanitisation, public API, public pages, SEO** — docs_blog_spec_blog_studio, docs_blog_spec_html_sanitisation, docs_blog_spec_public_blog_api, docs_blog_spec_public_blog_pages, docs_blog_spec_blog_seo [EXTRACTED 1.00]
- **Server-side IAM enforcement** — docs_iam_rbac_spec_requirepermission, docs_iam_rbac_spec_permission_catalogue, docs_iam_rbac_spec_sqlite_session_store, docs_iam_rbac_spec_audit_log, docs_iam_rbac_spec_roles [EXTRACTED 1.00]
- **Journey motion stack** — docs_motion_3d_spec_stage, src_motion_journeycontroller, docs_motion_3d_spec_route_rail, docs_motion_3d_spec_posters, docs_motion_3d_spec_capabilities, docs_motion_3d_spec_gsap, docs_motion_3d_spec_three [EXTRACTED 1.00]
- **Proof of payment flow** — docs_update_shipment_payments, docs_update_payment_proofs, docs_update_payment_method_registry, docs_prompt_update_dashboard_notifications, docs_prompt_update_proof_submission [EXTRACTED 1.00]
- **Homepage Journey chapters 0-8 (bike rides the route)** — design_home_hero_chapter, design_home_services_chapter, design_home_in_town_chapter, design_home_city_to_city_chapter, design_home_network_chapter, design_home_labels_chapter, design_home_contact_chapter, design_home_faq_blog_chapter, design_home_footer_delivered [EXTRACTED 1.00]
- **3D bike specification chain (reference sheet -> brief -> placeholder -> Stage)** — design_direction_bike_reference_sheet, design_3d_brief_bike_model, design_3d_brief_pivot_hierarchy, prompts_primitives_bike, prompts_stage [INFERRED 0.85]
- **Local bike delivery lifecycle: booking, dispatch, courier app, live tracking, POD** — docs_content_local_delivery_booking, docs_content_dispatch_board_tariffs, docs_content_courier_app, docs_content_local_tracking, docs_content_proof_of_delivery [INFERRED 0.85]
- **Customer payment flow: methods, payment section, proof, cash ledger** — docs_content_payment_methods, docs_content_tanex_payment_methods, docs_content_payment_section, docs_content_cash_ledger [INFERRED 0.75]
- **Dispatch job lifecycle (booking to POD and cash)** — docs_project_tracker_g6_local_delivery_booking, docs_project_tracker_g3_job_lifecycle_api, docs_project_tracker_write_transition, docs_project_tracker_g4_courier_app, docs_project_tracker_cash_ledger, docs_project_tracker_pod_document, docs_project_tracker_g7_public_live_tracking [EXTRACTED 1.00]
- **IAM security stack** — docs_project_tracker_session_store, docs_project_tracker_require_permission, docs_project_tracker_audit_log, scripts_routeguards_test, docs_project_tracker_b6_email_password_reset [EXTRACTED 1.00]
- **Journey 3D pipeline** — docs_project_tracker_journey_controller, docs_project_tracker_stage, docs_project_tracker_tanex_bike_model, docs_project_tracker_tanex_truck_model, docs_project_tracker_h0_3d_brief [INFERRED 0.85]
- **Parcours de livraison locale (réservation, suivi en direct, application livreur, notifications)** — docs_content_fr_reserver_livraison_moto, docs_content_fr_suivi_livraisons_locales, docs_content_fr_application_livreur, docs_content_fr_modeles_de_notifications, docs_content_fr_evenements_systeme [INFERRED 0.85]
- **Onglets des mentions légales** — docs_content_fr_politique_de_confidentialite, docs_content_fr_conditions_d_utilisation, docs_content_fr_conditions_d_expedition, docs_content_fr_politique_de_cookies, docs_content_fr_accessibilite, docs_content_fr_retours_et_remboursements [EXTRACTED 1.00]
- **Flux de paiement et preuve** — docs_content_fr_section_paiement, docs_content_fr_moyens_paiement_tanex, docs_content_fr_aide_livraison_locale_paiements, docs_content_fr_codes_erreur_api [INFERRED 0.75]
- **Shop order to dispatch delivery flow** — docs_shop_spec_place_order_transaction, docs_shop_spec_shop_order_status_machine, docs_shop_spec_send_to_dispatch, docs_dispatch_spec_dispatch_jobs_table, docs_dispatch_spec_job_lifecycle [EXTRACTED 1.00]
- **Shared delivery pricing (local form and shop)** — docs_dispatch_spec_local_pricing, docs_dispatch_spec_zone_rates_table, docs_dispatch_spec_intercity_rates_table, docs_shop_spec_delivery_fee, src_shared_localpricing [EXTRACTED 1.00]
- **COD collection and Finance confirmation** — docs_dispatch_spec_cod_and_handover, docs_dispatch_spec_cash_ledger_table, docs_shop_spec_shop_payment, docs_dispatch_spec_company_momo [INFERRED 0.85]
- **G.9 end-to-end local delivery flow** — docs_field_test_g9_booking, docs_field_test_g9_live_map, docs_field_test_g9_failed_attempt, docs_field_test_g9_pod_cash, docs_field_test_g9_finance [EXTRACTED 1.00]
- **Retired stock photo source records** — images_free_cc0_sources_cc0_images, images_free_pexels_sources_pexels_images, images_free_stock_sources_stock_photos, images_unsplash_sources_unsplash_photos [EXTRACTED 1.00]
- **Per-page meta injection into index.html** — index_tx_head_markers, index_organization_jsonld, server_render_pagemeta, claude_company_facts [INFERRED 0.85]

## Communities (165 total, 22 thin omitted)

### Community 0 - "Server Test Suites"
Cohesion: 0.02
Nodes (95): app, as(), call(), cookies, createPost(), doc(), HASH, now0 (+87 more)

### Community 1 - "API Routes & Middleware"
Cohesion: 0.03
Nodes (104): express, startApp(), audit(), AuditActor, audited(), FromReq, param(), stripSecrets() (+96 more)

### Community 2 - "Shipment Booking Forms"
Cohesion: 0.06
Nodes (86): libphonenumber-js, lucide-react, PackageItem, ServiceOption, ShipmentTypeOption, QuoteRequestsView(), EmailSettingsPanel, SettingsView() (+78 more)

### Community 3 - "Email Outbox & Templates"
Cohesion: 0.05
Nodes (60): escapeHtml(), MailLocale, Paragraph, paragraphHtml(), paragraphText(), RenderedEmail, renderEmail(), Segment (+52 more)

### Community 4 - "Brand Config & Site Chrome"
Cohesion: 0.05
Nodes (82): Footer(), footerColumns(), FooterProps, POWERED_BY, SOCIAL_LINKS, TRUST_ICONS, TRUST_KEYS, hasMenu() (+74 more)

### Community 5 - "Auth Routes & Uploads"
Cohesion: 0.05
Nodes (65): consumeResetToken(), createResetToken(), findResetUser(), findValidToken(), hashResetToken(), RESET_REQUESTS_PER_HOUR, RESET_TOKEN_TTL_MS, ResetUser (+57 more)

### Community 6 - "Blog Studio Editor"
Cohesion: 0.08
Nodes (60): blogApi, BlogCategory, BlogCover, BlogLocale, BlogMedia, BlogPost, BlogPostSummary, DocNode (+52 more)

### Community 7 - "Public Pages & Blog Views"
Cohesion: 0.07
Nodes (61): articleClick(), BlogCard(), BlogCardProps, NetworkMapPanelProps, PageHero(), SpeedLines(), OPENING_HOURS, OpeningHours (+53 more)

### Community 8 - "Dispatch Job Engine"
Cohesion: 0.05
Nodes (59): allocateCashRef(), applyTransition(), CASH_METHODS, CashEntryInput, CashMethod, checkJobShape(), CityRow, createJobShipment() (+51 more)

### Community 9 - "UI Kit & Services Pages"
Cohesion: 0.05
Nodes (54): Button, ButtonAsButton, ButtonAsLink, buttonClass(), ButtonProps, ButtonSize, ButtonVariant, CommonProps (+46 more)

### Community 10 - "Database & Server Boot Tests"
Cohesion: 0.05
Nodes (46): app, conn, indexPath, now, render, server, dir, entries (+38 more)

### Community 11 - "Blender 3D Model Scripts"
Cohesion: 0.08
Nodes (36): activate(), arc_band(), box(), decal(), disc(), ellipsoid(), empty(), finish() (+28 more)

### Community 12 - "Dispatch Board Logic"
Cohesion: 0.06
Nodes (54): app, call(), createJob(), HASH, NOW, now0, place(), server (+46 more)

### Community 13 - "Console Auth Context"
Cohesion: 0.08
Nodes (53): AdminLogin(), AdminLoginProps, AuthCard(), AuthError(), ForgotPassword(), readResetToken(), ResetPassword(), ForcedPasswordChange() (+45 more)

### Community 14 - "Permissions & Super Admin"
Cohesion: 0.07
Nodes (53): bcryptjs@^3.0.3, bcryptjs, ask(), askNewPassword(), confirm(), isTTY, lines, main() (+45 more)

### Community 15 - "Couriers & Users Routes"
Cohesion: 0.06
Nodes (51): loadUserPermissions(), canGrant(), canManageUser(), countOtherActiveSuperAdmins(), generateTempPassword(), holdsSuperAdminRole(), isAllPowerful(), lockedRoleIds() (+43 more)

### Community 16 - "i18n Provider & Navigation"
Cohesion: 0.07
Nodes (44): ErrorBoundary, ErrorBoundaryProps, ErrorBoundaryState, fallbackLocale(), isRecoverableByReload(), reloadOnce(), LanguageSuggestion(), prefersFrench() (+36 more)

### Community 17 - "Routing Engine & Journey Map"
Cohesion: 0.07
Nodes (52): HONG_KONG, HOUSTON, LAGOS, LONDON, LOS_ANGELES, MANCHESTER, milesBetween(), NEW_YORK (+44 more)

### Community 18 - "French Site Content"
Cohesion: 0.05
Nodes (54): Accessibilité (WCAG 2.2 AA), §8.5 Aide : livraison locale et paiements, §10.3 Application livreur, §2.1 Bandeau principal, §8.2 Aide : base de connaissances, §16 Carrières et Politique RSE, §8 Centre d'aide et Contact, Codes d'erreur (BAD_REQUEST, INVALID_TRACKING_ID, RATE_LIMITED...) (+46 more)

### Community 19 - "Track Result & Documents"
Cohesion: 0.08
Nodes (39): react, DocumentCenterViewProps, place(), PodDetails, PodPaper, readDetails(), Barcode(), BarcodeProps (+31 more)

### Community 20 - "Blog API Routes"
Cohesion: 0.06
Nodes (44): BLOG_LOCALES, CategoryRow, formatMedia(), isBlogLocale(), isPostStatus(), isPublicRow(), mediaLookup(), MediaRow (+36 more)

### Community 21 - "Server Page Meta"
Cohesion: 0.08
Nodes (42): blogRender(), POST_META, render(), TEMPLATE, absolute(), BLOG_NAME, blogHead(), BlogPageData (+34 more)

### Community 22 - "Dispatch Job Drawer"
Cohesion: 0.09
Nodes (45): JobInput, JobRow, boardApi, BoardCity, BoardCourier, BoardData, BoardZone, DispatchJob (+37 more)

### Community 23 - "Blog Rendering"
Cohesion: 0.07
Nodes (32): ATTACKS, render(), cleanTags(), BLOG_MEDIA_PREFIX, BLOG_MEDIA_SRC, CALLOUT_TONES, countWords(), DocCheck (+24 more)

### Community 24 - "Admin Data Types"
Cohesion: 0.09
Nodes (38): EmailSettingsPanel(), OutboxTable(), STATUS_CHIP, when(), Filter, FILTERS, formatReceived(), MessagesView() (+30 more)

### Community 25 - "Dispatch Status Machine"
Cohesion: 0.07
Nodes (39): ACTIONS, ACTORS, EXPECTED, FROMS, FULL_INPUT, RATES, tmpDir, courierActions() (+31 more)

### Community 26 - "App Shell"
Cohesion: 0.09
Nodes (39): AboutPage, AdminApp, AdminLogin, App(), BlogPage, BlogPostPage, CareersPage, consoleKind() (+31 more)

### Community 27 - "3D Arrival & Stage Assets"
Cohesion: 0.08
Nodes (31): three, Prim, ASSETS, BIKE_MODEL_URL, gltfExtensions(), loadGltf(), StageAsset, TRUCK_MODEL_URL (+23 more)

### Community 28 - "Shop Spec"
Cohesion: 0.09
Nodes (41): docs/SHOP_SPEC.md, Cart and checkout (/cart, /fr/panier), Shop delivery fee calculation, Footer Legal column (FOOTER_ROWS = 5), Shop features not in version 1, Order idempotency key and abuse protection, Order number TX-ORD-######, Shop order retention (10 years / 2 years) (+33 more)

### Community 29 - "Tariffs Routes"
Cohesion: 0.07
Nodes (30): ALIASES_MAX, BANDS_MAX, citiesAll(), cityNameTaken(), cityOut(), CityRow, Fail, fail() (+22 more)

### Community 30 - "City-to-City 3D Scene"
Cohesion: 0.08
Nodes (27): ARRIVE_METRES, canvas(), CARGO_SPOT, CITY_TIMELINE, cityFocus(), CityInput, CityScene, COLORS (+19 more)

### Community 31 - "Payment Proofs Console"
Cohesion: 0.11
Nodes (32): ids, NewProofsPanel(), NewProofsPanelProps, formatProofReceived(), proofAmountMismatch(), ProofFacts(), proofMethodView(), ProofReviewControls() (+24 more)

### Community 32 - "Dispatch Spec"
Cohesion: 0.09
Nodes (39): Positioning pillars (Door to world, Live visibility, Accountable hands, Local roots), After launch: backups, retention, monitoring, security, Uploads folder (images, proofs, blog, pod, couriers), docs/DISPATCH_SPEC.md, Dispatch board problem and suggestion rules, cash_ledger table (TX-CSH-), COD collection and 7-day cash handover, Company MTN MoMo / Orange Money payments (+31 more)

### Community 33 - "Payment Requests"
Cohesion: 0.11
Nodes (36): AccountEditor, accountSummary(), blankDetails(), draftFromPayment(), draftToRequest(), emptyPaymentDraft(), inputType(), newAccount() (+28 more)

### Community 34 - "Home Page"
Cohesion: 0.12
Nodes (34): largest(), ResponsiveImage(), ResponsiveImageProps, srcSet(), SITE_IMAGES, SiteImageInfo, SiteImageName, primeArea() (+26 more)

### Community 35 - "Admin Console Layout"
Cohesion: 0.09
Nodes (33): AdminApp(), AdminAppProps, AdminConsole(), BlogPreview, blogPreviewToken(), BlogStudio, CashView, CouriersView (+25 more)

### Community 36 - "Project Tracker: Launch & Owner Items"
Cohesion: 0.08
Nodes (36): DEPLOYMENT, A.2 Brand config (brand.ts, references, XAF), A.3 Logo and icons, A.4 Previous-brand sweep, E.1 Homepage journey layout, G.9 Field test in Buea, I.2 Console EN/FR, #101 Vector logo (+28 more)

### Community 37 - "Motion Easing Utils"
Cohesion: 0.12
Nodes (26): TANEX_LOCATIONS, LatePhase, CityPhase, cityPhase(), HeroPhase, heroPhase(), inTownDistance(), InTownPhase (+18 more)

### Community 38 - "Shipments Console"
Cohesion: 0.10
Nodes (28): DeleteShipmentModal(), DeleteShipmentModalProps, EditShipmentModal(), EditShipmentModalProps, RecentlyDeletedModal(), RecentlyDeletedModalProps, ShipmentControlModalProps, ShipmentImagesPanel() (+20 more)

### Community 39 - "Brand Image Pipeline"
Cohesion: 0.08
Nodes (32): TanEx logo and derived assets, TanEx logo.png, Managing Director portrait (about-md), Owner-supplied TanEx files, BRAND_OUT, buildBrand(), buildIcons(), buildPhotos() (+24 more)

### Community 40 - "Shipment Progress & Time"
Cohesion: 0.13
Nodes (28): SEP_28_2026_1400_UTC, EventTime, eventTime(), MOVING_STATUSES, PRE_TRANSIT_STATUSES, ProgressRow, shipmentTransportMode(), syncTimeBasedProgress() (+20 more)

### Community 41 - "Shipment Planning Engine"
Cohesion: 0.14
Nodes (24): ControlAction, ShipmentControlModal(), STANDARD_HUBS, ADMIN_ROLE_LABEL, applyDelayState(), applyHoldState(), applyResumeState(), createAuditLogEntry() (+16 more)

### Community 42 - "3D Stage & Lanes"
Cohesion: 0.09
Nodes (29): DOOR_REACH, PARK_REACH, cityDistance(), heroDistance(), bandFrame(), COLORS, endsTexture(), rideProgress() (+21 more)

### Community 43 - "Payment Methods & Validation"
Cohesion: 0.18
Nodes (25): dir, LUCIDE_FALLBACKS, PAYMENT_ICON_PATHS, DetailsValidation, PAYMENT_METHOD_TYPES, PaymentFieldKind, PaymentGroup, PaymentMethodDefinition (+17 more)

### Community 44 - "Content Deck Overview"
Cohesion: 0.08
Nodes (30): CONTENT.md: TanEx Content Deck (English master), 4 About page, 1.4 API error code messages, 16 Careers and CSR Policy, 7-day claims window [confirm], 8.3 Contact page, Cookie Policy (tx.sid, local storage keys), Dimensional weight divisor 5000 [confirm] (+22 more)

### Community 45 - "Public Blog & RSS"
Cohesion: 0.14
Nodes (27): blogFeedsRouter(), FEED_SIZE, MIME, rssXml(), blogSitemapEntries(), categoryVersions(), listPage(), postVersions() (+19 more)

### Community 46 - "Stage Rendering Loop"
Cohesion: 0.11
Nodes (10): isMotionPaused(), loadAssets(), readyChapters(), CameraView, LateView, headerOffset(), isTyping(), shadowPlane() (+2 more)

### Community 47 - "Public Payment Section"
Cohesion: 0.11
Nodes (25): PaymentMethodCard(), PaymentMethodCardProps, Field, FIELD_ORDER, PaymentProofForm(), PaymentProofFormProps, PaymentQr(), PaymentQrProps (+17 more)

### Community 48 - "Courier API Routes"
Cohesion: 0.09
Nodes (24): actionTime(), deliveryCodeMatches(), loadJob(), ACTION_KEY_RETENTION_MS, insertLocations(), LOCATION_RETENTION_MS, LocationPoint, MAX_POINTS_PER_REQUEST (+16 more)

### Community 49 - "Tariffs Console"
Cohesion: 0.17
Nodes (29): PinPicker(), ANY, Cell, CellField, cellKey(), EMPTY, isSymmetricSheet(), mirrorKey() (+21 more)

### Community 50 - "Courier Offline Queue"
Cohesion: 0.09
Nodes (17): RawResult, AppliedListener, CourierSync, isRetryable(), Listener, loadItems(), memoryCache, memoryQueue (+9 more)

### Community 51 - "Tracker: Decisions & Dispatch"
Cohesion: 0.11
Nodes (23): B.6 Email foundation and password reset, cash_ledger (courier cash, TX-CSH refs), Decisions log, src/shared/dispatchStatus.ts state machine, email_outbox and mail worker, G.10 Native courier app / WhatsApp Cloud API / MoMo API (later), G.1 Dispatch data model, state machine, pricing, G.2 Tariffs and Couriers admin (+15 more)

### Community 52 - "Dispatch & Delivery API Client"
Cohesion: 0.09
Nodes (26): ProfileInput, call(), Courier, CourierInput, DeliveryCity, DeliveryZone, dispatchApi, IntercityRateRow (+18 more)

### Community 53 - "Network Map & Locations"
Cohesion: 0.17
Nodes (23): drawLanesOnReveal(), HomeNetworkMap(), HomeNetworkMapProps, markerIcon(), NetworkMapPanel(), useCountryName(), formatGatewayTime(), Gateway (+15 more)

### Community 54 - "3D Hero Globe"
Cohesion: 0.12
Nodes (17): HeroScene, ARC_HUBS, arcCurve(), BUEA, buildGlobe(), COLORS, createUniforms(), flatMaterial() (+9 more)

### Community 55 - "Geocoding & Hubs"
Cohesion: 0.13
Nodes (25): NetworkMapLabels, AdminDataProvider(), withTrackingId(), TransportMode, getRoutingHub(), ROUTING_HUBS, RoutingHub, AddressQuery (+17 more)

### Community 56 - "Public Local Tracking"
Cohesion: 0.15
Nodes (24): CityRow, CourierRow, point(), publicCourierPhoto(), publicLocalDelivery(), ZoneRow, readStoredDispatchSettings(), dispatchStatusLabel() (+16 more)

### Community 57 - "Cash Console"
Cohesion: 0.16
Nodes (21): cashApi, CashBalance, CashCourier, CashEntry, CashOverview, CashReport, reportCsvUrl(), AdjustDialog() (+13 more)

### Community 58 - "Content: Console & Tracking Copy"
Cohesion: 0.11
Nodes (25): 3.4 Add-ons (Express, COD, delivery code, packing), 10 Admin console strings, 2.3 Bike delivery section, 10.4 Blog studio and author profile, Cash & Mobile Money ledger (G.8), Cash on delivery, 10.3 Courier app strings, Courier assignment suggestion (on duty, same city, right vehicle, nearest) (+17 more)

### Community 59 - "Cash Report Logic"
Cohesion: 0.12
Nodes (22): balancesFromLines(), CourierBalance, courierCashSummary(), LedgerRow, readCashLines(), toCashLine(), HANDOVER_DEADLINE_DAYS, HANDOVER_METHODS (+14 more)

### Community 60 - "Runtime Dependencies"
Cohesion: 0.08
Nodes (24): dependencies, cors@^2.8.6, express@^5.2.1, jsbarcode@^3.11.6, leaflet@^1.9.4, lenis@^1.3.27, libphonenumber-js@^1.13.14, lucide-react@^0.475.0 (+16 more)

### Community 61 - "i18n Area Dictionaries"
Cohesion: 0.13
Nodes (16): app, leaves(), PAIRS, SAME_IN_BOTH, server, tmpDir, Tree, about (+8 more)

### Community 62 - "WhatsApp Job Messages"
Cohesion: 0.13
Nodes (21): whatsAppLink(), buildJobMessages(), firstName(), isJobMessageTemplate(), isPlannedMessage(), JOB_MESSAGE_TEMPLATES, JobMessage, JobMessageInput (+13 more)

### Community 63 - "Tracking Events Console"
Cohesion: 0.12
Nodes (21): EVENT_TIME_ZONES, formatLocationStr(), getCurrentTimeStr(), getEventColors(), getEventTheme(), getTodayDateStr(), MESSAGE_TEMPLATES, NETWORK_LOCATIONS (+13 more)

### Community 64 - "Page Motion & Reveals"
Cohesion: 0.17
Nodes (17): whenIdle(), parallaxAt(), loadedGsap(), loadGsap(), GsapKit, JourneyController(), findHero(), INNER_REVEAL (+9 more)

### Community 65 - "Server Dependencies"
Cohesion: 0.09
Nodes (22): compression@^1.8.2, helmet@^8.3.0, @tiptap/react@^3.33.1, @types/bcryptjs@^2.4.6, @types/express@^5.0.6, @types/express-session@^1.19.0, @types/qrcode@^1.5.6, @types/three@^0.187.0 (+14 more)

### Community 66 - "TipTap Editor Dependencies"
Cohesion: 0.09
Nodes (22): @tiptap/core@^3.33.1, @tiptap/extension-image@^3.33.1, @tiptap/extension-link@^3.33.1, @tiptap/extension-table@^3.33.1, @tiptap/extensions@^3.33.1, @tiptap/pm@^3.33.1, @tiptap/starter-kit@^3.33.1, @tiptap/core (+14 more)

### Community 67 - "Tanex Master Plan"
Cohesion: 0.12
Nodes (20): Console at /private-user/ (ADMIN_PATH), Tech stack (React/Vite/Express/node:sqlite), Part 1: Booking at /fr/livraison-locale, Part 5: Failed attempt, G.9 Field test: Buea end-to-end delivery, Part 8: Finance confirmation and daily CSV, Finding report format and severity (Blocker/Major/Minor/Idea), Part 4: On the way and live map (+12 more)

### Community 68 - "Design Direction Mocks"
Cohesion: 0.12
Nodes (20): Camera use per chapter, Approval decisions and open items, Components (buttons, track field, chips, cards) light/dark, Homepage mock frames (desktop iframe + phone), Journey storyboard (9 key frames, chapters 0-8), TanEx Design Direction (C.1, approved 7 Nov 2026), design/tx.css + sprite.js (shared mock assets), Type system (Plus Jakarta Sans 800 + italic word, Inter, JetBrains Mono) (+12 more)

### Community 69 - "Couriers Console & WhatsApp Log"
Cohesion: 0.16
Nodes (16): copyText(), TempPasswordDialog(), CourierAvatar(), CourierEditor(), CouriersView(), initials(), Notice, NoticeLine() (+8 more)

### Community 70 - "Dispatch Jobs Tests"
Cohesion: 0.12
Nodes (15): act(), addCourier(), addUser(), app, call(), createJob(), HASH, json() (+7 more)

### Community 71 - "3D Hero & Door"
Cohesion: 0.12
Nodes (18): ArrivalScene, DEPART_METRES, DOOR_Z, HERO_TIMELINE, HeroFrame, LOGO_AT, ORBIT, REST (+10 more)

### Community 72 - "3D Label & Parcel"
Cohesion: 0.12
Nodes (17): Focus, CENTRE, LABEL_TIMELINE, LabelPose, LabelRig, code128B(), PATTERNS, buildParcel() (+9 more)

### Community 73 - "Leaflet Maps"
Cohesion: 0.21
Nodes (12): leaflet, DispatchMap(), esc(), OVERVIEW, OVERVIEW, JobMap(), pinned(), OVERVIEW (+4 more)

### Community 74 - "Smooth Scroll & Route Rail"
Cohesion: 0.18
Nodes (17): lenis, setMotionPaused(), subscribeMotionPaused(), useJourneyChapter(), PauseMotionButton(), PauseMotionButtonProps, useMotionPaused(), headerOffset() (+9 more)

### Community 75 - "Courier App Shell"
Cohesion: 0.17
Nodes (19): LOGO_WHITE, ACTIVE, alertNewJob(), CourierApp(), CourierRoot(), CourierShell(), readSeen(), seenKey() (+11 more)

### Community 76 - "Courier Sheets & Cash"
Cohesion: 0.25
Nodes (17): CashScreen(), EMPTY, useCourierText(), CashMethod, CashState, QueueItem, draftFor(), FailSheet() (+9 more)

### Community 77 - "Tracker: Design & Console Phases"
Cohesion: 0.12
Nodes (18): BRAND_GUIDE, FIELD_TEST_G9, TanEx Project Tracker, C.1 Design direction (design/direction.html), C.2 --tx-* tokens with --ngf-* aliases, C.3 Core components, Header, Footer, Change log, DB_PATH ignored when set only in .env (db.ts import order) (+10 more)

### Community 78 - "Roles Routes"
Cohesion: 0.13
Nodes (16): CANNOT_GRANT, Fail, fail(), formatRole(), permissionsOf(), permissionsRouter, readRoleInput(), ROLE_DESCRIPTION_MAX (+8 more)

### Community 79 - "3D Model Brief"
Cohesion: 0.13
Nodes (15): tanex_bike model (bike + rider + top box), Blender blockout scripts (build_tanex_bike.py / build_tanex_truck.py), 3D colour specification (brand palette), Deliverables (.blend + .glb, textures, renders), Milestones M1-M3 and acceptance check, phone_screen 'screen' material (live map), Named pivot hierarchy (front_wheel, handlebar, rider_torso, box_lid, parcel_socket), TanEx 3D Model Brief and RFQ (+7 more)

### Community 80 - "Payments Update Spec"
Cohesion: 0.18
Nodes (12): Dashboard notifications (badge, bell, toast, ngf_seen_proofs), Files & storage requirements (UPLOADS_DIR, magic bytes), Prompt: Package Images, Payment Methods & Proof of Payment, Proof submission rules (POST /api/track/:id/payment-proof), Workflow per task and report back, Public GET /media/:id route, Payment method registry src/shared/paymentMethods.ts, payment_proofs table and review flow (+4 more)

### Community 81 - "Tracking IDs"
Cohesion: 0.19
Nodes (14): generateUniqueTrackingId(), generateTrackingId(), ID_LENGTH, isValidTrackingId(), normalizeTrackingInput(), ParsedTrackingInput, parsePieceLabel(), parseTrackingInput() (+6 more)

### Community 82 - "Courier Jobs Screens"
Cohesion: 0.19
Nodes (16): CourierJob, JobDetail(), JobMap, MESSAGE_LABEL, MessagesCard(), PlaceCard(), deliveryCollect(), pickupCollect() (+8 more)

### Community 83 - "Content: Home & Blog Copy"
Cohesion: 0.12
Nodes (18): docs/BLOG_SPEC.md, 15 Blog pages, 2.7 Get in touch, 2.1 Hero (From your door to the world), 2.8 Home FAQ, 2 Home page (owner's outline), 2.10 The Journey: chapter beats and route rail, 2.2 Services photo cards (+10 more)

### Community 84 - "Tracker: Journey Phase"
Cohesion: 0.16
Nodes (16): H.0 3D brief for the artist, H.1 Motion foundation (GSAP, Lenis, JourneyController), H.2 The Stage (WebGL canvas) and bike, H.3 Chapters 0-1: hero globe and services road, H.4 Chapters 2-3: in town and city to city truck, H.5 Chapters 4-8: world, label, arrival, H.6 Final glTF models and posters, H.7 Inner-page motion (+8 more)

### Community 85 - "Local Pricing & POD"
Cohesion: 0.20
Nodes (16): priceJob(), createPodDocument(), newPodId(), PodDetails, intercityRateFromRow(), isSizeClass(), priceIntercityDelivery(), priceLocalDelivery() (+8 more)

### Community 86 - "TypeScript Config"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+9 more)

### Community 87 - "Router Route Table"
Cohesion: 0.18
Nodes (15): Shop SEO and Product JSON-LD, BlogPageResult, BlogResolver, IndexRenderer, PageContext, alternatePath(), buildPath(), langOfPath() (+7 more)

### Community 88 - "Legal Pages"
Cohesion: 0.15
Nodes (15): DOMAIN, HQ_ADDRESS_FR, LEGAL_DOC_IDS, LEGAL_LAST_UPDATED, LEGAL_URL, LegalBlock, LegalContact, LegalDoc (+7 more)

### Community 89 - "Courier Location Sharing"
Cohesion: 0.15
Nodes (14): CashBalance, CashEntry, CashInput, courierApi, CourierPlace, CourierProfile, courierUrls, sendRaw() (+6 more)

### Community 90 - "Journey Scroll Store"
Cohesion: 0.17
Nodes (11): beatOf(), BEATS, clamp01(), headerOffset(), PIN_VH, setBeat(), setupJourney(), STEPS (+3 more)

### Community 91 - "Brand Guide"
Cohesion: 0.12
Nodes (12): BRAND_COLORS in brand.ts, TanEx Brand Guide & Design System, Courier app UI rules (56px buttons, one-handed), Name usage (TanEx vs Tanex SARL), Palette (Chocolate, Cream, Orange #F48800), Reference formats (TX-TKT, TX-INV, TX-SL, TX-CSH, QR-YYYY), Secondary slogan: Saving Situations, Tagline: From Your Door to the World (+4 more)

### Community 92 - "Motion & 3D Spec"
Cohesion: 0.19
Nodes (13): TanEx bike + rider model (tanex-bike.glb), capabilities.ts (canAnimate / canUseStage), Journey chapters 0-8, Globe (stage/globe.ts, Natural Earth dots), Lenis smooth scroll, Motion & 3D Specification: The Journey, Pause motion control (tx_motion_paused), Static chapter posters (fallback) (+5 more)

### Community 93 - "Tracker: Shop Phase M"
Cohesion: 0.12
Nodes (15): Courier offlineQueue.ts (IndexedDB), G.4 Courier app (PWA, offline queue), #140 Marketplace button, #164 Delivery code rules, #183 Shop order retention (10y / 2y), M.0 Shop spec and Returns & Refunds draft, M.1 Shop schema and permissions, M.2 Square picture pipeline (+7 more)

### Community 94 - "Image Compression"
Cohesion: 0.22
Nodes (12): PendingImage, ShipmentImagesPanelProps, blobToBase64(), canvasToBlob(), CompressedImage, compressImage(), CompressOptions, ImageCompressError (+4 more)

### Community 95 - "Password Reset Tests"
Cohesion: 0.16
Nodes (12): app, call(), forgot(), HASH, logged, reset(), sent, server (+4 more)

### Community 96 - "Courier Profile & PWA"
Cohesion: 0.19
Nodes (13): CourierKey, CourierLang, CourierT, CourierText, CourierTextContext, ProfileScreen(), BeforeInstallPromptEvent, canInstall() (+5 more)

### Community 97 - "i18n Types"
Cohesion: 0.17
Nodes (10): contact, ContactMessages, ship, ShipMessages, contact, courier, ship, LOCALES (+2 more)

### Community 98 - "Project Rules (CLAUDE.md)"
Cohesion: 0.14
Nodes (11): Conventions (tx- tokens, money, times, images, a11y), Definition of done, graphify rules, CLAUDE.md: TanEx Platform rules, Live WCAG contrast table (lum/ratio), Palette scales (chocolate, cream, orange, status), Role tokens (--tx-bg, --tx-text, --tx-accent...), Ch 7 FAQ + Blog (no sample posts) (+3 more)

### Community 99 - "Blog Spec"
Cohesion: 0.15
Nodes (12): blog_categories table, Blog media pipeline (browser WebP compression, /media/blog), blog_media table, Blog permissions (blog.view/write/edit_any/publish/categories), blog_posts table, server/routes/blog.ts and publicBlog.ts, blog_slug_redirects (301 old slugs), Blog Specification (+4 more)

### Community 100 - "IAM & RBAC Spec"
Cohesion: 0.18
Nodes (12): audit_log and audit() helper, IAM & RBAC Specification, Login by email or phone with lockout (5 failures / 15 min), Password reset tokens (password_resets), Permission catalogue src/shared/permissions.ts, requirePermission / requireAuth middleware, Roles and role_permissions / user_roles, Mapping existing routes to permissions (B.3) (+4 more)

### Community 101 - "Glide & Page Progress"
Cohesion: 0.29
Nodes (12): clamp01(), easeInOutCubic(), glide(), GLIDE_MS, glideAt(), HERO_PARALLAX_PX, isLongPage(), LONG_PAGE_SCREENS (+4 more)

### Community 102 - "Cash API Routes"
Cohesion: 0.18
Nodes (12): NOTE_MAX, body(), canConfirm, canView, cashRouter, ENTRY_LABEL, entryOut(), EntryRow (+4 more)

### Community 103 - "Local Delivery Booking Page"
Cohesion: 0.17
Nodes (10): MapPin, emptyPlace(), ErrorKey, LocalDeliveryPage(), LocalDeliveryPageProps, localInputValue(), PinMap, PlaceState (+2 more)

### Community 104 - "i18n Home & Delivery Copy"
Cohesion: 0.22
Nodes (9): AreaMessages, courier, CourierMessages, home, HomeMessages, localDelivery, LocalDeliveryMessages, home (+1 more)

### Community 105 - "In-Town 3D Scene"
Cohesion: 0.16
Nodes (10): IN_TOWN_TIMELINE, MAP, mapRoutePoint(), mapTexture(), ON_THE_WAY_METRES, PHONE_FOCUS, PhoneMap, RIDE_OUT_METRES (+2 more)

### Community 106 - "Tracker: Public Site Phase"
Cohesion: 0.14
Nodes (14): docs/CONTENT_FR.md, E.2 Services page, E.3 About and Network pages, E.4 Contact, Help, Legal, E.5 Track, Quote and Ship pages, E.6 Payments localisation (MoMo, Orange Money, XAF), E.7 Images, E.8 Public QA EN+FR (+6 more)

### Community 107 - "Tracker: IAM Phase"
Cohesion: 0.15
Nodes (11): Audit log (audit()/audited()), B.1 IAM schema, seeded roles, Super Admin bootstrap, B.2 SQLite session store and auth routes, B.3 Route permissions (requirePermission everywhere), B.4 Console auth (AuthContext, forced password change), B.5 Users, Roles and Audit log screens, B.7 TOTP 2FA (optional, after launch), #122 Seeded role permissions (+3 more)

### Community 108 - "API Error Codes"
Cohesion: 0.19
Nodes (10): addErrorCodes(), common, CommonMessages, errors, common, loadFrMessages(), GENERAL_ERROR_CODES, generalErrorCode() (+2 more)

### Community 109 - "i18n Runtime Loader"
Cohesion: 0.18
Nodes (12): AREA_LOADERS_EN, AreaName, en, Messages, AREA_LOADERS_FR, AreaEntry, areas, listeners (+4 more)

### Community 110 - "Server TS Config"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, module, moduleResolution, noUnusedLocals, noUnusedParameters, outDir, resolveJsonModule (+5 more)

### Community 111 - "Company Facts & Launch"
Cohesion: 0.18
Nodes (13): Company facts (single source of truth), Ch 6 Contact (channels + form), Blog SEO (hreflang, OG, JSON-LD BlogPosting, sitemap, RSS), Tracking ID format (TX + 6 safe chars), Launch checklist, Owner decisions (2026-11-06), Six service card photos (Unsplash License), Homepage service card photos sources (+5 more)

### Community 112 - "Notifications Spec"
Cohesion: 0.28
Nodes (13): docs/NOTIFICATIONS_SPEC.md, buildWhatsAppLink(phoneE164, templateKey, vars, locale), Notification channels (email, WhatsApp link, in-app), Later upgrade: WhatsApp Cloud API / SMS, SPF / DKIM / DMARC for tanexsarl.com, email_outbox table and send worker, Email templates (server/mail/templates/<key>.<locale>.ts), notification_log table (+5 more)

### Community 113 - "Auth Tests"
Cohesion: 0.17
Nodes (7): DB_FILE, HASH, login(), openApps, sidCookie(), TestApp, tmpDir

### Community 114 - "Motion Capabilities"
Cohesion: 0.32
Nodes (11): afterLoadIdle(), canAnimate(), canSmoothScroll(), canUseStage(), matches(), pauseListeners, prefersReducedMotion(), saveData() (+3 more)

### Community 115 - "Journey Controller & QA"
Cohesion: 0.18
Nodes (10): GSAP (ScrollTrigger, SplitText, CustomEase), Route rail (RouteRail.tsx, travelling bike icon), H.8 Journey QA, H.8 QA results table, INITIAL, initialState(), JourneyContext, JourneyControllerProps (+2 more)

### Community 116 - "Users Tests"
Cohesion: 0.18
Nodes (8): app, call(), HASH, now0, PEOPLE_KEYS, server, signIn(), tmpDir

### Community 117 - "I18N Spec"
Cohesion: 0.25
Nodes (8): Stable API error codes mapped by the client, Intl formatting format.ts (en-CM / fr-CM, XAF 0 decimals), Languages, Routing & Page Meta Specification (EN/FR), Server page meta injection server/render/pageMeta.ts, Route table src/router/routes.ts, Bilingual sitemap with hreflang alternates, Tracking event title_key / title_vars_json, EN/FR URL scheme (/ and /fr/)

### Community 119 - "Multipart Parsing"
Cohesion: 0.24
Nodes (10): malformed, MultipartBody, multipartBoundary(), MultipartFile, MultipartLimits, MultipartResult, parseMultipart(), readBody() (+2 more)

### Community 120 - "Dispatch Settings"
Cohesion: 0.22
Nodes (10): ALERT_KEYS, ALERT_MAX_MINUTES, DEFAULT_DISPATCH_SETTINGS, DispatchAlertMinutes, isValidAlertMinutes(), isValidSpeed(), readDispatchSettings(), SPEED_MAX_KMH (+2 more)

### Community 121 - "Deployment Guide"
Cohesion: 0.22
Nodes (9): Deployment: GitHub to Hostinger, Domain and paths (apex, /private-user/ noindex), Email DNS (MX, SPF, DKIM, DMARC), email_outbox queue with retries, Environment variables (SESSION_SECRET, DB_PATH, UPLOADS_DIR, SMTP_*), Hosting requirements (Node >= 22.5, persistent storage, HTTPS, Hostinger Email), Hostinger app configuration (npm install, npm start), Persistence check (/api/diag/storage) (+1 more)

### Community 122 - "Tracker: Routing Phase"
Cohesion: 0.22
Nodes (9): I18N_SPEC, D.1 Path routing (route table, navigate, Link), D.2 Server-side page meta and bilingual sitemap, D.3 i18n foundation (en.ts/fr.ts, format.ts), i18n dictionaries (src/i18n en/fr), #108 Native French review, server/render/pageMeta.ts head renderer, Phase D: Routing & Languages (+1 more)

### Community 123 - "App Shell HTML"
Cohesion: 0.20
Nodes (9): Performance budget and motion loading, The Journey (3D scroll story with TanEx bike), index.html app shell, src/main.tsx entry, Organization JSON-LD structured data, tx:head per-page meta markers, Phase A: Separation & rebrand foundation, A2: Brand config, IDs and metadata (+1 more)

### Community 124 - "npm Scripts"
Cohesion: 0.20
Nodes (10): scripts, build, create-super-admin, dev, dev:vite, postinstall, preview, server (+2 more)

### Community 125 - "Dev Dependencies"
Cohesion: 0.22
Nodes (9): devDependencies, concurrently@^10.0.5, gltfpack@^1.3.0, sharp@^0.35.4, tsx@^4.23.12, concurrently, gltfpack, sharp (+1 more)

### Community 126 - "Reference Numbers"
Cohesion: 0.33
Nodes (6): REFERENCE_PREFIX, generateReference(), REFERENCE_PATTERN, REFERENCE_PREFIXES, referenceFor(), ReferenceKind

### Community 127 - "Event Titles & Typography"
Cohesion: 0.39
Nodes (6): EVENT_TITLES, eventTitleText(), EventTitleVars, isEventTitleKey(), renderEventTitle(), frenchSpacing()

### Community 128 - "Blog Preview Tokens"
Cohesion: 0.38
Nodes (6): createPreviewToken(), key, PREVIEW_TTL_MS, readPreviewToken(), setPreviewSecret(), sign()

### Community 129 - "Stock Image Sources"
Cohesion: 0.50
Nodes (5): Free CC0 images sources (retired), Free Pexels images sources (retired), locations-hero stock photo (console sign-in background until I.1), Free stock photos sources (retired), Unsplash hero photos sources (retired)

### Community 130 - "PDF Tools"
Cohesion: 0.40
Nodes (5): html2canvas@^1.4.1, jspdf@^4.2.1, html2canvas, jspdf, loadPdfTools()

### Community 131 - "Vite Build"
Cohesion: 0.40
Nodes (4): vite@^6.1.0, @vitejs/plugin-react@^4.3.4, vite, @vitejs/plugin-react

### Community 133 - "Self-hosted Fonts"
Cohesion: 0.40
Nodes (5): Inter font licence (SIL OFL 1.1), JetBrains Mono font licence (SIL OFL 1.1), Plus Jakarta Sans font licence (SIL OFL 1.1), Brand fonts (self-hosted) README, Self-hosted WOFF2 Latin/Latin-ext subsets from @fontsource v5

### Community 134 - "i18n Blog"
Cohesion: 0.50
Nodes (3): blog, BlogMessages, blog

### Community 135 - "i18n Company"
Cohesion: 0.50
Nodes (3): company, CompanyMessages, company

### Community 136 - "i18n Help"
Cohesion: 0.50
Nodes (3): help, HelpMessages, help

### Community 137 - "i18n Network"
Cohesion: 0.50
Nodes (3): network, NetworkMessages, network

### Community 138 - "i18n Not Found"
Cohesion: 0.50
Nodes (3): notFound, NotFoundMessages, notFound

### Community 139 - "i18n Quote"
Cohesion: 0.50
Nodes (3): quote, QuoteMessages, quote

### Community 140 - "i18n Services"
Cohesion: 0.50
Nodes (3): services, ServicesMessages, services

### Community 141 - "i18n Track"
Cohesion: 0.50
Nodes (3): track, TrackMessages, track

### Community 142 - "i18n Track Result"
Cohesion: 0.50
Nodes (3): trackResult, TrackResultMessages, trackResult

### Community 143 - "Prompts: IAM Phase"
Cohesion: 0.67
Nodes (3): audit() / audit_log, Phase B: Identity & access (IAM/RBAC), SQLite session store (tx.sid cookie)

### Community 144 - "Prompts: Dispatch Phase"
Cohesion: 0.67
Nodes (3): Cash & Mobile Money ledger (TX-CSH), Courier app (offline queue, POD, location sharing), Phase G: Dispatch & local delivery

## Knowledge Gaps
- **131 isolated node(s):** `TanEx Build Prompt Pack`, `Phase J: QA, security & launch`, `Utility prompts R/F/O/N`, `blog_categories table`, `blog_slug_redirects (301 old slugs)` (+126 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1193 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **22 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Track Result & Documents` to `Shipment Booking Forms`, `Brand Config & Site Chrome`, `Blog Studio Editor`, `Public Pages & Blog Views`, `UI Kit & Services Pages`, `Dispatch Board Logic`, `Console Auth Context`, `i18n Provider & Navigation`, `Routing Engine & Journey Map`, `Dispatch Job Drawer`, `Admin Data Types`, `App Shell`, `Payment Proofs Console`, `Payment Requests`, `Home Page`, `Admin Console Layout`, `Shipments Console`, `Shipment Planning Engine`, `Public Payment Section`, `Tariffs Console`, `Network Map & Locations`, `Cash Console`, `Runtime Dependencies`, `Tracking Events Console`, `Page Motion & Reveals`, `Server Dependencies`, `Couriers Console & WhatsApp Log`, `Leaflet Maps`, `Smooth Scroll & Route Rail`, `Courier App Shell`, `Courier Sheets & Cash`, `Courier Jobs Screens`, `Legal Pages`, `Courier Location Sharing`, `Image Compression`, `Courier Profile & PWA`, `Glide & Page Progress`, `Local Delivery Booking Page`, `Motion Capabilities`, `Journey Controller & QA`?**
  _High betweenness centrality (0.119) - this node is a cross-community bridge._
- **What connects `TanEx Build Prompt Pack`, `Phase J: QA, security & launch`, `Utility prompts R/F/O/N` to the rest of the system?**
  _131 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Server Test Suites` be split into smaller, more focused modules?**
  _Cohesion score 0.019813519813519812 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `Shipment Booking Forms` to `Brand Config & Site Chrome`, `Blog Studio Editor`, `Public Pages & Blog Views`, `UI Kit & Services Pages`, `Dispatch Board Logic`, `Console Auth Context`, `i18n Provider & Navigation`, `Routing Engine & Journey Map`, `Track Result & Documents`, `Dispatch Job Drawer`, `Admin Data Types`, `App Shell`, `Payment Proofs Console`, `Payment Requests`, `Home Page`, `Admin Console Layout`, `Shipments Console`, `Shipment Planning Engine`, `Public Payment Section`, `Tariffs Console`, `Network Map & Locations`, `Cash Console`, `Runtime Dependencies`, `Tracking Events Console`, `Server Dependencies`, `Couriers Console & WhatsApp Log`, `Smooth Scroll & Route Rail`, `Courier App Shell`, `Courier Sheets & Cash`, `Courier Jobs Screens`, `Legal Pages`, `Image Compression`, `Courier Profile & PWA`, `Glide & Page Progress`, `Local Delivery Booking Page`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Should `API Routes & Middleware` be split into smaller, more focused modules?**
  _Cohesion score 0.033029381965552176 - nodes in this community are weakly interconnected._
- **Why does `CONTENT.md: TanEx Content Deck (English master)` connect `Content Deck Overview` to `Tracker: Public Site Phase`, `Tracker: Design & Console Phases`, `French Site Content`, `Content: Home & Blog Copy`, `Content: Console & Tracking Copy`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Should `Shipment Booking Forms` be split into smaller, more focused modules?**
  _Cohesion score 0.062359970126960415 - nodes in this community are weakly interconnected._