exports.handler = async function(event) {
  console.log('[test-ping] Received:', event.httpMethod);
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, message: 'test ping works', timestamp: new Date().toISOString() })
  };
};
