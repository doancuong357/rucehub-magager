const money = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

const state = {
  products: [],
  customers: [],
  orders: [],
  contacts: [],
  summary: null,
};

const api = {
  async get(path) {
    return fetch(path).then(handleResponse);
  },
  async send(path, method, body) {
    return fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(handleResponse);
  },
  async delete(path) {
    return fetch(path, { method: 'DELETE' }).then(handleResponse);
  },
};

async function handleResponse(response) {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || 'Không thể xử lý yêu cầu.');
  }
  return response.status === 204 ? null : response.json();
}

function qs(selector) {
  return document.querySelector(selector);
}

function html(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[char]);
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

async function loadAll() {
  [state.summary, state.products, state.customers, state.orders, state.contacts] = await Promise.all([
    api.get('/api/summary'),
    api.get('/api/products'),
    api.get('/api/customers'),
    api.get('/api/orders'),
    api.get('/api/debt-contacts'),
  ]);
  render();
}

function render() {
  renderDashboard();
  renderProducts();
  renderCustomers();
  renderOrders();
  renderDebtContacts();
  fillSelects();
}

function renderDashboard() {
  qs('#m-revenue').textContent = money.format(state.summary?.revenue || 0);
  qs('#m-debt').textContent = money.format(state.summary?.debt || 0);
  qs('#m-stock').textContent = money.format(state.summary?.inventoryValue || 0);
  qs('#m-profit').textContent = money.format(state.summary?.profit || 0);
  qs('#debt-customers').innerHTML = listHtml(
    state.summary?.debtCustomers || [],
    (item) => `${html(item.name)}<span>${html(item.phone)} · ${money.format(item.debt)}</span>`,
    'Chưa có khách nợ.',
  );
  qs('#low-stock').innerHTML = listHtml(
    state.summary?.lowStock || [],
    (item) => `${html(item.name)}<span>Còn ${item.stock} ${html(item.unit)}</span>`,
    'Không có hàng sắp hết.',
  );
}

function renderProducts() {
  qs('#products-list').innerHTML = state.products.length
    ? state.products.map((item) => `
      <article class="card">
        <div class="card-head">
          <div>
            <h3>${html(item.name)}</h3>
            <p>${html(item.type || 'Chưa phân loại')} · ${html(item.origin || 'Chưa có xuất xứ')}</p>
          </div>
          <strong>${money.format(item.price)}</strong>
        </div>
        <p>Tồn kho: ${item.stock} ${html(item.unit)} · Giá vốn: ${money.format(item.cost)}</p>
        <p>${html(item.note || '')}</p>
        <div class="actions">
          <button class="ghost" onclick="editProduct(${item.id})">Sửa</button>
          <button class="ghost danger" onclick="deleteProduct(${item.id})">Xóa</button>
        </div>
      </article>
    `).join('')
    : '<p class="muted">Chưa có mặt hàng.</p>';
}

function renderCustomers() {
  qs('#customers-list').innerHTML = state.customers.length
    ? state.customers.map((item) => `
      <article class="card">
        <div class="card-head">
          <div>
            <h3>${html(item.name)}</h3>
            <p>${html(item.group)} · ${html(item.phone || 'Chưa có số điện thoại')}</p>
          </div>
          <strong>${money.format(item.debt)}</strong>
        </div>
        <p>${html(item.address || 'Chưa có địa chỉ')}</p>
        <div class="actions">
          <a class="ghost" href="tel:${html(item.phone)}">Gọi</a>
          <a class="ghost" href="sms:${html(item.phone)}?body=${encodeURIComponent('Chào anh/chị, cửa hàng gạo xin nhắc công nợ hiện tại là ' + money.format(item.debt) + '. Anh/chị vui lòng thanh toán giúp em nhé.')}">SMS</a>
          <button class="ghost" onclick="editCustomer(${item.id})">Sửa</button>
          <button class="ghost danger" onclick="deleteCustomer(${item.id})">Xóa</button>
        </div>
      </article>
    `).join('')
    : '<p class="muted">Chưa có khách hàng.</p>';
}

function renderOrders() {
  qs('#orders-list').innerHTML = state.orders.length
    ? state.orders.map((item) => `
      <article class="card">
        <div class="card-head">
          <div>
            <h3>${html(item.code)} · ${html(item.customerName)}</h3>
            <p>${html(item.productName)} · ${item.quantity} kg · ${html(item.status)}</p>
          </div>
          <strong>${money.format(item.total)}</strong>
        </div>
        <p>Đã thu: ${money.format(item.paid)} · Còn nợ: ${money.format(Math.max(item.total - item.paid, 0))}</p>
      </article>
    `).join('')
    : '<p class="muted">Chưa có đơn bán.</p>';
}

function renderDebtContacts() {
  qs('#contacts-list').innerHTML = listHtml(
    state.contacts,
    (item) => `${html(item.customerName)}<span>${html(item.method)} · ${html(item.content || 'Không có ghi chú')} · Hẹn: ${html(item.promisedDate || 'chưa có')}</span>`,
    'Chưa có lịch sử liên hệ.',
  );
}

function listHtml(items, renderer, empty) {
  return items.length
    ? items.map((item) => `<div class="list-item"><strong>${renderer(item)}</strong></div>`).join('')
    : `<p class="muted">${empty}</p>`;
}

function fillSelects() {
  document.querySelectorAll('select[name="customerId"]').forEach((select) => {
    select.innerHTML = state.customers.map((item) => `<option value="${item.id}">${html(item.name)} · ${money.format(item.debt)}</option>`).join('');
  });
  document.querySelectorAll('select[name="productId"]').forEach((select) => {
    select.innerHTML = state.products.map((item) => `<option value="${item.id}">${html(item.name)} · ${item.stock} ${html(item.unit)}</option>`).join('');
  });
}

window.editProduct = (id) => {
  const item = state.products.find((product) => product.id === id);
  const form = qs('#product-form');
  Object.entries(item).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value;
  });
  form.dataset.id = id;
};

window.editCustomer = (id) => {
  const item = state.customers.find((customer) => customer.id === id);
  const form = qs('#customer-form');
  Object.entries(item).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value;
  });
  form.dataset.id = id;
};

window.deleteProduct = async (id) => {
  if (!confirm('Xóa mặt hàng này?')) return;
  await api.delete(`/api/products/${id}`);
  await loadAll();
};

window.deleteCustomer = async (id) => {
  if (!confirm('Xóa khách hàng này?')) return;
  await api.delete(`/api/customers/${id}`);
  await loadAll();
};

document.querySelectorAll('.nav').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.nav, .view').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    qs(`#${button.dataset.view}`).classList.add('active');
    qs('#page-title').textContent = button.textContent;
  });
});

qs('#refresh').addEventListener('click', loadAll);

qs('#product-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const body = formData(form);
  const id = form.dataset.id;
  await api.send(id ? `/api/products/${id}` : '/api/products', id ? 'PUT' : 'POST', body);
  form.reset();
  form.elements.unit.value = 'kg';
  delete form.dataset.id;
  await loadAll();
});

qs('#customer-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const body = formData(form);
  const id = form.dataset.id;
  await api.send(id ? `/api/customers/${id}` : '/api/customers', id ? 'PUT' : 'POST', body);
  form.reset();
  form.elements.group.value = 'Khách lẻ';
  delete form.dataset.id;
  await loadAll();
});

qs('#order-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  await api.send('/api/orders', 'POST', formData(event.currentTarget));
  event.currentTarget.reset();
  await loadAll();
});

qs('#contact-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const body = formData(event.currentTarget);
  await api.send(`/api/customers/${body.customerId}/debt-contacts`, 'POST', body);
  event.currentTarget.reset();
  await loadAll();
});

loadAll().catch((error) => alert(error.message));
