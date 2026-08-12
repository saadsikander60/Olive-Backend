const validate = (schema) => (req, res, next) => {
  try {
    const parsed = schema.parse({
      body: req.body,
      params: req.params,
      query: req.query,
    });

    if (parsed.body) req.body = parsed.body;
    if (parsed.params) req.params = parsed.params;
    if (parsed.query) req.query = parsed.query;

    next();
  } catch (error) {
    if (error?.issues) {
      return res.status(400).json({
        success: false,
        message: error.issues.map((i) => i.message).join(", "),
        errors: error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
    }

    return res.status(400).json({
      success: false,
      message: error.message || "Validation failed",
    });
  }
};

export default validate;
