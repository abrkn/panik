const assert = require('assert');
const git = require('git-rev-sync');
const debug = require('debug')('panik');

const { SENTRY_DSN, NODE_ENV, SENTRY_NAME, HEROKU_APP_NAME, HEROKU_SLUG_COMMIT, APP } = process.env;

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

  let scope;

  Sentry.configureScope(_ => {
    scope = _
  });

  assert(scope);

  const appName = getAppName();

  if (appName !== 'app') {
    scope.setTag("app", appName);
  }

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
  module.exports = createPanikWithSentry(SENTRY_DSN, {
    release: maybeGetRelease(),
  });
} else {
  console.warn(
    `Falling back to panik without Sentry. SENTRY_DSN set? ${!!SENTRY_DSN}; Has Sentry module? ${hasSentryModule}`
  );

  module.exports = require('./index');
}
