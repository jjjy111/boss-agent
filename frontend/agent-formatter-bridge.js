/* Local integration for the MIT-licensed gracexygu/resume-formatter. */
(() => {
  const tailoredId = new URLSearchParams(location.search).get("tailored");
  const tailoredMode = Boolean(tailoredId);
  const tailoredStateKey = tailoredMode ? `resume-formatter:tailored:${tailoredId}` : "";
  let versions = [], active = null, busy = false, lastDeleted = null;
  let changesConfirmed = false, resumeChanges = [], highlightFrame = 0;
  let exportedFingerprint = null;
  const $ = id => document.getElementById(id);
  const clone = value => JSON.parse(JSON.stringify(value));
  async function request(url, options = {}) {
    const response = await fetch(url, { ...options,
      headers: options.body instanceof FormData ? {} : { "Content-Type": "application/json" } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : `请求失败（${response.status}）`);
    return body;
  }
  async function run(action) {
    if (busy) return;
    busy = true; document.body.classList.add("agent-busy"); $("workspace").inert = true;
    try { await action(); }
    catch (error) { showToast(error.message || "操作失败，请重试", "error"); }
    finally { busy = false; document.body.classList.remove("agent-busy"); $("workspace").inert = false; }
  }
  function guarded(action) {
    if (busy) return;
    syncFocusedEditor();
    if (!isDirty()) return run(action);
    showDialog({ title: "当前简历尚未保存", message: "切换前是否保存当前版本的修改？", buttons: [
      { text: "取消" }, { text: "放弃修改", action: () => run(action) },
      { text: "保存后继续", primary: true, action: () => run(async () => { await save(); await action(); }) },
    ] });
  }
  function stateFor(document) {
    if (document.formatter_state) return clone(document.formatter_state);
    const content = (document.content || "").trim();
    if (content.startsWith("---")) {
      const parsed = validateAndBuildState(parseMarkdown(content), document.name + ".md");
      if (!parsed.state) throw new Error("Markdown 格式无法识别，原始内容未修改。");
      return parsed.state;
    }
    const data = window.agentPlainResume(content, document.name);
    const state = buildStateFromJson(data, document.name);
    state.profile.extraContact = data.profile.extraContact;
    return state;
  }
  function compactWithOffsets(value) {
    const source = String(value || "");
    let text = "";
    const offsets = [];
    const radicals = { "⻓": "长", "⿆": "角", "⻔": "门", "⻝": "食" };
    for (let index = 0; index < source.length; index += 1) {
      const normalized = source[index].normalize("NFKC").replace(/[⻓⿆⻔⻝]/g, character => radicals[character]);
      for (const character of normalized) {
        if (/\s/.test(character)) continue;
        text += character;
        offsets.push(index);
      }
    }
    return { text, offsets, sourceLength: source.length };
  }
  function readResumeChanges(document) {
    try {
      const analysis = typeof document.reason === "string" ? JSON.parse(document.reason) : document.reason;
      return (Array.isArray(analysis?.changes) ? analysis.changes : [])
        .map(change => ({
          original: compactWithOffsets(change?.original).text,
          revised: compactWithOffsets(change?.revised).text,
        }))
        .filter(change => change.original && change.revised);
    } catch (_) { return []; }
  }
  function insertedIntervals(original, revised) {
    const rows = original.length + 1, columns = revised.length + 1;
    const table = Array.from({ length: rows }, () => new Uint16Array(columns));
    for (let left = 0; left < rows; left += 1) table[left][0] = left;
    for (let right = 0; right < columns; right += 1) table[0][right] = right;
    for (let left = 1; left < rows; left += 1) {
      for (let right = 1; right < columns; right += 1) {
        table[left][right] = original[left - 1] === revised[right - 1]
          ? table[left - 1][right - 1]
          : Math.min(table[left - 1][right - 1], table[left - 1][right], table[left][right - 1]) + 1;
      }
    }
    const retained = new Uint8Array(revised.length);
    let left = original.length, right = revised.length;
    while (left > 0 || right > 0) {
      if (left > 0 && right > 0 && original[left - 1] === revised[right - 1]
          && table[left][right] === table[left - 1][right - 1]) {
        retained[right - 1] = 1; left -= 1; right -= 1;
      } else if (left > 0 && right > 0 && table[left][right] === table[left - 1][right - 1] + 1) {
        left -= 1; right -= 1;
      } else if (left > 0 && table[left][right] === table[left - 1][right] + 1) {
        left -= 1;
      } else {
        right -= 1;
      }
    }
    const intervals = [];
    for (let start = 0; start < retained.length;) {
      if (retained[start]) { start += 1; continue; }
      let end = start + 1;
      while (end < retained.length && !retained[end]) end += 1;
      intervals.push([start, end]); start = end;
    }
    return intervals;
  }
  function mappedChangeIntervals(candidate) {
    for (const change of resumeChanges) {
      const candidateInRevision = change.revised.indexOf(candidate);
      const revisionInCandidate = candidate.indexOf(change.revised);
      if (candidateInRevision < 0 && revisionInCandidate < 0) continue;
      const changed = insertedIntervals(change.original, change.revised);
      const intervals = [];
      for (const [start, end] of changed) {
        if (candidateInRevision >= 0) {
          const localStart = Math.max(start, candidateInRevision) - candidateInRevision;
          const localEnd = Math.min(end, candidateInRevision + candidate.length) - candidateInRevision;
          if (localEnd > localStart) intervals.push([localStart, localEnd]);
        } else {
          intervals.push([revisionInCandidate + start, revisionInCandidate + end]);
        }
      }
      return intervals;
    }
    return null;
  }
  function domPointAtOffset(element, offset) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node, consumed = 0, last = null;
    while ((node = walker.nextNode())) {
      last = node;
      if (offset <= consumed + node.data.length) return [node, Math.max(0, offset - consumed)];
      consumed += node.data.length;
    }
    return last ? [last, last.data.length] : null;
  }
  function rangeForOffsets(element, start, end) {
    const from = domPointAtOffset(element, start), to = domPointAtOffset(element, end);
    if (!from || !to || end <= start) return null;
    const range = new Range();
    range.setStart(from[0], from[1]); range.setEnd(to[0], to[1]);
    return range;
  }
  function clearChangeHighlights() {
    if (CSS.highlights) CSS.highlights.delete("agent-change-highlight");
    const content = $("resume-content");
    if (content) content.dataset.agentChangeCount = "0";
  }
  function applyChangeHighlights() {
    cancelAnimationFrame(highlightFrame);
    highlightFrame = requestAnimationFrame(() => {
      clearChangeHighlights();
      if (!tailoredMode || changesConfirmed || !resumeChanges.length || !window.Highlight || !CSS.highlights) return;
      const editables = [...document.querySelectorAll("#resume-content [contenteditable]")];
      const ranges = [];
      for (const element of editables) {
        const revised = compactWithOffsets(element.textContent);
        if (!revised.text) continue;
        const mapped = mappedChangeIntervals(revised.text);
        if (mapped === null) continue;
        const changed = mapped;
        if (!changed.length) continue;
        for (const [changeStart, changeEnd] of changed) {
          const rawStart = revised.offsets[changeStart];
          const rawEnd = changeEnd < revised.offsets.length
            ? revised.offsets[changeEnd]
            : revised.sourceLength;
          const range = rangeForOffsets(element, rawStart, rawEnd);
          if (range) ranges.push(range);
        }
      }
      if (ranges.length) CSS.highlights.set("agent-change-highlight", new Highlight(...ranges));
      const content = $("resume-content");
      if (content) content.dataset.agentChangeCount = String(ranges.length);
    });
  }
  function setChangesConfirmed(confirmed) {
    changesConfirmed = Boolean(confirmed);
    const confirm = $("agent-confirm-changes");
    if (confirm) {
      confirm.disabled = changesConfirmed;
      confirm.textContent = changesConfirmed ? "修改已定稿" : "确认修改并定稿";
    }
    applyChangeHighlights();
  }
  function lockTailoredSkeleton() {
    if (!tailoredMode) return;
    document.body.classList.add("agent-tailored-mode");
    const addSection = $("btn-add-section");
    if (addSection) addSection.hidden = true;
    document.querySelectorAll("#resume-content .section-title").forEach(title => {
      title.contentEditable = "false";
      title.setAttribute("aria-label", "固定栏目标题");
      title.title = "定制简历中一级标题及顺序固定";
    });
    document.querySelectorAll("#resume-content .section-reorder-handle, #resume-content .btn-del-section")
      .forEach(control => { control.hidden = true; control.disabled = true; });
  }
  function setBaseVersionPanel(open) {
    const isOpen = Boolean(open);
    document.body.classList.toggle("agent-version-panel-open", isOpen);
    const panel = $("resume-list-panel");
    const toggle = $("agent-version-toggle");
    if (panel) panel.setAttribute("aria-hidden", String(!isOpen));
    if (toggle) toggle.setAttribute("aria-expanded", String(isOpen));
  }
  function setupBaseLayout() {
    if (tailoredMode) return;
    document.body.classList.add("agent-base-mode");
    const toolbar = $("toolbar");
    const versionToggle = button("版本", () => {
      setBaseVersionPanel(!document.body.classList.contains("agent-version-panel-open"));
    });
    versionToggle.id = "agent-version-toggle";
    versionToggle.title = "打开或关闭通用简历版本面板";
    versionToggle.setAttribute("aria-expanded", "false");
    versionToggle.setAttribute("aria-controls", "resume-list-panel");
    toolbar.prepend(versionToggle);

    const closePanel = button("关闭", () => setBaseVersionPanel(false), "panel-icon-btn agent-version-panel-close");
    closePanel.type = "button";
    closePanel.setAttribute("aria-label", "关闭通用简历版本面板");
    $("resume-list-panel").querySelector(".panel-header").append(closePanel);

    const bottomActions = document.createElement("div");
    bottomActions.id = "agent-bottom-actions";
    bottomActions.setAttribute("aria-label", "通用简历操作");
    $("status-region").before(bottomActions);
    bottomActions.append($("btn-fix-overflow"), $("btn-save"), $("btn-export-pdf"));

    const privacyTitle = document.querySelector("#privacy-notice strong");
    const privacy = document.querySelector("#privacy-notice span");
    if (privacyTitle) privacyTitle.textContent = "通用简历 · 直接编辑";
    if (privacy) privacy.textContent = "点击顶部“版本”切换简历版本；在 A4 页面上直接修改，保存和导出按钮固定在底部。";

    document.addEventListener("click", event => {
      if (!document.body.classList.contains("agent-version-panel-open")) return;
      if (event.target.closest("#resume-list-panel, #agent-version-toggle")) return;
      setBaseVersionPanel(false);
    });
  }
  function display(document) {
    const state = stateFor(document); state.resumeName = document.name;
    setState(state); $("btn-theme-" + (state.layout?.theme || "a"))?.click();
    renderResume(state); applyLayoutState(state); lockTailoredSkeleton(); active = document; clearDirty();
    $("current-filename").textContent = document.name;
    $("draft-status").textContent = "已载入 · 点击正文编辑";
    renderVersions();
    requestAnimationFrame(() => { updateA4Status(); updateAddGutter(state); });
  }
  function boundResumeId() {
    return tailoredMode ? active?.source_resume_id : active?.id;
  }
  function blobDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("照片读取失败"));
      reader.readAsDataURL(blob);
    });
  }
  async function loadBoundPhoto(resumeId) {
    if (!resumeId) return false;
    const response = await fetch(`/api/resumes/${resumeId}/photo?v=${Date.now()}`);
    if (response.status === 404) return false;
    if (!response.ok) throw new Error(`照片加载失败（${response.status}）`);
    const state = getState();
    state.photo = {
      ...(state.photo || {}),
      source: "agent-resume-photo",
      dataUrl: await blobDataUrl(await response.blob()),
    };
    renderPhoto(state);
    updatePhotoControls();
    requestAnimationFrame(updateA4Status);
    return true;
  }
  async function select(id) {
    const document = await request(`/api/resume-documents/${id}`);
    display(document);
    await loadBoundPhoto(document.id);
  }
  async function loadTailored() {
    const document = await request(`/api/tailored/${tailoredId}`);
    resumeChanges = readResumeChanges(document);
    changesConfirmed = Boolean(document.changes_confirmed);
    document.name = `岗位定制简历 #${tailoredId}`;
    const cached = localStorage.getItem(tailoredStateKey);
    if (cached) {
      try { document.formatter_state = JSON.parse(cached); }
      catch (_) { localStorage.removeItem(tailoredStateKey); }
    }
    display(document);
    await loadBoundPhoto(document.source_resume_id);
    $("draft-status").textContent = changesConfirmed
      ? "修改已定稿 · 仍可继续编辑"
      : "浅黄色为 Agent 修改内容 · 确认前可编辑";
    setChangesConfirmed(changesConfirmed);
    if ($("agent-confirm-pdf")) $("agent-confirm-pdf").disabled = true;
  }
  function empty() {
    active = null; setState(createDefaultState()); renderResume(getState()); clearDirty();
    $("current-filename").textContent = "尚无简历版本"; $("draft-status").textContent = "请先上传或新建"; renderVersions();
  }
  async function refresh(preferred) {
    versions = await request("/api/resumes");
    const next = versions.find(v => v.id === preferred) || versions.find(v => v.is_current) || versions[0];
    if (next) await select(next.id); else empty();
  }
  function button(text, handler, className = "toolbar-btn") {
    const element = document.createElement("button"); element.type = "button";
    element.className = className; element.textContent = text; element.addEventListener("click", handler); return element;
  }
  function renderVersions() {
    const list = $("resume-list"); list.replaceChildren();
    if (tailoredMode) {
      const row = document.createElement("li"); row.className = "resume-list-item agent-version active";
      const name = document.createElement("span"); name.className = "resume-list-name";
      name.textContent = active?.name || `岗位定制简历 #${tailoredId}`;
      row.append(name); list.append(row); $("panel-empty").hidden = true;
      $("btn-save").disabled = !active; $("btn-export-pdf").disabled = !active;
      return;
    }
    for (const version of versions) {
      const row = document.createElement("li");
      row.className = "resume-list-item agent-version" + (active?.id === version.id ? " active" : ""); row.dataset.versionId = version.id;
      const name = button(version.name, () => { if (active?.id !== version.id) guarded(() => select(version.id)); }, "resume-list-name");
      name.title = `编辑 ${version.name}`;
      const remove = button("删除", () => confirmDelete(version), "agent-delete");
      remove.setAttribute("aria-label", `删除版本 ${version.name}`); row.append(name, remove); list.append(row);
    }
    $("panel-empty").hidden = versions.length > 0;
    $("panel-empty").textContent = "上传 PDF / Markdown / JSON，或新建一个简历版本。";
    $("agent-restore").hidden = !lastDeleted;
    $("btn-save").disabled = !active; $("agent-save-as").disabled = !active; $("btn-export-pdf").disabled = !active;
  }
  function payload(name) {
    syncFocusedEditor(); const state = clone(getState()); state.resumeName = name;
    state.layout.theme = getTheme(); state.metadata.updatedAt = new Date().toISOString();
    return { name, formatter_state: state, content: serializeStateToMarkdown(state) };
  }
  async function save() {
    if (!active) throw new Error("请先上传或选择简历版本。");
    if (tailoredMode) {
      const document = payload(active.name);
      const saved = await request(`/api/tailored/${tailoredId}`, {
        method: "PATCH", body: JSON.stringify({ content: document.content }) });
      active = { ...saved, name: document.name, formatter_state: document.formatter_state };
      localStorage.setItem(tailoredStateKey, JSON.stringify(document.formatter_state));
      clearDirty(); $("draft-status").textContent = "岗位草稿已覆盖保存";
      showToast("已覆盖保存当前岗位的定制简历草稿。", "success");
      return active;
    }
    active = await request(`/api/resume-documents/${active.id}`, {
      method: "PUT", body: JSON.stringify({ ...payload(active.name), expected_hash: active.content_hash }) });
    clearDirty(); $("draft-status").textContent = "已保存到本机";
    showToast("当前版本的内容、排版和照片已保存。", "success");
  }
  function documentFingerprint() {
    const state = clone(getState());
    return JSON.stringify({
      content: serializeStateToMarkdown(state),
      layout: state.layout,
      photo: state.photo,
    });
  }
  window.saveAgentResume = () => run(save);
  function askName(title, defaultValue, onSubmit) {
    showInputDialog({ title, message: "给这个通用简历版本起一个名字。", defaultValue, confirmText: "保存", onSubmit: value => {
      const name = value.trim();
      if (!name || name.length > 120) { showToast("版本名称需要 1–120 个字符。", "error"); return; }
      run(() => onSubmit(name));
    } });
  }
  function confirmDelete(version) {
    if (busy) return;
    showDialog({ title: "删除简历版本？", message: `将“${version.name}”从版本列表中移除。${active?.id === version.id && isDirty() ? "此版本尚未保存的修改会丢弃。" : ""}已生成或投递的岗位简历不会删除，可恢复最近一次删除。`, buttons: [
      { text: "取消" }, { text: "删除此版本", danger: true, action: () => run(async () => {
        await request(`/api/resume-documents/${version.id}`, { method: "DELETE" }); lastDeleted = version;
        if (active?.id !== version.id) { versions = await request("/api/resumes"); renderVersions(); }
        else { clearDirty(); await refresh(); }
        showToast("已从列表移除；可点击“恢复刚删除”撤销。", "success");
      }) },
    ] });
  }
  async function importFile(file, name) {
    if (file.size > 12 * 1024 * 1024) throw new Error("文件超过 12 MB，请压缩后上传。");
    let document;
    if (/\.pdf$/i.test(file.name)) {
      const form = new FormData(); form.append("file", file);
      document = await request(`/api/resumes?name=${encodeURIComponent(name)}`, { method: "POST", body: form });
      await refresh(document.id); await save();
      showToast("PDF 文字已按当前模板排版，请核对内容；扫描件暂不支持。", "success"); return;
    }
    const raw = await file.text();
    const imported = /\.json$/i.test(file.name) ? importJsonResume(raw, file.name) : validateAndBuildState(parseMarkdown(raw), file.name);
    if (!imported.state) throw new Error("文件格式不符合参考项目的 Markdown / JSON 简历格式。");
    imported.state.resumeName = name;
    document = await request("/api/resume-documents", { method: "POST", body: JSON.stringify({
      name, content: serializeStateToMarkdown(imported.state), formatter_state: imported.state }) });
    await refresh(document.id);
  }
  document.addEventListener("DOMContentLoaded", () => {
    $("import-menu")?.remove(); $("prompt-menu")?.remove(); $("btn-refresh-dir")?.remove();
    const photoInput = $("file-input-photo");
    photoInput?.addEventListener("change", event => {
      const file = event.target.files?.[0];
      const resumeId = boundResumeId();
      if (!file || !resumeId) return;
      run(async () => {
        const form = new FormData();
        form.append("file", file);
        const saved = await request(`/api/resumes/${resumeId}/photo`, { method: "POST", body: form });
        await loadBoundPhoto(resumeId);
        const suffix = saved.invalidated_tailored_resumes
          ? `；${saved.invalidated_tailored_resumes} 份未投递材料需要重新确认`
          : "";
        showToast(`证件照已绑定到当前通用简历版本${suffix}。`, "success");
      });
    }, true);
    document.addEventListener("click", event => {
      if (!event.target.closest("#btn-photo-delete, .photo-delete-btn")) return;
      const resumeId = boundResumeId();
      if (!resumeId) return;
      run(async () => {
        await request(`/api/resumes/${resumeId}/photo`, { method: "DELETE" });
        showToast("已从当前通用简历版本移除证件照。", "success");
      });
    }, true);
    $("panel-dir-name").textContent = tailoredMode ? "岗位定制简历" : "简历版本";
    $("toolbar").prepend(button("← 工作台", () => guarded(async () => { clearDirty(); location.href = "/"; })));
    const saveAs = button("另存为新版本", () => {
      if (!active || busy) return;
      askName("另存为新版本", active.name + "-副本", async name => {
        const document = await request("/api/resume-documents", {
          method: "POST",
          body: JSON.stringify({ ...payload(name), source_resume_id: active.id }),
        });
        await refresh(document.id); showToast("已另存为新版本，原版本保持不变。", "success");
      });
    });
    saveAs.id = "agent-save-as";
    const actions = document.createElement("div"); actions.className = "agent-version-actions";
    const fileInput = document.createElement("input");
    fileInput.type = "file"; fileInput.accept = ".pdf,.md,.markdown,.json"; fileInput.hidden = true; fileInput.id = "agent-import-file";
    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0]; fileInput.value = "";
      if (file) askName("上传新版本", file.name.replace(/\.[^.]+$/, ""), name => importFile(file, name));
    });
    const upload = button("上传简历", () => guarded(async () => fileInput.click())); upload.id = "agent-upload";
    const newVersion = button("新建", () => guarded(async () => {
      askName("新建简历版本", "", async name => {
        const state = createDefaultState(); state.resumeName = name;
        const document = await request("/api/resume-documents", { method: "POST", body: JSON.stringify({
          name, formatter_state: state, content: serializeStateToMarkdown(state) }) });
        await refresh(document.id);
      });
    }));
    const restore = button("恢复刚删除", () => guarded(async () => {
      const version = lastDeleted; if (!version) return;
      await request(`/api/resume-documents/${version.id}/restore`, { method: "POST" });
      lastDeleted = null; await refresh(version.id);
    }));
    restore.id = "agent-restore"; restore.hidden = true;
    actions.append(upload, newVersion, saveAs, restore, fileInput);
    actions.hidden = tailoredMode;
    $("resume-list-panel").querySelector(".panel-header").after(actions);
    if (tailoredMode) {
      const confirmChanges = button("确认修改并定稿", () => run(async () => {
        await save();
        active = await request(`/api/tailored/${tailoredId}/confirm-changes`, { method: "POST" });
        setChangesConfirmed(true);
        $("draft-status").textContent = "修改已定稿 · 仍可继续编辑";
        showToast("已确认修改，高亮已永久清除；仍可继续编辑和导出 PDF。", "success");
      }), "toolbar-btn toolbar-btn-primary");
      confirmChanges.id = "agent-confirm-changes";
      $("btn-save").after(confirmChanges);
      const confirm = button("确认 PDF 并返回工作台", () => {
        syncFocusedEditor();
        if (!exportedFingerprint || exportedFingerprint !== documentFingerprint() || isDirty()) {
          showToast("请先保存并重新导出当前内容的 PDF，再核对确认。", "warning");
          return;
        }
        showDialog({
          title: "确认最终 PDF",
          message: "请确认你已将打印目标选为“另存为 PDF”，保存文件并检查了内容和排版。若取消了打印，请先重新导出。",
          buttons: [
            { text: "继续检查" },
            { text: "已核对，确认 PDF", primary: true, action: () => run(async () => {
              if (exportedFingerprint !== documentFingerprint() || isDirty()) {
                throw new Error("简历已发生变化，请重新保存并导出 PDF。");
              }
              await request(`/api/tailored/${tailoredId}/mark-pdf-reviewed`, { method: "POST" });
              active = await request(`/api/tailored/${tailoredId}/confirm-pdf`, { method: "POST" });
              confirm.disabled = true;
              clearDirty();
              const target = new URL("/", window.location.origin);
              target.searchParams.set("confirmed_tailored", String(tailoredId));
              window.location.assign(target.toString());
            }) },
          ],
        });
      }, "toolbar-btn toolbar-btn-primary");
      confirm.disabled = true;
      confirm.id = "agent-confirm-pdf";
      $("btn-export-pdf").after(confirm);
      // Keep save, export and explicit PDF confirmation together below the A4 page.
      const bottomActions = document.createElement("div");
      bottomActions.id = "agent-bottom-actions";
      bottomActions.setAttribute("aria-label", "岗位定制简历操作");
      $("status-region").before(bottomActions);
      bottomActions.append($("btn-save"), confirmChanges, $("btn-export-pdf"), confirm);
      // Exporting opens the browser print dialog. Review is recorded only after
      // the user explicitly confirms the saved PDF.
      $("btn-export-pdf").addEventListener("click", event => {
        event.preventDefault(); event.stopImmediatePropagation();
        run(async () => {
          await save();
          clearChangeHighlights();
          handleExportPdf();
          if (!changesConfirmed) setTimeout(applyChangeHighlights, 0);
        });
      }, true);
      window.addEventListener("agent-pdf-export-started", () => {
        exportedFingerprint = documentFingerprint();
        confirm.disabled = false;
      });
      document.addEventListener("input", () => {
        if (exportedFingerprint && exportedFingerprint !== documentFingerprint()) {
          confirm.disabled = true;
        }
      });
      const privacyTitle = document.querySelector("#privacy-notice strong");
      const privacy = document.querySelector("#privacy-notice span");
      if (privacyTitle) privacyTitle.textContent = "岗位定制简历 · 直接编辑";
      if (privacy) privacy.textContent = "浅黄色仅标识 Agent 修改；确认定稿后永久清除。高亮不会进入 PDF，定稿后仍可继续编辑。";
      const resumeContent = $("resume-content");
      new MutationObserver(() => { lockTailoredSkeleton(); applyChangeHighlights(); })
        .observe(resumeContent, { childList: true, subtree: true });
      resumeContent.addEventListener("input", () => {
        if (!changesConfirmed) applyChangeHighlights();
      });
    } else {
      setupBaseLayout();
    }
    for (const theme of ["a", "b", "c", "d"]) $("btn-theme-" + theme).addEventListener("click", () => { getState().layout.theme = theme; markDirty(); });
    window.addEventListener("beforeunload", event => { if (isDirty() || busy) { event.preventDefault(); event.returnValue = ""; } });
    run(() => tailoredMode ? loadTailored() : refresh());
  });
})();
