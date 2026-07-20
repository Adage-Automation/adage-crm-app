export const fmt = (n) =>
  n >= 10000000 ? `₹${(n / 10000000).toFixed(1)}Cr`
  : n >= 100000 ? `₹${(n / 100000).toFixed(1)}L`
  : n >= 1000   ? `₹${(n / 1000).toFixed(0)}K`
  : `₹${n}`;

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

/**
 * Resolve a single person entry from an Odoo Many2many field value.
 * Supports plain objects { id, name }, [id, name] tuples, plain numeric IDs, and strings.
 * @param {*} p - the raw field value for one person
 * @param {Object} userMap - id → name map built from hr.employee lookup
 * @returns {string}
 */
export const getPersonName = (p, userMap = {}) => {
  if (p === null || p === undefined) return "";
  if (typeof p === "object" && !Array.isArray(p))
    return p.display_name || p.name || userMap[p.id] || "";
  if (Array.isArray(p)) {
    const id = p[0], tupleName = p[1];
    return userMap[id] || tupleName || "";
  }
  const n = Number(p);
  if (!Number.isNaN(n) && n > 0) return userMap[n] || "";
  return String(p);
};

/**
 * Resolve all persons from a Many2many visit_by field array.
 * @param {Array} persons - raw x_studio_action_by value
 * @param {Object} userMap - id → name map
 * @returns {string} comma-separated names or "—"
 */
export const getPersonNames = (persons, userMap = {}) => {
  if (!persons || !Array.isArray(persons) || persons.length === 0) return "—";
  const names = persons.map(p => getPersonName(p, userMap)).filter(Boolean);
  return names.length ? names.join(", ") : "—";
};
