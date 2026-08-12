/**
 * Temporary Olive API integration test runner.
 * Creates ONLY identifiable TEST_* records and deletes them at the end.
 * Uses database `olive` only — never glamira.
 */
import "dotenv/config";
import { io } from "socket.io-client";
import mongoose from "mongoose";
import { calculateDeliveryCharge } from "../utils/calculateDeliveryCharge.js";

const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:5055";
const API = `${BASE}/api/v1`;
const stamp = Date.now();
const USER_EMAIL = `olive.test.user.${stamp}@test.olive.pk`;
const USER2_EMAIL = `olive.test.user2.${stamp}@test.olive.pk`;
const USER_PASS = "OliveTest@12345";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@olive.pk";
const ADMIN_PASS = process.env.ADMIN_PASSWORD || "OliveAdmin@2026";

const results = [];
const created = {
  userIds: [],
  categoryIds: [],
  productIds: [],
  addressIds: [],
  orderIds: [],
  reviewIds: [],
  contactIds: [],
  conversationIds: [],
};

let userToken = "";
let user2Token = "";
let adminToken = "";
let userId = "";
let user2Id = "";
let categoryId = "";
let categorySlug = "";
let productId = "";
let productSlug = "";
let addressPeshawarId = "";
let addressLahoreId = "";
let orderId = "";
let reviewId = "";
let conversationId = "";

const record = (endpoint, method, expected, actual, pass, note = "") => {
  results.push({ endpoint, method, expected, actual, pass: pass ? "PASS" : "FAIL", note });
  const mark = pass ? "PASS" : "FAIL";
  console.log(`[${mark}] ${method} ${endpoint} — expected: ${expected} | actual: ${actual}${note ? ` (${note})` : ""}`);
};

async function req(method, path, { token, body, formData } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (formData) {
    payload = formData;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: payload,
  });

  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { status: res.status, data };
}

function assertStatus(endpoint, method, expectedStatus, res, extraCheck) {
  const passStatus = res.status === expectedStatus;
  let pass = passStatus;
  let note = "";
  if (passStatus && typeof extraCheck === "function") {
    try {
      const ok = extraCheck(res.data);
      if (!ok) {
        pass = false;
        note = "assertion failed";
      }
    } catch (e) {
      pass = false;
      note = e.message;
    }
  }
  record(endpoint, method, String(expectedStatus), String(res.status), pass, note);
  return pass;
}

async function cleanup() {
  console.log("\n=== CLEANUP (olive only) ===");
  const uri = process.env.MONGODB_URI;
  await mongoose.connect(uri, { dbName: "olive" });
  if (mongoose.connection.name !== "olive") {
    throw new Error(`Cleanup refused — connected to ${mongoose.connection.name}`);
  }

  const db = mongoose.connection.db;
  const del = async (col, filter) => {
    const r = await db.collection(col).deleteMany(filter);
    console.log(`Deleted ${r.deletedCount} from ${col}`);
  };

  // Delete by tracked IDs + identifiable email/name patterns
  if (created.reviewIds.length) {
    await del("reviews", { _id: { $in: created.reviewIds.map((id) => new mongoose.Types.ObjectId(id)) } });
  }
  if (created.orderIds.length) {
    await del("orders", { _id: { $in: created.orderIds.map((id) => new mongoose.Types.ObjectId(id)) } });
  }
  if (created.addressIds.length) {
    await del("addresses", { _id: { $in: created.addressIds.map((id) => new mongoose.Types.ObjectId(id)) } });
  }
  if (created.productIds.length) {
    await del("products", { _id: { $in: created.productIds.map((id) => new mongoose.Types.ObjectId(id)) } });
  }
  if (created.categoryIds.length) {
    await del("categories", { _id: { $in: created.categoryIds.map((id) => new mongoose.Types.ObjectId(id)) } });
  }
  if (created.contactIds.length) {
    await del("contacts", { _id: { $in: created.contactIds.map((id) => new mongoose.Types.ObjectId(id)) } });
  }

  // carts + messages + conversations for test users
  if (created.userIds.length) {
    const uids = created.userIds.map((id) => new mongoose.Types.ObjectId(id));
    await del("carts", { user: { $in: uids } });
    const convs = await db.collection("conversations").find({ user: { $in: uids } }).toArray();
    const cids = convs.map((c) => c._id);
    if (cids.length) {
      await del("messages", { conversation: { $in: cids } });
      await del("conversations", { _id: { $in: cids } });
    }
    await del("users", {
      $or: [
        { _id: { $in: uids } },
        { email: { $regex: `^olive\\.test\\.user` } },
      ],
    });
  } else {
    await del("users", { email: { $regex: `^olive\\.test\\.user` } });
  }

  // safety: remove leftover test categories/products by name prefix
  await del("categories", { name: { $regex: "^TEST_OLIVE_" } });
  await del("products", { name: { $regex: "^TEST_OLIVE_" } });
  await del("contacts", { email: { $regex: "@test\\.olive\\.pk$" } });

  await mongoose.disconnect();
  console.log("Cleanup complete. Database: olive");
}

async function testSocketChat() {
  console.log("\n=== SOCKET.IO CHAT ===");
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      record("socket/chat", "WS", "message roundtrip", "timeout", false);
      try { userSock.close(); } catch {}
      try { adminSock.close(); } catch {}
      resolve();
    }, 12000);

    let userSock;
    let adminSock;
    let gotAdmin = false;
    let gotUser = false;

    userSock = io(BASE, { auth: { token: userToken }, transports: ["websocket"] });
    adminSock = io(BASE, { auth: { token: adminToken }, transports: ["websocket"] });

    const maybeDone = () => {
      if (gotAdmin && gotUser) {
        clearTimeout(timeout);
        record("socket/chat", "WS", "USER<->ADMIN realtime", "ok", true);
        userSock.close();
        adminSock.close();
        resolve();
      }
    };

    adminSock.on("chat:message:new", (payload) => {
      if (payload?.message?.senderRole === "USER") {
        gotAdmin = true;
        maybeDone();
      }
    });

    userSock.on("chat:message:new", (payload) => {
      if (payload?.message?.senderRole === "ADMIN") {
        gotUser = true;
        maybeDone();
      }
    });

    userSock.on("connect", async () => {
      // send via REST so persistence + emit both happen
      const send = await req("POST", "/chat/messages", {
        token: userToken,
        body: { text: `TEST_OLIVE_CHAT_USER_${stamp}` },
      });
      if (send.status !== 201) {
        clearTimeout(timeout);
        record("socket/chat", "WS", "user send 201", String(send.status), false);
        userSock.close();
        adminSock.close();
        resolve();
        return;
      }
      conversationId = send.data?.data?.conversation?._id;
      if (conversationId) created.conversationIds.push(conversationId);

      setTimeout(async () => {
        const reply = await req("POST", "/chat/admin/messages", {
          token: adminToken,
          body: { conversationId, text: `TEST_OLIVE_CHAT_ADMIN_${stamp}` },
        });
        if (reply.status !== 201) {
          clearTimeout(timeout);
          record("socket/chat", "WS", "admin reply 201", String(reply.status), false, reply.data?.message);
          userSock.close();
          adminSock.close();
          resolve();
        }
      }, 500);
    });

    userSock.on("connect_error", (err) => {
      clearTimeout(timeout);
      record("socket/chat", "WS", "connect", err.message, false);
      resolve();
    });
  });
}

async function main() {
  console.log(`Testing Olive API at ${BASE}`);
  console.log(`Database target must be olive only.\n`);

  // Health
  {
    const res = await fetch(BASE);
    const data = await res.json();
    record("/", "GET", "200 + Olive API is running", `${res.status} ${data.message}`, res.status === 200 && data.message === "Olive API is running");
  }

  // Delivery helper unit checks
  record("util/delivery", "FN", "Peshawar=200", String(calculateDeliveryCharge("Peshawar")), calculateDeliveryCharge("Peshawar") === 200);
  record("util/delivery", "FN", "peshawar trim=200", String(calculateDeliveryCharge("  PESHAWAR ")), calculateDeliveryCharge("  PESHAWAR ") === 200);
  record("util/delivery", "FN", "Karachi=350", String(calculateDeliveryCharge("Karachi")), calculateDeliveryCharge("Karachi") === 350);
  record("util/delivery", "FN", "Lahore=350", String(calculateDeliveryCharge("Lahore")), calculateDeliveryCharge("Lahore") === 350);

  // Unauthenticated protected
  assertStatus("/users/me", "GET", 401, await req("GET", "/users/me"));
  assertStatus("/cart", "GET", 401, await req("GET", "/cart"));
  assertStatus("/dashboard", "GET", 401, await req("GET", "/dashboard"));
  assertStatus("/admin/users", "GET", 401, await req("GET", "/admin/users"));

  // Register user
  {
    const res = await req("POST", "/users/register", {
      body: {
        firstName: "TEST_OLIVE",
        lastName: `User_${stamp}`,
        email: USER_EMAIL,
        phone: "03001112233",
        password: USER_PASS,
      },
    });
    const ok = assertStatus("/users/register", "POST", 201, res, (d) => d?.data?.user?.role === "USER" && d?.data?.token);
    if (ok) {
      userToken = res.data.data.token;
      userId = res.data.data.user.id || res.data.data.user._id;
      created.userIds.push(userId);
    }
  }

  // Register second user (ownership tests)
  {
    const res = await req("POST", "/users/register", {
      body: {
        firstName: "TEST_OLIVE",
        lastName: `User2_${stamp}`,
        email: USER2_EMAIL,
        phone: "03004445566",
        password: USER_PASS,
      },
    });
    const ok = assertStatus("/users/register (user2)", "POST", 201, res, (d) => !!d?.data?.token);
    if (ok) {
      user2Token = res.data.data.token;
      user2Id = res.data.data.user.id || res.data.data.user._id;
      created.userIds.push(user2Id);
    }
  }

  // Duplicate register
  assertStatus("/users/register (dup)", "POST", 400, await req("POST", "/users/register", {
    body: { firstName: "X", lastName: "Y", email: USER_EMAIL, phone: "03001112233", password: USER_PASS },
  }));

  // Invalid register
  assertStatus("/users/register (invalid)", "POST", 400, await req("POST", "/users/register", {
    body: { firstName: "", email: "bad", password: "1" },
  }));

  // User login
  {
    const res = await req("POST", "/users/login", { body: { email: USER_EMAIL, password: USER_PASS } });
    assertStatus("/users/login", "POST", 200, res, (d) => !!d?.data?.token);
    if (res.data?.data?.token) userToken = res.data.data.token;
  }

  // Bad login
  assertStatus("/users/login (bad)", "POST", 401, await req("POST", "/users/login", {
    body: { email: USER_EMAIL, password: "wrong-password" },
  }));

  // Admin login
  {
    const res = await req("POST", "/users/login", { body: { email: ADMIN_EMAIL, password: ADMIN_PASS } });
    const ok = assertStatus("/users/login (admin)", "POST", 200, res, (d) => d?.data?.user?.role === "ADMIN");
    if (ok) adminToken = res.data.data.token;
  }

  // USER forbidden on admin APIs
  assertStatus("/dashboard (user)", "GET", 403, await req("GET", "/dashboard", { token: userToken }));
  assertStatus("/admin/users (user)", "GET", 403, await req("GET", "/admin/users", { token: userToken }));
  assertStatus("/orders (admin list as user)", "GET", 403, await req("GET", "/orders", { token: userToken }));
  assertStatus("/categories (create as user)", "POST", 403, await req("POST", "/categories", {
    token: userToken,
    body: { name: "Nope" },
  }));

  // Profile GET/PUT
  assertStatus("/users/me", "GET", 200, await req("GET", "/users/me", { token: userToken }), (d) => d?.data?.user?.email === USER_EMAIL);
  {
    const res = await req("PUT", "/users/me", {
      token: userToken,
      body: { phone: "03009998877", firstName: "TEST_OLIVE" },
    });
    assertStatus("/users/me", "PUT", 200, res, (d) => d?.data?.user?.phone === "03009998877");
  }

  // Category CRUD (admin) — JSON without image
  categorySlug = `test-olive-cat-${stamp}`;
  {
    const res = await req("POST", "/categories", {
      token: adminToken,
      body: {
        name: `TEST_OLIVE_Category_${stamp}`,
        slug: categorySlug,
        description: "Temporary test category",
        status: "ACTIVE",
      },
    });
    const ok = assertStatus("/categories", "POST", 201, res, (d) => !!d?.data?.category?._id);
    if (ok) {
      categoryId = res.data.data.category._id;
      created.categoryIds.push(categoryId);
    }
  }

  assertStatus("/categories", "GET", 200, await req("GET", "/categories"), (d) => Array.isArray(d?.data?.categories));
  assertStatus(`/categories/${categorySlug}`, "GET", 200, await req("GET", `/categories/${categorySlug}`));

  {
    const res = await req("PUT", `/categories/${categoryId}`, {
      token: adminToken,
      body: { description: "Updated TEST_OLIVE category" },
    });
    assertStatus(`/categories/:id`, "PUT", 200, res, (d) => d?.data?.category?.description?.includes("Updated"));
  }

  // Product CRUD
  productSlug = `test-olive-prod-${stamp}`;
  {
    const res = await req("POST", "/products", {
      token: adminToken,
      body: {
        name: `TEST_OLIVE_Product_${stamp}`,
        slug: productSlug,
        description: "Temporary test product for Olive API suite",
        price: 1500,
        salePrice: 1200,
        category: categoryId,
        stock: 20,
        sku: `TEST-OLV-${stamp}`,
        brand: "OliveTest",
        size: "50ml",
        skinType: "All Skin Types",
        skinConcern: ["Acne"],
        status: "ACTIVE",
        featured: "true",
      },
    });
    const ok = assertStatus("/products", "POST", 201, res, (d) => !!d?.data?.product?._id);
    if (ok) {
      productId = res.data.data.product._id;
      created.productIds.push(productId);
    }
  }

  assertStatus("/products", "GET", 200, await req("GET", "/products"), (d) => Array.isArray(d?.data?.products));
  assertStatus(`/products/${productSlug}`, "GET", 200, await req("GET", `/products/${productSlug}`));

  {
    const res = await req("PUT", `/products/${productId}`, {
      token: adminToken,
      body: { stock: 15, price: 1600 },
    });
    assertStatus("/products/:id", "PUT", 200, res, (d) => d?.data?.product?.stock === 15);
  }

  // Cart
  assertStatus("/cart", "GET", 200, await req("GET", "/cart", { token: userToken }));
  {
    const res = await req("POST", "/cart", {
      token: userToken,
      body: { productId, quantity: 2 },
    });
    assertStatus("/cart", "POST", 200, res, (d) => d?.data?.cart?.itemCount === 2 && d?.data?.cart?.subtotal === 2400);
  }
  {
    const res = await req("PUT", `/cart/${productId}`, {
      token: userToken,
      body: { quantity: 3 },
    });
    assertStatus("/cart/:productId", "PUT", 200, res, (d) => d?.data?.cart?.itemCount === 3);
  }

  // Invalid cart qty over stock
  assertStatus("/cart (overstock)", "PUT", 400, await req("PUT", `/cart/${productId}`, {
    token: userToken,
    body: { quantity: 999 },
  }));

  // Addresses
  {
    const res = await req("POST", "/addresses", {
      token: userToken,
      body: {
        fullName: "TEST_OLIVE Buyer",
        phone: "03001112233",
        addressLine1: "Street 1 TEST_OLIVE",
        city: "Peshawar",
        province: "Khyber Pakhtunkhwa",
        isDefault: true,
      },
    });
    const ok = assertStatus("/addresses (Peshawar)", "POST", 201, res, (d) => !!d?.data?.address?._id);
    if (ok) {
      addressPeshawarId = res.data.data.address._id;
      created.addressIds.push(addressPeshawarId);
    }
  }
  {
    const res = await req("POST", "/addresses", {
      token: userToken,
      body: {
        fullName: "TEST_OLIVE Buyer",
        phone: "03001112233",
        addressLine1: "Street 2 TEST_OLIVE",
        city: "Lahore",
        province: "Punjab",
        isDefault: false,
      },
    });
    const ok = assertStatus("/addresses (Lahore)", "POST", 201, res, (d) => !!d?.data?.address?._id);
    if (ok) {
      addressLahoreId = res.data.data.address._id;
      created.addressIds.push(addressLahoreId);
    }
  }
  assertStatus("/addresses", "GET", 200, await req("GET", "/addresses", { token: userToken }), (d) => d?.data?.addresses?.length >= 2);

  // Ownership: user2 cannot update user1 address
  assertStatus("/addresses/:id (other user)", "PUT", 404, await req("PUT", `/addresses/${addressPeshawarId}`, {
    token: user2Token,
    body: { city: "Islamabad" },
  }));

  // Order — Peshawar delivery 200
  {
    // ensure cart qty 2
    await req("PUT", `/cart/${productId}`, { token: userToken, body: { quantity: 2 } });
    const res = await req("POST", "/orders", {
      token: userToken,
      body: { addressId: addressPeshawarId, paymentMethod: "COD" },
    });
    const ok = assertStatus("/orders (Peshawar)", "POST", 201, res, (d) => {
      const o = d?.data?.order;
      return o && o.deliveryCharge === 200 && o.subtotal === 2400 && o.total === 2600;
    });
    if (ok) {
      orderId = res.data.data.order._id;
      created.orderIds.push(orderId);
    }
  }

  // Refill cart for Lahore order
  {
    await req("POST", "/cart", { token: userToken, body: { productId, quantity: 1 } });
    const res = await req("POST", "/orders", {
      token: userToken,
      body: { addressId: addressLahoreId, paymentMethod: "COD" },
    });
    const ok = assertStatus("/orders (Lahore/outside)", "POST", 201, res, (d) => {
      const o = d?.data?.order;
      return o && o.deliveryCharge === 350 && o.subtotal === 1200 && o.total === 1550;
    });
    if (ok) created.orderIds.push(res.data.data.order._id);
  }

  // My orders
  assertStatus("/orders/my-orders", "GET", 200, await req("GET", "/orders/my-orders", { token: userToken }), (d) => d?.data?.orders?.length >= 1);

  // Get order by id
  assertStatus(`/orders/:id`, "GET", 200, await req("GET", `/orders/${orderId}`, { token: userToken }));

  // Ownership: user2 cannot read user1 order
  assertStatus(`/orders/:id (other)`, "GET", 403, await req("GET", `/orders/${orderId}`, { token: user2Token }));

  // Admin orders
  assertStatus("/orders (admin)", "GET", 200, await req("GET", "/orders", { token: adminToken }), (d) => Array.isArray(d?.data?.orders));

  // Order status update
  {
    const res = await req("PUT", `/orders/${orderId}/status`, {
      token: adminToken,
      body: { orderStatus: "CONFIRMED" },
    });
    assertStatus("/orders/:id/status", "PUT", 200, res, (d) => d?.data?.order?.orderStatus === "CONFIRMED");
  }

  // User cannot update status
  assertStatus("/orders/:id/status (user)", "PUT", 403, await req("PUT", `/orders/${orderId}/status`, {
    token: userToken,
    body: { orderStatus: "DELIVERED" },
  }));

  // Reviews
  {
    const res = await req("POST", "/reviews", {
      token: userToken,
      body: { productId, rating: 5, comment: "TEST_OLIVE review great" },
    });
    const ok = assertStatus("/reviews", "POST", 201, res, (d) => !!d?.data?.review?._id);
    if (ok) {
      reviewId = res.data.data.review._id;
      created.reviewIds.push(reviewId);
    }
  }
  assertStatus("/reviews (dup)", "POST", 400, await req("POST", "/reviews", {
    token: userToken,
    body: { productId, rating: 4, comment: "dup" },
  }));
  assertStatus(`/reviews/product/${productId}`, "GET", 200, await req("GET", `/reviews/product/${productId}`));
  assertStatus("/reviews/my-reviews", "GET", 200, await req("GET", "/reviews/my-reviews", { token: userToken }));
  {
    const res = await req("PUT", `/reviews/${reviewId}`, {
      token: userToken,
      body: { rating: 4, comment: "TEST_OLIVE updated" },
    });
    assertStatus("/reviews/:id", "PUT", 200, res, (d) => d?.data?.review?.rating === 4);
  }

  // Contact
  {
    const res = await req("POST", "/contact", {
      body: {
        name: "TEST_OLIVE Contact",
        email: `contact.${stamp}@test.olive.pk`,
        phone: "0300123123",
        subject: "TEST_OLIVE subject",
        message: "Temporary contact message for API test",
      },
    });
    const ok = assertStatus("/contact", "POST", 201, res, (d) => !!d?.data?.contact?._id);
    if (ok) created.contactIds.push(res.data.data.contact._id);

    if (ok) {
      const id = res.data.data.contact._id;
      const upd = await req("PUT", `/contact/${id}/status`, {
        token: adminToken,
        body: { status: "READ" },
      });
      assertStatus("/contact/:id/status", "PUT", 200, upd, (d) => d?.data?.contact?.status === "READ");
    }
  }
  assertStatus("/contact (admin list)", "GET", 200, await req("GET", "/contact", { token: adminToken }));
  assertStatus("/contact (user list)", "GET", 403, await req("GET", "/contact", { token: userToken }));

  // Admin users
  assertStatus("/admin/users", "GET", 200, await req("GET", "/admin/users", { token: adminToken }), (d) => Array.isArray(d?.data?.users));
  assertStatus(`/admin/users/${userId}`, "GET", 200, await req("GET", `/admin/users/${userId}`, { token: adminToken }));
  {
    const res = await req("PUT", `/admin/users/${user2Id}/status`, {
      token: adminToken,
      body: { status: "INACTIVE" },
    });
    assertStatus("/admin/users/:id/status", "PUT", 200, res, (d) => d?.data?.user?.status === "INACTIVE");
  }
  // inactive cannot login
  assertStatus("/users/login (inactive)", "POST", 403, await req("POST", "/users/login", {
    body: { email: USER2_EMAIL, password: USER_PASS },
  }));
  // reactivate for cleanup ownership simplicity
  await req("PUT", `/admin/users/${user2Id}/status`, {
    token: adminToken,
    body: { status: "ACTIVE" },
  });

  // Dashboard
  assertStatus("/dashboard", "GET", 200, await req("GET", "/dashboard", { token: adminToken }), (d) => typeof d?.data?.totalProducts === "number");

  // Chat REST
  {
    const res = await req("GET", "/chat/conversation", { token: userToken });
    const ok = assertStatus("/chat/conversation", "GET", 200, res, (d) => !!d?.data?.conversation?._id);
    if (ok) {
      conversationId = res.data.data.conversation._id;
      created.conversationIds.push(conversationId);
    }
  }
  assertStatus("/chat/admin/conversations (user)", "GET", 403, await req("GET", "/chat/admin/conversations", { token: userToken }));
  assertStatus("/chat/admin/conversations", "GET", 200, await req("GET", "/chat/admin/conversations", { token: adminToken }));

  // user cannot read arbitrary conversation of other user
  {
    // create conversation for user2
    const c2 = await req("GET", "/chat/conversation", { token: user2Token });
    const c2id = c2.data?.data?.conversation?._id;
    if (c2id) {
      assertStatus("/chat/messages (other conv)", "GET", 403, await req("GET", `/chat/messages/${c2id}`, { token: userToken }));
    } else {
      record("/chat/messages (other conv)", "GET", "403", "skip", false, "no user2 conversation");
    }
  }

  await testSocketChat();

  // Delete review (user)
  if (reviewId) {
    assertStatus("/reviews/:id", "DELETE", 200, await req("DELETE", `/reviews/${reviewId}`, { token: userToken }));
    created.reviewIds = created.reviewIds.filter((id) => id !== reviewId);
  }

  // Delete product & category (admin) — after orders, product delete should still work
  if (productId) {
    const res = await req("DELETE", `/products/${productId}`, { token: adminToken });
    assertStatus("/products/:id", "DELETE", 200, res);
    if (res.status === 200) created.productIds = created.productIds.filter((id) => id !== productId);
  }
  if (categoryId) {
    const res = await req("DELETE", `/categories/${categoryId}`, { token: adminToken });
    // may fail if other products remain — our product deleted
    assertStatus("/categories/:id", "DELETE", 200, res);
    if (res.status === 200) created.categoryIds = created.categoryIds.filter((id) => id !== categoryId);
  }

  await cleanup();

  const passed = results.filter((r) => r.pass === "PASS").length;
  const failed = results.filter((r) => r.pass === "FAIL").length;

  console.log("\n=== SUMMARY TABLE ===");
  console.log("Endpoint | Method | Expected | Actual | PASS/FAIL");
  for (const r of results) {
    console.log(`${r.endpoint} | ${r.method} | ${r.expected} | ${r.actual} | ${r.pass}${r.note ? ` | ${r.note}` : ""}`);
  }
  console.log(`\nTOTAL: ${results.length} | PASS: ${passed} | FAIL: ${failed}`);
  console.log("Database used: olive");
  console.log("Database glamira: untouched");

  if (failed > 0) process.exitCode = 1;
}

main().catch(async (err) => {
  console.error("TEST RUNNER CRASH:", err);
  try { await cleanup(); } catch (e) { console.error("cleanup error", e.message); }
  process.exit(1);
});
