/**
 * Standardised JSON response wrapper.
 * All successful responses have: { success, message, data, meta? }
 */
class ApiResponse {
  constructor(statusCode, message, data = null, meta = null) {
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
    this.meta = meta;
  }

  send(res) {
    const body = {
      success: this.statusCode < 400,
      message: this.message,
    };
    if (this.data !== null) body.data = this.data;
    if (this.meta !== null) body.meta = this.meta;
    return res.status(this.statusCode).json(body);
  }

  // ── Static helpers ───────────────────────────────────────────────────────
  static ok(res, message, data, meta) {
    return new ApiResponse(200, message, data, meta).send(res);
  }

  static created(res, message, data) {
    return new ApiResponse(201, message, data).send(res);
  }

  static noContent(res) {
    return res.status(204).end();
  }
}

module.exports = ApiResponse;
