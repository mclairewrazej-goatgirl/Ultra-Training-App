exports.handler = async function(event) {
  const { code, error } = event.queryStringParameters || {};

  if (error) {
    return {
      statusCode: 302,
      headers: { Location: `ultra-training://strava?error=${encodeURIComponent(error)}` },
    };
  }

  if (!code) {
    return { statusCode: 400, body: 'Missing authorization code' };
  }

  return {
    statusCode: 302,
    headers: { Location: `ultra-training://strava?code=${code}` },
  };
};
