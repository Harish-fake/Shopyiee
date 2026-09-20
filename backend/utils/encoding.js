'use strict';

/**
 * Output-encoding helpers.
 *
 * Whenever user-supplied text is placed into an HTML context, it must pass
 * through `escapeHtml` first.  The hardened rendering paths in `../secure`
 * call these helpers; the deliberately vulnerable paths deliberately do not,
 * so the difference is easy to review side by side.
 */

const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;',
  '=': '&#61;',
  '/': '&#47;',
};

/** Encode a value for safe interpolation into an HTML element or attribute. */
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char]);
}

/** Encode a value for safe inclusion inside a JavaScript string literal. */
function escapeJsString(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/</g, '\\u003C')
    .replace(/>/g, '\\u003E');
}

/**
 * Remove dangerous markup from rich text while keeping a small allow-list of
 * formatting tags.  Used for stored content such as review bodies.
 */
function sanitizeRichText(value) {
  if (value === null || value === undefined) return '';

  let output = String(value);

  // Drop whole dangerous elements together with their contents.
  output = output.replace(/<\s*(script|style|iframe|object|embed|svg|math|link|meta)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
  output = output.replace(/<\s*(script|style|iframe|object|embed|svg|math|link|meta)\b[^>]*\/?>/gi, '');

  // Drop every event handler attribute (onclick, onerror, onload, ...).
  output = output.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // Neutralise javascript:/data:/vbscript: URLs in href/src.
  output = output.replace(/(href|src|xlink:href)\s*=\s*("|')?\s*(javascript|data|vbscript):[^"'>\s]*/gi, '$1="#"');

  // Keep a tiny allow-list of safe formatting tags, encode everything else.
  const allowed = ['b', 'i', 'u', 'strong', 'em', 'br', 'p'];
  output = output.replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (match, tag) => {
    if (allowed.includes(tag.toLowerCase())) return match;
    return escapeHtml(match);
  });

  return output;
}

module.exports = { escapeHtml, escapeJsString, sanitizeRichText };
