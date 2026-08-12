import mongoose from "mongoose";

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error("MONGODB_URI is missing. Olive requires a URI targeting the `olive` database.");
    process.exit(1);
  }

  // Hard guard: never connect if URI clearly targets glamira DB path
  try {
    const parsed = new URL(uri.replace("mongodb+srv://", "https://").replace("mongodb://", "http://"));
    const dbName = (parsed.pathname || "").replace(/^\//, "").split("?")[0];
    if (dbName && dbName.toLowerCase() === "glamira") {
      console.error("Refusing to connect: MONGODB_URI targets glamira. Olive must use database `olive`.");
      process.exit(1);
    }
  } catch {
    // URL parse may fail for some SRV forms; still enforce via mongoose db name after connect
  }

  const conn = await mongoose.connect(uri, {
    dbName: "olive",
  });

  const connectedDb = conn.connection.name;

  if (connectedDb !== "olive") {
    console.error(`Refusing to continue: connected database is "${connectedDb}", expected "olive".`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`MongoDB Connected - Database: ${connectedDb}`);
};

export default connectDB;
