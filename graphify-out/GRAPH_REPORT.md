# Graph Report - Tanex  (2026-11-18)

## Corpus Check
- 517 files · ~588,244 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 106 file(s) not represented in the graph (top: .css 76, .woff2 24, .glb 2)

## Summary
- 4643 nodes · 13194 edges · 185 communities (160 shown, 25 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 143 edges (avg confidence: 0.83)
- Token cost: 1,020,933 input · 0 output

## Graph Freshness
- Built from commit: `9d0d9a18`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- console/index.ts
- API Routes & Middleware
- CreateShipmentView.tsx
- Email Outbox & Templates
- Header.tsx
- routes/auth.ts
- blogApi.ts
- Public Pages & Blog Views
- Dispatch Job Engine
- UI Kit & Services Pages
- ref_node_assert
- Blender 3D Model Scripts
- Dispatch Board Logic
- CouriersView.tsx
- Permissions & Super Admin
- Couriers & Users Routes
- UnitControls.tsx
- shopMedia.test.ts
- French Site Content
- react
- Blog API Routes
- Server Page Meta
- Dispatch Job Drawer
- Blog Rendering
- api.ts
- Dispatch Status Machine
- App Shell
- stage.test.ts
- Shop Spec
- Tariffs Routes
- City-to-City 3D Scene
- ProofViewer.tsx
- Dispatch Spec
- PaymentsView.tsx
- Home Page
- AdminApp.tsx
- Project Tracker: Launch & Owner Items
- Motion Easing Utils
- routingEngine.ts
- Brand Image Pipeline
- outbox.ts
- shopOrderStatus.ts
- three
- Payment Methods & Validation
- Content Deck Overview
- Public Blog & RSS
- Stage Rendering Loop
- uploads.ts
- PaymentSection.tsx
- Tariffs Console
- Courier Offline Queue
- Tracker: Decisions & Dispatch
- Dispatch & Delivery API Client
- LocationsPage.tsx
- 3D Hero Globe
- TrackingEventsView.tsx
- Public Local Tracking
- Cash Console
- Content: Console & Tracking Copy
- Cash Report Logic
- dependencies
- i18n.test.ts
- WhatsApp Job Messages
- ProductEditor.tsx
- capabilities.ts
- package.json
- TipTap Editor Dependencies
- Tanex Master Plan
- Design Direction Mocks
- tariffs.test.ts
- Dispatch Jobs Tests
- 3D Hero & Door
- 3D Label & Parcel
- paymentRequest.ts
- Smooth Scroll & Route Rail
- Courier App Shell
- JobDetail.tsx
- Tracker: Design & Console Phases
- SmoothScroll.tsx
- 3D Model Brief
- Payments Update Spec
- routes/track.ts
- catalog.ts
- Content: Home & Blog Copy
- Tracker: Journey Phase
- shipmentStatusLabel
- TypeScript Config
- Router Route Table
- Legal Pages
- sheets.tsx
- Journey Scroll Store
- Brand Guide
- Motion & 3D Spec
- Tracker: Shop Phase M
- useAuth
- Password Reset Tests
- server/index.ts
- fr/contact.ts
- Project Rules (CLAUDE.md)
- Blog Spec
- IAM & RBAC Spec
- Glide & Page Progress
- Cash API Routes
- LocalDeliveryPage.tsx
- i18n Home & Delivery Copy
- In-Town 3D Scene
- JobDrawer.tsx
- cashLedger.test.ts
- ContactPage.tsx
- runtime.ts
- Server TS Config
- Company Facts & Launch
- Notifications Spec
- Auth Tests
- consoleText.ts
- dispatchBoard.test.ts
- shopSettings.ts
- I18N Spec
- SQLite Session Store
- build-globe-dots.mjs
- context.ts
- Deployment Guide
- Tracker: Routing Phase
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
- brand.ts
- runtime.ts
- i18n Help
- types.ts
- i18n Not Found
- i18n Quote
- i18n Services
- i18n Track
- SettingsView.tsx
- Prompts: IAM Phase
- Phase E: Public Site Rebuild
- Phase B: Identity & Access (IAM/RBAC)
- Shop delivery fee calculation
- permissions.test.ts
- GSAP
- ConsoleLanguage.tsx
- Nodemailer
- PaymentIcon.tsx
- multipart.ts
- description.ts
- chapters/services.ts
- Sanitizer Types
- Prompts Pack Intro
- Prompts: Routing Phase
- Design: City to City
- Design: Smart Label
- Design: Services
- Prompts: Blog Phase
- Prompts: Launch Phase
- Prompts: Utilities
- fr/about.ts
- fr/payment.ts
- fr/ship.ts
- ResponsiveImage.tsx
- compression
- cors
- http-proxy-middleware
- jsbarcode
- qrcode
- @types/leaflet@^1.9.22
- @types/react@^18.3.18
- courierApi.ts
- references.ts
- fr/blog.ts
- fr/legal.ts
- sanitize-html
- @types/compression@^1.8.1
- PaymentRequestEditor.text.ts
- PaymentRequestEditor.tsx

## God Nodes (most connected - your core abstractions)
1. `react` - 143 edges
2. `lucide-react` - 91 edges
3. `useAuth()` - 58 edges
4. `useAreaT()` - 57 edges
5. `MainAppContent()` - 51 edges
6. `renderEmail()` - 49 edges
7. `docs/SHOP_SPEC.md` - 46 edges
8. `ConsoleTextAreas` - 45 edges
9. `express` - 45 edges
10. `useLocale()` - 44 edges

## Surprising Connections (you probably didn't know these)
- `Ch 2 In town (bike delivery, from 500 FCFA)` --references--> `Company facts (single source of truth)`  [INFERRED]
  design/home.html → CLAUDE.md
- `startApp()` --indirect_call--> `requireAuth()`  [INFERRED]
  scripts/auth.test.ts → server/middleware/auth.ts
- `freshDb()` --calls--> `initIamSchema()`  [EXTRACTED]
  scripts/shop.test.ts → server/auth/schema.ts
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

## Communities (185 total, 25 thin omitted)

### Community 0 - "console/index.ts"
Cohesion: 0.07
Nodes (38): ConsoleTranslation, Widen, auth, iam, mail, blog, board, createShipmentView (+30 more)

### Community 1 - "API Routes & Middleware"
Cohesion: 0.04
Nodes (92): express, express-rate-limit, registerApiRoutes(), AuditActor, audited(), FromReq, param(), actorName() (+84 more)

### Community 2 - "CreateShipmentView.tsx"
Cohesion: 0.10
Nodes (50): libphonenumber-js, paymentDraftSummary(), bothUnits(), CreateShipmentView(), PackageItem, ServiceOption, ShipmentTypeOption, documentTitle() (+42 more)

### Community 3 - "Email Outbox & Templates"
Cohesion: 0.11
Nodes (34): escapeHtml(), MailLocale, Paragraph, paragraphHtml(), paragraphText(), RenderedEmail, renderEmail(), Segment (+26 more)

### Community 4 - "Header.tsx"
Cohesion: 0.11
Nodes (31): Footer(), footerColumns(), FooterProps, POWERED_BY, SOCIAL_LINKS, TRUST_ICONS, TRUST_KEYS, hasMenu() (+23 more)

### Community 5 - "routes/auth.ts"
Cohesion: 0.08
Nodes (36): BCRYPT_COST, consumeResetToken(), createResetToken(), findResetUser(), findValidToken(), hashResetToken(), RESET_REQUESTS_PER_HOUR, RESET_TOKEN_TTL_MS (+28 more)

### Community 6 - "blogApi.ts"
Cohesion: 0.09
Nodes (48): blogApi, BlogCategory, BlogCover, BlogLocale, BlogMedia, BlogPost, BlogPostSummary, POST_STATUSES (+40 more)

### Community 7 - "Public Pages & Blog Views"
Cohesion: 0.14
Nodes (31): articleClick(), BlogCard(), BlogCardProps, NetworkMapPanelProps, SpeedLines(), Locale, BlogPage(), BlogPageProps (+23 more)

### Community 8 - "Dispatch Job Engine"
Cohesion: 0.03
Nodes (111): Dispatch API, actionTime(), applyTransition(), CASH_METHODS, CashEntryInput, CashMethod, checkJobShape(), CityRow (+103 more)

### Community 9 - "UI Kit & Services Pages"
Cohesion: 0.10
Nodes (23): PageHero(), PageHeroProps, Em(), SectionHeader(), SectionHeaderProps, CareersPage(), CSR_SECTIONS, CsrPage() (+15 more)

### Community 10 - "ref_node_assert"
Cohesion: 0.03
Nodes (66): bcryptjs@^3.0.3, bcryptjs, doc, app, baseJob, call(), HASH, now0 (+58 more)

### Community 11 - "Blender 3D Model Scripts"
Cohesion: 0.08
Nodes (36): activate(), arc_band(), box(), decal(), disc(), ellipsoid(), empty(), finish() (+28 more)

### Community 12 - "Dispatch Board Logic"
Cohesion: 0.10
Nodes (33): dayKey, initials(), minutesAgo(), placeLine(), when(), BOARD_TEXT, BOARD_TEXT_EN, ACTIVE (+25 more)

### Community 13 - "CouriersView.tsx"
Cohesion: 0.07
Nodes (50): EmailSettingsPanel(), OutboxTable(), STATUS_CHIP, when(), deviceLabel(), displayIp(), MySessions(), copyText() (+42 more)

### Community 14 - "Permissions & Super Admin"
Cohesion: 0.05
Nodes (71): ask(), askNewPassword(), confirm(), isTTY, lines, main(), rl, rlInternal (+63 more)

### Community 15 - "Couriers & Users Routes"
Cohesion: 0.06
Nodes (50): loadUserPermissions(), canGrant(), canManageUser(), countOtherActiveSuperAdmins(), generateTempPassword(), holdsSuperAdminRole(), isAllPowerful(), lockedRoleIds() (+42 more)

### Community 16 - "UnitControls.tsx"
Cohesion: 0.12
Nodes (37): asNumber(), ConvertedNumberInput(), ConvertedNumberInputProps, MeasureInput(), MeasureProps, NumberValue, WeightText(), MultiPieceList() (+29 more)

### Community 17 - "shopMedia.test.ts"
Cohesion: 0.08
Nodes (50): app, as(), call(), cookies, goodFiles(), HASH, img(), now0 (+42 more)

### Community 18 - "French Site Content"
Cohesion: 0.05
Nodes (54): Accessibilité (WCAG 2.2 AA), §8.5 Aide : livraison locale et paiements, §10.3 Application livreur, §2.1 Bandeau principal, §8.2 Aide : base de connaissances, §16 Carrières et Politique RSE, §8 Centre d'aide et Contact, Codes d'erreur (BAD_REQUEST, INVALID_TRACKING_ID, RATE_LIMITED...) (+46 more)

### Community 19 - "react"
Cohesion: 0.08
Nodes (48): lucide-react, react, PendingImage, ShipmentImagesPanelProps, JourneyMap(), JourneyMapProps, markerRoleText(), positionAt() (+40 more)

### Community 20 - "Blog API Routes"
Cohesion: 0.08
Nodes (30): cleanTags(), ADMIN_PAGE_SIZE, ALT_MAX, ANY_POST_ACCESS, BLOG_IMAGE_TYPES, blogAdminRouter, canManageMedia(), canViewPost() (+22 more)

### Community 21 - "Server Page Meta"
Cohesion: 0.07
Nodes (54): blogRender(), POST_META, render(), TEMPLATE, blogFeedsRouter(), FEED_SIZE, MIME, rssXml() (+46 more)

### Community 22 - "Dispatch Job Drawer"
Cohesion: 0.11
Nodes (30): JobInput, ProfileInput, boardApi, BoardCity, BoardCourier, BoardData, BoardZone, DispatchJob (+22 more)

### Community 23 - "Blog Rendering"
Cohesion: 0.08
Nodes (26): ATTACKS, render(), BLOG_MEDIA_PREFIX, BLOG_MEDIA_SRC, CALLOUT_TONES, countWords(), DocCheck, EMPTY_DOC (+18 more)

### Community 24 - "api.ts"
Cohesion: 0.10
Nodes (34): AdminDataContext, AdminDataContextType, INITIAL_ADMIN_DOCUMENTS, INITIAL_QUOTE_REQUESTS, INITIAL_SHIPMENTS, AuditQuery, PaymentProofBody, requestMethods (+26 more)

### Community 25 - "Dispatch Status Machine"
Cohesion: 0.07
Nodes (34): ACTIONS, ACTORS, EXPECTED, FROMS, FULL_INPUT, RATES, tmpDir, pendingActions() (+26 more)

### Community 26 - "App Shell"
Cohesion: 0.10
Nodes (37): AboutPage, AdminApp, AdminLogin, BlogPage, BlogPostPage, CareersPage, consoleKind(), ContactPage (+29 more)

### Community 27 - "stage.test.ts"
Cohesion: 0.07
Nodes (41): Prim, TRACKING_ID_EXAMPLE, CAMERA_KEYS, CameraKey, CameraRail, DOOR_METRES, DOOR_REACH, DOOR_VIEW (+33 more)

### Community 28 - "Shop Spec"
Cohesion: 0.10
Nodes (35): docs/SHOP_SPEC.md, Cart and checkout (/cart, /fr/panier), Footer Legal column (FOOTER_ROWS = 5), Shop features not in version 1, Order number TX-ORD-######, Shop order retention (10 years / 2 years), Shop owner decisions (2026-11-17), Place order transaction (POST /api/shop/orders) (+27 more)

### Community 29 - "Tariffs Routes"
Cohesion: 0.07
Nodes (28): ALIASES_MAX, BANDS_MAX, citiesAll(), cityNameTaken(), cityOut(), CityRow, Fail, fail() (+20 more)

### Community 30 - "City-to-City 3D Scene"
Cohesion: 0.08
Nodes (27): ARRIVE_METRES, canvas(), CARGO_SPOT, CITY_TIMELINE, cityFocus(), CityInput, CityScene, COLORS (+19 more)

### Community 31 - "ProofViewer.tsx"
Cohesion: 0.50
Nodes (3): ProofViewerProps, PROOF_VIEWER_TEXT, PROOF_VIEWER_TEXT_EN

### Community 32 - "Dispatch Spec"
Cohesion: 0.09
Nodes (35): Positioning pillars (Door to world, Live visibility, Accountable hands, Local roots), After launch: backups, retention, monitoring, security, Uploads folder (images, proofs, blog, pod, couriers), docs/DISPATCH_SPEC.md, Dispatch board problem and suggestion rules, cash_ledger table (TX-CSH-), COD collection and 7-day cash handover, Company MTN MoMo / Orange Money payments (+27 more)

### Community 33 - "PaymentsView.tsx"
Cohesion: 0.15
Nodes (28): NewProofsPanel(), NewProofsPanelProps, formatProofReceived(), proofAmountMismatch(), ProofFacts(), proofMethodView(), ProofReviewControls(), ProofReviewControlsProps (+20 more)

### Community 34 - "Home Page"
Cohesion: 0.15
Nodes (28): LOGO_MARK, LOGO_MARK_SIZE, ArrivalDoor(), BikeHero(), HeroGlobe(), JourneySprite(), Mountain(), ParcelLabel() (+20 more)

### Community 35 - "AdminApp.tsx"
Cohesion: 0.05
Nodes (67): AdminApp(), AdminAppProps, AdminConsole(), BlogPreview, blogPreviewToken(), BlogStudio, CashView, CouriersView (+59 more)

### Community 36 - "Project Tracker: Launch & Owner Items"
Cohesion: 0.08
Nodes (36): DEPLOYMENT, A.2 Brand config (brand.ts, references, XAF), A.3 Logo and icons, A.4 Previous-brand sweep, E.1 Homepage journey layout, G.9 Field test in Buea, I.2 Console EN/FR, #101 Vector logo (+28 more)

### Community 37 - "Motion Easing Utils"
Cohesion: 0.15
Nodes (23): LatePhase, CityPhase, cityPhase(), HeroPhase, heroPhase(), InTownPhase, inTownPhase(), LabelPhase (+15 more)

### Community 38 - "routingEngine.ts"
Cohesion: 0.07
Nodes (56): HONG_KONG, HOUSTON, LAGOS, LONDON, LOS_ANGELES, MANCHESTER, milesBetween(), NEW_YORK (+48 more)

### Community 39 - "Brand Image Pipeline"
Cohesion: 0.09
Nodes (29): TanEx logo and derived assets, BRAND_OUT, buildBrand(), buildIcons(), buildPhotos(), CARD_STEP_SIZES, CLEAR, CREAM (+21 more)

### Community 40 - "outbox.ts"
Cohesion: 0.10
Nodes (34): getTransport(), MailConfig, mailConfig(), mailEnabled(), maskEmail(), OutgoingMessage, SendFn, sendMessage() (+26 more)

### Community 41 - "shopOrderStatus.ts"
Cohesion: 0.06
Nodes (38): delivery, freshDb(), pickup, SHOP_TABLES, checkOrderTransition(), checkPaymentChange(), DELIVERY_FEE_STATUSES, DELIVERY_METHODS (+30 more)

### Community 42 - "three"
Cohesion: 0.15
Nodes (14): three, ASSETS, BIKE_MODEL_URL, gltfExtensions(), loadGltf(), StageAsset, TRUCK_MODEL_URL, BIKE_COLORS (+6 more)

### Community 43 - "Payment Methods & Validation"
Cohesion: 0.23
Nodes (22): DetailsValidation, PAYMENT_METHOD_TYPES, PaymentFieldKind, PaymentGroup, PaymentMethodDefinition, validateField(), validatePaymentDetails(), CryptoCoin (+14 more)

### Community 44 - "Content Deck Overview"
Cohesion: 0.08
Nodes (30): CONTENT.md: TanEx Content Deck (English master), 4 About page, 1.4 API error code messages, 16 Careers and CSR Policy, 7-day claims window [confirm], 8.3 Contact page, Cookie Policy (tx.sid, local storage keys), Dimensional weight divisor 5000 [confirm] (+22 more)

### Community 45 - "Public Blog & RSS"
Cohesion: 0.09
Nodes (44): avatarUrl(), blogSitemapEntries(), categoryVersions(), listPage(), postVersions(), publicCount(), resolveBlogPage(), BLOG_LOCALES (+36 more)

### Community 46 - "Stage Rendering Loop"
Cohesion: 0.12
Nodes (7): loadAssets(), readyChapters(), CameraView, Focus, shadowPlane(), Stage, storyTravel()

### Community 47 - "uploads.ts"
Cohesion: 0.06
Nodes (45): dir, entries, SESSION_SECRET_FILE, AVATAR_PREFIX, AVATAR_TYPES, BIO_MAX, checkAvatar(), CheckedAvatar (+37 more)

### Community 48 - "PaymentSection.tsx"
Cohesion: 0.13
Nodes (23): PaymentMethodCard(), Field, FIELD_ORDER, PaymentProofForm(), PaymentProofFormProps, PaymentQr(), PaymentQrProps, formatDueDate() (+15 more)

### Community 49 - "Tariffs Console"
Cohesion: 0.11
Nodes (39): ANY, Cell, CellField, cellKey(), EMPTY, isSymmetricSheet(), mirrorKey(), parseAmount() (+31 more)

### Community 50 - "Courier Offline Queue"
Cohesion: 0.09
Nodes (16): AppliedListener, CourierSync, isRetryable(), Listener, loadItems(), memoryCache, memoryQueue, openDb() (+8 more)

### Community 51 - "Tracker: Decisions & Dispatch"
Cohesion: 0.11
Nodes (23): B.6 Email foundation and password reset, cash_ledger (courier cash, TX-CSH refs), Decisions log, src/shared/dispatchStatus.ts state machine, email_outbox and mail worker, G.10 Native courier app / WhatsApp Cloud API / MoMo API (later), G.1 Dispatch data model, state machine, pricing, G.2 Tariffs and Couriers admin (+15 more)

### Community 52 - "Dispatch & Delivery API Client"
Cohesion: 0.12
Nodes (22): call(), send(), send(), DeliveryCity, DeliveryZone, dispatchApi, IntercityRateRow, PinInput (+14 more)

### Community 53 - "LocationsPage.tsx"
Cohesion: 0.08
Nodes (43): leaflet, formatMessage(), DispatchMap(), esc(), MapCourier, MapRoute, OVERVIEW, OVERVIEW (+35 more)

### Community 54 - "3D Hero Globe"
Cohesion: 0.10
Nodes (27): DEPART_METRES, DOOR_Z, HERO_TIMELINE, HeroFrame, LOGO_AT, ORBIT, REST, ROLL_METRES (+19 more)

### Community 55 - "TrackingEventsView.tsx"
Cohesion: 0.08
Nodes (48): SEP_28_2026_1400_UTC, EVENT_TIME_ZONES, formatLocationStr(), getCurrentTimeStr(), getEventColors(), getEventTheme(), getTodayDateStr(), MESSAGE_TEMPLATES (+40 more)

### Community 56 - "Public Local Tracking"
Cohesion: 0.13
Nodes (28): CityRow, CourierRow, point(), publicCourierPhoto(), publicLocalDelivery(), shipmentJob(), ZoneRow, readStoredDispatchSettings() (+20 more)

### Community 57 - "Cash Console"
Cohesion: 0.19
Nodes (21): cashApi, CashBalance, CashCourier, CashEntry, CashOverview, CashReport, reportCsvUrl(), AdjustDialog() (+13 more)

### Community 58 - "Content: Console & Tracking Copy"
Cohesion: 0.11
Nodes (25): 3.4 Add-ons (Express, COD, delivery code, packing), 10 Admin console strings, 2.3 Bike delivery section, 10.4 Blog studio and author profile, Cash & Mobile Money ledger (G.8), Cash on delivery, 10.3 Courier app strings, Courier assignment suggestion (on duty, same city, right vehicle, nearest) (+17 more)

### Community 59 - "Cash Report Logic"
Cohesion: 0.12
Nodes (23): balancesFromLines(), CourierBalance, courierCashSummary(), LedgerRow, readCashLines(), toCashLine(), HANDOVER_DEADLINE_DAYS, HANDOVER_METHODS (+15 more)

### Community 60 - "dependencies"
Cohesion: 0.08
Nodes (25): dependencies, dotenv@^17.4.2, express@^5.2.1, express-rate-limit@^8.7.0, express-session@^1.19.0, html2canvas@^1.4.1, leaflet@^1.9.4, lenis@^1.3.27 (+17 more)

### Community 61 - "i18n.test.ts"
Cohesion: 0.10
Nodes (22): app, leaves(), PAIRS, SAME_IN_BOTH, server, tmpDir, Tree, addErrorCodes() (+14 more)

### Community 62 - "WhatsApp Job Messages"
Cohesion: 0.15
Nodes (19): firstName(), isJobMessageTemplate(), isPlannedMessage(), JOB_MESSAGE_TEMPLATES, JobMessage, JobMessageInput, jobMessagePlan(), JobMessageTemplate (+11 more)

### Community 63 - "ProductEditor.tsx"
Cohesion: 0.07
Nodes (59): DocNode, RichEditorProps, CategoriesManager(), CategoryDialog(), EditorPicture, PictureManager(), changes(), EMPTY_DOC (+51 more)

### Community 64 - "capabilities.ts"
Cohesion: 0.16
Nodes (24): afterLoadIdle(), canAnimate(), canSmoothScroll(), canUseStage(), isMotionPaused(), matches(), pauseListeners, prefersReducedMotion() (+16 more)

### Community 65 - "package.json"
Cohesion: 0.10
Nodes (20): helmet@^8.3.0, react-dom@^18.3.1, @tiptap/react@^3.33.1, @types/express@^5.0.6, @types/express-session@^1.19.0, @types/jsbarcode@^3.11.4, @types/three@^0.187.0, engines (+12 more)

### Community 66 - "TipTap Editor Dependencies"
Cohesion: 0.09
Nodes (22): @tiptap/core@^3.33.1, @tiptap/extension-image@^3.33.1, @tiptap/extension-link@^3.33.1, @tiptap/extension-table@^3.33.1, @tiptap/extensions@^3.33.1, @tiptap/pm@^3.33.1, @tiptap/starter-kit@^3.33.1, @tiptap/core (+14 more)

### Community 67 - "Tanex Master Plan"
Cohesion: 0.12
Nodes (20): Console at /private-user/ (ADMIN_PATH), Tech stack (React/Vite/Express/node:sqlite), Part 1: Booking at /fr/livraison-locale, Part 5: Failed attempt, G.9 Field test: Buea end-to-end delivery, Part 8: Finance confirmation and daily CSV, Finding report format and severity (Blocker/Major/Minor/Idea), Part 4: On the way and live map (+12 more)

### Community 68 - "Design Direction Mocks"
Cohesion: 0.12
Nodes (20): Camera use per chapter, Approval decisions and open items, Components (buttons, track field, chips, cards) light/dark, Homepage mock frames (desktop iframe + phone), Journey storyboard (9 key frames, chapters 0-8), TanEx Design Direction (C.1, approved 7 Nov 2026), design/tx.css + sprite.js (shared mock assets), Type system (Plus Jakarta Sans 800 + italic word, Inter, JetBrains Mono) (+12 more)

### Community 69 - "tariffs.test.ts"
Cohesion: 0.15
Nodes (9): app, call(), HASH, now0, server, signIn(), tmpDir, SUGGESTED_AREAS (+1 more)

### Community 70 - "Dispatch Jobs Tests"
Cohesion: 0.12
Nodes (15): act(), addCourier(), addUser(), app, call(), createJob(), HASH, json() (+7 more)

### Community 71 - "3D Hero & Door"
Cohesion: 0.16
Nodes (9): ArrivalScene, HeroScene, buildDoor(), COLORS, Door, fadeTexture(), glowTexture(), linearToSrgb() (+1 more)

### Community 72 - "3D Label & Parcel"
Cohesion: 0.12
Nodes (16): CENTRE, LABEL_TIMELINE, LabelPose, LabelRig, code128B(), PATTERNS, buildParcel(), COLORS (+8 more)

### Community 73 - "paymentRequest.ts"
Cohesion: 0.13
Nodes (19): btc, paypal, PaymentDraftAccount, PaymentMethodCardProps, CustomerMethodView, Details, PaymentMethodType, CleanPaymentRequest (+11 more)

### Community 74 - "Smooth Scroll & Route Rail"
Cohesion: 0.36
Nodes (8): useJourneyChapter(), useJourneyStore(), barPercent(), chapterNumbers(), RailChapter, railPosition(), RouteRail(), RouteRailProps

### Community 75 - "Courier App Shell"
Cohesion: 0.14
Nodes (26): ACTIVE, alertNewJob(), CourierApp(), CourierRoot(), CourierShell(), readSeen(), seenKey(), SyncPill() (+18 more)

### Community 76 - "JobDetail.tsx"
Cohesion: 0.19
Nodes (23): CourierJob, CourierPlace, JobDetail(), JobMap, MESSAGE_LABEL, MessagesCard(), PlaceCard(), courierActions() (+15 more)

### Community 77 - "Tracker: Design & Console Phases"
Cohesion: 0.12
Nodes (18): BRAND_GUIDE, FIELD_TEST_G9, TanEx Project Tracker, C.1 Design direction (design/direction.html), C.2 --tx-* tokens with --ngf-* aliases, C.3 Core components, Header, Footer, Change log, DB_PATH ignored when set only in .env (db.ts import order) (+10 more)

### Community 78 - "SmoothScroll.tsx"
Cohesion: 0.20
Nodes (13): lenis, whenIdle(), loadedGsap(), loadGsap(), GsapKit, JourneyController(), headerOffset(), keepNative() (+5 more)

### Community 79 - "3D Model Brief"
Cohesion: 0.13
Nodes (15): tanex_bike model (bike + rider + top box), Blender blockout scripts (build_tanex_bike.py / build_tanex_truck.py), 3D colour specification (brand palette), Deliverables (.blend + .glb, textures, renders), Milestones M1-M3 and acceptance check, phone_screen 'screen' material (live map), Named pivot hierarchy (front_wheel, handlebar, rider_torso, box_lid, parcel_socket), TanEx 3D Model Brief and RFQ (+7 more)

### Community 80 - "Payments Update Spec"
Cohesion: 0.18
Nodes (12): Dashboard notifications (badge, bell, toast, ngf_seen_proofs), Files & storage requirements (UPLOADS_DIR, magic bytes), Prompt: Package Images, Payment Methods & Proof of Payment, Proof submission rules (POST /api/track/:id/payment-proof), Workflow per task and report back, Public GET /media/:id route, Payment method registry src/shared/paymentMethods.ts, payment_proofs table and review flow (+4 more)

### Community 81 - "routes/track.ts"
Cohesion: 0.11
Nodes (22): logNotification(), NotificationLogInput, NotificationLogRow, readNotificationLog(), latestPublicProof(), maskSignerName(), trackRouter, TRACKING_PREFIX (+14 more)

### Community 82 - "catalog.ts"
Cohesion: 0.10
Nodes (41): applyProductInput(), bad(), CategoryInput, CategoryRow, categorySlugTaken(), checkCategoryImage(), checkParent(), clearPending() (+33 more)

### Community 83 - "Content: Home & Blog Copy"
Cohesion: 0.12
Nodes (18): docs/BLOG_SPEC.md, 15 Blog pages, 2.7 Get in touch, 2.1 Hero (From your door to the world), 2.8 Home FAQ, 2 Home page (owner's outline), 2.10 The Journey: chapter beats and route rail, 2.2 Services photo cards (+10 more)

### Community 84 - "Tracker: Journey Phase"
Cohesion: 0.16
Nodes (16): H.0 3D brief for the artist, H.1 Motion foundation (GSAP, Lenis, JourneyController), H.2 The Stage (WebGL canvas) and bike, H.3 Chapters 0-1: hero globe and services road, H.4 Chapters 2-3: in town and city to city truck, H.5 Chapters 4-8: world, label, arrival, H.6 Final glTF models and posters, H.7 Inner-page motion (+8 more)

### Community 85 - "shipmentStatusLabel"
Cohesion: 0.26
Nodes (17): ControlAction, ShipmentControlModal(), STANDARD_HUBS, ADMIN_ROLE_LABEL, applyDelayState(), applyHoldState(), applyResumeState(), formatDateTime() (+9 more)

### Community 86 - "TypeScript Config"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+9 more)

### Community 87 - "Router Route Table"
Cohesion: 0.17
Nodes (20): app, indexPath, server, tmpDir, BlogPageResult, BlogResolver, IndexRenderer, publicPages() (+12 more)

### Community 88 - "Legal Pages"
Cohesion: 0.17
Nodes (14): HQ_ADDRESS_FR, LEGAL_DOC_IDS, LEGAL_LAST_UPDATED, LEGAL_URL, LegalBlock, LegalContact, LegalDoc, LegalDocId (+6 more)

### Community 89 - "sheets.tsx"
Cohesion: 0.30
Nodes (15): CashScreen(), EMPTY, useCourierText(), CashMethod, draftFor(), FailSheet(), PickupSheet(), PodSheet() (+7 more)

### Community 90 - "Journey Scroll Store"
Cohesion: 0.17
Nodes (11): beatOf(), BEATS, clamp01(), headerOffset(), PIN_VH, setBeat(), setupJourney(), STEPS (+3 more)

### Community 91 - "Brand Guide"
Cohesion: 0.12
Nodes (12): BRAND_COLORS in brand.ts, TanEx Brand Guide & Design System, Courier app UI rules (56px buttons, one-handed), Name usage (TanEx vs Tanex SARL), Palette (Chocolate, Cream, Orange #F48800), Reference formats (TX-TKT, TX-INV, TX-SL, TX-CSH, QR-YYYY), Secondary slogan: Saving Situations, Tagline: From Your Door to the World (+4 more)

### Community 92 - "Motion & 3D Spec"
Cohesion: 0.10
Nodes (23): TanEx bike + rider model (tanex-bike.glb), capabilities.ts (canAnimate / canUseStage), Journey chapters 0-8, Globe (stage/globe.ts, Natural Earth dots), GSAP (ScrollTrigger, SplitText, CustomEase), Lenis smooth scroll, Motion & 3D Specification: The Journey, Pause motion control (tx_motion_paused) (+15 more)

### Community 93 - "Tracker: Shop Phase M"
Cohesion: 0.12
Nodes (15): Courier offlineQueue.ts (IndexedDB), G.4 Courier app (PWA, offline queue), #140 Marketplace button, #164 Delivery code rules, #183 Shop order retention (10y / 2y), M.0 Shop spec and Returns & Refunds draft, M.1 Shop schema and permissions, M.2 Square picture pipeline (+7 more)

### Community 94 - "useAuth"
Cohesion: 0.17
Nodes (27): AdminLogin(), AdminLoginProps, AuthCard(), AuthError(), ForgotPassword(), LANG_NAMES, readResetToken(), ResetPassword() (+19 more)

### Community 95 - "Password Reset Tests"
Cohesion: 0.16
Nodes (12): app, call(), forgot(), HASH, logged, reset(), sent, server (+4 more)

### Community 96 - "server/index.ts"
Cohesion: 0.07
Nodes (28): Shop SEO and Product JSON-LD, app, conn, indexPath, now, render, server, resolveSessionSecret() (+20 more)

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

### Community 102 - "Cash API Routes"
Cohesion: 0.14
Nodes (16): audit(), stripSecrets(), toJson(), allocateCashRef(), NOTE_MAX, body(), canConfirm, canView (+8 more)

### Community 103 - "LocalDeliveryPage.tsx"
Cohesion: 0.07
Nodes (46): Button, ButtonAsButton, ButtonAsLink, buttonClass(), ButtonProps, ButtonSize, ButtonVariant, CommonProps (+38 more)

### Community 104 - "i18n Home & Delivery Copy"
Cohesion: 0.16
Nodes (13): AreaMessages, company, CompanyMessages, courier, CourierMessages, home, HomeMessages, localDelivery (+5 more)

### Community 105 - "In-Town 3D Scene"
Cohesion: 0.15
Nodes (12): IN_TOWN_TIMELINE, inTownDistance(), MAP, mapRoutePoint(), mapTexture(), ON_THE_WAY_METRES, PHONE_FOCUS, PhoneMap (+4 more)

### Community 106 - "JobDrawer.tsx"
Cohesion: 0.28
Nodes (18): boardErrorText(), AssignDialog(), boardJobMessages(), CancelDialog(), DialogError(), Field(), JobDrawer(), LiftCodeDialog() (+10 more)

### Community 107 - "cashLedger.test.ts"
Cohesion: 0.16
Nodes (11): act(), addCourier(), addUser(), app, call(), HASH, now0, PNG (+3 more)

### Community 108 - "ContactPage.tsx"
Cohesion: 0.16
Nodes (15): Chip(), PHONE_2, CONTACT_QUICK_ANSWER_IDS, HELP_ARTICLES, HELP_CATEGORIES, HelpArticle, HelpArticleKey, HelpCategory (+7 more)

### Community 109 - "runtime.ts"
Cohesion: 0.06
Nodes (46): App(), AuthProvider(), ErrorBoundary, ErrorBoundaryProps, ErrorBoundaryState, fallbackLocale(), isRecoverableByReload(), reloadOnce() (+38 more)

### Community 110 - "Server TS Config"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, module, moduleResolution, noUnusedLocals, noUnusedParameters, outDir, resolveJsonModule (+5 more)

### Community 111 - "Company Facts & Launch"
Cohesion: 0.16
Nodes (14): Company facts (single source of truth), Ch 6 Contact (channels + form), Tracking ID format (TX + 6 safe chars), Owner decisions (2026-11-06), Six service card photos (Unsplash License), Homepage service card photos sources, UB Junction, Molyko, Buea photo (Adesolive, CC BY-SA 4.0), Site link www.tanexsarl.com (+6 more)

### Community 112 - "Notifications Spec"
Cohesion: 0.23
Nodes (15): Local delivery booking (/local-delivery), docs/NOTIFICATIONS_SPEC.md, buildWhatsAppLink(phoneE164, templateKey, vars, locale), Notification channels (email, WhatsApp link, in-app), Later upgrade: WhatsApp Cloud API / SMS, SPF / DKIM / DMARC for tanexsarl.com, email_outbox table and send worker, Email templates (server/mail/templates/<key>.<locale>.ts) (+7 more)

### Community 113 - "Auth Tests"
Cohesion: 0.14
Nodes (9): DB_FILE, HASH, login(), openApps, sidCookie(), startApp(), TestApp, tmpDir (+1 more)

### Community 114 - "consoleText.ts"
Cohesion: 0.05
Nodes (53): ADMIN_APP_TEXT, ADMIN_APP_TEXT_EN, ADMIN_LAYOUT_TEXT_EN, BLOG_MENU, BLOG_MENU_EN, BLOG_TEXT_EN, CASH_TEXT, CASH_TEXT_EN (+45 more)

### Community 115 - "dispatchBoard.test.ts"
Cohesion: 0.16
Nodes (12): app, call(), createJob(), HASH, NOW, now0, place(), server (+4 more)

### Community 116 - "shopSettings.ts"
Cohesion: 0.17
Nodes (15): shopSettings(), isShopPaymentMethod(), SHOP_PAYMENT_METHODS, ShopPaymentMethod, DEFAULT_SHOP_SETTINGS, idOrNull(), isIntIn(), isValidOrderEmail() (+7 more)

### Community 117 - "I18N Spec"
Cohesion: 0.25
Nodes (8): Stable API error codes mapped by the client, Intl formatting format.ts (en-CM / fr-CM, XAF 0 decimals), Languages, Routing & Page Meta Specification (EN/FR), Server page meta injection server/render/pageMeta.ts, Route table src/router/routes.ts, Bilingual sitemap with hreflang alternates, Tracking event title_key / title_vars_json, EN/FR URL scheme (/ and /fr/)

### Community 118 - "SQLite Session Store"
Cohesion: 0.13
Nodes (8): Callback, COURIER_SESSION_MS, createSessionMiddleware(), expiryOf(), express-session, SessionData, SqliteSessionStore, STAFF_SESSION_MS

### Community 119 - "build-globe-dots.mjs"
Cohesion: 0.18
Nodes (8): bits, cameroon, cameroonFeature, cm, data, iso(), land, OUT

### Community 120 - "context.ts"
Cohesion: 0.21
Nodes (12): CourierKey, CourierLang, CourierT, CourierText, CourierTextContext, useCourierTextValue(), formatDateTime(), formatTime() (+4 more)

### Community 121 - "Deployment Guide"
Cohesion: 0.18
Nodes (11): Blog SEO (hreflang, OG, JSON-LD BlogPosting, sitemap, RSS), Deployment: GitHub to Hostinger, Domain and paths (apex, /private-user/ noindex), Email DNS (MX, SPF, DKIM, DMARC), email_outbox queue with retries, Environment variables (SESSION_SECRET, DB_PATH, UPLOADS_DIR, SMTP_*), Hosting requirements (Node >= 22.5, persistent storage, HTTPS, Hostinger Email), Hostinger app configuration (npm install, npm start) (+3 more)

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

### Community 126 - "DocumentCenterView.tsx"
Cohesion: 0.19
Nodes (18): DocumentCenterView(), DocumentCenterViewProps, loadPdfTools(), waitForImagesToLoad(), place(), PodDetails, PodPaper, readDetails() (+10 more)

### Community 127 - "RichEditor.tsx"
Cohesion: 0.36
Nodes (9): blogExtensions(), safeHref(), ImageDialog(), LinkDialog(), RichEditor(), Toolbar(), ToolButton(), wordsOf() (+1 more)

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

### Community 134 - "brand.ts"
Cohesion: 0.08
Nodes (32): ADMIN_CONSOLE_NAME, BRAND_ASSET_VERSION, formatClock(), formatOpeningHours(), HEAD_OF_OPERATIONS_NAME, INTAKE_DESK, LOGO_WHITE, LOGO_WORDMARK (+24 more)

### Community 135 - "runtime.ts"
Cohesion: 0.13
Nodes (17): AREA_LOADERS_EN, AreaName, en, Messages, AREA_LOADERS_FR, common, loadFrMessages(), AreaEntry (+9 more)

### Community 136 - "i18n Help"
Cohesion: 0.50
Nodes (3): help, HelpMessages, help

### Community 137 - "types.ts"
Cohesion: 0.22
Nodes (7): network, NetworkMessages, courier, localDelivery, network, trackResult, Translation

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

### Community 142 - "SettingsView.tsx"
Cohesion: 0.27
Nodes (12): EmailSettingsPanel, SettingsView(), CURRENCY_NAMES, CurrencySettings, currencySymbol(), DISPLAY_CURRENCIES, DisplayCurrency, formatMoney() (+4 more)

### Community 143 - "Prompts: IAM Phase"
Cohesion: 0.67
Nodes (3): audit() / audit_log, Phase B: Identity & access (IAM/RBAC), SQLite session store (tx.sid cookie)

### Community 144 - "Phase E: Public Site Rebuild"
Cohesion: 0.14
Nodes (14): docs/CONTENT_FR.md, E.2 Services page, E.3 About and Network pages, E.4 Contact, Help, Legal, E.5 Track, Quote and Ship pages, E.6 Payments localisation (MoMo, Orange Money, XAF), E.7 Images, E.8 Public QA EN+FR (+6 more)

### Community 145 - "Phase B: Identity & Access (IAM/RBAC)"
Cohesion: 0.15
Nodes (11): Audit log (audit()/audited()), B.1 IAM schema, seeded roles, Super Admin bootstrap, B.2 SQLite session store and auth routes, B.3 Route permissions (requirePermission everywhere), B.4 Console auth (AuthContext, forced password change), B.5 Users, Roles and Audit log screens, B.7 TOTP 2FA (optional, after launch), #122 Seeded role permissions (+3 more)

### Community 146 - "Shop delivery fee calculation"
Cohesion: 0.27
Nodes (10): delivery_cities table, delivery_zones table, intercity_rates table, Admin-defined local and intercity pricing, Size classes Small / Medium / Large, zone_rates table, Shop delivery fee calculation, Tracker phase M build order (+2 more)

### Community 147 - "permissions.test.ts"
Cohesion: 0.17
Nodes (11): app, call(), cookieFor(), cookies, HASH, now, PermissionKey, Probe (+3 more)

### Community 149 - "ConsoleLanguage.tsx"
Cohesion: 0.18
Nodes (15): compare(), SRC, ConsoleLangContext, ConsoleLanguage(), ConsoleLangValue, ConsoleLang, isConsoleLangReady(), loadConsoleLang() (+7 more)

### Community 151 - "PaymentIcon.tsx"
Cohesion: 0.27
Nodes (7): dir, LUCIDE_FALLBACKS, PAYMENT_ICON_PATHS, FALLBACKS, ICON_COLORS, PaymentIconProps, PAYMENT_METHODS

### Community 152 - "multipart.ts"
Cohesion: 0.24
Nodes (10): malformed, MultipartBody, multipartBoundary(), MultipartFile, MultipartLimits, MultipartResult, parseMultipart(), readBody() (+2 more)

### Community 153 - "description.ts"
Cohesion: 0.24
Nodes (9): parseDoc(), publishBlocker(), BLOCKS, clean(), DescriptionCheck, DROP, MARKS, MAX_DESCRIPTION_JSON (+1 more)

### Community 154 - "chapters/services.ts"
Cohesion: 0.24
Nodes (8): bandFrame(), COLORS, endsTexture(), rideProgress(), roadTexture(), ServicesOutput, ServicesPose, ServicesScene

### Community 165 - "fr/about.ts"
Cohesion: 0.50
Nodes (3): about, AboutMessages, about

### Community 166 - "fr/payment.ts"
Cohesion: 0.50
Nodes (3): payment, PaymentMessages, payment

### Community 167 - "fr/ship.ts"
Cohesion: 0.50
Nodes (3): ship, ShipMessages, ship

### Community 168 - "ResponsiveImage.tsx"
Cohesion: 0.36
Nodes (7): largest(), ResponsiveImage(), ResponsiveImageProps, srcSet(), SITE_IMAGES, SiteImageInfo, SiteImageName

### Community 176 - "courierApi.ts"
Cohesion: 0.13
Nodes (16): CashBalance, CashEntry, CashInput, CashState, courierApi, CourierProfile, courierUrls, RawResult (+8 more)

### Community 177 - "references.ts"
Cohesion: 0.31
Nodes (7): REFERENCE_PREFIX, generateReference(), isReferenceOf(), REFERENCE_PATTERN, REFERENCE_PREFIXES, referenceFor(), ReferenceKind

### Community 178 - "fr/blog.ts"
Cohesion: 0.50
Nodes (3): blog, BlogMessages, blog

### Community 179 - "fr/legal.ts"
Cohesion: 0.50
Nodes (3): legal, LegalMessages, legal

### Community 190 - "PaymentRequestEditor.tsx"
Cohesion: 0.15
Nodes (22): AccountEditor, accountSummary(), blankDetails(), draftFromPayment(), draftToRequest(), emptyPaymentDraft(), inputType(), newAccount() (+14 more)

## Knowledge Gaps
- **131 isolated node(s):** `Password reset tokens (password_resets)`, `Super Admin bootstrap and npm run create-super-admin`, `Optional TOTP 2FA (B.7)`, `users table (email or phone, bcrypt 12)`, `Engagements (4) du pied de page` (+126 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1304 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **25 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `CreateShipmentView.tsx`, `Header.tsx`, `blogApi.ts`, `Public Pages & Blog Views`, `brand.ts`, `UI Kit & Services Pages`, `Dispatch Board Logic`, `CouriersView.tsx`, `SettingsView.tsx`, `UnitControls.tsx`, `shopMedia.test.ts`, `ConsoleLanguage.tsx`, `Dispatch Job Drawer`, `PaymentIcon.tsx`, `api.ts`, `App Shell`, `ProofViewer.tsx`, `PaymentsView.tsx`, `Home Page`, `AdminApp.tsx`, `ResponsiveImage.tsx`, `PaymentSection.tsx`, `Tariffs Console`, `courierApi.ts`, `LocationsPage.tsx`, `TrackingEventsView.tsx`, `Cash Console`, `dependencies`, `PaymentRequestEditor.tsx`, `ProductEditor.tsx`, `capabilities.ts`, `package.json`, `Smooth Scroll & Route Rail`, `Courier App Shell`, `JobDetail.tsx`, `SmoothScroll.tsx`, `shipmentStatusLabel`, `Legal Pages`, `sheets.tsx`, `Motion & 3D Spec`, `useAuth`, `Glide & Page Progress`, `LocalDeliveryPage.tsx`, `JobDrawer.tsx`, `ContactPage.tsx`, `runtime.ts`, `context.ts`, `DocumentCenterView.tsx`, `RichEditor.tsx`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **What connects `Password reset tokens (password_resets)`, `Super Admin bootstrap and npm run create-super-admin`, `Optional TOTP 2FA (B.7)` to the rest of the system?**
  _131 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `console/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07039187227866474 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `react` to `CreateShipmentView.tsx`, `Header.tsx`, `blogApi.ts`, `brand.ts`, `Public Pages & Blog Views`, `UI Kit & Services Pages`, `Dispatch Board Logic`, `CouriersView.tsx`, `SettingsView.tsx`, `UnitControls.tsx`, `shopMedia.test.ts`, `Dispatch Job Drawer`, `PaymentIcon.tsx`, `api.ts`, `App Shell`, `ProofViewer.tsx`, `PaymentsView.tsx`, `Home Page`, `AdminApp.tsx`, `PaymentSection.tsx`, `Tariffs Console`, `courierApi.ts`, `LocationsPage.tsx`, `TrackingEventsView.tsx`, `Cash Console`, `dependencies`, `PaymentRequestEditor.tsx`, `ProductEditor.tsx`, `capabilities.ts`, `package.json`, `Smooth Scroll & Route Rail`, `Courier App Shell`, `JobDetail.tsx`, `shipmentStatusLabel`, `Legal Pages`, `sheets.tsx`, `useAuth`, `Glide & Page Progress`, `LocalDeliveryPage.tsx`, `JobDrawer.tsx`, `ContactPage.tsx`, `runtime.ts`, `DocumentCenterView.tsx`, `RichEditor.tsx`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Should `API Routes & Middleware` be split into smaller, more focused modules?**
  _Cohesion score 0.04098649442160893 - nodes in this community are weakly interconnected._
- **Why does `CONTENT.md: TanEx Content Deck (English master)` connect `Content Deck Overview` to `Tracker: Design & Console Phases`, `Phase E: Public Site Rebuild`, `French Site Content`, `Content: Home & Blog Copy`, `Content: Console & Tracking Copy`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Should `CreateShipmentView.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.0955837870538415 - nodes in this community are weakly interconnected._