# Graph Report - Tanex  (2026-11-19)

## Corpus Check
- 548 files · ~617,836 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 107 file(s) not represented in the graph (top: .css 77, .woff2 24, .glb 2)

## Summary
- 4922 nodes · 14144 edges · 183 communities (157 shown, 26 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 146 edges (avg confidence: 0.83)
- Token cost: 1,020,933 input · 0 output

## Graph Freshness
- Built from commit: `5b7329c4`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- console/index.ts
- API Routes & Middleware
- CreateShipmentView.tsx
- Email Outbox & Templates
- brand.ts
- useAreaT
- blogApi.ts
- Public Pages & Blog Views
- Dispatch Job Engine
- outbox.ts
- CONTENT.md: TanEx Content Deck (English master)
- Blender 3D Model Scripts
- Dispatch Board Logic
- CouriersView.tsx
- Permissions & Super Admin
- Couriers & Users Routes
- orders.ts
- shopMedia.test.ts
- French Site Content
- TrackPage.tsx
- Blog API Routes
- render/pageMeta.ts
- Dispatch Job Drawer
- Blog Rendering
- api.ts
- Dispatch Status Machine
- App Shell
- stage.test.ts
- Shop Spec
- Tariffs Routes
- City-to-City 3D Scene
- publicCatalog.ts
- Dispatch Spec
- PaymentsView.tsx
- Home Page
- AdminApp.tsx
- Project Tracker: Launch & Owner Items
- Motion Easing Utils
- routingEngine.ts
- Brand Image Pipeline
- routes/auth.ts
- shopOrderStatus.ts
- three
- Payment Methods & Validation
- templates/index.ts
- Public Blog & RSS
- Stage Rendering Loop
- shopAdmin.ts
- PaymentSection.tsx
- Tariffs Console
- Courier Offline Queue
- Tracker: Decisions & Dispatch
- fetchApi
- JourneyMap.tsx
- 3D Hero Globe
- TrackingEventsView.tsx
- Public Local Tracking
- Cash Console
- Content: Console & Tracking Copy
- Cash Report Logic
- dependencies
- i18n.test.ts
- JobDetail.tsx
- ProductEditor.tsx
- capabilities.ts
- package.json
- TipTap Editor Dependencies
- Tanex Master Plan
- Design Direction Mocks
- orderEmails.ts
- Dispatch Jobs Tests
- 3D Hero & Door
- 3D Label & Parcel
- paymentRequest.ts
- Smooth Scroll & Route Rail
- Courier App Shell
- SettingsView.tsx
- TanEx Project Tracker
- SmoothScroll.tsx
- 3D Model Brief
- Payments Update Spec
- trackingId.ts
- catalog.ts
- Content: Home & Blog Copy
- Tracker: Journey Phase
- shipmentStatusLabel
- TypeScript Config
- blogRender.test.ts
- Legal Pages
- sheets.tsx
- Journey Scroll Store
- Brand Guide
- Motion & 3D Spec
- Tracker: Shop Phase M
- §13 Mentions légales
- middleware/auth.ts
- services/shopPublic.ts
- fr/contact.ts
- Project Rules (CLAUDE.md)
- Blog Spec
- IAM & RBAC Spec
- Glide & Page Progress
- routes/cash.ts
- LocalDeliveryPage.tsx
- i18n Home & Delivery Copy
- In-Town 3D Scene
- JobDrawer.tsx
- imageCompress.ts
- HelpPage.tsx
- context.ts
- Server TS Config
- Company Facts & Launch
- Notifications Spec
- Phase D: Routing & Languages
- consoleText.ts
- layout.ts
- shopSettings.ts
- I18N Spec
- SQLite Session Store
- build-globe-dots.mjs
- eventTitles.ts
- Deployment Guide
- ResponsiveImage.tsx
- App Shell HTML
- npm Scripts
- Dev Dependencies
- DocumentCenterView.tsx
- RichEditor.tsx
- blog.test.ts
- Stock Image Sources
- jspdf
- Vite Build
- Courier Service Worker
- Self-hosted Fonts
- format.ts
- runtime.ts
- i18n Help
- fr/network.ts
- i18n Not Found
- i18n Quote
- i18n Services
- i18n Track
- ProfileScreen.tsx
- Prompts: IAM Phase
- localDelivery.test.ts
- Courier app (src/courier/)
- ProofViewer.tsx
- QuoteRequestsView.text.ts
- GSAP
- ConsoleLanguage.tsx
- Nodemailer
- PaymentIcon.tsx
- multipart.ts
- helmet
- html2canvas
- Prompts Pack Intro
- Prompts: Routing Phase
- Design: City to City
- Design: Smart Label
- Design: Services
- Prompts: Blog Phase
- Prompts: Launch Phase
- Prompts: Utilities
- fr/payment.ts
- fr/ship.ts
- cors
- http-proxy-middleware
- qrcode
- courierApi.ts
- references.ts
- fr/blog.ts
- fr/legal.ts
- sanitize-html
- fr/company.ts
- types.ts
- PaymentRequestEditor.tsx
- AdminLayout.text.ts
- dotenv
- express-rate-limit
- @types/express-session@^1.19.0
- @types/react-dom@^18.3.5

## God Nodes (most connected - your core abstractions)
1. `react` - 150 edges
2. `lucide-react` - 97 edges
3. `useAreaT()` - 73 edges
4. `renderEmail()` - 63 edges
5. `useAuth()` - 58 edges
6. `MainAppContent()` - 54 edges
7. `useLocale()` - 52 edges
8. `express` - 48 edges
9. `docs/SHOP_SPEC.md` - 46 edges
10. `ConsoleTextAreas` - 45 edges

## Surprising Connections (you probably didn't know these)
- `Ch 2 In town (bike delivery, from 500 FCFA)` --references--> `Company facts (single source of truth)`  [INFERRED]
  design/home.html → CLAUDE.md
- `freshDb()` --calls--> `initIamSchema()`  [EXTRACTED]
  scripts/shop.test.ts → server/auth/schema.ts
- `maskSignerName()` --calls--> `maskName()`  [EXTRACTED]
  server/routes/track.ts → src/shared/masking.ts
- `Ch 6 Contact (channels + form)` --shares_data_with--> `Company facts (single source of truth)`  [INFERRED]
  design/home.html → CLAUDE.md
- `Site link www.tanexsarl.com` --shares_data_with--> `Company facts (single source of truth)`  [INFERRED]
  images/tanex files/info.txt → CLAUDE.md

## Import Cycles
- 2-file cycle: `server/dispatch/jobs.ts -> server/dispatch/notify.ts -> server/dispatch/jobs.ts`
- 2-file cycle: `server/db.ts -> server/mail/outbox.ts -> server/db.ts`

## Hyperedges (group relationships)
- **Blog publishing flow: studio, sanitisation, public API, public pages, SEO** — docs_blog_spec_blog_studio, docs_blog_spec_html_sanitisation, docs_blog_spec_public_blog_api, docs_blog_spec_public_blog_pages, docs_blog_spec_blog_seo [EXTRACTED 1.00]
- **Dispatch job lifecycle (booking to POD and cash)** — docs_project_tracker_g6_local_delivery_booking, docs_project_tracker_g3_job_lifecycle_api, docs_project_tracker_write_transition, docs_project_tracker_g4_courier_app, docs_project_tracker_cash_ledger, docs_project_tracker_pod_document, docs_project_tracker_g7_public_live_tracking [EXTRACTED 1.00]
- **IAM security stack** — docs_project_tracker_session_store, docs_project_tracker_require_permission, docs_project_tracker_audit_log, scripts_routeguards_test, docs_project_tracker_b6_email_password_reset [EXTRACTED 1.00]
- **Server-side IAM enforcement** — docs_iam_rbac_spec_requirepermission, docs_iam_rbac_spec_permission_catalogue, docs_iam_rbac_spec_sqlite_session_store, docs_iam_rbac_spec_audit_log, docs_iam_rbac_spec_roles [EXTRACTED 1.00]
- **Journey motion stack** — docs_motion_3d_spec_stage, src_motion_journeycontroller, docs_motion_3d_spec_route_rail, docs_motion_3d_spec_posters, docs_motion_3d_spec_capabilities, docs_motion_3d_spec_gsap, docs_motion_3d_spec_three [EXTRACTED 1.00]
- **Proof of payment flow** — docs_update_shipment_payments, docs_update_payment_proofs, docs_update_payment_method_registry, docs_prompt_update_dashboard_notifications, docs_prompt_update_proof_submission [EXTRACTED 1.00]
- **Shared delivery pricing (local form and shop)** — docs_dispatch_spec_local_pricing, docs_dispatch_spec_zone_rates_table, docs_dispatch_spec_intercity_rates_table, docs_shop_spec_delivery_fee, src_shared_localpricing [EXTRACTED 1.00]
- **Onglets des mentions légales** — docs_content_fr_politique_de_confidentialite, docs_content_fr_conditions_d_utilisation, docs_content_fr_conditions_d_expedition, docs_content_fr_politique_de_cookies, docs_content_fr_accessibilite, docs_content_fr_retours_et_remboursements [EXTRACTED 1.00]
- **G.9 end-to-end local delivery flow** — docs_field_test_g9_booking, docs_field_test_g9_live_map, docs_field_test_g9_failed_attempt, docs_field_test_g9_pod_cash, docs_field_test_g9_finance [EXTRACTED 1.00]
- **Homepage Journey chapters 0-8 (bike rides the route)** — design_home_hero_chapter, design_home_services_chapter, design_home_in_town_chapter, design_home_city_to_city_chapter, design_home_network_chapter, design_home_labels_chapter, design_home_contact_chapter, design_home_faq_blog_chapter, design_home_footer_delivered [EXTRACTED 1.00]
- **Retired stock photo source records** — images_free_cc0_sources_cc0_images, images_free_pexels_sources_pexels_images, images_free_stock_sources_stock_photos, images_unsplash_sources_unsplash_photos [EXTRACTED 1.00]
- **Shop order to dispatch delivery flow** — docs_shop_spec_place_order_transaction, docs_shop_spec_shop_order_status_machine, docs_shop_spec_send_to_dispatch, docs_dispatch_spec_dispatch_jobs_table, docs_dispatch_spec_job_lifecycle [EXTRACTED 1.00]
- **Flux de paiement et preuve** — docs_content_fr_section_paiement, docs_content_fr_moyens_paiement_tanex, docs_content_fr_aide_livraison_locale_paiements, docs_content_fr_codes_erreur_api [INFERRED 0.75]
- **Customer payment flow: methods, payment section, proof, cash ledger** — docs_content_payment_methods, docs_content_tanex_payment_methods, docs_content_payment_section, docs_content_cash_ledger [INFERRED 0.75]
- **3D bike specification chain (reference sheet -> brief -> placeholder -> Stage)** — design_direction_bike_reference_sheet, design_3d_brief_bike_model, design_3d_brief_pivot_hierarchy, prompts_primitives_bike, prompts_stage [INFERRED 0.85]
- **COD collection and Finance confirmation** — docs_dispatch_spec_cod_and_handover, docs_dispatch_spec_cash_ledger_table, docs_shop_spec_shop_payment, docs_dispatch_spec_company_momo [INFERRED 0.85]
- **Parcours de livraison locale (réservation, suivi en direct, application livreur, notifications)** — docs_content_fr_reserver_livraison_moto, docs_content_fr_suivi_livraisons_locales, docs_content_fr_application_livreur, docs_content_fr_modeles_de_notifications, docs_content_fr_evenements_systeme [INFERRED 0.85]
- **Journey 3D pipeline** — docs_project_tracker_journey_controller, docs_project_tracker_stage, docs_project_tracker_tanex_bike_model, docs_project_tracker_tanex_truck_model, docs_project_tracker_h0_3d_brief [INFERRED 0.85]
- **Local bike delivery lifecycle: booking, dispatch, courier app, live tracking, POD** — docs_content_local_delivery_booking, docs_content_dispatch_board_tariffs, docs_content_courier_app, docs_content_local_tracking, docs_content_proof_of_delivery [INFERRED 0.85]
- **Per-page meta injection into index.html** — index_tx_head_markers, index_organization_jsonld, server_render_pagemeta, claude_company_facts [INFERRED 0.85]

## Communities (183 total, 26 thin omitted)

### Community 0 - "console/index.ts"
Cohesion: 0.07
Nodes (38): ConsoleTranslation, Widen, auth, iam, mail, blog, board, createShipmentView (+30 more)

### Community 1 - "API Routes & Middleware"
Cohesion: 0.04
Nodes (90): express, audit(), AuditActor, audited(), FromReq, param(), stripSecrets(), toJson() (+82 more)

### Community 2 - "CreateShipmentView.tsx"
Cohesion: 0.07
Nodes (79): libphonenumber-js, paymentDraftSummary(), bothUnits(), CreateShipmentView(), PackageItem, ServiceOption, ShipmentTypeOption, CountrySelect() (+71 more)

### Community 3 - "Email Outbox & Templates"
Cohesion: 0.09
Nodes (25): RenderedEmail, renderEmail(), render(), render(), render(), render(), render(), render() (+17 more)

### Community 4 - "brand.ts"
Cohesion: 0.04
Nodes (88): ErrorBoundary, ErrorBoundaryProps, ErrorBoundaryState, fallbackLocale(), isRecoverableByReload(), reloadOnce(), Footer(), footerColumns() (+80 more)

### Community 5 - "useAreaT"
Cohesion: 0.06
Nodes (72): lucide-react, react, GalleryImage, PackageGallery(), PackageGalleryProps, PackageImageViewer, PackageImageViewer(), PackageImageViewerProps (+64 more)

### Community 6 - "blogApi.ts"
Cohesion: 0.09
Nodes (49): blogApi, BlogCategory, BlogCover, BlogLocale, BlogMedia, BlogPost, BlogPostSummary, POST_STATUSES (+41 more)

### Community 7 - "Public Pages & Blog Views"
Cohesion: 0.08
Nodes (57): articleClick(), BlogCard(), BlogCardProps, LanguageSwitch(), LanguageSuggestion(), prefersFrench(), PageHero(), PageHeroProps (+49 more)

### Community 8 - "Dispatch Job Engine"
Cohesion: 0.03
Nodes (105): actionTime(), applyTransition(), CASH_METHODS, CashEntryInput, CashMethod, checkJobShape(), CityRow, createJobShipment() (+97 more)

### Community 9 - "outbox.ts"
Cohesion: 0.10
Nodes (30): getTransport(), MailConfig, mailConfig(), maskEmail(), OutgoingMessage, SendFn, sendMessage(), CUSTOMER_EMAILS_PER_HOUR (+22 more)

### Community 10 - "CONTENT.md: TanEx Content Deck (English master)"
Cohesion: 0.09
Nodes (29): CONTENT.md: TanEx Content Deck (English master), 4 About page, 1.4 API error code messages, 16 Careers and CSR Policy, 7-day claims window [confirm], 8.3 Contact page, Cookie Policy (tx.sid, local storage keys), Dimensional weight divisor 5000 [confirm] (+21 more)

### Community 11 - "Blender 3D Model Scripts"
Cohesion: 0.08
Nodes (36): activate(), arc_band(), box(), decal(), disc(), ellipsoid(), empty(), finish() (+28 more)

### Community 12 - "Dispatch Board Logic"
Cohesion: 0.06
Nodes (49): app, call(), createJob(), HASH, NOW, now0, place(), server (+41 more)

### Community 13 - "CouriersView.tsx"
Cohesion: 0.06
Nodes (63): AdminLogin(), AdminLoginProps, AuthCard(), AuthError(), ForgotPassword(), LANG_NAMES, readResetToken(), ResetPassword() (+55 more)

### Community 14 - "Permissions & Super Admin"
Cohesion: 0.05
Nodes (74): ask(), askNewPassword(), confirm(), isTTY, lines, main(), rl, rlInternal (+66 more)

### Community 15 - "Couriers & Users Routes"
Cohesion: 0.06
Nodes (49): canGrant(), canManageUser(), countOtherActiveSuperAdmins(), generateTempPassword(), holdsSuperAdminRole(), isAllPowerful(), lockedRoleIds(), rolesPermissions() (+41 more)

### Community 16 - "orders.ts"
Cohesion: 0.07
Nodes (40): shopBrowseLimiter, shopOrderLimiter, publicShopRouter, ProductRow, confirmationQueued(), CartCheck, CartLineInput, CheckedLine (+32 more)

### Community 17 - "shopMedia.test.ts"
Cohesion: 0.09
Nodes (42): app, as(), call(), cookies, goodFiles(), HASH, img(), now0 (+34 more)

### Community 18 - "French Site Content"
Cohesion: 0.07
Nodes (39): §8.5 Aide : livraison locale et paiements, §10.3 Application livreur, §2.1 Bandeau principal, §8.2 Aide : base de connaissances, §16 Carrières et Politique RSE, §8 Centre d'aide et Contact, §3.3 Comment ça marche (4 étapes), §3.2 Comparer (tableau des services) (+31 more)

### Community 19 - "TrackPage.tsx"
Cohesion: 0.16
Nodes (17): Field, FIELD_ORDER, PaymentProofForm(), ISSUE_KEYS, SUPPORT_ISSUE_TYPES, SupportIssueType, SupportModal(), SupportModalProps (+9 more)

### Community 20 - "Blog API Routes"
Cohesion: 0.08
Nodes (30): cleanTags(), ADMIN_PAGE_SIZE, ALT_MAX, ANY_POST_ACCESS, BLOG_IMAGE_TYPES, blogAdminRouter, canManageMedia(), canViewPost() (+22 more)

### Community 21 - "render/pageMeta.ts"
Cohesion: 0.04
Nodes (86): Shop SEO and Product JSON-LD, app, conn, indexPath, now, render, server, doc (+78 more)

### Community 22 - "Dispatch Job Drawer"
Cohesion: 0.07
Nodes (45): JobInput, ProfileInput, boardApi, BoardCity, BoardCourier, BoardData, BoardZone, DispatchJob (+37 more)

### Community 23 - "Blog Rendering"
Cohesion: 0.10
Nodes (18): BLOG_MEDIA_PREFIX, BLOG_MEDIA_SRC, CALLOUT_TONES, DocCheck, EMPTY_DOC, esc(), isExternalHref(), linkTag() (+10 more)

### Community 24 - "api.ts"
Cohesion: 0.08
Nodes (40): JourneyMapProps, AdminDataContext, AdminDataContextType, INITIAL_ADMIN_DOCUMENTS, INITIAL_QUOTE_REQUESTS, INITIAL_SHIPMENTS, SERVICE_OPTIONS, ServiceOption (+32 more)

### Community 25 - "Dispatch Status Machine"
Cohesion: 0.08
Nodes (29): ACTIONS, ACTORS, EXPECTED, FROMS, FULL_INPUT, RATES, tmpDir, BEFORE_PICKUP (+21 more)

### Community 26 - "App Shell"
Cohesion: 0.08
Nodes (44): AboutPage, AdminApp, AdminLogin, App(), BlogPage, BlogPostPage, CareersPage, CartPage (+36 more)

### Community 27 - "stage.test.ts"
Cohesion: 0.08
Nodes (38): Prim, CAMERA_KEYS, CameraKey, CameraRail, DOOR_METRES, DOOR_REACH, DOOR_VIEW, IDLE_SECONDS (+30 more)

### Community 28 - "Shop Spec"
Cohesion: 0.09
Nodes (40): docs/SHOP_SPEC.md, Cart and checkout (/cart, /fr/panier), Shop delivery fee calculation, Footer Legal column (FOOTER_ROWS = 5), Shop features not in version 1, Order number TX-ORD-######, Shop order retention (10 years / 2 years), Shop owner decisions (2026-11-17) (+32 more)

### Community 29 - "Tariffs Routes"
Cohesion: 0.07
Nodes (30): ALIASES_MAX, BANDS_MAX, citiesAll(), cityNameTaken(), cityOut(), CityRow, Fail, fail() (+22 more)

### Community 30 - "City-to-City 3D Scene"
Cohesion: 0.08
Nodes (27): ARRIVE_METRES, canvas(), CARGO_SPOT, CITY_TIMELINE, cityFocus(), CityInput, CityScene, COLORS (+19 more)

### Community 31 - "publicCatalog.ts"
Cohesion: 0.10
Nodes (36): shopSettings(), checkCart(), NOT_FOUND, PAGE, resolveShopPage(), ShopPageResult, altOf(), categoryImage() (+28 more)

### Community 32 - "Dispatch Spec"
Cohesion: 0.10
Nodes (32): After launch: backups, retention, monitoring, security, docs/DISPATCH_SPEC.md, Dispatch board problem and suggestion rules, cash_ledger table (TX-CSH-), COD collection and 7-day cash handover, Company MTN MoMo / Orange Money payments, Courier (rider/driver) role, courier_locations table (+24 more)

### Community 33 - "PaymentsView.tsx"
Cohesion: 0.15
Nodes (26): ids, NewProofsPanel(), NewProofsPanelProps, formatProofReceived(), proofAmountMismatch(), ProofFacts(), proofMethodView(), ProofReviewControls() (+18 more)

### Community 34 - "Home Page"
Cohesion: 0.15
Nodes (27): home, primeArea(), ArrivalDoor(), BikeHero(), HeroGlobe(), JourneySprite(), Mountain(), ParcelLabel() (+19 more)

### Community 35 - "AdminApp.tsx"
Cohesion: 0.07
Nodes (59): AdminApp(), AdminAppProps, AdminConsole(), BlogPreview, blogPreviewToken(), BlogStudio, CashView, CouriersView (+51 more)

### Community 36 - "Project Tracker: Launch & Owner Items"
Cohesion: 0.07
Nodes (44): docs/CONTENT_FR.md, FIELD_TEST_G9, E.1 Homepage journey layout, E.2 Services page, E.3 About and Network pages, E.4 Contact, Help, Legal, E.5 Track, Quote and Ship pages, E.6 Payments localisation (MoMo, Orange Money, XAF) (+36 more)

### Community 37 - "Motion Easing Utils"
Cohesion: 0.18
Nodes (22): gate(), LatePhase, latePhase(), CityPhase, cityPhase(), HeroPhase, heroPhase(), InTownPhase (+14 more)

### Community 38 - "routingEngine.ts"
Cohesion: 0.06
Nodes (60): HONG_KONG, HOUSTON, LAGOS, LONDON, LOS_ANGELES, MANCHESTER, milesBetween(), NEW_YORK (+52 more)

### Community 39 - "Brand Image Pipeline"
Cohesion: 0.08
Nodes (32): TanEx logo and derived assets, TanEx logo.png, Managing Director portrait (about-md), Owner-supplied TanEx files, BRAND_OUT, buildBrand(), buildIcons(), buildPhotos() (+24 more)

### Community 40 - "routes/auth.ts"
Cohesion: 0.08
Nodes (39): consumeResetToken(), createResetToken(), findResetUser(), findValidToken(), hashResetToken(), RESET_REQUESTS_PER_HOUR, RESET_TOKEN_TTL_MS, ResetUser (+31 more)

### Community 41 - "shopOrderStatus.ts"
Cohesion: 0.05
Nodes (53): delivery, freshDb(), pickup, SHOP_TABLES, SHOP_GRANT_MIGRATION_KEY, checkOrderTransition(), checkPaymentChange(), DELIVERY_FEE_STATUSES (+45 more)

### Community 42 - "three"
Cohesion: 0.10
Nodes (22): three, ASSETS, BIKE_MODEL_URL, gltfExtensions(), loadGltf(), StageAsset, TRUCK_MODEL_URL, BIKE_COLORS (+14 more)

### Community 43 - "Payment Methods & Validation"
Cohesion: 0.23
Nodes (22): DetailsValidation, PAYMENT_METHOD_TYPES, PaymentField, PaymentFieldKind, PaymentGroup, PaymentMethodDefinition, validateField(), CryptoCoin (+14 more)

### Community 44 - "templates/index.ts"
Cohesion: 0.15
Nodes (22): Block, EmailItem, MailLocale, QueueOptions, TemplateEntry, TemplateVars, render(), render() (+14 more)

### Community 45 - "Public Blog & RSS"
Cohesion: 0.09
Nodes (44): blogSitemapEntries(), categoryVersions(), listPage(), postVersions(), publicCount(), resolveBlogPage(), BLOG_LOCALES, BlogLocale (+36 more)

### Community 46 - "Stage Rendering Loop"
Cohesion: 0.13
Nodes (6): loadAssets(), readyChapters(), CameraView, LateView, shadowPlane(), Stage

### Community 47 - "shopAdmin.ts"
Cohesion: 0.04
Nodes (64): dir, entries, JPEG, PNG, tmp, WEBP, registerApiRoutes(), resolveSessionSecret() (+56 more)

### Community 48 - "PaymentSection.tsx"
Cohesion: 0.11
Nodes (23): PaymentMethodCard(), PaymentMethodCardProps, PaymentProofFormProps, PaymentQr(), PaymentQrProps, formatDueDate(), formatPaidDate(), formatSubmitted() (+15 more)

### Community 49 - "Tariffs Console"
Cohesion: 0.08
Nodes (46): app, call(), HASH, now0, server, signIn(), tmpDir, PinPicker() (+38 more)

### Community 50 - "Courier Offline Queue"
Cohesion: 0.09
Nodes (17): AppliedListener, CourierSync, isRetryable(), Listener, loadItems(), memoryCache, memoryQueue, openDb() (+9 more)

### Community 51 - "Tracker: Decisions & Dispatch"
Cohesion: 0.06
Nodes (36): Audit log (audit()/audited()), B.1 IAM schema, seeded roles, Super Admin bootstrap, B.2 SQLite session store and auth routes, B.3 Route permissions (requirePermission everywhere), B.4 Console auth (AuthContext, forced password change), B.5 Users, Roles and Audit log screens, B.6 Email foundation and password reset, B.7 TOTP 2FA (optional, after launch) (+28 more)

### Community 52 - "fetchApi"
Cohesion: 0.12
Nodes (20): call(), send(), send(), send(), call(), getJson(), fetchApi(), handleResponse() (+12 more)

### Community 53 - "JourneyMap.tsx"
Cohesion: 0.09
Nodes (39): leaflet, formatMessage(), DispatchMap(), esc(), OVERVIEW, OVERVIEW, HomeNetworkMap(), HomeNetworkMapProps (+31 more)

### Community 54 - "3D Hero Globe"
Cohesion: 0.10
Nodes (24): TANEX_LOCATIONS, TRADE_LANES, WORLD_HUB, WORLD_HUBS, WORLD_TIMELINE, WorldFrame, WorldScene, ARC_HUBS (+16 more)

### Community 55 - "TrackingEventsView.tsx"
Cohesion: 0.07
Nodes (52): SEP_28_2026_1400_UTC, EVENT_TIME_ZONES, formatLocationStr(), getCurrentTimeStr(), getEventColors(), getEventTheme(), getTodayDateStr(), MESSAGE_TEMPLATES (+44 more)

### Community 56 - "Public Local Tracking"
Cohesion: 0.13
Nodes (28): CityRow, CourierRow, point(), publicCourierPhoto(), publicLocalDelivery(), shipmentJob(), ZoneRow, readStoredDispatchSettings() (+20 more)

### Community 57 - "Cash Console"
Cohesion: 0.17
Nodes (22): cashApi, CashBalance, CashCourier, CashEntry, CashOverview, CashReport, reportCsvUrl(), AdjustDialog() (+14 more)

### Community 58 - "Content: Console & Tracking Copy"
Cohesion: 0.11
Nodes (25): 3.4 Add-ons (Express, COD, delivery code, packing), 10 Admin console strings, 2.3 Bike delivery section, 10.4 Blog studio and author profile, Cash & Mobile Money ledger (G.8), Cash on delivery, 10.3 Courier app strings, Courier assignment suggestion (on duty, same city, right vehicle, nearest) (+17 more)

### Community 59 - "Cash Report Logic"
Cohesion: 0.12
Nodes (23): balancesFromLines(), CourierBalance, courierCashSummary(), LedgerRow, readCashLines(), toCashLine(), HANDOVER_DEADLINE_DAYS, HANDOVER_METHODS (+15 more)

### Community 60 - "dependencies"
Cohesion: 0.08
Nodes (24): dependencies, express@^5.2.1, express-session@^1.19.0, jsbarcode@^3.11.6, leaflet@^1.9.4, lenis@^1.3.27, libphonenumber-js@^1.13.14, lucide-react@^0.475.0 (+16 more)

### Community 61 - "i18n.test.ts"
Cohesion: 0.12
Nodes (17): app, leaves(), PAIRS, SAME_IN_BOTH, server, tmpDir, Tree, addErrorCodes() (+9 more)

### Community 62 - "JobDetail.tsx"
Cohesion: 0.23
Nodes (20): CourierJob, CourierPlace, JobDetail(), JobMap, MESSAGE_LABEL, MessagesCard(), PlaceCard(), courierActions() (+12 more)

### Community 63 - "ProductEditor.tsx"
Cohesion: 0.10
Nodes (43): DocNode, when(), CategoriesManager(), CategoryDialog(), EditorPicture, PictureManager(), changes(), EMPTY_DOC (+35 more)

### Community 64 - "capabilities.ts"
Cohesion: 0.21
Nodes (18): drawLanesOnReveal(), afterLoadIdle(), canAnimate(), canSmoothScroll(), canUseStage(), isMotionPaused(), matches(), pauseListeners (+10 more)

### Community 65 - "package.json"
Cohesion: 0.09
Nodes (22): compression@^1.8.2, react-dom@^18.3.1, @types/bcryptjs@^2.4.6, @types/cors@^2.8.19, @types/leaflet@^1.9.22, @types/qrcode@^1.5.6, @types/three@^0.187.0, typescript@^5.7.3 (+14 more)

### Community 66 - "TipTap Editor Dependencies"
Cohesion: 0.09
Nodes (22): @tiptap/core@^3.33.1, @tiptap/extension-image@^3.33.1, @tiptap/extension-link@^3.33.1, @tiptap/extension-table@^3.33.1, @tiptap/extensions@^3.33.1, @tiptap/pm@^3.33.1, @tiptap/starter-kit@^3.33.1, @tiptap/core (+14 more)

### Community 67 - "Tanex Master Plan"
Cohesion: 0.12
Nodes (20): Console at /private-user/ (ADMIN_PATH), Tech stack (React/Vite/Express/node:sqlite), Part 1: Booking at /fr/livraison-locale, Part 5: Failed attempt, G.9 Field test: Buea end-to-end delivery, Part 8: Finance confirmation and daily CSV, Finding report format and severity (Blocker/Major/Minor/Idea), Part 4: On the way and live map (+12 more)

### Community 68 - "Design Direction Mocks"
Cohesion: 0.12
Nodes (20): Camera use per chapter, Approval decisions and open items, Components (buttons, track field, chips, cards) light/dark, Homepage mock frames (desktop iframe + phone), Journey storyboard (9 key frames, chapters 0-8), TanEx Design Direction (C.1, approved 7 Nov 2026), design/tx.css + sprite.js (shared mock assets), Type system (Plus Jakarta Sans 800 + italic word, Inter, JetBrains Mono) (+12 more)

### Community 69 - "orderEmails.ts"
Cohesion: 0.16
Nodes (27): isAllowedOrigin(), cleanVar(), appUrl(), consoleOrderUrl(), consoleUrl(), passwordResetUrl(), quoteUrl(), returnsUrl() (+19 more)

### Community 70 - "Dispatch Jobs Tests"
Cohesion: 0.12
Nodes (15): act(), addCourier(), addUser(), app, call(), createJob(), HASH, json() (+7 more)

### Community 71 - "3D Hero & Door"
Cohesion: 0.09
Nodes (19): ArrivalScene, DEPART_METRES, DOOR_Z, HERO_TIMELINE, HeroFrame, HeroScene, LOGO_AT, ORBIT (+11 more)

### Community 72 - "3D Label & Parcel"
Cohesion: 0.12
Nodes (17): Focus, CENTRE, LABEL_TIMELINE, LabelPose, LabelRig, code128B(), PATTERNS, buildParcel() (+9 more)

### Community 73 - "paymentRequest.ts"
Cohesion: 0.13
Nodes (19): btc, paypal, PaymentDraftAccount, customerMethodView(), Details, PaymentMethodType, validatePaymentDetails(), CleanPaymentRequest (+11 more)

### Community 74 - "Smooth Scroll & Route Rail"
Cohesion: 0.31
Nodes (9): useJourneyChapter(), headerOffset(), scrollToSection(), barPercent(), chapterNumbers(), RailChapter, railPosition(), RouteRail() (+1 more)

### Community 75 - "Courier App Shell"
Cohesion: 0.14
Nodes (23): LOGO_WHITE, ACTIVE, alertNewJob(), CourierApp(), CourierRoot(), CourierShell(), readSeen(), seenKey() (+15 more)

### Community 76 - "SettingsView.tsx"
Cohesion: 0.16
Nodes (20): EmailSettingsPanel(), OutboxTable(), STATUS_CHIP, when(), EmailSettingsPanel, MAIL_TEXT, OFFICE_TIME_ZONE, MailStatus (+12 more)

### Community 77 - "TanEx Project Tracker"
Cohesion: 0.09
Nodes (25): BRAND_GUIDE, DEPLOYMENT, TanEx Project Tracker, A.2 Brand config (brand.ts, references, XAF), A.3 Logo and icons, A.4 Previous-brand sweep, C.1 Design direction (design/direction.html), C.2 --tx-* tokens with --ngf-* aliases (+17 more)

### Community 78 - "SmoothScroll.tsx"
Cohesion: 0.16
Nodes (19): lenis, whenIdle(), loadedGsap(), loadGsap(), GsapKit, findHero(), INNER_REVEAL, InnerPageMotion() (+11 more)

### Community 79 - "3D Model Brief"
Cohesion: 0.13
Nodes (15): tanex_bike model (bike + rider + top box), Blender blockout scripts (build_tanex_bike.py / build_tanex_truck.py), 3D colour specification (brand palette), Deliverables (.blend + .glb, textures, renders), Milestones M1-M3 and acceptance check, phone_screen 'screen' material (live map), Named pivot hierarchy (front_wheel, handlebar, rider_torso, box_lid, parcel_socket), TanEx 3D Model Brief and RFQ (+7 more)

### Community 80 - "Payments Update Spec"
Cohesion: 0.18
Nodes (12): Dashboard notifications (badge, bell, toast, ngf_seen_proofs), Files & storage requirements (UPLOADS_DIR, magic bytes), Prompt: Package Images, Payment Methods & Proof of Payment, Proof submission rules (POST /api/track/:id/payment-proof), Workflow per task and report back, Public GET /media/:id route, Payment method registry src/shared/paymentMethods.ts, payment_proofs table and review flow (+4 more)

### Community 81 - "trackingId.ts"
Cohesion: 0.18
Nodes (14): generateUniqueTrackingId(), TRACKING_PREFIX, generateTrackingId(), ID_LENGTH, isValidTrackingId(), normalizeTrackingInput(), ParsedTrackingInput, parsePieceLabel() (+6 more)

### Community 82 - "catalog.ts"
Cohesion: 0.12
Nodes (37): applyProductInput(), bad(), CategoryInput, CategoryRow, categorySlugTaken(), checkCategoryImage(), checkParent(), clearPending() (+29 more)

### Community 83 - "Content: Home & Blog Copy"
Cohesion: 0.12
Nodes (19): docs/BLOG_SPEC.md, 15 Blog pages, 2.7 Get in touch, 2.5 Global network section, 2.1 Hero (From your door to the world), 2.8 Home FAQ, 2 Home page (owner's outline), 2.10 The Journey: chapter beats and route rail (+11 more)

### Community 84 - "Tracker: Journey Phase"
Cohesion: 0.13
Nodes (17): Route rail (RouteRail.tsx, travelling bike icon), H.0 3D brief for the artist, H.1 Motion foundation (GSAP, Lenis, JourneyController), H.2 The Stage (WebGL canvas) and bike, H.3 Chapters 0-1: hero globe and services road, H.4 Chapters 2-3: in town and city to city truck, H.5 Chapters 4-8: world, label, arrival, H.6 Final glTF models and posters (+9 more)

### Community 85 - "shipmentStatusLabel"
Cohesion: 0.10
Nodes (33): DeleteShipmentModalProps, EditShipmentModalProps, ControlAction, ShipmentControlModal(), ShipmentControlModalProps, STANDARD_HUBS, AllShipmentsViewProps, ADMIN_ROLE_LABEL (+25 more)

### Community 86 - "TypeScript Config"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+9 more)

### Community 87 - "blogRender.test.ts"
Cohesion: 0.13
Nodes (17): ATTACKS, render(), countWords(), parseDoc(), PMNode, readingMinutes(), renderDoc(), sanitizeBlogHtml() (+9 more)

### Community 88 - "Legal Pages"
Cohesion: 0.20
Nodes (11): LEGAL_DOC_IDS, LEGAL_LAST_UPDATED, LEGAL_URL, LegalBlock, LegalContact, LegalDoc, LegalDocId, legalDocs() (+3 more)

### Community 89 - "sheets.tsx"
Cohesion: 0.30
Nodes (15): CashScreen(), EMPTY, useCourierText(), CashMethod, draftFor(), FailSheet(), PickupSheet(), PodSheet() (+7 more)

### Community 90 - "Journey Scroll Store"
Cohesion: 0.11
Nodes (19): GSAP (ScrollTrigger, SplitText, CustomEase), beatOf(), BEATS, clamp01(), headerOffset(), PIN_VH, setBeat(), setupJourney() (+11 more)

### Community 91 - "Brand Guide"
Cohesion: 0.11
Nodes (14): BRAND_COLORS in brand.ts, TanEx Brand Guide & Design System, Name usage (TanEx vs Tanex SARL), Palette (Chocolate, Cream, Orange #F48800), Positioning pillars (Door to world, Live visibility, Accountable hands, Local roots), Reference formats (TX-TKT, TX-INV, TX-SL, TX-CSH, QR-YYYY), Secondary slogan: Saving Situations, Tagline: From Your Door to the World (+6 more)

### Community 92 - "Motion & 3D Spec"
Cohesion: 0.19
Nodes (13): TanEx bike + rider model (tanex-bike.glb), capabilities.ts (canAnimate / canUseStage), Journey chapters 0-8, Globe (stage/globe.ts, Natural Earth dots), Lenis smooth scroll, Motion & 3D Specification: The Journey, Pause motion control (tx_motion_paused), Static chapter posters (fallback) (+5 more)

### Community 93 - "Tracker: Shop Phase M"
Cohesion: 0.13
Nodes (14): Courier offlineQueue.ts (IndexedDB), G.4 Courier app (PWA, offline queue), #140 Marketplace button, #164 Delivery code rules, #183 Shop order retention (10y / 2y), M.0 Shop spec and Returns & Refunds draft, M.1 Shop schema and permissions, M.2 Square picture pipeline (+6 more)

### Community 94 - "§13 Mentions légales"
Cohesion: 0.15
Nodes (15): Accessibilité (WCAG 2.2 AA), Codes d'erreur (BAD_REQUEST, INVALID_TRACKING_ID, RATE_LIMITED...), Conditions d'expédition, Conditions d'utilisation, Engagements (4) du pied de page, §1.2 En-tête et navigation, §1 Global : métadonnées, en-tête, pied de page, §1.4 Langue, messages communs et erreurs (+7 more)

### Community 95 - "middleware/auth.ts"
Cohesion: 0.02
Nodes (125): bcryptjs@^3.0.3, bcryptjs, DB_FILE, HASH, login(), openApps, sidCookie(), startApp() (+117 more)

### Community 96 - "services/shopPublic.ts"
Cohesion: 0.13
Nodes (20): OrderInput, ProductListQuery, ProductViewProps, Filters, ProductCardProps, CartCheckResult, CheckedCartLine, DeliveryFeeResult (+12 more)

### Community 97 - "fr/contact.ts"
Cohesion: 0.50
Nodes (3): contact, ContactMessages, contact

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
Cohesion: 0.27
Nodes (13): clamp01(), easeInOutCubic(), glide(), GLIDE_MS, glideAt(), HERO_PARALLAX_PX, isLongPage(), LONG_PAGE_SCREENS (+5 more)

### Community 102 - "routes/cash.ts"
Cohesion: 0.17
Nodes (13): allocateCashRef(), NOTE_MAX, body(), canConfirm, canView, cashRouter, ENTRY_LABEL, entryOut() (+5 more)

### Community 103 - "LocalDeliveryPage.tsx"
Cohesion: 0.06
Nodes (55): Button, ButtonAsButton, ButtonAsLink, buttonClass(), ButtonProps, ButtonSize, ButtonVariant, CommonProps (+47 more)

### Community 104 - "i18n Home & Delivery Copy"
Cohesion: 0.16
Nodes (12): about, AboutMessages, AreaMessages, courier, CourierMessages, localDelivery, LocalDeliveryMessages, trackResult (+4 more)

### Community 105 - "In-Town 3D Scene"
Cohesion: 0.16
Nodes (10): IN_TOWN_TIMELINE, MAP, mapRoutePoint(), mapTexture(), ON_THE_WAY_METRES, PHONE_FOCUS, PhoneMap, RIDE_OUT_METRES (+2 more)

### Community 106 - "JobDrawer.tsx"
Cohesion: 0.13
Nodes (31): boardErrorText(), AssignDialog(), boardJobMessages(), CancelDialog(), DialogError(), Field(), JobDrawer(), LiftCodeDialog() (+23 more)

### Community 107 - "imageCompress.ts"
Cohesion: 0.28
Nodes (11): PendingImage, ShipmentImagesPanel(), ShipmentImagesPanelProps, blobToBase64(), canvasToBlob(), compressImage(), CompressOptions, ImageCompressError (+3 more)

### Community 108 - "HelpPage.tsx"
Cohesion: 0.24
Nodes (10): Chip(), CONTACT_QUICK_ANSWER_IDS, HELP_ARTICLES, HELP_CATEGORIES, HelpArticle, HelpArticleKey, HelpCategory, fold() (+2 more)

### Community 109 - "context.ts"
Cohesion: 0.22
Nodes (8): CourierKey, CourierLang, CourierT, CourierText, CourierTextContext, JobMap(), pinned(), KeyPath

### Community 110 - "Server TS Config"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, module, moduleResolution, noUnusedLocals, noUnusedParameters, outDir, resolveJsonModule (+5 more)

### Community 111 - "Company Facts & Launch"
Cohesion: 0.18
Nodes (13): Company facts (single source of truth), Ch 6 Contact (channels + form), Blog SEO (hreflang, OG, JSON-LD BlogPosting, sitemap, RSS), Tracking ID format (TX + 6 safe chars), Launch checklist, Owner decisions (2026-11-06), Six service card photos (Unsplash License), Homepage service card photos sources (+5 more)

### Community 112 - "Notifications Spec"
Cohesion: 0.28
Nodes (13): docs/NOTIFICATIONS_SPEC.md, buildWhatsAppLink(phoneE164, templateKey, vars, locale), Notification channels (email, WhatsApp link, in-app), Later upgrade: WhatsApp Cloud API / SMS, SPF / DKIM / DMARC for tanexsarl.com, email_outbox table and send worker, Email templates (server/mail/templates/<key>.<locale>.ts), notification_log table (+5 more)

### Community 113 - "Phase D: Routing & Languages"
Cohesion: 0.22
Nodes (9): I18N_SPEC, D.1 Path routing (route table, navigate, Link), D.2 Server-side page meta and bilingual sitemap, D.3 i18n foundation (en.ts/fr.ts, format.ts), i18n dictionaries (src/i18n en/fr), #108 Native French review, server/render/pageMeta.ts head renderer, Phase D: Routing & Languages (+1 more)

### Community 114 - "consoleText.ts"
Cohesion: 0.05
Nodes (54): ADMIN_APP_TEXT, ADMIN_APP_TEXT_EN, BLOG_MENU, BLOG_MENU_EN, CASH_TEXT_EN, DELETE_SHIPMENT_MODAL_TEXT, DELETE_SHIPMENT_MODAL_TEXT_EN, EDIT_SHIPMENT_MODAL_TEXT (+46 more)

### Community 115 - "layout.ts"
Cohesion: 0.33
Nodes (9): blockHtml(), blockText(), escapeHtml(), isHttpUrl(), itemLine(), Paragraph, paragraphHtml(), paragraphText() (+1 more)

### Community 116 - "shopSettings.ts"
Cohesion: 0.21
Nodes (12): SHOP_PAYMENT_METHODS, DEFAULT_SHOP_SETTINGS, idOrNull(), isIntIn(), isValidOrderEmail(), LANDMARK_MAX, LOW_STOCK_MAX, MAX_PER_ORDER_MAX (+4 more)

### Community 117 - "I18N Spec"
Cohesion: 0.25
Nodes (8): Stable API error codes mapped by the client, Intl formatting format.ts (en-CM / fr-CM, XAF 0 decimals), Languages, Routing & Page Meta Specification (EN/FR), Server page meta injection server/render/pageMeta.ts, Route table src/router/routes.ts, Bilingual sitemap with hreflang alternates, Tracking event title_key / title_vars_json, EN/FR URL scheme (/ and /fr/)

### Community 119 - "build-globe-dots.mjs"
Cohesion: 0.18
Nodes (8): bits, cameroon, cameroonFeature, cm, data, iso(), land, OUT

### Community 120 - "eventTitles.ts"
Cohesion: 0.29
Nodes (8): EVENT_TITLES, eventTitleText(), EventTitleVars, isEventTitleKey(), parseEventTitleVars(), renderEventTitle(), StatusLang, frenchSpacing()

### Community 121 - "Deployment Guide"
Cohesion: 0.22
Nodes (9): Deployment: GitHub to Hostinger, Domain and paths (apex, /private-user/ noindex), Email DNS (MX, SPF, DKIM, DMARC), email_outbox queue with retries, Environment variables (SESSION_SECRET, DB_PATH, UPLOADS_DIR, SMTP_*), Hosting requirements (Node >= 22.5, persistent storage, HTTPS, Hostinger Email), Hostinger app configuration (npm install, npm start), Persistence check (/api/diag/storage) (+1 more)

### Community 122 - "ResponsiveImage.tsx"
Cohesion: 0.36
Nodes (7): largest(), ResponsiveImage(), ResponsiveImageProps, srcSet(), SITE_IMAGES, SiteImageInfo, SiteImageName

### Community 123 - "App Shell HTML"
Cohesion: 0.20
Nodes (9): Performance budget and motion loading, The Journey (3D scroll story with TanEx bike), index.html app shell, src/main.tsx entry, Organization JSON-LD structured data, tx:head per-page meta markers, Phase A: Separation & rebrand foundation, A2: Brand config, IDs and metadata (+1 more)

### Community 124 - "npm Scripts"
Cohesion: 0.20
Nodes (10): scripts, build, create-super-admin, dev, dev:vite, postinstall, preview, server (+2 more)

### Community 125 - "Dev Dependencies"
Cohesion: 0.22
Nodes (9): devDependencies, concurrently@^10.0.5, gltfpack@^1.3.0, sharp@^0.35.4, tsx@^4.23.12, concurrently, gltfpack, sharp (+1 more)

### Community 126 - "DocumentCenterView.tsx"
Cohesion: 0.17
Nodes (20): DocumentCenterView(), DocumentCenterViewProps, loadPdfTools(), waitForImagesToLoad(), place(), PodDetails, PodPaper, readDetails() (+12 more)

### Community 127 - "RichEditor.tsx"
Cohesion: 0.35
Nodes (10): blogExtensions(), safeHref(), ImageDialog(), LinkDialog(), RichEditor(), RichEditorProps, Toolbar(), ToolButton() (+2 more)

### Community 128 - "blog.test.ts"
Cohesion: 0.13
Nodes (17): app, as(), call(), cookies, createPost(), doc(), HASH, now0 (+9 more)

### Community 129 - "Stock Image Sources"
Cohesion: 0.50
Nodes (5): Free CC0 images sources (retired), Free Pexels images sources (retired), locations-hero stock photo (console sign-in background until I.1), Free stock photos sources (retired), Unsplash hero photos sources (retired)

### Community 131 - "Vite Build"
Cohesion: 0.40
Nodes (4): vite@^6.1.0, @vitejs/plugin-react@^4.3.4, vite, @vitejs/plugin-react

### Community 133 - "Self-hosted Fonts"
Cohesion: 0.40
Nodes (5): Inter font licence (SIL OFL 1.1), JetBrains Mono font licence (SIL OFL 1.1), Plus Jakarta Sans font licence (SIL OFL 1.1), Brand fonts (self-hosted) README, Self-hosted WOFF2 Latin/Latin-ext subsets from @fontsource v5

### Community 134 - "format.ts"
Cohesion: 0.14
Nodes (22): OPENING_HOURS, OpeningHours, useCourierTextValue(), currencyDecimals(), DateInput, formatClock(), formatDateTime(), formatDistanceKm() (+14 more)

### Community 135 - "runtime.ts"
Cohesion: 0.16
Nodes (13): AREA_LOADERS_EN, AreaName, en, Messages, AREA_LOADERS_FR, AreaEntry, areas, listeners (+5 more)

### Community 136 - "i18n Help"
Cohesion: 0.50
Nodes (3): help, HelpMessages, help

### Community 137 - "fr/network.ts"
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

### Community 142 - "ProfileScreen.tsx"
Cohesion: 0.42
Nodes (7): ProfileScreen(), BeforeInstallPromptEvent, canInstall(), installListeners, onInstallChange(), promptInstall(), errorText()

### Community 143 - "Prompts: IAM Phase"
Cohesion: 0.67
Nodes (3): audit() / audit_log, Phase B: Identity & access (IAM/RBAC), SQLite session store (tx.sid cookie)

### Community 144 - "localDelivery.test.ts"
Cohesion: 0.19
Nodes (9): Dispatch API, app, book(), booking(), call(), now0, server, tmpDir (+1 more)

### Community 145 - "Courier app (src/courier/)"
Cohesion: 0.25
Nodes (8): Courier app UI rules (56px buttons, one-handed), UI details (grid, radius, elevation, motifs, focus), Uploads folder (images, proofs, blog, pod, couriers), Courier app (src/courier/), Courier location sharing during active jobs, Courier offline action queue (IndexedDB, idempotency), Proof of delivery (POD) and delivery code, Order idempotency key and abuse protection

### Community 146 - "ProofViewer.tsx"
Cohesion: 0.50
Nodes (3): ProofViewerProps, PROOF_VIEWER_TEXT, PROOF_VIEWER_TEXT_EN

### Community 149 - "ConsoleLanguage.tsx"
Cohesion: 0.18
Nodes (15): compare(), SRC, ConsoleLangContext, ConsoleLanguage(), ConsoleLangValue, ConsoleLang, isConsoleLangReady(), loadConsoleLang() (+7 more)

### Community 151 - "PaymentIcon.tsx"
Cohesion: 0.40
Nodes (4): PAYMENT_ICON_PATHS, FALLBACKS, ICON_COLORS, PaymentIconProps

### Community 152 - "multipart.ts"
Cohesion: 0.24
Nodes (10): malformed, MultipartBody, multipartBoundary(), MultipartFile, MultipartLimits, MultipartResult, parseMultipart(), readBody() (+2 more)

### Community 166 - "fr/payment.ts"
Cohesion: 0.50
Nodes (3): payment, PaymentMessages, payment

### Community 167 - "fr/ship.ts"
Cohesion: 0.50
Nodes (3): ship, ShipMessages, ship

### Community 176 - "courierApi.ts"
Cohesion: 0.13
Nodes (16): CashBalance, CashEntry, CashInput, CashState, courierApi, CourierProfile, courierUrls, RawResult (+8 more)

### Community 177 - "references.ts"
Cohesion: 0.27
Nodes (8): newProductCode(), REFERENCE_PREFIX, generateReference(), isReferenceOf(), REFERENCE_PATTERN, REFERENCE_PREFIXES, referenceFor(), ReferenceKind

### Community 178 - "fr/blog.ts"
Cohesion: 0.50
Nodes (3): blog, BlogMessages, blog

### Community 179 - "fr/legal.ts"
Cohesion: 0.50
Nodes (3): legal, LegalMessages, legal

### Community 187 - "fr/company.ts"
Cohesion: 0.50
Nodes (3): company, CompanyMessages, company

### Community 188 - "types.ts"
Cohesion: 0.17
Nodes (10): HomeMessages, shop, ShopMessages, about, home, shop, Dict, LOCALES (+2 more)

### Community 190 - "PaymentRequestEditor.tsx"
Cohesion: 0.20
Nodes (20): AccountEditor, accountSummary(), blankDetails(), draftFromPayment(), draftToRequest(), emptyPaymentDraft(), inputType(), newAccount() (+12 more)

### Community 191 - "AdminLayout.text.ts"
Cohesion: 0.50
Nodes (3): ADMIN_LAYOUT_TEXT, ADMIN_LAYOUT_TEXT_EN, ViewMeta

## Knowledge Gaps
- **131 isolated node(s):** `Password reset tokens (password_resets)`, `Super Admin bootstrap and npm run create-super-admin`, `Optional TOTP 2FA (B.7)`, `users table (email or phone, bcrypt 12)`, `Site link www.tanexsarl.com` (+126 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1390 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **26 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `useAreaT` to `CreateShipmentView.tsx`, `brand.ts`, `blogApi.ts`, `Public Pages & Blog Views`, `format.ts`, `Dispatch Board Logic`, `CouriersView.tsx`, `ProfileScreen.tsx`, `shopMedia.test.ts`, `ProofViewer.tsx`, `TrackPage.tsx`, `ConsoleLanguage.tsx`, `Dispatch Job Drawer`, `PaymentIcon.tsx`, `api.ts`, `App Shell`, `PaymentsView.tsx`, `Home Page`, `AdminApp.tsx`, `PaymentSection.tsx`, `Tariffs Console`, `courierApi.ts`, `JourneyMap.tsx`, `TrackingEventsView.tsx`, `Cash Console`, `dependencies`, `PaymentRequestEditor.tsx`, `ProductEditor.tsx`, `JobDetail.tsx`, `package.json`, `capabilities.ts`, `Smooth Scroll & Route Rail`, `Courier App Shell`, `SettingsView.tsx`, `SmoothScroll.tsx`, `shipmentStatusLabel`, `sheets.tsx`, `Journey Scroll Store`, `Glide & Page Progress`, `LocalDeliveryPage.tsx`, `JobDrawer.tsx`, `imageCompress.ts`, `HelpPage.tsx`, `context.ts`, `ResponsiveImage.tsx`, `DocumentCenterView.tsx`, `RichEditor.tsx`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **What connects `Password reset tokens (password_resets)`, `Super Admin bootstrap and npm run create-super-admin`, `Optional TOTP 2FA (B.7)` to the rest of the system?**
  _131 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `console/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07039187227866474 - nodes in this community are weakly interconnected._
- **Why does `CONTENT.md: TanEx Content Deck (English master)` connect `CONTENT.md: TanEx Content Deck (English master)` to `Project Tracker: Launch & Owner Items`, `TanEx Project Tracker`, `French Site Content`, `Content: Home & Blog Copy`, `Content: Console & Tracking Copy`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Should `API Routes & Middleware` be split into smaller, more focused modules?**
  _Cohesion score 0.04211648673863788 - nodes in this community are weakly interconnected._
- **Why does `Brand placeholders ({{COMPANY}}, {{PHONE}}, {{HOURS}}...)` connect `CONTENT.md: TanEx Content Deck (English master)` to `brand.ts`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Should `CreateShipmentView.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06760630673674152 - nodes in this community are weakly interconnected._