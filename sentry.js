const assert = require('assert');
const git = require('git-rev-sync');
const debug = require('debug')('panik');

const { SENTRY_DSN, NODE_ENV, SENTRY_NAME, HEROKU_APP_NAME } = process.env;

const hasModule = name => {
  try {
    require.resolve(name);
    return true;
  } catch (e) {
    return false;
  }
};

function createPanikWithSentry(sentryDsn, options) {
  assert(sentryDsn, 'sentryDsn required');

  options = options || {};

  const optionsText = JSON.stringify(options);
  debug(`Configuring Sentry with options ${optionsText}...`);

  const Sentry = require('@sentry/node');

  Sentry.init(
    Object.assign(
      {
        dsn: SENTRY_DSN,
        environment: NODE_ENV || 'development',
        defaultIntegrations: false,
      },
      options
    )
  );

  let exiting = false;

  const printErrorAndExit = error => {
    console.error(`Unhandled error in process`);
    console.error(error.stack || error || 'Unknown error');

    if (exiting) {
      return;
    }

    const eventId = Sentry.captureException(error);

    console.error(`Reporting to Sentry as event ${eventId} and exiting in 2 sec...`);

    exiting = true;

    setTimeout(() => {
      const code = error.code || 1;
      console.error(`Exiting with code ${code}`);
      process.exit(code);
    }, 2e3);
  };

  process.on('unhandledRejection', function(error) {
    debug(`Unhandled rejection in process. Printing error and exiting`);

    setImmediate(function() {
      printErrorAndExit(error);
    });
  });

  process.on('uncaughtException', printErrorAndExit);

  debug('Attached unhandledRejection and uncaughtException handlers');

  return {
    printErrorAndExit,
    reportError: error => {
      console.error('ERROR', error.stack || error.message);
      Sentry.captureException(error);
    },
    reportMessage: message => {
      console.log('LOG', message);
      Sentry.captureMessage(message);
    },
    reportEvent: event => {
      console.log('EVENT', event);
      Sentry.captureEvent(event);
    },
  };
}

const hasSentryModule = hasModule('@sentry/node');

if (SENTRY_DSN && hasSentryModule) {
  const name = SENTRY_NAME || HEROKU_APP_NAME || undefined;

  module.exports = createPanikWithSentry(SENTRY_DSN, {
    release: name ? `${name}@${git.long()}` : undefined,
  });
} else {
  console.warn(
    `Falling back to panik without Sentry. SENTRY_DSN set? ${!!SENTRY_DSN}; Has Sentry module? ${hasSentryModule}`
  );

  module.exports = require('./index');
}
