import Product from "../models/Product.js";
import Category from "../models/Category.js";
import Order from "../models/Order.js";
import User from "../models/User.js";

export const getDashboard = async (req, res, next) => {
  try {
    const revenueStatuses = ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"];

    const [
      totalProducts,
      totalCategories,
      totalOrders,
      totalUsers,
      pendingOrders,
      deliveredOrders,
      lowStockProducts,
      revenueAgg,
      recentOrders,
    ] = await Promise.all([
      Product.countDocuments(),
      Category.countDocuments(),
      Order.countDocuments(),
      User.countDocuments({ role: "USER" }),
      Order.countDocuments({ orderStatus: "PENDING" }),
      Order.countDocuments({ orderStatus: "DELIVERED" }),
      Product.find({ stock: { $lte: 5 }, status: "ACTIVE" })
        .select("name stock sku images")
        .limit(10)
        .sort({ stock: 1 }),
      Order.aggregate([
        { $match: { orderStatus: { $in: revenueStatuses } } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
      Order.find()
        .populate("user", "firstName lastName email")
        .sort({ createdAt: -1 })
        .limit(8),
    ]);

    return res.status(200).json({
      success: true,
      message: "Dashboard stats",
      data: {
        totalProducts,
        totalCategories,
        totalOrders,
        totalUsers,
        totalRevenue: revenueAgg[0]?.total || 0,
        pendingOrders,
        deliveredOrders,
        lowStockProducts,
        recentOrders,
      },
    });
  } catch (error) {
    next(error);
  }
};
