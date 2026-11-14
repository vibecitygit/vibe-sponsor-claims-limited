# Claiming UX evidence: what makes people claim and redeem coupons, perks and partner offers, and what erodes trust

Reading notes for the writer:
- Researched 2026-11-14. Each finding is labelled **[Observed]** (something measured or directly stated by the source) or **[Guidance]** (expert/regulator recommendation without a quantified test).
- Source-quality flags: **[Primary]** = I read the source page itself; **[Secondary]** = figure reached me through a summary, press coverage or search snippet and was NOT checked against the original; **[Vendor]** = commercially interested source.
- No study I found tests an "offer wall for event ticket holders" directly. Everything here is transferred from e-commerce, grocery couponing, mall m-coupons and regulator casework. Treat the Inferences sections as hypotheses to A/B test, not established facts.

## 1. Value framing: benefit-first vs brand-first, percent vs absolute, freebies vs discounts

### Takeaway
"Free" is the best-evidenced frame: a zero price draws disproportionate demand and, unlike a deep discount, does not cheapen the item. Percent-vs-amount framing ("Rule of 100") is real but weaker than popularly claimed, and I found no direct study testing benefit-first vs brand-first headlines on offer cards.

### Cited Findings
- **[Observed, Secondary]** Shampanier, Mazar & Ariely (Marketing Science, 2007; Boston Fed working paper 06-16, 2006): when one option's price drops to zero, the share choosing it rises far more than cost-benefit predicts; the working paper describes the share choosing the less attractive chocolate as increasing "dramatically" in the zero-price condition. The authors attribute it mainly to affect (free feels good); the effect went away when subjects were forced to deliberate. — [Boston Fed WP 06-16](https://www.bostonfed.org/publications/research-department-working-paper/2006/how-small-is-zero-price-the-true-value-of-free-products.aspx); [Decision Lab summary](https://thedecisionlab.com/insights/business/impact-free-consumer-decision-making)
- **[Caveat]** Exact figures for this experiment are reported inconsistently across secondary sources (e.g. Ariely's popular account: 69% chose the free Hershey's Kiss, up from 27%; other summaries give different splits, probably from different experiments in the paper). Do not quote a specific percentage without checking the paper. — [Decision Lab summary](https://thedecisionlab.com/insights/business/impact-free-consumer-decision-making)
- **[Observed, Secondary]** Palmeira & Srivastava, "Free Offer ≠ Cheap Product" (Journal of Consumer Research, Dec 2013): people offered spaghetti free with a jar of sauce were later willing to pay $2.95 on average for it; those offered it for $0.50 were willing to pay only $1.83. Authors' conclusion: low discounted prices devalue a product more than giving it free, because a free item's value is inferred from the brand giving it. — [CosmeticsDesign-Europe report of the study](https://cosmeticsdesign-europe.com/Article/2013/08/21/Study-finds-freebies-increase-brand-value-perception-for-consumers)
- **[Observed, Secondary]** "Rule of 100" (popularised by Jonah Berger, *Contagious*; based on a study by researchers at EGADE Business School and Babson College): for low-priced items a percentage ("25% off") looks larger than the equal amount ("$5 off"); above roughly $100 the absolute amount looks larger. — [Jonah Berger, "Fuzzy math"](https://jonahberger.com/fuzzy-math-what-makes-something-seem-like-a-good-deal/)
- **[Caveat, Secondary]** A Science Says summary of the underlying paper notes that for lower-priced items the percent-advantage was directional only — the difference was not statistically significant. — [Science Says](https://app.sciencesays.com/p/amount-vs-percentage-discount)
- **[Weak, Vendor]** Blog claims such as "same discount, different framing converts 25% better" cite no study; disregard. — [growthsuite.net](https://www.growthsuite.net/questions/what-s-the-psychological-difference-between-save-10-vs-20-off)
- **[Observed, Primary — qualitative usability research, no sample size]** NN/g (Kim Flaherty, 2019): "Users were suspicious if discounts were not clearly listed"; it is "clearer to users if the item was simply listed as free" than shown as a charge then subtracted; users must be able to "see savings and understand how the total is calculated". — [NN/g, Applying Discounts and Promotions](https://www.nngroup.com/articles/applying-discounts/)
- **[Observed, Secondary]** Danaher et al. (Journal of Marketing Research, 2015), mall m-coupon field trial: "traditional" coupon features such as face value remained the most important driver of redemption, and snack-food coupons performed especially well. — [Monash research portal record](https://research.monash.edu/en/publications/where-when-and-how-long-factors-that-influence-the-redemption-of-)

### Inferences
- Lead each card with the concrete benefit ("Free latte", "25% off") rather than the partner name. This is an inference from (a) zero-price/affect findings, (b) face value being the top redemption driver in Danaher 2015, and (c) NN/g's finding that unclear savings create suspicion — not from a head-to-head test. The Palmeira finding suggests the brand still matters as the *value anchor* for a freebie, so the logo/name should be adjacent, not absent.
- Prefer a genuine freebie over a small discount where the partner can afford it: a free low-cost item (snack, drink) is likely to out-pull an equivalent-value discount and does not signal a cheap product. Low-ticket food/drink being the best performers in a mall trial fits event-adjacent partners.
- For low-ticket partners (under ~£/$100) use percent; for high-ticket use the absolute saving — but the effect is small, so treat as a default, not a rule. Never show a charge-then-subtract; state the end state ("Free", "£5 off").
- Since the zero-price effect is affect-driven and fades under deliberation, it should work best on a glanceable wall; long conditions next to "Free" may dampen it, which argues for short, plain terms (see section 4).

### Gaps
- No study found that directly tests benefit-first vs brand-first headline order on offer/coupon cards. Needs an A/B test.
- Leads I could not verify to a primary URL (do not cite as fact): a Journal of Marketing paper "When More Is Less" (reported: consumers preferred a 50% bonus pack to an economically equivalent 33% discount; 73% more hand lotion sold in a bonus pack than at a comparable discount in store), and a 2017 Roll & Pfeiffer study (150 students; variety seekers prefer free gifts, repeat buyers prefer discounts). One earlier paper reportedly found free items had no markedly stronger effect than equivalent discounts, so the freebie advantage is not uniform.
- Nothing found from Baymard, CXL or Think with Google specifically on offer-card value framing.

## 2. Scarcity and urgency: "N left", expiry dates, countdowns

### Takeaway
Scarcity cues do raise purchase intent on average, but meta-analyses find the *urgency* variants (limited quantity/limited time) are the least reliable, and regulators in the US, UK and EU treat any counter or timer that is not literally and substantively true as deceptive. A real, enforced limit shown plainly is defensible; anything that resets, is decorative, or overstates scarcity is a legal and trust liability.

### Cited Findings
Effectiveness
- **[Observed, Secondary]** Barton, Zlatevska & Oppewal (Journal of Retailing, Dec 2022): meta-analysis of 416 effect sizes from 131 studies; which scarcity type works depends on the product — demand-based scarcity is most effective for utilitarian products, supply-based for experiences, time-based for high-involvement products. — [Monash research portal record](https://research.monash.edu/en/publications/scarcity-tactics-in-marketing-a-meta-analysis-of-product-scarcity/)
- **[Observed, Secondary]** Ladeira et al. (Psychology & Marketing, 2023) meta-analysis: purchase likelihood for a scarce product is greater under excess-demand framing than restricted-supply framing, "but not urgency (limited quantity and limited time) scarcity". — [Oxford Brookes repository copy](https://radar.brookes.ac.uk/radar/file/609e47cf-0367-4af7-82ac-9ab7154e2a2c/1/Psychology%20and%20Marketing%20-%202023%20-%20Ladeira.pdf)
- **[Observed, Secondary]** A systematic review of 78 scarcity-message articles calls the quantity-vs-time comparison inconclusive (some studies favour quantity cues, some time cues, some neither). — [Lancaster eprints](https://eprints.lancs.ac.uk/id/eprint/233666/1/ScarcityMsgSLR_PURE.pdf)
- **[Observed, Secondary]** Danaher et al. (JMR 2015): m-coupon redemption happens much faster than for traditional coupons; the authors suggest shorter expiry periods to signal urgency. — [Monash research portal record](https://research.monash.edu/en/publications/where-when-and-how-long-factors-that-influence-the-redemption-of-)
- **[Observed, Secondary]** Luguri & Strahilevitz, "Shining a Light on Dark Patterns" (Journal of Legal Analysis, 2021): aggressive dark patterns "generated a powerful backlash among consumers", mild ones did not; less-educated subjects were significantly more susceptible to mild dark patterns. — [Journal of Legal Analysis](https://academic.oup.com/jla/article/13/1/43/6180579)

Prevalence of abuse
- **[Observed, Primary]** Mathur et al., Princeton (2019), crawl of ~11K shopping sites: 1,818 dark-pattern instances on 1,254 sites; countdown timers 393 instances / 361 sites; limited-time messages 88 / 84; low-stock messages 632 / 581; high-demand messages 47 / 43; activity messages 313 / 264; 234 instances on 183 sites were outright deceptive (e.g. timers that reset on reload). — [Princeton Web Transparency project page](https://webtransparency.cs.princeton.edu/dark-patterns)

Regulators
- **[Guidance, Primary]** FTC staff report *Bringing Dark Patterns to Light* (15 Sep 2022) lists, under misleading consumers, "countdown timers designed to make consumers believe they only have a limited time to purchase" when the offer is not actually time-limited; it also condemns burying key terms in "dense terms of service documents" and hiding disclosures behind tooltips (LendingClub case). — [FTC press release](https://www.ftc.gov/news-events/news/press-releases/2022/09/ftc-report-shows-rise-sophisticated-dark-patterns-designed-trick-trap-consumers)
- **[Guidance, Secondary — law-firm summaries]** The same report's false-beliefs category covers false low-stock and high-demand messages, e.g. "Only two left in stock — order now" when stock is plentiful, and baseless timers that vanish or reset at zero. — [Arnall Golden Gregory](https://www.agg.com/news-insights/publications/the-ftc-blacklists-dark-patterns/); [Venable](https://www.venable.com/insights/blogs/2022/09/the-ftc-brings-more-light-to-dark-patterns-in-new)
- **[Guidance, Secondary]** UK CMA open letter to online businesses (March 2023; sources give 28 or 29 March): sixteen "do not" examples, including countdown timers implying an offer ends when a comparable offer will remain available, and checkout timers that restart on expiry or refresh; claims that are literally true can still be misleading. — [Travers Smith](https://www.traverssmith.com/knowledge/knowledge-container/cma-warns-online-b2c-businesses-against-misleading-urgency-and-pricing-claims/); [Wiggin](https://www.wiggin.co.uk/insight/the-cma-issues-compliance-advice-to-online-businesses-regarding-the-use-of-urgency-and-price-reduction-claims-and-recommends-an-urgent-review-of-practices/)
- **[Observed, Primary]** CMA v Wowcher (press release 19 July 2024) — the closest regulatory precedent, as Wowcher is a deals/voucher site. Concerns: countdown timers plus "Running out!" and "In high demand!" claims that "risk giving the misleading impression that products shortly won't be available", while the overwhelming majority of products stayed at a similar price after the timer ended; pre-ticked boxes enrolling customers in paid VIP membership. Undertakings (no admission of breach): only clear, accurate timers, removal of the permanent homepage timer, scarcity/popularity claims must match actual stock and sales figures, no pre-ticked boxes; ~£4,271,000 refunded to over 870,000 customers. — [GOV.UK](https://www.gov.uk/government/news/cma-secures-over-4-million-in-refunds-for-wowcher-customers)
- **[Guidance, Secondary]** EU: UCPD Annex I point 7 blacklists false urgency ("in all circumstances unfair") — a countdown that resets at zero or a "last chance" offer that continues on the same terms may breach it. DSA Article 25 bans dark patterns on online platforms but Art. 25(2) carves out practices already covered by the UCPD, so urgency claims are policed under consumer law. Polish regulator reportedly fined Amazon €7.48m over countdown timers. — [Ashurst](https://www.ashurstperkinscoie.com/en/insights/trick-or-treat-regulators-unwrap-holiday-discount-tactics/); [Arthur Cox](https://www.arthurcox.com/knowledge/eu-digital-fairness-fitness-check-shines-light-on-deceptive-patterns/)

### Inferences
- A limited-claims counter ("12 of 50 left") is acceptable, and likely useful, only when it is driven by the real inventory figure, the cap is actually enforced, and the offer genuinely ends when it hits zero. The Wowcher undertakings give the practical test: every scarcity or popularity claim must be reproducible from actual stock and claim data.
- Prefer a plain expiry date/time ("Valid until Sun 23:59", "Event day only") over an animated countdown. A countdown is defensible only for a hard, non-resetting deadline; it must not restart on refresh, per user, or roll into an equivalent offer. A permanent "ends soon" timer on the wall is exactly what Wowcher had to remove.
- Expect modest lift at best: the meta-analytic evidence says quantity/time urgency is the weakest scarcity lever, while popularity/demand framing ("213 claimed") is stronger — but demand claims also have to be true.
- Short validity windows are natural for an event context (event-day or event-weekend) and match how quickly mobile coupons are redeemed; this is genuine urgency rather than manufactured.
- Avoid pressure copy ("Hurry!", "Running out!"), pre-ticked opt-ins to partner marketing, and stacking several urgency cues: the backlash evidence is for aggressive patterns, and the audience are ticket holders the organiser needs to keep.

### Gaps
- I did not read the FTC report PDF, the CMA open letter or the Commission's 2021 UCPD guidance directly; the wording above is from the FTC press release, the CMA's own Wowcher release and law-firm summaries. Legal sign-off should check the originals.
- Could not confirm the reported 2022 EU sweep of online shops or its figures.
- No scarcity-specific effect sizes retrieved from Luguri & Strahilevitz; no meta-analysis found that models trust or persuasion knowledge as a moderator of scarcity effects.
- No quantified evidence on how a *truthful* remaining-count affects claim rate for free perks specifically (studies are mostly purchase-intent, paid goods).

## 3. Friction: steps, forced sign-up, code-reveal vs one-tap save; redemption rates and breakage

### Takeaway
Show the value before asking for anything, and make claiming a single action: gated value and manual code handling are the two best-documented friction points. Digital coupon redemption rates are in the single digits in mass grocery couponing, so most claimed offers go unused unless the post-claim path is deliberately designed.

### Cited Findings
Sign-up walls
- **[Guidance, Primary — based on observation in "many usability tests", no statistics]** NN/g (Raluca Budiu, 2014): requiring an account before access is justified only in rare cases; don't put login walls at the start; show real content first; "use the reciprocity principle when considering a login wall" — give value, then ask; ask for login at the moment the user decides to act. Users in tests appeared more annoyed by login walls than by other issues. — [NN/g, Login Walls](https://www.nngroup.com/articles/login-walls/)
- **[Observed, Primary page / survey self-report]** Baymard: 19% of users say they abandoned a checkout because the site required account creation; recommended fix is to delay account creation to the confirmation step. (Older Baymard-derived figures of 37% circulate; year and question wording differ.) — [Baymard, Reduce Cart Abandonment](https://baymard.com/blog/reduce-cart-abandonment)

Codes and applying offers
- **[Observed, Primary — qualitative]** NN/g (2019): "When it comes to coupons, the easier to apply the better." Users repeatedly tried to tap promotional banners that were not interactive; codes embedded in images could not be copied; recommendation is to let users apply an offer with a click or "simply apply any applicable codes to the cart for them". Incentives delivered by email arrive too late — one user called it "so frustrating"; rewards for an action should appear immediately. — [NN/g, Applying Discounts and Promotions](https://www.nngroup.com/articles/applying-discounts/)
- **[Observed/Guidance]** Baymard: promo-code fields distract and prompt some users to leave to hunt for coupons off-site; in testing, multiple participants failed to notice a 10% code displayed directly above the promo field; ideally discounts are applied automatically. — [Baymard guideline 615](https://baymard.com/guidelines/615-how-to-display-promotional-fields); [Baymard, sales UX best practices](https://baymard.com/blog/10-sales-ux-best-practices)
- **[Weak, Vendor]** "A visible empty discount field causes 25–40% of customers to leave checkout" — unsourced; do not use. — [Uniqodo](https://www.uniqodo.com/post/the-empty-coupon-box-paradox)

Redemption rates
- **[Observed, Secondary — aggregator citing Inmar]** 2024 US: digital coupons redeemed at 5.92% (up 12.8% on 2023); 53.4% of all coupons redeemed were digital vs 40.8% from print. — [Capital One Shopping coupon statistics](https://capitaloneshopping.com/research/coupon-statistics)
- **[Conflict]** Another aggregator citing Inmar gives ~7.0% for digital vs 0.45% for paper inserts. The two figures do not match; the order of magnitude (digital mid-single digits, paper inserts under 1%) is consistent. — [Voxbooster](https://voxbooster.com/blog/digital-couponing-statistics-2026)
- **[Observed, Secondary]** Inmar: load-to-card became the most-redeemed method in 2020, 29.3% of redemption volume. — [Benzinga/Inmar release](https://www.benzinga.com/pressreleases/21/04/g20699469/digital-coupons-take-number-one-spot-in-redemption-methods-for-first-time-ever-with-their-use-span)
- **[Observed, Secondary]** Mills & Zamudio (JAMS, 2018): the same $0.50 mobile coupon had a redemption probability from as low as 30% to as high as 80% depending on coupon/context characteristics (in-store, opted-in shoppers). — [Springer copy](https://springerlink.bibliotecabuap.elogim.com/content/pdf/10.1007/s11747-018-0592-7.pdf)
- **[Observed, Vendor case study]** Cadbury/Mac's in-store Wi-Fi campaign: 14% of shoppers who opened a mobile coupon redeemed it, vs a quoted 2–3% for typical email coupons. — [Retail Dive / Mobile Commerce Daily](https://www.retaildive.com/ex/mobilecommercedaily/mondelez-captures-14pc-mobile-coupon-redemption-rate-for-in-store-shoppers)
- **[Illustrative only]** Gift-card breakage: Milliman uses ~10% never redeemed as a worked example and stresses there is no industry-standard curve. — [Milliman](https://us.milliman.com/en/insight/gift-card-liability-overlooked-risk)

### Inferences
- Ticket holders are already identified, so the wall should need no further sign-up: browse freely, one tap to claim, with identity carried from the ticket. Any partner data capture (email, marketing consent) should come after the claim and be optional and unticked.
- One-tap "Save/Claim" that puts the offer in a saved state beats "reveal code, copy, paste elsewhere". Where a partner requires a code, show it as selectable text with a copy button and keep it retrievable — never in an image, never only by email.
- Deliver instantly on screen; email/SMS is a backup copy, not the delivery channel.
- Redemption benchmarks span 1–7% (untargeted mass coupons) to 14–80% (opened, in-context, near the point of use). A wall for ticket holders with nearby partners sits closer to the in-context end, but designers should assume a large claim-to-redeem gap and report claims and redemptions as separate metrics.
- With capped inventory, unredeemed claims are a cost to other attendees as well as to the sponsor (a claim that is never used removes one from the pool). That supports claim expiry/release rules, provided they are stated up front.

### Gaps
- No controlled study found comparing code-reveal vs one-tap save, or measuring claim rate against number of steps, for offer walls. Step-count evidence is from checkout research and qualitative testing.
- Could not access Inmar's or Vericast's own reports; all coupon statistics are second-hand and conflict slightly. No Juniper Research figures retrieved.
- No reliable breakage rate for free claimed perks (as opposed to paid gift cards).

## 4. Trust signals: terms, expiry clarity, how to redeem, logos, verification

### Takeaway
The documented trust killers are hidden or surprising conditions and savings that don't materialise as promised; the documented trust builders are stating restrictions up front and showing exactly what the user gets. Evidence for logos and "verified" badges on third-party offers specifically is thin.

### Cited Findings
- **[Observed, Primary — qualitative]** NN/g (2019): "Users were suspicious if discounts were not clearly listed"; restrictions "should also be communicated" and visible deals "can mention exclusions" so users know whether they qualify; one user abandoned a purchase when an advertised multi-buy offer did not show at the promised price in the cart. — [NN/g, Applying Discounts and Promotions](https://www.nngroup.com/articles/applying-discounts/)
- **[Guidance, Primary]** FTC (2022): burying key limitations in "dense terms of service documents" and hiding disclosures behind tooltip buttons are dark patterns (LendingClub example). — [FTC press release](https://www.ftc.gov/news-events/news/press-releases/2022/09/ftc-report-shows-rise-sophisticated-dark-patterns-designed-trick-trap-consumers)
- **[Observed, Primary]** CMA/Wowcher (2024): scarcity and popularity claims must reflect actual stock and sales; pre-ticked boxes risk "customers being signed up without their full understanding". — [GOV.UK](https://www.gov.uk/government/news/cma-secures-over-4-million-in-refunds-for-wowcher-customers)
- **[Guidance, Secondary]** NN/g commitment-levels model: a site must first show relevance and good intent before requesting personal information; forced email registration assumes trust that has not been earned. — [NN/g, Commitment Levels](https://nngroup.com/articles/commitment-levels)
- **[Observed, Secondary]** Beeck & Toporowski (IJRDM, 2017): mobile offer messages can be highly effective when the user is near the shop, but high perceived risk attached to such a message can deter people from using mobile coupons. — [Emerald](https://emeraldinsight.com/insight/content/doi/10.1108/IJRDM-09-2016-0171/full/html)
- **[Observed, Secondary]** Palmeira & Srivastava (JCR 2013): the value of a free item is inferred from the brand giving it. — [CosmeticsDesign-Europe](https://cosmeticsdesign-europe.com/Article/2013/08/21/Study-finds-freebies-increase-brand-value-perception-for-consumers)
- **[Weak, commentary]** Expired or unreliable codes on aggregator sites are described as a common reason shoppers do not return, but no survey percentage is given. — [Search Engine Journal](https://searchenginejournal.com/promo-code-search-affiliate-revenue-leak/586554)

### Inferences
- Put the three or four conditions that decide whether the offer is usable on the card or the first detail view, in plain words: what you get, valid until when, where, minimum spend/exclusions, one per ticket. A link to full terms can follow, but the material limits must not live only there or in a tooltip.
- State the claim rules of a capped offer before the tap (e.g. "50 available, one per ticket, claim held until Sunday"). An offer that turns out to be gone, expired or conditional after claiming is the equivalent of NN/g's discount that did not apply — the point where users abandon and distrust the host, not just the partner.
- A short "How to redeem" (2–3 steps: show QR at till / enter code at checkout / where) on every offer answers the perceived-risk concern and reduces staff confusion at the partner.
- Show partner name and logo next to the benefit: it supplies the value anchor for a freebie and tells the user who they are dealing with. The organiser's implied endorsement means a failed partner offer damages the event brand, so offers should be confirmed live with the partner; expired or exhausted offers should be visibly marked or removed, never left looking claimable.

### Gaps
- No quantified study found on partner logos, "verified offer" badges or last-checked dates for third-party offers; no Baymard/NN/g trust research specific to coupon or perks walls.
- No survey figure found for how many users are frustrated by expired codes.
- Nothing found on how terms placement (card vs detail vs link) changes claim or redemption rates.

## 5. Post-claim: what helps redemption

### Takeaway
Redemption is driven by proximity and timing: mobile offers are used quickly and near the place of delivery, and push reminders give a measurable but modest lift. Wallet/saved-state and reminder benefits are plausible but supported mainly by vendor surveys of stated intent.

### Cited Findings
- **[Observed, Secondary — abstract/portal record]** Danaher, Smith, Ranasinghe & Danaher (Journal of Marketing Research 52(5), 2015): two-year mall trial, ~8,500 panel members, almost 144,000 text m-coupons, 38 stores, 134 different coupons. Location and time of delivery significantly influence redemption; redemption times are much shorter than for traditional coupons, so the authors recommend shorter expiry lengths; face value remains the most important factor. — [Monash research portal record](https://research.monash.edu/en/publications/where-when-and-how-long-factors-that-influence-the-redemption-of-)
- **[Observed, Secondary]** Randomised field experiment, "Mobile Push vs. Pull Targeting and Geo-Conquesting" (Information Systems Research): mobile push increased coupon redemption rates by 6.0% versus pull, with larger effects where store density is higher and heterogeneity by app experience. — [INFORMS](https://pubsonline.informs.org/doi/abs/10.1287/isre.2021.0206)
- **[Stated intent, Vendor survey]** Airship/Urban Airship (2017): 64% of respondents said they would be more likely to use a coupon with a lock-screen expiry reminder (77% of 18–34s); 63% more likely to visit a store with a reminder when nearby. Not measured behaviour. — [Airship newsroom](https://www.airship.com/newsroom/urban-airship-analysis-of-retailers-mobile-wallet-coupons-and-loyalty-cards/)
- **[Observed, Vendor case study]** Geofenced messaging campaign (SnipSnap/Infillion) reported a 20% open rate with location messaging vs 5–7% without. — [casestudies.com](https://www.casestudies.com/company/infillion/case-study/snipsnap-customer-case-study)
- **[Observed, Secondary]** Mills & Zamudio (JAMS 2018): redemption probability for an identical mobile coupon ranged roughly 30%–80% with in-store context and coupon characteristics. — [Springer copy](https://springerlink.bibliotecabuap.elogim.com/content/pdf/10.1007/s11747-018-0592-7.pdf)
- **[Observed, Primary — qualitative]** NN/g (2019): offers the user has earned should be visible and applicable in place, not sent away to an inbox. — [NN/g, Applying Discounts and Promotions](https://www.nngroup.com/articles/applying-discounts/)

### Inferences
- Give claimed offers a persistent, obvious home ("My offers", next to the ticket) and change the card to a clear claimed state that shows what to do next. The ticket is the thing attendees will open on the day, so attaching offers to it is the cheapest "wallet".
- Put the redemption artefact (QR or code) and the practical details together: partner address/stand location, distance or map link, opening hours, expiry. Location and timing are the best-evidenced redemption drivers.
- Time reminders to proximity and deadline — on arrival at the venue or event morning, and once before expiry. Expect single-digit percentage lift from push, not a transformation; keep reminders few and opt-in, since perceived intrusiveness/risk works against use.
- Offer "Add to Apple/Google Wallet" as an optional extra rather than the core mechanism; evidence for it is intent-only.
- If scans are used, QR-at-till also yields the redemption data that the sponsor needs; without a scan or unique code, redemption is unmeasurable.

### Gaps
- No rigorous study found of Apple/Google Wallet passes' effect on redemption, of saved-state vs no saved-state, or of QR vs typed code at the point of redemption.
- No reminder-timing experiment for coupons found (the Inman/McAlister expiry literature was searched for but not retrieved).
- I read only the abstract-level record of Danaher 2015 and snippets of the ISR paper; effect sizes by distance/time were not extracted.

## 6. Accessibility and mobile specifics

### Takeaway
WCAG 2.2 has direct implications for offer cards: time limits must be communicated without relying on a timer the user cannot control, tap targets need a minimum size, and claim confirmations must be announced. Mobile research adds that offers must be tappable, codes copyable, and nothing essential hidden in images or tooltips.

### Cited Findings
- **[Standard, Primary]** WCAG 2.2 SC 2.2.1 Timing Adjustable (Level A): users should be able to turn off, adjust or extend time limits; timed content need not be adjustable if there is an alternative that does not rely on a timer. — [W3C Understanding SC 2.2.1](https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html)
- **[Standard, Primary/secondary summary]** WCAG 2.2 SC 2.5.8 Target Size (Minimum) (AA): pointer targets at least 24×24 CSS px, or smaller with sufficient spacing; inline links exempt. — [W3C, What's New in WCAG 2.2](https://w3.org/WAI/standards-guidelines/wcag/new-in-22/)
- **[Standard, Secondary]** WCAG SC 4.1.3 Status Messages (AA): status messages such as confirmations or cart updates must be conveyed to assistive technology without moving focus. — [TetraLogical, What's new in WCAG 2.2](https://tetralogical.com/blog/2023/10/05/whats-new-wcag-2.2)
- **[Observed, Primary — qualitative]** NN/g (2019): users tapped promotional banners expecting them to act; codes inside images could not be copied; offers in a sidebar were taken for ads and ignored (banner blindness). — [NN/g, Applying Discounts and Promotions](https://www.nngroup.com/articles/applying-discounts/)
- **[Observed, Primary — qualitative]** NN/g (2014): mobile users could not get past login walls because passwords were saved on another device/channel. — [NN/g, Login Walls](https://www.nngroup.com/articles/login-walls/)
- **[Guidance, Primary]** FTC (2022): disclosures hidden behind tooltip buttons were treated as buried terms. — [FTC press release](https://www.ftc.gov/news-events/news/press-releases/2022/09/ftc-report-shows-rise-sophisticated-dark-patterns-designed-trick-trap-consumers)
- **[Observed, Secondary]** Luguri & Strahilevitz (2021): less-educated participants were significantly more susceptible to mild dark patterns — manipulative urgency falls hardest on more vulnerable users. — [Journal of Legal Analysis](https://academic.oup.com/jla/article/13/1/43/6180579)

### Inferences
- Express expiry and remaining quantity as text ("Ends Sun 23:59", "12 left"), not only as an animated countdown, colour or progress bar; a ticking timer should not be the sole carrier of the deadline, and a live counter should not be re-announced to screen readers on every change. An offer's genuine expiry is not a session time limit in the 2.2.1 sense, but the same principle (don't make users race an uncontrollable clock) applies to any hold/reservation timer in the claim flow.
- Make the whole card or a clearly labelled button the tap target (comfortably above the 24px minimum; platform guidance is larger), with claim state changes ("Claimed", "Sold out") announced as status messages and not signalled by colour alone.
- Render benefit, terms and codes as real text (scalable, selectable, translatable, readable by screen readers); logos need text alternatives naming the partner. Avoid hover-only tooltips for terms — they fail on touch and hide material conditions.
- Design the redemption screen for use at a counter: large QR/code, high contrast, works with poor venue connectivity (cached once claimed). This last point is a practical inference, not something a cited source tested.
- Give offers styling that reads as content, not as an advert strip, to avoid banner blindness.

### Gaps
- Did not read the W3C Understanding pages for 2.5.8 and 4.1.3 directly; wording above is from W3C's summary page and a specialist's summary — check the normative text before writing acceptance criteria.
- No published usability research found on accessibility of coupon/offer UIs specifically (screen-reader testing of claim flows, QR alternatives for blind users, cognitive load of terms).
- No evidence retrieved on offline/poor-connectivity behaviour of coupon redemption at venues, or on Think with Google mobile research for offers.
