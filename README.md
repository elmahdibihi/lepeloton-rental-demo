# Le Peloton Café — Paris Bike Rental Redesign (Demo)

Fast, zero-build static storefront redesigning [Le Peloton Café's Bike Rental Manager portal](https://app.booking.bike.rent/book?store=lepelotoncafe&offering=rental) based on a runtime & bundle audit.

- **Live demo (GitHub Pages):** `https://elmahdibihi.github.io/lepeloton-rental-demo/`
- **Also Vercel-ready:** Zero build step; deploy this directory directly with `vercel --prod` or import the GitHub repo into Vercel (`Framework Preset: Other`).

## Key Fixes Implemented
1. Instant price, stock count, and frame size visibility above the fold (defaults to tomorrow 09:00, 1 day).
2. Flat pedals (€0) by default instead of globally pre-checking `+€5 LOOK KEO`.
3. Per-bike size, pedal, accessory, and optional rider label inside one configurator modal (removes the ALL-CAPS cart warning).
4. Corrected model sizing & spec copy (fixed Ridley sizing pasted onto Eddy Merckx, out-of-stock sizes, `XL only` badge).
5. Category-scoped accessories (`Baby seat` only on Parisian City Bike, `Garmin mount` only on Road & Gravel, fixed typo).
6. Single horizontal category pill bar instead of duplicate category grids.
7. Clean accessibility & contrast (`#141413` on `#F4C826`, labeled buttons, Escape/focus handling, removed dead Account menu).
8. Shop opening windows enforced client-side (`Mon–Fri 08:00–16:00`, `Sat–Sun 08:00–17:30`).
9. Bilingual **EN / FR** toggle without reloading.
10. 1-click handoff to the live BRM Stripe checkout plus an interactive prototype guest checkout summary.

## Local Run & Verification
```bash
node test.mjs
python3 -m http.server 8080
```
