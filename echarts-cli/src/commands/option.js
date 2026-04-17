const {
  getDescendantEntries,
  loadMetadata,
  loadOptionDoc,
  resolveFineOptionQuery,
  resolveItem,
  resolveTopLevelOption
} = require('../data');
const {
  formatDetailedOptionMarkdown,
  formatDetailedOptionText,
  formatListMarkdown,
  formatListText,
  formatOptionQueryMarkdown,
  formatOptionQueryText,
  writeOutput
} = require('../output');

function registerOptionCommand(program) {
  program
    .command('option [query...]')
    .description('Inspect top-level option keys or option metadata for a specific item')
    .option('--full-desc', 'Show fuller property descriptions in query output')
    .option('--grep', 'Flatten recursive query results for quick filtering')
    .option('--lang <lang>', 'Doc language: zh, en', 'zh')
    .option('--tree', 'Show recursive query results as a tree')
    .option('--format <format>', 'Output format: text, json, markdown', 'text')
    .action(function action(query, command) {
      let resolvedQuery = query;
      let resolvedCommand = command;

      if (!command || typeof command !== 'object' || Array.isArray(command)) {
        resolvedCommand = query;
        resolvedQuery = [];
      }

      resolvedQuery = Array.isArray(resolvedQuery)
        ? resolvedQuery.filter(Boolean)
        : (resolvedQuery ? [resolvedQuery] : []);

      const viewMode = resolvedCommand.tree ? 'tree' : (resolvedCommand.grep ? 'grep' : 'detail');

      if (!resolvedQuery.length) {
        const metadata = loadMetadata();
        const payload = {
          items: metadata.optionIndex.map(option => ({
            name: option.name,
            kind: 'option',
            exportName: option.name,
            optionType: option.rawType
          }))
        };

        writeOutput(
          resolvedCommand.format || 'text',
          payload,
          formatListText,
          formatListMarkdown
        );
        return;
      }

      if (resolvedQuery.length > 1 || resolvedQuery[0].includes('.')) {
        const queryPayload = resolveFineOptionQuery(
          resolvedQuery.length === 1 ? resolvedQuery[0] : resolvedQuery,
          resolvedCommand.lang || 'zh'
        );
        if (queryPayload) {
          let outputPayload = { ...queryPayload };

          if (viewMode !== 'detail') {
            const docState = queryPayload._docState;
            const descendants = queryPayload.path
              ? getDescendantEntries(docState, queryPayload.path)
              : getDescendantEntries(docState, null);
            const results = queryPayload.results
              ? queryPayload.results
              : (
                queryPayload.path
                  ? [{ ...queryPayload.entry, name: queryPayload.path.split('.').slice(-1)[0], hasChildren: descendants.length > 0 }]
                    .concat(descendants.map(entry => ({
                      ...entry,
                      name: entry.path.split('.').slice(-1)[0],
                      hasChildren: getDescendantEntries(docState, entry.path).length > 0
                    })))
                  : descendants.map(entry => ({
                    ...entry,
                    name: entry.path.split('.').slice(-1)[0],
                    hasChildren: getDescendantEntries(docState, entry.path).length > 0
                  }))
              );
            outputPayload = {
              ...outputPayload,
              viewMode,
              results
            };
          }

          delete outputPayload._docState;
          outputPayload.fullDesc = Boolean(resolvedCommand.fullDesc);

          writeOutput(
            resolvedCommand.format || 'text',
            outputPayload,
            formatOptionQueryText,
            formatOptionQueryMarkdown
          );
          return;
        }
      }

      const resolvedName = resolvedQuery[0];

      const item = resolveItem(resolvedName);
      if (item) {
        const payload = {
          name: item.name,
          kind: item.kind,
          exportName: item.exportName,
          sourcePath: item.sourcePath,
          installPath: item.installPath,
          optionType: item.optionType,
          topLevelKey: item.topLevelKey,
          optionPath: item.optionPath,
          dependencies: item.dependencies || [],
          docs: item.docs || { option: null, tutorials: [] },
          doc: loadOptionDoc(item.docs && item.docs.option, resolvedCommand.lang || 'zh')
        };

        writeOutput(
          resolvedCommand.format || 'text',
          payload,
          formatDetailedOptionText,
          formatDetailedOptionMarkdown
        );
        return;
      }

      const option = resolveTopLevelOption(resolvedName);
      if (!option) {
        process.stderr.write(`Unknown option target: ${resolvedName}\n`);
        process.exitCode = 1;
        return;
      }

      const payload = {
        name: option.name,
        kind: 'option',
        exportName: option.name,
        sourcePath: 'src/export/option.ts',
        installPath: null,
        optionType: option.rawType,
        topLevelKey: option.topLevelKey,
        optionPath: option.optionPath,
        dependencies: [],
        docs: option.docs || { option: null, tutorials: [] },
        doc: loadOptionDoc(option.docs && option.docs.option, resolvedCommand.lang || 'zh')
      };

      writeOutput(
        resolvedCommand.format || 'text',
        payload,
        formatDetailedOptionText,
        formatDetailedOptionMarkdown
      );
    });
}

module.exports = {
  registerOptionCommand
};
