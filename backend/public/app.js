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

// Custom Alert/Confirm System
const showCustomDialog = ({ title, message, isConfirm = false }) => {
  return new Promise((resolve) => {
    const dialog = qs('#custom-alert-dialog');
    const titleEl = qs('#dialog-title');
    const msgEl = qs('#dialog-message');
    const iconEl = qs('#dialog-icon');
    const cancelBtn = qs('#dialog-btn-cancel');
    const confirmBtn = qs('#dialog-btn-confirm');

    titleEl.textContent = title;
    msgEl.textContent = message;

    // Set colors & icons based on title/actions
    const isDanger = title.includes('Xóa') || title.includes('Hủy');
    if (isDanger) {
      qs('.dialog-icon-wrapper').style.backgroundColor = '#fdebeb';
      iconEl.style.color = '#bf3f2f';
      iconEl.innerHTML = `<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>`;
      confirmBtn.className = 'btn btn-primary btn-danger';
    } else {
      qs('.dialog-icon-wrapper').style.backgroundColor = '#f1f5ef';
      iconEl.style.color = '#24372b';
      iconEl.innerHTML = `<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>`;
      confirmBtn.className = 'btn btn-primary';
    }

    if (isConfirm) {
      cancelBtn.style.display = 'block';
    } else {
      cancelBtn.style.display = 'none';
    }

    dialog.classList.remove('hidden');

    const handleConfirm = () => {
      dialog.classList.add('hidden');
      cleanup();
      resolve(true);
    };

    const handleCancel = () => {
      dialog.classList.add('hidden');
      cleanup();
      resolve(false);
    };

    const cleanup = () => {
      confirmBtn.removeEventListener('click', handleConfirm);
      cancelBtn.removeEventListener('click', handleCancel);
    };

    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
  });
};

// Override standard alert so it looks premium!
window.alert = (message) => {
  showCustomDialog({ title: 'Thông báo', message, isConfirm: false });
};

window.showConfirmAsync = (title, message) => {
  return showCustomDialog({ title, message, isConfirm: true });
};


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
  
  qs('#debt-customers').innerHTML = state.summary?.debtCustomers?.length
    ? state.summary.debtCustomers.map((item) => `
      <div class="list-item">
        <div class="list-item-content">
          <span class="list-item-title">${html(item.name)}</span>
          <span class="list-item-details">${html(item.phone || 'Chưa có SĐT')}</span>
        </div>
        <span class="list-item-value debt-amount">${money.format(item.debt)}</span>
      </div>
    `).join('')
    : '<p class="muted-text">Chưa có khách nợ công nợ.</p>';
  
  qs('#low-stock').innerHTML = state.summary?.lowStock?.length
    ? state.summary.lowStock.map((item) => `
      <div class="list-item">
        <div class="list-item-content">
          <span class="list-item-title">${html(item.name)}</span>
          <span class="list-item-details">Hạn mức cảnh báo: ${item.minStock} ${html(item.unit)}</span>
        </div>
        <span class="list-item-value stock-amount">${item.stock} ${html(item.unit)}</span>
      </div>
    `).join('')
    : '<p class="muted-text">Kho hàng đầy đủ, không có hàng sắp hết.</p>';
}

function renderProducts() {
  qs('#products-list').innerHTML = state.products.length
    ? state.products.map((item) => `
      <article class="card">
        <div class="card-head">
          <div class="card-title-block">
            <h3>${html(item.name)}</h3>
            <p class="card-subtitle-block">${html(item.type || 'Chưa phân loại')} · ${html(item.origin || 'Chưa có xuất xứ')}</p>
          </div>
          <strong class="card-price">${money.format(item.price)}</strong>
        </div>
        <div class="card-body-text">
          <strong>Đơn vị:</strong> ${html(item.unit)} &nbsp;&middot;&nbsp; 
          <strong>Giá vốn:</strong> ${money.format(item.cost)} &nbsp;&middot;&nbsp; 
          <strong>Tồn kho:</strong> <span class="badge ${item.stock <= item.minStock ? 'danger' : 'success'}">${item.stock} / ${item.minStock} ${html(item.unit)}</span>
        </div>
        ${item.note ? `<p class="card-note">${html(item.note)}</p>` : ''}
        <div class="actions">
          <button class="ghost" onclick="editProduct(${item.id})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            <span>Sửa</span>
          </button>
          <button class="ghost danger" onclick="deleteProduct(${item.id})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            <span>Xóa</span>
          </button>
        </div>
      </article>
    `).join('')
    : '<p class="muted-text">Chưa có mặt hàng nào trong danh sách.</p>';
}

function renderCustomers() {
  qs('#customers-list').innerHTML = state.customers.length
    ? state.customers.map((item) => `
      <article class="card">
        <div class="card-head">
          <div class="card-title-block">
            <h3>${html(item.name)}</h3>
            <p class="card-subtitle-block">
              <span class="badge info">${html(item.group)}</span> 
              ${item.phone ? `· ${html(item.phone)}` : '· Chưa có SĐT'}
            </p>
          </div>
          <strong class="card-price debt-amount">${money.format(item.debt)}</strong>
        </div>
        <div class="card-body-text">
          <strong>Địa chỉ:</strong> ${html(item.address || 'Chưa cập nhật địa chỉ')}
        </div>
        ${item.note ? `<p class="card-note">${html(item.note)}</p>` : ''}
        <div class="actions">
          <button class="ghost" style="color: var(--primary); border-color: var(--primary-light); background: var(--primary-light);" onclick="payCustomerDebt(${item.id})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            <span>Thu nợ</span>
          </button>
          ${item.phone ? `
            <a class="ghost" href="tel:${html(item.phone)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              <span>Gọi</span>
            </a>
            <a class="ghost" href="sms:${html(item.phone)}?body=${encodeURIComponent('Chào anh/chị, cửa hàng gạo xin nhắc công nợ hiện tại là ' + money.format(item.debt) + '. Anh/chị vui lòng thanh toán giúp em nhé.')}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span>SMS</span>
            </a>
          ` : ''}
          <button class="ghost" onclick="editCustomer(${item.id})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            <span>Sửa</span>
          </button>
          <button class="ghost danger" onclick="deleteCustomer(${item.id})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            <span>Xóa</span>
          </button>
        </div>
      </article>
    `).join('')
    : '<p class="muted-text">Chưa có khách hàng nào trong danh sách.</p>';
}

function renderOrders() {
  qs('#orders-list').innerHTML = state.orders.length
    ? state.orders.map((item) => {
        const unpaid = Math.max(item.total - item.paid, 0);
        const isDone = unpaid <= 0 || item.status === 'Hoàn thành';
        return `
          <article class="card">
            <div class="card-head">
              <div class="card-title-block">
                <h3>Mã đơn: ${html(item.code)}</h3>
                <p class="card-subtitle-block">
                  <strong>Khách hàng:</strong> ${html(item.customerName)}
                </p>
              </div>
              <strong class="card-price">${money.format(item.total)}</strong>
            </div>
            <div class="card-body-text">
              <strong>Sản phẩm:</strong> ${html(item.productName)} &nbsp;&middot;&nbsp; <strong>Số lượng:</strong> ${item.quantity} kg<br/>
              <strong>Đã thu:</strong> ${money.format(item.paid)} &nbsp;&middot;&nbsp; 
              <strong>Còn nợ:</strong> <span class="${unpaid > 0 ? 'debt-amount font-bold' : 'text-success'}">${money.format(unpaid)}</span>
            </div>
            <div style="margin-top: 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <span class="badge ${isDone ? 'success' : 'warning'}">${html(item.status)}</span>
              ${!isDone ? `
                <button class="ghost" onclick="markOrderDone(${item.id})" style="font-size: 12px; height: 30px; border-color: var(--primary);">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 12px; height: 12px; color: var(--primary);"><polyline points="20 6 9 17 4 12"/></svg>
                  <span style="color: var(--primary);">Thu đủ nợ</span>
                </button>
              ` : ''}
            </div>
            ${item.note ? `<p class="card-note" style="margin-top: 10px;">${html(item.note)}</p>` : ''}
          </article>
        `;
      }).join('')
    : '<p class="muted-text">Chưa có đơn hàng nào.</p>';
}

function renderDebtContacts() {
  qs('#contacts-list').innerHTML = state.contacts.length
    ? state.contacts.map((item) => `
      <div class="list-item">
        <div class="list-item-content">
          <span class="list-item-title">${html(item.customerName)}</span>
          <span class="list-item-details">
            <strong>Hình thức:</strong> ${html(item.method)} · 
            <strong>Nội dung:</strong> ${html(item.content || 'Không có ghi chú')}
          </span>
          ${item.promisedDate ? `
            <span class="list-item-details" style="color: var(--accent-hover); font-weight: 600; display: inline-flex; align-items: center; gap: 4px; margin-top: 4px;">
              📅 Hẹn trả: ${html(item.promisedDate)}
            </span>
          ` : ''}
        </div>
        <span class="badge info">${html(item.status)}</span>
      </div>
    `).join('')
    : '<p class="muted-text">Chưa có lịch sử liên hệ thu nợ nào.</p>';
}

function fillSelects() {
  document.querySelectorAll('select[name="customerId"]').forEach((select) => {
    select.innerHTML = state.customers.map((item) => `<option value="${item.id}">${html(item.name)} · Nợ: ${money.format(item.debt)}</option>`).join('');
  });
  document.querySelectorAll('select[name="productId"]').forEach((select) => {
    select.innerHTML = state.products.map((item) => `<option value="${item.id}">${html(item.name)} · Tồn: ${item.stock} ${html(item.unit)}</option>`).join('');
  });
}

window.payCustomerDebt = async (id) => {
  const customer = state.customers.find((c) => c.id === id);
  if (!customer) return;
  const amountStr = prompt(`Nhập số tiền ${html(customer.name)} thanh toán (Đang nợ: ${money.format(customer.debt)}):`);
  if (amountStr === null) return;
  const amount = parseInt(amountStr.replace(/[^0-9]/g, ''), 10);
  if (isNaN(amount) || amount <= 0) {
    alert('Số tiền nhập không hợp lệ!');
    return;
  }
  try {
    await api.send(`/api/customers/${id}/payments`, 'POST', { amount });
    await loadAll();
  } catch (error) {
    alert(error.message);
  }
};

window.markOrderDone = async (id) => {
  if (!(await window.showConfirmAsync('Xác nhận hoàn thành đơn', 'Xác nhận thu đủ nợ và hoàn thành đơn hàng này?'))) return;
  try {
    const order = state.orders.find((o) => o.id === id);
    if (!order) return;
    const unpaid = Math.max(order.total - order.paid, 0);
    
    // 1. Cập nhật trạng thái đơn hàng thành 'Hoàn thành'
    await api.send(`/api/orders/${id}/status`, 'PUT', { status: 'Hoàn thành' });
    
    // 2. Đồng thời giảm trừ nợ của khách hàng đó
    if (unpaid > 0) {
      await api.send(`/api/customers/${order.customerId}/payments`, 'POST', { amount: unpaid });
    }
    
    await loadAll();
  } catch (error) {
    alert(error.message);
  }
};

window.editProduct = (id) => {
  const item = state.products.find((product) => product.id === id);
  const form = qs('#product-form');
  Object.entries(item).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value;
  });
  form.dataset.id = id;
  // Scroll to form and focus
  form.scrollIntoView({ behavior: 'smooth' });
  form.elements.name.focus();
};

window.editCustomer = (id) => {
  const item = state.customers.find((customer) => customer.id === id);
  const form = qs('#customer-form');
  Object.entries(item).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value;
  });
  form.dataset.id = id;
  // Scroll to form and focus
  form.scrollIntoView({ behavior: 'smooth' });
  form.elements.name.focus();
};

window.deleteProduct = async (id) => {
  if (!(await window.showConfirmAsync('Xóa mặt hàng', 'Bạn có chắc chắn muốn xóa mặt hàng này?'))) return;
  try {
    await api.delete(`/api/products/${id}`);
    await loadAll();
  } catch (error) {
    alert(error.message);
  }
};

window.deleteCustomer = async (id) => {
  if (!(await window.showConfirmAsync('Xóa khách hàng', 'Bạn có chắc chắn muốn xóa khách hàng này?'))) return;
  try {
    await api.delete(`/api/customers/${id}`);
    await loadAll();
  } catch (error) {
    alert(error.message);
  }
};

document.querySelectorAll('.nav').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.nav, .view').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    qs(`#${button.dataset.view}`).classList.add('active');
    qs('#page-title').textContent = button.querySelector('span').textContent;
  });
});

qs('#refresh').addEventListener('click', async () => {
  const btn = qs('#refresh');
  btn.style.pointerEvents = 'none';
  btn.style.opacity = '0.7';
  btn.querySelector('span').textContent = 'Đang làm mới...';
  try {
    await loadAll();
  } catch (error) {
    alert(error.message);
  } finally {
    btn.style.pointerEvents = 'auto';
    btn.style.opacity = '1';
    btn.querySelector('span').textContent = 'Làm mới dữ liệu';
  }
});

qs('#product-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const body = formData(form);
  const id = form.dataset.id;
  try {
    await api.send(id ? `/api/products/${id}` : '/api/products', id ? 'PUT' : 'POST', body);
    form.reset();
    form.elements.unit.value = 'kg';
    delete form.dataset.id;
    await loadAll();
  } catch (error) {
    alert(error.message);
  }
});

qs('#customer-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const body = formData(form);
  const id = form.dataset.id;
  try {
    await api.send(id ? `/api/customers/${id}` : '/api/customers', id ? 'PUT' : 'POST', body);
    form.reset();
    form.elements.group.value = 'Khách lẻ';
    delete form.dataset.id;
    await loadAll();
  } catch (error) {
    alert(error.message);
  }
});

qs('#order-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await api.send('/api/orders', 'POST', formData(event.currentTarget));
    event.currentTarget.reset();
    await loadAll();
  } catch (error) {
    alert(error.message);
  }
});

qs('#contact-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const body = formData(event.currentTarget);
  try {
    await api.send(`/api/customers/${body.customerId}/debt-contacts`, 'POST', body);
    event.currentTarget.reset();
    await loadAll();
  } catch (error) {
    alert(error.message);
  }
});

loadAll().catch((error) => alert(error.message));
