const adapt = require('./_netlify-adapter');
const { handler } = require('../netlify/functions/strava-refresh-token');
module.exports = adapt(handler);
