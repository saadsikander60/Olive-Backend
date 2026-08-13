import mongoose from "mongoose";
import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
import Address from "../models/Address.js";
import { calculateDeliveryCharge } from "../utils/calculateDeliveryCharge.js";
import { generateOrderNumber } from "../utils/orderNumber.js";

const getEffectivePrice = (product) => {
  if (product.salePrice != null && product.salePrice < product.price) {
    return product.salePrice;
  }
  return product.price;
};

const restoreStock = async (order, session = null) => {
  if (order.stockRestored) return;
  for (const item of order.items) {
    await Product.findByIdAndUpdate(
      item.product,
      { $inc: { stock: item.quantity } },
      session ? { session } : undefined
    );
  }
  order.stockRestored = true;
  await order.save(session ? { session } : undefined);
};

export const createOrder = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const cart = await Cart.findOne({ user: req.user._id }).session(session);
    if (!cart || cart.items.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    let shippingAddress;
    if (req.body.addressId) {
      if (!mongoose.Types.ObjectId.isValid(req.body.addressId)) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: "Invalid address id" });
      }
      const address = await Address.findOne({
        _id: req.body.addressId,
        user: req.user._id,
      }).session(session);

      if (!address) {
        await session.abortTransaction();
        return res.status(404).json({ success: false, message: "Address not found" });
      }

      shippingAddress = {
        fullName: address.fullName,
        phone: address.phone,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2,
        city: address.city,
        district: address.district,
        province: address.province,
        postalCode: address.postalCode,
        landmark: address.landmark,
      };
    } else if (req.body.shippingAddress) {
      shippingAddress = req.body.shippingAddress;
    } else {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "addressId or shippingAddress is required",
      });
    }

    const orderItems = [];
    let subtotal = 0;

    for (const item of cart.items) {
      const product = await Product.findById(item.product).session(session);
      if (!product || product.status !== "ACTIVE") {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "One or more products are unavailable",
        });
      }

      if (product.stock < item.quantity) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}`,
        });
      }

      const unitPrice = getEffectivePrice(product);
      const lineTotal = unitPrice * item.quantity;
      subtotal += lineTotal;

      orderItems.push({
        product: product._id,
        name: product.name,
        image: product.images?.[0] || "",
        quantity: item.quantity,
        unitPrice,
        lineTotal,
      });

      product.stock -= item.quantity;
      await product.save({ session });
    }

    const deliveryCharge = calculateDeliveryCharge(shippingAddress.city);
    const total = subtotal + deliveryCharge;
    const orderNumber = await generateOrderNumber(session);

    const paymentMethod = req.body.paymentMethod || "COD";
    if (paymentMethod !== "COD") {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Only COD is supported at this time",
      });
    }

    const [order] = await Order.create(
      [
        {
          user: req.user._id,
          orderNumber,
          items: orderItems,
          shippingAddress,
          subtotal,
          deliveryCharge,
          total,
          paymentMethod: "COD",
          paymentStatus: "PENDING",
          orderStatus: "PENDING",
        },
      ],
      { session }
    );

    cart.items = [];
    await cart.save({ session });

    await session.commitTransaction();

    return res.status(201).json({
      success: true,
      message: "Order placed successfully",
      data: { order },
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

export const getMyOrders = async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
    const skip = (page - 1) * limit;

    const filter = { user: req.user._id };
    if (req.query.status) filter.orderStatus = req.query.status;

    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Order.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Orders fetched",
      data: {
        orders,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getOrderById = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }

    const order = await Order.findById(req.params.id).populate(
      "user",
      "firstName lastName email phone"
    );

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const isOwner = order.user._id.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== "ADMIN") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    return res.status(200).json({
      success: true,
      message: "Order fetched",
      data: { order },
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminOrders = async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;
    const search = (req.query.search || "").trim();

    const filter = {};
    if (req.query.status) filter.orderStatus = req.query.status;
    if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;
    if (search) {
      filter.$or = [
        { orderNumber: { $regex: search, $options: "i" } },
        { "shippingAddress.fullName": { $regex: search, $options: "i" } },
        { "shippingAddress.phone": { $regex: search, $options: "i" } },
        { "shippingAddress.city": { $regex: search, $options: "i" } },
      ];
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate("user", "firstName lastName email phone")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Order.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Orders fetched",
      data: {
        orders,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateOrderStatus = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: "Invalid id" });
    }

    const order = await Order.findById(req.params.id).session(session);
    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const prevStatus = order.orderStatus;

    if (req.body.orderStatus) order.orderStatus = req.body.orderStatus;
    if (req.body.paymentStatus) order.paymentStatus = req.body.paymentStatus;

    // Prevent unsafe reopen / cancel transitions that corrupt inventory
    if (prevStatus === "CANCELLED" && order.orderStatus !== "CANCELLED") {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Cancelled orders cannot be reopened",
      });
    }

    if (
      order.orderStatus === "CANCELLED" &&
      prevStatus === "DELIVERED"
    ) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Delivered orders cannot be cancelled",
      });
    }

    const canRestoreStock = ["PENDING", "CONFIRMED", "PROCESSING"].includes(
      prevStatus
    );

    if (
      order.orderStatus === "CANCELLED" &&
      prevStatus !== "CANCELLED" &&
      !order.stockRestored &&
      canRestoreStock
    ) {
      await restoreStock(order, session);
    }

    await order.save({ session });
    await session.commitTransaction();

    const populated = await Order.findById(order._id).populate(
      "user",
      "firstName lastName email phone"
    );

    return res.status(200).json({
      success: true,
      message: "Order status updated",
      data: { order: populated },
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};
