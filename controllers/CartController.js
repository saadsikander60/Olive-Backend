import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
import mongoose from "mongoose";

const getEffectivePrice = (product) => {
  if (product.salePrice != null && product.salePrice < product.price) {
    return product.salePrice;
  }
  return product.price;
};

const buildCartResponse = async (cart) => {
  await cart.populate({
    path: "items.product",
    select: "name slug images price salePrice stock status brand",
  });

  let subtotal = 0;
  const items = [];

  for (const item of cart.items) {
    if (!item.product) continue;
    const unitPrice = getEffectivePrice(item.product);
    const lineTotal = unitPrice * item.quantity;
    subtotal += lineTotal;
    items.push({
      product: item.product,
      quantity: item.quantity,
      unitPrice,
      lineTotal,
    });
  }

  return {
    _id: cart._id,
    user: cart.user,
    items,
    itemCount: items.reduce((n, i) => n + i.quantity, 0),
    subtotal,
    updatedAt: cart.updatedAt,
  };
};

const getOrCreateCart = async (userId) => {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) cart = await Cart.create({ user: userId, items: [] });
  return cart;
};

export const getCart = async (req, res, next) => {
  try {
    const cart = await getOrCreateCart(req.user._id);
    const data = await buildCartResponse(cart);
    return res.status(200).json({
      success: true,
      message: "Cart fetched",
      data: { cart: data },
    });
  } catch (error) {
    next(error);
  }
};

export const addToCart = async (req, res, next) => {
  try {
    const { productId, quantity } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: "Invalid product id" });
    }

    const product = await Product.findById(productId);
    if (!product || product.status !== "ACTIVE") {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const cart = await getOrCreateCart(req.user._id);
    const existing = cart.items.find(
      (i) => i.product.toString() === productId
    );

    const nextQty = (existing?.quantity || 0) + quantity;
    if (nextQty > product.stock) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.stock} units available in stock`,
      });
    }

    if (existing) existing.quantity = nextQty;
    else cart.items.push({ product: productId, quantity });

    await cart.save();
    const data = await buildCartResponse(cart);

    return res.status(200).json({
      success: true,
      message: "Added to cart",
      data: { cart: data },
    });
  } catch (error) {
    next(error);
  }
};

export const updateCartItem = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: "Invalid product id" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    if (quantity > product.stock) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.stock} units available in stock`,
      });
    }

    const cart = await getOrCreateCart(req.user._id);
    const item = cart.items.find((i) => i.product.toString() === productId);
    if (!item) {
      return res.status(404).json({ success: false, message: "Item not in cart" });
    }

    item.quantity = quantity;
    await cart.save();
    const data = await buildCartResponse(cart);

    return res.status(200).json({
      success: true,
      message: "Cart updated",
      data: { cart: data },
    });
  } catch (error) {
    next(error);
  }
};

export const removeCartItem = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const cart = await getOrCreateCart(req.user._id);
    cart.items = cart.items.filter((i) => i.product.toString() !== productId);
    await cart.save();
    const data = await buildCartResponse(cart);

    return res.status(200).json({
      success: true,
      message: "Item removed",
      data: { cart: data },
    });
  } catch (error) {
    next(error);
  }
};

export const clearCart = async (req, res, next) => {
  try {
    const cart = await getOrCreateCart(req.user._id);
    cart.items = [];
    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Cart cleared",
      data: {
        cart: {
          _id: cart._id,
          user: cart.user,
          items: [],
          itemCount: 0,
          subtotal: 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
