import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  NativeModules,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const money = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

const emptyProduct = {
  name: '',
  type: '',
  origin: '',
  unit: 'kg',
  price: '',
  cost: '',
  stock: '',
  minStock: '',
  note: '',
};

const emptyCustomer = {
  name: '',
  phone: '',
  address: '',
  group: 'Khách lẻ',
  debt: '',
  note: '',
};

const emptyOrder = {
  customerId: '',
  productId: '',
  quantity: '',
  paid: '',
  note: '',
};

const tabs = [
  { id: 'home', label: 'Tổng quan', icon: 'view-dashboard-outline' },
  { id: 'products', label: 'Mặt hàng', icon: 'rice' },
  { id: 'orders', label: 'Bán hàng', icon: 'cart-outline' },
  { id: 'customers', label: 'Khách hàng', icon: 'account-group-outline' },
  { id: 'reports', label: 'Báo cáo', icon: 'chart-box-outline' },
];

function getDefaultApiUrl() {
  if (Platform.OS === 'web') {
    return 'http://localhost:4000';
  }

  const scriptUrl = NativeModules?.SourceCode?.scriptURL;
  const host = scriptUrl?.match(/https?:\/\/([^:/]+)/)?.[1];
  return host ? `http://${host}:4000` : 'http://localhost:4000';
}

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [apiUrl, setApiUrl] = useState(getDefaultApiUrl());
  const [apiInput, setApiInput] = useState(getDefaultApiUrl());
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchProduct, setSearchProduct] = useState('');
  const [searchCustomer, setSearchCustomer] = useState('');
  const [productModal, setProductModal] = useState({ visible: false, product: null });
  const [customerModal, setCustomerModal] = useState({ visible: false, customer: null });
  const [paymentCustomer, setPaymentCustomer] = useState(null);
  const [orderModal, setOrderModal] = useState(false);
  const [apiModal, setApiModal] = useState(false);

  const request = useCallback(
    async (path, options = {}) => {
      const response = await fetch(`${apiUrl}${path}`, {
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        ...options,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || 'Không thể kết nối máy chủ.');
      }

      if (response.status === 204) {
        return null;
      }

      return response.json();
    },
    [apiUrl],
  );

  const loadData = useCallback(async () => {
    setError('');
    const [nextSummary, nextProducts, nextCustomers, nextOrders] = await Promise.all([
      request('/api/summary'),
      request('/api/products'),
      request('/api/customers'),
      request('/api/orders'),
    ]);
    setSummary(nextSummary);
    setProducts(nextProducts);
    setCustomers(nextCustomers);
    setOrders(nextOrders);
  }, [request]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    loadData()
      .catch((nextError) => {
        if (mounted) setError(nextError.message);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [loadData]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadData();
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setRefreshing(false);
    }
  }, [loadData]);

  const filteredProducts = useMemo(() => {
    const keyword = searchProduct.trim().toLowerCase();
    if (!keyword) return products;
    return products.filter((item) =>
      `${item.name} ${item.type} ${item.origin}`.toLowerCase().includes(keyword),
    );
  }, [products, searchProduct]);

  const filteredCustomers = useMemo(() => {
    const keyword = searchCustomer.trim().toLowerCase();
    if (!keyword) return customers;
    return customers.filter((item) =>
      `${item.name} ${item.phone} ${item.address}`.toLowerCase().includes(keyword),
    );
  }, [customers, searchCustomer]);

  async function saveProduct(form, editingId) {
    await request(editingId ? `/api/products/${editingId}` : '/api/products', {
      method: editingId ? 'PUT' : 'POST',
      body: JSON.stringify({
        ...form,
        price: Number(form.price) || 0,
        cost: Number(form.cost) || 0,
        stock: Number(form.stock) || 0,
        minStock: Number(form.minStock) || 0,
      }),
    });
    setProductModal({ visible: false, product: null });
    await refresh();
  }

  async function saveCustomer(form, editingId) {
    await request(editingId ? `/api/customers/${editingId}` : '/api/customers', {
      method: editingId ? 'PUT' : 'POST',
      body: JSON.stringify({
        ...form,
        debt: Number(form.debt) || 0,
      }),
    });
    setCustomerModal({ visible: false, customer: null });
    await refresh();
  }

  async function createOrder(form) {
    await request('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        ...form,
        customerId: Number(form.customerId),
        productId: Number(form.productId),
        quantity: Number(form.quantity) || 0,
        paid: Number(form.paid) || 0,
      }),
    });
    setOrderModal(false);
    await refresh();
  }

  async function deleteProduct(product) {
    Alert.alert('Xóa mặt hàng', `Bạn muốn xóa "${product.name}"?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          try {
            await request(`/api/products/${product.id}`, { method: 'DELETE' });
            await refresh();
          } catch (nextError) {
            Alert.alert('Không thể xóa', nextError.message);
          }
        },
      },
    ]);
  }

  async function deleteCustomer(customer) {
    Alert.alert('Xóa khách hàng', `Bạn muốn xóa "${customer.name}"?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          try {
            await request(`/api/customers/${customer.id}`, { method: 'DELETE' });
            await refresh();
          } catch (nextError) {
            Alert.alert('Không thể xóa', nextError.message);
          }
        },
      },
    ]);
  }

  async function payDebt(customer, amount) {
    await request(`/api/customers/${customer.id}/payments`, {
      method: 'POST',
      body: JSON.stringify({ amount: Number(amount) || 0 }),
    });
    setPaymentCustomer(null);
    await refresh();
  }

  async function recordDebtContact(customer, method, content) {
    try {
      await request(`/api/customers/${customer.id}/debt-contacts`, {
        method: 'POST',
        body: JSON.stringify({ method, content, status: 'Đã liên hệ' }),
      });
      await refresh();
    } catch (nextError) {
      Alert.alert('Không ghi được lịch sử liên hệ', nextError.message);
    }
  }

  async function callCustomer(customer) {
    if (!customer.phone) {
      Alert.alert('Thiếu số điện thoại', 'Khách hàng này chưa có số điện thoại.');
      return;
    }
    await recordDebtContact(customer, 'Gọi điện', `Gọi nhắc công nợ ${money.format(customer.debt)}.`);
    Linking.openURL(`tel:${customer.phone}`);
  }

  async function smsCustomer(customer) {
    if (!customer.phone) {
      Alert.alert('Thiếu số điện thoại', 'Khách hàng này chưa có số điện thoại.');
      return;
    }
    const message = `Chào anh/chị ${customer.name}, cửa hàng gạo xin nhắc công nợ hiện tại là ${money.format(customer.debt)}. Anh/chị vui lòng thanh toán giúp em nhé.`;
    await recordDebtContact(customer, 'SMS', message);
    Linking.openURL(`sms:${customer.phone}?body=${encodeURIComponent(message)}`);
  }

  async function updateOrderStatus(order, status) {
    try {
      await request(`/api/orders/${order.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      await refresh();
    } catch (nextError) {
      Alert.alert('Không thể cập nhật đơn', nextError.message);
    }
  }

  const hasData = products.length || customers.length || orders.length;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.brandIcon}>
            <MaterialCommunityIcons name="rice" size={25} color="#24372b" />
          </View>
          <View>
            <Text style={styles.kicker}>RiceHub Manager</Text>
            <Text style={styles.title}>Quản lí bán gạo</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.headerButton} onPress={() => setApiModal(true)}>
          <MaterialCommunityIcons name="server-network" size={21} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroller}>
        <View style={styles.tabs}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, activeTab === tab.id && styles.tabActive]}
              onPress={() => setActiveTab(tab.id)}
            >
              <MaterialCommunityIcons
                name={tab.icon}
                size={18}
                color={activeTab === tab.id ? '#24372b' : '#d8e5d1'}
              />
              <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#24372b" />
          <Text style={styles.centerText}>Đang kết nối dữ liệu...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          showsVerticalScrollIndicator={false}
        >
          {error ? <ConnectionBanner error={error} apiUrl={apiUrl} onPress={() => setApiModal(true)} /> : null}

          {activeTab === 'home' && (
            <HomeTab
              summary={summary}
              hasData={hasData}
              onAddProduct={() => setProductModal({ visible: true, product: null })}
              onAddCustomer={() => setCustomerModal({ visible: true, customer: null })}
              onCreateOrder={() => setOrderModal(true)}
            />
          )}

          {activeTab === 'products' && (
            <ProductsTab
              products={filteredProducts}
              search={searchProduct}
              onSearch={setSearchProduct}
              onAdd={() => setProductModal({ visible: true, product: null })}
              onEdit={(product) => setProductModal({ visible: true, product })}
              onDelete={deleteProduct}
            />
          )}

          {activeTab === 'orders' && (
            <OrdersTab
              orders={orders}
              products={products}
              customers={customers}
              onCreate={() => setOrderModal(true)}
              onDone={(order) => updateOrderStatus(order, 'Hoàn thành')}
              onCancel={(order) => updateOrderStatus(order, 'Đã hủy')}
            />
          )}

          {activeTab === 'customers' && (
            <CustomersTab
              customers={filteredCustomers}
              search={searchCustomer}
              onSearch={setSearchCustomer}
              onAdd={() => setCustomerModal({ visible: true, customer: null })}
              onEdit={(customer) => setCustomerModal({ visible: true, customer })}
              onDelete={deleteCustomer}
              onPay={setPaymentCustomer}
              onCall={callCustomer}
              onSms={smsCustomer}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsTab summary={summary} products={products} customers={customers} orders={orders} />
          )}
        </ScrollView>
      )}

      <ProductModal
        visible={productModal.visible}
        product={productModal.product}
        onClose={() => setProductModal({ visible: false, product: null })}
        onSave={saveProduct}
      />
      <CustomerModal
        visible={customerModal.visible}
        customer={customerModal.customer}
        onClose={() => setCustomerModal({ visible: false, customer: null })}
        onSave={saveCustomer}
      />
      <OrderModal
        visible={orderModal}
        products={products}
        customers={customers}
        onClose={() => setOrderModal(false)}
        onSave={createOrder}
      />
      <PaymentModal
        visible={!!paymentCustomer}
        customer={paymentCustomer}
        onClose={() => setPaymentCustomer(null)}
        onSave={payDebt}
      />
      <ApiModal
        visible={apiModal}
        apiUrl={apiInput}
        onChange={setApiInput}
        onClose={() => setApiModal(false)}
        onSave={() => {
          setApiUrl(apiInput.replace(/\/$/, ''));
          setApiModal(false);
        }}
      />
    </SafeAreaView>
  );
}

function HomeTab({ summary, hasData, onAddProduct, onAddCustomer, onCreateOrder }) {
  return (
    <>
      <View style={styles.metricsGrid}>
        <MetricCard icon="cash-register" label="Doanh thu đã thu" value={money.format(summary?.revenue || 0)} tone="green" />
        <MetricCard icon="account-cash-outline" label="Công nợ cần thu" value={money.format(summary?.debt || 0)} tone="red" />
        <MetricCard icon="warehouse" label="Giá trị tồn kho" value={money.format(summary?.inventoryValue || 0)} tone="blue" />
        <MetricCard icon="chart-line" label="Lợi nhuận ước tính" value={money.format(summary?.profit || 0)} tone="gold" />
      </View>

      {!hasData ? (
        <EmptyState
          icon="database-plus-outline"
          title="Chưa có dữ liệu"
          text="Database đang trống. Hãy thêm mặt hàng và khách hàng đầu tiên để bắt đầu bán hàng."
        />
      ) : null}

      <View style={styles.quickGrid}>
        <ActionTile icon="rice" label="Thêm mặt hàng" onPress={onAddProduct} />
        <ActionTile icon="account-plus-outline" label="Thêm khách" onPress={onAddCustomer} />
        <ActionTile icon="cart-plus" label="Tạo đơn bán" onPress={onCreateOrder} />
      </View>

      <SectionTitle title="Cần xử lý" subtitle="Đơn chưa hoàn thành và mặt hàng chạm ngưỡng tồn kho" />
      {(summary?.pendingOrders || []).map((order) => (
        <OrderRow key={order.id} order={order} />
      ))}
      {(summary?.lowStock || []).map((product) => (
        <InventoryAlert key={product.id} product={product} />
      ))}
      {!summary?.pendingOrders?.length && !summary?.lowStock?.length ? (
        <InfoLine icon="check-circle-outline" text="Không có cảnh báo cần xử lý." />
      ) : null}
    </>
  );
}

function ProductsTab({ products, search, onSearch, onAdd, onEdit, onDelete }) {
  return (
    <>
      <Toolbar
        title="Mặt hàng gạo"
        subtitle="Thêm, sửa, xóa mặt hàng và quản lí tồn kho"
        icon="plus"
        buttonLabel="Thêm"
        onPress={onAdd}
      />
      <SearchBox value={search} onChangeText={onSearch} placeholder="Tìm theo tên, loại gạo hoặc xuất xứ" />
      {products.length ? (
        products.map((product) => (
          <ProductCard key={product.id} product={product} onEdit={onEdit} onDelete={onDelete} />
        ))
      ) : (
        <EmptyState icon="rice-off" title="Chưa có mặt hàng" text="Bấm Thêm để tạo mặt hàng gạo đầu tiên." />
      )}
    </>
  );
}

function OrdersTab({ orders, products, customers, onCreate, onDone, onCancel }) {
  const canCreate = products.length > 0 && customers.length > 0;
  return (
    <>
      <Toolbar
        title="Bán hàng"
        subtitle="Tạo đơn, trừ kho, ghi nhận thanh toán và công nợ"
        icon="cart-plus"
        buttonLabel="Tạo đơn"
        onPress={onCreate}
        disabled={!canCreate}
      />
      {!canCreate ? (
        <InfoLine icon="information-outline" text="Cần có ít nhất một mặt hàng và một khách hàng để tạo đơn." />
      ) : null}
      {orders.length ? (
        orders.map((order) => (
          <OrderRow key={order.id} order={order} onDone={onDone} onCancel={onCancel} />
        ))
      ) : (
        <EmptyState icon="cart-outline" title="Chưa có đơn bán" text="Các đơn hàng mới sẽ xuất hiện tại đây." />
      )}
    </>
  );
}

function CustomersTab({ customers, search, onSearch, onAdd, onEdit, onDelete, onPay, onCall, onSms }) {
  return (
    <>
      <Toolbar
        title="Khách hàng"
        subtitle="Thêm khách, cập nhật thông tin và theo dõi công nợ"
        icon="account-plus-outline"
        buttonLabel="Thêm"
        onPress={onAdd}
      />
      <SearchBox value={search} onChangeText={onSearch} placeholder="Tìm theo tên, số điện thoại hoặc địa chỉ" />
      {customers.length ? (
        customers.map((customer) => (
          <CustomerCard
            key={customer.id}
            customer={customer}
            onEdit={onEdit}
            onDelete={onDelete}
            onPay={onPay}
            onCall={onCall}
            onSms={onSms}
          />
        ))
      ) : (
        <EmptyState icon="account-search-outline" title="Chưa có khách hàng" text="Bấm Thêm để tạo hồ sơ khách hàng." />
      )}
    </>
  );
}

function ReportsTab({ summary, products, customers, orders }) {
  return (
    <>
      <SectionTitle title="Báo cáo" subtitle="Dữ liệu lấy trực tiếp từ SQLite qua backend API" />
      <ReportBlock
        title="Tổng hợp kinh doanh"
        rows={[
          { label: 'Doanh thu đã thu', value: money.format(summary?.revenue || 0) },
          { label: 'Công nợ khách hàng', value: money.format(summary?.debt || 0), warning: (summary?.debt || 0) > 0 },
          { label: 'Giá trị tồn kho', value: money.format(summary?.inventoryValue || 0) },
          { label: 'Lợi nhuận ước tính', value: money.format(summary?.profit || 0) },
        ]}
      />
      <ReportBlock
        title="Tồn kho"
        rows={products.map((product) => ({
          label: product.name,
          value: `${product.stock} ${product.unit}`,
          warning: product.stock <= product.minStock,
        }))}
        empty="Chưa có mặt hàng để báo cáo."
      />
      <ReportBlock
        title="Công nợ theo khách"
        rows={customers.map((customer) => ({
          label: customer.name,
          value: money.format(customer.debt),
          warning: customer.debt > 0,
        }))}
        empty="Chưa có khách hàng để báo cáo."
      />
      <ReportBlock
        title="Đơn bán gần đây"
        rows={orders.slice(0, 8).map((order) => ({
          label: `${order.code} · ${order.customerName}`,
          value: money.format(order.total),
          warning: order.status !== 'Hoàn thành',
        }))}
        empty="Chưa có đơn bán để báo cáo."
      />
    </>
  );
}

function MetricCard({ icon, label, value, tone }) {
  return (
    <View style={[styles.metricCard, styles[`metric_${tone}`]]}>
      <View style={styles.metricIcon}>
        <MaterialCommunityIcons name={icon} size={21} color="#24372b" />
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function Toolbar({ title, subtitle, icon, buttonLabel, onPress, disabled }) {
  return (
    <View style={styles.toolbar}>
      <SectionTitle title={title} subtitle={subtitle} compact />
      <TouchableOpacity
        style={[styles.primaryButton, disabled && styles.buttonDisabled]}
        disabled={disabled}
        onPress={onPress}
      >
        <MaterialCommunityIcons name={icon} size={18} color="#24372b" />
        <Text style={styles.primaryButtonText}>{buttonLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

function SectionTitle({ title, subtitle, compact }) {
  return (
    <View style={[styles.sectionTitle, compact && styles.sectionTitleCompact]}>
      <Text style={styles.sectionHeading}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
    </View>
  );
}

function SearchBox(props) {
  return (
    <View style={styles.searchWrap}>
      <MaterialCommunityIcons name="magnify" size={20} color="#66717d" />
      <TextInput {...props} style={styles.searchInput} placeholderTextColor="#7f8a98" />
    </View>
  );
}

function ActionTile({ icon, label, onPress }) {
  return (
    <TouchableOpacity style={styles.actionTile} onPress={onPress}>
      <MaterialCommunityIcons name={icon} size={24} color="#24372b" />
      <Text style={styles.actionText}>{label}</Text>
    </TouchableOpacity>
  );
}

function ProductCard({ product, onEdit, onDelete }) {
  const lowStock = product.stock <= product.minStock;
  return (
    <View style={styles.card}>
      <View style={styles.cardTopline}>
        <View style={styles.iconBox}>
          <MaterialCommunityIcons name="rice" size={24} color="#406341" />
        </View>
        <View style={styles.cardMain}>
          <Text style={styles.cardTitle}>{product.name}</Text>
          <Text style={styles.cardMeta}>
            {product.type || 'Chưa phân loại'} · {product.origin || 'Chưa có xuất xứ'}
          </Text>
        </View>
        <StatusBadge danger={lowStock} label={lowStock ? 'Sắp hết' : 'Ổn định'} />
      </View>
      {product.note ? <Text style={styles.cardNote}>{product.note}</Text> : null}
      <View style={styles.detailGrid}>
        <Detail label="Giá bán" value={money.format(product.price)} />
        <Detail label="Tồn kho" value={`${product.stock} ${product.unit}`} />
        <Detail label="Giá vốn" value={money.format(product.cost)} />
      </View>
      <View style={styles.cardActions}>
        <IconButton icon="pencil-outline" label="Sửa" onPress={() => onEdit(product)} />
        <IconButton icon="trash-can-outline" label="Xóa" danger onPress={() => onDelete(product)} />
      </View>
    </View>
  );
}

function CustomerCard({ customer, onEdit, onDelete, onPay, onCall, onSms }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTopline}>
        <View style={[styles.iconBox, styles.customerIcon]}>
          <MaterialCommunityIcons name="account-outline" size={24} color="#276178" />
        </View>
        <View style={styles.cardMain}>
          <Text style={styles.cardTitle}>{customer.name}</Text>
          <Text style={styles.cardMeta}>
            {customer.group} · {customer.phone || 'Chưa có số điện thoại'}
          </Text>
        </View>
      </View>
      <Text style={styles.cardNote}>{customer.address || 'Chưa có địa chỉ'}</Text>
      {customer.note ? <Text style={styles.cardNote}>{customer.note}</Text> : null}
      <View style={styles.debtLine}>
        <Text style={styles.debtLabel}>Công nợ</Text>
        <Text style={[styles.debtValue, customer.debt > 0 && styles.debtValueActive]}>
          {money.format(customer.debt)}
        </Text>
      </View>
      <View style={styles.cardActions}>
        <IconButton icon="cash-check" label="Thu nợ" disabled={customer.debt <= 0} onPress={() => onPay(customer)} />
        <IconButton icon="phone-outline" label="Gọi" disabled={!customer.phone} onPress={() => onCall(customer)} />
        <IconButton icon="message-text-outline" label="SMS" disabled={!customer.phone} onPress={() => onSms(customer)} />
        <IconButton icon="pencil-outline" label="Sửa" onPress={() => onEdit(customer)} />
        <IconButton icon="trash-can-outline" label="Xóa" danger onPress={() => onDelete(customer)} />
      </View>
    </View>
  );
}

function OrderRow({ order, onDone, onCancel }) {
  const debt = Math.max(order.total - order.paid, 0);
  return (
    <View style={styles.rowCard}>
      <View style={styles.rowHeader}>
        <View style={styles.rowIcon}>
          <MaterialCommunityIcons name="receipt-text-outline" size={22} color="#24372b" />
        </View>
        <View style={styles.cardMain}>
          <Text style={styles.rowTitle}>
            {order.code} · {order.customerName}
          </Text>
          <Text style={styles.rowMeta}>
            {order.productName} · {order.quantity} kg · {formatDate(order.createdAt)}
          </Text>
        </View>
        <StatusBadge danger={debt > 0 || order.status === 'Đã hủy'} label={debt > 0 ? 'Còn nợ' : order.status} />
      </View>
      <View style={styles.orderTotals}>
        <Detail label="Tổng tiền" value={money.format(order.total)} />
        <Detail label="Đã thu" value={money.format(order.paid)} />
        <Detail label="Còn nợ" value={money.format(debt)} />
      </View>
      {onDone || onCancel ? (
        <View style={styles.cardActions}>
          <IconButton icon="check-circle-outline" label="Hoàn thành" disabled={order.status === 'Hoàn thành'} onPress={() => onDone(order)} />
          <IconButton icon="cancel" label="Hủy" danger disabled={order.status === 'Đã hủy'} onPress={() => onCancel(order)} />
        </View>
      ) : null}
    </View>
  );
}

function InventoryAlert({ product }) {
  return (
    <View style={styles.alertCard}>
      <MaterialCommunityIcons name="alert-circle-outline" size={22} color="#bf3f2f" />
      <View style={styles.cardMain}>
        <Text style={styles.alertTitle}>{product.name}</Text>
        <Text style={styles.alertText}>
          Còn {product.stock} {product.unit}, ngưỡng tối thiểu {product.minStock} {product.unit}.
        </Text>
      </View>
    </View>
  );
}

function Detail({ label, value }) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function StatusBadge({ label, danger }) {
  return (
    <View style={[styles.badge, danger && styles.badgeDanger]}>
      <Text style={[styles.badgeText, danger && styles.badgeDangerText]}>{label}</Text>
    </View>
  );
}

function IconButton({ icon, label, danger, disabled, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.iconButton, danger && styles.iconButtonDanger, disabled && styles.iconButtonDisabled]}
      disabled={disabled}
      onPress={onPress}
    >
      <MaterialCommunityIcons name={icon} size={18} color={danger ? '#bf3f2f' : '#24372b'} />
      <Text style={[styles.iconButtonText, danger && styles.iconButtonTextDanger]}>{label}</Text>
    </TouchableOpacity>
  );
}

function EmptyState({ icon, title, text }) {
  return (
    <View style={styles.emptyState}>
      <MaterialCommunityIcons name={icon} size={40} color="#6a7a67" />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function InfoLine({ icon, text }) {
  return (
    <View style={styles.infoLine}>
      <MaterialCommunityIcons name={icon} size={20} color="#4d6d82" />
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

function ConnectionBanner({ error, apiUrl, onPress }) {
  return (
    <TouchableOpacity style={styles.connectionBanner} onPress={onPress}>
      <MaterialCommunityIcons name="server-off" size={22} color="#bf3f2f" />
      <View style={styles.cardMain}>
        <Text style={styles.connectionTitle}>Chưa kết nối được backend</Text>
        <Text style={styles.connectionText}>
          {error} · API hiện tại: {apiUrl}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function ReportBlock({ title, rows, empty }) {
  return (
    <View style={styles.reportBlock}>
      <Text style={styles.reportTitle}>{title}</Text>
      {rows.length ? (
        rows.map((row, index) => (
          <View key={`${row.label}-${index}`} style={styles.reportRow}>
            <Text style={styles.reportLabel}>{row.label}</Text>
            <Text style={[styles.reportValue, row.warning && styles.reportValueWarning]}>{row.value}</Text>
          </View>
        ))
      ) : (
        <Text style={styles.reportEmpty}>{empty}</Text>
      )}
    </View>
  );
}

function ProductModal({ visible, product, onClose, onSave }) {
  const [form, setForm] = useState(emptyProduct);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(
      product
        ? {
            name: product.name,
            type: product.type,
            origin: product.origin,
            unit: product.unit,
            price: String(product.price),
            cost: String(product.cost),
            stock: String(product.stock),
            minStock: String(product.minStock),
            note: product.note,
          }
        : emptyProduct,
    );
  }, [product, visible]);

  async function submit() {
    setSaving(true);
    try {
      await onSave(form, product?.id);
    } catch (error) {
      Alert.alert('Không lưu được mặt hàng', error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormModal
      visible={visible}
      title={product ? 'Sửa mặt hàng' : 'Thêm mặt hàng'}
      subtitle="Dữ liệu sẽ được lưu vào SQLite thông qua backend."
      onClose={onClose}
      onSubmit={submit}
      submitLabel={saving ? 'Đang lưu...' : 'Lưu mặt hàng'}
    >
      <Input label="Tên mặt hàng" value={form.name} onChangeText={(name) => setForm({ ...form, name })} />
      <Input label="Loại gạo" value={form.type} onChangeText={(type) => setForm({ ...form, type })} />
      <Input label="Xuất xứ" value={form.origin} onChangeText={(origin) => setForm({ ...form, origin })} />
      <View style={styles.inputGrid}>
        <Input label="Đơn vị" value={form.unit} onChangeText={(unit) => setForm({ ...form, unit })} />
        <Input label="Tồn kho" keyboardType="numeric" value={form.stock} onChangeText={(stock) => setForm({ ...form, stock })} />
      </View>
      <View style={styles.inputGrid}>
        <Input label="Giá bán" keyboardType="numeric" value={form.price} onChangeText={(price) => setForm({ ...form, price })} />
        <Input label="Giá vốn" keyboardType="numeric" value={form.cost} onChangeText={(cost) => setForm({ ...form, cost })} />
      </View>
      <Input label="Ngưỡng cảnh báo tồn" keyboardType="numeric" value={form.minStock} onChangeText={(minStock) => setForm({ ...form, minStock })} />
      <Input label="Ghi chú" multiline value={form.note} onChangeText={(note) => setForm({ ...form, note })} />
    </FormModal>
  );
}

function CustomerModal({ visible, customer, onClose, onSave }) {
  const [form, setForm] = useState(emptyCustomer);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(
      customer
        ? {
            name: customer.name,
            phone: customer.phone,
            address: customer.address,
            group: customer.group,
            debt: String(customer.debt),
            note: customer.note,
          }
        : emptyCustomer,
    );
  }, [customer, visible]);

  async function submit() {
    setSaving(true);
    try {
      await onSave(form, customer?.id);
    } catch (error) {
      Alert.alert('Không lưu được khách hàng', error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormModal
      visible={visible}
      title={customer ? 'Sửa khách hàng' : 'Thêm khách hàng'}
      subtitle="Lưu hồ sơ khách, nhóm khách và công nợ đầu kỳ."
      onClose={onClose}
      onSubmit={submit}
      submitLabel={saving ? 'Đang lưu...' : 'Lưu khách hàng'}
    >
      <Input label="Tên khách hàng" value={form.name} onChangeText={(name) => setForm({ ...form, name })} />
      <Input label="Số điện thoại" keyboardType="phone-pad" value={form.phone} onChangeText={(phone) => setForm({ ...form, phone })} />
      <Input label="Địa chỉ" value={form.address} onChangeText={(address) => setForm({ ...form, address })} />
      <View style={styles.inputGrid}>
        <Input label="Nhóm khách" value={form.group} onChangeText={(group) => setForm({ ...form, group })} />
        <Input label="Công nợ đầu kỳ" keyboardType="numeric" value={form.debt} onChangeText={(debt) => setForm({ ...form, debt })} />
      </View>
      <Input label="Ghi chú" multiline value={form.note} onChangeText={(note) => setForm({ ...form, note })} />
    </FormModal>
  );
}

function OrderModal({ visible, products, customers, onClose, onSave }) {
  const [form, setForm] = useState(emptyOrder);
  const [saving, setSaving] = useState(false);
  const product = products.find((item) => String(item.id) === String(form.productId));
  const total = (Number(form.quantity) || 0) * (product?.price || 0);

  useEffect(() => {
    setForm({
      ...emptyOrder,
      productId: products[0]?.id ? String(products[0].id) : '',
      customerId: customers[0]?.id ? String(customers[0].id) : '',
    });
  }, [customers, products, visible]);

  async function submit() {
    setSaving(true);
    try {
      await onSave(form);
    } catch (error) {
      Alert.alert('Không tạo được đơn', error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormModal
      visible={visible}
      title="Tạo đơn bán gạo"
      subtitle="Đơn mới sẽ tự trừ kho và cộng công nợ nếu chưa thu đủ."
      onClose={onClose}
      onSubmit={submit}
      submitLabel={saving ? 'Đang tạo...' : 'Lưu đơn bán'}
    >
      <Text style={styles.inputLabel}>Chọn mặt hàng</Text>
      <PillPicker items={products} selectedId={form.productId} onSelect={(productId) => setForm({ ...form, productId })} getLabel={(item) => `${item.name} · ${item.stock} ${item.unit}`} />
      <Text style={styles.inputLabel}>Chọn khách hàng</Text>
      <PillPicker items={customers} selectedId={form.customerId} onSelect={(customerId) => setForm({ ...form, customerId })} getLabel={(item) => item.name} />
      <View style={styles.inputGrid}>
        <Input label="Số lượng" keyboardType="numeric" value={form.quantity} onChangeText={(quantity) => setForm({ ...form, quantity })} />
        <Input label="Đã thu" keyboardType="numeric" value={form.paid} onChangeText={(paid) => setForm({ ...form, paid })} />
      </View>
      <Input label="Ghi chú đơn" value={form.note} onChangeText={(note) => setForm({ ...form, note })} />
      <View style={styles.totalBox}>
        <Text style={styles.totalLabel}>Tổng tiền</Text>
        <Text style={styles.totalValue}>{money.format(total)}</Text>
      </View>
    </FormModal>
  );
}

function PaymentModal({ visible, customer, onClose, onSave }) {
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAmount(customer?.debt ? String(customer.debt) : '');
  }, [customer, visible]);

  async function submit() {
    if (!customer) return;
    setSaving(true);
    try {
      await onSave(customer, amount);
    } catch (error) {
      Alert.alert('Không thu được công nợ', error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormModal
      visible={visible}
      title="Thu công nợ"
      subtitle={customer ? `${customer.name} đang nợ ${money.format(customer.debt)}` : ''}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={saving ? 'Đang lưu...' : 'Ghi nhận thanh toán'}
    >
      <Input label="Số tiền thanh toán" keyboardType="numeric" value={amount} onChangeText={setAmount} />
    </FormModal>
  );
}

function ApiModal({ visible, apiUrl, onChange, onClose, onSave }) {
  return (
    <FormModal
      visible={visible}
      title="Cấu hình backend"
      subtitle="Điện thoại phải truy cập được địa chỉ này qua cùng Wi-Fi."
      onClose={onClose}
      onSubmit={onSave}
      submitLabel="Lưu địa chỉ API"
    >
      <Input label="Backend API URL" autoCapitalize="none" value={apiUrl} onChangeText={onChange} />
      <InfoLine icon="server-network" text="Ví dụ: http://192.168.1.10:4000" />
    </FormModal>
  );
}

function FormModal({ visible, title, subtitle, children, onClose, onSubmit, submitLabel }) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalPanel}>
          <View style={styles.modalHeader}>
            <View style={styles.cardMain}>
              <Text style={styles.modalTitle}>{title}</Text>
              <Text style={styles.modalSubtitle}>{subtitle}</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <MaterialCommunityIcons name="close" size={20} color="#24372b" />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>{children}</ScrollView>
          <TouchableOpacity style={styles.createButton} onPress={onSubmit}>
            <Text style={styles.createButtonText}>{submitLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function Input({ label, style, ...props }) {
  return (
    <View style={[styles.inputWrap, style]}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        {...props}
        style={[styles.input, props.multiline && styles.inputMultiline]}
        placeholderTextColor="#7f8a98"
      />
    </View>
  );
}

function PillPicker({ items, selectedId, onSelect, getLabel }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.pillRow}>
        {items.map((item) => {
          const active = String(selectedId) === String(item.id);
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.pill, active && styles.pillActive]}
              onPress={() => onSelect(String(item.id))}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>{getLabel(item)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

function formatDate(value) {
  if (!value) return '';
  return new Date(value.replace(' ', 'T')).toLocaleDateString('vi-VN');
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f6f2',
  },
  header: {
    backgroundColor: '#24372b',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  brandIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#f0c85a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    color: '#b9d7a9',
    fontSize: 13,
    fontWeight: '700',
  },
  title: {
    color: '#ffffff',
    fontSize: 25,
    fontWeight: '900',
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabScroller: {
    backgroundColor: '#24372b',
    flexGrow: 0,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  tab: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  tabActive: {
    backgroundColor: '#ffffff',
  },
  tabText: {
    color: '#d8e5d1',
    fontWeight: '800',
    fontSize: 13,
  },
  tabTextActive: {
    color: '#24372b',
  },
  content: {
    padding: 16,
    paddingBottom: 36,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  centerText: {
    color: '#52605a',
    fontWeight: '700',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    width: '48%',
    minHeight: 132,
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
  },
  metric_green: {
    backgroundColor: '#eef8ed',
    borderColor: '#c5dfc0',
  },
  metric_red: {
    backgroundColor: '#fff1ed',
    borderColor: '#f0c6ba',
  },
  metric_blue: {
    backgroundColor: '#eef6fb',
    borderColor: '#bed8e6',
  },
  metric_gold: {
    backgroundColor: '#fff7df',
    borderColor: '#ebd68e',
  },
  metricIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  metricLabel: {
    color: '#556070',
    fontSize: 13,
    fontWeight: '800',
  },
  metricValue: {
    color: '#17231c',
    fontSize: 19,
    fontWeight: '900',
    marginTop: 8,
  },
  quickGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  actionTile: {
    flex: 1,
    minHeight: 82,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e7dd',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  actionText: {
    color: '#24372b',
    fontWeight: '900',
    textAlign: 'center',
    fontSize: 12,
  },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitleCompact: {
    marginTop: 0,
    marginBottom: 0,
    flex: 1,
  },
  sectionHeading: {
    color: '#17231c',
    fontSize: 22,
    fontWeight: '900',
  },
  sectionSubtitle: {
    color: '#66717d',
    fontSize: 14,
    marginTop: 4,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#f0c85a',
    minHeight: 42,
    paddingHorizontal: 13,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryButtonText: {
    color: '#24372b',
    fontWeight: '900',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  searchWrap: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d9e0d5',
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: '#17231c',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e7dd',
  },
  cardTopline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardMain: {
    flex: 1,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#edf2e6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerIcon: {
    backgroundColor: '#eef6fb',
  },
  cardTitle: {
    color: '#17231c',
    fontSize: 16,
    fontWeight: '900',
  },
  cardMeta: {
    color: '#66717d',
    fontSize: 13,
    marginTop: 3,
  },
  cardNote: {
    color: '#4d5965',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
  },
  badge: {
    backgroundColor: '#edf7ec',
    paddingHorizontal: 9,
    minHeight: 30,
    borderRadius: 8,
    justifyContent: 'center',
  },
  badgeText: {
    color: '#387842',
    fontWeight: '900',
    fontSize: 12,
  },
  badgeDanger: {
    backgroundColor: '#fff0ec',
  },
  badgeDangerText: {
    color: '#bf3f2f',
  },
  detailGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  detailItem: {
    flex: 1,
    backgroundColor: '#f6f8f4',
    borderRadius: 8,
    padding: 10,
    minHeight: 66,
  },
  detailLabel: {
    color: '#68727a',
    fontSize: 12,
    fontWeight: '800',
  },
  detailValue: {
    color: '#17231c',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 6,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    flexWrap: 'wrap',
  },
  iconButton: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d7dfd2',
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
  },
  iconButtonDanger: {
    borderColor: '#f0c6ba',
    backgroundColor: '#fff7f4',
  },
  iconButtonDisabled: {
    opacity: 0.45,
  },
  iconButtonText: {
    color: '#24372b',
    fontWeight: '900',
    fontSize: 13,
  },
  iconButtonTextDanger: {
    color: '#bf3f2f',
  },
  rowCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e7dd',
    padding: 14,
    marginBottom: 10,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#f7efd5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    color: '#17231c',
    fontSize: 15,
    fontWeight: '900',
  },
  rowMeta: {
    color: '#66717d',
    fontSize: 13,
    marginTop: 5,
  },
  orderTotals: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  alertCard: {
    backgroundColor: '#fff3ec',
    borderColor: '#edc7b7',
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    gap: 10,
  },
  alertTitle: {
    color: '#7a382b',
    fontSize: 15,
    fontWeight: '900',
  },
  alertText: {
    color: '#704c43',
    fontSize: 13,
    marginTop: 5,
    lineHeight: 19,
  },
  debtLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#edf0ea',
  },
  debtLabel: {
    color: '#66717d',
    fontWeight: '800',
  },
  debtValue: {
    color: '#357a45',
    fontWeight: '900',
  },
  debtValueActive: {
    color: '#bf3f2f',
  },
  emptyState: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e7dd',
    padding: 22,
    alignItems: 'center',
    marginVertical: 12,
  },
  emptyTitle: {
    color: '#17231c',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 10,
  },
  emptyText: {
    color: '#66717d',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 6,
  },
  infoLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#eef6fb',
    borderWidth: 1,
    borderColor: '#bed8e6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  infoText: {
    color: '#365b6f',
    flex: 1,
    lineHeight: 19,
    fontWeight: '700',
  },
  connectionBanner: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#fff0ec',
    borderWidth: 1,
    borderColor: '#f0c6ba',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  connectionTitle: {
    color: '#7a382b',
    fontWeight: '900',
  },
  connectionText: {
    color: '#704c43',
    lineHeight: 19,
    marginTop: 4,
  },
  reportBlock: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e7dd',
    padding: 14,
    marginBottom: 12,
  },
  reportTitle: {
    color: '#17231c',
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 10,
  },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 38,
    borderTopWidth: 1,
    borderTopColor: '#eef1eb',
    gap: 12,
  },
  reportLabel: {
    color: '#4d5965',
    flex: 1,
  },
  reportValue: {
    color: '#17231c',
    fontWeight: '900',
  },
  reportValueWarning: {
    color: '#bf3f2f',
  },
  reportEmpty: {
    color: '#66717d',
    lineHeight: 20,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(13, 22, 17, 0.42)',
  },
  modalPanel: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    padding: 18,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  modalTitle: {
    color: '#17231c',
    fontSize: 21,
    fontWeight: '900',
  },
  modalSubtitle: {
    color: '#66717d',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d8ded4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  inputWrap: {
    flex: 1,
  },
  inputLabel: {
    color: '#39463f',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 8,
    marginTop: 10,
  },
  input: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d8ded4',
    paddingHorizontal: 12,
    color: '#17231c',
    fontSize: 15,
    fontWeight: '700',
    backgroundColor: '#ffffff',
  },
  inputMultiline: {
    minHeight: 82,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
  },
  pill: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d8ded4',
    paddingHorizontal: 12,
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  pillActive: {
    backgroundColor: '#24372b',
    borderColor: '#24372b',
  },
  pillText: {
    color: '#4d5965',
    fontSize: 13,
    fontWeight: '800',
  },
  pillTextActive: {
    color: '#ffffff',
  },
  totalBox: {
    backgroundColor: '#f6f8f4',
    borderRadius: 8,
    padding: 14,
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    color: '#66717d',
    fontWeight: '900',
  },
  totalValue: {
    color: '#17231c',
    fontSize: 20,
    fontWeight: '900',
  },
  createButton: {
    minHeight: 50,
    backgroundColor: '#f0c85a',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  createButtonText: {
    color: '#24372b',
    fontWeight: '900',
    fontSize: 16,
  },
});
