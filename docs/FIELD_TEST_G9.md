# G.9 Field test: Buea, one delivery from start to finish

**Goal:** run one real local delivery in Buea on real devices over mobile data, from the website booking to Finance
confirming the cash, and write down everything that is wrong, slow, confusing or missing.
**Time needed:** about 2 to 2½ hours, including setup.
**Rule for the whole test:** if something doesn't work, **don't fix it and don't work around it quietly**. Write it
down (section 6), take a screenshot, then carry on if you can.

---

## 1. People and devices

| Role | Device | Signed in as | Where |
|---|---|---|---|
| **D: Dispatcher** (also plays Finance) | Laptop, Chrome, on a **phone hotspot** (mobile data, not office Wi-Fi). WhatsApp Web open with the office WhatsApp number. | Staff account with `dispatch.manage` **and** `cash.confirm` (a Super Admin is fine) | TanEx office, Check Point (pickup point) |
| **R: Courier** | Android phone, Chrome, **Wi-Fi off**, mobile data on, GPS on, WhatsApp installed | Courier **A** in Chrome; courier **B** in a second browser on the same phone (Chrome Incognito or Firefox) | On a bike, moves between pickup and drop-off |
| **C: Customer** | Second phone, **Wi-Fi off**, mobile data on, WhatsApp installed | Not signed in (public website) | Waits at the drop-off point |

Write down before you start: phone models, Android versions, browser versions, mobile network (MTN / Orange) on each
phone, and the signal (bars / 3G / 4G) at the office and at the drop-off.

## 2. Setup (do this the day before, or 1 hour before)

**Site.** Use the deployed site **https://tanexsarl.com** (or an HTTPS tunnel to a test server). Location sharing,
the camera and the courier app install **only work over HTTPS**. Write down which URL and which build/commit you test.

**On the laptop (D):**
1. Console → **Tariffs**: Buea is active; the drop-off area exists (#159); Buea has the **real** rates the owner
   wants (#106). If there are no rates, that's fine: dispatch will price by hand at step 2.2. Don't enter
   made-up rates.
2. Tariffs → **Speeds and alerts**: write down the current values (bike speed; "not assigned" 15 min; "not
   accepted" 10 min).
3. Console → **Couriers**: create two courier accounts, **Courier A** and **Courier B**, home city Buea,
   vehicle Bike, with real names and the courier's real phone number. Give courier A a photo and tick
   consent (if the courier agrees). Write down the temporary passwords.
4. Keep the browser zoom at 100%. Open DevTools → Console so you can screenshot red errors.

**On the courier phone (R):**
1. Chrome → `https://tanexsarl.com/private-user/` → sign in as **Courier A** → change the temporary password.
2. Profile → **Install** (add to home screen). From now on open the app from the home-screen icon.
3. Second browser (Incognito / Firefox) → same URL → sign in as **Courier B** → change the password.
   Leave it signed in.
4. In courier A: turn **On duty**. Courier B stays **Off duty** for now.
5. Battery level at start: ____ %.

**On the customer phone (C):** nothing to sign into. Set the phone's language to anything; the test books in
**French** on purpose.

**Test parcel:** a small sealed envelope or box with a paper label "TEST G.9". Agree a small **real** cash amount
for COD (for example 1 000 FCFA) that C will really hand to the courier.

---

## 3. The run

Each step: **who does what**, then **what should happen**. Tick ✅ or write ❌ + finding number (F1, F2, …).
Write the **clock time** at each step: timings matter.

### Part 1: Booking (C)

| # | Who | Do | Expect | ✅/❌ | Time |
|---|---|---|---|---|---|
| 1.1 | C | Open **https://tanexsarl.com/fr/livraison-locale** on mobile data. | Page loads in French in a reasonable time (write roughly how many seconds). No sideways scrolling. | | |
| 1.2 | C | Fill the form: city **Buea**; pickup = TanEx office Check Point area, landmark "Bureau TanEx"; sender = C's own name and **C's phone number**. Drop-off = the area where C will wait, a real landmark; recipient name = a different name (e.g. C's colleague's first name) with **C's phone number** again. Size Small, item "Enveloppe test", not express, **the recipient pays**, COD = the agreed amount, preferred time empty, email: C's email if they want to test the email. | Area list shows Buea areas; "My area isn't listed" works; price appears (or "we'll confirm your price"). Optional: set a map pin and check it's in the right place. | | |
| 1.3 | C | Submit. | Success screen with a `TX` + 6 character tracking ID. **Write the ID down: TX__________** | | |
| 1.4 | C | Tap **Send tracking to the recipient on WhatsApp**. | WhatsApp opens with a French message and a working tracking link, addressed to C's number. Tap Send. "Opened in WhatsApp" shows on the page. | | |
| 1.5 | C | Tap **Track this delivery**. Keep this tab open for the whole test. | French track page: step "Delivery requested", no phone numbers shown, map with area/city pins (not C's exact pin). | | |
| 1.6 | C | If an email was given: check the inbox (and spam). | `local.booked` email in French. | | |

### Part 2: Confirm and assign (D)

| # | Who | Do | Expect | ✅/❌ | Time |
|---|---|---|---|---|---|
| 2.1 | D | Console → **Dispatch**. Don't refresh. | Within 15 s the job appears under **Requested**; sidebar badge goes up. How long did it take? | | |
| 2.2 | D | Open the job → **Confirm & price** (enter a price by hand if there's no rate). | Job moves to **To assign**. Drawer shows language FR, payer recipient, COD amount, fee collection on, no delivery code (website bookings have none). | | |
| 2.3 | D | Drawer → **WhatsApp messages** → *Booking confirmed* (to sender). | WhatsApp Web opens to C's number with a French text, tracking ID and link. Send. Drawer shows "Opened in WhatsApp"; history lists it. | | |
| 2.4 | C | Check WhatsApp and the track page. | Message received. Track page shows "Delivery confirmed" (refreshes on its own within ~20 s). Email `booking.confirmed` if an email was given. | | |
| 2.5 | D | **Assign** → check the suggestions list. | Courier A listed as suggested (on duty, Buea, bike). Courier B listed lower as *off duty*. Assign **Courier A**. | | |
| 2.6 | D | Drawer → WhatsApp *Courier assigned* to sender **and** to recipient. | Both open in French with courier A's first name. Send both. | | |

### Part 3: Accept and pickup (R as courier A, D)

| # | Who | Do | Expect | ✅/❌ | Time |
|---|---|---|---|---|---|
| 3.1 | R | Have the app open on **Today** (screen on). | New job appears highlighted without refreshing; after the first tap, vibration + tone. How long after 2.5? | | |
| 3.2 | R | Lock the phone for 1 min, unlock, open the app. | The job is still there; nothing lost. | | |
| 3.3 | R | Open the job. Check the pickup and drop-off cards: **Call**, **WhatsApp**, **Open in Maps**, small map. | Call dials, WhatsApp opens the chat, Maps opens Google Maps at the right place (or the area). Write which ones are wrong. | | |
| 3.4 | R | **Accept**. | Button changes to **Picked up**. On the board (D) the job moves to **Assigned/In progress** within 15 s. | | |
| 3.5 | D | Hand the TEST parcel to the courier. | | | |
| 3.6 | R | **Picked up**. | The app explains location sharing, then the browser asks for location → **Allow**. If the sender pays at pickup a payment sheet would show; here the recipient pays, so no sheet. | | |
| 3.7 | C | Track page. | "Picked up by {courier A first name}", courier card (with photo only if consent was ticked). | | |

### Part 4: On the way and live map (R, C, D)

| # | Who | Do | Expect | ✅/❌ | Time |
|---|---|---|---|---|---|
| 4.1 | R | **On my way**, then ride towards the drop-off. Keep the app open, phone in a holder if possible. | Sharing location indicator on. | | |
| 4.2 | R | Courier app → *Message the customer* → **On the way** (to recipient). | WhatsApp opens to C's number in French with the live link. Send. | | |
| 4.3 | C | Watch the track page for 5 min. | Rider marker moves; "Updated n seconds ago" stays under ~1 min; ETA "environ n min" is sensible. Note how far off the marker is from reality and how often it jumps. | | |
| 4.4 | D | Watch the board map. | Courier A's marker moves; turns grey only if no position for 2 min. | | |
| 4.5 | R | **Lock the screen for 2 min** while riding (only when safe/stopped), then unlock. | Write what happens: did positions stop while locked (expected in a browser), did the board raise "no position for 2 min", did it recover after unlocking? | | |
| 4.6 | R | Switch on **airplane mode** for ~1 min, then off. | Header pill shows *Offline* / *saved on phone*, then *Synced*. No error. | | |

### Part 5: Failed attempt (R, C, D)

At the drop-off, C **doesn't answer** on purpose for this first attempt.

| # | Who | Do | Expect | ✅/❌ | Time |
|---|---|---|---|---|---|
| 5.1 | R | Call the recipient from the job card. C doesn't pick up. | | | |
| 5.2 | R | **Couldn't deliver** → reason **Recipient not available**. Also try **Other** with an empty note first. | *Other* without a note is refused with a clear message. With *Recipient not available* the job closes as a failed attempt. Location sharing stops. | | |
| 5.3 | R | *Message the customer* → **Failed attempt** (to sender). | French WhatsApp text with the reason. Send. | | |
| 5.4 | C | Track page and WhatsApp. | Amber "Tentative de livraison infructueuse: Destinataire absent" + "our team will contact you". No rider position on the map any more. | | |
| 5.5 | D | Board. | Job under **Problems** with the reason; drawer WhatsApp *Failed attempt* is offered too. (Don't send twice; just check it's there.) | | |

### Part 6: Reassign to courier B (D, R)

| # | Who | Do | Expect | ✅/❌ | Time |
|---|---|---|---|---|---|
| 6.1 | R | In the second browser (courier B): turn **On duty**. | | | |
| 6.2 | D | Open the job → **Assign** (reassign) → choose **Courier B**. Look at how the suggestions rank A and B. | Job → **Assigned**; history keeps courier A's attempt. Write how A and B were ranked. | | |
| 6.3 | R | Courier A's app (home-screen icon). | The job no longer shows as active for A (it should be in A's history as failed). | | |
| 6.4 | R | Courier B's browser. | Job appears for B. **Accept** → **Picked up** (allow location in this browser too) → **On my way**. | | |
| 6.5 | — | Think about it and write it down: did "Picked up" for courier B make sense, given the parcel was already with the rider? What would happen in real life (B collects from A, from the office)? | (Observation, no pass/fail.) | | |
| 6.6 | C | Track page. | Shows courier **B**'s first name now; live map follows B's phone. | | |

### Part 7: Deliver with POD and cash (R as courier B, C)

This time C answers.

| # | Who | Do | Expect | ✅/❌ | Time |
|---|---|---|---|---|---|
| 7.1 | R | **Delivered** → POD sheet. | Sheet asks for recipient name, photo, optional signature; cash is **prefilled** with COD + delivery fee. | | |
| 7.2 | R | Take the photo with the **camera** (not the gallery), ask C to sign with a finger, type C's name. Method **Cash**, amount as prefilled; C hands over the cash. | Camera opens from the browser; photo preview OK; signature pad usable with a finger. Write how long the upload took on mobile data. | | |
| 7.3 | R | Submit. | Job → Delivered. No delivery code asked (website booking). Location sharing stops. | | |
| 7.4 | R | *Message the customer* → **Delivered** (to sender). | French text with masked recipient name and time. Send. | | |
| 7.5 | C | Track page + WhatsApp + email. | "Livré, reçu par {masked name}", no rider card, no position, POD line. `local.delivered` email if an email was given. | | |
| 7.6 | R | Courier B → **Cash**. | Balance = the cash collected, "Hand over {amount} by {date 7 days later}". | | |
| 7.7 | R | Back at the office: **Record handover** → method Cash → full amount. Hand the cash to D. | Handover listed as pending. | | |

### Part 8: Finance (D)

| # | Who | Do | Expect | ✅/❌ | Time |
|---|---|---|---|---|---|
| 8.1 | D | Board → drawer of the job. | POD name, photo and signature open; timeline shows A's failed attempt and B's delivery; cash rows listed; WhatsApp and email history listed. | | |
| 8.2 | D | Document Center. | A **POD-YYYY-#####** document exists for the job and prints/downloads correctly. | | |
| 8.3 | D | Console → **Cash & Mobile Money** → *Waiting for Finance*. | The collection and the handover from courier B are listed with amounts, method, tracking ID. | | |
| 8.4 | D | Count the cash. **Confirm** the collection and the handover. | Both leave the list; courier B's balance goes to 0. | | |
| 8.5 | R | Courier B → Cash (pull to refresh / reopen). | Balance 0, handover confirmed. | | |
| 8.6 | D | *Daily report* → today → **Download CSV**; open it in Excel. | Courier B, the right amounts; accents and numbers display correctly in Excel. | | |

### Part 9: Wrap-up

1. Courier A and B: **Off duty**, sign out of courier B's browser.
2. Battery on the courier phone now: ____ % (and the time).
3. Rough mobile data used on the courier phone (Settings → Network → Data usage → Chrome): ____ MB.
4. Leave the test shipment where it is and send me its tracking ID. We decide afterwards whether to move it to the
   trash (the cash rows are real money that changed hands, so they stay).

---

## 4. Optional extras (only if there's time)

- **Delivery code:** D creates a job in the console (**Create job**) with a 4-digit delivery code, assigns courier A,
  and A enters a wrong code twice, then the right one. Check "tries left" on the board and the message on the phone.
- **Mobile money at the door:** on a second job, the customer pays by MTN MoMo / Orange Money to the company
  number; R records the transaction ID. In *Cash & Mobile Money* it shows under *mobile money recorded*, not in the
  courier's balance. Try **Reject** and look at the "Also charge to the courier" option (don't tick it unless
  you mean it).
- **Decline:** assign a job to courier A, A **declines**: the job goes back to *To assign*.
- **Alerts:** leave a confirmed job unassigned for 15 min (or an assigned one not accepted for 10 min) and check it
  appears under *Problems*.
- **English customer:** repeat Part 1 at `/local-delivery` in English and check the WhatsApp texts are in English.

## 5. Things to watch for the whole time

- Anything **slow** on mobile data (more than ~5 s for a page or a step): note the step and seconds.
- Any text in the **wrong language**, cut off, overlapping, or too small to read outdoors in sunlight.
- Buttons too small to tap with a thumb or with gloves.
- Any **phone number, exact address or full name** visible on the public track page (it shouldn't be).
- Anything that needed a **page refresh** to show up.
- Red errors in the laptop's DevTools Console (screenshot them).
- Whether the board's thresholds feel right for Buea: 15 min not assigned, 10 min not accepted, 2 min without a
  position, 15 km "near the pickup", the bike speed used for the ETA (compare ETA vs. real arrival time).

## 6. How to send me the findings

One line per finding, numbered, in this shape (a WhatsApp/text list or a document is fine):

```
F1 | step 4.3 | Customer phone (Tecno Spark 10, Android 13, Chrome 130, MTN 4G)
     Expected: marker updates every ~20 s
     Actual:   marker froze for 3 min after the rider went under Molyko bridge, then jumped
     How bad:  Blocker / Major / Minor / Idea
     Screenshot: yes (F1.jpg)   Time: 10:42
```

Also send: the tracking ID(s), the URL and build you tested, the device list from section 1, the timings you wrote
down, battery and data numbers, and the observation from step 6.5.

**How bad:**
- **Blocker:** the delivery couldn't continue or money/records are wrong.
- **Major:** works, but a courier or customer would get stuck, confused or misled.
- **Minor:** cosmetic, wording, slow but usable.
- **Idea:** not wrong, but would make it better.

I fix them in small commits (one finding or one closely related group per commit), Blockers first.
