/**
 * Response Wrapper Middleware
 * ---------------------------------
 * This middleware normalises every JSON response that leaves the API.
 *  - Success responses (<400) become: { success: true, data, status }
 *  - Error responses (>=400) become:  { success: false, message|errors|..., status }
 *  - Controllers can still call `res.json()` as usual – no changes needed.
 *  - Optional helpers: `res.success(data, status)` and `res.fail(message, status, errors)`.
 *
 * Usage:  app.use(responseWrapper)  // before the routers
 */

module.exports = function responseWrapper(req, res, next) {
  // Preserve the original res.json implementation
  const originalJson = res.json.bind(res);

  // Helper to detect if object already wrapped
  const isAlreadyWrapped = (payload) =>
    payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'success');

  // Override res.json
  res.json = function (payload) {
    // Do not double-wrap if already has `success` field
    if (isAlreadyWrapped(payload)) {
      return originalJson(payload);
    }

    const isError = res.statusCode >= 400;

    if (isError) {
      // Ensure we always send a clear error structure
      const errorBody =
        typeof payload === 'object'
          ? payload
          : { message: String(payload) };

      // Provide both `error` and `errors` keys for compatibility
      const compatibility = {
        // Prefer existing nested structures if present
        error: errorBody.error || errorBody.errors || { message: errorBody.message },
        errors: errorBody.errors || errorBody.error || { message: errorBody.message }
      };

      return originalJson({
        success: false,
        ...errorBody,
        ...compatibility,
        status: res.statusCode,
      });
    }

    // Success case
    return originalJson({
      success: true,
      data: payload,
      status: res.statusCode,
    });
  };

  // Convenience helpers (optional)
  res.success = (data, status = 200) => {
    res.status(status);
    return res.json(data);
  };

  res.fail = (messageOrPayload, status = 400, errors = null) => {
    res.status(status);
    if (typeof messageOrPayload === 'object') {
      return res.json({ ...messageOrPayload, errors });
    }
    return res.json({ message: messageOrPayload, errors });
  };

  next();
};
