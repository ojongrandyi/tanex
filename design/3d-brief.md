# TanEx: 3D Model Brief and Request for Quote

**Delivery bike with rider, and box truck, for the tanexsarl.com homepage**

| | |
|---|---|
| Client | Tanex SARL ("TanEx"), Buea, Cameroon |
| Contact | info@tanexsarl.com |
| Document | 3D brief, version 1.0, 9 November 2026 |
| Confidentiality | Confidential until the new homepage is public. Please do not share this brief, its attachments or work in progress. |

---

## 1. Summary

TanEx is a door-to-door delivery and logistics company: bike delivery within Buea, Limbe and Douala, trucks between
cities, and international freight. Its new homepage tells that story as the visitor scrolls: a TanEx delivery bike
leaves a front door, crosses town, hands a larger load to a TanEx truck, sends the parcel abroad and finally arrives
at another door.

We are commissioning **two real-time 3D models** for that page:

1. **The TanEx delivery bike with its rider and top box** (the main model, seen up close).
2. **The TanEx box truck** (secondary, seen at mid distance).

Both are displayed in a web browser (Three.js, WebGL), frequently on mid-range Android phones. They must be
**light, clean and legible at small sizes**. All motion is driven by code from the scroll position; the models need
**correctly named and placed pivots**, not animation.

### At a glance

| | Bike + rider + top box | Truck |
|---|---|---|
| Style | Low-poly, matte, flat brand colours | Same |
| Triangle budget | ≤ 8,000 (all three together) | ≤ 6,000 |
| Materials | 1 material, 1 texture atlas (+ 1 phone-screen material) | 1 material, 1 texture atlas |
| Texture | Base colour only, ≤ 1024 × 1024 px | Same (may share the bike atlas) |
| Moving parts (pivots) | Front wheel, rear wheel, handlebar, rider torso, top-box lid | Four wheels, cargo door |
| Units / orientation | Metres, real-world scale, facing +Z in glTF | Same |
| Delivery | `.blend` source + glTF 2.0 `.glb` | Same |
| Rights | Full assignment to Tanex SARL | Same |

## 2. Attachments

| File | Purpose |
|---|---|
| `3d-brief/reference-sheet.png` | **The approved look (master reference).** Front, side and three-quarter drawings of the bike and rider, numbered callouts, colour chips, and the truck. |
| `3d-brief/storyboard.png` | The nine homepage key frames: how and from which angles the models are seen. |
| `info.png` (TanEx flyer, centre photo) | Riding posture, helmet shape, top-box size and position. **Colours not to be followed** (see §3). |
| `Managing Director.png` | The real TanEx vest: cut, pockets, zip, chest wordmark, waist band. |
| `mark.png` | TanEx paper-plane mark (decal for the top box). |
| `logo-wordmark.png` | TanEx wordmark for light surfaces (decal for the truck). |
| `logo-wordmark-white.png` | TanEx wordmark for dark surfaces (decal for the vest). |

The logo files are the only approved versions. **Use them as texture decals; never redraw, retype, restyle or
distort the logo.** The plane mark may be recoloured as a single flat colour where §4 says so.

## 3. Art direction

- **Low-poly, matte, warm.** Rounded, friendly forms that are not cartoonish and not photorealistic. The tone is
  premium product illustration in 3D, in the manner of Apple and Nike product pages: few parts, clean silhouettes,
  soft bevels on large forms, no detail that disappears at 300 px.
- **Flat colour only**, from the palette in §4. No gloss, chrome, metallic surfaces, photo textures, dirt, wear or
  normal-map detail.
- **Readable on two backgrounds:** dark chocolate (`#1C120E`, `#2A1B16`) and cream (`#FBF6EC`, `#F5ECDB`). The scene
  uses one soft hemisphere light, one directional light and a blurred contact shadow.
- **Generic vehicles.** No manufacturer badges, logos or recognisable commercial models.
- **The rider is a generic courier**, not a portrait of a real person. The visor is down; no face is modelled.
- **About the flyer:** use it for posture and proportions only. Its tan jacket, tan helmet and cardboard-coloured box
  are replaced by the approved colours below (dark chocolate vest and helmet, orange top box).

## 4. Colour specification

Only these colours may be used. Hex values are sRGB.

### 4.1 Brand palette

| Scale | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Chocolate | `#F7F1EE` | `#EDE1DA` | `#D9C2B5` | `#BF9C8A` | `#9C7360` | `#7B5545` | `#5F4034` | `#4A3128` | `#38241D` | `#2A1B16` | `#1C120E` |
| Cream | `#FFFCF7` | `#FBF6EC` | `#F5ECDB` | `#EDDFC4` | `#E2CFA8` | | | | | | |
| Orange | `#FFF6EB` | `#FFE9CC` | `#FFD199` | `#FFB55C` | `#FF9F2E` | `#F48800` | `#C76A00` | `#9A5200` | `#723C00` | | |

Orange `#F48800` is the logo orange. It is an accent: on the models it appears only on the top box, the truck stripe,
the helmet speed lines, the indicators and inside the logo decals.

### 4.2 Bike, rider and top box

| Part | Colour | Hex |
|---|---|---|
| Helmet, full-face | Chocolate 700 | `#4A3128` |
| Helmet speed lines (three short lines on each side) | Orange 500 | `#F48800` |
| Visor, down | Chocolate 950 | `#1C120E` |
| Vest | Chocolate 800 | `#38241D` |
| Vest waist band | Cream 300 | `#EDDFC4` |
| Vest wordmark, left chest | Decal: `logo-wordmark-white.png` | cream + orange |
| Polo, short sleeves | Black | `#141010` |
| Trousers | Chocolate 950 | `#1C120E` |
| Shoes, closed | Near black | `#0F0A08` |
| Skin (forearms) | Deep warm brown | `#6B4330` |
| Gloves (optional, recommended) | Chocolate 950 | `#1C120E` |
| Top box | Orange 500 | `#F48800` |
| Plane mark on the top box (both sides and back) | Decal: `mark.png` as one flat colour, Chocolate 950 | `#1C120E` |
| Bike body and frame | Chocolate 900 | `#2A1B16` |
| Front fairing | Chocolate 800 | `#38241D` |
| Engine | Chocolate 700 | `#4A3128` |
| Seat, grips, mirrors, phone holder | Chocolate 950 | `#1C120E` |
| Tyres | Chocolate 950 | `#1C120E` |
| Rims and hubs (matte, not metal) | Chocolate 300 | `#BF9C8A` |
| Headlight | Cream 50 | `#FFFCF7` |
| Indicators | Orange 300 | `#FFB55C` |

The polo, shoe and skin values are the neutrals from the approved reference sheet; they are the only colours outside
the brand scales.

### 4.3 Truck

| Part | Colour | Hex |
|---|---|---|
| Cargo box | Cream 50 | `#FFFCF7` |
| Cargo box edges and panel lines | Chocolate 200 | `#D9C2B5` |
| Cab | Chocolate 900 | `#2A1B16` |
| Glass (matte, not reflective) | Chocolate 200 | `#D9C2B5` |
| Stripe along box and cab | Orange 500 | `#F48800` |
| Wordmark, both sides of the box | Decal: `logo-wordmark.png` | dark + orange |
| Tyres / rims | Chocolate 950 / Chocolate 300 | `#1C120E` / `#BF9C8A` |
| Headlights | Cream 50 | `#FFFCF7` |

## 5. Bike, rider and top box: technical specification

### 5.1 Description

- **Bike:** a commuter motorcycle of about 125 cc, as used for town delivery in Cameroon. Upright riding position,
  small front fairing with headlight, two mirrors, rear rack carrying the top box.
- **Rider:** seated upright, both hands on the grips, feet on the pegs; full-face helmet with the visor down; TanEx
  vest over a black short-sleeve polo; dark trousers; closed shoes.
- **Phone holder:** a small clamp on the handlebar holding a phone, screen angled toward the rider.
- **Top box:** orange, rounded edges, a visible split line under the lid, **lid hinged at the back** so it opens
  upward and backward. The interior is a simple open cavity; a parcel is added in code.

### 5.2 Budgets

| Item | Requirement |
|---|---|
| Triangles (bike + rider + top box) | **≤ 8,000** |
| Materials | **One** material using one texture atlas, plus the phone-screen material (§5.4) |
| Atlas | One base-colour PNG, sRGB, ≤ 1024 × 1024 px (512 × 512 if everything stays sharp) |
| Other texture maps | None: no normal, roughness, metalness, AO or emissive maps |
| Material values | Metallic 0, roughness 0.85 |
| Topology | Clean, closed where visible; no hidden interior faces; no n-gons in the export (triangulated on export is fine) |

The atlas holds flat palette swatches (UV islands scaled into the relevant swatch) and the logo decals. Decals must
be legible when the model fills 600 px on screen.

### 5.3 Hierarchy and pivots (exact names required)

The website finds these nodes **by name** and rotates them. For every pivot node: the **origin lies exactly on the
rotation axis**, **rotation is zero and scale is 1** in the rest pose, and local axes follow §5.5.

```
tanex_bike                 root; origin on the ground, centred between the two tyre contact points
├── bike_body              frame, engine, seat, rack, fairing, mirrors (static)
├── handlebar              origin on the steering axis (head tube); steers about its local up axis
│   ├── front_wheel        origin at the front axle; spins about its local X axis
│   └── phone_holder       static child of the handlebar
│       └── phone_screen   flat screen surface (§5.4)
├── rear_wheel             origin at the rear axle; spins about its local X axis
├── rider                  hips, legs and feet (static)
│   └── rider_torso        origin at the waist; turns about its local up axis (up to ±20°)
│                          torso, vest, arms, neck and helmet are children of this node
└── top_box                box body, fixed to the rack
    ├── box_lid            origin on the rear hinge line; opens about its local X axis (0° closed, 100° open)
    └── parcel_socket      empty, at the centre of the box floor (the website places the parcel here)
```

- The front fork and any fairing parts that turn with the bars belong under `handlebar`.
- Each wheel node holds its tyre, rim and hub; no wheel geometry may be attached to `bike_body`.
- When `rider_torso` turns 20°, the hands may lift slightly off the grips; that is expected.
- Object hierarchy only: no armature, skinning or shape keys.

### 5.4 Phone screen

`phone_screen` is the only exception to the single material. Give it its own material named **`screen`** and a UV
map filling the 0–1 square, upright as seen by the rider. The website displays a small live map on it.

### 5.5 Scale, units and orientation

- **1 Blender unit = 1 metre**, real-world scale. Guide dimensions for this class of bike (match a real reference
  rather than these exact numbers): overall length ≈ 1.95 m, wheel diameter ≈ 0.60 m, wheelbase ≈ 1.25 m, seat
  height ≈ 0.78 m; rider ≈ 1.75 m standing; top box ≈ 0.45 m wide × 0.40 m deep × 0.40 m high.
- The bike **faces +Z in glTF (Y up)**. In Blender (Z up) this means facing the **Front view (−Y)**; export with the
  glTF exporter's default **+Y Up** option.
- Scale applied on every mesh. Root origin on the ground plane.

## 6. Truck: technical specification

A light box truck (about 3.5 t class): chocolate cab, cream cargo box, an orange stripe along box and cab, the TanEx
wordmark on both sides of the box. Generic, with no manufacturer badges.

| Item | Requirement |
|---|---|
| Triangles | **≤ 6,000** (seen at mid distance; keeps the page's total 3D download within budget) |
| Material | One material, one atlas; may share the bike's atlas and swatches |
| Scale | Metres; guide size ≈ 6.0 m long × 2.1 m wide × 3.1 m high |
| Orientation and origin | As the bike: facing +Z in glTF; origin on the ground at the centre of the wheelbase |

```
tanex_truck                root
├── truck_body             cab and cargo box (static)
├── wheel_front_left       wheel_front_right
├── wheel_rear_left        wheel_rear_right      each origin at its axle centre; spins about its local X axis
└── cargo_door             origin on the hinge line; opens to 100° (used when the bike hands over the parcel)
```

Twin rear wheels on one side are modelled as one node.

## 7. Camera use

The approved storyboard (`storyboard.png`) defines how the models appear. Detail should be concentrated where the
camera goes close: the **top box and its plane mark**, the **helmet**, the **vest wordmark** and the **phone
holder**. The underside, engine internals and the far side of the rider can stay simple.

| Chapter | Background | View of the models | Moving parts |
|---|---|---|---|
| 0 · Your door | Dark | Bike, **side view**, eye level, slightly low; pulls up beside a front door | Wheels, light steering |
| 1 · Services | Cream | Bike from a **high three-quarter angle, looking down 40–50°**, riding a winding road; ends turning to a **front view** | Wheels, steering through curves |
| 2 · In town (close-up) | Dark | Bike centre frame; **camera orbits side → three-quarter front → rear**, ending on the top box; on phones three fixed angles (side, three-quarter, rear) | Lid opens and closes, wheels, torso turns to the phone |
| 3 · City to city | Cream | Bike and truck **side by side, side view**, then a wide high shot of the truck on a road | Truck cargo door, truck wheels |
| 6 · Contact | Cream | Bike parked, **side view** | Slow idle wheel |
| 7 · FAQ / blog | Cream | Bike, side view, dimmed still | None |
| 8 · Delivered | Dark | Bike, **side view**, stops at a front door | Lid opens |

## 8. Deliverables

| # | Item | Format |
|---|---|---|
| 1 | `tanex-bike.blend`, `tanex-truck.blend`: clean source files, names as in §5.3 and §6, scale applied, unused data purged, textures packed. Each includes one **test action** (not exported) that spins the wheels, steers ±25°, turns the torso and opens the lid or door. | Blender 4.2 LTS or later |
| 2 | `tanex-bike.glb`, `tanex-truck.glb`: no animations, cameras or lights; Y up. Uncompressed: TanEx applies meshopt/Draco compression and texture conversion. | glTF 2.0 binary |
| 3 | `tanex-atlas.png` (plus `tanex-truck-atlas.png` if separate) | PNG, sRGB, ≤ 1024 px |
| 4 | Preview renders, one per storyboard row in §7, on the stated background with a soft contact shadow | PNG, 1600 px wide |
| 5 | Delivery note: triangle count per model, node list, any deviation from this brief and why, any third-party assets used | PDF or text |

## 9. Milestones and acceptance

| Milestone | Content | Recommended timing | Review |
|---|---|---|---|
| M1 · Blockout | Grey shapes at real scale, final node names and pivots, both models | Within 5 working days of kickoff | TanEx loads it in the live page and confirms scale, pivots and proportions |
| M2 · Coloured draft | Final shapes, atlas, decals, preview renders | Within 10 working days | Colour, style and logo check |
| M3 · Final | All deliverables in §8 | Within 15 working days | Acceptance check below |

Two rounds of revisions are included at each milestone. TanEx replies to each milestone within 3 working days.

**Acceptance check** (run by TanEx on M3):
1. Each `.glb` loads in the Three.js glTF viewer with no errors or warnings.
2. Node names and hierarchy match §5.3 and §6 exactly.
3. Triangle counts are within budget.
4. Each pivot rotates cleanly about the correct axis; no parts left behind, detached or intersecting.
5. Real-world scale and orientation as in §5.5.
6. Colours match §4; logo decals are sharp, undistorted and taken from the supplied files.
7. Source files open cleanly and match the exported models.

## 10. Rights and licensing

- **Tanex SARL owns everything created for this commission**: models, textures, source files, renders and
  intermediate work. On payment, the artist assigns to Tanex SARL all copyright and other intellectual-property
  rights, **exclusively, worldwide, for all media and without time limit**, including the rights to modify, adapt,
  re-export and reuse the models in any TanEx material.
- **Original work only.** No purchased or downloaded models, kits or textures, and no AI-generated assets, unless
  their licence permits full transfer to TanEx and they are named in the delivery note.
- The TanEx name, logo and paper-plane mark are TanEx trademarks, licensed to the artist only to carry out this work.
- **Portfolio:** the artist may show renders of the finished models after the new homepage is publicly launched,
  credited "Client: TanEx", without source files or the brand files.

## 11. Commercial terms

- **Fixed price** for the full scope in this brief (both models, all deliverables, the included revisions), quoted
  by the artist.
- **Recommended payment schedule:** 30% on kickoff, 40% on approval of M2, 30% on acceptance of M3.
- Work beyond this brief is quoted and agreed in writing before it starts.

## 12. What to send with your quote

1. Fixed price and currency, and your earliest start date.
2. Confirmation of the timeline in §9, or your alternative.
3. Two or three examples of low-poly, real-time (glTF / game / web) models you have made, ideally vehicles or
   characters.
4. Any questions about this brief.

Please reply to **info@tanexsarl.com**.
