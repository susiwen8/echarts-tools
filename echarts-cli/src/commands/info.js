const { resolveItem } = require('../data');
const {
  formatInfoMarkdown,
  formatInfoText,
  writeOutput
} = require('../output');

function registerInfoCommand(program) {
  program
    .command('info <name>')
    .description('Show metadata for a chart, component, feature, or renderer')
    .option('--format <format>', 'Output format: text, json, markdown', 'text')
    .action(function action(name, command) {
      const item = resolveItem(name);

      if (!item) {
        process.stderr.write(`Unknown ECharts item: ${name}\n`);
        process.exitCode = 1;
        return;
      }

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
        examples: item.examples || [],
        docs: item.docs || { option: null, tutorials: [] }
      };

      writeOutput(
        command.format || 'text',
        payload,
        formatInfoText,
        formatInfoMarkdown
      );
    });
}

module.exports = {
  registerInfoCommand
};
