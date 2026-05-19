import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const state = {
  supabase: null,
  config: null,
  session: null,
  user: null,
  profile: null,
  products: [],
  orders: [],
  activeView: 'dashboard'
};

const elements = {
  authScreen: document.getElementById('authScreen'),
  authMessage: document.getElementById('authMessage'),
  signInForm: document.getElementById('signInForm'),
  signUpForm: document.getElementById('signUpForm'),
  signInToggle: document.getElementById('signInToggle'),
  signUpToggle: document.getElementById('signUpToggle'),
  signInButton: document.getElementById('signInButton'),
  signUpButton: document.getElementById('signUpButton'),
  signOutButton: document.getElementById('signOutButton'),
  userEmail: document.getElementById('userEmail'),
  appShell: document.getElementById('appShell'),
  appContent: document.getElementById('appContent'),
  toast: document.getElementById('toast')
};

const authFields = {
  signinEmail: document.getElementById('signinEmail'),
  signinPassword: document.getElementById('signinPassword'),
  signupName: document.getElementById('signupName'),
  signupEmail: document.getElementById('signupEmail'),
  signupPassword: document.getElementById('signupPassword')
};

async function initialize() {
  await loadConfig();
  initializeSupabase();
  bindAuthEvents();
  await restoreSession();
  render();
}

async function loadConfig() {
  const response = await fetch('/config');
  state.config = await response.json();
}

function initializeSupabase() {
  state.supabase = createClient(state.config.supabaseUrl, state.config.supabaseAnonKey);
  state.supabase.auth.onAuthStateChange(async (_, session) => {
    state.session = session;
    state.user = session?.user || null;
    if (state.user) {
      await loadProfile();
      await loadProducts();
      await loadOrders();
    }
    render();
  });
}

function bindAuthEvents() {
  elements.signInToggle.addEventListener('click', () => toggleAuthView('signin'));
  elements.signUpToggle.addEventListener('click', () => toggleAuthView('signup'));
  elements.signInButton.addEventListener('click', handleSignIn);
  elements.signUpButton.addEventListener('click', handleSignUp);
  elements.signOutButton.addEventListener('click', handleSignOut);
  document.querySelectorAll('.sidebar-item').forEach(button => {
    button.addEventListener('click', event => {
      state.activeView = event.target.dataset.view;
      document.querySelectorAll('.sidebar-item').forEach(item => item.classList.toggle('active', item.dataset.view === state.activeView));
      render();
    });
  });
}

async function restoreSession() {
  const { data } = await state.supabase.auth.getSession();
  state.session = data?.session || null;
  state.user = state.session?.user || null;
  if (state.user) {
    await loadProfile();
    await loadProducts();
    await loadOrders();
  }
}

function toggleAuthView(view) {
  const isSignIn = view === 'signin';
  elements.signInForm.classList.toggle('hidden', !isSignIn);
  elements.signUpForm.classList.toggle('hidden', isSignIn);
  elements.signInToggle.classList.toggle('active', isSignIn);
  elements.signUpToggle.classList.toggle('active', !isSignIn);
  elements.authMessage.textContent = '';
}

function showToast(message, type = 'success') {
  elements.toast.textContent = message;
  elements.toast.className = `toast ${type}`;
  elements.toast.classList.remove('hidden');
  setTimeout(() => elements.toast.classList.add('hidden'), 3200);
}

function render() {
  if (!state.user) {
    elements.authScreen.classList.remove('hidden');
    elements.appShell.classList.add('hidden');
    return;
  }

  elements.authScreen.classList.add('hidden');
  elements.appShell.classList.remove('hidden');
  elements.userEmail.textContent = state.user.email;
  renderAppContent();
}

async function handleSignIn() {
  const email = authFields.signinEmail.value.trim();
  const password = authFields.signinPassword.value.trim();
  if (!email || !password) {
    showAuthMessage('Ingresa un email y contraseña válidos.', 'error');
    return;
  }

  const { error } = await state.supabase.auth.signInWithPassword({ email, password });
  if (error) {
    showAuthMessage(error.message, 'error');
    return;
  }

  showAuthMessage('Inicio de sesión correcto. Cargando...', 'success');
}

async function handleSignUp() {
  const fullName = authFields.signupName.value.trim();
  const email = authFields.signupEmail.value.trim();
  const password = authFields.signupPassword.value.trim();
  if (!fullName || !email || !password) {
    showAuthMessage('Completa todos los campos de registro.', 'error');
    return;
  }

  const { error } = await state.supabase.auth.signUp({ email, password });
  if (error) {
    showAuthMessage(error.message, 'error');
    return;
  }

  showAuthMessage('Registro exitoso. Revisa tu correo y luego inicia sesión.', 'success');
}

function showAuthMessage(message, type) {
  elements.authMessage.textContent = message;
  elements.authMessage.className = `auth-message ${type}`;
}

async function handleSignOut() {
  await state.supabase.auth.signOut();
  state.session = null;
  state.user = null;
  state.profile = null;
  state.products = [];
  state.orders = [];
  render();
}

async function loadProfile() {
  if (!state.session) return;
  const response = await fetch('/profile', {
    headers: { Authorization: `Bearer ${state.session.access_token}` }
  });
  const result = await response.json();
  state.profile = result.profile || null;
}

async function loadProducts() {
  const response = await fetch('/products');
  const result = await response.json();
  state.products = result.products || [];
}

async function loadOrders() {
  if (!state.session) return;
  const response = await fetch('/orders', {
    headers: { Authorization: `Bearer ${state.session.access_token}` }
  });
  const result = await response.json();
  state.orders = result.orders || [];
}

function renderAppContent() {
  if (state.activeView === 'dashboard') return renderDashboard();
  if (state.activeView === 'products') return renderProducts();
  if (state.activeView === 'orders') return renderOrders();
  if (state.activeView === 'profile') return renderProfile();
  renderDashboard();
}

function renderDashboard() {
  const totalOrders = state.orders.length;
  const totalProducts = state.products.length;
  const totalStock = state.products.reduce((sum, item) => sum + Number(item.stock), 0);

  elements.appContent.innerHTML = `
    <section class="content-card">
      <h2>Resumen</h2>
      <div class="card-row">
        <div class="card-summary"><strong>Productos</strong><div>${totalProducts}</div></div>
        <div class="card-summary"><strong>Pedidos</strong><div>${totalOrders}</div></div>
        <div class="card-summary"><strong>Stock total</strong><div>${totalStock}</div></div>
      </div>
    </section>
    <section class="content-card">
      <h2>Últimos pedidos</h2>
      ${renderOrderSummaryTable()}
    </section>
  `;
}

function renderOrderSummaryTable() {
  if (!state.orders.length) {
    return '<div class="footer-note">No hay pedidos registrados todavía.</div>';
  }

  const rows = state.orders.slice(0, 5).map(order => {
    const productName = order.products?.name || 'Producto eliminado';
    const customerName = order.profiles?.full_name || order.profiles?.email || 'Usuario';
    return `
      <tr>
        <td>${productName}</td>
        <td>${order.quantity}</td>
        <td>${Number(order.total).toFixed(2)}</td>
        <td>${customerName}</td>
        <td>${new Date(order.created_at).toLocaleString('es-ES')}</td>
      </tr>
    `;
  }).join('');

  return `
    <div class="table-container">
      <table class="table-list">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Cantidad</th>
            <th>Total</th>
            <th>Cliente</th>
            <th>Fecha</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderProducts() {
  elements.appContent.innerHTML = `
    <section class="content-card">
      <div class="grid-two">
        <div>
          <h2>Productos</h2>
          ${renderProductsTable()}
        </div>
        <div>
          <h2>Nuevo producto</h2>
          ${renderProductForm()}
        </div>
      </div>
    </section>
  `;
  bindProductForm();
}

function renderProductsTable() {
  if (!state.products.length) {
    return '<div class="footer-note">No hay productos creados. Agrega uno en el formulario.</div>';
  }

  const rows = state.products.map(product => `
    <tr>
      <td>${product.name}</td>
      <td>${product.description || '-'}</td>
      <td>${Number(product.price).toFixed(2)}</td>
      <td>${product.stock}</td>
      <td><button data-action="delete" data-id="${product.id}" class="secondary-btn">Eliminar</button></td>
    </tr>
  `).join('');

  return `
    <div class="table-container">
      <table class="table-list">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Descripción</th>
            <th>Precio</th>
            <th>Stock</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderProductForm() {
  return `
    <div class="form-grid">
      <label>Nombre</label>
      <input id="productName" type="text" />
      <label>Descripción</label>
      <textarea id="productDescription" rows="3"></textarea>
      <label>Precio</label>
      <input id="productPrice" type="number" step="0.01" min="0" />
      <label>Stock</label>
      <input id="productStock" type="number" min="0" />
      <label>URL de imagen</label>
      <input id="productImage" type="url" />
      <button id="createProductButton" class="primary-btn">Guardar producto</button>
    </div>
  `;
}

function bindProductForm() {
  document.getElementById('createProductButton').addEventListener('click', handleCreateProduct);
  document.querySelectorAll('button[data-action="delete"]').forEach(button => {
    button.addEventListener('click', async event => {
      await handleDeleteProduct(event.target.dataset.id);
    });
  });
}

async function handleCreateProduct() {
  const name = document.getElementById('productName').value.trim();
  const description = document.getElementById('productDescription').value.trim();
  const price = Number(document.getElementById('productPrice').value);
  const stock = Number(document.getElementById('productStock').value);
  const image_url = document.getElementById('productImage').value.trim();

  if (!name || isNaN(price) || isNaN(stock)) {
    showToast('Completa el nombre, precio y stock del producto.', 'error');
    return;
  }

  const response = await fetch('/products', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${state.session.access_token}`
    },
    body: JSON.stringify({ name, description, price, stock, image_url })
  });

  const result = await response.json();
  if (!result.success) {
    showToast(result.error || 'No se pudo crear el producto.', 'error');
    return;
  }

  showToast('Producto guardado correctamente.');
  await loadProducts();
  renderProducts();
}

async function handleDeleteProduct(productId) {
  const response = await fetch(`/products/${productId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${state.session.access_token}`
    }
  });

  const result = await response.json();
  if (!result.success) {
    showToast(result.error || 'No se pudo eliminar el producto.', 'error');
    return;
  }

  showToast('Producto eliminado.');
  await loadProducts();
  renderProducts();
}

function renderOrders() {
  elements.appContent.innerHTML = `
    <section class="content-card">
      <div class="grid-two">
        <div>
          <h2>Lista de pedidos</h2>
          ${renderOrdersTable()}
        </div>
        <div>
          <h2>Nuevo pedido</h2>
          ${renderOrderForm()}
        </div>
      </div>
    </section>
  `;
  bindOrderForm();
}

function renderOrdersTable() {
  if (!state.orders.length) {
    return '<div class="footer-note">No hay pedidos registrados. Crea uno nuevo.</div>';
  }

  const rows = state.orders.map(order => `
    <tr>
      <td>${order.products?.name || 'Producto eliminado'}</td>
      <td>${order.quantity}</td>
      <td>${Number(order.total).toFixed(2)}</td>
      <td>${order.notes || '-'}</td>
      <td>${new Date(order.created_at).toLocaleString('es-ES')}</td>
    </tr>
  `).join('');

  return `
    <div class="table-container">
      <table class="table-list">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Cantidad</th>
            <th>Total</th>
            <th>Notas</th>
            <th>Fecha</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderOrderForm() {
  const productOptions = state.products.map(product => `
    <option value="${product.id}">${product.name} - ${Number(product.price).toFixed(2)}€</option>
  `).join('');

  return `
    <div class="form-grid">
      <label>Producto</label>
      <select id="orderProduct">${productOptions}</select>
      <label>Cantidad</label>
      <input id="orderQuantity" type="number" min="1" value="1" />
      <label>Notas</label>
      <textarea id="orderNotes" rows="3"></textarea>
      <button id="createOrderButton" class="primary-btn">Registrar pedido</button>
    </div>
  `;
}

function bindOrderForm() {
  document.getElementById('createOrderButton').addEventListener('click', handleCreateOrder);
}

async function handleCreateOrder() {
  const product_id = document.getElementById('orderProduct').value;
  const quantity = Number(document.getElementById('orderQuantity').value);
  const notes = document.getElementById('orderNotes').value.trim();

  if (!product_id || isNaN(quantity) || quantity < 1) {
    showToast('Selecciona producto y cantidad válida.', 'error');
    return;
  }

  const response = await fetch('/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${state.session.access_token}`
    },
    body: JSON.stringify({ product_id, quantity, notes })
  });

  const result = await response.json();
  if (!result.success) {
    showToast(result.error || 'No se pudo crear el pedido.', 'error');
    return;
  }

  showToast('Pedido registrado correctamente.');
  await loadProducts();
  await loadOrders();
  renderOrders();
}

function renderProfile() {
  const profile = state.profile || {};
  elements.appContent.innerHTML = `
    <section class="content-card">
      <h2>Perfil</h2>
      <div class="form-grid">
        <label>Nombre completo</label>
        <input id="profileName" type="text" value="${profile.full_name || ''}" />
        <label>Email</label>
        <input type="email" value="${state.user.email}" disabled />
        <label>Rol</label>
        <input type="text" value="${profile.role || 'user'}" disabled />
        <button id="saveProfileButton" class="primary-btn">Actualizar perfil</button>
      </div>
    </section>
  `;
  document.getElementById('saveProfileButton').addEventListener('click', handleSaveProfile);
}

async function handleSaveProfile() {
  const full_name = document.getElementById('profileName').value.trim();
  if (!full_name) {
    showToast('Ingresa tu nombre completo.', 'error');
    return;
  }

  const response = await fetch('/profiles', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${state.session.access_token}`
    },
    body: JSON.stringify({ full_name })
  });

  const result = await response.json();
  if (!result.success) {
    showToast(result.error || 'No se pudo actualizar el perfil.', 'error');
    return;
  }

  state.profile = result.profile;
  showToast('Perfil actualizado correctamente.');
}

initialize();
