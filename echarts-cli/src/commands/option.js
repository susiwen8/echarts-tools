const { loadMetadata, resolveItem, resolveTopLevelOption } = require('../data');
const {
  formatInfoMarkdown,
  formatInfoText,
  formatListMarkdown,
  formatListText,
  writeOutput
} = require('../output');

function registerOptionCommand(program) {
  program
    .command('option [name]')
    .description('Inspect top-level option keys or option metadata for a specific item')
    .option('--format <format>', 'Output format: text, json, markdown', 'text')
    .action(function action(name, command) {
      let resolvedName = name;
      let resolvedCommand = command;

      if (!command || typeof command !== 'object' || Array.isArray(command)) {
        resolvedCommand = name;
        resolvedName = null;
      }

      if (!resolvedName) {
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
          examples: item.examples || []
        };

        writeOutput(
          resolvedCommand.format || 'text',
          payload,
          formatInfoText,
          formatInfoMarkdown
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
        examples: []
      };

      writeOutput(
        resolvedCommand.format || 'text',
        payload,
        formatInfoText,
        formatInfoMarkdown
      );
    });
}

module.exports = {
  registerOptionCommand
};
