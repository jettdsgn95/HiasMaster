# CB Creative Flow - Media Hub by CB Centres
# AI Tools Module — Detailed Specification for Dev

**Module:** AI Tools  
**Purpose:** Tích hợp các tiện ích AI/API hỗ trợ tạo nội dung cơ bản, tối ưu brief, tạo caption, ads copy, visual prompt, outline slide và ý tưởng campaign cho team Media/Marketing.  
**Version:** v1.0  
**Brand:** CB Centres — Red `#BA110F`, Blue `#191970`, Font Montserrat, clean SaaS dashboard.  

---

# 1. Mục đích

**AI Tools Module** là khu vực tích hợp các tiện ích AI/API trong portal **CB Creative Flow - Media Hub by CB Centres**.

Module này dùng để:

```text
Tạo caption social cơ bản
Tạo ads copy
Tạo headline/CTA
Tối ưu brief từ requester
Tạo visual prompt cho AI image/video tools
Tạo outline slide/proposal
Gợi ý campaign idea
Tóm tắt brief
Gợi ý thông tin còn thiếu trong brief
Chuẩn hóa output theo brand CB
```

AI Tools không thay thế quy trình duyệt nội bộ. Output từ AI chỉ là bản nháp, người dùng vẫn phải kiểm tra trước khi sử dụng.

---

# 2. Người dùng chính

```text
Admin
Account
Design
Editor
Marketing/Media Staff
Client nếu được cấp quyền giới hạn
```

## Admin

```text
Dùng toàn bộ AI Tools
Cấu hình API/model nếu được đưa vào Settings
Quản lý prompt template
Quản lý quyền dùng AI theo role
Xem usage log
```

## Account

```text
Tối ưu brief
Tóm tắt brief
Viết lại nội dung gửi client
Tạo caption/ads copy cơ bản
Tạo checklist thông tin còn thiếu
```

## Design

```text
Tạo visual prompt
Tạo concept direction
Tạo mood/style keywords
Tạo mô tả layout
Tạo prompt chỉnh ảnh nếu cần
```

## Editor

```text
Tạo video concept
Tạo storyboard outline
Tạo shooting prompt
Tạo caption cho reel/tiktok
Tạo script ngắn
```

## Client

Client chỉ được dùng nếu Admin bật quyền, nên giới hạn ở:

```text
Post Generator cơ bản
Caption Builder
Brief Helper
```

Không nên cho client truy cập AI internal prompt/template nhạy cảm.

---

# 3. Vị trí trong hệ thống

## Menu

```text
Tools
└── AI Tools
```

## Route đề xuất

```text
/ai-tools
/ai-tools/post-generator
/ai-tools/ads-copy-generator
/ai-tools/brief-optimizer
/ai-tools/visual-prompt-generator
/ai-tools/slide-outline-generator
/ai-tools/campaign-idea-generator
```

---

# 4. Danh sách AI Mini Apps

```text
01. Post Generator
02. Ads Copy Generator
03. Caption Builder
04. Brief Optimizer
05. Brief Missing Info Checker
06. Visual Prompt Generator
07. Video Concept / Storyboard Generator
08. Slide Outline Generator
09. Campaign Idea Generator
10. Hashtag / CTA Generator
11. Translation / Tone Adjuster
12. Content Summarizer
```

---

# 5. Layout tổng thể

```text
AI Tools Page
├── Header Area
│   ├── Page title
│   ├── Subtitle
│   ├── Search AI tool
│   └── Usage indicator nếu có
│
├── Tool Category Tabs
│   ├── Content
│   ├── Ads
│   ├── Brief
│   ├── Visual
│   ├── Video
│   ├── Slide
│   └── Campaign
│
├── Tool Cards Grid
│   ├── Post Generator
│   ├── Ads Copy Generator
│   ├── Brief Optimizer
│   ├── Visual Prompt Generator
│   └── ...
│
└── Selected Tool Workspace
    ├── Input Form
    ├── Brand Preset
    ├── Generate Button
    ├── Output Result
    ├── Copy/Save Actions
    └── Usage Log
```

---

# 6. Brand Preset mặc định

```text
Brand: CB Centres
Industry: English education / education brand in Vietnam
Tone: professional, clear, trustworthy, modern, energetic but not childish
Primary Color: #BA110F
Secondary Color: #191970
Font direction: Montserrat/Gotham style
Audience: Vietnamese students, parents, teachers, partners
Language: Vietnamese by default
Visual style: clean, premium, education-focused, corporate, modern
Avoid: overclaiming, misleading promises, exaggerated guarantee claims
```

## Brand guardrails

AI output cần tránh:

```text
Cam kết điểm số tuyệt đối nếu không có nguồn
Claim sai sự thật
Sử dụng ngôn ngữ quá giật gân
Thông tin ưu đãi không có trong brief
Tự bịa ngày giờ, địa điểm, học phí, hotline
Dùng sai brand name
```

---

# 7. AI Tool Workspace chuẩn

Mỗi tool nên dùng cấu trúc chung:

```text
Tool Header
├── Tool name
├── Short description
├── Role access badge
└── Use case examples

Input Form
├── Required input fields
├── Optional input fields
├── Brand preset selector
├── Tone selector
├── Output format selector
└── Generate button

Output Panel
├── Generated result
├── Copy button
├── Regenerate button
├── Save to Order/Task button
├── Export .txt/.md button
└── Feedback: Good/Bad
```

---

# 8. Mini Apps Detail

## 8.1. Post Generator

**Mục đích:** Tạo bài đăng social cơ bản theo brief chương trình.

| Field | Type | Required | Note |
|---|---|---:|---|
| Tên chương trình | Text | Yes | Ví dụ: CB Green Adventure |
| Mục tiêu bài viết | Select | Yes | Tuyển sinh / Thông báo / Recap / Event / Branding |
| Đối tượng mục tiêu | Multi-select | Yes | Phụ huynh, học viên, đối tác... |
| Thông điệp chính | Textarea | Yes | Key message |
| Ưu đãi/thông tin nổi bật | Textarea | No | Không tự bịa nếu để trống |
| CTA | Text | No | Đăng ký ngay, Inbox tư vấn... |
| Kênh đăng | Select | Yes | Facebook / Zalo / TikTok / Website |
| Tone | Select | No | Professional / Friendly / Premium / Energetic |
| Độ dài | Select | No | Ngắn / Vừa / Dài |

Output:

```text
Caption chính
Headline gợi ý
CTA
Hashtag
Gợi ý visual direction
```

## 8.2. Ads Copy Generator

**Mục đích:** Tạo nội dung ads copy cơ bản cho Facebook/Zalo/Google.

Input:

```text
Campaign name
Ads objective
Target audience
Product/program
Key benefit
Promotion if any
CTA
Channel
Compliance notes
```

Output:

```text
Primary Text
Headline
Description
CTA
3 hook options
3 angle options
Short version
Long version
```

Guardrails:

```text
Không cam kết kết quả học tập tuyệt đối.
Không tự thêm ưu đãi nếu brief không có.
Không viết sai tên chương trình.
Không dùng ngôn ngữ gây hiểu lầm.
```

## 8.3. Caption Builder

Input:

```text
Content topic
Target audience
Main message
Photo/video context
CTA
Tone
Length
```

Output:

```text
Caption version 1 — Professional
Caption version 2 — Friendly
Caption version 3 — Short CTA
Hashtag
```

## 8.4. Brief Optimizer

**Mục đích:** Chuẩn hóa brief thô thành brief rõ ràng cho Account/Design/Editor.

Input:

```text
Raw brief text
Request type
Deliverable type
Deadline
Available assets
Requester note
```

Output:

```text
Tóm tắt mục tiêu
Đối tượng mục tiêu
Hạng mục cần làm
Kích thước/tỉ lệ
Nội dung bắt buộc
Định hướng visual
Tài nguyên đã có
Tài nguyên còn thiếu
Câu hỏi cần hỏi lại requester
Đề xuất deadline nội bộ nếu có đủ dữ liệu
```

## 8.5. Brief Missing Info Checker

Output:

```text
Brief completeness score
Missing fields
Risk level
Suggested questions to requester
Ready to confirm brief: Yes/No
```

Example:

```text
Brief Completeness: 72%
Missing:
- Kích thước standee
- Link hình ảnh sản phẩm
- CTA chính
Suggested question:
Anh/chị vui lòng bổ sung kích thước standee và hình ảnh sản phẩm cần sử dụng.
```

## 8.6. Visual Prompt Generator

Input:

```text
Campaign name
Visual objective
Main subject
Audience
Style
Canvas size
Brand colors
Must include
Must avoid
Reference description
Language
```

Style options:

```text
Premium corporate
Clean education
Cinematic realistic
3D cartoon
Minimal luxury
Event poster
Social advertising
Photo manipulation
```

Output:

```text
Prompt tiếng Anh
Prompt tiếng Việt
Negative prompt
Layout direction
Color direction
Typography direction
```

Brand rule:

```text
Use CB brand red #BA110F and navy #191970 when appropriate.
Clean white space.
Modern education brand.
Vietnamese students/parents/teachers if human subjects are requested.
```

## 8.7. Video Concept / Storyboard Generator

Input:

```text
Video type
Campaign name
Audience
Key message
Duration
Format
Channel
Footage available
Tone
CTA
```

Output:

```text
Video concept
Hook 3 giây đầu
Scene-by-scene outline
Shot list
Voice-over draft
On-screen text
CTA ending
Music/mood direction
```

## 8.8. Slide Outline Generator

Input:

```text
Topic
Audience
Purpose
Raw content
Number of slides
Brand tone
Presentation style
```

Output:

```text
Agenda
Slide-by-slide outline
Title per slide
Key message per slide
Suggested visual per slide
Speaker note draft
```

## 8.9. Campaign Idea Generator

Output:

```text
3–5 campaign concepts
Concept name
Big idea
Key message
Visual direction
Content pillars
Suggested content formats
Launch plan outline
```

## 8.10. Hashtag / CTA Generator

Output:

```text
CTA options
Short CTA
Urgent CTA
Premium CTA
Friendly CTA
Hashtag set
```

---

# 9. Save to Order / Task

AI output có thể được lưu vào order/task nếu user có quyền.

```text
Save to Order Note
Save to Brief Optimized Version
Save to Content Draft
Save to Visual Prompt
Save to Account Internal Note
Save as Attachment/Markdown
```

Required fields:

```text
order_id optional
task_id optional
tool_name
input_json
output_text
created_by
created_at
```

---

# 10. AI Usage Log

Mỗi lần generate cần ghi log.

```text
usage_id
user_id
tool_name
order_id optional
task_id optional
input_summary
output_summary
model
tokens_used
created_at
feedback
```

Mục đích:

```text
Theo dõi usage
Kiểm soát chi phí API
Đánh giá tool nào được dùng nhiều
Debug khi output lỗi
```

---

# 11. Permission Rules

| Role | AI Tools Access |
|---|---|
| Admin | Full |
| Manager/Leader | Full hoặc theo cấu hình |
| Account | Content, Brief, Ads, Caption |
| Design | Brief, Visual Prompt, Campaign Idea |
| Editor | Video Concept, Caption, Visual Prompt |
| Client | Optional, giới hạn |

Mỗi tool cần có:

```text
enabled
allowed_roles
daily_limit_per_user
can_save_to_order
can_export
```

---

# 12. API Requirements

## List AI tools

```http
GET /api/ai-tools
```

## Generate output

```http
POST /api/ai-tools/{tool_key}/generate
```

Request:

```json
{
  "tool_key": "post_generator",
  "order_id": "MEDIA-2026-0001",
  "input": {
    "campaign_name": "CB Green Adventure",
    "audience": ["Phụ huynh", "Học viên"],
    "key_message": "Trải nghiệm hè toàn diện",
    "cta": "Đăng ký ngay"
  },
  "brand_preset": "cb_default",
  "tone": "Professional"
}
```

Response:

```json
{
  "success": true,
  "output": {
    "caption": "...",
    "headline": "...",
    "cta": "...",
    "hashtags": ["#CBCentres", "#CBGreenAdventure"]
  },
  "usage_id": "AI-USE-0001"
}
```

## Save AI output

```http
POST /api/ai-tools/save-output
```

## AI usage logs

```http
GET /api/ai-tools/usage
```

Query params:

```text
user_id
tool_key
start_date
end_date
order_id
```

## Feedback on AI output

```http
POST /api/ai-tools/{usage_id}/feedback
```

---

# 13. Database Tables

## AITools table

| Field | Type | Required |
|---|---|---:|
| tool_id | string | Yes |
| tool_key | string | Yes |
| tool_name | string | Yes |
| description | text | No |
| category | string | Yes |
| enabled | boolean | Yes |
| allowed_roles | json | Yes |
| prompt_template | text | Yes |
| output_schema | json | No |
| created_at | datetime | Yes |
| updated_at | datetime | Yes |

## AIUsageLog table

| Field | Type | Required |
|---|---|---:|
| usage_id | string | Yes |
| user_id | string | Yes |
| tool_key | string | Yes |
| order_id | string | No |
| task_id | string | No |
| input_json | json | Yes |
| output_text | text/json | Yes |
| model | string | No |
| tokens_used | number | No |
| cost_estimate | number | No |
| feedback | string | No |
| created_at | datetime | Yes |

## AISavedOutputs table

| Field | Type | Required |
|---|---|---:|
| saved_id | string | Yes |
| usage_id | string | Yes |
| order_id | string | No |
| task_id | string | No |
| save_to | string | Yes |
| content | text | Yes |
| created_by | string | Yes |
| created_at | datetime | Yes |

---

# 14. Frontend Component Structure

```text
AIToolsPage
├── AIToolsHeader
│   ├── SearchToolInput
│   ├── CategoryTabs
│   └── UsageIndicator
│
├── AIToolCardsGrid
│   └── AIToolCard
│
├── AIToolWorkspace
│   ├── ToolHeader
│   ├── ToolInputForm
│   ├── BrandPresetPanel
│   ├── GenerateButton
│   ├── OutputPanel
│   ├── OutputActions
│   └── UsageLogPanel
│
├── SaveToOrderModal
├── PromptTemplatePreview
└── AIUsageHistory
```

---

# 15. UI States

```text
Loading AI Tools...
Generating output...
Saving output...
Loading usage history...
```

```text
Chưa có output.
Chưa có lịch sử sử dụng AI.
Không có tool nào trong category này.
```

```text
Không thể tạo nội dung AI.
API key chưa được cấu hình.
Bạn đã vượt giới hạn sử dụng hôm nay.
Bạn không có quyền dùng tool này.
```

```text
Đã tạo nội dung.
Đã copy.
Đã lưu vào order.
Đã xuất file.
```

---

# 16. Validation Rules

```text
tool must be enabled
user role must be allowed
required input fields must not be empty
daily usage limit must not be exceeded
AI provider must be configured
API key must exist if provider requires it
order_id must be accessible by current user before save_to_order
```

---

# 17. Acceptance Criteria

## Functional

```text
User có quyền có thể mở AI Tools.
Hiển thị danh sách AI mini-apps.
User chọn tool và nhập input.
Hệ thống generate output qua API.
Output hiển thị rõ ràng, có copy/regenerate/save.
Có thể lưu output vào Order/Task nếu user có quyền.
Có usage log cho mỗi lần generate.
Có feedback good/bad cho output.
Tool access theo role/permission.
```

## Security

```text
Client không truy cập internal prompt/template nếu không có quyền.
User không thể save output vào order/task không thuộc quyền.
API key không expose frontend.
Backend enforce usage limit và permission.
```

## UX

```text
Giao diện dạng mini app dễ dùng.
Có brand preset CB.
Output chia section rõ ràng.
Có loading/error/success state.
Có copy button.
Có warning: AI output cần được kiểm tra trước khi sử dụng.
```

---

# 18. Suggested Initial Build Scope

## MVP

```text
AI Tools listing
Post Generator
Ads Copy Generator
Brief Optimizer
Visual Prompt Generator
Output panel
Copy button
Usage log basic
Permission by role
```

## Phase 2

```text
Save output to Order/Task
Brief Missing Info Checker
Video Concept Generator
Slide Outline Generator
Usage limit
Feedback on output
```

## Phase 3

```text
Custom prompt template manager
AI cost dashboard
AI-generated report summary
AI workload recommendation
Advanced brand compliance checker
```

---

# 19. Prompt cho Dev/Claude

```text
Build the AI Tools Module for "CB Creative Flow - Media Hub by CB Centres".

Purpose:
Provide mini AI apps for content creation, ads copy, brief optimization, visual prompt generation, video concept, slide outline and campaign ideas.

Required mini apps:
- Post Generator
- Ads Copy Generator
- Caption Builder
- Brief Optimizer
- Brief Missing Info Checker
- Visual Prompt Generator
- Video Concept / Storyboard Generator
- Slide Outline Generator
- Campaign Idea Generator
- Hashtag / CTA Generator

Each tool must include:
- Input form
- Brand preset CB
- Generate button
- Output panel
- Copy button
- Regenerate button
- Save to Order/Task if user has permission
- Usage log

Security:
Backend must enforce permission and usage limit.
Do not expose API key in frontend.
Client access must be limited.

Use clean professional SaaS UI with CB colors #BA110F and #191970.
```
