process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'integration-test-access-secret';

const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/models/db');

let insertedIds = [];

async function insertProduct({
  name,
  category = 'Electronics',
  description = 'Test item',
  price = 99.99,
}) {
  const result = await pool.query(
    `INSERT INTO products (name, category, description, price)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, category, description, price`,
    [name, category, description, price],
  );
  insertedIds.push(result.rows[0].id);
  return result.rows[0];
}

beforeAll(async () => {
  await pool.query(`DELETE FROM products WHERE name LIKE 'test_prod_%'`);
});

afterAll(async () => {
  if (insertedIds.length > 0) {
    await pool.query(`DELETE FROM products WHERE id = ANY($1)`, [insertedIds]);
  }
  await pool.end();
});

// ── GET /products — all products ──────────────────────────────────────────────

describe('GET /products', () => {
  test('returns 200 with an array', async () => {
    const res = await request(app).get('/products');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('returns products after inserting one', async () => {
    const p = await insertProduct({ name: 'test_prod_watch' });
    const res = await request(app).get('/products');
    expect(res.status).toBe(200);
    const found = res.body.find((item) => item.id === p.id);
    expect(found).toBeDefined();
  });

  test('returned product has expected fields', async () => {
    const p = await insertProduct({ name: 'test_prod_bag', category: 'Bags' });
    const res = await request(app).get('/products');
    const found = res.body.find((item) => item.id === p.id);
    expect(found).toHaveProperty('id');
    expect(found).toHaveProperty('name');
    expect(found).toHaveProperty('category');
    expect(found).toHaveProperty('description');
    expect(found).toHaveProperty('price');
  });

  test('returned product has isSold field', async () => {
    const p = await insertProduct({ name: 'test_prod_ring' });
    const res = await request(app).get('/products');
    const found = res.body.find((item) => item.id === p.id);
    expect(found).toHaveProperty('isSold');
    expect(found.isSold).toBe(false);
  });

  test('returns correct name for inserted product', async () => {
    const p = await insertProduct({ name: 'test_prod_necklace', category: 'Jewellery' });
    const res = await request(app).get('/products');
    const found = res.body.find((item) => item.id === p.id);
    expect(found.name).toBe('test_prod_necklace');
    expect(found.category).toBe('Jewellery');
  });

  test('returns correct price for inserted product', async () => {
    const p = await insertProduct({ name: 'test_prod_priced', price: 250.5 });
    const res = await request(app).get('/products');
    const found = res.body.find((item) => item.id === p.id);
    expect(Number(found.price)).toBeCloseTo(250.5);
  });

  test('multiple products all appear in response', async () => {
    const a = await insertProduct({ name: 'test_prod_alpha' });
    const b = await insertProduct({ name: 'test_prod_beta' });
    const res = await request(app).get('/products');
    const ids = res.body.map((item) => item.id);
    expect(ids).toContain(a.id);
    expect(ids).toContain(b.id);
  });

  test('does not require Authorization header', async () => {
    const res = await request(app).get('/products');
    expect(res.status).toBe(200);
  });

  test('returns 200 even when products table is seeded', async () => {
    const res = await request(app).get('/products');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ── GET /products?search= ─────────────────────────────────────────────────────

describe('GET /products?search=query', () => {
  test('returns 200 with array', async () => {
    const res = await request(app).get('/products?search=watch');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('finds inserted product by name search', async () => {
    const p = await insertProduct({ name: 'test_prod_uniquekeyword' });
    const res = await request(app).get('/products?search=test_prod_uniquekeyword');
    expect(res.status).toBe(200);
    const found = res.body.find((item) => item.id === p.id);
    expect(found).toBeDefined();
  });

  test('search is case-insensitive', async () => {
    const p = await insertProduct({ name: 'test_prod_CaseSensitive' });
    const res = await request(app).get('/products?search=casesensitive');
    const found = res.body.find((item) => item.id === p.id);
    expect(found).toBeDefined();
  });

  test('returns empty array for unmatched search term', async () => {
    const res = await request(app).get('/products?search=zzz_no_match_xyz_99999');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  test('finds product by category search', async () => {
    const p = await insertProduct({ name: 'test_prod_incategory', category: 'TestUniqueCategory' });
    const res = await request(app).get('/products?search=TestUniqueCategory');
    const found = res.body.find((item) => item.id === p.id);
    expect(found).toBeDefined();
  });

  test('partial search matches product name', async () => {
    const p = await insertProduct({ name: 'test_prod_partialname_xyz' });
    const res = await request(app).get('/products?search=partialname');
    const found = res.body.find((item) => item.id === p.id);
    expect(found).toBeDefined();
  });

  test('returned search result has isSold field', async () => {
    const p = await insertProduct({ name: 'test_prod_searchsold' });
    const res = await request(app).get(`/products?search=test_prod_searchsold`);
    const found = res.body.find((item) => item.id === p.id);
    expect(found).toHaveProperty('isSold');
  });

  test('search result has all required fields', async () => {
    const p = await insertProduct({ name: 'test_prod_searchfields', category: 'Watches' });
    const res = await request(app).get(`/products?search=test_prod_searchfields`);
    const found = res.body.find((item) => item.id === p.id);
    expect(found).toHaveProperty('id');
    expect(found).toHaveProperty('name');
    expect(found).toHaveProperty('category');
    expect(found).toHaveProperty('price');
  });

  test('search takes priority when both search and category are provided', async () => {
    const p = await insertProduct({ name: 'test_prod_searchpriority', category: 'TestCat' });
    const res = await request(app).get(
      '/products?search=test_prod_searchpriority&category=OtherCat',
    );
    expect(res.status).toBe(200);
    const found = res.body.find((item) => item.id === p.id);
    expect(found).toBeDefined();
  });

  test('empty search term falls back to selectAll', async () => {
    const res = await request(app).get('/products?search=');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ── GET /products?category= ───────────────────────────────────────────────────

describe('GET /products?category=', () => {
  test('returns 200 with array', async () => {
    const res = await request(app).get('/products?category=Electronics');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('returns products matching the category', async () => {
    const p = await insertProduct({ name: 'test_prod_catmatch', category: 'UniqueTestCategory' });
    const res = await request(app).get('/products?category=UniqueTestCategory');
    expect(res.status).toBe(200);
    const found = res.body.find((item) => item.id === p.id);
    expect(found).toBeDefined();
  });

  test('returns empty array for non-existent category', async () => {
    const res = await request(app).get('/products?category=zzz_no_such_category_99999');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  test('excludes the product with the given exclude id', async () => {
    const p = await insertProduct({ name: 'test_prod_excluded', category: 'ExcludeTest' });
    const res = await request(app).get(`/products?category=ExcludeTest&exclude=${p.id}`);
    expect(res.status).toBe(200);
    const found = res.body.find((item) => item.id === p.id);
    expect(found).toBeUndefined();
  });

  test('includes other products from the same category when one is excluded', async () => {
    const a = await insertProduct({ name: 'test_prod_keep', category: 'PairCategory' });
    const b = await insertProduct({ name: 'test_prod_exclude', category: 'PairCategory' });
    const res = await request(app).get(`/products?category=PairCategory&exclude=${b.id}`);
    expect(res.status).toBe(200);
    const foundA = res.body.find((item) => item.id === a.id);
    expect(foundA).toBeDefined();
  });

  test('category results have all expected fields', async () => {
    const p = await insertProduct({ name: 'test_prod_catfields', category: 'CatFieldTest' });
    const res = await request(app).get('/products?category=CatFieldTest');
    const found = res.body.find((item) => item.id === p.id);
    expect(found).toHaveProperty('id');
    expect(found).toHaveProperty('name');
    expect(found).toHaveProperty('category', 'CatFieldTest');
    expect(found).toHaveProperty('isSold');
  });

  test('returns at most 4 results (LIMIT 4)', async () => {
    const cat = 'LimitTestCat';
    for (let i = 0; i < 6; i++) {
      await insertProduct({ name: `test_prod_limit_${i}`, category: cat });
    }
    const res = await request(app).get(`/products?category=${cat}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeLessThanOrEqual(4);
  });
});

// ── GET /products/:id ─────────────────────────────────────────────────────────

describe('GET /products/:id', () => {
  test('returns 200 with product when it exists', async () => {
    const p = await insertProduct({ name: 'test_prod_byid' });
    const res = await request(app).get(`/products/${p.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', p.id);
    expect(res.body).toHaveProperty('name', 'test_prod_byid');
  });

  test('returns 404 for a non-existent product id', async () => {
    const res = await request(app).get('/products/9999999');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('message');
  });

  test('returns 404 message for non-existent product', async () => {
    const res = await request(app).get('/products/9999999');
    expect(res.body.message).toBe('Product not found.');
  });

  test('returned product has isSold field', async () => {
    const p = await insertProduct({ name: 'test_prod_soldfield' });
    const res = await request(app).get(`/products/${p.id}`);
    expect(res.body).toHaveProperty('isSold');
    expect(res.body.isSold).toBe(false);
  });

  test('returned product has all required fields', async () => {
    const p = await insertProduct({
      name: 'test_prod_allfields',
      category: 'TestCat',
      price: 55.0,
    });
    const res = await request(app).get(`/products/${p.id}`);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('name');
    expect(res.body).toHaveProperty('category');
    expect(res.body).toHaveProperty('description');
    expect(res.body).toHaveProperty('price');
  });

  test('returns correct price for product', async () => {
    const p = await insertProduct({ name: 'test_prod_price', price: 199.99 });
    const res = await request(app).get(`/products/${p.id}`);
    expect(Number(res.body.price)).toBeCloseTo(199.99);
  });

  test('returns correct category for product', async () => {
    const p = await insertProduct({ name: 'test_prod_cat', category: 'Watches' });
    const res = await request(app).get(`/products/${p.id}`);
    expect(res.body.category).toBe('Watches');
  });

  test('returns a single object (not array)', async () => {
    const p = await insertProduct({ name: 'test_prod_single' });
    const res = await request(app).get(`/products/${p.id}`);
    expect(Array.isArray(res.body)).toBe(false);
    expect(typeof res.body).toBe('object');
  });

  test('does not require Authorization header', async () => {
    const p = await insertProduct({ name: 'test_prod_noauth' });
    const res = await request(app).get(`/products/${p.id}`);
    expect(res.status).toBe(200);
  });
});
