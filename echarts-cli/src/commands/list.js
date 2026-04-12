const { loadMetadata } = require('../data');
const {
  formatListMarkdown,
  formatListText,
  writeOutput
} = require('../output');

function registerListCommand(program) {
  program
    .command('list')
    .description('List ECharts charts, components, features, and renderers')
    .option('--kind <kind>', 'Filter by kind: chart, component, feature, renderer')
    .option('--format <format>', 'Output format: text, json, markdown', 'text')
    .action(function action(command) {
      const metadata = loadMetadata();
      const items = metadata.items
        .filter(item => !command.kind || item.kind === command.kind)
        .map(item => ({
          name: item.name,
          kind: item.kind,
          exportName: item.exportName,
          optionType: item.optionType
        }))
        .sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));

      writeOutput(
        command.format || 'text',
        { items },
        formatListText,
        formatListMarkdown
      );
    });
}

module.exports = {
  registerListCommand
};
