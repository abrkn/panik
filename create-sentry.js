const assert = require('assert');
const git = require('git-rev-sync');
const debug = require('debug')('panik');

const { SENTRY_DSN, NODE_ENV, HEROKU_SLUG_COMMIT, SENTRY_NAME, HEROKU_APP_NAME, APP } = process.env;

const getAppName = () => SENTRY_NAME || HEROKU_APP_NAME || APP || 'app';

const maybeGetHash = () => {
  try {
    return git.long();
  } catch (error) {
    return false;
  }
};

const maybeGetRelease = () => {
  const hash = HEROKU_SLUG_COMMIT || maybeGetHash();

  if (hash === false) {
    return undefined;
  }

  return getAppName();
};

function createPanikWithSentry(sentryDsn, options) {
  if (!sentryDsn) {
    sentryDsn = SENTRY_DSN;
  }

  assert(sentryDsn, 'sentryDsn argument or SENTRY_DSN is required');

  options = options || {};

  if (options.release === undefined) {
    options.release = maybeGetRelease();
  }

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

  let scope;

  Sentry.configureScope(_ => {
    scope = _;
  });

  assert(scope);

  const appName = getAppName();

  if (appName !== 'app') {
    scope.setTag('app', appName);
  }

  let exiting = false;

  const printErrorAndExit = error => {
    const errorToReport = options.prepareError ? options.prepareError(error) : error;

    console.error(`Unhandled error in process`);
    console.error(errorToReport.stack || errorToReport || 'Unknown error');

    if (errorToReport.data) {
      console.error(`Error data`, errorToReport.data);
    }

    if (exiting) {
      return;
    }

    const eventId = Sentry.captureException(errorToReport);

    console.error(`Reporting to Sentry as event ${eventId} and exiting in 2 sec...`);

    exiting = true;

    setTimeout(() => {
      const code = errorToReport.code || 1;
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
      const errorToReport = options.prepareError ? options.prepareError(error) : error;

      console.error('ERROR', errorToReport.stack || errorToReport.message);

      if (errorToReport.data) {
        console.error(`ERROR data`, data);
      }

      Sentry.captureException(errorToReport);
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

module.exports = createPanikWithSentry;
