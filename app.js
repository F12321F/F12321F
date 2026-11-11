(function () {
  "use strict";

  const form = document.getElementById("repair-form");
  const fields = document.getElementById("form-fields");
  const submitButton = document.getElementById("submit-button");
  const refreshButton = document.getElementById("refresh-button");
  const formMessage = document.getElementById("form-message");
  const listMessage = document.getElementById("list-message");
  const list = document.getElementById("request-list");
  const emptyState = document.getElementById("empty-state");
  const count = document.getElementById("request-count");
  const template = document.getElementById("request-template");
  const categories = ["設備", "網路", "環境", "其他"];
  const priorities = ["低", "中", "高"];
  const dateFormatter = new Intl.DateTimeFormat("zh-TW", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false
  });
  let client;
  let submitting = false;
  let loadVersion = 0;

  function showMessage(element, message, kind) {
    element.textContent = message;
    element.dataset.kind = kind;
    element.hidden = !message;
  }

  function errorText(error) {
    return error && error.message ? error.message : "無法連線，請檢查網路後再試一次。";
  }

  function renderRequests(requests) {
    const fragment = document.createDocumentFragment();
    requests.forEach(function (request) {
      const item = template.content.cloneNode(true);
      ["category", "location", "description", "requester_name"].forEach(function (key) {
        // 資料庫內容只作為純文字顯示，避免執行使用者輸入的 HTML。
        item.querySelector('[data-field="' + key + '"]').textContent = request[key] || "—";
      });
      const priority = item.querySelector('[data-field="priority"]');
      priority.textContent = "緊急程度：" + (request.priority || "—");
      priority.dataset.level = priorities.includes(request.priority) ? request.priority : "";
      const time = item.querySelector("time");
      const date = request.created_at ? new Date(request.created_at) : new Date(NaN);
      if (Number.isNaN(date.getTime())) {
        time.textContent = "登記時間未提供";
      } else {
        time.dateTime = date.toISOString();
        time.textContent = dateFormatter.format(date);
      }
      fragment.appendChild(item);
    });
    list.replaceChildren(fragment);
    count.textContent = String(requests.length);
    emptyState.textContent = "目前還沒有報修紀錄。填寫上方表單，建立第一筆報修。";
    emptyState.hidden = requests.length > 0;
  }

  async function loadRequests() {
    const version = ++loadVersion;
    refreshButton.disabled = true;
    list.setAttribute("aria-busy", "true");
    emptyState.hidden = true;
    showMessage(listMessage, "正在載入報修紀錄…", "info");
    try {
      const result = await client.from("repair_requests")
        .select("id,requester_name,location,category,description,priority,created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (version !== loadVersion) return;
      if (result.error) throw result.error;
      renderRequests(result.data || []);
      showMessage(listMessage, "", "info");
    } catch (error) {
      if (version !== loadVersion) return;
      showMessage(listMessage, "清單載入失敗：" + errorText(error) + " 可按「重新整理」重試。", "error");
    } finally {
      if (version === loadVersion) {
        list.setAttribute("aria-busy", "false");
        refreshButton.disabled = submitting;
      }
    }
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!client || submitting || !form.reportValidity()) return;
    const data = new FormData(form);
    // 只送出表單欄位；status、created_at 交由資料庫預設值處理。
    const request = {
      requester_name: String(data.get("requester_name") || "").trim(),
      location: String(data.get("location") || "").trim(),
      category: String(data.get("category") || ""),
      description: String(data.get("description") || "").trim(),
      priority: String(data.get("priority") || "")
    };
    if (!request.requester_name || !request.location || !request.description ||
        !categories.includes(request.category) || !priorities.includes(request.priority)) {
      showMessage(formMessage, "請完整填寫所有欄位，內容不能只有空白。", "error");
      return;
    }

    submitting = true;
    fields.disabled = true;
    refreshButton.disabled = true;
    submitButton.textContent = "送出中…";
    showMessage(formMessage, "正在送出報修，請稍候…", "info");
    try {
      const result = await client.from("repair_requests").insert(request);
      if (result.error) throw result.error;
      form.reset();
      showMessage(formMessage, "報修已成功送出，謝謝你的回報。", "success");
      // 清單載入錯誤獨立顯示，不會把已成功新增的報修誤報為失敗。
      await loadRequests();
    } catch (error) {
      showMessage(formMessage, "報修送出失敗：" + errorText(error), "error");
    } finally {
      submitting = false;
      fields.disabled = false;
      submitButton.textContent = "送出報修 ↗";
      refreshButton.disabled = false;
    }
  });

  refreshButton.addEventListener("click", loadRequests);

  const config = window.SUPABASE_CONFIG;
  if (!config || !config.url || !config.publishableKey ||
      config.url === "YOUR_SUPABASE_URL" || config.publishableKey === "YOUR_SUPABASE_PUBLISHABLE_KEY") {
    showMessage(formMessage, "尚未設定連線。請在 config.js 填入 Supabase URL 與公開 Publishable Key，再重新開啟此頁。", "info");
    return;
  }
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    showMessage(formMessage, "Supabase 程式庫載入失敗。請確認網路連線後重新整理頁面。", "error");
    return;
  }
  try {
    client = window.supabase.createClient(config.url, config.publishableKey, {
      // file:// 不需要登入回呼或瀏覽器儲存空間。
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    submitButton.disabled = false;
    loadRequests();
  } catch (error) {
    showMessage(formMessage, "連線設定無效：" + errorText(error), "error");
  }
})();
