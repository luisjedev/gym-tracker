const values = new Map();

module.exports = {
  clear: async () => values.clear(),
  getItem: async (key) => values.get(key) ?? null,
  removeItem: async (key) => values.delete(key),
  setItem: async (key, value) => values.set(key, value),
};
