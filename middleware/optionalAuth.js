import jwt from "jsonwebtoken";
import User from "../models/User.js";

/** Optional auth — attaches req.user when token is valid; never fails the request. */
const optionalAuth = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization;
    if (!authorization?.startsWith("Bearer ")) return next();

    const token = authorization.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (user && user.status === "ACTIVE") req.user = user;
  } catch {
    // ignore
  }
  next();
};

export default optionalAuth;
