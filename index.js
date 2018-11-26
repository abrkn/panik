const debug = require('debug')('panik');

const printErrorAndExit = error => {
  const code = error.code || 1;

  debug(`Printing error and exiting with code ${code}...`);

  console.error(error.stack || error || 'Unknown error');
  process.exit(code);
};

process.on('unhandledRejection', function(error) {
  debug(`Unhandled rejection in process. Printing error and exiting`);

  setImmediate(function() {
    printErrorAndExit(error);
  });
});

debug('Attached unhandledRejection handler');

Object.assign(exports, { printErrorAndExit });
