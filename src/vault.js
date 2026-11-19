// The vault maps placeholder -> original. It lives in memory only, for the
// lifetime of one request. It is never written to Firestore, never put in
// localStorage, and never sent over the network. If the tab closes, the
// mapping is gone and the document cannot be reconstructed from the server.
export class Vault {
  constructor() {
    this.map = new Map();
  }

  absorb(entities) {
    if (!Array.isArray(entities)) return;
    for (const e of entities) {
      if (!e || !e.placeholder || !e.original) continue;
      if (this.map.has(e.placeholder)) continue;
      this.map.set(String(e.placeholder), String(e.original));
    }
  }

  has(placeholder) {
    return this.map.has(placeholder);
  }

  // Restore longest tokens first so [[PERSON_10]] is never clobbered by
  // [[PERSON_1]].
  restore(text) {
    let out = String(text);
    const tokens = [...this.map.keys()].sort((a, b) => b.length - a.length);
    for (const token of tokens) {
      out = out.split(token).join(this.map.get(token));
    }
    return out;
  }

  size() {
    return this.map.size;
  }

  // For the demo: prove the raw values exist only in this object.
  debugKeys() {
    return [...this.map.keys()];
  }
}
