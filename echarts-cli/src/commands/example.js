const { findExamples, loadExampleContent } = require('../data');
const {
  formatExampleListMarkdown,
  formatExampleListText,
  formatExampleMarkdown,
  formatExampleText,
  writeOutput
} = require('../output');

function registerExampleCommand(program) {
  program
    .command('example <query> [id]')
    .description('List matching examples or print a specific example source')
    .option('--format <format>', 'Output format: text, json, markdown', 'text')
    .action(function action(query, id, command) {
      let resolvedId = id;
      let resolvedCommand = command;

      if (!command || typeof command !== 'object' || Array.isArray(command)) {
        resolvedCommand = id;
        resolvedId = null;
      }

      const examples = findExamples(query);
      if (!examples.length) {
        process.stderr.write(`No examples found for query: ${query}\n`);
        process.exitCode = 1;
        return;
      }

      if (resolvedId) {
        const example = examples.find(item => item.id === resolvedId || item.file === resolvedId);
        if (!example) {
          process.stderr.write(`No example matched id: ${resolvedId}\n`);
          process.exitCode = 1;
          return;
        }

        const content = loadExampleContent(example);
        if (content == null) {
          process.stderr.write(`Example content unavailable for id: ${resolvedId}\n`);
          process.exitCode = 1;
          return;
        }

        const payload = {
          id: example.id,
          file: example.file,
          title: example.title,
          tokens: example.tokens,
          content
        };

        writeOutput(
          resolvedCommand.format || 'text',
          payload,
          formatExampleText,
          formatExampleMarkdown
        );
        return;
      }

      const payload = {
        query,
        examples: examples.map(example => ({
          id: example.id,
          file: example.file,
          title: example.title
        }))
      };

      writeOutput(
        resolvedCommand.format || 'text',
        payload,
        formatExampleListText,
        formatExampleListMarkdown
      );
    });
}

module.exports = {
  registerExampleCommand
};
