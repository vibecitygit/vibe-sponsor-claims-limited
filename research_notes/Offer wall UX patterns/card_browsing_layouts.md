# Card browsing layouts for small catalogues (3 to 12 items): grid, masonry, list, carousel, hero

Note on evidence labels used below: **[Measured]** = a number or observation from a study, analytics set or usability test. **[Guideline]** = a recommendation from a research organisation or design system (expert judgement, usually informed by testing but not a reported measurement). **[Opinion]** = commentary without data. **[Snippet]** = taken from a search-result excerpt only; the primary page was not opened, so verify before quoting.

## Grid vs list vs masonry: scannability, comparison, scan paths; when masonry hurts

### Takeaway
The best primary source found (NN/g, 2016) says card layouts are less scannable than lists and poor for comparison because attributes do not sit in predictable positions; lists win for finding and comparing, cards/grids win for browsing mixed, image-led content. No empirical study of masonry (uneven-height) layouts was found; the case against masonry for a small comparable set rests on NN/g's reasoning (varying sizes weaken ranking and predictability) and on how the layout algorithm places items, not on measured data.

### Cited Findings
- [Guideline] "Card layouts are less scannable than lists." NN/g's example: finding a product's price is hard in a card layout and easy in a list, because list items put each element in a predictable position (Laubheimer, NN/g, 2016) — [NN/g Cards component](https://www.nngroup.com/articles/cards-component/)
- [Guideline] "Cards are better suited when users browse for information than when they search." (NN/g, 2016) — [NN/g Cards component](https://www.nngroup.com/articles/cards-component/)
- [Guideline] Cards are a poor choice for comparing options: they are "not structured in a predictable way from item to item", so users look back and forth; consistently structured lists support comparison better (NN/g, 2016) — [NN/g Cards component](https://www.nngroup.com/articles/cards-component/)
- [Guideline] "Cards allow for varying height to accommodate differing amounts or types of content" (width usually fixed), but varying sizes de-emphasise ranking, and cards take more space so fewer fit on screen, which raises short-term-memory load (NN/g, 2016) — [NN/g Cards component](https://www.nngroup.com/articles/cards-component/)
- [Guideline] Cards "work especially well in contexts where they provide summaries of many different kinds of content" (dashboards, aggregators); for homogeneous items NN/g recommends lists or grids instead (NN/g, 2016) — [NN/g Cards component](https://www.nngroup.com/articles/cards-component/)
- [Guideline] Baymard's public statement of the issue: "The layout of product lists and search results can significantly impact users' ability to scan and compare items." The detailed list-vs-grid findings are behind the Baymard Premium paywall and were not readable — [Baymard guideline 533](https://baymard.com/guidelines/533-list-layouts-for-mixed-product-catalogs)
- [Snippet][Guideline] A second Baymard guideline title/summary states that insufficient specs and attributes in list items hinder users from comparing products directly (list layout for spec-heavy products) — [Baymard guideline 2269](https://baymard.com/guidelines/2269-list-layout-for-spec-heavy-products)
- [Measured, text pages not card grids] NN/g eyetracking (Pernice, 2019) identifies F-pattern, spotted, layer-cake and commitment scanning on text pages; in the F-pattern users "fixate on the words toward the beginning of lines and toward the top of the page"; layer-cake (fixating headings, then reading under the relevant one) is "by far the most effective way in which users can scan pages". The article does not cover grid-specific scan paths — [NN/g Text scanning patterns](https://www.nngroup.com/articles/text-scanning-patterns-eyetracking/)
- [Fact] In CSS masonry ("grid lanes"), items are laid out "item by item ... each row of items loads into the column with the most room, causing a tightly packed layout without strict row tracks." MDN marks it experimental and "not Baseline because it does not work in some of the most widely-used browsers" (page read Nov 2026) — [MDN Masonry layout](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout/Masonry_layout)
- [Snippet][Opinion] Agency commentary: uniform card heights make cards "stack along a structured grid", giving "a faster path for users to follow"; variable heights suit exploratory browsing (Pinterest style) but not finding something quickly — [Aten Design Group, Careful with those cards](https://atendesigngroup.com/articles/careful-those-cards)
- [Snippet][Opinion] One commentator calls the Pinterest-style grid an anti-usability pattern for content-heavy sites — [Impressive Webs](https://www.impressivewebs.com/can-we-ditch-the-pinterest-style-grid-trend-yet/)
- [Snippet][Measured, vendor, low confidence] Vendor reports claim attention falls off down a list view while grid view distributes attention/clicks more evenly across positions (SLI Systems, one customer; date not verified) — [SLI Systems](https://www.sli-systems.com/blog/grid-vs-list-view-for-search-results.html)

### Inferences
- An offer wall is a homogeneous set (every card has the same attributes: brand, offer, value, terms, CTA). By NN/g's own rule that is list/uniform-grid territory, not heterogeneous-card territory. Masonry's only real benefit (packing items of genuinely different content length without gaps) is weak at 3 to 12 items.
- Masonry hurts most when (a) users need to compare the same attribute across cards (prices/discounts land at different vertical positions, so there are no rows to read along), (b) order carries meaning (shortest-column placement means visual position does not map cleanly to rank; a "featured first" intent can be diluted), (c) the set is small, so ragged column bottoms read as unfinished rather than as an endless wall, and (d) keyboard/screen-reader order (source order) diverges from the visual left-to-right, top-to-bottom order.
- If cards are kept, equal-height cards in a strict grid with attributes at fixed positions inside each card (logo top-left, value line, CTA at the bottom edge) recovers most of the list's predictability. On mobile, a single-column list of compact rows shows more offers per screen than tall cards, reducing the memory load NN/g flags.
- A defensible split: list (or uniform 2 to 3 column grid) when the task is "compare and pick"; masonry only when the content is image-led, heterogeneous and the task is inspiration browsing.

### Gaps
- No peer-reviewed or NN/g/Baymard eye-tracking study specifically on masonry/uneven-height card layouts was found. Claims that masonry "harms scan paths" are inference/opinion, not measured.
- Baymard's detailed list-vs-grid findings (which product types suit each, test percentages) are paywalled; not verified.
- NN/g's "lawn-mower" scanning pattern for cells/comparison tables was not confirmed in the article opened; do not cite it from these notes.
- The vendor claims on attention distribution (grid vs list) were not verified at source and come from large e-commerce result sets, not 3 to 12 items.

## Carousels and horizontal rails: discoverability, interaction rates, when acceptable

### Takeaway
Homepage marketing carousels get very low click-through (about 1% of visitors at Notre Dame, 84% of those on the first slide), while contextual, user-driven swipe carousels on mobile can be heavily used (about 72% of visitors interacted with product-gallery carousels in one 7.5M-event dataset). Guidance converges on: never auto-advance, keep to about 5 items or 3 to 4 swipes, show a cut-off next item as the cue, and do not put must-see content only in later slides.

### Cited Findings
- [Measured] Notre Dame homepage carousel, mid-Oct 2012 to 22 Jan 2013: "Approximately 1% of visitors click on a feature"; 84% of clicks on position 1, the other four positions about 4% each (Runyon, 2013) — [Erik Runyon, Carousel interaction stats](https://erikrunyon.com/2013/01/carousel-interaction-stats/)
- [Measured] Same post, four other Notre Dame sites: three static carousels had 1.7 to 2.3% click rates with the top slot taking 48 to 62% of clicks; one auto-forwarding carousel had 8.8%, first feature 40%, second 18%, falling to 11% for the last (single site; do not generalise) (2013) — [Erik Runyon](https://erikrunyon.com/2013/01/carousel-interaction-stats/)
- [Conflict] Smashing Magazine restates the Notre Dame figures as 1.07% of visitors clicking, 89.1% of clicks on slide 1 and 3.1% on slide 2; Runyon's own post says about 1% and 84%. Prefer the primary post's wording — [Smashing Magazine 2015](https://www.smashingmagazine.com/2015/02/carousel-usage-exploration-on-mobile-e-commerce-websites/); [Erik Runyon 2013](https://erikrunyon.com/2013/01/carousel-interaction-stats/)
- [Measured] Mobile e-commerce product image carousels, several sites each with at least $20M annual online sales, 11 months, about 7.5M interaction events: about 72% of visitors interacted, 55% tapped a thumbnail, about 23% zoomed; 2.4 interactions per carousel impression; at least 64% of users who interacted with slide 1 went on to slide 2 (continuation about 69% thumbnails, 76% arrows, 64% swipes); 54.1% of zooms on slide 1, 15.7% on slide 2. Swiping was the least-used unique interaction type (Peatt, 2015). Author worked for a mobile-commerce vendor (Mobify); data is from product galleries, not offer rails — [Smashing Magazine 2015](https://www.smashingmagazine.com/2015/02/carousel-usage-exploration-on-mobile-e-commerce-websites/)
- [Guideline] Same article: use carousels for related content in a specific context; "The first slide has to sell the next slide to the user"; if users must see every item, do not use a carousel; "If you have a carousel, do not auto-advance" (2015) — [Smashing Magazine 2015](https://www.smashingmagazine.com/2015/02/carousel-usage-exploration-on-mobile-e-commerce-websites/)
- [Guideline, from usability testing] People often scroll past carousels, so later frames may be missed; use five or fewer frames; do not auto-forward on mobile; dots are a weak cue; for static carousels signal more content by cropping ("bleeding") the next item; show position and total; duplicate important carousel content elsewhere; consider a static hero instead of a rotating one (Pernice, NN/g, 2013, reviewed 2026) — [NN/g Designing effective carousels](https://www.nngroup.com/articles/designing-effective-carousels/)
- [Measured] In NN/g's eyetracking research "animated ads get looked at 27% of the time"; carousel content that looks like advertising risks being ignored (cited in the 2013 article) — [NN/g Designing effective carousels](https://www.nngroup.com/articles/designing-effective-carousels/)
- [Guideline] Mobile carousels: "we recommend that users should be able to reach the last item in the carousel in 3–4 steps"; "If you have a high number of items, use a list view instead"; "Dots are generally weak signifiers"; "The illusion of continuity... is a strong carousel cue" (a partly visible next item); "Make sure your carousel supports swipe"; leave a page gutter so edge swipes are not read as browser Back; offer arrows as a backup; "Important items used in hero carousels should be accessible in some other way" (Budiu, NN/g, 2018) — [NN/g Carousels on mobile devices](https://www.nngroup.com/articles/mobile-carousels/)
- [Guideline] Auto-forwarding carousels can cause dizziness or nausea for users with vestibular disorders (NN/g, 2020) — [NN/g Animation duration](https://www.nngroup.com/articles/animation-duration/)

### Inferences
- A horizontal rail is acceptable on mobile when: it is user-driven (no auto-advance), holds roughly 3 to 5 secondary items, shows a peeking next card, and nothing essential lives only inside it. With 12 offers a single rail breaks NN/g's 3 to 4 step rule; use a vertical list/grid instead, or a rail only for a short secondary group.
- On desktop, a rail hides items behind arrows for no space-saving reason at this catalogue size; showing all 3 to 12 items in a grid avoids the discoverability cost entirely.
- Position effects are steep (84% of clicks on slide 1 in the marketing case; about a third of users drop per step even in the favourable product-gallery case). Partners placed late in a rail will get materially less exposure, which matters commercially for a sponsor wall and is an argument for an all-visible layout or rotated ordering.

### Gaps
- Baymard's horizontal-scroll article (mobile horizontal scrolling areas, cut-off cue percentages) could not be read (page returned only a paywall headline), so no Baymard figures are included.
- No recent (2022+) public dataset of swipe-rail interaction rates on mobile offer/deal lists was found; the two measured datasets are from 2013 and 2015 and from different contexts (marketing banner vs product gallery).

## Featured/hero item plus secondary items: attention, choice overload, default/featured effects

### Takeaway
Choice-overload evidence does not justify trimming or hiding offers at 3 to 12 items: the famous jam study compared 6 vs 24 options, and a 2010 meta-analysis found a mean effect of about zero with high variance. Position data (first carousel slot taking 40 to 84% of clicks) and default-effect research suggest a featured slot will pull a disproportionate share of attention and choice, so a hero is a strong steering device rather than a neutral layout choice.

### Cited Findings
- [Snippet][Measured] Iyengar and Lepper (2000) jam study compared a 6-jam with a 24-jam display. The often-cited purchase rates of 30% vs 3% are conditional on stopping at the table; a working paper reports unconditional rates of 12% (limited) vs 2% (extensive) and warns the conditional figures are harder to interpret because of selection into who stops — [Columbia working paper](https://www.columbia.edu/~md3405/Working_Paper_24.pdf)
- [Snippet][Measured] Scheibehenne, Greifeneder and Todd (2010) meta-analysis: 63 conditions from 50 published and unpublished experiments (N = 5,036), "mean effect size of virtually zero but considerable variance between studies" — [Scheibehenne et al. 2010 PDF](https://abcwest.cogs.indiana.edu/pmwiki/pdf/scheibehenne.options.2010.pdf)
- [Snippet] A later meta-analysis (Chernev, Böckenholt and Goodman, 2015) is summarised as concluding that whether choice overload appears depends on context/moderators; a 2008 replication attempt of the jam study in a German supermarket reportedly found no effect — [arXiv 2212.03931, A better test of choice overload](https://arxiv.org/pdf/2212.03931); [Psychology Today 2016](https://www.psychologytoday.com/us/blog/pop-psych/201602/is-choice-overload-real-thing)
- [Measured] Position concentration: 84% of clicks on the first of five carousel features at ND.edu; 48 to 62% on the top slot in static carousels; 40% on the first feature of an auto-forwarding one (2013) — [Erik Runyon](https://erikrunyon.com/2013/01/carousel-interaction-stats/)
- [Guideline] A static hero image may beat a rotating carousel: it forces choice of a single stronger image and reduces distraction (NN/g, 2013) — [NN/g Designing effective carousels](https://www.nngroup.com/articles/designing-effective-carousels/)
- [Guideline] Prioritise the best items first, since "by showing the best items first, a prioritized sequence may draw users in" (NN/g, 2018) — [NN/g Carousels on mobile devices](https://www.nngroup.com/articles/mobile-carousels/)
- [Guideline] Varying card sizes de-emphasise ranking among the other items (NN/g, 2016) — [NN/g Cards component](https://www.nngroup.com/articles/cards-component/)
- [Snippet][Measured, different domain] Default effects: Johnson and Goldstein, "Do Defaults Save Lives?" (Science, 2003) showed large differences in organ-donor consent between opt-in and opt-out defaults; later work (a 58-study meta-analysis by Jachimowicz et al., and replications) finds default effects are real on average but variable in size and sometimes absent. Exact percentages were not verified at source — [The Decision Lab summary](https://thedecisionlab.com/insights/health/can-defaults-save-lives-the-power-of-default-options-on-life-saving-decisions); [replication poster 2020](https://dlab.sauder.ubc.ca/sjdm/presentations/2020-Poster-CHANDRASHEKAR-SUBRAMANYA-Defaulteffects-Framingeffects-Replication.pdf)

### Inferences
- At 3 to 12 offers there is no evidence-based need to reduce the visible set; show all of them. The value of a hero is orientation and steering ("start here"), not relief from overload.
- A featured-plus-rail layout compounds two position effects: the hero takes the largest share and rail items past the first visible two or three take the least. If partner fairness or even exposure matters, pair the hero with an all-visible secondary grid rather than a rail, or rotate the hero.
- A hero is most defensible when one offer is genuinely different in kind (highest value, time-limited, newest); labelling why it is featured keeps it from reading as an advert (NN/g's banner-blindness point) and keeps the pattern honest.
- Default-effect research concerns pre-selected options, not visual prominence; applying it to a "featured" card is an analogy, not a direct finding.

### Gaps
- No primary study was found measuring the effect of a visually featured card or "most popular"/"recommended" badge on choice share in small card sets; the search returned nothing on badges.
- The choice-overload and default-effect figures above come from search excerpts of the papers or secondary summaries, not from reading the original papers; verify before quoting exact numbers.
- No evidence found specific to hero + rail layouts versus uniform grids for small catalogues (e.g. A/B tests).

## Filters and chips for small catalogues; empty states

### Takeaway
Primary sources frame filters as a tool for shrinking long lists to a manageable set and give no minimum item count; none recommends filtering a 3 to 12 item set. For a small wall, filtering is at most a light convenience (a few category chips), and it should never be able to produce an empty result.

### Cited Findings
- [Guideline] Filters help users reduce a long list to a manageable set matching their criteria and create "a feeling of control and choice, even in the face of overwhelming numbers of options"; filter categories should be appropriate, predictable, jargon-free and prioritised. The article gives no item-count threshold and does not discuss zero results (Moran, NN/g, 2018) — [NN/g Filter categories and values](https://www.nngroup.com/articles/filter-categories-values/)
- [Snippet][Guideline] Baymard frames filtering as taking "a large generic product list" and narrowing it to "a small manageable selection"; horizontal filter bars can work well when only a small number of filter types is needed; important filters can be promoted above the product list — [Baymard horizontal filtering and sorting](https://baymard.com/blog/horizontal-filtering-sorting-design)
- [Snippet][Measured] Baymard benchmark: 20% of sites do not keep applied filters visible (figure from a search excerpt; year and sample not verified) — [Baymard allow applying multiple filter values](https://baymard.com/research-articles/allow-applying-of-multiple-filter-values)
- [Guideline] When users need to compare sections of content, hiding content behind interaction restricts "users' ability to combine information from multiple" sections (said of accordions, NN/g, 2023) — [NN/g Accordions on desktop](https://www.nngroup.com/articles/accordions-on-desktop/)

### Inferences
- With up to about 6 offers visible in one or two screens, filters add interaction cost and visual noise for no reduction benefit; omit them. Around 9 to 12 offers spanning clearly distinct categories, a single row of 3 to 5 category chips (with "All" selected by default) is reasonable as a shortcut, not a requirement.
- Because the catalogue is known in full, build chips only from categories that contain at least one offer, and show counts if helpful; this makes a zero-result state impossible. If offers can expire, the empty state should say so plainly and offer one action (clear filter / view all).
- Keep the selected chip state visible and make chips single-tap reversible; do not persist a filter across visits for a set this small. Grouping offers under category subheadings can replace filtering entirely and supports layer-cake scanning (NN/g 2019, cited above).

### Gaps
- Material Design 3 chips guidance and Shopify Polaris empty-state guidance could not be read (m3.material.io returned only a page title; the Polaris URL redirected to a general docs page). No design-system quotes on filter chips or empty states are included; anything said about chip behaviour above is inference.
- No source was found that states a numeric threshold below which filters should be removed.
- GOV.UK guidance on filters was not consulted.

## Detail views: modal vs inline expansion vs separate page; bottom sheets

### Takeaway
NN/g advises against modals for non-critical content, against opening a product-detail page inside a bottom sheet, and against accordions where users need to compare across items; bottom sheets suit short, transient interactions where the background stays relevant. For offer details that means: keep the comparison-critical facts on the card itself, and use a sheet/dialog only for short supplementary terms, with Back and a visible Close.

### Cited Findings
- [Guideline] Bottom sheets work best "when users are likely to need to refer to the main, background information"; keep interactions short; do not display complex content; do not use them to replace page-to-page flows (a product-detail page should not open in a sheet) (Laubheimer, NN/g, 2023; scope is mobile, desktop not addressed) — [NN/g Bottom sheets](https://www.nngroup.com/articles/bottom-sheet/)
- [Guideline, from observed user struggles] Common problems: no clear way to dismiss, stacked sheets, obscured background. Support Back to dismiss (users may not realise they are in a sheet); include a visible Close/X button because swipe-down grab handles are easy to miss and conflict with system gestures; do not stack sheets (NN/g, 2023) — [NN/g Bottom sheets](https://www.nngroup.com/articles/bottom-sheet/)
- [Guideline] A modal sheet "blocks any interactions with the background content while it is visible"; nonmodal sheets let users keep working with the background (NN/g, 2023) — [NN/g Bottom sheets](https://www.nngroup.com/articles/bottom-sheet/)
- [Guideline] Modal dialogs interrupt, add a dismissal step, raise cognitive load and can cover content needed to make the decision; use them for critical warnings, required input, or breaking up a task the user started. "Modal dialogs that are not directly related to users' goals are perceived as annoying." Avoid for complex decisions that need information the modal hides (Fessenden, NN/g, 2017) — [NN/g Modal and nonmodal dialogs](https://www.nngroup.com/articles/modal-nonmodal-dialog/)
- [Guideline] Accordions on desktop help "When users need only a few pieces of information on the page" and for independent sections such as FAQs; they hurt when users need most of the content, when content is sparse, and when users must compare sections (auto-closing accordions restrict "users' ability to combine information from multiple accordions at the same time"). "Avoid hiding any crucial information within the collapsed panels." On mobile, accordions help "When the content is long and the window size is small" (Wang, NN/g, 2023) — [NN/g Accordions on desktop](https://www.nngroup.com/articles/accordions-on-desktop/)

### Inferences
- A user-initiated "view details" modal is less objectionable than the unsolicited modals NN/g criticises, since it is directly tied to the user's goal; the remaining costs are hiding the other offers (breaking comparison) and the extra dismissal step.
- Decision rule for an offer wall: (1) everything needed to choose (brand, value, key condition, CTA) stays on the card; (2) short extras (terms, how to redeem, code) can go in inline expansion, which keeps neighbours visible and suits desktop; allow more than one card open so comparison is not blocked; (3) on mobile a modal bottom sheet is acceptable for the same short content, with Back support, a Close button and no stacking; (4) long or shareable detail (deep-linkable, with media) deserves its own page/route.
- Inline expansion inside a masonry or multi-column grid reflows neighbouring cards; in a single-column list it only pushes content down, which is another point for list on mobile.
- Whichever pattern is used, give the detail state a URL so partners and emails can link to a specific offer.

### Gaps
- No measured comparison (task time, conversion) of modal vs inline expansion vs separate page for card details was found; all of the above is guideline-level.
- NN/g's bottom-sheet article does not cover desktop; no primary guidance on desktop side panels/drawers for detail views was collected.
- Apple HIG (sheets) and Material (bottom sheets, dialogs) pages were not successfully read.

## Motion: durations, staggered entrances, hover lift, reduced motion, distraction

### Takeaway
NN/g recommends 100 to 500 ms for most UI animation (about 100 ms for simple feedback, 200 to 300 ms for large changes such as a modal, exits shorter than entrances, ease-out by default); IBM Carbon's tokens span 70 to 700 ms with the same logic. WCAG 2.3.3 (AAA) and web.dev say non-essential motion should be removable via prefers-reduced-motion; colour and opacity changes are not counted as motion animation.

### Cited Findings
- [Guideline] Most animations should last about 100 to 500 ms, aiming for "the shortest time that an animation can take without being jarring"; simple feedback (checkbox, toggle) about 100 ms; large screen changes such as a modal 200 to 300 ms; 400 ms reserved for big movements across large screens; a popup might take 300 ms to appear and 200 to 250 ms to disappear; small differences (250 vs 300 ms) are perceptible (Laubheimer, NN/g, 2020) — [NN/g Animation duration](https://www.nngroup.com/articles/animation-duration/)
- [Guideline] Use ease-out for most animations (it "makes the animation feel responsive"); linear motion feels unnatural; frequent animations should be shorter and subtler; hover animations may need a delay so they do not overwhelm; large exaggerated motion becomes annoying with repetition; respect reduced-motion settings (NN/g, 2020) — [NN/g Animation duration](https://www.nngroup.com/articles/animation-duration/)
- [Guideline] Parallax, carousel auto-forwarding and scroll-jacking can cause dizziness, nausea or migraines for people with vestibular disorders; flashing can trigger seizures (NN/g, 2020) — [NN/g Animation duration](https://www.nngroup.com/articles/animation-duration/)
- [Guideline] IBM Carbon duration tokens: fast-01 70 ms (buttons, toggles), fast-02 110 ms (fades), moderate-01 150 ms (small expansion, short-distance movement), moderate-02 240 ms (expansion, toasts), slow-01 400 ms (large expansion, important notifications), slow-02 700 ms (background dimming). Productive motion "creates a sense of efficiency and responsiveness, while remaining subtle and out of the way"; expressive motion is reserved for "occasional, important moments". "Strictly linear movement appears unnatural to the human eye." Productive entrance easing cubic-bezier(0, 0, 0.38, 0.9); standard cubic-bezier(0.2, 0, 0.38, 0.9); exit cubic-bezier(0.2, 0, 1, 0.9). "Make sure there is always a way to communicate similar messages statically." (page read Nov 2026) — [IBM Carbon Motion](https://carbondesignsystem.com/elements/motion/overview/)
- [Standard] WCAG 2.1 SC 2.3.3 Animation from Interactions (Level AAA): "Motion animation triggered by interaction can be disabled, unless the animation is essential." "Motion animation does not include changes of color, blurring, or opacity." Affected: people with vestibular disorders (dizziness, headaches, nausea) and users distracted by animation. Technique C39: use the CSS prefers-reduced-motion query — [W3C Understanding SC 2.3.3](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions.html)
- [Guideline] web.dev: under `prefers-reduced-motion: reduce`, minimise motion "preferably to the point where all non-essential movement is removed"; "Vestibular (inner ear) disorder reactions include dizziness, nausea, and migraine headaches"; CSS media query for CSS animation, `window.matchMedia()` with a change listener for JS-driven animation (Thomas Steiner; the page showed no date, believed 2019, unverified) — [web.dev prefers-reduced-motion](https://web.dev/articles/prefers-reduced-motion)

### Inferences
- A workable token set for an offer wall, consistent with NN/g and Carbon: hover/press feedback 100 to 150 ms; card expansion or sheet entrance 200 to 300 ms, exit about 200 ms; nothing above 400 ms; ease-out on entrances.
- Hover lift: keep it small (a few pixels of translate plus shadow change, about 150 ms) and treat it as an enhancement only, since touch devices have no hover; the pressed/focus state must carry the same affordance. A lift is a motion animation under WCAG 2.3.3, a shadow or colour change alone is not, so under reduced motion keep the shadow/colour change and drop the translate.
- Staggered entrances: none of the sources read gives numbers for stagger. Applying NN/g's "shortest time without being jarring" and "frequent animations should be shorter" suggests a short per-item delay with the total sequence capped inside the 400 to 500 ms ceiling, played once on first load only (not on every filter change or revisit), and replaced by an instant or opacity-only appearance under reduced motion. With 12 cards, cap the stagger to the first row or two.
- Motion distracts when it is automatic, repeated, large in travel, or resembles advertising (ties to the 27% animated-ad fixation figure above); an offer wall is already ad-adjacent content, so restraint matters more than usual.

### Gaps
- Material Design 3 motion tokens (easing/duration spec) could not be read (page returned only a title), so no Material numbers are quoted.
- No primary source with numeric guidance on stagger delay or hover-lift distance was read; Carbon's separate Choreography page was not opened.
- Duration ranges are expert guidelines; no controlled study measuring task or preference outcomes for specific card-entrance timings was found.
- Apple HIG motion guidance was not consulted.

## Logos on cards: displaying third-party brand logos consistently

### Takeaway
Only brand-guideline documents (not UX research) were found: they converge on proportional clear space, optical (not geometric) size matching, equal treatment for all partners, full colour as the preferred variant with monochrome/knock-out as the background-driven fallback. All findings here are from search excerpts and are convention, not measured evidence.

### Cited Findings
- [Snippet][Guideline] Scale co-displayed logos "to the same optical size for visual balance", starting by matching height or width; full-colour logo recommended whenever possible (Singapore Myinfo business branding guidelines; year not verified) — [Corppass Myinfo business logo usage](https://docs.corppass.gov.sg/myinfo-business/mib-branding-guidelines/logo-usage)
- [Snippet][Guideline] A grid for partner logos is used "to ensure partner logos of different proportions have optical balance when used next to each other"; if one logo would fall below minimum size, scale the grid for all logos rather than one (Natural History Museum brand style guide; year not verified) — [NHM brand style guide, accreditation](https://synthesys.info/content/nhm-brand-style-guide/en/home/accreditation.html)
- [Snippet][Guideline] Equal spacing and sizing for all partner logos (UK Space Agency branding guidelines; year not verified) — [GOV.UK UK Space Agency branding guidelines](https://www.gov.uk/government/publications/uk-space-agency-communications-resources/branding-guidelines)
- [Snippet][Guideline] Clear space defined proportionally to the logo (e.g. equal to its own height "x" beside partner logos) — [CAKE.com brand, partnerships](https://brand.cake.com/partnerships/)
- [Snippet][Guideline] Full-colour logo on light backgrounds; knock-out (reversed) version on dark backgrounds (Microsoft partner logo guidelines; year not verified) — [Microsoft partner logo guidelines PDF](https://assetsprod.microsoft.com/mpn/de-de/partner-logo-guidelines.pdf)
- [Snippet][Guideline] Monochrome (black or white) versions for single-colour use or when the background demands it — [Beyond Encryption logo usage](https://www.beyondencryption.com/logo-usage-guidelines)

### Inferences
- A fixed-ratio neutral tile (white or near-white in both themes) is the simplest way to honour most partners' rules at once: partners almost always supply a full-colour-on-light version, the tile guarantees the background they approved, and it avoids needing each partner's reversed logo for dark mode. Keep the tile white in dark mode but soften it (slightly off-white, rounded, inner padding) so it does not glare.
- Give every logo the same bounding box and inner padding (a safe area of roughly 12 to 20% of tile size is a reasonable house rule; this number is a suggestion, not sourced), `object-fit: contain`, and tune optical size per logo (wide wordmarks vs square marks) so no partner looks bigger than another.
- Monochrome logos give a calmer, more uniform wall but reduce recognition and usually need each partner's permission to recolour; full colour on neutral tiles is the lower-risk default for a sponsor/partner context. Never recolour, crop or add effects to a third-party logo without its guidelines allowing it.
- Prefer SVG, always pair the logo with the partner's name in text (alt text and visible label), since small or unfamiliar logos are not self-explanatory.

### Gaps
- No UX research (NN/g, Baymard, HCI) measuring recognition or trust for monochrome vs colour partner logos, or for white-tile treatments, was found.
- None of the brand-guideline pages was opened; quotes come from search excerpts and years were not verified. No design-system page (Polaris, Carbon, Material) specifically on third-party logo tiles was found.

## Light vs dark themes: readability and guidance for offering both

### Takeaway
NN/g's 2020 review of the research concludes that for people with normal vision light mode gives better reading performance most of the time, especially for small text, so light should be the default for a general audience, while a dark option should be offered for preference and for some low-vision users. NN/g did no original study; it summarises peer-reviewed work.

### Cited Findings
- [Review] "in users with normal vision, light mode leads to better performance most of the time"; "we don't recommend switching to dark mode by default if your target audience includes the general population"; "we strongly recommend that designers allow users to switch to dark mode if they want to"; use the OS dark-mode API where available (Budiu, NN/g, 2020) — [NN/g Dark mode vs light mode](https://www.nngroup.com/articles/dark-mode/)
- [Measured, via NN/g] Piepenbrock, Mayr, Mund and Buchner (2013, Ergonomics): younger (18 to 33) and older (60 to 85) adults performed better in light mode on both a visual-acuity and a proofreading task; no significant polarity effect on fatigue — [NN/g Dark mode vs light mode](https://www.nngroup.com/articles/dark-mode/)
- [Measured, via NN/g] Piepenbrock, Mayr and Buchner (2013, Human Factors): the light-mode advantage grew as font size decreased; participants did not perceive a readability difference even though performance differed — [NN/g Dark mode vs light mode](https://www.nngroup.com/articles/dark-mode/)
- [Measured, via NN/g] Dobres, Chahine and Reimer (2017, Applied Ergonomics; MIT AgeLab): glance-reading task; no significant polarity effect in simulated daytime; in simulated night-time light mode performed better, and small text in dark mode was much harder to read — [NN/g Dark mode vs light mode](https://www.nngroup.com/articles/dark-mode/)
- [Measured, via NN/g] Legge et al. (1985, Vision Research): all 7 low-vision participants with cloudy ocular media (e.g. cataract) read faster in dark mode; those with central-vision loss were unaffected by polarity — [NN/g Dark mode vs light mode](https://www.nngroup.com/articles/dark-mode/)
- [Measured, weak, via NN/g] Aleman, Wang and Schaeffel (2018, Scientific Reports), 7 participants: an hour of light-mode reading thinned the choroid (a myopia-related measure), dark-mode reading thickened it — [NN/g Dark mode vs light mode](https://www.nngroup.com/articles/dark-mode/)
- [Snippet][Conflict] Other sources report no significant readability difference between modes at default settings (Material Design readability research) and a small student study found dark mode better for news reading; evidence is mixed outside the Piepenbrock/Dobres line — [Material readability research](https://material.io/blog/readability-research); [Aalborg University student project](https://projekter.aau.dk/dark-mode-user-friendliness-in-mobile-news-reading-applications-d6109b46.html)

### Inferences
- Offer both themes, follow the OS setting (`prefers-color-scheme`) by default with a manual override, and treat light as the baseline for testing readability of small text such as offer terms.
- Because the light-mode advantage grows as text shrinks, dark-theme cards need slightly larger/heavier small text and must not rely on thin low-contrast captions; check WCAG contrast in both themes separately.
- Logo tiles interact with theme (see logos section): a white tile on a dark card is the highest-luminance element on screen, so tone it down to avoid glare while keeping the partner's approved background.
- Users did not perceive the performance difference in one study, so user preference for dark mode is a legitimate reason to offer it even though measured performance favours light.

### Gaps
- Material Design dark-theme guidance (surface colour, text opacities, desaturation) could not be read (page returned only a title); no numeric dark-theme specs are quoted.
- The primary papers were not opened; findings are as summarised by NN/g. Most studies used reading/proofreading tasks, not scanning a small set of cards, so transfer to an offer wall is an inference.
- No study newer than 2020 was verified at source.
