# CLAUDE WEB BUILDING SKILL PACK

## Skill Pack Name
Complete Web Building Skill Pack for Claude

## Purpose
This skill pack teaches Claude the key knowledge areas required to support the complete website-building process, from business brief to UX structure, UI system, data design, front-end implementation, QA, deployment, and long-term maintenance.

Claude should use this skill pack when asked to:
- Analyze a website idea or business requirement.
- Turn a brief into a buildable web specification.
- Design website structure, UI/UX, and user flows.
- Create dashboards, portals, forms, and management systems.
- Generate HTML/CSS/JS or React/Tailwind code.
- Define database fields and status workflows.
- Prepare documentation for developers.
- Review website quality before handoff or launch.

---

# 1. Core Operating Principle

Claude must think like a combination of:

- Product Manager
- UX Designer
- UI System Designer
- Front-end Developer
- Business Analyst
- QA Tester
- Technical Document Writer

Claude should not only make a website look good. It must help build a website that is:

1. Clear in purpose
2. Easy to use
3. Structurally logical
4. Visually consistent
5. Technically buildable
6. Responsive
7. Secure enough for real users
8. Maintainable
9. Scalable
10. Well documented

---

# 2. Skill Map Overview

Claude should understand that complete web building requires these knowledge groups:

## A. Product & Requirement Skills
1. Product Requirement Skill
2. Information Architecture Skill
3. User Flow & Workflow Skill
4. Role & Permission Skill

## B. UI/UX Design Skills
5. UI Component System Skill
6. Design Token Skill
7. UX Writing & Microcopy Skill
8. Accessibility Skill
9. Responsive Design Skill

## C. Front-end Development Skills
10. HTML Semantic Skill
11. CSS Architecture Skill
12. JavaScript Interaction Skill
13. React / Component-Based Skill
14. Tailwind CSS Skill

## D. Data, Forms & Dashboard Skills
15. Form Design Skill
16. Database Structure Skill
17. Status Workflow Skill
18. Dashboard & Report Skill
19. Table / Data Grid Skill

## E. Back-end & System Thinking Skills
20. API Design Skill
21. Authentication & Security Skill
22. Notification System Skill
23. File Management Skill

## F. SEO, Performance & Deployment Skills
24. SEO Basic Skill
25. Web Performance Skill
26. Deployment Skill
27. QA Testing Skill

## G. Claude-Specific Web Building Skills
28. Prompt-to-Code Skill
29. Documentation Skill
30. Maintenance & Scaling Skill

## H. Domain Knowledge for Media / Creative Workflow
31. Media Production Workflow Knowledge
32. Design / Video Task Classification Knowledge
33. Production Status Knowledge
34. Report Metrics Knowledge
35. Google Sheet / Database Sync Knowledge

---

# 3. Product Requirement Skill

## Purpose
This skill helps Claude convert business needs into clear product requirements.

## When to Use
Use this skill when the user asks Claude to:
- Build a website
- Analyze a web idea
- Create a feature list
- Prepare requirements for developers
- Define MVP or project scope
- Turn a business process into a web system

## Core Knowledge
Claude must understand:

- Business goals
- User types
- User problems
- Core use cases
- Feature requirements
- MVP scope
- Phase 2 / future scope
- Acceptance criteria
- User stories

## Required Output Types
Claude should be able to produce:

```text
Product Requirement Document
Feature List
MVP Scope
User Stories
Acceptance Criteria
Roadmap
Risk List
```

## Recommended Output Format

```markdown
# Product Requirement Document

## 1. Project Goal
Explain what this product is intended to achieve.

## 2. Target Users
List all user groups.

## 3. Key Problems
List the problems the website must solve.

## 4. Core Features
List features by priority.

## 5. MVP Scope
List what must be built first.

## 6. Future Scope
List features for later phases.

## 7. User Stories
Write role-based user stories.

## 8. Acceptance Criteria
Define measurable completion conditions.
```

## Example User Story

```text
As an Account user, I want to update delivery status so that clients can track whether their requested media product has been sent.
```

## Rules
Claude must:
- Separate must-have features from nice-to-have features.
- Avoid vague requirements.
- Always identify the main users.
- Define expected outcomes clearly.
- Write requirements that developers can understand.

## Anti-patterns
Claude must avoid:
- Listing features without explaining user value.
- Mixing current scope and future scope.
- Using vague phrases like "make it modern" without functional meaning.
- Ignoring who uses the system.

---

# 4. Information Architecture Skill

## Purpose
This skill helps Claude organize website content and system modules logically.

## When to Use
Use this skill when the user asks for:
- Sitemap
- Website structure
- Navigation menu
- Page hierarchy
- Portal structure
- Dashboard modules

## Core Knowledge
Claude must understand:

- Sitemap
- Main navigation
- Secondary navigation
- Page hierarchy
- Module grouping
- Content priority
- Naming conventions
- User mental model

## Required Output Types

```text
Sitemap
Navigation Map
Page Structure
Module List
Content Hierarchy
```

## Recommended Output Format

```markdown
# Information Architecture

## 1. Main Navigation
List primary menu items.

## 2. Page Hierarchy
Group pages by parent and child pages.

## 3. Module Structure
List modules inside each page.

## 4. User Access Notes
Mention which roles can access each page.

## 5. Naming Recommendations
Recommend clear labels for navigation and modules.
```

## Example

```text
Main Navigation:
1. Dashboard
2. Submit Order
3. Production Board
4. Delivery Log
5. Reports
6. Settings
```

## Rules
Claude must:
- Use clear names that users understand.
- Group related features together.
- Keep navigation simple.
- Avoid too many top-level menu items.
- Match structure to user workflow.

---

# 5. User Flow & Workflow Skill

## Purpose
This skill helps Claude define how users and data move through the system.

## When to Use
Use this skill for:
- Portals
- CRM systems
- Internal management tools
- Order tracking systems
- Approval systems
- Production workflows

## Core Knowledge
Claude must understand:

- User flow
- Task flow
- Data flow
- Approval flow
- Status flow
- Notification flow
- Swimlane workflow
- Owner by step

## Required Output Types

```text
User Flow
System Flow
Data Flow
Status Flow
Swimlane Flow
Workflow Table
```

## Example Flow

```text
Client submits order
→ Database receives order
→ Admin validates information
→ Admin assigns task
→ Designer/Editor updates production status
→ Account updates delivery status
→ Client receives final link
→ Report dashboard updates automatically
```

## Recommended Output Format

```markdown
# Workflow Specification

## 1. Flow Summary
Summarize the whole process.

## 2. Step-by-Step Flow
List each step in sequence.

## 3. Actor / Owner
Define who is responsible for each step.

## 4. Data Created or Updated
Define what data changes at each step.

## 5. Status Changes
Show how status moves through the process.

## 6. Notifications
Define who gets notified and when.
```

## Rules
Claude must:
- Always identify the actor responsible for each step.
- Separate user action from system automation.
- Define status changes.
- Define what data is created or updated.
- Avoid unclear flow jumps.

---

# 6. Role & Permission Skill

## Purpose
This skill helps Claude design access rules for systems with multiple user roles.

## When to Use
Use this skill when the website has:
- Admins
- Managers
- Staff
- Clients
- Accounts
- Designers
- Editors
- Branch users
- Multiple permission levels

## Core Knowledge
Claude must understand:

- Role-based access control
- Page access
- View permission
- Create permission
- Edit permission
- Delete permission
- Data visibility
- Ownership rules

## Required Output Types

```text
Permission Matrix
Role Definition
Access Rules
Page Access Table
Data Visibility Rules
```

## Example Permission Matrix

| Role | View Orders | Create Orders | Assign Tasks | Update Production | Update Delivery | View Reports |
|---|---:|---:|---:|---:|---:|---:|
| Admin | Yes | Yes | Yes | Yes | Yes | Yes |
| Account | Yes | Yes | No | No | Yes | Yes |
| Designer | Assigned only | No | No | Yes | No | No |
| Editor | Assigned only | No | No | Yes | No | No |
| Client | Own orders only | Yes | No | No | No | Own orders only |

## Rules
Claude must:
- Define what each role can and cannot do.
- Define which data each role can see.
- Prevent clients from seeing other clients' data.
- Prevent staff from editing unrelated records unless allowed.
- Include admin override logic when needed.

---

# 7. UI Component System Skill

## Purpose
This skill helps Claude define reusable UI components for consistent design.

## When to Use
Use this skill when creating:
- Design system
- Web UI
- Dashboard UI
- Portal UI
- Landing pages
- HTML/CSS components
- React components

## Core Knowledge
Claude must understand:

- Buttons
- Inputs
- Forms
- Cards
- Badges
- Tables
- Tabs
- Modal windows
- Dropdowns
- Sidebar
- Navbar
- Toast notifications
- Loading states
- Error states
- Empty states

## Required Output Types

```text
UI Component Specification
Component State Definition
Reusable Component List
Design System Notes
```

## Example Component Specification

```text
Primary Button:
- Height: 48px
- Padding: 0 24px
- Border radius: 12px
- Background: #BA110F
- Text color: #FFFFFF
- Font weight: 600
- Hover: darker red
- Disabled: gray background, muted text
```

## Rules
Claude must:
- Specify component states.
- Use consistent spacing.
- Use consistent border radius.
- Use consistent icon style.
- Make components reusable.
- Avoid inventing a new style for every section.

---

# 8. Design Token Skill

## Purpose
This skill helps Claude define design variables for developers.

## When to Use
Use this skill when creating:
- UI systems
- CSS variables
- Tailwind theme
- Design guidelines
- Front-end implementation specs

## Core Knowledge
Claude must understand:

- Color tokens
- Typography tokens
- Spacing tokens
- Radius tokens
- Shadow tokens
- Border tokens
- Z-index tokens
- Breakpoint tokens

## Required Output Types

```text
Design Tokens
CSS Variables
Tailwind Config Notes
UI System Foundation
```

## Example CSS Tokens

```css
:root {
  --color-primary: #BA110F;
  --color-secondary: #191970;
  --color-bg: #FFFFFF;
  --color-surface: #F8F9FA;
  --color-text: #111111;
  --color-muted: #666666;
  --color-border: #E5E7EB;

  --font-heading: "Montserrat", sans-serif;
  --font-body: "Inter", sans-serif;

  --space-4: 4px;
  --space-8: 8px;
  --space-16: 16px;
  --space-24: 24px;
  --space-32: 32px;

  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 20px;

  --shadow-card: 0 8px 24px rgba(0, 0, 0, 0.08);
}
```

## Rules
Claude must:
- Name tokens by function, not just color.
- Keep token names consistent.
- Use tokens in UI specifications.
- Avoid hardcoding random values across components.

---

# 9. UX Writing & Microcopy Skill

## Purpose
This skill helps Claude write clear and useful interface text.

## When to Use
Use this skill for:
- Button labels
- Form labels
- Error messages
- Empty states
- Toast messages
- Tooltips
- Confirmation messages
- Onboarding text

## Core Knowledge
Claude must understand:

- Clarity
- Brevity
- Action-oriented wording
- Error recovery
- User reassurance
- Contextual helper text

## Required Output Types

```text
CTA Copy
Error Message
Empty State Copy
Success Message
Tooltip
Confirmation Dialog Copy
```

## Examples

Bad:
```text
Error.
```

Good:
```text
Vui lòng nhập đầy đủ tên người yêu cầu trước khi gửi đơn.
```

Bad:
```text
Submit
```

Good:
```text
Gửi yêu cầu thiết kế
```

## Rules
Claude must:
- Use human-friendly language.
- Tell users what happened.
- Tell users what to do next.
- Avoid technical error messages unless needed.
- Keep buttons short and action-oriented.

---

# 10. Accessibility Skill

## Purpose
This skill helps Claude create websites that are easier to use for more people.

## When to Use
Use this skill for all web design and front-end work.

## Core Knowledge
Claude must understand:

- Contrast
- Readable font sizes
- Keyboard navigation
- Focus states
- Alt text
- ARIA labels
- Form labels
- Error messages
- Color-blind safe UI
- Touch target size

## Required Output Types

```text
Accessibility Checklist
ARIA Notes
Contrast Review
Keyboard Navigation Rules
```

## Rules
Claude must:
- Ensure text contrast is readable.
- Avoid relying only on color to show status.
- Use visible focus states.
- Use form labels.
- Provide alt text for meaningful images.
- Keep touch targets large enough.

## Recommended Specs

```text
Minimum mobile touch target: 44px
Body text: 16px minimum
Button height: 40px desktop minimum, 44px mobile minimum
```

---

# 11. Responsive Design Skill

## Purpose
This skill helps Claude design layouts that work across screen sizes.

## When to Use
Use this skill for every website or web app.

## Core Knowledge
Claude must understand:

- Desktop-first design
- Mobile-first design
- Breakpoints
- Responsive grid
- Stacking behavior
- Responsive typography
- Responsive navigation
- Mobile form usability

## Required Output Types

```text
Responsive Rules
Breakpoint System
Mobile Layout Spec
Tablet Adaptation
```

## Recommended Breakpoints

```text
Mobile: 0–767px
Tablet: 768–1023px
Laptop: 1024–1439px
Desktop: 1440px+
```

## Example Responsive Behavior

```text
Hero:
- Desktop: 2 columns
- Tablet: 2 columns compressed or stacked
- Mobile: single column, text first, visual second
```

## Rules
Claude must:
- Always define mobile behavior.
- Avoid desktop-only layouts.
- Stack complex grids on mobile.
- Keep forms easy to complete on mobile.
- Reduce heading size on small screens.

---

# 12. HTML Semantic Skill

## Purpose
This skill helps Claude create HTML that is structured, accessible, and SEO-friendly.

## When to Use
Use this skill when writing HTML or reviewing front-end code.

## Core Knowledge
Claude must understand:

- header
- nav
- main
- section
- article
- aside
- footer
- form
- label
- button
- table
- heading hierarchy

## Example

```html
<header>
  <nav aria-label="Main navigation"></nav>
</header>

<main>
  <section>
    <h1>Main page title</h1>
  </section>
</main>

<footer></footer>
```

## Rules
Claude must:
- Use semantic tags when appropriate.
- Use only one main H1 per page.
- Use buttons for actions and links for navigation.
- Use labels for inputs.
- Avoid div-only structure when semantic HTML is possible.

---

# 13. CSS Architecture Skill

## Purpose
This skill helps Claude create CSS that is clean, scalable, and maintainable.

## When to Use
Use this skill when writing CSS, HTML/CSS pages, design systems, or component styles.

## Core Knowledge
Claude must understand:

- CSS variables
- BEM naming
- Utility classes
- Component-based CSS
- Responsive CSS
- Flexbox
- CSS Grid
- State styles
- Media queries

## Required Output Types

```text
CSS Architecture
Class Naming Convention
Responsive CSS Rules
Component CSS
```

## Example BEM

```css
.card {}
.card__header {}
.card__title {}
.card__body {}
.card--active {}
```

## Rules
Claude must:
- Use reusable class patterns.
- Avoid excessive one-off CSS.
- Use CSS variables for design tokens.
- Keep responsive CSS organized.
- Avoid random magic numbers.

---

# 14. JavaScript Interaction Skill

## Purpose
This skill helps Claude define and build interactive behavior.

## When to Use
Use this skill for:
- Forms
- Filters
- Search
- Sorting
- Tabs
- Modals
- Accordions
- Toasts
- Charts
- Dashboard interactions
- LocalStorage demos

## Core Knowledge
Claude must understand:

- Event handling
- State changes
- Form validation
- Conditional rendering
- DOM updates
- Data rendering
- Client-side filtering
- LocalStorage persistence

## Example Interaction Logic

```text
When user changes status:
1. Update progress percentage.
2. Update badge color.
3. Update last update time.
4. Refresh report chart.
```

## Rules
Claude must:
- Keep interaction logic predictable.
- Validate user input.
- Give feedback after actions.
- Avoid hidden state changes.
- Make UI update immediately when needed.

---

# 15. React / Component-Based Skill

## Purpose
This skill helps Claude build modern web apps using reusable components.

## When to Use
Use this skill for React, Next.js, or component-based UI projects.

## Core Knowledge
Claude must understand:

- Component structure
- Props
- State
- Hooks
- Reusable components
- Conditional rendering
- List rendering
- Form state
- Component folders
- UI library integration

## Required Output Types

```text
React Component Plan
Reusable Component List
Props Structure
State Management Logic
```

## Example Component Map

```text
Components:
- AppLayout
- Sidebar
- Topbar
- OrderForm
- ProductionBoard
- StatusBadge
- ReportCard
- ChartPanel
- DataTable
```

## Rules
Claude must:
- Split large UI into reusable components.
- Avoid duplicated component logic.
- Keep state close to where it is used.
- Use clear prop names.
- Keep component responsibilities focused.

---

# 16. Tailwind CSS Skill

## Purpose
This skill helps Claude build fast, consistent interfaces using Tailwind CSS.

## When to Use
Use this skill when the user asks for Tailwind, React/Tailwind, or fast UI prototyping.

## Core Knowledge
Claude must understand:

- Utility class logic
- Responsive classes
- Tailwind config
- Design tokens
- State classes
- Layout utilities
- Grid utilities
- Flex utilities
- Component extraction

## Example

```html
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <!-- cards -->
</div>
```

## Rules
Claude must:
- Keep Tailwind classes readable.
- Extract repeated patterns into components when possible.
- Use responsive utility classes.
- Avoid inconsistent arbitrary values.
- Map brand tokens into Tailwind config when possible.

---

# 17. Form Design Skill

## Purpose
This skill helps Claude design forms that are clear, usable, and validatable.

## When to Use
Use this skill for:
- Order forms
- Contact forms
- Registration forms
- Admin forms
- Multi-step forms
- File upload forms

## Core Knowledge
Claude must understand:

- Required fields
- Optional fields
- Field grouping
- Validation rules
- Error handling
- File upload
- Conditional fields
- Multi-step UX
- Confirmation screen
- Success state

## Required Output Types

```text
Form Field List
Validation Rules
Form UX Flow
Error Messages
Success Messages
```

## Example Form Structure

```text
Order Form Sections:
1. Requester information
2. Project type
3. Content brief
4. Deadline
5. File attachments
6. Approval contact
7. Submit confirmation
```

## Rules
Claude must:
- Group related fields.
- Mark required fields.
- Define validation rules.
- Provide clear error messages.
- Confirm successful submission.
- Avoid asking for unnecessary information.

---

# 18. Database Structure Skill

## Purpose
This skill helps Claude define the data model behind a web system.

## When to Use
Use this skill when building:
- Portals
- Dashboards
- Order systems
- CRM systems
- Internal tools
- Data-driven websites

## Core Knowledge
Claude must understand:

- Entity
- Field
- Data type
- Required / optional
- Relationships
- Status
- Timestamp
- Unique ID
- Audit log
- Data normalization basics

## Required Output Types

```text
Database Schema
Field Table
Entity Relationship
Data Dictionary
```

## Example Field Table

| Field | Type | Required | Description |
|---|---|---:|---|
| order_id | string | Yes | Unique order code |
| requester_name | string | Yes | Person submitting the request |
| task_type | enum | Yes | Design / Video / Photo |
| status | enum | Yes | Current production status |
| created_at | datetime | Yes | Submission time |

## Rules
Claude must:
- Define unique IDs.
- Define timestamps.
- Define required fields.
- Use clear field names.
- Define relationships when needed.
- Avoid mixing unrelated data in one field.

---

# 19. Status Workflow Skill

## Purpose
This skill helps Claude design clear progress and status systems.

## When to Use
Use this skill for:
- Order tracking
- Production tracking
- Delivery tracking
- Ticket systems
- Approval workflows
- Task management systems

## Core Knowledge
Claude must understand:

- Status naming
- Status sequence
- Progress percentage
- Status color
- Status owner
- Transition rules
- Locking rules
- Completion rules

## Required Output Types

```text
Status Workflow Table
Progress Mapping
Badge Color System
Transition Logic
```

## Example Status Table

| Status | Progress | Color | Owner |
|---|---:|---|---|
| New Order | 0% | Gray | System |
| Received | 10% | Purple | Admin |
| In Progress | 11–79% | Yellow | Designer / Editor |
| Internal Review | 80% | Blue | Manager |
| Delivered | 95% | Navy | Account |
| Completed | 100% | Green | Account |
| Cancelled | 0% | Red | Admin |

## Rules
Claude must:
- Define every status clearly.
- Avoid duplicate status meanings.
- Connect status with owner.
- Define what happens when status changes.
- Define final states.

---

# 20. Dashboard & Report Skill

## Purpose
This skill helps Claude design reporting dashboards with meaningful metrics.

## When to Use
Use this skill for:
- Management dashboards
- Production reports
- Staff reports
- Time-based reports
- KPI dashboards
- Portal analytics

## Core Knowledge
Claude must understand:

- KPI cards
- Bar charts
- Line charts
- Pie / donut charts
- Status charts
- Time-based reporting
- Staff performance report
- Task type report
- Date filters
- Export reports

## Required Output Types

```text
Dashboard Layout
KPI Definition
Chart Specification
Filter Logic
Report Table
```

## Example Report Metrics

```text
1. Total orders by month
2. Completed tasks by staff
3. Overdue tasks by department
4. Task type distribution
5. Average completion time
6. On-time delivery rate
7. Revision rate
8. Workload by designer/editor
```

## Rules
Claude must:
- Define what each metric means.
- Define chart type for each report.
- Include filters.
- Include date ranges.
- Avoid meaningless decorative charts.
- Prioritize actionable metrics.

---

# 21. Table / Data Grid Skill

## Purpose
This skill helps Claude create usable tables for data-heavy systems.

## When to Use
Use this skill for:
- Order lists
- Task boards
- Admin panels
- Reports
- Data management tools

## Core Knowledge
Claude must understand:

- Column design
- Sorting
- Filtering
- Search
- Pagination
- Sticky header
- Bulk action
- Row status
- Inline edit
- Empty state
- Loading state

## Required Output Types

```text
Data Table Specification
Column Definition
Filter Rules
Bulk Action Rules
```

## Example Table Columns

| Column | Purpose |
|---|---|
| Order ID | Tracking |
| Requester | Identify owner |
| Task Type | Filter category |
| Assigned To | Staff responsibility |
| Status | Current progress |
| Deadline | Priority control |
| Last Update | Monitoring |

## Rules
Claude must:
- Put important columns first.
- Include status and deadline.
- Avoid too many columns on mobile.
- Provide search and filters.
- Define empty and loading states.

---

# 22. API Design Skill

## Purpose
This skill helps Claude describe how front-end and back-end communicate.

## When to Use
Use this skill when defining:
- Web app architecture
- Front-end/back-end integration
- API endpoints
- CRUD features
- Data sync

## Core Knowledge
Claude must understand:

- REST API basics
- Endpoint naming
- Request body
- Response body
- Error codes
- Authentication
- Pagination
- Filtering
- Sorting
- CRUD logic

## Required Output Types

```text
API Endpoint Specification
Request Body
Response Body
Error Handling
```

## Example Endpoints

```text
GET /api/orders
POST /api/orders
GET /api/orders/{id}
PATCH /api/orders/{id}/status
DELETE /api/orders/{id}
```

## Rules
Claude must:
- Use clear endpoint names.
- Define request and response.
- Include error cases.
- Include authentication notes.
- Avoid unclear API behavior.

---

# 23. Authentication & Security Skill

## Purpose
This skill helps Claude define secure access and data protection basics.

## When to Use
Use this skill for:
- Login systems
- Role-based portals
- Client dashboards
- Internal tools
- File access systems

## Core Knowledge
Claude must understand:

- Login
- Role-based access
- Session
- Token
- Password rules
- Permission checking
- Sensitive data handling
- File access security
- Audit log
- Basic OWASP awareness

## Required Output Types

```text
Auth Flow
Permission Rules
Security Checklist
Audit Log Notes
```

## Example Security Rules

```text
- Client can only view their own orders.
- Staff can only update assigned tasks.
- Admin can view and edit all records.
- All status changes must be logged.
- Uploaded files should not be public unless intentionally shared.
```

## Rules
Claude must:
- Never ignore role access.
- Never expose all data to all users.
- Define session or token expectations.
- Include audit logging for important changes.
- Recommend secure file access.

---

# 24. Notification System Skill

## Purpose
This skill helps Claude design notifications that support workflow.

## When to Use
Use this skill for:
- Order submissions
- Task assignments
- Status updates
- Deadline reminders
- Approval requests
- Delivery completion

## Core Knowledge
Claude must understand:

- Email notification
- In-app notification
- Status update notification
- Deadline reminder
- Completion notification
- Assignment notification
- Escalation notification

## Required Output Types

```text
Notification Matrix
Trigger Rules
Email Template
In-App Notification Copy
```

## Example Notification Matrix

| Trigger | Receiver | Message |
|---|---|---|
| New order submitted | Admin / Account | New order needs review |
| Task assigned | Designer / Editor | You have been assigned a new task |
| Status completed | Account | Task is completed and ready for delivery |
| Deadline near | Staff / Manager | Task is approaching deadline |

## Rules
Claude must:
- Define trigger.
- Define receiver.
- Define message.
- Avoid excessive notifications.
- Include escalation for overdue tasks when appropriate.

---

# 25. File Management Skill

## Purpose
This skill helps Claude design file upload, storage, and delivery logic.

## When to Use
Use this skill when the system includes:
- File uploads
- Design files
- Video files
- Brief attachments
- Delivery links
- Version control

## Core Knowledge
Claude must understand:

- File upload
- File type validation
- File size limit
- Folder structure
- File naming convention
- Link sharing
- Version control
- Final delivery link
- Permission access

## Required Output Types

```text
File Upload Rules
Folder Structure
Naming Convention
Delivery Link Logic
```

## Example Naming Convention

```text
[OrderID]_[TaskType]_[Branch]_[Date]_[Version]

Example:
ORD-2026-001_KV_CanTho_2026-05-04_V01
```

## Rules
Claude must:
- Define accepted file types.
- Define file size limits.
- Define naming conventions.
- Define who can access uploaded files.
- Track final delivery links separately from working files.

---

# 26. SEO Basic Skill

## Purpose
This skill helps Claude create websites that are search-friendly.

## When to Use
Use this skill for:
- Public websites
- Landing pages
- Corporate websites
- Campaign pages
- Blog pages

## Core Knowledge
Claude must understand:

- Meta title
- Meta description
- Heading structure
- Semantic HTML
- Image alt text
- Open Graph
- Sitemap
- URL structure
- Internal links
- Page speed basics

## Required Output Types

```text
SEO Checklist
Meta Tags
Heading Structure
SEO Content Plan
```

## Example

```html
<title>CB Creative Flow - Media Hub by CB Centres</title>
<meta name="description" content="A media order and production tracking platform for CB Centres.">
```

## Rules
Claude must:
- Use one H1 per page.
- Write useful meta descriptions.
- Use semantic HTML.
- Add alt text for meaningful images.
- Avoid keyword stuffing.

---

# 27. Web Performance Skill

## Purpose
This skill helps Claude improve website speed and user experience.

## When to Use
Use this skill for:
- Front-end build
- Image-heavy websites
- Dashboards
- Landing pages
- Production checklist

## Core Knowledge
Claude must understand:

- Image optimization
- Lazy loading
- Minified CSS / JS
- Reduce unused code
- Font loading
- Caching
- Core Web Vitals basics
- Layout shift prevention
- Chart and table optimization

## Required Output Types

```text
Performance Checklist
Optimization Notes
Asset Rules
```

## Example Asset Rules

```text
Image rules:
- Use WebP where possible.
- Lazy load below-the-fold images.
- Compress hero images.
- Avoid uploading original 10MB images directly.
```

## Rules
Claude must:
- Avoid unnecessary heavy assets.
- Optimize images.
- Prevent layout shift.
- Load fonts efficiently.
- Avoid rendering too many table rows at once.

---

# 28. Deployment Skill

## Purpose
This skill helps Claude guide users through publishing websites.

## When to Use
Use this skill when user asks:
- How to deploy a website
- How to host a static HTML page
- How to deploy React/Next.js
- How to connect domain
- How to publish an internal web app

## Core Knowledge
Claude must understand:

- Static hosting
- Vercel
- Netlify
- Firebase Hosting
- Google Apps Script Web App
- Custom domain
- Environment variables
- Build command
- Preview vs production environment

## Required Output Types

```text
Deployment Guide
Environment Setup
Build Steps
Production Checklist
```

## Rules
Claude must:
- Match deployment method to tech stack.
- Include build command.
- Include environment variable notes.
- Separate preview and production.
- Include custom domain notes when needed.

---

# 29. QA Testing Skill

## Purpose
This skill helps Claude check whether the website is ready for handoff or launch.

## When to Use
Use this skill before:
- Client handoff
- Developer handoff
- Website launch
- Internal system rollout

## Core Knowledge
Claude must understand:

- Functional testing
- UI testing
- Responsive testing
- Browser testing
- Form testing
- Role testing
- Data testing
- Security checklist
- Performance testing

## Required Output Types

```text
QA Checklist
Test Cases
Bug Report Template
Acceptance Criteria
```

## Example Test Case

```text
Test case:
User submits order form with all required fields.

Expected result:
Order is created, confirmation appears, and admin receives a notification.
```

## Rules
Claude must:
- Test by user role.
- Test form errors.
- Test responsive layouts.
- Test empty states.
- Test permissions.
- Test data update logic.

---

# 30. Prompt-to-Code Skill

## Purpose
This skill helps Claude convert prompts and briefs into functional code.

## When to Use
Use this skill when user asks Claude to:
- Write website code
- Export HTML
- Build a prototype
- Convert specification into code
- Generate React/Tailwind components

## Core Knowledge
Claude must understand:

- Reading briefs carefully
- Component breakdown
- Tech stack selection
- File structure
- Code organization
- Brand consistency
- Requirement preservation
- Responsive implementation

## Required Output Types

```text
Implementation Plan
File Structure
Code
Setup Guide
Component Map
```

## Rules
Claude must:
- Not omit required features.
- Keep brand guidelines intact.
- Use clean component structure.
- Include responsive behavior.
- Include comments only when useful.
- Avoid overcomplicating simple prototypes.

---

# 31. Documentation Skill

## Purpose
This skill helps Claude create useful documentation for teams.

## When to Use
Use this skill when preparing:
- Developer handoff
- Product specs
- Technical specs
- User guides
- Admin guides
- README files

## Core Knowledge
Claude must understand:

- README
- Product spec
- Technical spec
- User guide
- Admin guide
- Design system document
- API document
- Changelog
- Version notes

## Required Output Types

```text
README.md
SPEC.md
USER_GUIDE.md
ADMIN_GUIDE.md
CHANGELOG.md
```

## Rules
Claude must:
- Write for the correct audience.
- Separate user guide from technical guide.
- Include setup instructions when code is involved.
- Include version notes when updating files.
- Keep documentation practical and easy to scan.

---

# 32. Maintenance & Scaling Skill

## Purpose
This skill helps Claude design systems that can grow over time.

## When to Use
Use this skill for:
- Internal portals
- Long-term systems
- CRM-like tools
- Dashboards
- Production management tools

## Core Knowledge
Claude must understand:

- Modular structure
- Naming convention
- Component reuse
- Data backup
- Versioning
- Error logging
- Audit trail
- Role expansion
- Report expansion
- Future feature planning

## Required Output Types

```text
Maintenance Plan
Scaling Notes
Future Roadmap
Risk List
```

## Rules
Claude must:
- Avoid one-off structures that cannot scale.
- Use modular naming.
- Keep data fields extensible.
- Plan for additional roles and reports.
- Include backup and audit trail notes when relevant.

---

# 33. Media Production Workflow Knowledge

## Purpose
This domain knowledge helps Claude understand media order and creative production systems.

## When to Use
Use this knowledge for:
- Media Hub
- Creative Flow
- Design order systems
- Video production workflow
- Internal marketing production portals

## Core Workflow

```text
Order intake
→ Brief validation
→ Task assignment
→ Production tracking
→ Internal review
→ Revision
→ Approval
→ Delivery
→ Archive
→ Reporting
```

## Rules
Claude must:
- Separate order intake from production tracking.
- Separate production status from delivery status.
- Define who owns each workflow step.
- Track deadline and last update.
- Include revision and approval states.
- Include reporting logic.

---

# 34. Design / Video Task Classification Knowledge

## Purpose
This knowledge helps Claude classify creative tasks correctly.

## Task Categories

### Design
```text
- Key Visual
- Poster
- Banner
- Standee
- Flyer
- Brochure
- Social post
- POSM
- Presentation
- Event backdrop
```

### Video
```text
- Short video
- Recap video
- Motion graphic
- Shooting request
- Reels / TikTok
- Event video
- Testimonial video
```

### Photo
```text
- Event shooting
- Class shooting
- Branch shooting
- Product shooting
- Staff portrait
```

## Rules
Claude must:
- Classify task type early.
- Allow filtering by task type.
- Support different fields for design, video, and photo.
- Support file upload and reference links.

---

# 35. Production Status Knowledge

## Purpose
This knowledge helps Claude define realistic creative production statuses.

## Recommended Statuses

```text
New Order
Received
Assigned
In Progress
Internal Review
Need Revision
Approved
Delivered
Completed
Cancelled
Overdue
```

## Status Meaning

| Status | Meaning |
|---|---|
| New Order | Submitted but not yet reviewed |
| Received | Admin/account has received and checked the order |
| Assigned | Task has been assigned to production staff |
| In Progress | Staff is working on the task |
| Internal Review | Task is ready for internal checking |
| Need Revision | Task requires adjustment |
| Approved | Task is approved for delivery |
| Delivered | Final output has been sent |
| Completed | Task is fully closed |
| Cancelled | Task will not continue |
| Overdue | Task passed deadline |

## Rules
Claude must:
- Define progress percentage when needed.
- Define color badges.
- Define owner by status.
- Keep status names clear.
- Avoid overlapping meanings.

---

# 36. Report Metrics Knowledge

## Purpose
This knowledge helps Claude design useful reporting dashboards for creative production.

## Recommended Metrics

```text
Total orders
Orders by type
Orders by branch
Orders by requester
Orders by staff
Orders by status
Completed tasks
Pending tasks
Overdue tasks
Average completion time
On-time delivery rate
Revision rate
Workload by designer/editor
Monthly trend
```

## Recommended Charts

| Metric | Chart Type |
|---|---|
| Orders by month | Line chart / Bar chart |
| Orders by type | Donut chart / Bar chart |
| Tasks by staff | Bar chart |
| Status distribution | Donut chart |
| Overdue tasks | KPI card + table |
| On-time rate | KPI card / Gauge |
| Average completion time | KPI card + line chart |

## Rules
Claude must:
- Choose charts based on decision-making value.
- Include filters by time, staff, branch, task type, and status.
- Include tables for drill-down.
- Avoid decorative charts with no operational value.

---

# 37. Google Sheet / Database Sync Knowledge

## Purpose
This knowledge helps Claude understand systems where forms, spreadsheets, and dashboards sync data.

## When to Use
Use this knowledge for:
- Google Form to Sheet workflows
- Apps Script automations
- Internal order databases
- Production boards
- Delivery logs
- Dashboard reports

## Core Data Flow

```text
Form Submission
→ Master Database
→ Production Board
→ Delivery Log
→ Report Dashboard
```

## Core Concepts

```text
Unique Task ID
Timestamp
Status Mapping
Auto Sync
Last Update
Assigned Staff
Deadline
Final Link
Data Validation
Dashboard Formula
```

## Rules
Claude must:
- Use one master database as source of truth.
- Avoid manually duplicating data where sync can be automated.
- Use unique IDs for tracking.
- Use status mapping for progress and charts.
- Keep production and delivery logs connected to master database.

---

# 38. Priority Skill Learning Order

If Claude cannot apply all skills at once, it should prioritize in this order:

| Priority | Skill | Importance |
|---:|---|---|
| 1 | Product Requirement Skill | Critical |
| 2 | Information Architecture Skill | Critical |
| 3 | User Flow & Workflow Skill | Critical |
| 4 | Role & Permission Skill | Critical |
| 5 | UI Component System Skill | Critical |
| 6 | Design Token Skill | Critical |
| 7 | Responsive Design Skill | Critical |
| 8 | Form Design Skill | Critical |
| 9 | Database Structure Skill | Critical |
| 10 | Status Workflow Skill | Critical |
| 11 | Dashboard & Report Skill | Critical |
| 12 | HTML / CSS / JS Skill | Critical |
| 13 | API Design Skill | High |
| 14 | Authentication & Security Skill | High |
| 15 | QA Testing Skill | High |
| 16 | Deployment Skill | Medium to High |
| 17 | SEO Skill | Depends on public website |
| 18 | Maintenance & Scaling Skill | High for long-term systems |

---

# 39. Recommended File Structure for Claude Skill Library

If this skill pack is split into smaller files, use this structure:

```text
01_WEB_DESIGN_FOUNDATION_SKILL.md
02_PRODUCT_REQUIREMENT_SKILL.md
03_INFORMATION_ARCHITECTURE_SKILL.md
04_USER_FLOW_WORKFLOW_SKILL.md
05_ROLE_PERMISSION_SKILL.md
06_UI_COMPONENT_SYSTEM_SKILL.md
07_DESIGN_TOKEN_SKILL.md
08_RESPONSIVE_DESIGN_SKILL.md
09_FORM_DESIGN_SKILL.md
10_DATABASE_STRUCTURE_SKILL.md
11_STATUS_WORKFLOW_SKILL.md
12_DASHBOARD_REPORT_SKILL.md
13_HTML_CSS_JS_FRONTEND_SKILL.md
14_API_AUTH_SECURITY_SKILL.md
15_QA_DEPLOYMENT_SKILL.md
16_MEDIA_HUB_DOMAIN_KNOWLEDGE.md
```

---

# 40. Minimal Skill Set for Building a Complete Website

If using fewer files, group the knowledge into six master skills:

```text
01_WEB_DESIGN_UIUX_SKILL.md
Includes: grid, layout, typography, color, components, responsive design, accessibility.

02_PRODUCT_WORKFLOW_REQUIREMENT_SKILL.md
Includes: PRD, user flow, workflow, roles, permissions, feature priority.

03_DATA_FORM_DASHBOARD_SKILL.md
Includes: forms, database, status workflow, dashboards, reports, tables.

04_FRONTEND_IMPLEMENTATION_SKILL.md
Includes: HTML, CSS, JS, React, Tailwind, component structure.

05_SECURITY_QA_DEPLOYMENT_SKILL.md
Includes: authentication, permission, security, QA, performance, deployment.

06_MEDIA_HUB_DOMAIN_KNOWLEDGE.md
Includes: creative production workflow, task types, status, report metrics, database sync.
```

---

# 41. Standard Skill File Template

Every future Claude skill file should follow this structure:

```markdown
# Skill Name

## Purpose
Explain what this skill helps Claude do.

## When to Use
Explain when Claude should apply this skill.

## Core Knowledge
List the key concepts Claude must know.

## Rules
List the rules Claude must follow.

## Output Format
Define the expected output structure.

## Checklist
Provide a practical review checklist.

## Examples
Give examples of correct output.

## Anti-patterns
List common mistakes to avoid.
```

---

# 42. Claude Response Behavior When Building Websites

When Claude responds to website-building requests, it should follow this sequence:

## Step 1: Understand the Goal
Identify the business purpose and target users.

## Step 2: Define the Structure
Create sitemap, page list, and navigation.

## Step 3: Define the Workflow
Create user flow, data flow, and status flow.

## Step 4: Define Roles
Create role and permission matrix.

## Step 5: Define UI System
Create layout, grid, components, typography, colors, and design tokens.

## Step 6: Define Data
Create database schema, form fields, table columns, and reporting metrics.

## Step 7: Define Implementation
Choose HTML/CSS/JS, React/Tailwind, Apps Script, or another suitable stack.

## Step 8: Build or Specify
Generate code or write a developer-ready specification.

## Step 9: Test
Create QA checklist and acceptance criteria.

## Step 10: Document
Create README, user guide, admin guide, or technical handoff.

---

# 43. Final Instruction for Claude

When applying this skill pack, Claude must avoid giving only surface-level design advice.

Claude must produce practical and buildable outputs, such as:

- Clear feature lists
- Page structures
- User flows
- Data flows
- Role permission matrices
- UI component systems
- Design tokens
- Database schemas
- API specifications
- Dashboard/report definitions
- Front-end implementation plans
- QA checklists
- Deployment notes
- Documentation files

Claude must preserve project-specific brand guidelines, content requirements, and business workflows provided by the user.

Claude should always aim to make the final website:

```text
Useful
Clear
Consistent
Responsive
Maintainable
Scalable
Ready for handoff
```
