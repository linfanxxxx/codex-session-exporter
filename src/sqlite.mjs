let sqliteModulePromise;

export async function openDatabase(filePath, options = {}) {
  assertSupportedNodeVersion();

  if (!sqliteModulePromise) {
    const originalEmitWarning = process.emitWarning;

    // Keep CLI output stable while using Node's bundled SQLite support.
    process.emitWarning = function patchedEmitWarning(message, ...args) {
      const text =
        typeof message === "string"
          ? message
          : message && typeof message.message === "string"
            ? message.message
            : "";

      if (text.includes("SQLite is an experimental feature")) {
        return;
      }

      return originalEmitWarning.call(this, message, ...args);
    };

    sqliteModulePromise = import("node:sqlite").finally(() => {
      process.emitWarning = originalEmitWarning;
    });
  }

  const { DatabaseSync } = await sqliteModulePromise;
  return new DatabaseSync(filePath, options);
}

function assertSupportedNodeVersion() {
  const majorVersion = Number.parseInt(process.versions.node.split(".")[0], 10);

  if (majorVersion >= 22) {
    return;
  }

  throw new Error(
    `Node 22+ is required because this tool uses the built-in node:sqlite module. Current runtime: ${process.versions.node}`,
  );
}
