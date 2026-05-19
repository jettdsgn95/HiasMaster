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
        const { data, error } = await s.from('orders').update(patch).eq('order_id', orderId).select().maybeSingle();
        if (error) { console.warn('[store.orders.update]', error); throw error; }
        return data;
      }
      // Fallback: mutate in-memory mock; persist submitted-orders if matched
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
        if (error) { console.warn('[store.orders.create]', error); throw error; }
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
        if (error) { console.warn('[store.tasks.upsert]', error); throw error; }
        return data;
      }
      // Fallback: persist sang 'mh-extra-tasks'
      const extras = readJSON('mh-extra-tasks', []);
      const idx = extras.findIndex((t) => t.task_id === task.task_id);
      if (idx >= 0) extras[idx] = task; else extras.push(task);
      writeJSON('mh-extra-tasks', extras.slice(-100));
      return task;
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

  /* ---------- Expose ---------- */
  window.MH.store = {
    users, orders, tasks, taskComments, deliveries, aiUsage, chatbot, files, auth, activity,
    isRemote: function () { return !!window.MH.supabaseEnabled; }
  };
})();
