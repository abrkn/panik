const createPanikWithSentry = require('./create-sentry');

const { SENTRY_DSN } = process.env;

const hasModule = name => {
  try {
    require.resolve(name);
    return true;
  } catch (e) {
    return false;
  }
};

const hasSentryModule = hasModule('@sentry/node');

if (SENTRY_DSN && hasSentryModule) {
  module.exports = createPanikWithSentry(SENTRY_DSN, {});
} else {
  console.warn(
    `Falling back to panik without Sentry. SENTRY_DSN set? ${!!SENTRY_DSN}; Has Sentry module? ${hasSentryModule}`
  );

  module.exports = require('./index');
}
