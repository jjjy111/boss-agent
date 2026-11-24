/* Conservative PDF-text adapter. Unknown text is retained, never synthesized. */
(() => {
  function parse(content, name) {
    const radicals = { "⻓": "长", "⻆": "角", "⻔": "门", "⻝": "食" };
    const lines = content.normalize("NFKC").replace(/[⻓⻆⻔⻝]/g, c => radicals[c]).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const headings = { 教育背景: "education", 教育经历: "education", 实习经历: "experience", 工作经历: "experience", 项目经历: "projects", 技能特长: "skills", 技能: "skills" };
    const data = { schemaVersion: 2, resumeName: name, profile: { name: lines.shift() || "", headline: "", phone: "", email: "", extraContact: "" }, sections: [] };
    if (lines[0] && /@|1\d{10}/.test(lines[0])) {
      const contact = lines.shift();
      data.profile.phone = (contact.match(/1\d{10}/) || [""])[0];
      data.profile.email = (contact.match(/[\w.+-]+@[\w.-]+/) || [""])[0];
      data.profile.extraContact = contact.replace(data.profile.phone, "").replace(data.profile.email, "").replace(/^[\s|]+|[\s|]+$/g, "").trim();
    }
    let section, entry, buffer = "";
    const flush = () => {
      if (!buffer) return;
      if (!section) { section = { type: "custom", title: "其他信息", blocks: [] }; data.sections.push(section); }
      if (section.type === "custom") section.blocks.push({ type: "text", content: buffer });
      else {
        if (!entry) { entry = { name: "", role: "", date: "", bullets: [] }; section.entries.push(entry); }
        entry.bullets.push(buffer);
      }
      buffer = "";
    };
    for (const line of lines) {
      if (headings[line] || /^(自我评价|个人总结|获奖经历|证书|校园经历|个人优势)$/.test(line)) {
        flush(); section = { type: headings[line] || "custom", title: line, entries: [], blocks: [] };
        data.sections.push(section); entry = null; continue;
      }
      const dated = line.match(/^(.*?)\s+((?:19|20)\d{2}[.\/-]\d{1,2}\s*[–—~至-]\s*(?:(?:19|20)\d{2}[.\/-]\d{1,2}|至今|现在))$/);
      if (dated && section && ["education", "experience", "projects"].includes(section.type)) {
        flush(); const parts = dated[1].split(/\s+/);
        const role = section.type === "education" ? parts.slice(1).join(" ") : parts.length > 1 ? parts.pop() : "";
        entry = { name: section.type === "education" ? parts[0] : parts.join(" "), role, date: dated[2], bullets: [] };
        section.entries.push(entry); continue;
      }
      // pypdf puts the source arrow at paragraph END, sometimes on its own line.
      if (/^[•▪►-]\s+/.test(line)) flush();
      const text = line.replace(/^[•▪►-]\s+/, "").replace(/[➤•▪►]$/g, "").trim();
      if (text) buffer += (buffer && /[A-Za-z0-9]$/.test(buffer) && /^[A-Za-z0-9]/.test(text) ? " " : "") + text;
      if (/[➤•▪►]$/.test(line) || section?.type === "education" || section?.type === "custom") flush();
    }
    flush(); return data;
  }
  if (typeof window !== "undefined") window.agentPlainResume = parse;
  if (typeof module !== "undefined") module.exports = parse;
})();
