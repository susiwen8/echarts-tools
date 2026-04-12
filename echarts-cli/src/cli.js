const { Command } = require('commander');
const { registerExampleCommand } = require('./commands/example');
const { registerInfoCommand } = require('./commands/info');
const { registerListCommand } = require('./commands/list');
const { registerOptionCommand } = require('./commands/option');

function run(argv) {
  const program = new Command();

  program
    .name('echarts')
    .description('Offline knowledge CLI for Apache ECharts users');

  registerListCommand(program);
  registerInfoCommand(program);
  registerExampleCommand(program);
  registerOptionCommand(program);

  program.parse(argv);
}

module.exports = {
  run
};
