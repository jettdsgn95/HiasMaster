/* =====================================================================
   CB Media Hub — Data Store abstraction (Phase 1)

   API design:
     window.MH.store.orders.list({...filters})
     window.MH.store.orders.get(orderId)
     window.MH.store.orders.update(orderId, patch)
     window.MH.store.orders.create(payload)
     window.MH.store.tasks.list({...filters})
     window.MH.store.tasks.byOrder(orderId)
     window.MH.store.tasks.upsert(task)
     window.MH.store.users.me() → current user public.users row
     window.MH.store.aiUsage.log(entry)
     window.MH.store.aiUsage.recent(limit)

   Cách hoạt động:
     - Nếu Supabase configured + sẵn sàng → query thật, trả Promise.
     - Nếu chưa → fallback localStorage / mock arrays (giữ demo flow hiện tại).
     - Mọi method trả Promise để code consumer (module migration) viết await
       1 lần, không cần branch theo backend.

   LƯU Ý: Turn này chỉ định nghĩa interface + stub. Các module
   (database-orders, production-board, ...) sẽ migrate dần ở turn sau.
   ===================================================================== */
(function () {
  'use strict';

  window.MH = window.MH || {};

  function readJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch (e) { return fallback; }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }
  async function sb() {
    if (!window.MH.supabaseEnabled) return null;
    await window.MH.supabaseReady;
    return window.MH.supabase || null;
  }
  function nowIso() { return new Date().toISOString(); }
  // PGRST204 = "Could not find the 'X' column of '<table>' in the schema cache"
  // (cột do migration thêm sau nhưng DB chưa chạy). Bóc tên cột để bỏ ra khỏi payload.
  function optionalMissingColumn(error, payload) {
    if (!error || !payload || error.code !== 'PGRST204') return null;
    const msg = [error.message, error.details, error.hint].filter(Boolean).join(' ');
    // Generic: lấy tên cột ngay trước chữ "column" trong message.
    const m = msg.match(/'([^']+)'\s+column/);
    if (m && Object.prototype.hasOwnProperty.call(payload, m[1])) return m[1];
    // Fallback allowlist các cột optional đã biết (phòng khi format message khác).
    const optional = ['shoot_location', 'feedback_status', 'revision_round', 'revision_limit', 'latest_feedback_note', 'last_feedback_at', 'last_feedback_by', 'approved_at', 'approved_by', 'parent_order_id', 'order_origin'];
    return optional.find((col) => Object.prototype.hasOwnProperty.call(payload, col) && msg.indexOf("'" + col + "'") >= 0) || null;
  }
  function stripMissingOptionalColumn(payload, error, label) {
    const col = optionalMissingColumn(error, payload);
    if (!col) return null;
    const next = Object.assign({}, payload);
    delete next[col];
    console.warn(label + ' bỏ cột thiếu `' + col + '` rồi thử lại (DB chưa migrate cột này — chạy migration tương ứng, vd add-revision-rounds.sql, để lưu được field).');
    return next;
  }

  /* ---------- USERS ---------- */
  const users = {
    async me() {
      const s = await sb();
      if (s) {
        const { data: auth } = await s.auth.getUser();
        if (!auth || !auth.user) return null;
        const { data, error } = await s.from('users').select('*').eq('id', auth.user.id).maybeSingle();
        if (error) console.warn('[store.users.me]', error);
        return data;
      }
      try { return JSON.parse(localStorage.getItem('mh-user') || 'null'); } catch (e) { return null; }
    },
    async list(filters) {
      const s = await sb();
      if (s) {
        let q = s.from('users').select('*').order('created_at', { ascending: false });
        if (filters && filters.role)   q = q.eq('role', filters.role);
        if (filters && filters.status) q = q.eq('status', filters.status);
        const { data, error } = await q;
        if (error) console.warn('[store.users.list]', error);
        return data || [];
      }
      // Fallback: trả mock từ user-management.js qua window.MH_MOCK_USERS nếu có
      return (window.MH_MOCK_USERS || []);
    }
  };

  /* ---------- ORDERS ---------- */
  const orders = {
    async list(filters) {
      const s = await sb();
      if (s) {
        let q = s.from('orders').select('*').order('created_at', { ascending: false });
        if (filters && filters.account_status)    q = q.eq('account_status', filters.account_status);
        if (filters && filters.production_status) q = q.eq('production_status', filters.production_status);
        if (filters && filters.priority)          q = q.eq('priority', filters.priority);
        if (filters && filters.department)        q = q.eq('department', filters.department);
        if (filters && filters.production_pic)    q = q.eq('production_pic', filters.production_pic);
        if (filters && filters.requester_id)      q = q.eq('requester_id', filters.requester_id);
        if (filters && filters.requester_email)   q = q.eq('requester_email', filters.requester_email);
        const { data, error } = await q;
        if (error) console.warn('[store.orders.list]', error);
        return data || [];
      }
      // Fallback: in-memory mock arrays from database-orders.js (chưa migrate)
      return (window.MH_MOCK_ORDERS || readJSON('mh-submitted-orders', []));
    },
    async get(orderId) {
      const s = await sb();
      if (s) {
        const { data, error } = await s.from('orders').select('*').eq('order_id', orderId).maybeSingle();
        if (error) console.warn('[store.orders.get]', error);
        return data;
      }
      const list = window.MH_MOCK_ORDERS || readJSON('mh-submitted-orders', []);
      return list.find((o) => o.order_id === orderId) || null;
    },
    async update(orderId, patch) {
      const s = await sb();
      if (s) {
        // Lặp: nếu lỗi do thiếu cột (DB chưa migrate) → bỏ cột đó rồi thử lại,
        // để các field cốt lõi (preview_link/final_delivery_link/...) vẫn được lưu.
        let p = patch;
        for (let i = 0; i < 12; i++) {
          const { data, error } = await s.from('orders').update(p).eq('order_id', orderId).select().maybeSingle();
          if (!error) return data;
          const reduced = stripMissingOptionalColumn(p, error, '[store.orders.update]');
          if (!reduced) { console.warn('[store.orders.update]', error); throw error; }
          p = reduced;
        }
        throw new Error('[store.orders.update] quá nhiều cột thiếu — kiểm tra migration DB.');
      }
      // Fallback: mutate in-memory mock; persist submitted-orders if matched
      const list = window.MH_MOCK_ORDERS;
      if (list) {
        const idx = list.findIndex((o) => o.order_id === orderId);
        if (idx >= 0) { list[idx] = Object.assign({}, list[idx], patch); return list[idx]; }
      }
      return null;
    },
    // Ghi field wording qua RPC update_brief_wording (SECURITY DEFINER, whitelist cột).
    // Đường ghi orders DUY NHẤT cho role content/client (không có UPDATE trực tiếp dưới RLS).
    async updateWording(orderId, patch) {
      const s = await sb();
      if (s) {
        const { data, error } = await s.rpc('update_brief_wording', { p_order_id: orderId, p_patch: patch || {} });
        if (error) { console.warn('[store.orders.updateWording]', error); throw error; }
        return data; // RPC RETURNS public.orders → row object
      }
      // Fallback mock (Supabase off): mutate in-memory như update().
      const list = window.MH_MOCK_ORDERS;
      if (list) {
        const idx = list.findIndex((o) => o.order_id === orderId);
        if (idx >= 0) { list[idx] = Object.assign({}, list[idx], patch); return list[idx]; }
      }
      return null;
    },
    async create(payload) {
      const s = await sb();
      if (s) {
        const { data, error } = await s.from('orders').insert(payload).select().maybeSingle();
        if (error) {
          const retryPayload = stripMissingOptionalColumn(payload, error, '[store.orders.create]');
          if (retryPayload) {
            const retry = await s.from('orders').insert(retryPayload).select().maybeSingle();
            if (retry.error) { console.warn('[store.orders.create]', retry.error); throw retry.error; }
            return retry.data;
          }
          console.warn('[store.orders.create]', error); throw error;
        }
        return data;
      }
      // Fallback: append vào localStorage 'mh-submitted-orders'
      const list = readJSON('mh-submitted-orders', []);
      list.unshift(payload);
      writeJSON('mh-submitted-orders', list.slice(0, 50));
      return payload;
    }
  };

  /* ---------- TASKS ---------- */
  const tasks = {
    async list(filters) {
      const s = await sb();
      if (s) {
        let q = s.from('tasks').select('*').order('created_at', { ascending: false });
        if (filters && filters.order_id)    q = q.eq('order_id', filters.order_id);
        if (filters && filters.status)      q = q.eq('status', filters.status);
        if (filters && filters.priority)    q = q.eq('priority', filters.priority);
        if (filters && filters.task_type)   q = q.eq('task_type', filters.task_type);
        if (filters && filters.assigned_to) q = q.eq('assigned_to', filters.assigned_to);
        if (filters && filters.is_standalone !== undefined) q = q.eq('is_standalone', !!filters.is_standalone);
        const { data, error } = await q;
        if (error) console.warn('[store.tasks.list]', error);
        return data || [];
      }
      return (window.MH_MOCK_TASKS || readJSON('mh-extra-tasks', []));
    },
    async byOrder(orderId) {
      return tasks.list({ order_id: orderId });
    },
    async get(taskId) {
      const s = await sb();
      if (s) {
        const { data, error } = await s.from('tasks').select('*').eq('task_id', taskId).maybeSingle();
        if (error) console.warn('[store.tasks.get]', error);
        return data;
      }
      const list = window.MH_MOCK_TASKS || readJSON('mh-extra-tasks', []);
      return list.find((t) => t.task_id === taskId) || null;
    },
    async upsert(task) {
      const s = await sb();
      if (s) {
        const { data, error } = await s.from('tasks').upsert(task, { onConflict: 'task_id' }).select().maybeSingle();
        if (error) {
          const retryTask = stripMissingOptionalColumn(task, error, '[store.tasks.upsert]');
          if (retryTask) {
            const retry = await s.from('tasks').upsert(retryTask, { onConflict: 'task_id' }).select().maybeSingle();
            if (retry.error) { console.warn('[store.tasks.upsert]', retry.error); throw retry.error; }
            return retry.data;
          }
          console.warn('[store.tasks.upsert]', error); throw error;
        }
        return data;
      }
      // Fallback: persist sang 'mh-extra-tasks'
      const extras = readJSON('mh-extra-tasks', []);
      const idx = extras.findIndex((t) => t.task_id === task.task_id);
      if (idx >= 0) extras[idx] = task; else extras.push(task);
      writeJSON('mh-extra-tasks', extras.slice(-100));
      return task;
    },
    // PATCH 1 task đã tồn tại. PHẢI dùng UPDATE (không upsert partial) — bảng tasks có
    // project_name/task_type NOT NULL nên upsert thiếu cột → INSERT-candidate vi phạm NOT NULL
    // trước cả ON CONFLICT → update âm thầm fail. update().eq() tránh được lỗi này.
    async update(taskId, patch) {
      const s = await sb();
      if (s) {
        const { data, error } = await s.from('tasks').update(patch).eq('task_id', taskId).select().maybeSingle();
        if (error) {
          const retryPatch = stripMissingOptionalColumn(patch, error, '[store.tasks.update]');
          if (retryPatch) {
            const retry = await s.from('tasks').update(retryPatch).eq('task_id', taskId).select().maybeSingle();
            if (retry.error) { console.warn('[store.tasks.update]', retry.error); throw retry.error; }
            return retry.data;
          }
          console.warn('[store.tasks.update]', error); throw error;
        }
        return data;
      }
      // Fallback: patch sang 'mh-extra-tasks'
      const extras = readJSON('mh-extra-tasks', []);
      const idx = extras.findIndex((t) => t.task_id === taskId);
      if (idx >= 0) { extras[idx] = Object.assign({}, extras[idx], patch); writeJSON('mh-extra-tasks', extras); }
      return patch;
    },
    async delete(taskId) {
      const s = await sb();
      if (s) {
        const { error } = await s.from('tasks').delete().eq('task_id', taskId);
        if (error) { console.warn('[store.tasks.delete]', error); throw error; }
        return true;
      }
      const extras = readJSON('mh-extra-tasks', []).filter((t) => t.task_id !== taskId);
      writeJSON('mh-extra-tasks', extras);
      return true;
    }
  };

  /* ---------- TASK COMMENTS ---------- */
  const taskComments = {
    async byTask(taskId) {
      const s = await sb();
      if (s) {
        const { data, error } = await s.from('task_comments').select('*').eq('task_id', taskId).order('created_at', { ascending: true });
        if (error) console.warn('[store.taskComments.byTask]', error);
        return data || [];
      }
      const t = (window.MH_MOCK_TASKS || []).find((x) => x.task_id === taskId);
      return (t && t.comments) || [];
    },
    async add(taskId, comment) {
      const s = await sb();
      if (s) {
        const row = Object.assign({ task_id: taskId, created_at: nowIso() }, comment);
        const { data, error } = await s.from('task_comments').insert(row).select().maybeSingle();
        if (error) { console.warn('[store.taskComments.add]', error); throw error; }
        return data;
      }
      const t = (window.MH_MOCK_TASKS || []).find((x) => x.task_id === taskId);
      if (t) { t.comments = t.comments || []; t.comments.push(comment); }
      return comment;
    }
  };

  /* ---------- DELIVERIES ---------- */
  const deliveries = {
    async list(filters) {
      const s = await sb();
      if (s) {
        let q = s.from('deliveries').select('*').order('created_at', { ascending: false });
        if (filters && filters.order_id)        q = q.eq('order_id', filters.order_id);
        if (filters && filters.delivery_status) q = q.eq('delivery_status', filters.delivery_status);
        const { data, error } = await q;
        if (error) console.warn('[store.deliveries.list]', error);
        return data || [];
      }
      return (window.MH_MOCK_DELIVERIES || []);
    },
    async upsert(delivery) {
      const s = await sb();
      if (s) {
        const { data, error } = await s.from('deliveries').upsert(delivery, { onConflict: 'delivery_id' }).select().maybeSingle();
        if (error) { console.warn('[store.deliveries.upsert]', error); throw error; }
        return data;
      }
      const list = window.MH_MOCK_DELIVERIES;
      if (list) {
        const idx = list.findIndex((d) => d.delivery_id === delivery.delivery_id);
        if (idx >= 0) list[idx] = Object.assign({}, list[idx], delivery);
        else list.unshift(delivery);
      }
      return delivery;
    }
  };

  /* ---------- AI USAGE ---------- */
  const aiUsage = {
    async log(entry) {
      const s = await sb();
      if (s) {
        const me = await users.me();
        const row = Object.assign({}, entry, { user_id: me ? me.id : null, created_at: nowIso() });
        const { data, error } = await s.from('ai_usage_log').insert(row).select().maybeSingle();
        if (error) console.warn('[store.aiUsage.log]', error);
        return data;
      }
      const list = readJSON('mh-ai-usage-log', []);
      list.unshift(entry);
      writeJSON('mh-ai-usage-log', list.slice(0, 50));
      return entry;
    },
    async recent(limit) {
      const s = await sb();
      if (s) {
        const { data, error } = await s.from('ai_usage_log').select('*').order('created_at', { ascending: false }).limit(limit || 50);
        if (error) console.warn('[store.aiUsage.recent]', error);
        return data || [];
      }
      return readJSON('mh-ai-usage-log', []).slice(0, limit || 50);
    },
    async saveOutput(entry) {
      const s = await sb();
      if (s) {
        const me = await users.me();
        const row = Object.assign({}, entry, { created_by: me ? me.id : null, created_at: nowIso() });
        const { data, error } = await s.from('ai_saved_outputs').insert(row).select().maybeSingle();
        if (error) console.warn('[store.aiUsage.saveOutput]', error);
        return data;
      }
      const list = readJSON('mh-ai-saved-outputs', []);
      list.unshift(entry);
      writeJSON('mh-ai-saved-outputs', list.slice(0, 50));
      return entry;
    }
  };

  /* ---------- FILES (Phase 2 — Supabase Storage) ----------
     Bucket conventions:
       avatars      — public, path `{user_id}/avatar.{ext}`
       brief-files  — private, path `{order_id}/brief-{ts}.{ext}`
       deliverables — private, path `{order_id}/{task_id}/{preview|final}-{ts}.{ext}`
     Fallback (chưa cấu hình Supabase): trả data URL inline cho avatar,
     toast warning cho các bucket private (không thể fake offline). */
  const files = {
    /**
     * Upload file/blob lên Supabase Storage.
     * @param {string} bucket  - 'avatars' | 'brief-files' | 'deliverables'
     * @param {string} path    - relative path within bucket
     * @param {File|Blob} file - blob or File object
     * @param {object} options - { upsert?: boolean, contentType?: string }
     * @returns {{ path: string, publicUrl?: string }}
     */
    async upload(bucket, path, file, options) {
      const s = await sb();
      if (!s) {
        if (bucket === 'avatars') {
          // Fallback: encode to data URL (giữ demo flow)
          const dataUrl = await new Promise(function (resolve, reject) {
            const r = new FileReader();
            r.onload = function () { resolve(r.result); };
            r.onerror = reject;
            r.readAsDataURL(file);
          });
          return { path: path, publicUrl: dataUrl };
        }
        throw new Error('Supabase Storage chưa cấu hình — file private không thể upload offline.');
      }
      const opts = Object.assign({ upsert: true, cacheControl: '3600' }, options || {});
      const { data, error } = await s.storage.from(bucket).upload(path, file, opts);
      if (error) { console.warn('[store.files.upload]', error); throw error; }
      let publicUrl;
      const { data: pub } = s.storage.from(bucket).getPublicUrl(data.path);
      publicUrl = pub ? pub.publicUrl : null;
      return { path: data.path, publicUrl: publicUrl };
    },
    /** Public URL (chỉ bucket public — avatars). */
    async getPublicUrl(bucket, path) {
      const s = await sb();
      if (!s) return null;
      const { data } = s.storage.from(bucket).getPublicUrl(path);
      return data ? data.publicUrl : null;
    },
    /** Signed URL (bucket private — brief-files, deliverables). */
    async signedUrl(bucket, path, expiresIn) {
      const s = await sb();
      if (!s) return null;
      const { data, error } = await s.storage.from(bucket).createSignedUrl(path, expiresIn || 3600);
      if (error) { console.warn('[store.files.signedUrl]', error); return null; }
      return data ? data.signedUrl : null;
    },
    /** List files trong folder (prefix). */
    async list(bucket, prefix, options) {
      const s = await sb();
      if (!s) return [];
      const { data, error } = await s.storage.from(bucket).list(prefix || '', options || { limit: 100, offset: 0, sortBy: { column: 'created_at', order: 'desc' } });
      if (error) { console.warn('[store.files.list]', error); return []; }
      return data || [];
    },
    async remove(bucket, paths) {
      const s = await sb();
      if (!s) return false;
      const arr = Array.isArray(paths) ? paths : [paths];
      const { error } = await s.storage.from(bucket).remove(arr);
      if (error) { console.warn('[store.files.remove]', error); return false; }
      return true;
    }
  };

  /* ---------- CHATBOT ---------- */
  const chatbot = {
    async append(message, sessionId) {
      const s = await sb();
      if (s) {
        const me = await users.me();
        const row = Object.assign({
          user_id: me ? me.id : null,
          session_id: sessionId || null,
          created_at: nowIso()
        }, message);
        const { data, error } = await s.from('chatbot_messages').insert(row).select().maybeSingle();
        if (error) console.warn('[store.chatbot.append]', error);
        return data;
      }
      const list = readJSON('mh-chatbot-history', []);
      list.push(Object.assign({ created_at: nowIso(), session_id: sessionId || null }, message));
      writeJSON('mh-chatbot-history', list.slice(-80));
      return message;
    },
    async history(sessionId, limit) {
      const s = await sb();
      if (s) {
        const me = await users.me();
        if (!me) return [];
        let q = s.from('chatbot_messages').select('*').eq('user_id', me.id).order('created_at', { ascending: true }).limit(limit || 80);
        if (sessionId) q = q.eq('session_id', sessionId);
        const { data, error } = await q;
        if (error) console.warn('[store.chatbot.history]', error);
        return data || [];
      }
      const list = readJSON('mh-chatbot-history', []);
      return sessionId ? list.filter(function (m) { return m.session_id === sessionId; }) : list;
    },
    async feedback(messageId, feedback) {
      const s = await sb();
      if (s) {
        const { error } = await s.from('chatbot_messages').update({ feedback: feedback }).eq('id', messageId);
        if (error) console.warn('[store.chatbot.feedback]', error);
        return;
      }
      const list = readJSON('mh-chatbot-feedback', []);
      list.unshift({ message_id: messageId, feedback: feedback, created_at: nowIso() });
      writeJSON('mh-chatbot-feedback', list.slice(0, 50));
    }
  };

  /* ---------- NOTIFICATIONS (Phase 1.5) ---------- */
  const notifications = {
    async listUnread(limit) {
      const s = await sb();
      if (!s) return [];
      const me = await users.me();
      if (!me) return [];
      const { data, error } = await s.from('notifications')
        .select('*')
        .eq('user_id', me.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(limit || 20);
      if (error) console.warn('[store.notifications.listUnread]', error);
      return data || [];
    },
    async listAll(limit) {
      const s = await sb();
      if (!s) return [];
      const me = await users.me();
      if (!me) return [];
      const { data, error } = await s.from('notifications')
        .select('*')
        .eq('user_id', me.id)
        .order('created_at', { ascending: false })
        .limit(limit || 30);
      if (error) console.warn('[store.notifications.listAll]', error);
      return data || [];
    },
    async create(payload) {
      const s = await sb();
      if (!s) return null;
      const { data, error } = await s.from('notifications').insert(payload).select().maybeSingle();
      if (error) console.warn('[store.notifications.create]', error);
      return data;
    },
    async markRead(id) {
      const s = await sb();
      if (!s) return;
      const { error } = await s.from('notifications').update({ is_read: true }).eq('id', id);
      if (error) console.warn('[store.notifications.markRead]', error);
    },
    async markAllRead() {
      const s = await sb();
      if (!s) return;
      const me = await users.me();
      if (!me) return;
      const { error } = await s.from('notifications').update({ is_read: true }).eq('user_id', me.id).eq('is_read', false);
      if (error) console.warn('[store.notifications.markAllRead]', error);
    },
    // Helper: lookup user_id qua name (production_pic là text 'Linh Chi', cần convert sang uuid)
    async findUserIdByName(name) {
      const s = await sb();
      if (!s || !name) return null;
      // 1) Exact match.
      const exact = await s.from('users').select('id').eq('name', name).maybeSingle();
      if (exact.data) return exact.data.id;
      // 2) PIC thường lưu tên ngắn ("Duy") còn users.name là tên đầy đủ ("Duy Trần").
      //    Khớp theo ranh giới từ: đầu chuỗi ("Duy %"), cuối chuỗi ("% Duy"), rồi chứa.
      const esc = name.replace(/[%_]/g, '\\$&');
      const patterns = [esc + ' %', '% ' + esc, '%' + esc + '%'];
      for (let i = 0; i < patterns.length; i++) {
        const r = await s.from('users').select('id').ilike('name', patterns[i]).limit(1);
        if (r.data && r.data.length) return r.data[0].id;
      }
      console.warn('[store.notifications.findUserIdByName] không khớp:', name);
      return null;
    }
  };

  /* ---------- AUTH ---------- */
  const auth = {
    async signIn(email, password) {
      const s = await sb();
      if (s) {
        const { data, error } = await s.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
      }
      // Fallback: existing demo accounts. Returned object mimics Supabase shape.
      throw new Error('Supabase chưa cấu hình — demo flow vẫn dùng login.html localStorage logic.');
    },
    async signOut() {
      const s = await sb();
      if (s) { await s.auth.signOut(); return; }
      localStorage.removeItem('mh-user');
    },
    async session() {
      const s = await sb();
      if (s) {
        const { data } = await s.auth.getSession();
        return data ? data.session : null;
      }
      return null;
    }
  };

  /* ---------- Activity Log ---------- */
  const activity = {
    async log(entry) {
      const s = await sb();
      if (s) {
        const me = await users.me();
        const row = Object.assign({}, entry, {
          actor_user_id: me ? me.id : null,
          actor_name: me ? me.name : null,
          created_at: nowIso()
        });
        const { error } = await s.from('activity_log').insert(row);
        if (error) console.warn('[store.activity.log]', error);
        return;
      }
      // Fallback: ghi vào localStorage activity stack (capped 100)
      const list = readJSON('mh-activity-log', []);
      list.unshift(Object.assign({ created_at: nowIso() }, entry));
      writeJSON('mh-activity-log', list.slice(0, 100));
    }
  };

  /* ---------- LEAD TASKS (Supervisor Planning) ----------
     Kế hoạch nội bộ Supervisor giao cho Lead Media / Lead Content. TÁCH BIỆT
     bảng `tasks` (production). RLS lọc theo role ở server; mock lọc ở consumer.
     ⚠ cần supabase/add-supervisor-planning.sql (bảng lead_tasks + role lead_media). */
  // localStorage là nguồn CHUNG cross-tab/cross-login (mock). Ưu tiên đọc localStorage nếu có
  // (đồng bộ lại in-memory) — tránh tab này giữ mảng cũ không thấy thay đổi tab kia.
  function readLeadTasks() {
    var ls = readJSON('mh-lead-tasks', null);
    if (ls && ls.length) { window.MH_MOCK_LEAD_TASKS = ls; return ls; }
    return window.MH_MOCK_LEAD_TASKS || [];
  }
  function writeLeadTasks(list) { window.MH_MOCK_LEAD_TASKS = list; writeJSON('mh-lead-tasks', list.slice(0, 200)); }
  const leadTasks = {
    async list(filters) {
      const s = await sb();
      if (s) {
        let q = s.from('lead_tasks').select('*').order('created_at', { ascending: false });
        if (filters && filters.assigned_lead) q = q.eq('assigned_lead', filters.assigned_lead);
        if (filters && filters.status)        q = q.eq('status', filters.status);
        const { data, error } = await q;
        if (error) console.warn('[store.leadTasks.list]', error);
        return data || [];
      }
      return readLeadTasks();
    },
    async get(id) {
      const s = await sb();
      if (s) {
        const { data, error } = await s.from('lead_tasks').select('*').eq('id', id).maybeSingle();
        if (error) console.warn('[store.leadTasks.get]', error);
        return data;
      }
      return readLeadTasks().find((p) => p.id === id) || null;
    },
    // Tạo mới (không id → INSERT, DB tự gen uuid) hoặc cập nhật full row (có id → UPSERT).
    async upsert(plan) {
      const s = await sb();
      if (s) {
        const hasId = !!(plan && plan.id);
        const q = hasId
          ? s.from('lead_tasks').upsert(plan, { onConflict: 'id' })
          : s.from('lead_tasks').insert(plan);
        const { data, error } = await q.select().maybeSingle();
        if (error) { console.warn('[store.leadTasks.upsert]', error); throw error; }
        return data;
      }
      const list = readLeadTasks();
      const row = Object.assign({}, plan);
      if (!row.id) row.id = 'plan-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      if (!row.created_at) row.created_at = nowIso();
      row.updated_at = nowIso();
      const idx = list.findIndex((p) => p.id === row.id);
      if (idx >= 0) list[idx] = Object.assign({}, list[idx], row); else list.unshift(row);
      writeLeadTasks(list);
      return idx >= 0 ? list[idx] : row;
    },
    // PATCH 1 kế hoạch (UPDATE .eq). DB trigger tự set updated_at; mock set tay.
    async update(id, patch) {
      const s = await sb();
      if (s) {
        const { data, error } = await s.from('lead_tasks').update(patch).eq('id', id).select().maybeSingle();
        if (error) { console.warn('[store.leadTasks.update]', error); throw error; }
        return data;
      }
      const list = readLeadTasks();
      const idx = list.findIndex((p) => p.id === id);
      if (idx >= 0) { list[idx] = Object.assign({}, list[idx], patch, { updated_at: nowIso() }); writeLeadTasks(list); return list[idx]; }
      return null;
    },
    async delete(id) {
      const s = await sb();
      if (s) {
        const { error } = await s.from('lead_tasks').delete().eq('id', id);
        if (error) { console.warn('[store.leadTasks.delete]', error); throw error; }
        return true;
      }
      writeLeadTasks(readLeadTasks().filter((p) => p.id !== id));
      return true;
    }
  };

  /* ---------- LEAD TASK COMMENTS (Supervisor Planning — thread + activity) ----------
     kind: 'comment' (trao đổi 2 chiều) | 'status' (đổi trạng thái) | 'system'.
     Fallback localStorage `mh-lead-task-comments` (1 mảng phẳng, lọc theo lead_task_id). */
  const leadTaskComments = {
    async byPlan(planId) {
      const s = await sb();
      if (s) {
        const { data, error } = await s.from('lead_task_comments').select('*').eq('lead_task_id', planId).order('created_at', { ascending: true });
        if (error) console.warn('[store.leadTaskComments.byPlan]', error);
        return data || [];
      }
      return readJSON('mh-lead-task-comments', []).filter(function (c) { return c.lead_task_id === planId; });
    },
    async add(planId, comment) {
      const s = await sb();
      const row = Object.assign({ lead_task_id: planId, created_at: nowIso() }, comment);
      if (s) {
        const me = await users.me();
        if (me && !row.author_id) row.author_id = me.id;
        const { data, error } = await s.from('lead_task_comments').insert(row).select().maybeSingle();
        if (error) { console.warn('[store.leadTaskComments.add]', error); throw error; }
        return data;
      }
      if (!row.id) row.id = 'ltc-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const list = readJSON('mh-lead-task-comments', []);
      list.push(row);
      writeJSON('mh-lead-task-comments', list.slice(-500));
      return row;
    }
  };

  /* ---------- Expose ---------- */
  window.MH.store = {
    users, orders, tasks, taskComments, deliveries, aiUsage, chatbot, files, notifications, auth, activity, leadTasks, leadTaskComments,
    isRemote: function () { return !!window.MH.supabaseEnabled; }
  };
})();
