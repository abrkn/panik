const printErrorAndExit = error => {
  console.error(error.stack || error || 'Unknown error');
  process.exit(error.code || 1);
};

process.on('unhandledRejection', function(error) {
  setImmediate(function() {
    printErrorAndExit(error);
  });
});

Object.assign(exports, { printErrorAndExit });
