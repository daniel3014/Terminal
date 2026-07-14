/**
 * Terminal — command bus for typed commands, sidebar actions, and future AI/voice.
 * No DOM or Firebase here; the app injects behavior via register() handlers.
 */
(function (global) {
  'use strict';

  /** @typedef {{ id: string, aliases?: string[], description?: string, category?: string, handler: (ctx: object, parsed: Parsed) => Promise<CommandResult>|CommandResult }} CommandDef */
  /** @typedef {{ ok?: boolean, code?: string, message?: string, data?: unknown }} CommandResult */
  /** @typedef {{ verb: string, args: string[], raw: string }} Parsed */

  const commands = [];
  const lookup = new Map();

  function norm(s) {
    return String(s || '')
      .trim()
      .toLowerCase();
  }

  /**
   * @param {string} text
   * @returns {Parsed}
   */
  function parseInput(text) {
    const raw = String(text || '').trim();
    if (!raw) return { verb: '', args: [], raw };
    const parts = raw.split(/\s+/);
    return { verb: norm(parts[0]), args: parts.slice(1), raw };
  }

  /**
   * @param {CommandDef} def
   */
  function register(def) {
    if (!def || !def.id || typeof def.handler !== 'function') return;
    const id = norm(def.id);
    const entry = {
      id,
      aliases: (def.aliases || []).map(norm),
      description: def.description || '',
      category: def.category || '',
      handler: def.handler,
    };
    commands.push(entry);
    lookup.set(id, entry);
    entry.aliases.forEach((a) => lookup.set(a, entry));
  }

  function getManifest() {
    return commands.map(({ id, aliases, description, category }) => ({
      id,
      aliases: (aliases || []).filter((a) => a !== id),
      description,
      category: category || '',
    }));
  }

  /**
   * @param {string} rawInput
   * @param {object} [context]
   * @returns {Promise<CommandResult>}
   */
  async function dispatch(rawInput, context) {
    const parsed = parseInput(rawInput);
    if (!parsed.verb) {
      return { ok: false, code: 'empty', message: 'Comando vazio.' };
    }

    let def = lookup.get(parsed.verb);
    if (!def && parsed.verb.indexOf(':') > 0) {
      const head = norm(parsed.verb.split(':')[0]);
      const tail = parsed.raw.split(':').slice(1).join(':').trim();
      const tryDef = lookup.get(head);
      if (tryDef) {
        def = tryDef;
        parsed.verb = head;
        parsed.args = tail ? [tail].concat(parsed.args) : parsed.args;
      }
    }

    if (!def) {
      const ids = commands.map((c) => c.id).slice(0, 8);
      return {
        ok: false,
        code: 'unknown',
        message: 'Comando desconhecido: "' + parsed.verb + '". Tente: help',
        data: { suggestions: ids },
      };
    }

    try {
      const out = await def.handler(context || {}, parsed);
      if (typeof out === 'string') {
        return { ok: true, code: 'ok', message: out };
      }
      if (out && typeof out === 'object') {
        return Object.assign({ ok: true, code: 'ok', message: '' }, out);
      }
      return { ok: true, code: 'ok', message: '' };
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      return { ok: false, code: 'error', message: msg };
    }
  }

  global.TerminalCommandBus = {
    register,
    dispatch,
    parseInput,
    getManifest,
  };
})(typeof window !== 'undefined' ? window : globalThis);
