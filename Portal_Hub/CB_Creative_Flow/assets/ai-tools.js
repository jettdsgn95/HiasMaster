/* =====================================================================
   CB Media Hub — AI Tools module logic
   - Static MVP demo based on CB_Creative_Flow_09_ai_tools_module.md
   - Role permissions, dynamic forms, mock generation, usage log
   ===================================================================== */
(function () {
  'use strict';

  let user;
  try { user = JSON.parse(localStorage.getItem('mh-user') || 'null'); } catch (e) { user = null; }
  if (!user || !user.role) { location.replace('login.html'); return; }
  if (user.role === 'client') {
    window.MH.toast({ type: 'error', title: 'Không đủ quyền', message: 'AI Tools nội bộ chưa mở cho client trong demo này.' });
    setTimeout(() => location.replace('tracking.html'), 1200);
    return;
  }
  document.body.setAttribute('data-user', user.email || user.role);
  document.body.setAttribute('data-user-role', user.role);

  const LOG_KEY = 'mh-ai-usage-log';
  const SAVED_KEY = 'mh-ai-saved-outputs';
  const CATEGORIES = [
    { key: 'all', label: 'All' },
    { key: 'content', label: 'Content' },
    { key: 'ads', label: 'Ads' },
    { key: 'brief', label: 'Brief' },
    { key: 'visual', label: 'Visual' },
    { key: 'video', label: 'Video' },
    { key: 'voice', label: 'Voice' },
    { key: 'slide', label: 'Slide' },
    { key: 'campaign', label: 'Campaign' }
  ];

  /* Supertonic voice presets (M1-M5 male, F1-F5 female) — mirror github.com/supertone-inc/supertonic web preset naming. */
  const SUPERTONIC_VOICES = [
    { id: 'F1', label: 'F1 — Female, warm narrator', gender: 'female' },
    { id: 'F2', label: 'F2 — Female, energetic ads', gender: 'female' },
    { id: 'F3', label: 'F3 — Female, premium brand', gender: 'female' },
    { id: 'F4', label: 'F4 — Female, friendly explainer', gender: 'female' },
    { id: 'F5', label: 'F5 — Female, young & playful', gender: 'female' },
    { id: 'M1', label: 'M1 — Male, professional', gender: 'male' },
    { id: 'M2', label: 'M2 — Male, friendly host', gender: 'male' },
    { id: 'M3', label: 'M3 — Male, deep narrator', gender: 'male' },
    { id: 'M4', label: 'M4 — Male, cinematic trailer', gender: 'male' },
    { id: 'M5', label: 'M5 — Male, energetic sport', gender: 'male' }
  ];
  /* Supertonic 31-language list — abbreviated set chosen cho thị trường CB Centres + global. */
  const SUPERTONIC_LANGUAGES = [
    { code: 'vi-VN', label: 'Tiếng Việt (vi)' },
    { code: 'en-US', label: 'English — US (en-US)' },
    { code: 'en-GB', label: 'English — UK (en-GB)' },
    { code: 'ja-JP', label: 'Japanese (ja)' },
    { code: 'ko-KR', label: 'Korean (ko)' },
    { code: 'zh-CN', label: 'Chinese — Mandarin (zh)' },
    { code: 'th-TH', label: 'Thai (th)' },
    { code: 'id-ID', label: 'Indonesian (id)' },
    { code: 'ms-MY', label: 'Malay (ms)' },
    { code: 'fil-PH', label: 'Filipino (fil)' },
    { code: 'fr-FR', label: 'French (fr)' },
    { code: 'es-ES', label: 'Spanish (es)' },
    { code: 'de-DE', label: 'German (de)' },
    { code: 'it-IT', label: 'Italian (it)' },
    { code: 'pt-BR', label: 'Portuguese — BR (pt)' },
    { code: 'auto', label: 'Auto / Language-agnostic' }
  ];
  /* Supertonic expression tags. Web Speech API không hỗ trợ inline expression, nhưng giữ trong script + log để khi swap sang Supertonic ONNX backend giữ nguyên format. */
  const EXPRESSION_TAGS = [
    '(none)', '[laugh]', '[breath]', '[sigh]', '[whisper]',
    '[excited]', '[soft]', '[gasp]', '[chuckle]', '[ahem]', '[smile]'
  ];
  const ROLE_LABEL = { admin: 'Admin', account: 'Account', design: 'Design', editor: 'Editor', client: 'Client' };
  const BRAND_PRESET = [
    'Brand: CB Centres',
    'Industry: English education / education brand in Vietnam',
    'Tone: professional, clear, trustworthy, modern, energetic but not childish',
    'Primary Color: #BA110F',
    'Secondary Color: #191970',
    'Audience: Vietnamese students, parents, teachers, partners',
    'Language: Vietnamese by default',
    'Avoid: overclaiming, misleading promises, exaggerated guarantee claims'
  ];

  const commonTone = ['Professional', 'Friendly', 'Premium', 'Energetic'];
  const tools = [
    {
      key: 'post_generator', name: 'Post Generator', category: 'content',
      desc: 'Tạo bài đăng social cơ bản theo brief chương trình.',
      roles: ['admin', 'account', 'client'],
      fields: [
        f('program', 'Tên chương trình', 'text', true, 'CB Green Adventure'),
        f('goal', 'Mục tiêu bài viết', 'select', true, '', ['Tuyển sinh', 'Thông báo', 'Recap', 'Event', 'Branding']),
        f('audience', 'Đối tượng mục tiêu', 'text', true, 'Phụ huynh, học viên THCS'),
        f('message', 'Thông điệp chính', 'textarea', true, 'Trải nghiệm hè toàn diện, học tiếng Anh qua hoạt động thực tế'),
        f('highlight', 'Ưu đãi/thông tin nổi bật', 'textarea', false, 'Không tự bịa nếu chưa có'),
        f('channel', 'Kênh đăng', 'select', true, '', ['Facebook', 'Zalo', 'TikTok', 'Website']),
        f('tone', 'Tone', 'select', false, '', commonTone),
        f('length', 'Độ dài', 'select', false, '', ['Ngắn', 'Vừa', 'Dài'])
      ],
      sections: ['Caption chính', 'Headline gợi ý', 'CTA', 'Hashtag', 'Gợi ý visual direction']
    },
    {
      key: 'ads_copy', name: 'Ads Copy Generator', category: 'ads',
      desc: 'Tạo ads copy cơ bản cho Facebook/Zalo/Google.',
      roles: ['admin', 'account'],
      fields: [
        f('campaign', 'Campaign name', 'text', true, 'CB Summer 2026'),
        f('objective', 'Ads objective', 'select', true, '', ['Lead', 'Traffic', 'Awareness', 'Conversion']),
        f('audience', 'Target audience', 'textarea', true, 'Phụ huynh có con 8-15 tuổi tại Cần Thơ'),
        f('benefit', 'Key benefit', 'textarea', true, 'Môi trường tiếng Anh hiện đại, giáo viên tận tâm'),
        f('promotion', 'Promotion if any', 'textarea', false, ''),
        f('channel', 'Channel', 'select', true, '', ['Facebook', 'Zalo', 'Google'])
      ],
      sections: ['Primary Text', 'Headline', 'Description', 'CTA', '3 hook options', '3 angle options', 'Short version', 'Long version']
    },
    {
      key: 'caption_builder', name: 'Caption Builder', category: 'content',
      desc: 'Tạo nhiều phiên bản caption theo topic, ngữ cảnh ảnh/video và tone.',
      roles: ['admin', 'account', 'editor', 'client'],
      fields: [
        f('topic', 'Content topic', 'text', true, 'Lớp học giao tiếp cuối tuần'),
        f('audience', 'Target audience', 'text', true, 'Phụ huynh'),
        f('message', 'Main message', 'textarea', true, 'Học viên tự tin nói tiếng Anh qua hoạt động nhóm'),
        f('context', 'Photo/video context', 'textarea', false, 'Ảnh lớp học có giáo viên và học viên thảo luận'),
        f('cta', 'CTA', 'text', false, 'Inbox CB Centres để được tư vấn'),
        f('tone', 'Tone', 'select', false, '', commonTone)
      ],
      sections: ['Caption version 1 — Professional', 'Caption version 2 — Friendly', 'Caption version 3 — Short CTA', 'Hashtag']
    },
    {
      key: 'brief_optimizer', name: 'Brief Optimizer', category: 'brief',
      desc: 'Chuẩn hóa brief thô thành brief rõ ràng cho Account/Design/Editor.',
      roles: ['admin', 'account', 'design'],
      fields: [
        f('raw', 'Raw brief text', 'textarea', true, 'Cần làm poster tuyển sinh khóa hè, tone hiện đại, có logo CB. Deadline tuần sau.'),
        f('type', 'Request type', 'select', true, '', ['Design', 'Video', 'Photo', 'Ads', 'Slide']),
        f('deliverable', 'Deliverable type', 'text', true, 'Poster social 1:1'),
        f('deadline', 'Deadline', 'text', false, '2026-05-20 17:00'),
        f('assets', 'Available assets', 'textarea', false, 'Logo, ảnh lớp học, guideline màu')
      ],
      sections: ['Tóm tắt mục tiêu', 'Đối tượng mục tiêu', 'Hạng mục cần làm', 'Nội dung bắt buộc', 'Định hướng visual', 'Tài nguyên còn thiếu', 'Câu hỏi cần hỏi lại requester']
    },
    {
      key: 'missing_info', name: 'Brief Missing Info Checker', category: 'brief',
      desc: 'Kiểm tra brief còn thiếu gì trước khi confirm hoặc push sang Production.',
      roles: ['admin', 'account', 'design'],
      fields: [
        f('brief', 'Brief text', 'textarea', true, 'Làm standee sự kiện khai giảng. Cần đẹp, đúng brand.'),
        f('requester', 'Requester note', 'textarea', false, ''),
        f('type', 'Request type', 'select', false, '', ['Design', 'Video', 'Photo', 'Ads', 'Slide'])
      ],
      sections: ['Brief completeness score', 'Missing fields', 'Risk level', 'Suggested questions to requester', 'Ready to confirm brief']
    },
    {
      key: 'visual_prompt', name: 'Visual Prompt Generator', category: 'visual',
      desc: 'Tạo prompt tiếng Anh/Việt, negative prompt và direction hình ảnh.',
      roles: ['admin', 'design', 'editor'],
      fields: [
        f('campaign', 'Campaign name', 'text', true, 'CB Future Leaders'),
        f('objective', 'Visual objective', 'textarea', true, 'Key visual tuyển sinh khóa kỹ năng lãnh đạo trẻ'),
        f('subject', 'Main subject', 'text', true, 'Vietnamese students in modern classroom'),
        f('style', 'Style', 'select', true, '', ['Premium corporate', 'Clean education', 'Cinematic realistic', '3D cartoon', 'Minimal luxury', 'Event poster', 'Social advertising', 'Photo manipulation']),
        f('size', 'Canvas size', 'text', false, '1080x1350'),
        f('must', 'Must include', 'textarea', false, 'CB brand red and navy, clean white space'),
        f('avoid', 'Must avoid', 'textarea', false, 'Overcrowded layout, childish cartoon')
      ],
      sections: ['Prompt tiếng Anh', 'Prompt tiếng Việt', 'Negative prompt', 'Layout direction', 'Color direction', 'Typography direction']
    },
    {
      key: 'video_concept', name: 'Video Concept / Storyboard', category: 'video',
      desc: 'Tạo concept video, hook, shot list và voice-over draft.',
      roles: ['admin', 'editor'],
      fields: [
        f('type', 'Video type', 'select', true, '', ['Reel/TikTok', 'Recap', 'Testimonial', 'Event teaser', 'Course intro']),
        f('campaign', 'Campaign name', 'text', true, 'CB Open Day'),
        f('audience', 'Audience', 'text', true, 'Phụ huynh và học viên mới'),
        f('message', 'Key message', 'textarea', true, 'Trải nghiệm lớp học thật trước khi đăng ký'),
        f('duration', 'Duration', 'select', true, '', ['15s', '30s', '45s', '60s']),
        f('format', 'Format', 'select', false, '', ['9:16', '1:1', '16:9'])
      ],
      sections: ['Video concept', 'Hook 3 giây đầu', 'Scene-by-scene outline', 'Shot list', 'Voice-over draft', 'On-screen text', 'CTA ending', 'Music/mood direction']
    },
    {
      key: 'slide_outline', name: 'Slide Outline Generator', category: 'slide',
      desc: 'Tạo agenda, outline từng slide, visual suggestion và speaker note.',
      roles: ['admin', 'account'],
      fields: [
        f('topic', 'Topic', 'text', true, 'Proposal chiến dịch tuyển sinh hè'),
        f('audience', 'Audience', 'text', true, 'Ban giám đốc CB Centres'),
        f('purpose', 'Purpose', 'textarea', true, 'Trình bày kế hoạch media và ngân sách'),
        f('content', 'Raw content', 'textarea', true, 'Insight, mục tiêu lead, kênh triển khai, timeline'),
        f('slides', 'Number of slides', 'select', true, '', ['5', '7', '10', '12'])
      ],
      sections: ['Agenda', 'Slide-by-slide outline', 'Title per slide', 'Key message per slide', 'Suggested visual per slide', 'Speaker note draft']
    },
    {
      key: 'campaign_idea', name: 'Campaign Idea Generator', category: 'campaign',
      desc: 'Gợi ý 3-5 concept campaign, big idea, content pillars và launch plan.',
      roles: ['admin', 'design'],
      fields: [
        f('program', 'Program/Product', 'text', true, 'Khóa tiếng Anh hè 2026'),
        f('goal', 'Campaign goal', 'select', true, '', ['Tuyển sinh', 'Brand awareness', 'Event attendance', 'Retention']),
        f('audience', 'Audience', 'textarea', true, 'Phụ huynh có con 8-15 tuổi'),
        f('insight', 'Key insight', 'textarea', true, 'Phụ huynh muốn con học hè nhưng vẫn vui và có trải nghiệm'),
        f('channels', 'Channels', 'text', false, 'Facebook, TikTok, Zalo')
      ],
      sections: ['3-5 campaign concepts', 'Concept name', 'Big idea', 'Key message', 'Visual direction', 'Content pillars', 'Suggested content formats', 'Launch plan outline']
    },
    {
      key: 'hashtag_cta', name: 'Hashtag / CTA Generator', category: 'content',
      desc: 'Tạo CTA và hashtag set theo chiến dịch.',
      roles: ['admin', 'account', 'client'],
      fields: [
        f('topic', 'Topic', 'text', true, 'Tuyển sinh lớp giao tiếp'),
        f('audience', 'Audience', 'text', true, 'Phụ huynh'),
        f('tone', 'Tone', 'select', false, '', commonTone),
        f('keyword', 'Campaign keyword', 'text', false, 'CBCentres')
      ],
      sections: ['CTA options', 'Short CTA', 'Urgent CTA', 'Premium CTA', 'Friendly CTA', 'Hashtag set']
    },
    {
      key: 'tone_adjuster', name: 'Translation / Tone Adjuster', category: 'content',
      desc: 'Chỉnh tone hoặc dịch nội dung mà vẫn giữ guardrails brand.',
      roles: ['admin', 'account'],
      fields: [
        f('content', 'Content', 'textarea', true, 'Đăng ký ngay để nhận ưu đãi khóa học hè tại CB Centres.'),
        f('mode', 'Mode', 'select', true, '', ['Professional hơn', 'Friendly hơn', 'Premium hơn', 'Dịch sang English', 'Dịch sang Vietnamese']),
        f('note', 'Special note', 'textarea', false, 'Không thêm ưu đãi nếu không có trong nội dung gốc')
      ],
      sections: ['Adjusted version', 'Change summary', 'Risk notes']
    },
    {
      key: 'summarizer', name: 'Content Summarizer', category: 'brief',
      desc: 'Tóm tắt brief hoặc nội dung dài thành summary dễ xử lý.',
      roles: ['admin', 'account', 'design', 'editor'],
      fields: [
        f('content', 'Long content', 'textarea', true, 'Dán brief hoặc ghi chú dài tại đây...'),
        f('format', 'Output format', 'select', true, '', ['Bullet summary', 'Action items', 'Client-friendly summary', 'Internal note']),
        f('length', 'Length', 'select', false, '', ['Ngắn', 'Vừa', 'Chi tiết'])
      ],
      sections: ['Summary', 'Key action items', 'Missing context', 'Recommended next step']
    },
    {
      /* AI Voice — on-device TTS. Engine plan: Supertonic ONNX (github.com/supertone-inc/supertonic).
         Demo runtime: Web Speech API (window.speechSynthesis) — real audio output, no bundling.
         When backend swaps sang Supertonic, voice IDs (M1-M5/F1-F5) + expression tags đã match preset naming sẵn. */
      key: 'ai_voice', name: 'AI Voice (Supertonic)', category: 'voice',
      desc: 'On-device Text-to-Speech: voice-over cho video, recap, ads. 10 voice preset · 16 ngôn ngữ · expression tags.',
      roles: ['admin', 'account', 'design', 'editor'],
      fields: [
        f('script', 'Script / Voice-over text', 'textarea', true, 'Chào mừng bạn đến với CB Centres — nơi học tiếng Anh trở thành hành trình hứng khởi.'),
        f('voice', 'Voice preset', 'select', true, '', SUPERTONIC_VOICES.map((v) => v.label)),
        f('language', 'Language', 'select', true, '', SUPERTONIC_LANGUAGES.map((l) => l.label)),
        f('speed', 'Speech rate', 'select', false, '', ['0.8x — chậm', '1.0x — bình thường', '1.2x — nhanh', '1.4x — rất nhanh']),
        f('pitch', 'Pitch', 'select', false, '', ['Low', 'Normal', 'High']),
        f('quality', 'Quality (total steps)', 'select', false, '', ['Fast (4 steps)', 'Balanced (8 steps)', 'High (16 steps)']),
        f('expression', 'Expression tag', 'select', false, '', EXPRESSION_TAGS),
        f('purpose', 'Use case', 'select', false, '', ['Video voice-over', 'Reel/TikTok narration', 'Recap event', 'Ads radio spot', 'Internal training', 'Slide voice'])
      ],
      sections: ['Script preview', 'Voice settings', 'SSML draft', 'Production handoff note']
    }
  ];

  const state = {
    category: 'all', search: '', active: tools[0], output: '', lastUsageId: '',
    voice: { utterance: null, lastScript: '', lastVoiceId: '', lastLang: '', isSpeaking: false, isPaused: false, supported: 'speechSynthesis' in window }
  };

  function f(key, label, type, required, placeholder, options) {
    return { key, label, type, required, placeholder: placeholder || '', options: options || [] };
  }
  function canUse(tool) { return user.role === 'admin' || tool.roles.includes(user.role); }
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
  function readJSON(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch (e) { return fallback; } }
  function writeJSON(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }
  function nowStamp() { return new Date().toISOString().slice(0, 16).replace('T', ' '); }

  const els = {
    pcName: document.getElementById('pc-name'),
    pcAvatar: document.getElementById('pc-avatar'),
    pcRole: document.getElementById('pc-role-badge'),
    chip: document.getElementById('profile-chip'),
    logout: document.getElementById('logout-btn'),
    sb: document.getElementById('dash-sb'),
    sbd: document.getElementById('sb-backdrop'),
    sbt: document.getElementById('sb-toggle'),
    tabs: document.getElementById('category-tabs'),
    grid: document.getElementById('tool-grid'),
    search: document.getElementById('tool-search'),
    title: document.getElementById('tool-title'),
    desc: document.getElementById('tool-desc'),
    cat: document.getElementById('active-category'),
    access: document.getElementById('tool-access'),
    fields: document.getElementById('dynamic-fields'),
    form: document.getElementById('tool-form'),
    output: document.getElementById('output-box'),
    outputMeta: document.getElementById('output-meta'),
    copy: document.getElementById('copy-output'),
    export: document.getElementById('export-output'),
    regen: document.getElementById('regen-btn'),
    save: document.getElementById('save-btn'),
    usage: document.getElementById('usage-log'),
    usageCount: document.getElementById('usage-count'),
    clearLog: document.getElementById('clear-log'),
    reset: document.getElementById('reset-btn'),
    brand: document.getElementById('brand-card'),
    showBrand: document.getElementById('show-brand'),
    saveModal: document.getElementById('save-modal'),
    saveClose: document.getElementById('save-close'),
    saveCancel: document.getElementById('save-cancel'),
    saveConfirm: document.getElementById('save-confirm'),
    /* AI Voice Player */
    voiceCard: document.getElementById('ai-voice-card'),
    voiceWave: document.getElementById('voice-waveform'),
    voiceId: document.getElementById('voice-id'),
    voiceStatus: document.getElementById('voice-status'),
    voicePlay: document.getElementById('voice-play'),
    voicePause: document.getElementById('voice-pause'),
    voiceStop: document.getElementById('voice-stop'),
    voiceDownloadSsml: document.getElementById('voice-download-ssml')
  };

  function setupChrome() {
    if (els.pcName) els.pcName.textContent = user.name || 'User';
    if (els.pcAvatar) els.pcAvatar.textContent = user.initials || (user.name || 'U').substring(0, 2).toUpperCase();
    if (els.pcRole) {
      els.pcRole.textContent = ROLE_LABEL[user.role] || user.role;
      els.pcRole.className = 'role-badge r--' + user.role;
    }
    if (els.chip) {
      els.chip.addEventListener('click', (e) => { if (e.target.closest('.profile-menu')) return; els.chip.classList.toggle('is-open'); });
      document.addEventListener('click', (e) => { if (!els.chip.contains(e.target)) els.chip.classList.remove('is-open'); });
    }
    if (els.logout) els.logout.addEventListener('click', () => {
      localStorage.removeItem('mh-user');
      window.MH.toast({ type: 'info', title: 'Đã đăng xuất', message: 'Hẹn gặp lại!' });
      setTimeout(() => location.href = 'login.html', 500);
    });
    if (els.sbt) els.sbt.addEventListener('click', () => { els.sb.classList.add('is-open'); els.sbd.classList.add('is-open'); });
    if (els.sbd) els.sbd.addEventListener('click', () => { els.sb.classList.remove('is-open'); els.sbd.classList.remove('is-open'); });
  }

  function renderTabs() {
    els.tabs.innerHTML = CATEGORIES.map((c) => `<button class="ai-tab ${state.category === c.key ? 'is-active' : ''}" type="button" data-cat="${c.key}">${c.label}</button>`).join('');
  }

  function filteredTools() {
    const q = state.search.trim().toLowerCase();
    return tools.filter((tool) => {
      const matchCat = state.category === 'all' || tool.category === state.category;
      const text = `${tool.name} ${tool.desc} ${tool.category}`.toLowerCase();
      return matchCat && (!q || text.includes(q));
    });
  }

  function renderTools() {
    const list = filteredTools();
    els.grid.innerHTML = list.length ? list.map((tool) => {
      const locked = !canUse(tool);
      return `
        <button class="ai-tool-card ${state.active.key === tool.key ? 'is-active' : ''}" type="button" data-tool="${tool.key}" ${locked ? 'aria-disabled="true"' : ''}>
          <span class="ai-tool-icon">${iconFor(tool.category)}</span>
          <span class="ai-tool-name">${esc(tool.name)}</span>
          <span class="ai-tool-desc">${esc(tool.desc)}</span>
          <span class="ai-tool-meta">
            <span>${categoryLabel(tool.category)}</span>
            <span>${locked ? 'No access' : 'Ready'}</span>
          </span>
        </button>`;
    }).join('') : '<div class="ai-empty">Không có tool nào trong category này.</div>';
  }

  function renderWorkspace() {
    const tool = state.active;
    els.title.textContent = tool.name;
    els.desc.textContent = tool.desc;
    els.cat.textContent = categoryLabel(tool.category);
    els.access.textContent = canUse(tool) ? `Access: ${tool.roles.join(', ')}` : 'No access';
    els.access.className = canUse(tool) ? 'role-badge r--admin' : 'role-badge r--account';
    els.fields.innerHTML = tool.fields.map(renderField).join('');
    const disabled = !canUse(tool);
    [...els.form.elements].forEach((el) => { if (el.id !== 'brand-preset') el.disabled = disabled; });
    document.getElementById('generate-btn').disabled = disabled;
    if (disabled) {
      els.output.textContent = 'Bạn không có quyền dùng tool này trong demo hiện tại.';
      els.outputMeta.textContent = 'Permission blocked.';
      setOutputActions(false);
    }
    // Toggle AI Voice Player visibility based on active tool category
    if (els.voiceCard) {
      const isVoice = tool.category === 'voice';
      els.voiceCard.style.display = isVoice ? '' : 'none';
      if (!isVoice) {
        stopVoice();
      } else {
        // Reset player state when switching to / re-entering the voice tool
        stopVoice();
        state.voice.utterance = null;
        if (els.voicePlay) els.voicePlay.disabled = true;
        if (els.voicePause) els.voicePause.disabled = true;
        if (els.voiceStop) els.voiceStop.disabled = true;
        if (els.voiceDownloadSsml) els.voiceDownloadSsml.disabled = true;
        if (els.voiceId) els.voiceId.textContent = '— · — · —';
        if (els.voiceStatus) els.voiceStatus.textContent = state.voice.supported
          ? 'Sẵn sàng. Nhập script và bấm Generate để tạo voice-over.'
          : 'Browser không hỗ trợ Web Speech API. Production runtime sẽ dùng Supertonic ONNX trực tiếp.';
      }
    }
  }

  function renderField(field) {
    const req = field.required ? ' *' : '';
    if (field.type === 'textarea') {
      return `<div class="ai-form-row"><label for="f-${field.key}">${esc(field.label)}${req}</label><textarea class="textarea" id="f-${field.key}" name="${field.key}" rows="4" placeholder="${esc(field.placeholder)}" ${field.required ? 'required' : ''}></textarea></div>`;
    }
    if (field.type === 'select') {
      return `<div class="ai-form-row"><label for="f-${field.key}">${esc(field.label)}${req}</label><select class="select" id="f-${field.key}" name="${field.key}" ${field.required ? 'required' : ''}><option value="">Chọn...</option>${field.options.map((o) => `<option>${esc(o)}</option>`).join('')}</select></div>`;
    }
    return `<div class="ai-form-row"><label for="f-${field.key}">${esc(field.label)}${req}</label><input class="input" id="f-${field.key}" name="${field.key}" placeholder="${esc(field.placeholder)}" ${field.required ? 'required' : ''} /></div>`;
  }

  function collectInput() {
    const data = {};
    state.active.fields.forEach((field) => {
      const el = document.getElementById('f-' + field.key);
      data[field.key] = el ? el.value.trim() : '';
    });
    return data;
  }

  function generateOutput(data) {
    const tool = state.active;
    const primary = Object.values(data).find(Boolean) || tool.name;
    const lines = [
      `# ${tool.name}`,
      '',
      `Generated for: ${primary}`,
      `Brand preset: CB Centres | #BA110F + #191970`,
      ''
    ];
    tool.sections.forEach((section, index) => {
      lines.push(`## ${section}`);
      lines.push(sectionText(tool, section, data, index));
      lines.push('');
    });
    lines.push('## Brand Guardrails');
    lines.push('- Không tự thêm ưu đãi, học phí, ngày giờ hoặc hotline nếu brief chưa cung cấp.');
    lines.push('- Không cam kết điểm số/kết quả học tập tuyệt đối.');
    lines.push('- Kiểm tra lại tên chương trình, CTA và thông tin pháp lý trước khi publish.');
    return lines.join('\n');
  }

  function sectionText(tool, section, data, index) {
    const topic = data.program || data.campaign || data.topic || data.raw || data.brief || data.content || 'nội dung CB Centres';
    const audience = data.audience || 'phụ huynh, học viên và đối tác';
    const message = data.message || data.benefit || data.insight || data.objective || 'truyền tải giá trị học tập rõ ràng, hiện đại và đáng tin cậy';
    if (section.toLowerCase().includes('hashtag')) return '#CBCentres #CBMediaHub #EnglishEducation #LearningJourney';
    if (section.toLowerCase().includes('cta')) return data.cta || 'Inbox CB Centres để được tư vấn chi tiết.';
    if (section.toLowerCase().includes('negative')) return 'low quality, misleading claims, overcrowded layout, wrong brand color, fake promotion details';
    if (section.toLowerCase().includes('score')) return 'Brief Completeness: 72% — cần bổ sung 2-3 thông tin trước khi xác nhận.';
    if (section.toLowerCase().includes('missing') || section.toLowerCase().includes('thiếu')) return '- Kích thước/tỉ lệ\n- Asset nguồn\n- CTA chính\n- Deadline nội bộ';
    if (section.toLowerCase().includes('prompt tiếng anh')) return `Modern education campaign visual for ${topic}, targeting ${audience}, clean premium layout, CB brand red #BA110F and navy #191970, clear whitespace, trustworthy Vietnamese education brand.`;
    if (section.toLowerCase().includes('prompt tiếng việt')) return `Visual giáo dục hiện đại cho ${topic}, hướng đến ${audience}, bố cục sạch, cao cấp, dùng đỏ CB #BA110F và navy #191970.`;
    if (section.toLowerCase().includes('hook')) return `3 giây đầu: đặt vấn đề gần với ${audience}, sau đó mở ra lợi ích chính của ${topic}.`;
    if (section.toLowerCase().includes('slide')) return `Slide ${index + 1}: ${section} — nhấn mạnh ${message}.`;
    return `${section} cho "${topic}": ${message}. Tone đề xuất: ${data.tone || data.mode || 'Professional'}, ngôn ngữ rõ ràng, đúng brand CB.`;
  }

  function handleGenerate(e) {
    e.preventDefault();
    if (!canUse(state.active)) {
      window.MH.toast({ type: 'error', title: 'Không đủ quyền', message: 'Tool này chưa mở cho role hiện tại.' });
      return;
    }
    const data = collectInput();
    const missing = state.active.fields.filter((field) => field.required && !data[field.key]);
    if (missing.length) {
      window.MH.toast({ type: 'warning', title: 'Thiếu input', message: 'Vui lòng điền đủ trường bắt buộc.' });
      return;
    }
    const btn = document.getElementById('generate-btn');
    btn.classList.add('is-loading');
    btn.disabled = true;
    els.output.textContent = 'Generating output...';
    els.outputMeta.textContent = 'Đang tạo bản nháp demo.';
    setTimeout(() => {
      state.output = (state.active.category === 'voice') ? generateVoiceOutput(data) : generateOutput(data);
      state.lastUsageId = 'AI-USE-' + String(Date.now()).slice(-6);
      els.output.textContent = state.output;
      els.outputMeta.textContent = `${state.lastUsageId} · ${state.active.name} · ${nowStamp()}`;
      if (state.active.category === 'voice') prepareVoice(data);
      btn.classList.remove('is-loading');
      btn.disabled = false;
      setOutputActions(true);
      addUsage(data);
      window.MH.toast({ type: 'success', title: 'Đã tạo nội dung', message: 'Output đã sẵn sàng để review.' });
    }, 520);
  }

  function setOutputActions(enabled) {
    [els.copy, els.export, els.regen, els.save, ...document.querySelectorAll('[data-feedback]')].forEach((el) => { if (el) el.disabled = !enabled; });
  }

  function addUsage(input) {
    const entry = {
      usage_id: state.lastUsageId,
      user_id: user.email || user.role,
      tool_key: state.active.key,
      tool_name: state.active.name,
      input_summary: Object.values(input).filter(Boolean).slice(0, 2).join(' · '),
      output_summary: state.output.split('\n').slice(0, 3).join(' '),
      output_full: state.output,
      model: 'demo-static-generator',
      tokens_used: Math.floor(420 + Math.random() * 620),
      created_at: nowStamp(),
      feedback: ''
    };
    // localStorage fallback (giữ demo flow)
    const logs = readJSON(LOG_KEY, []);
    logs.unshift(entry);
    writeJSON(LOG_KEY, logs.slice(0, 50));
    renderLog();
    // Phase 1: persist sang Supabase nếu enabled
    if (window.MH && window.MH.store && window.MH.supabaseEnabled) {
      window.MH.store.aiUsage.log(entry).catch(function (e) { console.warn('[ai-tools] persist usage:', e); });
    }
  }

  function renderLog() {
    const logs = readJSON(LOG_KEY, []);
    const today = new Date().toISOString().slice(0, 10);
    els.usageCount.textContent = logs.filter((log) => log.created_at && log.created_at.slice(0, 10) === today).length;
    els.usage.innerHTML = logs.length ? logs.slice(0, 8).map((log) => `
      <article class="ai-log-item">
        <div>
          <b>${esc(log.tool_name)}</b>
          <span>${esc(log.input_summary || 'No input summary')}</span>
        </div>
        <div class="ai-log-meta">
          <span class="mono">${esc(log.usage_id)}</span>
          <span>${esc(log.created_at)}</span>
        </div>
      </article>
    `).join('') : '<div class="ai-empty">Chưa có lịch sử sử dụng AI.</div>';
  }

  function saveOutput() {
    const target = document.getElementById('save-target').value;
    const order = document.getElementById('save-order').value.trim();
    const task = document.getElementById('save-task').value.trim();
    const entry = {
      saved_id: 'AI-SAVE-' + String(Date.now()).slice(-6),
      usage_id: state.lastUsageId,
      order_id: order || null,
      task_id: task || null,
      save_to: target,
      content: state.output,
      created_by: user.email || user.role,
      created_at: nowStamp()
    };
    // localStorage fallback
    const saved = readJSON(SAVED_KEY, []);
    saved.unshift(entry);
    writeJSON(SAVED_KEY, saved.slice(0, 50));
    closeSaveModal();
    window.MH.toast({ type: 'success', title: 'Đã lưu demo', message: 'Output đã được lưu vào localStorage.' });
    // Phase 1: persist sang Supabase nếu enabled
    if (window.MH && window.MH.store && window.MH.supabaseEnabled) {
      window.MH.store.aiUsage.saveOutput(entry).catch(function (e) { console.warn('[ai-tools] persist saved output:', e); });
    }
  }

  function openSaveModal() { els.saveModal.classList.add('is-open'); els.saveModal.setAttribute('aria-hidden', 'false'); }
  function closeSaveModal() { els.saveModal.classList.remove('is-open'); els.saveModal.setAttribute('aria-hidden', 'true'); }

  function categoryLabel(key) { return (CATEGORIES.find((c) => c.key === key) || {}).label || key; }
  function iconFor(key) {
    const icons = {
      content: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5V4a2 2 0 0 1 2-2h8l6 6v11.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M14 2v6h6"/></svg>',
      ads: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 11 18-5-5 18-4-8-9-5z"/></svg>',
      brief: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11h6M9 15h6"/><path d="M5 3h14v18H5z"/></svg>',
      visual: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
      video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>',
      slide: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 22h8M12 18v4"/></svg>',
      campaign: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11v3a2 2 0 0 0 2 2h2l4 4v-4h5l5 3V6l-5 3H5a2 2 0 0 0-2 2z"/></svg>',
      voice: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>'
    };
    return icons[key] || icons.content;
  }

  /* ---------- AI Voice (Supertonic) — Web Speech API demo runtime ---------- */
  function findVoiceByLabel(label) {
    return SUPERTONIC_VOICES.find((v) => v.label === label) || SUPERTONIC_VOICES[0];
  }
  function findLangByLabel(label) {
    return SUPERTONIC_LANGUAGES.find((l) => l.label === label) || SUPERTONIC_LANGUAGES[0];
  }
  function speedToRate(label) {
    if (!label) return 1.0;
    const m = /([0-9.]+)x/.exec(label);
    return m ? parseFloat(m[1]) : 1.0;
  }
  function pitchToValue(label) {
    if (label === 'Low') return 0.7;
    if (label === 'High') return 1.4;
    return 1.0;
  }
  function stripExpressionTags(text) {
    // Web Speech API can't render expression tags inline. Strip for actual speech but keep in SSML/log.
    return (text || '').replace(/\[(laugh|breath|sigh|whisper|excited|soft|gasp|chuckle|ahem|smile)\]/gi, '');
  }
  function generateVoiceOutput(data) {
    const voice = findVoiceByLabel(data.voice);
    const lang = findLangByLabel(data.language);
    const expr = data.expression && data.expression !== '(none)' ? data.expression : '';
    const script = (expr ? expr + ' ' : '') + (data.script || '');
    const lines = [
      `# AI Voice (Supertonic) — generated draft`,
      '',
      `## Script preview`,
      script,
      '',
      `## Voice settings`,
      `- Voice preset: ${voice.id} · ${voice.label}`,
      `- Language: ${lang.code} · ${lang.label}`,
      `- Speech rate: ${data.speed || '1.0x — bình thường'}`,
      `- Pitch: ${data.pitch || 'Normal'}`,
      `- Quality: ${data.quality || 'Balanced (8 steps)'}`,
      `- Expression: ${data.expression || '(none)'}`,
      `- Use case: ${data.purpose || '—'}`,
      '',
      `## SSML draft`,
      `<speak xml:lang="${lang.code}">`,
      `  <voice name="${voice.id}">`,
      `    <prosody rate="${data.speed || '1.0x'}" pitch="${data.pitch || 'normal'}">`,
      `      ${esc(script)}`,
      `    </prosody>`,
      `  </voice>`,
      `</speak>`,
      '',
      `## Production handoff note`,
      `Demo runtime: Web Speech API (browser built-in).`,
      `Production target: Supertonic ONNX runtime — github.com/supertone-inc/supertonic`,
      `- Model: ~99M params · 44.1kHz 16-bit output · WebGPU/WASM fallback`,
      `- Voice preset IDs (M1-M5/F1-F5) đã match spec — chỉ cần swap backend.`,
      `- Expression tags được preserve trong SSML để Supertonic render inline.`
    ];
    return lines.join('\n');
  }

  function prepareVoice(data) {
    if (!els.voiceCard) return;
    if (!state.voice.supported) {
      els.voiceStatus.textContent = 'Browser không hỗ trợ Web Speech API.';
      return;
    }
    stopVoice();
    const voice = findVoiceByLabel(data.voice);
    const lang = findLangByLabel(data.language);
    const langCode = lang.code === 'auto' ? '' : lang.code;
    const cleanScript = stripExpressionTags(data.script);

    els.voiceId.textContent = `${voice.id} · ${lang.code} · ${data.quality || 'Balanced'}`;
    els.voiceStatus.textContent = 'Sẵn sàng phát. Nhấn Play để nghe demo on-device.';
    els.voicePlay.disabled = false;
    els.voicePause.disabled = true;
    els.voiceStop.disabled = true;
    els.voiceDownloadSsml.disabled = false;

    // Match browser voice to gender + language (best-effort — depends on OS voice availability)
    const utter = new SpeechSynthesisUtterance(cleanScript);
    if (langCode) utter.lang = langCode;
    utter.rate = speedToRate(data.speed);
    utter.pitch = pitchToValue(data.pitch);
    utter.volume = 1;
    // Try to bind a matching system voice
    const sysVoices = window.speechSynthesis.getVoices();
    if (sysVoices && sysVoices.length) {
      const candidates = sysVoices.filter((v) => !langCode || v.lang.toLowerCase().startsWith(langCode.slice(0, 2).toLowerCase()));
      const genderHinted = candidates.find((v) => {
        const n = (v.name || '').toLowerCase();
        if (voice.gender === 'female') return /female|woman|f$|f-|girl/.test(n);
        return /male|man|m$|m-|guy/.test(n);
      });
      utter.voice = genderHinted || candidates[0] || sysVoices[0];
    }
    utter.onstart = () => { state.voice.isSpeaking = true; els.voiceWave.classList.add('is-active'); els.voiceStatus.textContent = 'Đang phát...'; els.voicePause.disabled = false; els.voiceStop.disabled = false; els.voicePlay.disabled = true; };
    utter.onend = () => { state.voice.isSpeaking = false; state.voice.isPaused = false; els.voiceWave.classList.remove('is-active'); els.voiceStatus.textContent = 'Đã phát xong. Nhấn Play để phát lại.'; els.voicePlay.disabled = false; els.voicePause.disabled = true; els.voiceStop.disabled = true; };
    utter.onerror = (ev) => { state.voice.isSpeaking = false; els.voiceWave.classList.remove('is-active'); els.voiceStatus.textContent = 'Lỗi phát: ' + (ev.error || 'unknown'); els.voicePlay.disabled = false; els.voicePause.disabled = true; els.voiceStop.disabled = true; };
    state.voice.utterance = utter;
    state.voice.lastScript = cleanScript;
    state.voice.lastVoiceId = voice.id;
    state.voice.lastLang = lang.code;
  }
  function playVoice() {
    if (!state.voice.supported) return;
    if (state.voice.isPaused) {
      window.speechSynthesis.resume();
      state.voice.isPaused = false;
      els.voiceWave.classList.add('is-active');
      els.voiceStatus.textContent = 'Đang phát (resume)...';
      els.voicePause.disabled = false;
      els.voicePlay.disabled = true;
      return;
    }
    if (!state.voice.utterance) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(state.voice.utterance);
  }
  function pauseVoice() {
    if (!state.voice.supported || !state.voice.isSpeaking) return;
    window.speechSynthesis.pause();
    state.voice.isPaused = true;
    els.voiceWave.classList.remove('is-active');
    els.voiceStatus.textContent = 'Tạm dừng.';
    els.voicePause.disabled = true;
    els.voicePlay.disabled = false;
  }
  function stopVoice() {
    if (!state.voice.supported) return;
    try { window.speechSynthesis.cancel(); } catch (e) {}
    state.voice.isSpeaking = false;
    state.voice.isPaused = false;
    if (els.voiceWave) els.voiceWave.classList.remove('is-active');
    if (els.voicePause) els.voicePause.disabled = true;
    if (els.voiceStop) els.voiceStop.disabled = true;
    if (els.voicePlay && state.voice.utterance) els.voicePlay.disabled = false;
  }
  function downloadSsml() {
    if (!state.voice.lastScript) return;
    // Output SSML matches the `## SSML draft` section from generateVoiceOutput — safe for Supertonic backend.
    const ssml = state.output.match(/<speak[\s\S]*?<\/speak>/);
    const text = ssml ? ssml[0] : `<speak xml:lang="${state.voice.lastLang}"><voice name="${state.voice.lastVoiceId}">${esc(state.voice.lastScript)}</voice></speak>`;
    const blob = new Blob([text], { type: 'application/ssml+xml;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cb-voice-${state.voice.lastVoiceId}-${new Date().toISOString().slice(0, 10)}.ssml`;
    a.click();
    URL.revokeObjectURL(a.href);
    window.MH.toast({ type: 'success', title: 'Đã export SSML', message: 'SSML sẵn sàng cho Supertonic backend.' });
  }

  function wireEvents() {
    els.tabs.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cat]');
      if (!btn) return;
      state.category = btn.dataset.cat;
      renderTabs(); renderTools();
    });
    els.grid.addEventListener('click', (e) => {
      const card = e.target.closest('[data-tool]');
      if (!card) return;
      const tool = tools.find((t) => t.key === card.dataset.tool);
      if (!tool) return;
      state.active = tool;
      state.output = '';
      els.output.textContent = canUse(tool) ? 'Chọn tool, điền input và bấm Generate để tạo bản nháp.' : 'Bạn không có quyền dùng tool này trong demo hiện tại.';
      els.outputMeta.textContent = canUse(tool) ? 'Chưa có output.' : 'Permission blocked.';
      setOutputActions(false);
      renderTools(); renderWorkspace();
    });
    els.search.addEventListener('input', () => { state.search = els.search.value; renderTools(); });
    els.form.addEventListener('submit', handleGenerate);
    els.reset.addEventListener('click', () => els.form.reset());
    els.regen.addEventListener('click', () => handleGenerate(new Event('submit')));
    els.copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(state.output); window.MH.toast({ type: 'success', title: 'Đã copy', message: 'Output đã được sao chép.' }); }
      catch (e) { window.MH.toast({ type: 'error', message: 'Không thể copy.' }); }
    });
    els.export.addEventListener('click', () => {
      const blob = new Blob([state.output], { type: 'text/markdown;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${state.active.key}-${new Date().toISOString().slice(0, 10)}.md`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
    els.save.addEventListener('click', openSaveModal);
    els.saveClose.addEventListener('click', closeSaveModal);
    els.saveCancel.addEventListener('click', closeSaveModal);
    els.saveModal.addEventListener('click', (e) => { if (e.target === els.saveModal) closeSaveModal(); });
    els.saveConfirm.addEventListener('click', saveOutput);
    els.clearLog.addEventListener('click', () => { localStorage.removeItem(LOG_KEY); renderLog(); });
    els.showBrand.addEventListener('click', () => els.brand.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    document.querySelectorAll('[data-feedback]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const logs = readJSON(LOG_KEY, []);
        const log = logs.find((item) => item.usage_id === state.lastUsageId);
        if (log) {
          log.feedback = btn.dataset.feedback;
          writeJSON(LOG_KEY, logs);
          renderLog();
        }
        window.MH.toast({ type: 'success', title: 'Đã ghi feedback', message: btn.dataset.feedback === 'good' ? 'Cảm ơn feedback tốt.' : 'Đã ghi nhận để cải thiện prompt.' });
      });
    });
    /* AI Voice Player buttons */
    if (els.voicePlay) els.voicePlay.addEventListener('click', playVoice);
    if (els.voicePause) els.voicePause.addEventListener('click', pauseVoice);
    if (els.voiceStop) els.voiceStop.addEventListener('click', stopVoice);
    if (els.voiceDownloadSsml) els.voiceDownloadSsml.addEventListener('click', downloadSsml);
    // Pre-warm voice list (Chrome lazy-loads system voices)
    if (state.voice.supported && typeof window.speechSynthesis.onvoiceschanged !== 'undefined') {
      window.speechSynthesis.onvoiceschanged = () => { /* triggers refresh of getVoices() */ };
    }
    // Stop synthesis when switching tools or leaving page
    window.addEventListener('beforeunload', stopVoice);
  }

  setupChrome();
  renderTabs();
  renderTools();
  renderWorkspace();
  renderLog();
  wireEvents();
})();
