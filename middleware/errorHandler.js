const errorHandler = (err, req, res, next) => {
  console.error(err);

  const status = err.statusCode || err.status || 500;
  const message =
    status === 500 && process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message || "Internal server error";

  res.status(status).json({
    success: false,
    message,
  });
};

export default errorHandler;
