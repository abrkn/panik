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

process.on('uncaughtException', printErrorAndExit);

debug('Attached unhandledRejection and uncaughtException handlers');

Object.assign(exports, {
  printErrorAndExit,
  reportError: error => console.error('ERROR', error.stack),
  reportMessage: message => console.log('LOG', message),
  reportEvent: event => console.log('EVENT', event),
});
