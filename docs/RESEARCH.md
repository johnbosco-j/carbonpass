# Research notes: rubric, judges, context

Collected 23 Oct 2026. These notes justify the choices in the other docs.

## 1. Official requirements

**Devpost** ([overview](https://ieee-climatechain-hack.devpost.com/), [rules](https://ieee-climatechain-hack.devpost.com/rules)):

- Deadline **25 Oct 2026, 19:30 IST (14:00 UTC)**.
- Four tracks:
  - Carbon Markets & Emissions Transparency: "lack of transparency, double counting, and complex verification reduce credibility"
  - Renewable Energy & Energy Trading
  - Sustainable Supply Chains: includes "digital product passports"
  - Climate Data & Environmental Monitoring
- Submit: track alignment, project description (problem, solution, target users, scale, adoption), demo video (3–5 min), public repo with docs, working prototype or mockup.
- The submission form has **no track selector** and **requires a file upload (≤35 MB)**, per a participant in the [discussion forum](https://ieee-climatechain-hack.devpost.com/forum_topics).
- Prizes: $1,500 / $1,000 / $500. IEEE certificates. Senior Member nomination for eligible winners.

**IEEE organizer page** ([cmte.ieee.org/turkiye-blockchain/hackatlon](https://cmte.ieee.org/turkiye-blockchain/hackatlon/)). This has details Devpost doesn't:

| Criterion | Weight |
|---|---|
| Climate Impact & Environmental Benefit | **30%** |
| Technical Innovation & Blockchain Implementation | **30%** |
| Feasibility & Implementation Quality | 10% |
| Data Security & Transparency | 10% |
| User Experience & Design | 10% |
| Scalability & Sustainability | 10% |

The page also asks for:
- Technical: a working prototype (testnet OK), repo + docs, **architecture diagram + technical spec**, a 3-min video, a **security & data-integrity assessment**.
- Impact and business: a problem statement + solution overview (≤2 pages), a **climate impact assessment with carbon-reduction projections**, an **implementation & adoption strategy**, a **scalability roadmap**, and user-testing results if any.

Our PDF dossier maps one-to-one onto this list.

**Timeline:** judging 26 Oct–6 Nov. Winners announced at **COP31** (Antalya, Türkiye, Nov 2026).

## 2. The forum (no organizer replies as of 23 Oct)

- "There are no points for UI/UX so is a frontend necessary?" Yes: the IEEE page weights UX at 10%.
- "Is an implemented blockchain component mandatory?" Unanswered. We include a real one regardless.
- Eligibility contradiction (overview says "students only", rules allow professionals). Unanswered.

## 3. Judges and what they'll look for

| Judge | Background | What to show them |
|---|---|---|
| Dr. Güven Fidan (lead) | Blockchain + AI, RWA tokenisation, carbon-footprint and green-energy tokenisation (per his CV) | A clear blockchain + AI division of labour; tokenised verified tonnes |
| Prof. Dr. Şeref Sağıroğlu | Chair, IEEE Blockchain Türkiye. AI & cybersecurity | Threat model, data integrity, trust and privacy |
| Prof. Dr. Sedat Akleylek | Post-quantum crypto, protocols, IoT security (Univ. of Tartu) | ML-DSA hybrid signatures, salted commitments |
| Dr. Kübra Seyhan | Post-quantum lattice-based protocols; PeerJ editor for crypto/blockchain | Same |
| Dr. Mubashar Iqbal | Blockchain security risk management, smart-contract languages, digital twins (Tartu) | A security risk table; contract invariants and tests |
| Prof. Gora Datta | Health-informatics standards (HL7, ISO/TC215). IEEE Blockchain TC leadership | Standards alignment: W3C VC, EU DPP, ISO 14064, CBAM data templates |
| Pradyumna Kodgi | Product manager at Oracle; co-lead | A complete user journey and a clear user value |
| Revanth Reddy Airre | Hippocratic AI; responsible-AI session speaker | A human in the loop, explainability, data minimisation |
| Others: Dr. Elvan Duman, Dr. Ahmet Soran, Assoc. Prof. Saadin Oyucu, Venkatesh Mohanram | IEEE Blockchain Türkiye / Orange County | A technically sound, honest prototype |

The organizers include the **Istanbul Chamber of Commerce** and the AI Ecosystem Association of Türkiye. Exporters are their members, so this is a natural pilot channel.

## 4. Policy context (why now)

- **EU CBAM definitive period started 1 Jan 2026.** The producer supplies verified embedded-emissions data. Unverified data means default values plus a **10% markup in 2026**. The first annual declaration (for 2026) is due **30 Sep 2027**, and certificate sales start 1 Feb 2027 ([Aither](https://aither.com/cbam-and-turkish-exporters-from-carbon-compliance-to-competitive-advantage/), [Alalea](https://alalea.com.tr/en/guides/cbam-and-ets/cbam-definitive-period)).
- **CBAM phase-in factor** (the share of embedded emissions charged as free allocation is phased out): 2.5% (2026), 5% (2027), 10% (2028), 22.5% (2029), 48.5% (2030), 61% (2031), 73.5% (2032), 86% (2033), 100% (2034).
- **Sector scope for chargeable emissions:** direct emissions only for iron & steel, aluminium and hydrogen. Direct + indirect for cement and fertilisers. Verify against Regulation (EU) 2023/956 Annex II.
- **Türkiye:** Climate Law No. 7552 (July 2025). Türkiye ETS pilot rules came in 2026, with **reporting-only obligations in 2026**. EXIST operates the market and registry ([ICAP](https://icapcarbonaction.com/en/news/turkiye-unveils-regulation-its-national-emissions-trading-system)).
- **India:** CCTS compliance credits expected to be issued and traded around Oct 2026 ([Outlook Business](https://www.outlookbusiness.com/news/india-to-launch-first-carbon-trading-programme-by-october-2026)). There's evidence CBAM is already reshaping EU–India steel trade ([Nature Climate Change 2026](https://www.nature.com/articles/s41558-026-02607-y)).
- **COP31:** Türkiye presidency in Antalya, with Australia as President of Negotiations ([PM of Australia](https://www.pm.gov.au/media/cop-be-hosted-turkiye-australia-leading-negotiations)).

- **Default values (Implementing Reg. (EU) 2025/2621, Annex I; direct emissions only):** Türkiye hot-rolled flat (CN 7208) **2.43** tCO₂e/t (2.67 with the 2026 mark-up); bars & rods (7213) 2.31; pig iron (7201) 1.85; India hot-rolled flat 4.28. Mark-up: 10% (2026), 20% (2027), 30% from 2028 ([greensutra.in, Türkiye](https://greensutra.in/?p=237174), [India](https://greensutra.in/question/cbam-default-values-indian-steel-exports/)). Corrections came in Reg. 2026/1740 (31 Jul 2026), so check the Official Journal before quoting.
- **Turkish industry position:** about 70% of Türkiye's steel is EAF. The Aegean exporters' association says the defaults don't reflect low-carbon production and that verifier accreditation bodies are unclear ([SteelOrbis, 1 Apr 2026](https://www.steelorbis.com/steel-news/latest-news/turkish-steel-sector-cbam-default-values-fail-to-reflect-low-carbon-production-1445161.htm); also [Eurometal](https://eurometal.net/turkish-steel-sector-cbam-default-values-fail-to-reflect-low-carbon-production/)).

> Several CBAM figures come from consultancy blogs. Before quoting numbers in the video, check them against the primary EU texts (Reg. 2023/956 and its implementing regulations on default values).

## 5. What wins (judges & past winners)

- Lead with the problem. Show something working within about 90 seconds. One flow, one "aha" moment. Be honest about what's mocked ([JetBrains judging notes](https://blog.jetbrains.com/ai/2026/06/how-to-win-a-hackathon-notes-from-the-judging-table/)).
- Explain why blockchain is needed. Judges lose interest when a database would do. A polished UI, a clean README (the first thing judges see), a narrated walkthrough video, and a live demo matter. Submit even if unfinished ([Chainlink](https://chain.link/blog/blockchain-hackathon-tips)).
- The video is often all judges see. Leave hours to record ([Devpost](https://info.devpost.com/blog/6-tips-for-making-a-hackathon-demo-video)).
- Crowded genres to avoid: carbon-credit NFT marketplaces, P2P solar trading, generic sustainability dashboards.

## 6. Frontend reference

AI LABS, ["How To Use Claude Design To Build Beautiful Sites"](https://www.youtube.com/watch?v=bBlY5YOsKN8): design.md → design system → wireframes → prototype → animations → hand off to Claude Code via the Claude Design MCP → responsiveness review. The DESIGN.md format comes from Google Labs ([spec](https://github.com/google-labs-code/design.md)).
