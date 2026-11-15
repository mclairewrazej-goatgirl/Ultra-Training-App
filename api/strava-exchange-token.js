const adapt = require('./_netlify-adapter');
const { handler } = require('../netlify/functions/strava-exchange-token');
module.exports = adapt(handler);
