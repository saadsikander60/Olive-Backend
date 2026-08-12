import Address from "../models/Address.js";
import mongoose from "mongoose";

const unsetOtherDefaults = async (userId, exceptId = null) => {
  const filter = { user: userId, isDefault: true };
  if (exceptId) filter._id = { $ne: exceptId };
  await Address.updateMany(filter, { isDefault: false });
};

export const getAddresses = async (req, res, next) => {
  try {
    const addresses = await Address.find({ user: req.user._id }).sort({
      isDefault: -1,
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      message: "Addresses fetched",
      data: { addresses },
    });
  } catch (error) {
    next(error);
  }
};

export const createAddress = async (req, res, next) => {
  try {
    const isDefault = Boolean(req.body.isDefault);
    if (isDefault) await unsetOtherDefaults(req.user._id);

    const count = await Address.countDocuments({ user: req.user._id });
    const address = await Address.create({
      ...req.body,
      user: req.user._id,
      isDefault: isDefault || count === 0,
    });

    if (address.isDefault) await unsetOtherDefaults(req.user._id, address._id);

    return res.status(201).json({
      success: true,
      message: "Address created",
      data: { address },
    });
  } catch (error) {
    next(error);
  }
};

export const updateAddress = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }

    const address = await Address.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!address) {
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    const fields = [
      "fullName",
      "phone",
      "addressLine1",
      "addressLine2",
      "city",
      "district",
      "province",
      "postalCode",
      "landmark",
      "isDefault",
    ];

    for (const field of fields) {
      if (req.body[field] !== undefined) address[field] = req.body[field];
    }

    if (address.isDefault) await unsetOtherDefaults(req.user._id, address._id);

    await address.save();

    return res.status(200).json({
      success: true,
      message: "Address updated",
      data: { address },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAddress = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }

    const address = await Address.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!address) {
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    if (address.isDefault) {
      const nextDefault = await Address.findOne({ user: req.user._id }).sort({
        createdAt: -1,
      });
      if (nextDefault) {
        nextDefault.isDefault = true;
        await nextDefault.save();
      }
    }

    return res.status(200).json({
      success: true,
      message: "Address deleted",
      data: {},
    });
  } catch (error) {
    next(error);
  }
};
