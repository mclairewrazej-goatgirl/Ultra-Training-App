// Runs the existing Netlify function handlers on Vercel, so the Strava logic
// lives in one place (netlify/functions) and works on both hosts.
module.exports = function adapt(handler) {
  return async function (req, res) {
    const body = req.body == null ? '' : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
    const result = await handler({
      httpMethod: req.method,
      body,
      queryStringParameters: req.query || {},
      headers: req.headers,
    });
    const headers = result.headers || {};
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    if (!headers['Content-Type'] && !headers['content-type'] && result.body && result.statusCode !== 302) {
      res.setHeader('Content-Type', 'application/json');
    }
    res.status(result.statusCode || 200).send(result.body || '');
  };
};
