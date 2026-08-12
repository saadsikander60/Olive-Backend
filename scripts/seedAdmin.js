import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User.js";

const seedAdmin = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is required");
    process.exit(1);
  }

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const firstName = process.env.ADMIN_FIRST_NAME || "Olive";
  const lastName = process.env.ADMIN_LAST_NAME || "Admin";

  if (!email || !password) {
    console.error("ADMIN_EMAIL and ADMIN_PASSWORD are required");
    process.exit(1);
  }

  await mongoose.connect(uri, { dbName: "olive" });

  if (mongoose.connection.name !== "olive") {
    console.error(`Connected to wrong database: ${mongoose.connection.name}`);
    process.exit(1);
  }

  console.log("MongoDB Connected - Database: olive");

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    if (existing.role !== "ADMIN") {
      existing.role = "ADMIN";
      existing.status = "ACTIVE";
      await existing.save();
      console.log(`Updated existing user to ADMIN: ${email}`);
    } else {
      console.log(`Admin already exists: ${email}`);
    }
  } else {
    await User.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      phone: "03000000000",
      password,
      role: "ADMIN",
      status: "ACTIVE",
    });
    console.log(`Admin created: ${email}`);
  }

  await mongoose.disconnect();
  process.exit(0);
};

seedAdmin().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
