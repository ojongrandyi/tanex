# Graph Report - Tanex  (2026-11-19)

## Corpus Check
- 557 files · ~634,621 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 107 file(s) not represented in the graph (top: .css 77, .woff2 24, .glb 2)

## Summary
- 5024 nodes · 14615 edges · 195 communities (172 shown, 23 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 146 edges (avg confidence: 0.83)
- Token cost: 1,020,933 input · 0 output

## Graph Freshness
- Built from commit: `d7d84de5`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- console/index.ts
- API Routes & Middleware
- CreateShipmentView.tsx
- renderEmail
- brand.ts
- CartPage.tsx
- blogApi.ts
- useAreaT
- Dispatch Job Engine
- outbox.ts
- CONTENT.md: TanEx Content Deck (English master)
- Blender 3D Model Scripts
- Dispatch Board Logic
- AdminLogin.tsx
- Permissions & Super Admin
- Couriers & Users Routes
- orders.ts
- shopMedia.test.ts
- French Site Content
- lucide-react
- Blog API Routes
- render/pageMeta.ts
- Dispatch Job Drawer
- Blog Rendering
- orderAdmin.ts
- Dispatch Status Machine
- App Shell
- Stage.ts
- Shop Spec
- Tariffs Routes
- City-to-City 3D Scene
- publicCatalog.ts
- Dispatch Spec
- PaymentsView.tsx
- Home Page
- AdminApp.tsx
- Project Tracker: Launch & Owner Items
- stage.test.ts
- routingEngine.ts
- Brand Image Pipeline
- routes/auth.ts
- shopOrderStatus.ts
- three
- Payment Methods & Validation
- shopAdmin.ts
- Public Blog & RSS
- Stage Rendering Loop
- server/index.ts
- OperationsCenter.tsx
- Tariffs Console
- Courier Offline Queue
- Tracker: Decisions & Dispatch
- fetchApi
- HomeNetworkMap.tsx
- 3D Hero Globe
- api.ts
- Public Local Tracking
- Cash Console
- Content: Console & Tracking Copy
- Cash Report Logic
- dependencies
- i18n.test.ts
- jobLogic.ts
- ProductEditor.tsx
- capabilities.ts
- package.json
- TipTap Editor Dependencies
- Tanex Master Plan
- Design Direction Mocks
- IamDialog
- Dispatch Jobs Tests
- 3D Hero & Door
- 3D Label & Parcel
- PaymentRequestEditor.tsx
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
- localPricing.ts
- LocationsPage.tsx
- sheets.tsx
- Journey Scroll Store
- Brand Guide
- Motion & 3D Spec
- Tracker: Shop Phase M
- §13 Mentions légales
- ref_node_fs
- shopApi.ts
- fr/contact.ts
- Project Rules (CLAUDE.md)
- Blog Spec
- IAM & RBAC Spec
- Glide & Page Progress
- routes/cash.ts
- LocalDeliveryPage.tsx
- en.ts
- geocodingService.ts
- JobDrawer.tsx
- imageCompress.ts
- ref_node_assert
- CouriersView.tsx
- Server TS Config
- Company Facts & Launch
- Notifications Spec
- Phase D: Routing & Languages
- consoleText.ts
- blogPages.test.ts
- shopSettings.ts
- I18N Spec
- SQLite Session Store
- build-globe-dots.mjs
- react
- Deployment Guide
- roles.ts
- App Shell HTML
- npm Scripts
- Dev Dependencies
- AdminDataContext.tsx
- RichEditor.tsx
- blog.test.ts
- Stock Image Sources
- jspdf
- Vite Build
- Courier Service Worker
- Self-hosted Fonts
- I18nProvider.tsx
- passwordReset.test.ts
- i18n Help
- fr/network.ts
- i18n Not Found
- i18n Quote
- i18n Services
- shopOrdersAdmin.test.ts
- cashLedger.test.ts
- Prompts: IAM Phase
- localDelivery.test.ts
- Courier app (src/courier/)
- routeGuards.test.ts
- ServicesPage.tsx
- JourneyController.tsx
- ConsoleLanguage.tsx
- shopCatalog.test.ts
- PaymentIcon.tsx
- multipart.ts
- mail.test.ts
- html2canvas
- auth.test.ts
- Prompts Pack Intro
- Prompts: Routing Phase
- Design: City to City
- Design: Smart Label
- Design: Services
- Prompts: Blog Phase
- Prompts: Launch Phase
- Prompts: Utilities
- permissions.test.ts
- fr/payment.ts
- fr/ship.ts
- shopEmails.test.ts
- courierApp.test.ts
- cors
- shopOrders.test.ts
- users.test.ts
- qrcode
- imageSize.ts
- preview.ts
- JobDetail.tsx
- references.ts
- fr/blog.ts
- fr/legal.ts
- camera.ts
- fr/about.ts
- fr/courier.ts
- fr/trackResult.ts
- @tiptap/react
- @types/bcryptjs@^2.4.6
- fr/company.ts
- fr.ts
- @types/jsbarcode@^3.11.4
- @types/react@^18.3.18
- @types/sanitize-html@^2.16.2
- typescript@^5.7.3
- dotenv
- @types/react-dom@^18.3.5

## God Nodes (most connected - your core abstractions)
1. `react` - 154 edges
2. `lucide-react` - 100 edges
3. `useAreaT()` - 73 edges
4. `renderEmail()` - 63 edges
5. `useAuth()` - 62 edges
6. `MainAppContent()` - 54 edges
7. `useLocale()` - 52 edges
8. `express` - 50 edges
9. `docs/SHOP_SPEC.md` - 46 edges
10. `ConsoleTextAreas` - 45 edges

## Surprising Connections (you probably didn't know these)
- `Ch 2 In town (bike delivery, from 500 FCFA)` --references--> `Company facts (single source of truth)`  [INFERRED]
  design/home.html → CLAUDE.md
- `formatMessage()` --calls--> `getGateway()`  [EXTRACTED]
  server/routes/messages.ts → src/data/gateways.ts
- `startApp()` --indirect_call--> `requireAuth()`  [INFERRED]
  scripts/auth.test.ts → server/middleware/auth.ts
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

## Communities (195 total, 23 thin omitted)

### Community 0 - "console/index.ts"
Cohesion: 0.07
Nodes (38): ConsoleTranslation, Widen, auth, iam, mail, blog, board, createShipmentView (+30 more)

### Community 1 - "API Routes & Middleware"
Cohesion: 0.04
Nodes (82): express, express-rate-limit, AuditActor, audited(), FromReq, param(), stripSecrets(), toJson() (+74 more)

### Community 2 - "CreateShipmentView.tsx"
Cohesion: 0.07
Nodes (81): libphonenumber-js, paymentDraftSummary(), bothUnits(), CreateShipmentView(), PackageItem, ServiceOption, ShipmentTypeOption, QuoteRequestsView() (+73 more)

### Community 3 - "renderEmail"
Cohesion: 0.05
Nodes (76): Block, blockHtml(), blockText(), cleanVar(), EmailItem, escapeHtml(), isHttpUrl(), itemLine() (+68 more)

### Community 4 - "brand.ts"
Cohesion: 0.05
Nodes (72): Footer(), footerColumns(), FooterProps, POWERED_BY, SOCIAL_LINKS, TRUST_ICONS, TRUST_KEYS, hasMenu() (+64 more)

### Community 5 - "CartPage.tsx"
Cohesion: 0.07
Nodes (36): CartPage(), CheckState, FeeState, FieldKey, Navigate, newKey(), unitPrice(), withNodes() (+28 more)

### Community 6 - "blogApi.ts"
Cohesion: 0.09
Nodes (46): blogApi, BlogCategory, BlogCover, BlogLocale, BlogMedia, BlogPost, BlogPostSummary, POST_STATUSES (+38 more)

### Community 7 - "useAreaT"
Cohesion: 0.08
Nodes (65): PageHead, articleClick(), BlogCard(), BlogCardProps, NetworkMapPanelProps, COMPANY, useAreaT(), Locale (+57 more)

### Community 8 - "Dispatch Job Engine"
Cohesion: 0.04
Nodes (88): Dispatch API, actionTime(), applyTransition(), CASH_METHODS, CashEntryInput, CashMethod, checkJobShape(), CityRow (+80 more)

### Community 9 - "outbox.ts"
Cohesion: 0.09
Nodes (34): getTransport(), MailConfig, mailConfig(), maskEmail(), OutgoingMessage, SendFn, sendMessage(), CUSTOMER_EMAILS_PER_HOUR (+26 more)

### Community 10 - "CONTENT.md: TanEx Content Deck (English master)"
Cohesion: 0.09
Nodes (29): CONTENT.md: TanEx Content Deck (English master), 4 About page, 1.4 API error code messages, 16 Careers and CSR Policy, 7-day claims window [confirm], 8.3 Contact page, Cookie Policy (tx.sid, local storage keys), Dimensional weight divisor 5000 [confirm] (+21 more)

### Community 11 - "Blender 3D Model Scripts"
Cohesion: 0.08
Nodes (36): activate(), arc_band(), box(), decal(), disc(), ellipsoid(), empty(), finish() (+28 more)

### Community 12 - "Dispatch Board Logic"
Cohesion: 0.07
Nodes (47): app, call(), createJob(), HASH, NOW, now0, place(), server (+39 more)

### Community 13 - "AdminLogin.tsx"
Cohesion: 0.19
Nodes (21): AdminLogin(), AdminLoginProps, AuthCard(), AuthError(), ForgotPassword(), LANG_NAMES, readResetToken(), ResetPassword() (+13 more)

### Community 14 - "Permissions & Super Admin"
Cohesion: 0.06
Nodes (59): ask(), askNewPassword(), confirm(), isTTY, lines, main(), rl, rlInternal (+51 more)

### Community 15 - "Couriers & Users Routes"
Cohesion: 0.06
Nodes (49): loadUserPermissions(), canGrant(), canManageUser(), countOtherActiveSuperAdmins(), generateTempPassword(), holdsSuperAdminRole(), isAllPowerful(), lockedRoleIds() (+41 more)

### Community 16 - "orders.ts"
Cohesion: 0.09
Nodes (31): shopBrowseLimiter, shopOrderLimiter, publicShopRouter, confirmationQueued(), CartCheck, CartLineInput, checkCart(), CheckedLine (+23 more)

### Community 17 - "shopMedia.test.ts"
Cohesion: 0.09
Nodes (42): app, as(), call(), cookies, goodFiles(), HASH, img(), now0 (+34 more)

### Community 18 - "French Site Content"
Cohesion: 0.07
Nodes (39): §8.5 Aide : livraison locale et paiements, §10.3 Application livreur, §2.1 Bandeau principal, §8.2 Aide : base de connaissances, §16 Carrières et Politique RSE, §8 Centre d'aide et Contact, §3.3 Comment ça marche (4 étapes), §3.2 Comparer (tableau des services) (+31 more)

### Community 19 - "lucide-react"
Cohesion: 0.08
Nodes (40): lucide-react, JourneyMap(), markerRoleText(), positionAt(), RoutePoint, splitRouteAt(), PaymentMethodCard(), Field (+32 more)

### Community 20 - "Blog API Routes"
Cohesion: 0.07
Nodes (33): cleanTags(), slugTaken(), uniqueSlug(), ADMIN_PAGE_SIZE, ALT_MAX, ANY_POST_ACCESS, BLOG_IMAGE_TYPES, blogAdminRouter (+25 more)

### Community 21 - "render/pageMeta.ts"
Cohesion: 0.08
Nodes (44): blogRender(), POST_META, render(), TEMPLATE, absolute(), BLOG_NAME, blogFeedPath(), blogHead() (+36 more)

### Community 22 - "Dispatch Job Drawer"
Cohesion: 0.14
Nodes (25): ConfirmedJobInput, JobInput, ProfileInput, boardApi, BoardCity, BoardCourier, BoardZone, DispatchJob (+17 more)

### Community 23 - "Blog Rendering"
Cohesion: 0.06
Nodes (34): ATTACKS, render(), BLOG_MEDIA_PREFIX, BLOG_MEDIA_SRC, CALLOUT_TONES, countWords(), DocCheck, EMPTY_DOC (+26 more)

### Community 24 - "orderAdmin.ts"
Cohesion: 0.11
Nodes (45): audit(), inTransaction(), shopSettings(), addOrderNote(), canSetFee(), changeOrderStatus(), DispatchPlan, isInt() (+37 more)

### Community 25 - "Dispatch Status Machine"
Cohesion: 0.06
Nodes (41): ACTIONS, ACTORS, EXPECTED, FROMS, FULL_INPUT, RATES, tmpDir, BEFORE_PICKUP (+33 more)

### Community 26 - "App Shell"
Cohesion: 0.05
Nodes (72): react-dom, AboutPage, AdminApp, AdminLogin, App(), BlogPage, BlogPostPage, CareersPage (+64 more)

### Community 27 - "Stage.ts"
Cohesion: 0.08
Nodes (35): isMotionPaused(), gate(), IdleClock, idleGlow(), latePhase(), riseIn(), bandFrame(), COLORS (+27 more)

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
Cohesion: 0.09
Nodes (39): CategoryRow, ProductRow, NOT_FOUND, PAGE, resolveShopPage(), ShopPageResult, altOf(), categoryImage() (+31 more)

### Community 32 - "Dispatch Spec"
Cohesion: 0.10
Nodes (32): After launch: backups, retention, monitoring, security, docs/DISPATCH_SPEC.md, Dispatch board problem and suggestion rules, cash_ledger table (TX-CSH-), COD collection and 7-day cash handover, Company MTN MoMo / Orange Money payments, Courier (rider/driver) role, courier_locations table (+24 more)

### Community 33 - "PaymentsView.tsx"
Cohesion: 0.09
Nodes (34): ids, NewProofsPanel(), NewProofsPanelProps, NEW_PROOFS_PANEL_TEXT, formatProofReceived(), proofAmountMismatch(), ProofFacts(), proofMethodView() (+26 more)

### Community 34 - "Home Page"
Cohesion: 0.12
Nodes (33): largest(), ResponsiveImage(), ResponsiveImageProps, srcSet(), SITE_IMAGES, SiteImageInfo, SiteImageName, AboutPage() (+25 more)

### Community 35 - "AdminApp.tsx"
Cohesion: 0.07
Nodes (43): AdminApp(), AdminAppProps, AdminConsole(), BlogPreview, blogPreviewToken(), BlogStudio, CashView, CouriersView (+35 more)

### Community 36 - "Project Tracker: Launch & Owner Items"
Cohesion: 0.07
Nodes (44): docs/CONTENT_FR.md, FIELD_TEST_G9, E.1 Homepage journey layout, E.2 Services page, E.3 About and Network pages, E.4 Contact, Help, Legal, E.5 Track, Quote and Ship pages, E.6 Payments localisation (MoMo, Orange Money, XAF) (+36 more)

### Community 37 - "stage.test.ts"
Cohesion: 0.11
Nodes (36): Prim, TRADE_LANES, LatePhase, cityDistance(), CityPhase, cityPhase(), heroDistance(), HeroPhase (+28 more)

### Community 38 - "routingEngine.ts"
Cohesion: 0.07
Nodes (55): HONG_KONG, HOUSTON, LAGOS, LONDON, LOS_ANGELES, MANCHESTER, milesBetween(), NEW_YORK (+47 more)

### Community 39 - "Brand Image Pipeline"
Cohesion: 0.08
Nodes (32): TanEx logo and derived assets, TanEx logo.png, Managing Director portrait (about-md), Owner-supplied TanEx files, BRAND_OUT, buildBrand(), buildIcons(), buildPhotos() (+24 more)

### Community 40 - "routes/auth.ts"
Cohesion: 0.08
Nodes (43): consumeResetToken(), createResetToken(), findResetUser(), findValidToken(), hashResetToken(), RESET_REQUESTS_PER_HOUR, RESET_TOKEN_TTL_MS, ResetUser (+35 more)

### Community 41 - "shopOrderStatus.ts"
Cohesion: 0.05
Nodes (46): delivery, pickup, SHOP_TABLES, checkOrderTransition(), DELIVERY_FEE_STATUSES, DELIVERY_METHODS, FINAL_ORDER_STATUSES, hasText() (+38 more)

### Community 42 - "three"
Cohesion: 0.15
Nodes (14): three, ASSETS, BIKE_MODEL_URL, gltfExtensions(), loadGltf(), StageAsset, TRUCK_MODEL_URL, BIKE_COLORS (+6 more)

### Community 43 - "Payment Methods & Validation"
Cohesion: 0.22
Nodes (23): DetailsValidation, PAYMENT_METHOD_TYPES, PAYMENT_METHODS, PaymentFieldKind, PaymentGroup, PaymentMethodDefinition, validateField(), validatePaymentDetails() (+15 more)

### Community 44 - "shopAdmin.ts"
Cohesion: 0.09
Nodes (28): Fail, fail(), handle(), handleOrder(), me(), MEDIA_ACCESS, noStore(), notFound() (+20 more)

### Community 45 - "Public Blog & RSS"
Cohesion: 0.09
Nodes (46): avatarUrl(), FEED_SIZE, MIME, rssXml(), blogSitemapEntries(), categoryVersions(), listPage(), postVersions() (+38 more)

### Community 46 - "Stage Rendering Loop"
Cohesion: 0.10
Nodes (11): loadAssets(), readyChapters(), CameraView, LateView, Focus, mapTexture(), PhoneMap, screenFrame() (+3 more)

### Community 47 - "server/index.ts"
Cohesion: 0.06
Nodes (41): startApp(), dir, entries, registerApiRoutes(), resolveSessionSecret(), SESSION_SECRET_FILE, isAllowedOrigin(), dataDir (+33 more)

### Community 48 - "OperationsCenter.tsx"
Cohesion: 0.13
Nodes (22): DeleteShipmentModal(), EditShipmentModal(), RecentlyDeletedModal(), RecentlyDeletedModalProps, ShipmentImagesPanel(), AllShipmentsView(), STATUS_CHIP, OperationsCenter() (+14 more)

### Community 49 - "Tariffs Console"
Cohesion: 0.08
Nodes (46): app, call(), HASH, now0, server, signIn(), tmpDir, PinPicker() (+38 more)

### Community 50 - "Courier Offline Queue"
Cohesion: 0.09
Nodes (20): courierUrls, sendRaw(), AppliedListener, cachePut(), CourierSync, isRetryable(), Listener, loadItems() (+12 more)

### Community 51 - "Tracker: Decisions & Dispatch"
Cohesion: 0.06
Nodes (36): Audit log (audit()/audited()), B.1 IAM schema, seeded roles, Super Admin bootstrap, B.2 SQLite session store and auth routes, B.3 Route permissions (requirePermission everywhere), B.4 Console auth (AuthContext, forced password change), B.5 Users, Roles and Audit log screens, B.6 Email foundation and password reset, B.7 TOTP 2FA (optional, after launch) (+28 more)

### Community 52 - "fetchApi"
Cohesion: 0.20
Nodes (15): call(), send(), send(), send(), fetchShopOrdersSummary(), call(), getJson(), fetchApi() (+7 more)

### Community 53 - "HomeNetworkMap.tsx"
Cohesion: 0.13
Nodes (25): leaflet, DispatchMap(), esc(), MapCourier, MapRoute, OVERVIEW, OVERVIEW, DISPATCH_TEXT (+17 more)

### Community 54 - "3D Hero Globe"
Cohesion: 0.09
Nodes (20): TANEX_LOCATIONS, HeroScene, WorldScene, ARC_HUBS, arcCurve(), BUEA, buildGlobe(), COLORS (+12 more)

### Community 55 - "api.ts"
Cohesion: 0.08
Nodes (49): SEP_28_2026_1400_UTC, EventTime, eventTime(), deviceLabel(), displayIp(), MySessions(), AuditLogView(), dayStart() (+41 more)

### Community 56 - "Public Local Tracking"
Cohesion: 0.14
Nodes (26): CityRow, CourierRow, point(), publicCourierPhoto(), publicLocalDelivery(), shipmentJob(), ZoneRow, readStoredDispatchSettings() (+18 more)

### Community 57 - "Cash Console"
Cohesion: 0.18
Nodes (22): cashApi, CashBalance, CashCourier, CashEntry, CashOverview, CashReport, reportCsvUrl(), AdjustDialog() (+14 more)

### Community 58 - "Content: Console & Tracking Copy"
Cohesion: 0.11
Nodes (25): 3.4 Add-ons (Express, COD, delivery code, packing), 10 Admin console strings, 2.3 Bike delivery section, 10.4 Blog studio and author profile, Cash & Mobile Money ledger (G.8), Cash on delivery, 10.3 Courier app strings, Courier assignment suggestion (on duty, same city, right vehicle, nearest) (+17 more)

### Community 59 - "Cash Report Logic"
Cohesion: 0.12
Nodes (23): balancesFromLines(), CourierBalance, courierCashSummary(), LedgerRow, readCashLines(), toCashLine(), HANDOVER_DEADLINE_DAYS, HANDOVER_METHODS (+15 more)

### Community 60 - "dependencies"
Cohesion: 0.08
Nodes (24): dependencies, express@^5.2.1, express-rate-limit@^8.7.0, express-session@^1.19.0, helmet@^8.3.0, jsbarcode@^3.11.6, leaflet@^1.9.4, lenis@^1.3.27 (+16 more)

### Community 61 - "i18n.test.ts"
Cohesion: 0.12
Nodes (17): app, leaves(), PAIRS, SAME_IN_BOTH, server, tmpDir, Tree, addErrorCodes() (+9 more)

### Community 62 - "jobLogic.ts"
Cohesion: 0.18
Nodes (16): CashBalance, CashEntry, CashInput, courierApi, CourierJob, CourierPlace, CourierProfile, RawResult (+8 more)

### Community 63 - "ProductEditor.tsx"
Cohesion: 0.09
Nodes (46): CategoriesManager(), CategoryDialog(), EditorPicture, PictureManager(), changes(), EMPTY_DOC, Form, formFrom() (+38 more)

### Community 64 - "capabilities.ts"
Cohesion: 0.20
Nodes (19): canAnimate(), canSmoothScroll(), matches(), pauseListeners, prefersReducedMotion(), saveData(), setMotionPaused(), subscribeMotionPaused() (+11 more)

### Community 65 - "package.json"
Cohesion: 0.09
Nodes (22): compression@^1.8.2, gsap@^3.15.1, http-proxy-middleware@^3.0.7, sanitize-html@^2.18.2, @types/compression@^1.8.1, @types/cors@^2.8.19, @types/leaflet@^1.9.22, @types/qrcode@^1.5.6 (+14 more)

### Community 66 - "TipTap Editor Dependencies"
Cohesion: 0.09
Nodes (22): @tiptap/core@^3.33.1, @tiptap/extension-image@^3.33.1, @tiptap/extension-link@^3.33.1, @tiptap/extension-table@^3.33.1, @tiptap/extensions@^3.33.1, @tiptap/pm@^3.33.1, @tiptap/starter-kit@^3.33.1, @tiptap/core (+14 more)

### Community 67 - "Tanex Master Plan"
Cohesion: 0.12
Nodes (20): Console at /private-user/ (ADMIN_PATH), Tech stack (React/Vite/Express/node:sqlite), Part 1: Booking at /fr/livraison-locale, Part 5: Failed attempt, G.9 Field test: Buea end-to-end delivery, Part 8: Finance confirmation and daily CSV, Finding report format and severity (Blocker/Major/Minor/Idea), Part 4: On the way and live map (+12 more)

### Community 68 - "Design Direction Mocks"
Cohesion: 0.12
Nodes (20): Camera use per chapter, Approval decisions and open items, Components (buttons, track field, chips, cards) light/dark, Homepage mock frames (desktop iframe + phone), Journey storyboard (9 key frames, chapters 0-8), TanEx Design Direction (C.1, approved 7 Nov 2026), design/tx.css + sprite.js (shared mock assets), Type system (Plus Jakarta Sans 800 + italic word, Inter, JetBrains Mono) (+12 more)

### Community 69 - "IamDialog"
Cohesion: 0.12
Nodes (25): IamDialog(), copyText(), TempPasswordDialog(), Draft, Notice, NoticeLine(), RolesView(), sameKeys() (+17 more)

### Community 70 - "Dispatch Jobs Tests"
Cohesion: 0.12
Nodes (15): act(), addCourier(), addUser(), app, call(), createJob(), HASH, json() (+7 more)

### Community 71 - "3D Hero & Door"
Cohesion: 0.09
Nodes (27): ArrivalScene, DOOR_METRES, DOOR_REACH, DOOR_VIEW, IDLE_SECONDS, LateShares, PARK_METRES, PARK_REACH (+19 more)

### Community 72 - "3D Label & Parcel"
Cohesion: 0.15
Nodes (12): code128B(), PATTERNS, buildParcel(), COLORS, LABEL_CENTRE, LABEL_SIZE, labelMaterial(), Parcel (+4 more)

### Community 73 - "PaymentRequestEditor.tsx"
Cohesion: 0.07
Nodes (48): btc, paypal, AccountEditor, accountSummary(), blankDetails(), draftFromPayment(), draftToRequest(), emptyPaymentDraft() (+40 more)

### Community 74 - "Smooth Scroll & Route Rail"
Cohesion: 0.31
Nodes (9): useJourneyChapter(), headerOffset(), scrollToSection(), barPercent(), chapterNumbers(), RailChapter, railPosition(), RouteRail() (+1 more)

### Community 75 - "Courier App Shell"
Cohesion: 0.14
Nodes (25): CourierLang, CourierTextContext, ACTIVE, alertNewJob(), CourierApp(), CourierRoot(), CourierShell(), readSeen() (+17 more)

### Community 76 - "SettingsView.tsx"
Cohesion: 0.15
Nodes (20): EmailSettingsPanel(), OutboxTable(), STATUS_CHIP, when(), EmailSettingsPanel, SettingsView(), usePermission(), MAIL_TEXT (+12 more)

### Community 77 - "TanEx Project Tracker"
Cohesion: 0.09
Nodes (25): BRAND_GUIDE, DEPLOYMENT, TanEx Project Tracker, A.2 Brand config (brand.ts, references, XAF), A.3 Logo and icons, A.4 Previous-brand sweep, C.1 Design direction (design/direction.html), C.2 --tx-* tokens with --ngf-* aliases (+17 more)

### Community 78 - "SmoothScroll.tsx"
Cohesion: 0.23
Nodes (11): lenis, whenIdle(), loadedGsap(), loadGsap(), GsapKit, keepNative(), SmoothScroll(), GsapSetup (+3 more)

### Community 79 - "3D Model Brief"
Cohesion: 0.13
Nodes (15): tanex_bike model (bike + rider + top box), Blender blockout scripts (build_tanex_bike.py / build_tanex_truck.py), 3D colour specification (brand palette), Deliverables (.blend + .glb, textures, renders), Milestones M1-M3 and acceptance check, phone_screen 'screen' material (live map), Named pivot hierarchy (front_wheel, handlebar, rider_torso, box_lid, parcel_socket), TanEx 3D Model Brief and RFQ (+7 more)

### Community 80 - "Payments Update Spec"
Cohesion: 0.18
Nodes (12): Dashboard notifications (badge, bell, toast, ngf_seen_proofs), Files & storage requirements (UPLOADS_DIR, magic bytes), Prompt: Package Images, Payment Methods & Proof of Payment, Proof submission rules (POST /api/track/:id/payment-proof), Workflow per task and report back, Public GET /media/:id route, Payment method registry src/shared/paymentMethods.ts, payment_proofs table and review flow (+4 more)

### Community 81 - "trackingId.ts"
Cohesion: 0.10
Nodes (24): logNotification(), NotificationLogInput, NotificationLogRow, readNotificationLog(), latestPublicProof(), maskSignerName(), trackRouter, generateUniqueTrackingId() (+16 more)

### Community 82 - "catalog.ts"
Cohesion: 0.12
Nodes (37): applyProductInput(), bad(), CategoryInput, categorySlugTaken(), checkCategoryImage(), checkParent(), COLUMN, createCategory() (+29 more)

### Community 83 - "Content: Home & Blog Copy"
Cohesion: 0.12
Nodes (19): docs/BLOG_SPEC.md, 15 Blog pages, 2.7 Get in touch, 2.5 Global network section, 2.1 Hero (From your door to the world), 2.8 Home FAQ, 2 Home page (owner's outline), 2.10 The Journey: chapter beats and route rail (+11 more)

### Community 84 - "Tracker: Journey Phase"
Cohesion: 0.13
Nodes (17): Route rail (RouteRail.tsx, travelling bike icon), H.0 3D brief for the artist, H.1 Motion foundation (GSAP, Lenis, JourneyController), H.2 The Stage (WebGL canvas) and bike, H.3 Chapters 0-1: hero globe and services road, H.4 Chapters 2-3: in town and city to city truck, H.5 Chapters 4-8: world, label, arrival, H.6 Final glTF models and posters (+9 more)

### Community 85 - "shipmentStatusLabel"
Cohesion: 0.06
Nodes (55): DeleteShipmentModalProps, EditShipmentModalProps, ControlAction, ShipmentControlModal(), ShipmentControlModalProps, STANDARD_HUBS, PendingImage, ShipmentImagesPanelProps (+47 more)

### Community 86 - "TypeScript Config"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+9 more)

### Community 87 - "localPricing.ts"
Cohesion: 0.13
Nodes (28): priceJob(), createPodDocument(), newPodId(), PodDetails, dispatchBlockers(), orderDeliveryFee(), IntercityRate, intercityRateFromRow() (+20 more)

### Community 88 - "LocationsPage.tsx"
Cohesion: 0.14
Nodes (23): NetworkMapPanel(), useCountryName(), PageHero(), formatGatewayTime(), gatewayName(), GatewayRegion, GATEWAYS, getGateway() (+15 more)

### Community 89 - "sheets.tsx"
Cohesion: 0.17
Nodes (28): CashScreen(), EMPTY, CourierKey, CourierT, useCourierText(), CashMethod, CashState, JobDetail() (+20 more)

### Community 90 - "Journey Scroll Store"
Cohesion: 0.18
Nodes (11): beatOf(), BEATS, clamp01(), headerOffset(), PIN_VH, setBeat(), setupJourney(), STEPS (+3 more)

### Community 91 - "Brand Guide"
Cohesion: 0.11
Nodes (14): BRAND_COLORS in brand.ts, TanEx Brand Guide & Design System, Name usage (TanEx vs Tanex SARL), Palette (Chocolate, Cream, Orange #F48800), Positioning pillars (Door to world, Live visibility, Accountable hands, Local roots), Reference formats (TX-TKT, TX-INV, TX-SL, TX-CSH, QR-YYYY), Secondary slogan: Saving Situations, Tagline: From Your Door to the World (+6 more)

### Community 92 - "Motion & 3D Spec"
Cohesion: 0.18
Nodes (14): TanEx bike + rider model (tanex-bike.glb), capabilities.ts (canAnimate / canUseStage), Journey chapters 0-8, Globe (stage/globe.ts, Natural Earth dots), GSAP (ScrollTrigger, SplitText, CustomEase), Lenis smooth scroll, Motion & 3D Specification: The Journey, Pause motion control (tx_motion_paused) (+6 more)

### Community 93 - "Tracker: Shop Phase M"
Cohesion: 0.13
Nodes (14): Courier offlineQueue.ts (IndexedDB), G.4 Courier app (PWA, offline queue), #140 Marketplace button, #164 Delivery code rules, #183 Shop order retention (10y / 2y), M.0 Shop spec and Returns & Refunds draft, M.1 Shop schema and permissions, M.2 Square picture pipeline (+6 more)

### Community 94 - "§13 Mentions légales"
Cohesion: 0.15
Nodes (15): Accessibilité (WCAG 2.2 AA), Codes d'erreur (BAD_REQUEST, INVALID_TRACKING_ID, RATE_LIMITED...), Conditions d'expédition, Conditions d'utilisation, Engagements (4) du pied de page, §1.2 En-tête et navigation, §1 Global : métadonnées, en-tête, pied de page, §1.4 Langue, messages communs et erreurs (+7 more)

### Community 95 - "ref_node_fs"
Cohesion: 0.07
Nodes (18): doc, app, call(), HASH, now, server, signIn(), tmpDir (+10 more)

### Community 96 - "shopApi.ts"
Cohesion: 0.15
Nodes (30): OrderRow, SyncOrderRow, when(), OrderList(), orderStatusChip(), paymentChip(), TABS, ActionDialog() (+22 more)

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
Cohesion: 0.05
Nodes (64): Button, ButtonAsButton, ButtonAsLink, buttonClass(), ButtonProps, ButtonSize, ButtonVariant, CommonProps (+56 more)

### Community 104 - "en.ts"
Cohesion: 0.18
Nodes (11): AREA_LOADERS_EN, AreaMessages, en, localDelivery, LocalDeliveryMessages, shop, ShopMessages, track (+3 more)

### Community 105 - "geocodingService.ts"
Cohesion: 0.14
Nodes (24): NetworkMapLabels, TransportMode, getRoutingHub(), ROUTING_HUBS, RoutingHub, AddressQuery, fold(), gatewayToLocation() (+16 more)

### Community 106 - "JobDrawer.tsx"
Cohesion: 0.14
Nodes (28): boardErrorText(), AssignDialog(), boardJobMessages(), CancelDialog(), DialogError(), Field(), JobDrawer(), LiftCodeDialog() (+20 more)

### Community 107 - "imageCompress.ts"
Cohesion: 0.27
Nodes (12): errorText(), prepareAndUpload(), AuthorProfile(), initialsOf(), blobToBase64(), canvasToBlob(), compressImage(), CompressOptions (+4 more)

### Community 108 - "ref_node_assert"
Cohesion: 0.11
Nodes (10): dir, LUCIDE_FALLBACKS, JPEG, PNG, tmp, WEBP, browserLocalStorage(), KeyStore (+2 more)

### Community 109 - "CouriersView.tsx"
Cohesion: 0.16
Nodes (19): CourierAvatar(), CourierEditor(), CouriersView(), initials(), Notice, NoticeLine(), preparePhoto(), Courier (+11 more)

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
Cohesion: 0.06
Nodes (50): ADMIN_APP_TEXT_EN, ADMIN_LAYOUT_TEXT_EN, ViewMeta, BLOG_MENU_EN, BLOG_TEXT_EN, CASH_TEXT_EN, DELETE_SHIPMENT_MODAL_TEXT, DELETE_SHIPMENT_MODAL_TEXT_EN (+42 more)

### Community 115 - "blogPages.test.ts"
Cohesion: 0.11
Nodes (15): Shop SEO and Product JSON-LD, app, conn, indexPath, now, render, server, blogFeedsRouter() (+7 more)

### Community 116 - "shopSettings.ts"
Cohesion: 0.22
Nodes (11): isShopPaymentMethod(), SHOP_PAYMENT_METHODS, DEFAULT_SHOP_SETTINGS, idOrNull(), isIntIn(), LANDMARK_MAX, LOW_STOCK_MAX, MAX_PER_ORDER_MAX (+3 more)

### Community 117 - "I18N Spec"
Cohesion: 0.25
Nodes (8): Stable API error codes mapped by the client, Intl formatting format.ts (en-CM / fr-CM, XAF 0 decimals), Languages, Routing & Page Meta Specification (EN/FR), Server page meta injection server/render/pageMeta.ts, Route table src/router/routes.ts, Bilingual sitemap with hreflang alternates, Tracking event title_key / title_vars_json, EN/FR URL scheme (/ and /fr/)

### Community 118 - "SQLite Session Store"
Cohesion: 0.13
Nodes (8): Callback, COURIER_SESSION_MS, createSessionMiddleware(), expiryOf(), express-session, SessionData, SqliteSessionStore, STAFF_SESSION_MS

### Community 119 - "build-globe-dots.mjs"
Cohesion: 0.17
Nodes (8): bits, cameroon, cameroonFeature, cm, data, iso(), land, OUT

### Community 120 - "react"
Cohesion: 0.20
Nodes (15): react, GalleryImage, PackageGallery(), PackageGalleryProps, PackageImageViewer, PackageImageViewer(), PackageImageViewerProps, GalleryViewer() (+7 more)

### Community 121 - "Deployment Guide"
Cohesion: 0.22
Nodes (9): Deployment: GitHub to Hostinger, Domain and paths (apex, /private-user/ noindex), Email DNS (MX, SPF, DKIM, DMARC), email_outbox queue with retries, Environment variables (SESSION_SECRET, DB_PATH, UPLOADS_DIR, SMTP_*), Hosting requirements (Node >= 22.5, persistent storage, HTTPS, Hostinger Email), Hostinger app configuration (npm install, npm start), Persistence check (/api/diag/storage) (+1 more)

### Community 122 - "roles.ts"
Cohesion: 0.13
Nodes (16): CANNOT_GRANT, Fail, fail(), formatRole(), permissionsOf(), permissionsRouter, readRoleInput(), ROLE_DESCRIPTION_MAX (+8 more)

### Community 123 - "App Shell HTML"
Cohesion: 0.20
Nodes (9): Performance budget and motion loading, The Journey (3D scroll story with TanEx bike), index.html app shell, src/main.tsx entry, Organization JSON-LD structured data, tx:head per-page meta markers, Phase A: Separation & rebrand foundation, A2: Brand config, IDs and metadata (+1 more)

### Community 124 - "npm Scripts"
Cohesion: 0.20
Nodes (10): scripts, build, create-super-admin, dev, dev:vite, postinstall, preview, server (+2 more)

### Community 125 - "Dev Dependencies"
Cohesion: 0.22
Nodes (9): devDependencies, concurrently@^10.0.5, gltfpack@^1.3.0, sharp@^0.35.4, tsx@^4.23.12, concurrently, gltfpack, sharp (+1 more)

### Community 126 - "AdminDataContext.tsx"
Cohesion: 0.08
Nodes (42): DocumentCenterView(), DocumentCenterViewProps, loadPdfTools(), waitForImagesToLoad(), place(), PodDetails, PodPaper, readDetails() (+34 more)

### Community 127 - "RichEditor.tsx"
Cohesion: 0.26
Nodes (11): DocNode, blogExtensions(), safeHref(), ImageDialog(), LinkDialog(), RichEditor(), RichEditorProps, Toolbar() (+3 more)

### Community 128 - "blog.test.ts"
Cohesion: 0.19
Nodes (11): app, as(), call(), cookies, createPost(), doc(), HASH, now0 (+3 more)

### Community 129 - "Stock Image Sources"
Cohesion: 0.50
Nodes (5): Free CC0 images sources (retired), Free Pexels images sources (retired), locations-hero stock photo (console sign-in background until I.1), Free stock photos sources (retired), Unsplash hero photos sources (retired)

### Community 131 - "Vite Build"
Cohesion: 0.40
Nodes (4): vite@^6.1.0, @vitejs/plugin-react@^4.3.4, vite, @vitejs/plugin-react

### Community 133 - "Self-hosted Fonts"
Cohesion: 0.40
Nodes (5): Inter font licence (SIL OFL 1.1), JetBrains Mono font licence (SIL OFL 1.1), Plus Jakarta Sans font licence (SIL OFL 1.1), Brand fonts (self-hosted) README, Self-hosted WOFF2 Latin/Latin-ext subsets from @fontsource v5

### Community 134 - "I18nProvider.tsx"
Cohesion: 0.07
Nodes (51): ErrorBoundaryProps, ErrorBoundaryState, fallbackLocale(), isRecoverableByReload(), reloadOnce(), LanguageSuggestion(), prefersFrench(), OPENING_HOURS (+43 more)

### Community 135 - "passwordReset.test.ts"
Cohesion: 0.16
Nodes (12): app, call(), forgot(), HASH, logged, reset(), sent, server (+4 more)

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

### Community 141 - "shopOrdersAdmin.test.ts"
Cohesion: 0.15
Nodes (12): api(), app, as(), cookies, HASH, now0, orderRow(), placeOrder() (+4 more)

### Community 142 - "cashLedger.test.ts"
Cohesion: 0.16
Nodes (11): act(), addCourier(), addUser(), app, call(), HASH, now0, PNG (+3 more)

### Community 143 - "Prompts: IAM Phase"
Cohesion: 0.67
Nodes (3): audit() / audit_log, Phase B: Identity & access (IAM/RBAC), SQLite session store (tx.sid cookie)

### Community 144 - "localDelivery.test.ts"
Cohesion: 0.19
Nodes (8): app, book(), booking(), call(), now0, server, tmpDir, track()

### Community 145 - "Courier app (src/courier/)"
Cohesion: 0.25
Nodes (8): Courier app UI rules (56px buttons, one-handed), UI details (grid, radius, elevation, motifs, focus), Uploads folder (images, proofs, blog, pod, couriers), Courier app (src/courier/), Courier location sharing during active jobs, Courier offline action queue (IndexedDB, idempotency), Proof of delivery (POD) and delivery code, Order idempotency key and abuse protection

### Community 146 - "routeGuards.test.ts"
Cohesion: 0.13
Nodes (10): app, HASH, MOUNTS, now, PUBLIC, RouteDef, ROUTES, server (+2 more)

### Community 147 - "ServicesPage.tsx"
Cohesion: 0.18
Nodes (13): Em(), SectionHeader(), ADDONS, COMPARE_ROWS, HIGHLIGHTS, ItemKey, prefersReducedMotion(), serviceElementId() (+5 more)

### Community 148 - "JourneyController.tsx"
Cohesion: 0.19
Nodes (12): afterLoadIdle(), canUseStage(), INITIAL, initialState(), JourneyContext, JourneyControllerProps, JourneyModule, JourneyState (+4 more)

### Community 149 - "ConsoleLanguage.tsx"
Cohesion: 0.22
Nodes (13): compare(), SRC, ConsoleLangContext, ConsoleLanguage(), ConsoleLangValue, ConsoleLang, isConsoleLangReady(), loadConsoleLang() (+5 more)

### Community 150 - "shopCatalog.test.ts"
Cohesion: 0.15
Nodes (9): app, as(), call(), COMPLETE, cookies, HASH, now0, server (+1 more)

### Community 151 - "PaymentIcon.tsx"
Cohesion: 0.40
Nodes (4): PAYMENT_ICON_PATHS, FALLBACKS, ICON_COLORS, PaymentIconProps

### Community 152 - "multipart.ts"
Cohesion: 0.24
Nodes (10): malformed, MultipartBody, multipartBoundary(), MultipartFile, MultipartLimits, MultipartResult, parseMultipart(), readBody() (+2 more)

### Community 153 - "mail.test.ts"
Cohesion: 0.17
Nodes (9): bcryptjs@^3.0.3, bcryptjs, app, call(), HASH, sent, server, signIn() (+1 more)

### Community 155 - "auth.test.ts"
Cohesion: 0.17
Nodes (7): DB_FILE, HASH, login(), openApps, sidCookie(), TestApp, tmpDir

### Community 165 - "permissions.test.ts"
Cohesion: 0.17
Nodes (11): app, call(), cookieFor(), cookies, HASH, now, PermissionKey, Probe (+3 more)

### Community 166 - "fr/payment.ts"
Cohesion: 0.50
Nodes (3): payment, PaymentMessages, payment

### Community 167 - "fr/ship.ts"
Cohesion: 0.50
Nodes (3): ship, ShipMessages, ship

### Community 168 - "shopEmails.test.ts"
Cohesion: 0.15
Nodes (4): app, sent, server, tmpDir

### Community 169 - "courierApp.test.ts"
Cohesion: 0.18
Nodes (8): app, baseJob, call(), HASH, now0, server, signIn(), tmpDir

### Community 171 - "shopOrders.test.ts"
Cohesion: 0.17
Nodes (6): app, indexPath, render, server, SHOP_ON, tmpDir

### Community 172 - "users.test.ts"
Cohesion: 0.18
Nodes (8): app, call(), HASH, now0, PEOPLE_KEYS, server, signIn(), tmpDir

### Community 174 - "imageSize.ts"
Cohesion: 0.31
Nodes (9): avifSize(), Box, boxes(), ImageSize, jpegSize(), pngSize(), readImageSize(), webpSize() (+1 more)

### Community 175 - "preview.ts"
Cohesion: 0.38
Nodes (6): createPreviewToken(), key, PREVIEW_TTL_MS, readPreviewToken(), setPreviewSecret(), sign()

### Community 176 - "JobDetail.tsx"
Cohesion: 0.19
Nodes (13): JobMap, MESSAGE_LABEL, PlaceCard(), mapsLink(), telLink(), whatsAppLink(), LocationCard(), distanceM() (+5 more)

### Community 177 - "references.ts"
Cohesion: 0.32
Nodes (6): REFERENCE_PREFIX, isReferenceOf(), REFERENCE_PATTERN, REFERENCE_PREFIXES, referenceFor(), ReferenceKind

### Community 178 - "fr/blog.ts"
Cohesion: 0.50
Nodes (3): blog, BlogMessages, blog

### Community 179 - "fr/legal.ts"
Cohesion: 0.50
Nodes (3): legal, LegalMessages, legal

### Community 180 - "camera.ts"
Cohesion: 0.29
Nodes (4): CAMERA_KEYS, CameraKey, CameraRail, LABEL_VIEW

### Community 181 - "fr/about.ts"
Cohesion: 0.50
Nodes (3): about, AboutMessages, about

### Community 183 - "fr/courier.ts"
Cohesion: 0.50
Nodes (3): courier, CourierMessages, courier

### Community 184 - "fr/trackResult.ts"
Cohesion: 0.50
Nodes (3): trackResult, TrackResultMessages, trackResult

### Community 187 - "fr/company.ts"
Cohesion: 0.50
Nodes (3): company, CompanyMessages, company

### Community 188 - "fr.ts"
Cohesion: 0.21
Nodes (8): AreaName, home, HomeMessages, Messages, AREA_LOADERS_FR, home, localDelivery, Translation

## Knowledge Gaps
- **131 isolated node(s):** `Dimensional weight divisor 5000 [confirm]`, `8.3 Contact page`, `Cookie Policy (tx.sid, local storage keys)`, `1.2 Header navigation (owner's menu)`, `12 Image alt text` (+126 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1410 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **23 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `CreateShipmentView.tsx`, `brand.ts`, `CartPage.tsx`, `blogApi.ts`, `useAreaT`, `I18nProvider.tsx`, `Dispatch Board Logic`, `AdminLogin.tsx`, `shopMedia.test.ts`, `lucide-react`, `JourneyController.tsx`, `ConsoleLanguage.tsx`, `Dispatch Job Drawer`, `PaymentIcon.tsx`, `ServicesPage.tsx`, `App Shell`, `PaymentsView.tsx`, `Home Page`, `AdminApp.tsx`, `OperationsCenter.tsx`, `Tariffs Console`, `JobDetail.tsx`, `HomeNetworkMap.tsx`, `api.ts`, `Cash Console`, `dependencies`, `ProductEditor.tsx`, `capabilities.ts`, `package.json`, `IamDialog`, `PaymentRequestEditor.tsx`, `Smooth Scroll & Route Rail`, `Courier App Shell`, `SettingsView.tsx`, `SmoothScroll.tsx`, `shipmentStatusLabel`, `LocationsPage.tsx`, `sheets.tsx`, `shopApi.ts`, `Glide & Page Progress`, `LocalDeliveryPage.tsx`, `JobDrawer.tsx`, `imageCompress.ts`, `CouriersView.tsx`, `AdminDataContext.tsx`, `RichEditor.tsx`?**
  _High betweenness centrality (0.090) - this node is a cross-community bridge._
- **What connects `Dimensional weight divisor 5000 [confirm]`, `8.3 Contact page`, `Cookie Policy (tx.sid, local storage keys)` to the rest of the system?**
  _131 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `console/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07039187227866474 - nodes in this community are weakly interconnected._
- **Why does `CONTENT.md: TanEx Content Deck (English master)` connect `CONTENT.md: TanEx Content Deck (English master)` to `Project Tracker: Launch & Owner Items`, `TanEx Project Tracker`, `French Site Content`, `Content: Home & Blog Copy`, `Content: Console & Tracking Copy`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Should `API Routes & Middleware` be split into smaller, more focused modules?**
  _Cohesion score 0.04331450094161959 - nodes in this community are weakly interconnected._
- **Why does `Brand placeholders ({{COMPANY}}, {{PHONE}}, {{HOURS}}...)` connect `CONTENT.md: TanEx Content Deck (English master)` to `brand.ts`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Should `CreateShipmentView.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06829896907216494 - nodes in this community are weakly interconnected._