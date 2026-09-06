# PierOne public website image plan

Placeholder photography lives in `sites/pierone/public/images/placeholders/`. Slots are defined in `sites/pierone/lib/images.ts`. Every slot is marked `replacementNeeded: true` until PierOne licenses production photography.

The logo concept board is **reference only**. It is not used as a website image. Logo variants are in `sites/pierone/public/brand/` and `components/brand/logo.tsx`.

Avoid for all replacements: handshake clichés, people staring at camera, headset support, fake smiling group shots, camouflage, flags-as-background, marina/shipping clichés, and AI-generated faces.

License status for current files: **Unsplash placeholders — replace before production** with licensed editorial photography (or Unsplash/Getty/Adobe Stock with recorded license).

| Page | Section | File | Subject | Aspect | Alt-text concept | Search keywords | License |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Home | Hero | `home-hero-v2.jpg` | Technical professional in industrial/utility setting, candid | 4:5 | Technical professional reviewing operations in an industrial facility | industrial engineer workforce; utility technician professional | Replacement needed |
| Home | Reserved / strategy | `home-strategy.jpg` | Leadership/workforce planning discussion | 16:9 | Leaders reviewing workforce plans around a table | executive planning meeting; workforce strategy discussion | Replacement needed |
| Home | Workforce intelligence | `home-infrastructure.jpg` | Utility / infrastructure / manufacturing | 16:9 | Industrial infrastructure and technical operations | power plant infrastructure; advanced manufacturing floor | Replacement needed |
| Home | Reserved / transition | `home-transition.jpg` | Service member in civilian technical role | 3:2 | Professional discussing a civilian career path | veteran professional workplace; military veteran engineer office | Replacement needed |
| Home | Military talent | `military-talent-v5.jpg` | U.S. Navy gas turbine technician performing engine maintenance aboard ship | 3:2 | Navy technician performing engine maintenance on a U.S. warship | navy engine room technician; shipboard engineering maintenance | Replacement needed |
| Home | Careers band | `careers.jpg` | Authentic technical workplace | 16:9 | Technical professionals in field/operations | field technician professional; industrial workplace candid | Replacement needed |
| Military Talent | Hero | `military-talent-v5.jpg` | Same as home military | 3:2 | Same | Same | Replacement needed |
| SkillBridge | Hero | `skillbridge.jpg` | Career transition / opportunity, civilian setting | 16:9 | Professional reviewing career materials | career coaching professional; transitioning professional office | Replacement needed |
| Workforce Development | Hero | `workforce-development.jpg` | Operations planning / manufacturing | 16:9 | Operations team reviewing production and workforce plans | manufacturing operations planning; industrial team planning | Replacement needed |
| Careers | Hero | `careers.jpg` | Authentic workplace | 16:9 | Same as home careers band | Same | Replacement needed |
| About | Hero | `about.jpg` | Professional collaboration | 16:9 | Professional collaboration in an advisory setting | professional collaboration meeting; consulting discussion | Replacement needed |
| Contact | Intro | `contact.jpg` | Clean consultation setting | 3:4 | Quiet professional setting for a workforce advisory conversation | executive office conversation; advisory consultation | Replacement needed |
| Industries | Energy & Utilities | `industry-energy.jpg` | Energy/utilities operations | 3:2 | Energy and utilities operations environment | electrical substation professional; utility operations | Replacement needed |
| Industries | Advanced Manufacturing | `industry-manufacturing.jpg` | Manufacturing floor | 3:2 | Advanced manufacturing floor | advanced manufacturing factory; precision manufacturing | Replacement needed |
| Industries | Infrastructure | `industry-infrastructure.jpg` | Civil/utility infrastructure | 3:2 | Infrastructure project in progress | civil infrastructure construction; bridge infrastructure professional | Replacement needed |
| Industries | Industrial & Technical Operations | `industry-operations.jpg` | Plant/operations | 3:2 | Industrial and technical operations environment | industrial operations technician; plant operations | Replacement needed |
| Industries | Data Centers | `industry-data-centers.jpg` | Data center operations | 3:2 | Data center technical environment | data center operations; server room technician | Replacement needed |
| Industries | Aerospace & Defense | `industry-aerospace-v3.jpg` | Military fighter aircraft (F-16), not a commercial or business jet | 3:2 | Military aircraft in a defense aviation environment | military fighter jet; defense aircraft hangar; F-16 operations | Replacement needed |
| Industries | Engineering | `industry-engineering.jpg` | Engineers reviewing plans | 3:2 | Engineers reviewing technical plans | engineers reviewing blueprints; technical design review | Replacement needed |
| Industries | Supply Chain & Logistics | `industry-logistics.jpg` | Warehouse/logistics operations | 3:2 | Supply chain and logistics operations | warehouse logistics operations; freight operations professional | Replacement needed |

## Logo assets (not photography)

| File | Use | Production note |
| --- | --- | --- |
| `/brand/logo-icon.svg` | Icon mark | Matches WorkforceOS `PierOneMark` path |
| `/brand/logo-horizontal.svg` | Static lockup fallback | Prefer React `Logo` on the website |
| `/brand/logo-stacked.svg` | Footer/print fallback | Prefer React `Logo variant="stacked"` |
| `/brand/logo-monochrome.svg` | Mono icon | Slate `#6B7280` |

Replace static SVGs with designer vectors if wordmark metrics must match the concept board exactly. Do not redesign the icon.
