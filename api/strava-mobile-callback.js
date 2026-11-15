const adapt = require('./_netlify-adapter');
const { handler } = require('../netlify/functions/strava-mobile-callback');
module.exports = adapt(handler);
