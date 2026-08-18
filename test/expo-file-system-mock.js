class Directory {
  constructor(...parts) {
    this.uri = parts
      .map((part) => (typeof part === 'string' ? part : part.uri))
      .join('/')
      .replace(/\/+/g, '/');
  }

  create() {}
}

class File {
  constructor(...parts) {
    this.uri = parts
      .map((part) => (typeof part === 'string' ? part : part.uri))
      .join('/')
      .replace(/\/+/g, '/');
    this.exists = true;
  }

  async copy() {}

  delete() {}
}

const Paths = {
  document: new Directory('file://', 'document'),
};

module.exports = { Directory, File, Paths };
