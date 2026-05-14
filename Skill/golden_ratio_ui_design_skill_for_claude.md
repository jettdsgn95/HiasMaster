# GOLDEN RATIO IN UI DESIGN SKILL

## Skill Name
Applying the Golden Ratio in UI Design

## Purpose
This skill helps Claude understand and apply the Golden Ratio as a practical UI design tool for creating balanced, harmonious, and visually clear interfaces.

Claude should use this skill when designing or reviewing:
- Web UI layouts
- Landing pages
- App screens
- Dashboard screens
- Hero sections
- Typography hierarchy
- Image cropping
- Logo/icon composition
- White space and spacing systems

---

# 1. Core Concept

The Golden Ratio is a proportion system commonly written as:

```text
1 : 1.618
```

In UI design, it can be simplified as:

```text
38.2% / 61.8%
```

or:

```text
Small part × 1.618 = Larger part
```

Claude must understand that the Golden Ratio is not a strict rule. It is a guide for creating visual balance, hierarchy, and harmony.

---

# 2. When to Use This Skill

Use this skill when the user asks Claude to:

- Improve UI layout balance
- Design a hero section
- Split a screen into two content areas
- Create better visual hierarchy
- Build a typography scale
- Crop or place images inside a layout
- Improve white space
- Review whether a UI feels balanced
- Make a design feel more premium, calm, or harmonious

---

# 3. Key Principles

## 3.1 Balance Content Areas

When a screen or section contains two main areas, Claude can apply the Golden Ratio to divide space.

Recommended layout ratios:

```text
61.8% main content / 38.2% secondary content
```

or:

```text
38.2% text / 61.8% visual
```

Use the larger area for the more important element.

Examples:

```text
Hero section:
- 38.2% text
- 61.8% image / product visual
```

```text
Content page:
- 61.8% article content
- 38.2% sidebar
```

---

## 3.2 Support Visual Hierarchy

The Golden Ratio can help determine which UI element should dominate.

Claude should use size contrast to guide the user's eye:

```text
Primary element > Secondary element > Supporting element
```

Example hierarchy:

```text
Headline
→ Subtitle
→ Body text
→ Button
→ Supporting visual
```

Golden Ratio can help decide:
- How large a headline should be compared to subtitle
- How much space the hero visual should occupy
- How much room should be left around CTA buttons
- Which content block should visually dominate

---

## 3.3 Build Typography Hierarchy

Claude can use the Golden Ratio to create type size relationships.

Formula:

```text
Larger text ÷ 1.618 = Smaller related text
```

Example:

```text
H1: 64px
H2: 64 ÷ 1.618 ≈ 40px
H3: 40 ÷ 1.618 ≈ 25px
Body: 16px
```

Practical typography scale:

```text
16 / 24 / 40 / 64
```

Claude should not use mathematically exact sizes if they reduce readability. Round values to practical UI sizes.

Recommended rounded sizes:

```text
14 / 16 / 20 / 24 / 32 / 40 / 48 / 64 / 72
```

---

## 3.4 Improve White Space

White space is the space between UI elements.

The Golden Ratio can help Claude decide spacing relationships:

```text
Small spacing × 1.618 = Larger spacing
```

Example spacing system:

```text
16px → 24px → 40px → 64px
```

Recommended use:

```text
8px: tight relationship
16px: field or text spacing
24px: component internal spacing
40px: block spacing
64px: section spacing
```

Claude should use larger spacing to separate unrelated groups and smaller spacing to group related elements.

---

## 3.5 Plan Layout During Wireframing

Claude should apply the Golden Ratio early during wireframing, not only after visual design.

During wireframing, use it to decide:

- Section proportions
- Text/image split
- Card size relationships
- Sidebar/content width
- Image crop area
- Primary and secondary content priority

Example:

```text
Wireframe decision:
The main dashboard table should take about 61.8% of horizontal space, while the right insight panel takes about 38.2%.
```

---

## 3.6 Crop and Place Images

The Golden Ratio can help crop images in web design.

Claude should use it to:

- Keep the subject balanced
- Place focal points away from dead center
- Give breathing room around the subject
- Create more natural visual flow

Recommended approach:

```text
1. Identify the subject or focal point.
2. Place the focal point near a golden-ratio intersection.
3. Avoid cutting important details.
4. Keep enough negative space for text if the image is used as a hero background.
```

---

## 3.7 Logo and Icon Composition

The Golden Ratio can also support logo and icon composition.

Claude should use this carefully for:

- Circular icon systems
- Logo proportions
- Symbol spacing
- Internal shape relationships

Claude should not force every logo element into Golden Ratio. It should only use the ratio when it improves harmony and recognition.

---

# 4. Practical UI Applications

## 4.1 Hero Section

Recommended Golden Ratio layout:

```text
Desktop:
- Container: 1200px
- Text block: 458px approximately
- Visual block: 742px approximately
```

Equivalent simplified ratio:

```text
Text: 38%
Visual: 62%
```

Use when:
- Visual is the strongest selling point
- Product image or brand image needs impact
- Landing page needs strong first impression

Alternative:

```text
Text: 62%
Visual: 38%
```

Use when:
- Message is more important than image
- Website is content-heavy
- The page needs a strong headline-driven introduction

---

## 4.2 Content + Sidebar Layout

Recommended:

```text
Main content: 62%
Sidebar: 38%
```

or for a wider article:

```text
Main content: 70%
Sidebar: 30%
```

Claude should choose usability over mathematical purity.

---

## 4.3 Dashboard Layout

For dashboards, Golden Ratio can help divide attention:

```text
Primary workspace: 62%
Secondary insight panel: 38%
```

Example:

```text
Production Board:
- Main task table: 62%
- KPI / status summary panel: 38%
```

However, data clarity is more important than strict Golden Ratio. If a table needs more room, prioritize readability.

---

## 4.4 Card Layout

Claude can apply proportional emphasis:

```text
Featured card: 62%
Supporting cards: 38%
```

Example:

```text
One large feature card on the left
Two smaller supporting cards stacked on the right
```

Use this for:
- Feature sections
- Service highlights
- Campaign landing pages
- Case study previews

---

## 4.5 Typography System

Example Golden Ratio-inspired typography:

```text
Hero H1: 64px
Section H2: 40px
Card title: 24px
Body: 16px
Caption: 14px
```

Recommended CSS-style token example:

```css
:root {
  --text-caption: 14px;
  --text-body: 16px;
  --text-card-title: 24px;
  --text-section-title: 40px;
  --text-hero-title: 64px;
}
```

---

# 5. Claude Output Behavior

When Claude applies this skill, it should explain the layout using practical ratios and pixel values.

## Required Output Format

```markdown
# Golden Ratio UI Recommendation

## 1. Design Goal
Explain what needs to feel balanced or emphasized.

## 2. Ratio Application
State where the Golden Ratio is applied:
- Layout split
- Typography
- Image crop
- White space
- Card emphasis

## 3. Suggested Measurements
Give practical values in px or %.

## 4. Responsive Behavior
Explain how the ratio changes on tablet and mobile.

## 5. Notes
Mention when usability should override strict ratio.
```

---

# 6. Example Output

```markdown
# Golden Ratio UI Recommendation

## 1. Design Goal
Create a premium hero section where the visual has stronger impact than the text.

## 2. Ratio Application
Use a 38/62 split:
- Text area: 38%
- Visual area: 62%

## 3. Suggested Measurements
For a 1200px container:
- Text block: about 456px
- Visual block: about 744px
- Gap: 32px
- H1: 64px
- Body: 18px
- CTA height: 52px

## 4. Responsive Behavior
Tablet:
- Keep 2 columns if space allows, or switch to 1 column below 900px.

Mobile:
- Stack text first, visual second.
- H1 becomes 40px to 44px.
- Use 48px section padding.

## 5. Notes
Do not force the ratio if the text becomes too narrow. Readability has priority.
```

---

# 7. Checklist

Claude should check:

## Layout
- Is the main element visually dominant?
- Does the layout have a clear primary and secondary area?
- Does the section feel balanced without becoming symmetrical and boring?
- Is the ratio helping usability, not hurting it?

## Typography
- Are heading, subtitle, and body sizes clearly different?
- Does the type scale feel harmonious?
- Are sizes rounded to practical UI values?
- Is body text still readable?

## White Space
- Are related elements close together?
- Are unrelated elements separated clearly?
- Is spacing consistent?
- Does the layout have enough breathing room?

## Image
- Is the focal point placed intentionally?
- Is the crop balanced?
- Is there enough space for overlay text if needed?
- Are important image details preserved?

## Responsive
- Does the layout work on tablet?
- Does it stack cleanly on mobile?
- Does the Golden Ratio create problems on small screens?
- Has usability been prioritized over strict math?

---

# 8. Common Mistakes to Avoid

Claude must avoid:

1. Treating the Golden Ratio as a mandatory rule.
2. Forcing all layouts into 1:1.618.
3. Creating unreadable text areas because of strict ratios.
4. Using too many decimal values in final UI specs.
5. Ignoring responsive behavior.
6. Applying the ratio after the design is already cluttered.
7. Prioritizing mathematical proportion over user clarity.
8. Cropping images beautifully but cutting important content.
9. Making dashboard tables too narrow.
10. Using Golden Ratio language without giving practical measurements.

---

# 9. Best Practice Rules

Claude should follow these rules:

1. Use the Golden Ratio as a guide, not a law.
2. Apply it mainly to major layout relationships.
3. Use it to strengthen hierarchy.
4. Round measurements to practical pixel values.
5. Prioritize readability and usability.
6. Combine it with grid, spacing, typography, and color systems.
7. Apply it early during wireframing.
8. Use it to improve first impression, not just decoration.
9. Use white space intentionally.
10. Always define responsive behavior.

---

# 10. Quick Formula

```text
Golden Ratio in UI =
Balanced layout
+ Clear hierarchy
+ Harmonious typography
+ Intentional white space
+ Better image composition
+ Strong first impression
```

---

# 11. Final Instruction for Claude

When using this skill, Claude should not simply say "apply the Golden Ratio."

Claude must specify:
- Which UI area uses the ratio
- Why the ratio is useful there
- What the practical dimensions are
- How the layout adapts on smaller screens
- When to override the ratio for usability

The final recommendation must be clear enough for a UI Designer or Front-end Developer to execute.
