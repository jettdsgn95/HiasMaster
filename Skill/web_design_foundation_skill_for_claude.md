# WEB DESIGN FOUNDATION SKILL

## Skill Name
Web Design Foundation: Grid, Golden Ratio, Layout, Typography & Color

## Purpose
This skill helps Claude understand and apply fundamental Web Design principles when analyzing, designing, reviewing, or generating web layouts, landing pages, dashboards, portals, and brand-based UI systems.

Claude should use this skill to:
- Build clean, structured, professional web layouts.
- Apply grid systems correctly.
- Use proportion and spacing to create visual balance.
- Define typography hierarchy.
- Create consistent color systems.
- Improve UI readability, hierarchy, and brand consistency.
- Produce design specifications that developers and designers can execute.

---

# 1. Core Design Mindset

A professional website should be built from a clear visual system, not from random decoration.

The main priorities are:

1. Clarity
2. Hierarchy
3. Consistency
4. Readability
5. Responsive structure
6. Brand alignment
7. Conversion or task completion

A strong web design should answer these questions:

- What should the user look at first?
- What should the user read next?
- What action should the user take?
- Is the layout easy to scan?
- Is the spacing consistent?
- Is the typography readable?
- Are the brand colors used with discipline?
- Can the layout adapt well to desktop, tablet, and mobile?

---

# 2. Grid System

## 2.1 Definition

A grid is a structural system used to organize content on a web page. It helps align text, images, cards, buttons, forms, and interface components.

A good grid system creates:
- Order
- Balance
- Consistency
- Responsive flexibility
- Visual professionalism

---

## 2.2 Recommended Grid by Device

### Desktop
- Use a 12-column grid.
- Container width: 1200px to 1280px.
- Gutter: 24px to 32px.
- Page margin: 64px to 120px.

### Tablet
- Use an 8-column grid.
- Gutter: 16px to 24px.
- Page margin: 32px to 48px.

### Mobile
- Use a 4-column grid or single-column layout.
- Gutter: 16px.
- Page margin: 16px to 24px.

---

## 2.3 Grid Components

### Column
Vertical divisions used to place content.

Common desktop examples:
- Hero split: 6 columns + 6 columns
- Content with sidebar: 8 columns + 4 columns
- Three-card section: 4 columns + 4 columns + 4 columns
- Four-card section: 3 columns + 3 columns + 3 columns + 3 columns

### Gutter
The space between columns.

Recommended:
- Desktop: 24px or 32px
- Tablet: 16px or 24px
- Mobile: 16px

### Margin
The space between the screen edge and the content container.

Recommended:
- Desktop: 80px to 120px
- Laptop: 48px to 80px
- Tablet: 32px to 48px
- Mobile: 16px to 24px

### Container
The maximum width area that holds the main content.

Recommended:
- Corporate website: 1200px to 1280px
- Landing page: 1140px to 1320px
- Dashboard: can be full width, but must use inner padding

---

## 2.4 Spacing System

Use a consistent spacing scale. Avoid arbitrary spacing.

Recommended spacing system:

```text
4px / 8px system
```

Common values:
- 4px
- 8px
- 12px
- 16px
- 24px
- 32px
- 40px
- 48px
- 64px
- 80px
- 96px
- 120px

Usage guide:
- Small text spacing: 4px to 8px
- Title to paragraph: 12px to 24px
- Component spacing: 16px to 32px
- Card gap: 16px to 32px
- Block spacing: 32px to 64px
- Section spacing: 80px to 120px

---

## 2.5 Claude Behavior for Grid

When Claude creates or reviews a web layout, it should:
- Define the grid structure clearly.
- Specify column distribution.
- Specify container width.
- Specify gutter and margin values.
- Explain responsive behavior.
- Avoid vague phrases like "make it balanced" without structural details.

Example output:

```text
Desktop:
- Container: 1200px
- Grid: 12 columns
- Gutter: 24px
- Hero layout: 6 columns for text, 6 columns for image

Tablet:
- Grid: 8 columns
- Hero layout stacks into 4 + 4 or single column depending on content

Mobile:
- Single-column layout
- Margin: 20px
- Section padding: 48px vertical
```

---

# 3. Golden Ratio

## 3.1 Definition

The golden ratio is approximately:

```text
1 : 1.618
```

It is often used to create harmonious visual proportions.

In practical web design, this can be simplified as:

```text
62% / 38%
```

---

## 3.2 Practical Application

### Two-Column Layout

Instead of always using 50/50, Claude may recommend:

```text
62% content / 38% visual
```

or:

```text
38% text / 62% visual
```

Use this when one side needs stronger emphasis.

---

### Hero Section

For a strong hero layout:

```text
Text area: 5 to 6 columns
Visual area: 6 to 7 columns
```

If the visual should dominate:

```text
Text: 38%
Visual: 62%
```

If the message should dominate:

```text
Text: 62%
Visual: 38%
```

---

### Typography Scale

Golden ratio can inspire typography scale, but it should not be applied rigidly.

Example theoretical scale:
- Body: 16px
- H4: 26px
- H3: 42px
- H2: 68px

In real web design, use a softer and more practical scale:

```text
12 / 14 / 16 / 18 / 20 / 24 / 32 / 40 / 48 / 56 / 64 / 72
```

---

### Visual Hierarchy

Use proportion to create emphasis:
- Headline should be significantly larger than body text.
- Primary CTA should be visually stronger than secondary actions.
- Main visual should be larger than supporting visuals.
- Important cards or numbers can be scaled up for emphasis.

---

## 3.3 Claude Behavior for Golden Ratio

Claude should not overuse or force the golden ratio. It should use it as a practical proportion guide.

Claude should use golden ratio when:
- Splitting hero sections.
- Creating asymmetrical layouts.
- Designing feature sections.
- Balancing text and image blocks.
- Creating premium, editorial, or luxury-style layouts.

Claude should avoid:
- Applying golden ratio mechanically to every element.
- Making typography too large or impractical.
- Sacrificing usability for mathematical proportion.

---

# 4. Layout Principles

## 4.1 Definition

Layout is the organization of interface elements on a page, including text, images, cards, buttons, forms, charts, tables, and navigation.

A strong layout should:
- Be easy to understand.
- Guide the user’s eye.
- Support the page objective.
- Create visual hierarchy.
- Adapt across screen sizes.

---

## 4.2 Visual Hierarchy

Visual hierarchy determines what the user notices first, second, and third.

Claude should create hierarchy using:
- Font size
- Font weight
- Color contrast
- Spacing
- Position
- Image size
- Button prominence
- Card emphasis
- Background contrast

Recommended hierarchy for a hero section:

```text
1. Eyebrow / label
2. Main headline
3. Supporting description
4. Primary CTA
5. Secondary CTA or supporting proof
6. Hero visual
```

---

## 4.3 Alignment

Alignment creates order.

Recommended:
- Use left alignment for long-form content.
- Use center alignment for simple emotional hero sections.
- Use grid alignment for cards, service blocks, and feature sections.
- Align buttons with text blocks.
- Align icons and text on a consistent axis.

Avoid:
- Random floating elements.
- Inconsistent card widths.
- Buttons that do not align with content.
- Text blocks that ignore the grid.

---

## 4.4 Proximity

Related items should be close together. Unrelated groups should be separated with larger spacing.

Example:
- Card icon, title, and description should be visually grouped.
- Separate cards should have clear gaps.
- A section title should be closer to its description than to the next section.

---

## 4.5 White Space

White space improves clarity and perceived quality.

Use more white space for:
- Premium corporate websites.
- Education brand websites.
- Landing pages.
- Executive presentations on web.
- Clean dashboards.

Avoid:
- Crowded text.
- Too many cards in one row.
- Tight margins.
- Excessive visual noise.

---

## 4.6 Consistency

Claude should maintain consistency in:
- Grid
- Spacing
- Font sizes
- Button styles
- Icon styles
- Card styles
- Border radius
- Shadow
- Color usage
- Section structure

A website feels professional when similar components behave and look the same.

---

# 5. Common Web Layout Types

## 5.1 Hero Layout

Typical structure:

```text
Eyebrow / label
Headline
Description
CTA button
Hero image / visual
```

Common types:
- Text left, image right
- Centered text with background visual
- Split screen
- Full-screen hero
- Editorial hero
- Dashboard preview hero

Recommended specs:
- Container: 1200px to 1280px
- Grid: 12 columns
- Text: 5 to 6 columns
- Visual: 6 to 7 columns
- Headline: 56px to 72px desktop
- Body: 16px to 20px
- CTA height: 48px to 56px

---

## 5.2 Feature Section

Typical structure:

```text
Section label
Title
Description
Feature grid
CTA
```

Recommended:
- 3 cards per row on desktop.
- 2 cards per row on tablet.
- 1 card per row on mobile.
- Card padding: 24px to 32px.
- Icon size: 40px to 56px.

---

## 5.3 Card Layout

Cards are used for:
- Services
- Products
- Features
- Benefits
- Pricing
- Blog posts
- Team members
- Case studies
- Dashboard data

Recommended card structure:

```text
Icon or image
Title
Description
CTA or status
```

Card rules:
- Keep equal height where possible.
- Use consistent padding.
- Use consistent border radius.
- Avoid too much text.
- Use icon style consistently.

---

## 5.4 Dashboard / Portal Layout

Typical structure:

```text
Sidebar
Topbar
Main content
Filter area
Data cards
Table / Kanban / Chart
```

Recommended specs:
- Sidebar: 240px to 280px
- Topbar: 64px to 80px
- Main content padding: 24px to 32px
- Card gap: 16px to 24px
- Table row height: 56px to 64px
- Filter bar height: 48px to 56px

Dashboard priorities:
- Data clarity
- Easy filtering
- Clear statuses
- Fast scanning
- Low decoration
- Strong information hierarchy

---

## 5.5 Landing Page Layout

Recommended sequence:

```text
1. Hero
2. Problem
3. Solution
4. Benefits
5. Process
6. Social proof / testimonials
7. Pricing or package
8. FAQ
9. Final CTA
10. Footer
```

Claude should adapt this sequence based on the brief.

---

# 6. Typography

## 6.1 Definition

Typography is the system of using text in design. It includes:
- Font family
- Font size
- Font weight
- Line height
- Letter spacing
- Paragraph spacing
- Text color
- Hierarchy

Typography strongly affects readability, brand tone, and perceived professionalism.

---

## 6.2 Font Selection

Recommended font choices by style:

| Style | Recommended Fonts |
|---|---|
| Corporate / Modern | Montserrat, Inter, Gotham, Helvetica |
| Premium / Editorial | Playfair Display, Cormorant, Georgia |
| Tech / SaaS | Inter, DM Sans, Manrope |
| Education / Friendly | Nunito, Mulish, Lato |
| Luxury | Canela, Cormorant, Didot |

For a modern education brand:
```text
Heading: Montserrat SemiBold / Bold
Body: Inter or Montserrat Regular
```

---

## 6.3 Font Size System

Recommended desktop scale:

| Element | Size |
|---|---|
| Caption | 12px |
| Small text | 14px |
| Body | 16px |
| Large body | 18px |
| H5 | 20px |
| H4 | 24px |
| H3 | 32px |
| H2 | 40px to 48px |
| H1 | 56px to 72px |
| Hero headline | 64px to 96px |

Recommended mobile adjustment:

| Desktop | Mobile |
|---|---|
| 72px | 40px to 48px |
| 56px | 36px to 40px |
| 48px | 32px to 36px |
| 40px | 28px to 32px |

---

## 6.4 Font Weight

Recommended:
- Body: 400
- Label: 500 or 600
- Button: 600 or 700
- Heading: 700 or 800
- Highlight number: 800

Common weight values:

```text
Regular: 400
Medium: 500
SemiBold: 600
Bold: 700
ExtraBold: 800
```

---

## 6.5 Line Height

Recommended:

| Text Type | Line Height |
|---|---|
| Large heading | 1.05 to 1.2 |
| Medium heading | 1.2 to 1.3 |
| Body text | 1.5 to 1.7 |
| Caption | 1.4 to 1.5 |

CSS example:

```css
body {
  font-size: 16px;
  line-height: 1.6;
}
```

---

## 6.6 Letter Spacing

Recommended:
- Large heading: -1% to -3% if needed
- Body: default
- Uppercase label: 0.04em to 0.08em
- Uppercase button: 0.02em to 0.04em

CSS example:

```css
.section-label {
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
```

---

## 6.7 Typography Hierarchy Template

Use this as a practical web typography system:

```text
Eyebrow / Label:
- 12px to 14px
- SemiBold
- Uppercase
- Letter spacing: 0.06em to 0.08em

H1:
- 56px to 72px desktop
- 40px to 48px mobile
- Bold
- Line height: 1.05 to 1.15

H2:
- 40px to 48px desktop
- 32px to 36px mobile
- Bold
- Line height: 1.15 to 1.25

H3:
- 28px to 32px
- SemiBold or Bold

Body:
- 16px to 18px
- Regular
- Line height: 1.5 to 1.7

Caption:
- 12px to 14px
- Regular or Medium

Button:
- 14px to 16px
- SemiBold
```

---

# 7. Color System

## 7.1 Definition

A color system defines how colors are used consistently across a website.

A professional web color system should include:
- Primary color
- Secondary color
- Accent color
- Neutral colors
- Background colors
- Text colors
- Semantic colors
- UI state colors

---

## 7.2 Color Roles

### Primary Color
The main brand color.

Used for:
- Main CTA
- Important links
- Active states
- Key highlights
- Brand moments

### Secondary Color
The supporting brand color.

Used for:
- Secondary sections
- Supporting icons
- Alternative CTA
- Navigation accents
- Background blocks

### Accent Color
A limited highlight color.

Used for:
- Small emphasis
- Campaign-specific moments
- Badges
- Special highlights

Do not overuse accent colors.

### Neutral Colors
Used for:
- Text
- Background
- Border
- Divider
- Card surface
- Input fields

Recommended neutral structure:

```text
Black: #111111
Dark Gray: #333333
Gray: #666666
Light Gray: #E5E7EB
Background: #F8F9FA
White: #FFFFFF
```

### Semantic Colors
Used for UI states:

| State | Color Type |
|---|---|
| Success | Green |
| Warning | Yellow / Orange |
| Error | Red |
| Info | Blue |
| Disabled | Gray |

---

## 7.3 60-30-10 Rule

Use the 60-30-10 rule to balance colors:

```text
60% neutral / background
30% secondary or supporting color
10% primary accent
```

Example for a red and navy education brand:

```text
60% white / light gray
30% navy
10% red accent
```

This keeps the design branded but not visually overwhelming.

---

## 7.4 Contrast

Contrast is critical for readability and accessibility.

Claude should ensure:
- Text has enough contrast against background.
- Small text does not use overly light gray.
- Buttons have strong contrast.
- Error and warning states are clearly visible.
- Important CTAs stand out.

Recommended:
- Body text: #111111 to #333333
- Muted text: #666666 or darker
- White background with dark text
- Red or navy buttons with white text

Avoid:
- Light gray text on white.
- Red text on navy unless tested carefully.
- Low-contrast buttons.
- Too many saturated colors in one section.

---

## 7.5 Color Tokens

When preparing UI specifications for development, Claude should define color tokens.

Example:

```css
:root {
  --color-primary: #BA110F;
  --color-secondary: #191970;
  --color-bg: #FFFFFF;
  --color-surface: #F8F9FA;
  --color-text: #111111;
  --color-muted: #666666;
  --color-border: #E5E7EB;
  --color-success: #16A34A;
  --color-warning: #F59E0B;
  --color-error: #DC2626;
  --color-info: #2563EB;
}
```

Use functional names, not only color names.

Good:
```text
--color-primary
--color-text
--color-surface
--color-border
```

Avoid:
```text
--red
--blue
--gray1
```

---

# 8. Recommended Web Design Specs

## 8.1 Desktop Specs

```text
Container: 1200px to 1280px
Grid: 12 columns
Gutter: 24px to 32px
Section padding: 80px to 120px
Page margin: 64px to 120px
Hero height: 640px to 800px
```

---

## 8.2 Tablet Specs

```text
Container: 100%
Grid: 8 columns
Gutter: 16px to 24px
Page margin: 32px to 48px
Section padding: 64px to 80px
```

---

## 8.3 Mobile Specs

```text
Container: 100%
Grid: 4 columns or single-column layout
Gutter: 16px
Page margin: 16px to 24px
Section padding: 48px to 64px
```

---

# 9. Design Review Checklist

Claude should use this checklist when reviewing a website or web mockup.

## 9.1 Grid Checklist

- Is there a clear container width?
- Does the desktop design follow a 12-column grid?
- Are gutters consistent?
- Are margins consistent?
- Does the layout adapt well to tablet and mobile?
- Are cards and sections aligned to the same grid?

---

## 9.2 Layout Checklist

- Is the main message clear?
- Is there a strong visual hierarchy?
- Is the CTA easy to find?
- Are related elements grouped together?
- Is there enough white space?
- Are sections visually distinct?
- Is the layout too crowded?
- Are card styles consistent?
- Are forms easy to scan and complete?

---

## 9.3 Typography Checklist

- Are there too many fonts?
- Is heading hierarchy clear?
- Is body text easy to read?
- Is line height comfortable?
- Is font weight used consistently?
- Does the typography work on mobile?
- Are labels and captions readable?

---

## 9.4 Color Checklist

- Is the primary color used for key actions?
- Is the secondary color used consistently?
- Are neutral colors clean and balanced?
- Is there enough text contrast?
- Are semantic colors clear?
- Are there too many colors?
- Are hover, active, disabled, success, warning, and error states defined?

---

# 10. Claude Output Formats

When Claude is asked to design a website layout, it should respond using this structure:

```markdown
# Web Design Direction

## 1. Design Goal
Describe the goal of the web page.

## 2. Layout Structure
Define major sections:
- Hero
- Feature
- Process
- Dashboard / Form / Cards
- CTA
- Footer

## 3. Grid System
Define:
- Desktop grid
- Tablet grid
- Mobile behavior
- Container width
- Gutter
- Margin

## 4. Typography System
Define:
- Font family
- H1
- H2
- H3
- Body
- Button
- Caption

## 5. Color System
Define:
- Primary
- Secondary
- Accent
- Neutral
- Semantic colors

## 6. Section-by-Section Layout
Explain each section:
- Purpose
- Layout
- Content hierarchy
- Visual treatment
- CTA

## 7. Responsive Behavior
Explain desktop, tablet, mobile adaptations.

## 8. Developer Notes
List exact specs:
- Spacing
- Border radius
- Shadows
- Component states
- CSS variables if needed
```

---

# 11. Claude Behavior Rules

Claude should:

1. Prioritize structure before decoration.
2. Use clear design specifications, not vague design language.
3. Always define grid, spacing, typography, and color when creating a web layout.
4. Explain responsive behavior.
5. Use consistent design tokens.
6. Keep layouts clean and readable.
7. Avoid overcrowding sections.
8. Use brand colors with discipline.
9. Use white space intentionally.
10. Make CTAs visually obvious.
11. Maintain accessibility and contrast.
12. Avoid using too many font styles or colors.
13. Recommend dashboard layouts based on clarity, not decoration.
14. Use golden ratio as a guide, not a rigid rule.

---

# 12. Quick Formula for Professional Web Design

```text
Clear grid
+ Consistent spacing
+ Strong typography hierarchy
+ Disciplined color system
+ Enough white space
+ Clear CTA
+ Responsive behavior
= Professional web design
```

---

# 13. Example: Corporate Education Website System

This example is useful for an education brand or corporate learning center.

## Brand Color System

```css
:root {
  --color-primary: #BA110F;
  --color-secondary: #191970;
  --color-bg: #FFFFFF;
  --color-surface: #F8F9FA;
  --color-text: #111111;
  --color-muted: #666666;
  --color-border: #E5E7EB;
  --color-success: #16A34A;
  --color-warning: #F59E0B;
  --color-error: #DC2626;
}
```

## Recommended Style

```text
Tone:
- Bright
- Clean
- Modern
- Professional
- Premium corporate

Background:
- Mostly white
- Light gray surface for cards

Typography:
- Heading: Montserrat Bold
- Body: Inter or Montserrat Regular

Visual:
- Realistic education imagery
- Clean icons
- Strong white space
- Minimal decoration
```

## Recommended Hero Layout

```text
Desktop:
- 12-column grid
- Text: 6 columns
- Visual: 6 columns
- H1: 64px
- Body: 18px
- CTA: red primary button
- Secondary CTA: navy outline button

Mobile:
- Single column
- Text first
- Visual second
- H1: 40px to 44px
```

---

# 14. Final Instruction for Claude

When applying this skill, Claude must think like a Senior Web Designer and UI System Designer.

Claude should not only describe the design emotionally. It must provide practical, buildable, and structured design instructions that a designer or developer can execute.

The final output should be clear enough for:
- UI Designer
- Web Designer
- Front-end Developer
- Product Owner
- Marketing Leader
- Brand Manager
