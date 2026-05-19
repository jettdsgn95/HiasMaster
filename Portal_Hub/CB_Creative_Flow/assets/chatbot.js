/* =====================================================================
   CB Media Hub — Chatbot module logic
   - Dedicated chatbot page + floating widget for internal pages
   - Static MVP based on CB_Creative_Flow_10_chatbot_module.md
   ===================================================================== */
(function () {
  'use strict';

  const HISTORY_KEY = 'mh-chatbot-history';
  const FEEDBACK_KEY = 'mh-chatbot-feedback';
  const ROLE_LABEL = { admin: 'Admin', account: 'Account', design: 'Design', editor: 'Editor', client: 'Client' };
  const user = readUser();
  if (!user && document.querySelector('[data-chatbot-page]')) { location.replace('login.html'); return; }
  if (user) {
    document.body.setAttribute('data-user', user.email || user.role);
    document.body.setAttribute('data-user-role', user.role);
  }

  const orders = [
    { id: 'MEDIA-2026-0001', project: 'Summer Campaign 2026', public_status: 'Đang xử lý', internal_status: 'Đang thực hiện', account: 'Hậu', pic: 'Duy', progress: 50, deadline: '2026-05-20 17:00', owner: 'account@cb.vn', task: 'TASK-0001', delivery: 'Chưa bàn giao' },
    { id: 'MEDIA-2026-0004', project: 'Bộ Key Visual Sự kiện Q3', public_status: 'Đang sản xuất', internal_status: 'In Production', account: 'Mai Phương', pic: 'Duy', progress: 50, deadline: '2026-05-20 17:00', owner: 'admin@cb.vn', task: 'TASK-0001', delivery: 'Chưa bàn giao' },
    { id: 'MEDIA-2026-0008', project: 'Recap Open Day', public_status: 'Chờ phản hồi', internal_status: 'Client feedback', account: 'Hậu', pic: 'Vinh', progress: 80, deadline: '2026-05-15 17:00', owner: 'account@cb.vn', task: 'TASK-0008', delivery: 'Preview đã gửi' }
  ];
  const tasks = [
    { id: 'TASK-0001', order: 'MEDIA-2026-0004', project: 'Bộ Key Visual Sự kiện Q3', status: 'Đang thực hiện', pic: 'Duy', role: 'design', progress: 50, deadline: '2026-05-20 17:00' },
    { id: 'TASK-0003', order: 'MEDIA-2026-0006', project: 'Reel TikTok Tháng 5', status: 'Chờ duyệt nội bộ', pic: 'Vinh', role: 'editor', progress: 65, deadline: '2026-05-12 17:00' },
    { id: 'TASK-0016', order: 'MEDIA-2026-0013', project: 'Recap Lễ Khai Giảng', status: 'Nhận task', pic: 'Vinh', role: 'editor', progress: 30, deadline: '2026-05-17 17:00' }
  ];

  const page = document.querySelector('[data-chatbot-page]');
  if (page) {
    setupChrome();
    setupChatSurface({
      root: page,
      thread: page.querySelector('[data-chat-thread]'),
      form: page.querySelector('[data-chat-form]'),
      input: page.querySelector('[data-chat-input]'),
      prompts: page.querySelector('[data-chat-prompts]'),
      clear: page.querySelector('[data-chat-clear]'),
      mode: 'page'
    });
  } else if (user) {
    injectFloatingWidget();
  }

  function readUser() {
    try { return JSON.parse(localStorage.getItem('mh-user') || 'null'); } catch (e) { return null; }
  }
  function readJSON(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch (e) { return fallback; } }
  function writeJSON(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }
  function nowStamp() { return new Date().toISOString().slice(0, 16).replace('T', ' '); }
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

  function setupChrome() {
    if (!user) return;
    const pcName = document.getElementById('pc-name');
    const pcAvatar = document.getElementById('pc-avatar');
    const pcRole = document.getElementById('pc-role-badge');
    if (pcName) pcName.textContent = user.name || 'User';
    if (pcAvatar) pcAvatar.textContent = user.initials || (user.name || 'U').substring(0, 2).toUpperCase();
    if (pcRole) { pcRole.textContent = ROLE_LABEL[user.role] || user.role; pcRole.className = 'role-badge r--' + user.role; }
    const roleEl = document.getElementById('chat-role');
    if (roleEl) roleEl.textContent = ROLE_LABEL[user.role] || user.role;

    const chip = document.getElementById('profile-chip');
    if (chip) {
      chip.addEventListener('click', (e) => { if (e.target.closest('.profile-menu')) return; chip.classList.toggle('is-open'); });
      document.addEventListener('click', (e) => { if (!chip.contains(e.target)) chip.classList.remove('is-open'); });
    }
    const logout = document.getElementById('logout-btn');
    if (logout) logout.addEventListener('click', () => {
      localStorage.removeItem('mh-user');
      window.MH.toast({ type: 'info', title: 'Đã đăng xuất', message: 'Hẹn gặp lại!' });
      setTimeout(() => location.href = 'login.html', 500);
    });
    const sb = document.getElementById('dash-sb');
    const sbd = document.getElementById('sb-backdrop');
    const sbt = document.getElementById('sb-toggle');
    if (sbt && sb && sbd) sbt.addEventListener('click', () => { sb.classList.add('is-open'); sbd.classList.add('is-open'); });
    if (sbd && sb) sbd.addEventListener('click', () => { sb.classList.remove('is-open'); sbd.classList.remove('is-open'); });
  }

  function injectFloatingWidget() {
    if (document.querySelector('.chat-fab')) return;
    const wrap = document.createElement('div');
    wrap.className = 'chat-widget';
    wrap.innerHTML = `
      <button class="chat-fab" type="button" aria-label="Mở CB Assistant">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <span>CB Assistant</span>
      </button>
      <section class="chat-window chat-window--float" aria-hidden="true">
        <div class="chat-header">
          <div class="chat-bot-mark">CB</div>
          <div><h2>CB Assistant</h2><p>Order · brief · task · content</p></div>
          <div class="grow"></div>
          <a class="icon-btn" href="chatbot.html" aria-label="Mở trang Chatbot"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg></a>
          <button class="icon-btn" data-chat-close aria-label="Đóng"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <div class="chat-suggest-row" data-chat-prompts></div>
        <div class="chat-thread" data-chat-thread></div>
        <form class="chat-input-row" data-chat-form>
          <textarea class="textarea" data-chat-input rows="1" placeholder="Hỏi nhanh về order/task..."></textarea>
          <button class="icon-btn chat-send" type="submit" aria-label="Gửi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>
        </form>
      </section>`;
    document.body.appendChild(wrap);
    const win = wrap.querySelector('.chat-window');
    wrap.querySelector('.chat-fab').addEventListener('click', () => { win.classList.add('is-open'); win.setAttribute('aria-hidden', 'false'); });
    wrap.querySelector('[data-chat-close]').addEventListener('click', () => { win.classList.remove('is-open'); win.setAttribute('aria-hidden', 'true'); });
    setupChatSurface({
      root: wrap,
      thread: wrap.querySelector('[data-chat-thread]'),
      form: wrap.querySelector('[data-chat-form]'),
      input: wrap.querySelector('[data-chat-input]'),
      prompts: wrap.querySelector('[data-chat-prompts]'),
      mode: 'float'
    });
  }

  function setupChatSurface(surface) {
    renderPrompts(surface);
    renderHistory(surface);
    if (!readJSON(HISTORY_KEY, []).length) {
      pushMessage('bot', greeting(), 'process_help', []);
      renderHistory(surface);
    }
    surface.form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = surface.input.value.trim();
      if (!text) return;
      surface.input.value = '';
      pushMessage('user', text, '', []);
      renderHistory(surface);
      showTyping(surface);
      setTimeout(() => {
        const answer = respond(text);
        pushMessage('bot', answer.text, answer.intent, answer.actions);
        renderHistory(surface);
      }, 360);
    });
    surface.prompts.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-prompt]');
      if (!btn) return;
      surface.input.value = btn.dataset.prompt;
      surface.form.requestSubmit();
    });
    if (surface.clear) surface.clear.addEventListener('click', () => {
      localStorage.removeItem(HISTORY_KEY);
      pushMessage('bot', greeting(), 'process_help', []);
      renderHistory(surface);
    });
  }

  function rolePrompts() {
    const role = (user && user.role) || 'client';
    const map = {
      admin: ['Task nào đang trễ hạn?', 'Ai đang có workload cao?', 'Order nào chưa phân công?', 'Tóm tắt tình hình hôm nay'],
      account: ['Đơn nào đang chờ xác nhận brief?', 'Tóm tắt brief order này', 'Viết câu hỏi yêu cầu bổ sung brief', 'Đơn nào chờ bàn giao?'],
      design: ['Tôi có task nào mới?', 'Task nào sắp đến hạn?', 'Tóm tắt brief task này', 'Tạo visual prompt cho task này'],
      editor: ['Tôi có task nào mới?', 'Task nào sắp đến hạn?', 'Tóm tắt brief task này', 'Tạo concept video cho task này'],
      client: ['Tôi muốn gửi yêu cầu thiết kế mới', 'Kiểm tra trạng thái order của tôi', 'Tôi cần bổ sung brief gì?', 'Tôi muốn đánh giá sản phẩm đã nhận']
    };
    return map[role] || map.client;
  }

  function renderPrompts(surface) {
    surface.prompts.innerHTML = rolePrompts().map((p) => `<button class="chat-prompt" type="button" data-prompt="${esc(p)}">${esc(p)}</button>`).join('');
  }

  // Hide action items the current user can't actually use (e.g. Order Form for design/editor).
  function filterActions(actions) {
    if (!actions || !actions.length) return actions;
    const role = user && user.role;
    return actions.filter((a) => {
      if (a.url === 'request.html' && ['design', 'editor'].includes(role)) return false;
      return true;
    });
  }

  function renderHistory(surface) {
    const history = readJSON(HISTORY_KEY, []);
    surface.thread.innerHTML = history.map((msg) => {
      const visibleActions = filterActions(msg.actions);
      return `
      <article class="chat-msg chat-msg--${msg.role}">
        <div class="chat-avatar">${msg.role === 'bot' ? 'CB' : esc((user && user.initials) || 'U')}</div>
        <div class="chat-bubble">
          <div class="chat-text">${formatText(msg.content)}</div>
          ${visibleActions && visibleActions.length ? `<div class="chat-actions">${visibleActions.map((a) => `<a class="btn btn-sm btn-ghost" href="${esc(a.url)}">${esc(a.label)}</a>`).join('')}</div>` : ''}
          ${msg.role === 'bot' ? `<div class="chat-feedback"><button type="button" data-chat-feedback="good" data-mid="${esc(msg.id)}">Good</button><button type="button" data-chat-feedback="bad" data-mid="${esc(msg.id)}">Bad</button></div>` : ''}
        </div>
      </article>`;
    }).join('');
    surface.thread.querySelectorAll('[data-chat-feedback]').forEach((btn) => {
      btn.addEventListener('click', () => saveFeedback(btn.dataset.mid, btn.dataset.chatFeedback));
    });
    surface.thread.scrollTop = surface.thread.scrollHeight;
  }

  function showTyping(surface) {
    const el = document.createElement('article');
    el.className = 'chat-msg chat-msg--bot chat-msg--typing';
    el.innerHTML = '<div class="chat-avatar">CB</div><div class="chat-bubble"><div class="chat-typing"><span></span><span></span><span></span></div></div>';
    surface.thread.appendChild(el);
    surface.thread.scrollTop = surface.thread.scrollHeight;
  }

  function pushMessage(role, content, intent, actions) {
    const msg = { id: 'MSG-' + String(Date.now()).slice(-7), role, content, intent, actions: actions || [], created_at: nowStamp() };
    // localStorage fallback (giữ demo flow)
    const history = readJSON(HISTORY_KEY, []);
    history.push(msg);
    writeJSON(HISTORY_KEY, history.slice(-80));
    // Phase 1: persist sang Supabase nếu enabled
    if (window.MH && window.MH.store && window.MH.supabaseEnabled) {
      window.MH.store.chatbot.append({ role: role, content: content }, 'main').catch(function (e) { console.warn('[chatbot] persist message:', e); });
    }
  }

  function saveFeedback(messageId, feedback) {
    const list = readJSON(FEEDBACK_KEY, []);
    list.unshift({ feedback_id: 'FB-' + String(Date.now()).slice(-6), message_id: messageId, user_id: (user && user.email) || 'guest', feedback, created_at: nowStamp() });
    writeJSON(FEEDBACK_KEY, list.slice(0, 50));
    // Phase 1: persist sang Supabase nếu enabled
    if (window.MH && window.MH.store && window.MH.supabaseEnabled) {
      window.MH.store.chatbot.feedback(messageId, feedback).catch(function (e) { console.warn('[chatbot] persist feedback:', e); });
    }
    if (window.MH && window.MH.toast) window.MH.toast({ type: 'success', title: 'Đã ghi feedback', message: feedback === 'good' ? 'Cảm ơn anh.' : 'Đã ghi nhận để cải thiện.' });
  }

  function greeting() {
    return 'Chào anh, em là CB Assistant. Em có thể hướng dẫn quy trình, tra cứu order/task demo theo quyền, tóm tắt brief và tạo caption/prompt cơ bản.';
  }

  function respond(input) {
    const text = input.toLowerCase();
    const orderId = (input.match(/MEDIA-\d{4}-\d{4}/i) || [])[0];
    const taskId = (input.match(/TASK-\d{4}/i) || [])[0];
    if (orderId) return orderStatus(orderId.toUpperCase());
    if (taskId) return taskStatus(taskId.toUpperCase());
    if (/gửi|tao|tạo|order|yêu cầu thiết kế|brief mới/.test(text) && /order|yêu cầu|thiết kế|brief/.test(text)) return processHelp();
    if (/thiếu|bổ sung|missing|checklist/.test(text)) return missingBrief();
    if (/caption|ads|copy|hashtag|cta|prompt|visual|concept|slide/.test(text)) return creativeHelp(input);
    if (/trễ|workload|tình hình|báo cáo|report|chưa phân công|chờ xác nhận/.test(text)) return reportHelp();
    if (/deadline|sla|bao lâu|trạng thái|status|bàn giao|rating|đánh giá/.test(text)) return statusHelp();
    if (/mở|open|đi tới|đến trang/.test(text)) return navigationHelp(text);
    return fallback();
  }

  function canSeeOrder(order) {
    if (!user) return false;
    if (['admin', 'account'].includes(user.role)) return true;
    if (['design', 'editor'].includes(user.role)) return tasks.some((task) => task.order === order.id && canSeeTask(task));
    if (user.role === 'client') return order.owner === user.email;
    return false;
  }

  function canSeeTask(task) {
    if (!user) return false;
    if (['admin', 'account'].includes(user.role)) return true;
    if (user.role === 'design') return task.role === 'design';
    if (user.role === 'editor') return task.role === 'editor';
    return false;
  }

  function orderStatus(id) {
    const order = orders.find((item) => item.id === id);
    if (!order || !canSeeOrder(order)) return { intent: 'permission_denied', text: 'Em chưa tìm thấy order này hoặc anh không có quyền truy cập. Vui lòng kiểm tra lại mã hoặc liên hệ Account/Admin phụ trách.', actions: [] };
    if (user.role === 'client') {
      return { intent: 'order_status_query', text: `Yêu cầu ${order.id} hiện đang ở trạng thái: ${order.public_status}.\n\nTeam Media đã tiếp nhận brief và sẽ thông báo khi có preview/final public.`, actions: [{ label: 'Theo dõi đơn', url: 'tracking.html' }] };
    }
    return {
      intent: 'order_status_query',
      text: `Order ${order.id} hiện đang ở trạng thái: ${order.internal_status}.\n\nThông tin chính:\n- Project: ${order.project}\n- P.I.C: ${order.pic}\n- Progress: ${order.progress}%\n- Deadline nội bộ: ${order.deadline}\n- Delivery: ${order.delivery}\n\nHành động tiếp theo: P.I.C cần cập nhật preview trước deadline nếu task chưa qua review.`,
      actions: [{ label: 'Open Orders', url: 'database-orders.html' }, { label: 'Open Task', url: 'production-board.html' }]
    };
  }

  function taskStatus(id) {
    const task = tasks.find((item) => item.id === id);
    if (!task || !canSeeTask(task)) return { intent: 'permission_denied', text: 'Em chưa tìm thấy task này hoặc anh không có quyền xem task đó.', actions: [] };
    return {
      intent: 'task_status_query',
      text: `Task ${task.id} đang ở trạng thái: ${task.status}.\n\nThông tin chính:\n- Project: ${task.project}\n- Order: ${task.order}\n- P.I.C: ${task.pic}\n- Progress: ${task.progress}%\n- Deadline nội bộ: ${task.deadline}\n\nGợi ý: nếu đã có preview/final link, cập nhật trong Production Board để Account duyệt.`,
      actions: [{ label: 'Open Production Board', url: 'production-board.html' }]
    };
  }

  function processHelp() {
    return {
      intent: 'process_help',
      text: 'Để gửi yêu cầu media mới:\n\n1. Mở Order Form.\n2. Điền requester, mục tiêu, hạng mục, nội dung bắt buộc, asset và deadline.\n3. Kiểm tra preview brief trước khi submit.\n4. Account sẽ kiểm tra brief, yêu cầu bổ sung nếu thiếu, rồi push sang Production.\n\nLưu ý: brief càng rõ về kích thước, kênh đăng, CTA và asset nguồn thì team sản xuất càng ít phải hỏi lại.',
      actions: [{ label: 'Open Order Form', url: 'request.html' }]
    };
  }

  function missingBrief() {
    return {
      intent: 'missing_info_check',
      text: 'Brief thường cần kiểm tra các mục sau:\n\n1. Kích thước/tỉ lệ hoặc format bàn giao.\n2. CTA chính và thông điệp bắt buộc.\n3. Asset nguồn: logo, hình ảnh, nội dung text, guideline.\n4. Deadline mong muốn và deadline nội bộ.\n5. Kênh sử dụng: Facebook, Zalo, TikTok, in ấn, website.\n\nGợi ý tin nhắn: "Anh/chị vui lòng bổ sung kích thước, CTA chính và link asset nguồn để team Media triển khai đúng brief."',
      actions: [{ label: 'Open AI Brief Optimizer', url: 'ai-tools.html' }]
    };
  }

  function creativeHelp(input) {
    return {
      intent: 'content_generation',
      text: `Em có thể chuyển yêu cầu này sang AI Tools để tạo bản nháp theo brand CB.\n\nDraft nhanh:\n- Headline: Khơi mở hành trình học tập tự tin cùng CB Centres\n- Caption: Một chương trình rõ mục tiêu, hiện đại và gần gũi giúp học viên tự tin hơn trong từng hoạt động.\n- CTA: Inbox CB Centres để được tư vấn chi tiết.\n- Hashtag: #CBCentres #EnglishEducation #LearningJourney\n\nNhớ kiểm tra ưu đãi, ngày giờ, học phí và claim trước khi publish.`,
      actions: [{ label: 'Open AI Tools', url: 'ai-tools.html' }]
    };
  }

  function reportHelp() {
    if (!user || !['admin', 'account'].includes(user.role)) return { intent: 'permission_denied', text: 'Phần tổng quan workload/report chỉ mở cho Admin hoặc Account trong demo này.', actions: [] };
    return {
      intent: 'report_summary',
      text: 'Tóm tắt demo hôm nay:\n\n- 4 task có dấu hiệu trễ hạn.\n- 7 task đang chờ duyệt nội bộ.\n- 12 order mới/chờ xác nhận brief.\n- Workload cao nhất đang nằm ở nhóm Design.\n\nNên ưu tiên xử lý task trễ hạn và order thiếu thông tin trước.',
      actions: [{ label: 'Open Dashboard', url: 'dashboard.html' }, { label: 'Open Reports', url: 'reports.html' }]
    };
  }

  function statusHelp() {
    return {
      intent: 'process_help',
      text: 'Status chính trong flow:\n\n- Pending/Checking: Account đang kiểm tra brief.\n- Need Info: requester cần bổ sung thông tin.\n- Confirmed: brief đã đủ để sản xuất.\n- In Production: Design/Editor đang làm task.\n- Internal Review: chờ Account/Admin duyệt.\n- Ready/Preview/Final: sẵn sàng hoặc đã bàn giao qua Delivery Log.\n\nChatbot chỉ giải thích và điều hướng; các thao tác như đổi deadline, gửi final hoặc đóng order phải làm trong UI có quyền.',
      actions: [{ label: 'Open Production Board', url: 'production-board.html' }, { label: 'Open Delivery Log', url: 'delivery-log.html' }]
    };
  }

  function navigationHelp(text) {
    if (/report|báo cáo/.test(text)) return { intent: 'navigation_help', text: 'Em mở Reports để xem KPI, chart, overdue risk và feedback.', actions: [{ label: 'Open Reports', url: 'reports.html' }] };
    if (/production|task|board/.test(text)) return { intent: 'navigation_help', text: 'Em mở Production Board để xem task, Kanban và My Tasks.', actions: [{ label: 'Open Production Board', url: 'production-board.html' }] };
    if (/order|brief/.test(text)) return { intent: 'navigation_help', text: 'Em mở Order Form hoặc Database Orders tùy anh muốn tạo mới hay quản lý order.', actions: [{ label: 'Open Order Form', url: 'request.html' }, { label: 'Open Orders', url: 'database-orders.html' }] };
    return { intent: 'navigation_help', text: 'Anh muốn đi tới module nào? Em có thể mở Order Form, Production Board, Delivery Log, Reports hoặc AI Tools.', actions: [{ label: 'Open Dashboard', url: 'dashboard.html' }] };
  }

  function fallback() {
    return {
      intent: 'fallback',
      text: 'Em chưa chắc ý anh ở câu này. Anh có thể hỏi theo mẫu: "Đơn MEDIA-2026-0001 đến đâu rồi?", "Task TASK-0001 ai đang làm?", "Brief này thiếu gì?", hoặc "Viết caption cho chương trình IELTS".',
      actions: [{ label: 'Open Chatbot Page', url: 'chatbot.html' }]
    };
  }

  function formatText(text) {
    return esc(text).replace(/\n/g, '<br>');
  }
})();
