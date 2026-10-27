/* DeadShop core — pure, testable helpers (no DOM) */
window.DSC = (function () {
  'use strict';

  function num(v) {
    var m = String(v).match(/-?[\d.]+/);
    return m ? parseFloat(m[0]) : NaN;
  }
  function norm(v) { return String(v).toLowerCase().replace(/[^a-z0-9]/g, ''); }

  /* tolerant numeric grading: "0.75m", "+20%", "20" all accepted */
  function gradeNumber(input, accept) {
    var v = num(input);
    if (isNaN(v)) return false;
    for (var i = 0; i < accept.length; i++) {
      var a = num(accept[i]);
      if (!isNaN(a) && Math.abs(a - v) < 0.011) return true;
    }
    return false;
  }

  /* Card fill: one field per stat, each graded on its own. A learner who
     knows two of six stats still scores for those two — asking for a whole
     card in one free-text box was never realistic. */
  function gradeFields(values, rows) {
    var per = [], matched = 0;
    for (var i = 0; i < rows.length; i++) {
      var raw = (values[i] === undefined || values[i] === null ? '' : String(values[i])).trim();
      var v = num(raw);
      var target = num(rows[i].value);
      var ok = raw !== '' && !isNaN(v) && !isNaN(target) && Math.abs(v - target) < 0.011;
      per.push(ok);
      if (ok) matched++;
    }
    return { matched: matched, total: rows.length, per: per,
      ok: matched === rows.length && rows.length > 0 };
  }

  /* ---------------- item mentions -> inline icons ----------------
     Everything that is not on a small tag allow-list is escaped, so text
     that came out of the game API can never turn into live markup.
     Known item names are wrapped in a tiny inline icon. */
  var ITEM_BY_NAME = {};
  var NAME_RE = null;
  var ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return ESC_MAP[c]; });
  }
  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function setItems(items) {
    ITEM_BY_NAME = {};
    Object.keys(items).forEach(function (slug) { ITEM_BY_NAME[items[slug].name] = { slug: slug }; });
    // longest name first, so "Spirit Lifesteal" wins over a shorter name
    var names = Object.keys(ITEM_BY_NAME).sort(function (a, b) { return b.length - a.length; });
    NAME_RE = names.length
      ? new RegExp('(^|[^A-Za-z0-9])(' + names.map(escapeRe).join('|') + ')(?![A-Za-z0-9])', 'g')
      : null;
  }

  function decorateText(text, iconPath) {
    if (!NAME_RE) return escapeHtml(text);
    NAME_RE.lastIndex = 0;
    var out = '', last = 0, m;
    while ((m = NAME_RE.exec(text)) !== null) {
      // m[1] is the character in front of the name, m[2] the name itself.
      // Only m[1] belongs before the icon — at the start of a string m[1] is
      // empty, and taking one character there would duplicate the first
      // letter of the name.
      out += escapeHtml(text.slice(last, m.index + m[1].length));
      var name = m[2];
      var slug = ITEM_BY_NAME[name].slug;
      out += '<span class="mini-item"><img class="mini-ico" src="' +
        escapeHtml(iconPath || 'assets/icons/') + escapeHtml(slug) + '.png" alt="" loading="lazy">' +
        escapeHtml(name) + '</span>';
      last = m.index + m[0].length;
      if (NAME_RE.lastIndex === m.index) NAME_RE.lastIndex++;
    }
    out += escapeHtml(text.slice(last));
    return out;
  }

  function decorate(html, iconPath) {
    if (!html) return html;
    var src = String(html);
    // protect regions we decorated earlier so a second pass is a no-op
    var keep = [];
    var guarded = src.replace(/<span class="mini-item">[\s\S]*?<\/span>/g, function (m) {
      keep.push(m);
      return '\u0000' + (keep.length - 1) + '\u0000';
    });
    var parts = guarded.split(/(<[^>]*>)/);
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p.charAt(0) === '<') {
        // only bare, attribute-free tags are kept; anything else becomes
        // harmless text instead of markup
        if (/^<\/?(b|i|em|strong|code|br)\s*\/?>$/i.test(p)) out.push(p);
        else out.push(escapeHtml(p));
        continue;
      }
      out.push(decorateText(p, iconPath));
    }
    return out.join('').replace(/\u0000(\d+)\u0000/g, function (_, i) {
      return keep[Number(i)];
    });
  }

  return {
    num: num, norm: norm,
    gradeNumber: gradeNumber, gradeFields: gradeFields,
    setItems: setItems, decorate: decorate
  };
})();
