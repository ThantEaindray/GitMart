const express = require('express');
const createError = require('http-errors');
const path = require('path');
const cookieParser = require('cookie-parser');

// Import route handlers
const somethingRouter = require('./routers/Something.router');
const personRouter = require('./routers/Person.router');
const productRouter = require('./routers/product.router');

// Import checkout order routes.
// This handles backend checkout API routes such as:
// POST /orders → create a new order
// GET  /orders → retrieve all orders
const orderRouter = require('./routers/orderRouter');

// Import user authentication routes
// This handles backend API routes such as:
// POST /api/register
// POST /api/login
// GET  /api/me
const userRouter = require('./routers/User.router');
const listingRouter = require('./routers/Listing.router');
const wishlistRouter = require('./routers/Wishlist.router');

const chatrouter = require('./routers/chats.router')

const app = express();

// Parse incoming JSON request bodies.
// This is needed before API routes so req.body can read JSON data
// from Postman or frontend fetch requests.
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Serve static files (HTML, CSS, JS, images) from the 'public' folder.
// e.g. src/public/index.html is accessible at http://localhost:<port>/
app.use(express.static(path.join(__dirname, '../public')));

// Browsers automatically request /favicon.ico — return 204 (no content) to avoid 404 noise.
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Existing backend routes
app.use('/somethings', somethingRouter);
app.use('/persons', personRouter);
app.use('/products', productRouter);

// Checkout order API routes.
// Keep /orders for older clients and expose /api/orders for the frontend API convention.
app.use('/orders', orderRouter);
app.use('/api/orders', orderRouter);

// User authentication API routes.
// All routes inside User.router.js will start with /api.
// Example:
// router.post('/login') becomes POST /api/login
// router.post('/register') becomes POST /api/register
app.use('/api', userRouter);
app.use('/api', listingRouter);
app.use('/api', wishlistRouter);
app.use('/api/chats',chatrouter)
// 404 handler — if no route above matched the request,
// create a 404 error and pass it to the error handler below.
app.use((req, res, next) => {
  next(createError(404, `Unknown resource ${req.method} ${req.originalUrl}`));
});

// Global error handler — catches all errors thrown or passed via next(err).
// Sends a consistent JSON response instead of Express's default HTML error page.
// NOTE: Express requires exactly 4 parameters (error, req, res, next) to recognize
// this as an error handler. 'next' is not used here, so we disable the ESLint rule.
// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
  console.error(error);
  const status = error.status || 500;
  res.status(status).json({ error: error.message });
});

module.exports = app;
