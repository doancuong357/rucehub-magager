const dns = require('dns');
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

const cors = require('cors');
const express = require('express');
const path = require('path');
const {
  all,
  dbPath,
  dbType,
  close,
  get,
  initDatabase,
  run,
  transaction,
} = require('./database');

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanText(value) {
  return String(value || '').trim();
}

function productPayload(body) {
  return {
    name: cleanText(body.name),
    type: cleanText(body.type),
    origin: cleanText(body.origin),
    unit: cleanText(body.unit) || 'kg',
    price: Math.max(0, Math.round(numberValue(body.price))),
    cost: Math.max(0, Math.round(numberValue(body.cost))),
    stock: Math.max(0, numberValue(body.stock)),
    minStock: Math.max(0, numberValue(body.minStock)),
    note: cleanText(body.note),
  };
}

function customerPayload(body) {
  return {
    name: cleanText(body.name),
    phone: cleanText(body.phone),
    address: cleanText(body.address),
    group: cleanText(body.group) || 'Khách lẻ',
    debt: Math.max(0, Math.round(numberValue(body.debt))),
    note: cleanText(body.note),
  };
}

function mapProduct(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    origin: row.origin,
    unit: row.unit,
    price: row.price,
    cost: row.cost,
    stock: row.stock,
    minStock: row.min_stock,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCustomer(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    address: row.address,
    group: row.customer_group,
    debt: row.debt,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapOrder(row) {
  return {
    id: row.id,
    code: row.code,
    customerId: row.customer_id,
    customerName: row.customer_name,
    productId: row.product_id,
    productName: row.product_name,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    total: row.total,
    paid: row.paid,
    status: row.status,
    note: row.note,
    createdAt: row.created_at,
  };
}

function mapDebtContact(row) {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    phone: row.phone,
    method: row.method,
    content: row.content,
    promisedDate: row.promised_date,
    status: row.status,
    createdAt: row.created_at,
  };
}

async function createOrderCode() {
  const row = await get('SELECT COUNT(*) AS count FROM orders');
  const next = Number(row?.count || 0) + 1;
  return `HD-${String(next).padStart(5, '0')}`;
}

app.get('/health', async (_req, res) => {
  res.json({
    ok: true,
    database: dbType === 'postgres' ? 'Supabase PostgreSQL' : dbPath,
    dbType,
  });
});

app.get('/api/summary', async (_req, res, next) => {
  try {
    const [revenueRow, debtRow, inventoryRow, profitRow, lowStock, pendingOrders, debtCustomers] =
      await Promise.all([
        get("SELECT COALESCE(SUM(paid), 0) AS value FROM orders WHERE status != 'Đã hủy'"),
        get('SELECT COALESCE(SUM(debt), 0) AS value FROM customers'),
        get('SELECT COALESCE(SUM(stock * cost), 0) AS value FROM products'),
        get(`
          SELECT COALESCE(SUM((orders.unit_price - products.cost) * orders.quantity), 0) AS value
          FROM orders
          JOIN products ON products.id = orders.product_id
          WHERE orders.status != 'Đã hủy'
        `),
        all('SELECT * FROM products WHERE stock <= min_stock ORDER BY stock ASC'),
        all(`
          SELECT orders.*, customers.name AS customer_name, products.name AS product_name
          FROM orders
          JOIN customers ON customers.id = orders.customer_id
          JOIN products ON products.id = orders.product_id
          WHERE orders.status != 'Hoàn thành' AND orders.status != 'Đã hủy'
          ORDER BY orders.created_at DESC
          LIMIT 6
        `),
        all(`
          SELECT * FROM customers
          WHERE debt > 0
          ORDER BY debt DESC, updated_at DESC
          LIMIT 8
        `),
      ]);

    res.json({
      revenue: Number(revenueRow?.value || 0),
      debt: Number(debtRow?.value || 0),
      inventoryValue: Number(inventoryRow?.value || 0),
      profit: Number(profitRow?.value || 0),
      lowStock: lowStock.map(mapProduct),
      pendingOrders: pendingOrders.map(mapOrder),
      debtCustomers: debtCustomers.map(mapCustomer),
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/products', async (req, res, next) => {
  try {
    const keyword = cleanText(req.query.q);
    const rows = keyword
      ? await all(
          `SELECT * FROM products
           WHERE name LIKE ? OR type LIKE ? OR origin LIKE ?
           ORDER BY updated_at DESC, id DESC`,
          [`%${keyword}%`, `%${keyword}%`, `%${keyword}%`],
        )
      : await all('SELECT * FROM products ORDER BY updated_at DESC, id DESC');
    res.json(rows.map(mapProduct));
  } catch (error) {
    next(error);
  }
});

app.post('/api/products', async (req, res, next) => {
  try {
    const payload = productPayload(req.body);
    if (!payload.name) {
      res.status(400).json({ message: 'Tên mặt hàng là bắt buộc.' });
      return;
    }

    const result = await run(
      `INSERT INTO products (name, type, origin, unit, price, cost, stock, min_stock, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.name,
        payload.type,
        payload.origin,
        payload.unit,
        payload.price,
        payload.cost,
        payload.stock,
        payload.minStock,
        payload.note,
      ],
    );

    const row = await get('SELECT * FROM products WHERE id = ?', [result.id]);
    res.status(201).json(mapProduct(row));
  } catch (error) {
    next(error);
  }
});

app.put('/api/products/:id', async (req, res, next) => {
  try {
    const payload = productPayload(req.body);
    if (!payload.name) {
      res.status(400).json({ message: 'Tên mặt hàng là bắt buộc.' });
      return;
    }

    const result = await run(
      `UPDATE products
       SET name = ?, type = ?, origin = ?, unit = ?, price = ?, cost = ?,
           stock = ?, min_stock = ?, note = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        payload.name,
        payload.type,
        payload.origin,
        payload.unit,
        payload.price,
        payload.cost,
        payload.stock,
        payload.minStock,
        payload.note,
        req.params.id,
      ],
    );

    if (!result.changes) {
      res.status(404).json({ message: 'Không tìm thấy mặt hàng.' });
      return;
    }

    const row = await get('SELECT * FROM products WHERE id = ?', [req.params.id]);
    res.json(mapProduct(row));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/products/:id', async (req, res, next) => {
  try {
    const result = await run('DELETE FROM products WHERE id = ?', [req.params.id]);
    if (!result.changes) {
      res.status(404).json({ message: 'Không tìm thấy mặt hàng.' });
      return;
    }
    res.status(204).send();
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT' || error.code === '23503') {
      res.status(409).json({ message: 'Mặt hàng đã có đơn bán, không thể xóa.' });
      return;
    }
    next(error);
  }
});

app.get('/api/customers', async (req, res, next) => {
  try {
    const keyword = cleanText(req.query.q);
    const rows = keyword
      ? await all(
          `SELECT * FROM customers
           WHERE name LIKE ? OR phone LIKE ? OR address LIKE ?
           ORDER BY updated_at DESC, id DESC`,
          [`%${keyword}%`, `%${keyword}%`, `%${keyword}%`],
        )
      : await all('SELECT * FROM customers ORDER BY updated_at DESC, id DESC');
    res.json(rows.map(mapCustomer));
  } catch (error) {
    next(error);
  }
});

app.post('/api/customers', async (req, res, next) => {
  try {
    const payload = customerPayload(req.body);
    if (!payload.name) {
      res.status(400).json({ message: 'Tên khách hàng là bắt buộc.' });
      return;
    }

    const result = await run(
      `INSERT INTO customers (name, phone, address, customer_group, debt, note)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [payload.name, payload.phone, payload.address, payload.group, payload.debt, payload.note],
    );

    const row = await get('SELECT * FROM customers WHERE id = ?', [result.id]);
    res.status(201).json(mapCustomer(row));
  } catch (error) {
    next(error);
  }
});

app.put('/api/customers/:id', async (req, res, next) => {
  try {
    const payload = customerPayload(req.body);
    if (!payload.name) {
      res.status(400).json({ message: 'Tên khách hàng là bắt buộc.' });
      return;
    }

    const result = await run(
      `UPDATE customers
       SET name = ?, phone = ?, address = ?, customer_group = ?, debt = ?,
           note = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        payload.name,
        payload.phone,
        payload.address,
        payload.group,
        payload.debt,
        payload.note,
        req.params.id,
      ],
    );

    if (!result.changes) {
      res.status(404).json({ message: 'Không tìm thấy khách hàng.' });
      return;
    }

    const row = await get('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    res.json(mapCustomer(row));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/customers/:id', async (req, res, next) => {
  try {
    const result = await run('DELETE FROM customers WHERE id = ?', [req.params.id]);
    if (!result.changes) {
      res.status(404).json({ message: 'Không tìm thấy khách hàng.' });
      return;
    }
    res.status(204).send();
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT' || error.code === '23503') {
      res.status(409).json({ message: 'Khách hàng đã có đơn bán, không thể xóa.' });
      return;
    }
    next(error);
  }
});

app.post('/api/customers/:id/payments', async (req, res, next) => {
  try {
    const amount = Math.max(0, Math.round(numberValue(req.body.amount)));
    if (!amount) {
      res.status(400).json({ message: 'Số tiền thu nợ phải lớn hơn 0.' });
      return;
    }

    await run(
      `UPDATE customers
       SET debt = CASE WHEN debt - ? < 0 THEN 0 ELSE debt - ? END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [amount, amount, req.params.id],
    );

    const row = await get('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (!row) {
      res.status(404).json({ message: 'Không tìm thấy khách hàng.' });
      return;
    }
    res.json(mapCustomer(row));
  } catch (error) {
    next(error);
  }
});

app.get('/api/customers/:id/debt-contacts', async (req, res, next) => {
  try {
    const rows = await all(
      `SELECT debt_contacts.*, customers.name AS customer_name, customers.phone
       FROM debt_contacts
       JOIN customers ON customers.id = debt_contacts.customer_id
       WHERE customer_id = ?
       ORDER BY debt_contacts.created_at DESC, debt_contacts.id DESC`,
      [req.params.id],
    );
    res.json(rows.map(mapDebtContact));
  } catch (error) {
    next(error);
  }
});

app.post('/api/customers/:id/debt-contacts', async (req, res, next) => {
  try {
    const customer = await get('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (!customer) {
      res.status(404).json({ message: 'Không tìm thấy khách hàng.' });
      return;
    }

    const method = cleanText(req.body.method) || 'Gọi điện';
    const content = cleanText(req.body.content);
    const promisedDate = cleanText(req.body.promisedDate);
    const status = cleanText(req.body.status) || 'Đã liên hệ';

    const result = await run(
      `INSERT INTO debt_contacts (customer_id, method, content, promised_date, status)
       VALUES (?, ?, ?, ?, ?)`,
      [req.params.id, method, content, promisedDate, status],
    );
    const row = await get(
      `SELECT debt_contacts.*, customers.name AS customer_name, customers.phone
       FROM debt_contacts
       JOIN customers ON customers.id = debt_contacts.customer_id
       WHERE debt_contacts.id = ?`,
      [result.id],
    );
    res.status(201).json(mapDebtContact(row));
  } catch (error) {
    next(error);
  }
});

app.get('/api/debt-contacts', async (_req, res, next) => {
  try {
    const rows = await all(`
      SELECT debt_contacts.*, customers.name AS customer_name, customers.phone
      FROM debt_contacts
      JOIN customers ON customers.id = debt_contacts.customer_id
      ORDER BY debt_contacts.created_at DESC, debt_contacts.id DESC
      LIMIT 100
    `);
    res.json(rows.map(mapDebtContact));
  } catch (error) {
    next(error);
  }
});

app.get('/api/orders', async (_req, res, next) => {
  try {
    const rows = await all(`
      SELECT orders.*, customers.name AS customer_name, products.name AS product_name
      FROM orders
      JOIN customers ON customers.id = orders.customer_id
      JOIN products ON products.id = orders.product_id
      ORDER BY orders.created_at DESC, orders.id DESC
    `);
    res.json(rows.map(mapOrder));
  } catch (error) {
    next(error);
  }
});

app.post('/api/orders', async (req, res, next) => {
  try {
    const customerId = Number(req.body.customerId);
    const productId = Number(req.body.productId);
    const quantity = numberValue(req.body.quantity);
    const paid = Math.max(0, Math.round(numberValue(req.body.paid)));
    const note = cleanText(req.body.note);

    if (!customerId || !productId || quantity <= 0) {
      res.status(400).json({ message: 'Vui lòng chọn khách, mặt hàng và số lượng hợp lệ.' });
      return;
    }

    const product = await get('SELECT * FROM products WHERE id = ?', [productId]);
    const customer = await get('SELECT * FROM customers WHERE id = ?', [customerId]);

    if (!product || !customer) {
      res.status(404).json({ message: 'Không tìm thấy khách hàng hoặc mặt hàng.' });
      return;
    }

    if (quantity > product.stock) {
      res.status(409).json({ message: `Tồn kho chỉ còn ${product.stock} ${product.unit}.` });
      return;
    }

    const total = Math.round(quantity * product.price);
    const realPaid = Math.min(paid, total);
    const debt = total - realPaid;
    const code = await createOrderCode();
    const status = debt > 0 ? 'Đang giao' : 'Hoàn thành';

    await transaction(async () => {
      const result = await run(
        `INSERT INTO orders
         (code, customer_id, product_id, quantity, unit_price, total, paid, status, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [code, customerId, productId, quantity, product.price, total, realPaid, status, note],
      );

      await run(
        'UPDATE products SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [quantity, productId],
      );
      await run(
        'UPDATE customers SET debt = debt + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [debt, customerId],
      );
      return result;
    });

    const row = await get(
      `SELECT orders.*, customers.name AS customer_name, products.name AS product_name
       FROM orders
       JOIN customers ON customers.id = orders.customer_id
       JOIN products ON products.id = orders.product_id
       WHERE orders.code = ?`,
      [code],
    );
    res.status(201).json(mapOrder(row));
  } catch (error) {
    next(error);
  }
});

app.put('/api/orders/:id/status', async (req, res, next) => {
  try {
    const nextStatus = cleanText(req.body.status) || 'Đang giao';
    
    // 1. Lấy thông tin đơn hàng hiện tại
    const order = await get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) {
      res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
      return;
    }

    // 2. Nếu trạng thái cũ đã là 'Đã hủy', khóa không cho phép thay đổi nữa
    if (order.status === 'Đã hủy') {
      res.status(400).json({ message: 'Đơn hàng đã hủy không thể thay đổi trạng thái.' });
      return;
    }

    // 3. Nếu trạng thái mới trùng với trạng thái cũ, trả về thông tin luôn
    if (order.status === nextStatus) {
      const row = await get(
        `SELECT orders.*, customers.name AS customer_name, products.name AS product_name
         FROM orders
         JOIN customers ON customers.id = orders.customer_id
         JOIN products ON products.id = orders.product_id
         WHERE orders.id = ?`,
        [req.params.id],
      );
      res.json(mapOrder(row));
      return;
    }

    // 4. Thực hiện nghiệp vụ cập nhật trạng thái trong Transaction để đảm bảo tính đồng bộ dữ liệu
    await transaction(async () => {
      if (nextStatus === 'Hoàn thành') {
        const unpaid = Math.max(order.total - order.paid, 0);
        
        // Cập nhật đơn hàng thành Hoàn thành và đã thu đủ tiền
        await run('UPDATE orders SET status = ?, paid = total, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [nextStatus, req.params.id]);
        
        // Giảm trừ nợ của khách hàng tương ứng với phần chưa thanh toán của đơn này
        if (unpaid > 0) {
          await run('UPDATE customers SET debt = debt - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [unpaid, order.customer_id]);
        }
      } else if (nextStatus === 'Đã hủy') {
        const unpaid = Math.max(order.total - order.paid, 0);

        // Trả lại tồn kho của sản phẩm
        await run('UPDATE products SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [order.quantity, order.product_id]);

        // Giảm trừ phần công nợ mà đơn hàng này đã cộng vào tài khoản khách hàng (chỉ phần chưa thanh toán)
        if (unpaid > 0) {
          await run('UPDATE customers SET debt = debt - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [unpaid, order.customer_id]);
        }

        // Cập nhật trạng thái đơn thành Đã hủy, và reset số tiền đã thanh toán của đơn này về 0 (để trừ khỏi doanh thu thực tế)
        await run('UPDATE orders SET status = ?, paid = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [nextStatus, req.params.id]);
      } else {
        // Các trạng thái khác (ví dụ: Đang giao)
        await run('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [nextStatus, req.params.id]);
      }
    });

    // 5. Lấy lại thông tin đơn hàng sau cập nhật kèm tên khách và tên sản phẩm để phản hồi
    const row = await get(
      `SELECT orders.*, customers.name AS customer_name, products.name AS product_name
       FROM orders
       JOIN customers ON customers.id = orders.customer_id
       JOIN products ON products.id = orders.product_id
       WHERE orders.id = ?`,
      [req.params.id],
    );
    res.json(mapOrder(row));
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: 'Máy chủ gặp lỗi, vui lòng thử lại.' });
});

initDatabase()
  .then(() => {
    app.listen(port, '0.0.0.0', () => {
      console.log(`RiceHub API listening on http://localhost:${port}`);
      console.log(`SQLite database: ${dbPath}`);
    });
  })
  .catch((error) => {
    console.error('Cannot initialize database:', error);
    close();
    process.exit(1);
  });
