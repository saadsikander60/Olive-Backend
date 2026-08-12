import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.models.Counter || mongoose.model("Counter", counterSchema);

/**
 * Generates unique order numbers: OLV-2026-000001
 */
export const generateOrderNumber = async (session = null) => {
  const year = new Date().getFullYear();
  const key = `order-${year}`;

  const options = {
    returnDocument: "after",
    upsert: true,
    setDefaultsOnInsert: true,
  };
  if (session) options.session = session;

  const counter = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    options
  );

  const seq = String(counter.seq).padStart(6, "0");
  return `OLV-${year}-${seq}`;
};
