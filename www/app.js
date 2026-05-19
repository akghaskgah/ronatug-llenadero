const appState = {
  roles: {
    employee: { pin: '1234', label: 'Panel Empleado' },
    admin: { pin: '3121', label: 'Panel Administrativo' }
  },
  prices: { small: 70, medium: 130, regular: 260 },
  currentRole: null,
  currentDayId: null,
  selectedItems: {},
  selectedSizes: {},
  selectedProducts: [],
  salesData: [],
  products: [],
  settings: { bcvRate: 12.5 },
  adminDayIndex: 0,
  newProductImage: ''
};

const defaultProducts = [
  { id: 'small', name: 'Botella Pequeña', priceBs: 70, type: 'bottle' },
  { id: 'medium', name: 'Botella Mediana', priceBs: 130, type: 'bottle' },
  { id: 'regular', name: 'Botella Normal', priceBs: 260, type: 'bottle' }
];

const elements = {
  hero: document.getElementById('hero'),
  appShell: document.getElementById('appShell'),
  loginPin: document.getElementById('loginPin'),
  loginButton: document.getElementById('loginButton'),
  loginError: document.getElementById('loginError'),
  sidebar: document.getElementById('sidebar'),
  sidebarMenu: document.getElementById('sidebarMenu'),
  sidebarRole: document.getElementById('sidebarRole'),
  mainContent: document.getElementById('mainContent'),
  hamburgerButton: document.getElementById('hamburgerButton'),
  logoutButton: document.getElementById('logoutButton'),
  toast: document.getElementById('toast'),
  adminDebugPanel: document.getElementById('adminDebugPanel')
};

const BACKEND_URL = 'http://localhost:3000';

async function fetchBCVRate() {
  try {
    const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
    const data = await response.json();
    if (data && data.promedio) {
      appState.settings.bcvRate = data.promedio;
      saveData();
      return true;
    }
  } catch (error) {}
  return false;
}

window.initializeApp = async () => {
  await loadStorage();
  await loadBackendState();
  await loadWorkDaysFromBackend();
  await loadProductsFromBackend();
  await fetchBCVRate();
  bindEvents();
  renderLogin();
};

async function loadStorage() {
  const d = localStorage.getItem('aqua_days');
  const s = localStorage.getItem('aqua_session');
  const p = localStorage.getItem('aqua_products');
  const pr = localStorage.getItem('aqua_prices');

  if (d) appState.salesData = JSON.parse(d);
  if (p) appState.products = JSON.parse(p); else appState.products = [...defaultProducts];
  if (pr) appState.prices = JSON.parse(pr);
  if (s) {
    const session = JSON.parse(s);
    appState.currentRole = session.role;
    appState.currentDayId = session.currentDayId;
    if (appState.currentRole) showAppShell();
  }
}

function saveData() {
  localStorage.setItem('aqua_days', JSON.stringify(appState.salesData));
  localStorage.setItem('aqua_session', JSON.stringify({ role: appState.currentRole, currentDayId: appState.currentDayId }));
  localStorage.setItem('aqua_products', JSON.stringify(appState.products));
  localStorage.setItem('aqua_prices', JSON.stringify(appState.prices));

  if (window.electronAPI?.saveData) {
    window.electronAPI.saveData({
      salesData: appState.salesData,
      currentRole: appState.currentRole,
      currentDayId: appState.currentDayId,
      products: appState.products,
      prices: appState.prices
    });
  }

  saveAppStateToBackend().catch(() => {});
}

async function uploadImageDataUrl(dataUrl) {
  if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl;
  const match = dataUrl.match(/^data:(image\/[^;]+);base64,(.*)$/);
  if (!match) return dataUrl;

  const [, contentType, base64] = match;
  const fileName = `product-${Date.now()}.jpg`;

  try {
    const response = await fetch(`${BACKEND_URL}/upload-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, fileBase64: base64, contentType })
    });
    const result = await response.json();
    if (result.success && result.publicUrl) {
      return result.publicUrl;
    }
  } catch (error) {
    console.warn('Upload image failed', error);
  }

  return dataUrl;
}

async function loadBackendState() {
  try {
    const response = await fetch(`${BACKEND_URL}/state`);
    const result = await response.json();
    if (result.success && result.appState) {
      const backendState = result.appState;
      appState.salesData = backendState.salesData || appState.salesData;
      appState.products = backendState.products || appState.products;
      appState.prices = backendState.prices || appState.prices;
      appState.currentRole = backendState.currentRole || appState.currentRole;
      appState.currentDayId = backendState.currentDayId || appState.currentDayId;
    }
  } catch (error) {
    console.warn('No backend state available', error);
  }
}

async function saveAppStateToBackend() {
  try {
    await fetch(`${BACKEND_URL}/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appState: {
          salesData: appState.salesData,
          products: appState.products,
          prices: appState.prices,
          currentRole: appState.currentRole,
          currentDayId: appState.currentDayId
        }
      })
    });
  } catch (error) {
    console.warn('Error saving backend state', error);
  }
}

async function loadProductsFromBackend() {
  try {
    const response = await fetch(`${BACKEND_URL}/products`);
    const result = await response.json();
    if (result.success && Array.isArray(result.products) && result.products.length > 0) {
      appState.products = result.products.map(product => ({
        id: product.id,
        sku: product.sku || '',
        name: product.name,
        description: product.description || '',
        type: product.type || 'other',
        priceBs: Number(product.price_bs) || 0,
        priceUsd: Number(product.price_usd) || 0,
        costUsd: Number(product.cost_usd) || 0,
        costBs: Number(product.cost_bs) || 0,
        ivaEnabled: !!product.iva_enabled,
        aplicaIVA: !!product.iva_enabled,
        stock: Number(product.stock) || 0,
        isActive: product.is_active !== false,
        imageUrl: product.image_url || 'https://via.placeholder.com/150',
        image: product.image_url || 'https://via.placeholder.com/150',
        imageStoragePath: product.image_storage_path || null
      }));
      saveData();
    }
  } catch (error) {
    console.warn('No remote products available', error);
  }
}

async function saveProductToBackend(product) {
  try {
    await fetch(`${BACKEND_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product)
    });
  } catch (error) {
    console.warn('Error saving product to backend', error);
  }
}

async function updateProductOnBackend(product) {
  try {
    await fetch(`${BACKEND_URL}/products/${product.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product)
    });
  } catch (error) {
    console.warn('Error updating product on backend', error);
  }
}

async function loadWorkDaysFromBackend() {
  try {
    const response = await fetch(`${BACKEND_URL}/work_days`);
    const result = await response.json();
    if (result.success && Array.isArray(result.workDays) && result.workDays.length > 0) {
      appState.salesData = result.workDays.map(day => ({
        id: day.id,
        date: day.date,
        status: day.status || 'open',
        sales: day.sales || [],
        expenses: day.expenses || []
      }));
      if (!appState.currentDayId) {
        const openDay = appState.salesData.find(day => day.status === 'open');
        if (openDay) appState.currentDayId = openDay.id;
      }
      saveData();
    }
  } catch (error) {
    console.warn('No remote work days available', error);
  }
}

async function createWorkDayOnBackend(day) {
  try {
    await fetch(`${BACKEND_URL}/work_days`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(day)
    });
  } catch (error) {
    console.warn('Error creating work day on backend', error);
  }
}

async function updateWorkDayOnBackend(day) {
  try {
    await fetch(`${BACKEND_URL}/work_days/${day.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(day)
    });
  } catch (error) {
    console.warn('Error updating work day on backend', error);
  }
}

async function closeWorkDayOnBackend(dayId) {
  try {
    await fetch(`${BACKEND_URL}/work_days/${dayId}/close`, {
      method: 'PUT'
    });
  } catch (error) {
    console.warn('Error closing work day on backend', error);
  }
}

async function deleteWorkDayOnBackend(dayId) {
  try {
    await fetch(`${BACKEND_URL}/work_days/${dayId}`, {
      method: 'DELETE'
    });
  } catch (error) {
    console.warn('Error deleting work day on backend', error);
  }
}

window.getProductImageSrc = (product) => {
  return product?.image || product?.imageUrl || 'https://via.placeholder.com/150';
};

window.resizeImageFile = (file, maxSize = 400, quality = 0.7) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
        const width = Math.round(img.width * ratio);
        const height = Math.round(img.height * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('No canvas context'));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      if (typeof reader.result === 'string') {
        img.src = reader.result;
      } else {
        reject(new Error('Invalid image data'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

window.processProductImageFile = async (file, options = {}) => {
  if (!file) return null;
  try {
    const dataUrl = await window.resizeImageFile(file, 400, 0.7);
    if (options.target === 'newProduct') {
      appState.newProductImage = dataUrl;
      const previewCard = document.getElementById('imagePreviewCard');
      const placeholder = previewCard?.querySelector('.image-preview-placeholder');
      const removeBtn = document.getElementById('removeImageBtn');
      if (previewCard) {
        previewCard.style.backgroundImage = `url('${dataUrl}')`;
        previewCard.classList.add('has-image');
      }
      if (placeholder) placeholder.style.display = 'none';
      if (removeBtn) removeBtn.classList.remove('hidden');
    } else if (options.target === 'edit' && options.productId) {
      const draft = ensureProductEditDraft(options.productId);
      if (draft) {
        draft.imageUrl = dataUrl;
      }
      renderProductEditModal();
    }
    return dataUrl;
  } catch (error) {
    console.error('Error procesando imagen:', error);
    return null;
  }
};

window.handleProductImagePaste = async (event) => {
  const items = event.clipboardData?.items;
  if (!items) return;
  const imageItem = Array.from(items).find(item => item.type.startsWith('image/'));
  if (!imageItem) return;
  const file = imageItem.getAsFile();
  if (!file) return;
  const newProductPreview = document.getElementById('imagePreviewCard');
  const editPreview = document.querySelector('.image-edit-preview');
  if (!newProductPreview && !editPreview) return;
  event.preventDefault();
  if (newProductPreview) {
    await window.processProductImageFile(file, { target: 'newProduct' });
  } else if (editPreview && appState.productEditOpen) {
    await window.processProductImageFile(file, { target: 'edit', productId: appState.productEditOpen });
  }
};

window.getPendingDeleteProducts = () => appState.products.filter(p => p.isDeleted);

window.renderDeletionConfirmationModal = () => {
  const modal = document.getElementById('deleteConfirmModal');
  if (!modal) return;
  const pending = getPendingDeleteProducts();
  if (!pending.length) {
    modal.classList.add('hidden');
    modal.innerHTML = '';
    return;
  }

  modal.classList.remove('hidden');
  modal.innerHTML = `
    <div class="delete-confirm-card">
      <h3>Vas a eliminar los siguientes productos:</h3>
      <div class="delete-list">
        ${pending.map(product => `
          <div class="delete-item">
            <span>${product.name}</span>
            <button type="button" class="small-btn secondary" onclick="undoDeleteInventoryProduct('${product.id}')">Deshacer</button>
          </div>
        `).join('')}
      </div>
      <div class="delete-actions">
        <button type="button" class="button--secondary" onclick="hideDeleteConfirmationModal()">Cerrar</button>
        <button type="button" class="button--primary" onclick="saveInventoryChanges()">Guardar Cambios</button>
      </div>
    </div>
  `;
};

window.hideDeleteConfirmationModal = () => {
  const modal = document.getElementById('deleteConfirmModal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.innerHTML = '';
};

window.deleteInventoryProduct = (id) => {
  const product = appState.products.find(p => p.id === id);
  if (!product || product.type === 'bottle') return;
  product.isDeleted = true;
  saveData();
  renderDeletionConfirmationModal();
  revP(document.getElementById('reviewSearch')?.value || '');
};

window.undoDeleteInventoryProduct = (id) => {
  const product = appState.products.find(p => p.id === id);
  if (!product) return;
  product.isDeleted = false;
  saveData();
  renderDeletionConfirmationModal();
  revP(document.getElementById('reviewSearch')?.value || '');
};

window.saveInventoryChanges = () => {
  const searchQuery = document.getElementById('reviewSearch')?.value || '';

  document.querySelectorAll('.inventory-table tbody tr').forEach(row => {
    const productId = row.dataset.productId;
    const product = appState.products.find(p => p.id === productId);
    if (product) {
      const qtyInput = row.querySelector('.table-qty-input');
      if (qtyInput) product.stock = Math.max(0, parseInt(qtyInput.value, 10) || 0);
    }
  });

  appState.products = appState.products.filter(product => !product.isDeleted);
  saveData();
  showToast('Cambios guardados correctamente.');
  renderDeletionConfirmationModal();
  revP(searchQuery);
};

function bindEvents() {
  elements.loginButton.addEventListener('click', handleLogin);
  elements.logoutButton.addEventListener('click', handleLogout);
  elements.hamburgerButton.onclick = () => elements.sidebar.classList.toggle('open');
  elements.loginPin.onkeydown = e => { if (e.key === 'Enter') handleLogin(); };
  document.addEventListener('paste', handleProductImagePaste);
}

function handleLogin() {
  const pin = elements.loginPin.value.trim();
  if (pin === appState.roles.employee.pin) appState.currentRole = 'employee';
  else if (pin === appState.roles.admin.pin) appState.currentRole = 'admin';
  else { elements.loginError.textContent = 'PIN Incorrecto'; return; }
  saveData(); showAppShell();
}

function handleLogout() {
  appState.currentRole = null;
  saveData(); renderLogin();
}

function renderLogin() {
  elements.hero.classList.remove('hidden'); elements.appShell.classList.add('hidden');
  elements.loginPin.value = ''; elements.loginError.textContent = '';
}

function showAppShell() {
  elements.hero.classList.add('hidden'); elements.appShell.classList.remove('hidden');
  elements.sidebarRole.textContent = appState.roles[appState.currentRole].label;
  renderSidebar();
  renderEmployeeContent('openDay');
}

function renderSidebar() {
  elements.sidebarMenu.innerHTML = '';
  let items = [];
  if (appState.currentRole === 'employee') {
    if (!appState.currentDayId) {
      items = [{k:'openDay',l:'Abrir Día'}];
    } else {
      items = [{k:'registerSales',l:'Registrar Ventas'},{k:'registerExpenses',l:'Registrar Gastos'},{k:'closeDay',l:'Cerrar Día'}];
    }
  } else {
    items = [{k:'dailyLog',l:'Registro del Día'},{k:'facturas',l:'Facturas'},{k:'cashBox',l:'Caja'},{k:'inventory',l:'Inventario'},{k:'modifyPrices',l:'Precios Botellones'},{k:'registerExpensesAdmin',l:'Registrar Gastos'}];
  }
  items.forEach(i => {
    const b = document.createElement('button'); b.textContent = i.l;
    b.onclick = () => {
      if (appState.currentRole === 'employee') renderEmployeeContent(i.k); else renderAdminContent(i.k);
      elements.sidebar.classList.remove('open');
    };
    elements.sidebarMenu.appendChild(b);
  });
}

function renderEmployeeContent(k) {
  if (k === 'openDay') renderOpenDay();
  else if (k === 'registerSales') renderRegisterSales();
  else if (k === 'registerExpenses') renderRegisterExpenses();
  else if (k === 'closeDay') renderCloseDay();
}

function hideAdminDebugPanel() {
  if (elements.adminDebugPanel) elements.adminDebugPanel.classList.add('hidden');
}

function renderAdminContent(k) {
  hideAdminDebugPanel();
  if (k === 'dailyLog') renderDailyLog();
  else if (k === 'facturas') renderFacturas();
  else if (k === 'cashBox') renderCashBox();
  else if (k === 'inventory') renderInventoryMenu();
  else if (k === 'modifyPrices') renderModifyPrices();
  else if (k === 'registerExpensesAdmin') renderRegisterExpensesAdmin();
}

function getMonthKey(dateValue) {
  const date = new Date(dateValue);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getMonthLabel(monthKey) {
  const [year, month] = monthKey.split('-');
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${monthNames[Number(month) - 1]} ${year}`;
}

function groupSalesByMonth() {
  return appState.salesData.reduce((acc, day) => {
    const key = getMonthKey(day.date);
    if (!acc[key]) acc[key] = [];
    acc[key].push(day);
    return acc;
  }, {});
}

function calculateMonthSummary(monthDays) {
  return monthDays.reduce((totals, day) => {
    const summary = getDaySummary(day);
    totals.totalSales += summary.totalSales;
    totals.ivaCollected += summary.ivaCollected;
    totals.totalExpense += summary.totalExpense;
    totals.netGain += summary.netGain;
    return totals;
  }, { totalSales: 0, ivaCollected: 0, totalExpense: 0, netGain: 0 });
}

window.selectFacturaMonth = (monthKey) => {
  appState.facturasSelectedMonth = monthKey;
  appState.facturasSelectedDayId = null;
  renderFacturas();
};

window.selectFacturaDay = (dayId) => {
  appState.facturasSelectedDayId = dayId;
  renderFacturas();
};

window.deleteFacturaMonth = (monthKey) => {
  const pin = prompt('Ingrese PIN de administrador para eliminar el mes archivado:');
  if (pin !== appState.roles.admin.pin) {
    showToast('PIN incorrecto.', true);
    return;
  }
  const monthLabel = getMonthLabel(monthKey);
  if (!confirm(`¿Estás seguro de eliminar todo el historial de ${monthLabel}? Esta acción no se puede deshacer.`)) {
    return;
  }
  appState.salesData = appState.salesData.filter(day => getMonthKey(day.date) !== monthKey);
  saveData();
  showToast(`Historial de ${monthLabel} eliminado.`);
  renderFacturas();
};

function renderFacturas() {
  const grouped = groupSalesByMonth();
  const monthKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
  if (monthKeys.length === 0) {
    elements.mainContent.innerHTML = `<div class="card-panel"><h2>Sin registros archivados</h2><p>No hay meses con facturas archivadas.</p></div>`;
    return;
  }
  const selectedMonth = appState.facturasSelectedMonth && grouped[appState.facturasSelectedMonth] ? appState.facturasSelectedMonth : monthKeys[0];
  appState.facturasSelectedMonth = selectedMonth;
  const monthDays = [...grouped[selectedMonth]].sort((a, b) => b.date.localeCompare(a.date));
  const monthSummary = calculateMonthSummary(monthDays);
  const selectedDay = monthDays.find(day => day.id === appState.facturasSelectedDayId) || monthDays[0];
  appState.facturasSelectedDayId = selectedDay?.id || null;
  const dayTiles = monthDays.map(day => {
    const isSelected = selectedDay && selectedDay.id === day.id;
    return `<div class="month-day-tile ${isSelected ? 'selected' : ''}" onclick="selectFacturaDay('${day.id}')">
      <div>${new Date(day.date).toLocaleDateString()}</div>
      <div>${day.sales.length} ventas</div>
      <div>${day.expenses.length} gastos</div>
    </div>`;
  }).join('');
  const selectedDaySummary = selectedDay ? getDaySummary(selectedDay) : { totalSales: 0, ivaCollected: 0, totalExpense: 0, netGain: 0 };
  const selectedDaySalesRows = selectedDay ? selectedDay.sales.map(sale => `
      <tr>
        <td>${new Date(sale.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
        <td>${formatSaleSizes(sale)}</td>
        <td>${sale.paymentMethod}</td>
        <td>${sale.total.toFixed(2)}</td>
        <td><button class="small-btn" onclick="showSaleInvoice('${sale.id}')">Ver</button></td>
      </tr>
    `).join('') : `<tr><td colspan="5">No hay ventas en este día.</td></tr>`;
  const selectedDayExpenseRows = selectedDay ? selectedDay.expenses.map(expense => `
      <tr>
        <td>${new Date(expense.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
        <td>${expense.reason}</td>
        <td>${expense.amount.toFixed(2)}</td>
      </tr>
    `).join('') : `<tr><td colspan="3">No hay gastos en este día.</td></tr>`;
  elements.mainContent.innerHTML = `
    <div class="section-header">
      <div>
        <h2>Facturas Archivadas</h2>
        <p class="section-subtitle">Explora meses anteriores sin mezclar los registros del mes actual.</p>
      </div>
      <div class="button-group">
        <button class="button--secondary" onclick="exportMonthSummary('${selectedMonth}')">Exportar Resumen Mensual</button>
      </div>
    </div>
    <div class="facturas-layout">
      <aside class="facturas-sidebar">
        ${monthKeys.map(key => `<div class="month-card ${key === selectedMonth ? 'selected' : ''}" onclick="selectFacturaMonth('${key}')">
            <span>${getMonthLabel(key)}</span>
            <button type="button" class="icon-btn delete-month-btn" onclick="event.stopPropagation(); deleteFacturaMonth('${key}')">🗑</button>
          </div>`).join('')}
      </aside>
      <section class="facturas-main">
        <div class="summary-grid" style="grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px;">
          <div class="stat-card"><h3>Mes</h3><p>${getMonthLabel(selectedMonth)}</p></div>
          <div class="stat-card"><h3>Ventas</h3><p>${monthSummary.totalSales.toFixed(2)}</p></div>
          <div class="stat-card"><h3>IVA Recaudado</h3><p>${monthSummary.ivaCollected.toFixed(2)}</p></div>
          <div class="stat-card"><h3>Ganancia Neta</h3><p>${monthSummary.netGain.toFixed(2)}</p></div>
        </div>
        <div class="card-panel">
          <div class="section-subheader"><h3>Días del Mes</h3></div>
          <div class="day-list">${dayTiles}</div>
        </div>
        <div class="card-panel">
          <div class="section-header" style="margin-bottom: 0; gap: 12px; align-items: flex-start;">
            <div>
              <h3>Detalle del Día</h3>
              <p>${selectedDay ? new Date(selectedDay.date).toLocaleDateString() : 'Sin día seleccionado'}</p>
            </div>
            ${selectedDay ? `<button class="small-btn danger" onclick="deleteFacturaDay('${selectedDay.id}')">Eliminar Día</button>` : ''}
          </div>
          <div style="overflow-x:auto; margin-top: 10px;"><table class="table-panel" style="font-size:0.8rem; width:100%;">
            <thead><tr><th>Hora</th><th>Items</th><th>Método</th><th>Total</th><th>Acciones</th></tr></thead>
            <tbody>${selectedDaySalesRows}</tbody>
          </table></div>
          <div style="margin-top: 16px; overflow-x:auto;"><table class="table-panel" style="font-size:0.8rem; width:100%;">
            <thead><tr><th>Hora</th><th>Motivo</th><th>Monto</th></tr></thead>
            <tbody>${selectedDayExpenseRows}</tbody>
          </table></div>
        </div>
      </section>
    </div>
  `;
}

window.exportMonthSummary = (monthKey) => {
  const grouped = groupSalesByMonth();
  const monthDays = grouped[monthKey] || [];
  if (!monthDays.length) {
    showToast('No hay datos para exportar.', true);
    return;
  }
  const monthSummary = calculateMonthSummary(monthDays);
  const monthLabel = getMonthLabel(monthKey);

  // Hoja 1: Resumen
  const summaryData = [
    ['Mes', monthLabel],
    ['Ventas Totales', monthSummary.totalSales.toFixed(2)],
    ['IVA Recaudado', monthSummary.ivaCollected.toFixed(2)],
    ['Ganancia Neta', monthSummary.netGain.toFixed(2)]
  ];

  // Hoja 2: Detalle
  const detailData = [['Fecha', 'Tipo', 'Descripción', 'Monto', 'IVA', 'Método de Pago']];
  monthDays.forEach(day => {
    const dateStr = new Date(day.date).toLocaleDateString();
    day.sales.forEach(sale => {
      const items = [];
      Object.entries(sale.sizes || {}).forEach(([key, qty]) => {
        if (qty > 0) {
          const price = getPrice(key);
          items.push({ name: `Botellón ${translateSize(key)}`, quantity: qty, unitPrice: price, hasIva: false, subtotal: qty * price });
        }
      });
      sale.products.forEach(p => {
        const hasIva = productHasIva(p);
        const unitPrice = p.priceBs;
        const subtotal = p.quantity * unitPrice;
        items.push({ name: p.name, quantity: p.quantity, unitPrice, hasIva, subtotal });
      });
      items.forEach(item => {
        detailData.push([
          dateStr,
          'Venta',
          `${item.quantity}x ${item.name}`,
          item.subtotal.toFixed(2),
          item.hasIva ? 'Sí' : 'No',
          sale.paymentMethod
        ]);
      });
    });
    day.expenses.forEach(expense => {
      detailData.push([
        dateStr,
        'Gasto',
        expense.reason,
        expense.amount.toFixed(2),
        'N/A',
        'N/A'
      ]);
    });
  });

  const wb = XLSX.utils.book_new();
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  const wsDetail = XLSX.utils.aoa_to_sheet(detailData);

  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen');
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Detalle');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  // Para web/Electron (para Capacitor, implementar con Filesystem plugin)
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Facturas-${monthKey}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast('Resumen mensual descargado.');
};;

window.deleteFacturaDay = async (dayId) => {
  const pin = prompt('Ingrese PIN de administrador para eliminar el día archivado:');
  if (pin === '3121') {
    const day = appState.salesData.find(dayItem => dayItem.id === dayId);
    if (!day) {
      showToast('Registro no encontrado.', true);
      return;
    }
    if (confirm(`¿Está seguro de que desea eliminar el día ${new Date(day.date).toLocaleDateString()}? Esta acción no se puede deshacer.`)) {
      appState.salesData = appState.salesData.filter(dayItem => dayItem.id !== dayId);
      saveData();
      deleteWorkDayOnBackend(dayId).catch(() => {});
      showToast('Día archivado eliminado correctamente.');
      renderFacturas();
    }
  } else {
    showToast('PIN incorrecto.', true);
  }
};

window.openNewDay = async () => {
  const id = crypto.randomUUID();
  const date = new Date().toISOString();
  const newDay = { id, date, status: 'open', sales: [], expenses: [] };
  appState.salesData.push(newDay);
  appState.currentDayId = id;
  saveData();
  createWorkDayOnBackend(newDay).catch(() => {});
  showToast('Día Abierto');
  renderSidebar();
  renderOpenDay();
};

function getPrice(key) {
  return appState.prices[key] || 0;
}

function translateSize(key) {
  return key === 'small' ? 'Pequeño' : key === 'medium' ? 'Mediano' : 'Normal';
}

function getSizeCounts(day) {
  return day.sales.reduce((totals, sale) => {
    const sizes = sale.sizes || (sale.size ? { [sale.size]: sale.quantity || 0 } : {});
    Object.entries(sizes).forEach(([size, qty]) => {
      totals[size] = (totals[size] || 0) + qty;
    });
    return totals;
  }, { small: 0, medium: 0, regular: 0 });
}

function renderOpenDay() {
  const d = appState.salesData.find(x => x.id === appState.currentDayId);
  if (!d) {
    elements.mainContent.innerHTML = `<div class="card-panel" style="text-align:center"><h2>Bienvenido</h2><p>Haga clic abajo para iniciar la jornada</p><button class="button--primary" onclick="openNewDay()">Abrir Día</button></div>`;
    return;
  }
  const sizeCounts = getSizeCounts(d);
  elements.mainContent.innerHTML = `
    <div class="section-header">
      <div>
        <h2>Dashboard del Día</h2>
        <p class="section-subtitle">Botellones vendidos hoy por tamaño.</p>
      </div>
    </div>
    <div class="summary-grid">
      <div class="stat-card"><h3>Pequeño</h3><p>${sizeCounts.small}</p></div>
      <div class="stat-card"><h3>Mediano</h3><p>${sizeCounts.medium}</p></div>
      <div class="stat-card"><h3>Normal</h3><p>${sizeCounts.regular}</p></div>
    </div>
  `;
}

function renderRegisterSales() {
  const d = appState.salesData.find(x => x.id === appState.currentDayId);
  if (!d) return renderOpenDay();
  appState.selectedSizes = appState.selectedSizes || {};
  appState.selectedProducts = appState.selectedProducts || [];
  elements.mainContent.innerHTML = `
    <div class="section-header">
      <div>
        <h2>Registrar Venta</h2>
        <p class="section-subtitle">Selecciona botellones en la izquierda y productos en la parte superior derecha.</p>
      </div>
    </div>
    <div class="sales-layout">
      <div class="left-column">
        <div class="card-panel sale-bottles-panel">
          <h3>Botellones</h3>
          <div id="bottleOptions" class="vertical-bottle-list"></div>
        </div>
      </div>
      <div class="right-column">
        <div class="card-panel sale-products-panel">
          <h3>Buscar Productos</h3>
          <div class="input-group compact">
            <label for="productSearch">Buscar producto</label>
            <input type="text" id="productSearch" placeholder="Buscar..." oninput="filterProducts(this.value)" />
          </div>
          <div id="productList"></div>
        </div>
        <div class="card-panel sale-selected-panel">
          <h3>Productos Seleccionados</h3>
          <div id="selectedProductsTable" class="selected-products-table">Aún no hay productos seleccionados.</div>
          <button class="button--primary" id="continuePayment">Continuar a Método de Pago</button>
        </div>
      </div>
    </div>
  `;
  renderBottleOptions();
  filterProducts('');
  updateSaleSummary();
  document.getElementById('continuePayment').addEventListener('click', renderPaymentMethod);
}

function renderBottleOptions() {
  const container = document.getElementById('bottleOptions');
  const bottleList = [
    { key: 'small', label: 'Pequeño', price: appState.prices.small },
    { key: 'medium', label: 'Mediano', price: appState.prices.medium },
    { key: 'regular', label: 'Normal', price: appState.prices.regular }
  ];
  container.innerHTML = bottleList.map(option => {
    const qty = appState.selectedSizes[option.key] || 0;
    return `
      <div class="tile ${qty > 0 ? 'selected' : ''}">
        <p class="tile-title">${option.label}</p>
        <p class="tile-price">${option.price} Bs</p>
        <div class="quantity-controls">
          <button type="button" class="qty-btn minus" onclick="adjustQuantity('${option.key}', -1)">-</button>
          <input type="number" class="size-quantity" data-size="${option.key}" min="0" value="${qty}" readonly />
          <button type="button" class="qty-btn plus" onclick="adjustQuantity('${option.key}', 1)">+</button>
        </div>
      </div>
    `;
  }).join('');
}

window.adjustQuantity = (size, delta) => {
  const current = appState.selectedSizes[size] || 0;
  const newQty = Math.max(0, current + delta);
  if (newQty > 0) appState.selectedSizes[size] = newQty;
  else delete appState.selectedSizes[size];
  renderBottleOptions();
  updateSaleSummary();
};

window.filterProducts = (query) => {
  const products = appState.products
    .filter(p => p.type !== 'bottle' && p.stock > 0 && p.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 4);
  const container = document.getElementById('productList');
  container.innerHTML = products.map(p => {
    const selected = appState.selectedProducts.find(item => item.id === p.id);
    const currentQty = selected ? selected.quantity : 0;
    const stock = p.stock ?? 0;
    const disabledPlus = currentQty >= stock;
    const imageSrc = getProductImageSrc(p);
    return `
      <div class="product-row">
        <div class="product-image"><img src="${imageSrc}" alt="${p.name}" /></div>
        <div class="product-info">
          <strong>${p.name}</strong>
          <span class="product-price-usd">${(p.priceBs / (appState.settings.bcvRate || 1)).toFixed(2)} USD</span>
          <span class="product-price-bs">${p.priceBs.toFixed(2)} Bs</span>
        </div>
        <div class="product-actions">
          <button type="button" class="qty-btn minus" onclick="changeProductQuantity('${p.id}', -1)" ${currentQty === 0 ? 'disabled' : ''}>-</button>
          <span class="product-count">${currentQty}</span>
          <button type="button" class="qty-btn plus" onclick="changeProductQuantity('${p.id}', 1)" ${disabledPlus ? 'disabled' : ''}>+</button>
        </div>
      </div>
    `;
  }).join('');
};

window.changeProductQuantity = (id, delta) => {
  const product = appState.products.find(p => p.id === id);
  if (!product) return;
  const stock = product.stock ?? 10;
  const selected = appState.selectedProducts.find(item => item.id === id);
  const currentQty = selected ? selected.quantity : 0;
  const nextQty = Math.max(0, Math.min(stock, currentQty + delta));
  if (nextQty === 0) {
    appState.selectedProducts = appState.selectedProducts.filter(item => item.id !== id);
  } else if (selected) {
    selected.quantity = nextQty;
  } else {
    appState.selectedProducts.push({ ...product, quantity: nextQty });
  }
  updateSaleSummary();
  filterProducts(document.getElementById('productSearch')?.value || '');
};

function updateSaleSummary() {
  const summary = getSaleSelectionSummary();
  const selectedProductsEl = document.getElementById('selectedProductsTable');
  const continueBtn = document.getElementById('continuePayment');
  if (!selectedProductsEl || !continueBtn) return;
  if (summary.totalQuantity === 0 && appState.selectedProducts.length === 0) {
    selectedProductsEl.innerHTML = '<em>No hay botellones ni productos seleccionados.</em>';
    continueBtn.disabled = true;
    return;
  }
  continueBtn.disabled = false;
  const rows = [];
  const bottleEntries = [
    { key: 'small', priceBs: appState.prices.small },
    { key: 'medium', priceBs: appState.prices.medium },
    { key: 'regular', priceBs: appState.prices.regular }
  ];

  bottleEntries.forEach(bottle => {
    const qty = appState.selectedSizes[bottle.key] || 0;
    if (qty > 0) {
      const usd = (bottle.priceBs / (appState.settings.bcvRate || 1)).toFixed(2);
      rows.push(`
        <div class="selected-products-row">
          <span>Botellón ${translateSize(bottle.key)}</span>
          <span>${usd}</span>
          <span>${bottle.priceBs.toFixed(2)}</span>
          <span class="quantity-controls-inline">
            <button type="button" class="qty-btn minus" onclick="adjustQuantity('${bottle.key}', -1)" ${qty === 0 ? 'disabled' : ''}>-</button>
            <span class="product-count">${qty}</span>
            <button type="button" class="qty-btn plus" onclick="adjustQuantity('${bottle.key}', 1)">+</button>
          </span>
        </div>
      `);
    }
  });

  appState.selectedProducts.forEach(p => {
    const usd = (p.priceBs / (appState.settings.bcvRate || 1)).toFixed(2);
    const stock = p.stock ?? 10;
    const disabledPlus = p.quantity >= stock;
    rows.push(`
      <div class="selected-products-row">
        <span>${p.name}</span>
        <span>${usd}</span>
        <span>${p.priceBs.toFixed(2)}</span>
        <span class="quantity-controls-inline">
          <button type="button" class="qty-btn minus" onclick="changeProductQuantity('${p.id}', -1)" ${p.quantity === 0 ? 'disabled' : ''}>-</button>
          <span class="product-count">${p.quantity}</span>
          <button type="button" class="qty-btn plus" onclick="changeProductQuantity('${p.id}', 1)" ${disabledPlus ? 'disabled' : ''}>+</button>
        </span>
      </div>
    `);
  });

  const productRows = rows.length > 0
    ? rows.join('')
    : '<div class="selected-products-empty">Ninguno</div>';

  selectedProductsEl.innerHTML = `
    <div class="selected-products-table-header">
      <span>Nombre</span>
      <span>USD</span>
      <span>Bs</span>
      <span>Cant.</span>
    </div>
    ${productRows}
    <div class="selected-products-footer">
      <span>Total</span>
      <span></span>
      <span>${summary.totalAmount.toFixed(2)} Bs</span>
      <span>${summary.totalQuantity}</span>
    </div>
  `;
}

function getSaleSelectionSummary() {
  const bottleList = [
    { key: 'small', price: appState.prices.small },
    { key: 'medium', price: appState.prices.medium },
    { key: 'regular', price: appState.prices.regular }
  ];
  const selectedSizes = appState.selectedSizes || {};
  const selectedProducts = appState.selectedProducts || [];
  let totalQuantity = 0;
  let totalAmount = 0;
  bottleList.forEach(bottle => {
    const qty = selectedSizes[bottle.key] || 0;
    totalQuantity += qty;
    totalAmount += qty * bottle.price;
  });
  let sizeSummary = [];
  selectedProducts.forEach(p => {
    totalQuantity += p.quantity;
    totalAmount += p.quantity * p.priceBs;
  });
  if (selectedSizes.small) sizeSummary.push(`${selectedSizes.small}x Pequeño`);
  if (selectedSizes.medium) sizeSummary.push(`${selectedSizes.medium}x Mediano`);
  if (selectedSizes.regular) sizeSummary.push(`${selectedSizes.regular}x Normal`);
  const productSummary = selectedProducts.length > 0 ? selectedProducts.map(p => `${p.quantity}x ${p.name}`).join(', ') : 'Ninguno';
  return {
    totalQuantity,
    totalAmount,
    sizeSummary: sizeSummary.length > 0 ? sizeSummary.join(', ') : 'Ninguno',
    productSummary
  };
}

function formatCurrency(amount) {
  return Number(amount || 0).toFixed(2);
}

function productHasIva(product) {
  return Boolean(product?.aplicaIVA || product?.ivaEnabled || product?.hasIva);
}

function getSalePaymentSummary() {
  const selectedSizes = appState.selectedSizes || {};
  const selectedProducts = appState.selectedProducts || [];
  const lineTaxRate = 0.16;
  const lineItems = [];
  let subtotal = 0;
  let ivaTotal = 0;
  let totalQuantity = 0;

  const bottleItems = [
    { key: 'small', name: 'Botella Pequeña', price: appState.prices.small, hasIva: false },
    { key: 'medium', name: 'Botella Mediana', price: appState.prices.medium, hasIva: false },
    { key: 'regular', name: 'Botella Normal', price: appState.prices.regular, hasIva: false }
  ];

  bottleItems.forEach(item => {
    const quantity = selectedSizes[item.key] || 0;
    if (quantity <= 0) return;
    const lineSubtotal = quantity * item.price;
    const lineIva = item.hasIva ? lineSubtotal * lineTaxRate : 0;
    subtotal += lineSubtotal;
    ivaTotal += lineIva;
    totalQuantity += quantity;
    lineItems.push({
      quantity,
      name: item.name,
      unitPrice: item.price,
      subtotal: lineSubtotal,
      hasIva: item.hasIva,
      ivaAmount: lineIva
    });
  });

  selectedProducts.forEach(product => {
    const quantity = Number(product.quantity || 0);
    if (quantity <= 0) return;
    const unitPrice = Number(product.priceBs || 0);
    const lineSubtotal = quantity * unitPrice;
    const hasIva = productHasIva(product);
    const lineIva = hasIva ? lineSubtotal * lineTaxRate : 0;
    subtotal += lineSubtotal;
    ivaTotal += lineIva;
    totalQuantity += quantity;
    lineItems.push({
      quantity,
      name: product.name,
      unitPrice,
      subtotal: lineSubtotal,
      hasIva,
      ivaAmount: lineIva
    });
  });

  return {
    lineItems,
    subtotal,
    ivaTotal,
    totalAmount: subtotal + ivaTotal,
    totalQuantity,
    taxRate: lineTaxRate
  };
}

function formatSaleSizes(sale) {
  if (!sale.sizes) return '-';
  return Object.entries(sale.sizes)
    .filter(([, qty]) => qty > 0)
    .map(([size, qty]) => `${qty}x ${translateSize(size)}`)
    .join(', ');
}

function renderPaymentMethod() {
  const currentDay = appState.salesData.find(x => x.id === appState.currentDayId);
  if (!currentDay) {
    showToast('Abra el día antes de registrar una venta.', true);
    renderOpenDay();
    return;
  }
  const summary = getSalePaymentSummary();
  if (summary.totalQuantity === 0) {
    showToast('Seleccione al menos un ítem para continuar.', true);
    return;
  }
  if (!appState.selectedPayment) appState.selectedPayment = 'cash';

  const rowsHtml = summary.lineItems.length > 0
    ? summary.lineItems.map(item => `
        <tr>
          <td>${item.quantity}</td>
          <td>
            <div class="payment-product-name">
              <strong>${item.name}</strong>
              ${item.hasIva ? '<span class="has-iva-pill">IVA aplica</span>' : '<span class="has-iva-pill transparent">Sin IVA</span>'}
            </div>
          </td>
          <td>${formatCurrency(item.unitPrice)} Bs</td>
          <td>${formatCurrency(item.subtotal)} Bs</td>
          <td>${item.hasIva ? formatCurrency(item.ivaAmount) + ' Bs' : '0.00 Bs'}</td>
        </tr>
      `).join('')
    : `<tr><td colspan="5" class="empty-row">No hay productos seleccionados.</td></tr>`;

  elements.mainContent.innerHTML = `
    <button type="button" class="small-btn back-btn" id="backToRegister">← Volver</button>
    <div class="section-header">
      <div>
        <h2>Método de Pago</h2>
        <p class="section-subtitle">Confirme el pago, revise el IVA y registre la venta.</p>
      </div>
    </div>
    <div class="card-panel compact-panel payment-method-panel">
      <div class="payment-table-wrap">
        <table class="payment-table">
          <thead>
            <tr>
              <th>Cant.</th>
              <th>Producto</th>
              <th>Precio Unitario</th>
              <th>Subtotal</th>
              <th>IVA</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      <div class="payment-card-grid">
        <div class="payment-card">
          <span>Subtotal</span>
          <strong>${formatCurrency(summary.subtotal)} Bs</strong>
        </div>
        <div class="payment-card">
          <span>IVA Total</span>
          <strong>${formatCurrency(summary.ivaTotal)} Bs</strong>
        </div>
        <div class="payment-card">
          <span>Total a Pagar</span>
          <strong>${formatCurrency(summary.totalAmount)} Bs</strong>
        </div>
      </div>

      <div class="payment-action-panel">
        <div class="payment-method-toggle" id="paymentOptions">
          <button type="button" class="small-btn ${appState.selectedPayment === 'cash' ? 'active' : ''}" data-method="cash">Efectivo</button>
          <button type="button" class="small-btn ${appState.selectedPayment === 'mobile' ? 'active' : ''}" data-method="mobile">Pago Móvil</button>
          <button type="button" class="small-btn ${appState.selectedPayment === 'both' ? 'active' : ''}" data-method="both">Efectivo + Pago Móvil</button>
        </div>

        <div class="payment-input-grid">
          <div class="input-group" id="cashContainer">
            <label for="cashAmount">Monto Efectivo</label>
            <input type="number" id="cashAmount" min="0" step="0.01" value="${appState.selectedPayment === 'mobile' ? '0.00' : formatCurrency(summary.totalAmount)}" />
          </div>
          <div class="input-group ${appState.selectedPayment === 'cash' ? 'hidden' : ''}" id="mobileContainer">
            <label for="mobileAmount">Monto Pago Móvil</label>
            <input type="number" id="mobileAmount" min="0" step="0.01" value="${appState.selectedPayment === 'cash' ? '0.00' : formatCurrency(summary.totalAmount)}" />
          </div>
          <div class="input-group ${appState.selectedPayment === 'cash' ? 'hidden' : ''}" id="referenceContainer">
            <label for="mobileReference">Referencia móvil (4 dígitos)</label>
            <input type="text" id="mobileReference" maxlength="4" placeholder="1234" />
          </div>
        </div>

        <div class="payment-summary-total">
          <span>Total a pagar</span>
          <strong>${formatCurrency(summary.totalAmount)} Bs</strong>
        </div>

        <button type="button" class="button--primary" id="registerSaleButton">Registrar Venta</button>
      </div>
    </div>
  `;

  document.getElementById('backToRegister').addEventListener('click', renderRegisterSales);
  document.querySelectorAll('#paymentOptions button').forEach(btn => {
    btn.addEventListener('click', () => selectPaymentMethod(btn.dataset.method));
  });
  document.getElementById('registerSaleButton').addEventListener('click', registerSale);
}

function formatSelectedSizesPreview() {
  const selectedSizes = appState.selectedSizes || {};
  return Object.entries(selectedSizes)
    .filter(([, qty]) => qty > 0)
    .map(([key, qty]) => `${qty}x ${translateSize(key)}`)
    .join(', ');
}

function selectPaymentMethod(method) {
  appState.selectedPayment = method;
  const summary = getSalePaymentSummary();
  document.querySelectorAll('#paymentOptions button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.method === method);
  });
  const cashInput = document.getElementById('cashAmount');
  const mobileInput = document.getElementById('mobileAmount');
  document.getElementById('cashContainer').classList.toggle('hidden', method === 'mobile');
  document.getElementById('mobileContainer').classList.toggle('hidden', method === 'cash');
  document.getElementById('referenceContainer').classList.toggle('hidden', method === 'cash');

  if (method === 'cash') {
    cashInput.value = formatCurrency(summary.totalAmount);
    cashInput.readOnly = true;
    mobileInput.value = '0.00';
    mobileInput.readOnly = false;
  } else if (method === 'mobile') {
    cashInput.value = '0.00';
    cashInput.readOnly = false;
    mobileInput.value = formatCurrency(summary.totalAmount);
    mobileInput.readOnly = true;
  } else {
    cashInput.value = '0.00';
    cashInput.readOnly = false;
    mobileInput.value = formatCurrency(summary.totalAmount);
    mobileInput.readOnly = false;
  }
}

function registerSale() {

  const currentDay = appState.salesData.find(x => x.id === appState.currentDayId);
  if (!currentDay) {
    showToast('Abra el día antes de registrar ventas.', true);
    return;
  }
  const summary = getSalePaymentSummary();
  if (summary.totalQuantity === 0) {
    showToast('Seleccione al menos un ítem.', true);
    return;
  }
  let cashAmount = parseFloat(document.getElementById('cashAmount').value) || 0;
  let mobileAmount = parseFloat(document.getElementById('mobileAmount').value) || 0;
  const reference = document.getElementById('mobileReference').value.trim();
  const expectedTotal = summary.totalAmount;

  if (appState.selectedPayment === 'cash') cashAmount = expectedTotal;
  if (appState.selectedPayment === 'mobile') mobileAmount = expectedTotal;

  const total = cashAmount + mobileAmount;
  if ((appState.selectedPayment === 'mobile' || appState.selectedPayment === 'both') && (!reference || reference.length !== 4 || !/^[0-9]+$/.test(reference))) {
    showToast('Referencia móvil debe tener 4 dígitos.', true);
    return;
  }
  if (Math.abs(total - expectedTotal) > 0.01) {
    showToast(`La suma debe ser ${formatCurrency(expectedTotal)} Bs.`, true);
    return;
  }
  const sale = {
    id: crypto.randomUUID(),
    time: new Date().toISOString(),
    sizes: { ...appState.selectedSizes },
    products: [...appState.selectedProducts],
    paymentMethod: appState.selectedPayment === 'cash' ? 'Efectivo' : appState.selectedPayment === 'mobile' ? 'Pago Móvil' : 'Efectivo + Pago Móvil',
    cashAmount,
    mobileAmount,
    reference: reference || '-',
    total,
    subtotal: summary.subtotal,
    montoIVA: summary.ivaTotal
  };
  currentDay.sales.push(sale);
  decrementProductStockFromSale(sale);
  appState.selectedSizes = {};
  appState.selectedProducts = [];
  saveData();
  updateWorkDayOnBackend(currentDay).catch(() => {});
  showToast('Venta registrada correctamente.');
  renderOpenDay();
}

function decrementProductStockFromSale(sale) {
  if (!sale || !sale.products) return;
  sale.products.forEach(item => {
    const product = appState.products.find(p => p.id === item.id);
    if (!product) return;
    const existingStock = Number(product.stock || 0);
    product.stock = Math.max(0, existingStock - (item.quantity || 0));
  });
}

function restoreProductStockFromSale(sale) {
  if (!sale || !sale.products) return;
  sale.products.forEach(item => {
    const product = appState.products.find(p => p.id === item.id);
    if (!product) return;
    const existingStock = Number(product.stock || 0);
    product.stock = existingStock + (item.quantity || 0);
  });
}

function getCurrentDay() {
  if (!appState.currentDayId) return null;
  return appState.salesData.find(day => day.id === appState.currentDayId) || null;
}

function renderRegisterExpenses() {
  if (!getCurrentDay()) {
    renderOpenDay();
    return;
  }
  elements.mainContent.innerHTML = `
    <div class="section-header">
      <div>
        <h2>Registrar Gastos</h2>
        <p class="section-subtitle">Registra un nuevo gasto.</p>
      </div>
    </div>
    <button type="button" class="button--secondary back-btn" onclick="renderOpenDay()">← Volver</button>
    <div class="card-panel">
      <div class="input-group">
        <label for="exR">Motivo</label>
        <input type="text" id="exR" placeholder="Ej. Refacción del surtidor" />
      </div>
      <div class="input-group">
        <label for="exA">Monto</label>
        <input type="number" id="exA" placeholder="0.00" min="0" step="0.01" />
      </div>
      <div class="input-group">
        <label for="exP">Tipo de Pago</label>
        <select id="exP">
          <option value="Efectivo">Efectivo</option>
          <option value="Pago Móvil">Pago Móvil</option>
        </select>
      </div>
      <button type="button" class="button--primary" id="saveExpenseBtn">Registrar Gasto</button>
    </div>
  `;
  document.getElementById('saveExpenseBtn').addEventListener('click', saveExpense);
}
window.saveExpense = () => {
  const reason = document.getElementById('exR').value.trim();
  const amount = parseFloat(document.getElementById('exA').value) || 0;
  const paymentType = document.getElementById('exP').value;
  if (!reason || amount <= 0) {
    showToast('Ingrese un motivo y un monto válido.', true);
    return;
  }
  const currentDay = appState.salesData.find(x => x.id === appState.currentDayId);
  currentDay.expenses.push({ id: crypto.randomUUID(), time: new Date().toISOString(), reason, amount, paymentType });
  saveData();
  updateWorkDayOnBackend(currentDay).catch(() => {});
  showToast('Gasto registrado correctamente.');
  renderRegisterExpenses();
};
window.deleteExpense = (id) => {
  const pin = prompt('Ingrese PIN de administrador para eliminar gasto:');
  if (pin !== '3121') {
    showToast('PIN incorrecto.', true);
    return;
  }
  const currentDay = appState.salesData.find(x => x.id === appState.currentDayId);
  currentDay.expenses = currentDay.expenses.filter(e => e.id !== id);
  saveData();
  updateWorkDayOnBackend(currentDay).catch(() => {});
  showToast('Gasto eliminado.');
  renderRegisterExpenses();
};

function renderCloseDay() {
  elements.mainContent.innerHTML = `
    <div class="section-header">
      <div>
        <h2>Cerrar Día</h2>
        <p class="section-subtitle">Ingresa tu PIN para cerrar el día y cerrar sesión.</p>
      </div>
    </div>
    <div class="card-panel">
      <div class="input-group">
        <label for="clP">PIN Empleado</label>
        <input type="password" id="clP" placeholder="Ingresa tu PIN" />
      </div>
      <button type="button" class="button--primary" id="closeDayBtn">Cerrar Día y Sesión</button>
    </div>
  `;
  document.getElementById('closeDayBtn').addEventListener('click', doClose);
}
window.doClose = async () => {
  const pin = document.getElementById('clP').value;
  if (pin === appState.roles.employee.pin) {
    const dayId = appState.currentDayId;
    appState.currentDayId = null;
    saveData();
    if (dayId) await closeWorkDayOnBackend(dayId).catch(() => {});
    handleLogout();
  } else {
    showToast('PIN Incorrecto', true);
  }
};

function renderDailyLog() {
  const currentMonthKey = getMonthKey(new Date());
  const ds = [...appState.salesData]
    .filter(day => getMonthKey(day.date) === currentMonthKey)
    .sort((a,b) => b.id.localeCompare(a.id));
  if (ds.length === 0) {
    elements.mainContent.innerHTML = `<div class="card-panel"><h2>Sin datos del mes actual</h2><p>Las facturas antiguas se encuentran en el módulo de Facturas.</p></div>`;
    return;
  }
  const d = ds[appState.adminDayIndex] || ds[0];
  const s = getDaySummary(d);
  elements.mainContent.innerHTML = `
    <div class="card-panel">
      <div class="section-header" style="margin-bottom: 0;">
        <div>
          <h2>Registro del Día</h2>
        </div>
        <button class="small-btn" style="background: #fee2e2; color: #991b1b; align-self: flex-start;" onclick="deleteDay()">Eliminar Día</button>
      </div>
      <div class="grid-days">
        ${ds.map((x,i)=>{
          const isSelected = i == appState.adminDayIndex;
          return `<div class="day-tile ${isSelected ? 'selected' : ''}" onclick="selectDay(${i})">
            <div class="day-date">${new Date(x.date).toLocaleDateString()}</div>
          </div>`;
        }).join('')}
      </div>
    </div>
    <div class="summary-grid" style="grid-template-columns: 1fr 1fr 1fr; gap:8px;">
      <div class="stat-card"><h3>Ventas</h3><p>${s.totalSales.toFixed(2)}</p></div>
      <div class="stat-card"><h3>IVA Recaudado</h3><p>${s.ivaCollected.toFixed(2)}</p></div>
      <div class="stat-card"><h3>Gastos</h3><p>${s.totalExpense.toFixed(2)}</p></div>
    </div>
    <div class="summary-grid" style="grid-template-columns: 1fr; gap:8px; margin-top: 12px;">
      <div class="stat-card"><h3>Neto</h3><p>${s.netGain.toFixed(2)}</p></div>
    </div>
    <div class="card-panel">
      <div style="overflow-x:auto;"><table class="table-panel" style="font-size:0.8rem; width:100%;">
        <thead><tr><th>Hora</th><th>Items</th><th>Metodo</th><th>Bs</th><th>Acciones</th></tr></thead>
        <tbody>${d.sales.map(x=>`<tr><td>${new Date(x.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</td><td><div class="sale-items-cell"><span>${formatSaleSizes(x)}</span><button class="small-btn mini-btn" onclick="showSaleInvoice('${x.id}')">Ver Factura</button></div></td><td>${x.paymentMethod}</td><td>${x.total.toFixed(2)}</td><td><button class="small-btn danger" onclick="deleteSale('${x.id}')">Eliminar</button></td></tr>`).join('')}</tbody>
      </table></div>
      <div id="invoiceModal" class="invoice-modal hidden"></div>
      <div style="margin-top:15px; overflow-x:auto;"><table class="table-panel" style="font-size:0.8rem; width:100%;">
        <thead><tr><th>Hora</th><th>Motivo</th><th>Monto</th></tr></thead>
        <tbody>${d.expenses.map(x=>`<tr><td>${new Date(x.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</td><td>${x.reason}</td><td>${x.amount.toFixed(2)}</td></tr>`).join('')}</tbody>
      </table></div>
    </div>`;
}

window.selectDay = (index) => {
  appState.adminDayIndex = index;
  renderDailyLog();
};

window.deleteSale = (saleId) => {
  const pin = prompt('Ingrese PIN de administrador para eliminar la venta:');
  if (pin === '3121') {
    const d = [...appState.salesData].sort((a,b) => b.id.localeCompare(a.id))[appState.adminDayIndex] || [...appState.salesData].sort((a,b) => b.id.localeCompare(a.id))[0];
    const saleToDelete = d.sales.find(sale => sale.id === saleId);
    if (saleToDelete) {
      restoreProductStockFromSale(saleToDelete);
    }
    d.sales = d.sales.filter(sale => sale.id !== saleId);
    saveData();
    showToast('Venta eliminada correctamente.');
    renderDailyLog();
  } else {
    showToast('PIN incorrecto.', true);
  }
};

window.showSaleInvoice = (saleId) => {
  const d = [...appState.salesData].sort((a,b) => b.id.localeCompare(a.id))[appState.adminDayIndex] || [...appState.salesData].sort((a,b) => b.id.localeCompare(a.id))[0];
  const sale = d.sales.find(s => s.id === saleId);
  if (!sale) return;
  const items = [];
  Object.entries(sale.sizes || {}).forEach(([key, qty]) => {
    if (qty > 0) {
      const price = getPrice(key);
      items.push({ name: `Botellón ${translateSize(key)}`, quantity: qty, unitPrice: price, hasIva: false, subtotal: qty * price });
    }
  });
  sale.products.forEach(p => {
    const hasIva = productHasIva(p);
    const unitPrice = p.priceBs;
    const subtotal = p.quantity * unitPrice;
    items.push({ name: p.name, quantity: p.quantity, unitPrice, hasIva, subtotal });
  });
  const rows = items.map(item => `
      <tr>
        <td>${item.quantity}</td>
        <td>${item.name}</td>
        <td>${item.unitPrice.toFixed(2)} Bs</td>
        <td>${item.hasIva ? 'Sí' : 'No'}</td>
        <td>${item.subtotal.toFixed(2)} Bs</td>
      </tr>
    `).join('');
  const invoiceHtml = `
    <div class="invoice-card">
      <div class="invoice-header">
        <div>
          <h3>Factura Detallada</h3>
          <p>Hora: ${new Date(sale.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
          <p>Método: ${sale.paymentMethod}</p>
        </div>
        <button type="button" class="small-btn" onclick="closeSaleInvoice()">Cerrar</button>
      </div>
      <div class="invoice-table-wrap">
        <table class="table-panel" style="width:100%; font-size:0.85rem;">
          <thead><tr><th>Cant.</th><th>Producto</th><th>Precio Unitario</th><th>IVA</th><th>Subtotal</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="invoice-total">
        <div>SubTotal: ${sale.subtotal?.toFixed(2) ?? '0.00'} Bs</div>
        <div>IVA: ${sale.montoIVA?.toFixed(2) ?? '0.00'} Bs</div>
        <strong>Total Venta: ${sale.total.toFixed(2)} Bs</strong>
      </div>
    </div>
  `;
  const modal = document.getElementById('invoiceModal');
  modal.innerHTML = invoiceHtml;
  modal.classList.remove('hidden');
};

window.closeSaleInvoice = () => {
  const modal = document.getElementById('invoiceModal');
  if (modal) modal.classList.add('hidden');
};

window.deleteDay = () => {
  const pin = prompt('Ingrese PIN de administrador para eliminar el día:');
  if (pin === '3121') {
    const d = [...appState.salesData].sort((a,b) => b.id.localeCompare(a.id))[appState.adminDayIndex] || [...appState.salesData].sort((a,b) => b.id.localeCompare(a.id))[0];
    if (confirm(`¿Está seguro de que desea eliminar el día ${new Date(d.date).toLocaleDateString()}? Esta acción no se puede deshacer.`)) {
      appState.salesData = appState.salesData.filter(day => day.id !== d.id);
      saveData();
      showToast('Día eliminado correctamente.');
      renderDailyLog();
    }
  } else {
    showToast('PIN incorrecto.', true);
  }
};

window.upRate = async () => { if(await fetchBCVRate()) renderCashBox(); };

function renderCashBox() {
  let cS = 0, mS = 0, cE = 0, mE = 0;
  appState.salesData.forEach(d => {
    d.sales.forEach(s => { cS += s.cashAmount||0; mS += s.mobileAmount||0; });
    d.expenses.forEach(e => { if(e.paymentType === 'Efectivo') cE += e.amount; else mE += e.amount; });
  });
  const nC = cS - cE, nM = mS - mE, total = nC + nM, bcv = appState.settings.bcvRate || 1;
  elements.mainContent.innerHTML = `<div class="section-header"><h2>Caja Global</h2><button class="small-btn" onclick="upRate()">WiFi BCV: ${bcv}</button></div>
    <div class="summary-grid" style="grid-template-columns: 1fr 1fr;">
      <div class="stat-card" style="border-top:4px solid green"><h3>Efectivo</h3><p>${nC.toFixed(2)}</p></div>
      <div class="stat-card" style="border-top:4px solid blue"><h3>Pago Móvil</h3><p>${nM.toFixed(2)}</p></div>
      <div class="stat-card" style="border-top:4px solid orange"><h3>Total Bs</h3><p>${total.toFixed(2)}</p></div>
      <div class="stat-card" style="border-top:4px solid teal"><h3>Total USD</h3><p>$ ${(total/bcv).toFixed(2)}</p></div>
    </div>`;
}

function renderInventoryMenu() {
  elements.mainContent.innerHTML = `
    <div class="section-header">
      <div>
        <h2>Inventario</h2>
        <p class="section-subtitle">Administra productos, precios y stock.</p>
      </div>
    </div>
    <div class="grid-3">
      <div class="tile" onclick="regP()"><h3>Registrar</h3><p>Agregar producto nuevo</p></div>
      <div class="tile" onclick="modP()"><h3>Modificar</h3><p>Actualizar precio o stock</p></div>
      <div class="tile" onclick="revP()"><h3>Revisar</h3><p>Ver inventario actual</p></div>
    </div>
  `;
}
window.renderInventoryMenu = renderInventoryMenu;

function renderModifyPrices() {
  elements.mainContent.innerHTML = `
    <div class="section-header">
      <div>
        <h2>Precios Botellones</h2>
        <p class="section-subtitle">Modifica los precios de los botellones.</p>
      </div>
    </div>
    <div class="card-panel">
      <div class="form-row">
        <div class="input-group">
          <label for="bS">Botella Pequeña</label>
          <input type="number" id="bS" value="${appState.prices.small}" min="0" step="0.01" />
        </div>
        <div class="input-group">
          <label for="bM">Botella Mediana</label>
          <input type="number" id="bM" value="${appState.prices.medium}" min="0" step="0.01" />
        </div>
      </div>
      <div class="input-group">
        <label for="bR">Botella Normal</label>
        <input type="number" id="bR" value="${appState.prices.regular}" min="0" step="0.01" />
      </div>
      <button type="button" class="button--primary" onclick="saveBot()">Guardar Cambios</button>
    </div>
  `;
}

function renderRegisterExpensesAdmin() {
  if (!getCurrentDay()) {
    elements.mainContent.innerHTML = `
      <div class="section-header">
        <div>
          <h2>Registrar Gastos</h2>
          <p class="section-subtitle">No hay un día abierto actualmente.</p>
        </div>
      </div>
      <div class="card-panel">
        <p>Para registrar gastos, primero debe abrir un día en el panel de empleado.</p>
      </div>
    `;
    return;
  }
  elements.mainContent.innerHTML = `
    <div class="section-header">
      <div>
        <h2>Registrar Gastos</h2>
        <p class="section-subtitle">Registra un nuevo gasto.</p>
      </div>
    </div>
    <div class="card-panel">
      <div class="input-group">
        <label for="exR">Motivo</label>
        <input type="text" id="exR" placeholder="Ej. Refacción del surtidor" />
      </div>
      <div class="input-group">
        <label for="exA">Monto</label>
        <input type="number" id="exA" placeholder="0.00" min="0" step="0.01" />
      </div>
      <div class="input-group">
        <label for="exP">Tipo de Pago</label>
        <select id="exP">
          <option value="Efectivo">Efectivo</option>
          <option value="Pago Móvil">Pago Móvil</option>
        </select>
      </div>
      <button type="button" class="button--primary" id="saveExpenseBtnAdmin">Registrar Gasto</button>
    </div>
  `;
  document.getElementById('saveExpenseBtnAdmin').addEventListener('click', saveExpenseAdmin);
}

window.saveExpenseAdmin = () => {
  const reason = document.getElementById('exR').value.trim();
  const amount = parseFloat(document.getElementById('exA').value) || 0;
  const paymentType = document.getElementById('exP').value;
  if (!reason || amount <= 0) {
    showToast('Ingrese un motivo y un monto válido.', true);
    return;
  }
  const currentDay = appState.salesData.find(x => x.id === appState.currentDayId);
  currentDay.expenses.push({ id: crypto.randomUUID(), time: new Date().toISOString(), reason, amount, paymentType });
  saveData();
  updateWorkDayOnBackend(currentDay).catch(() => {});
  showToast('Gasto registrado correctamente.');
  renderRegisterExpensesAdmin(); // Reset form
};

window.regP = () => {
  appState.inventoryIvaEnabled = false;
  appState.newProductImage = '';
  elements.mainContent.innerHTML = `
    <div class="card-panel">
      <div class="section-header">
        <div>
          <h2>Registrar Producto</h2>
          <p class="section-subtitle">Ingrese precio en USD o en Bs; el otro campo se calcula automáticamente.</p>
        </div>
      </div>
      <button type="button" class="button--secondary back-btn" onclick="renderInventoryMenu()">← Volver</button>
      <div class="inventory-form-grid compact"
           onkeydown="if(event.key==='Enter') event.preventDefault();">
        <div class="inventory-left">
          <div class="input-group full-width">
            <label for="nN">Nombre</label>
            <input type="text" id="nN" placeholder="Nombre del producto" />
          </div>
          <div class="form-row">
            <div class="input-group">
              <label for="priceCostUsd">Precio Costo USD</label>
              <input type="number" id="priceCostUsd" min="0" step="0.01" placeholder="0.80" oninput="syncInventoryPrice('costUsd')" />
            </div>
            <div class="input-group">
              <label for="priceCostBs">Precio Costo Bs</label>
              <input type="number" id="priceCostBs" min="0" step="0.01" placeholder="10.00" oninput="syncInventoryPrice('costBs')" />
            </div>
          </div>
          <div class="form-row">
            <div class="input-group">
              <label for="priceUsd">Precio en USD</label>
              <input type="number" id="priceUsd" min="0" step="0.01" placeholder="1.00" oninput="syncInventoryPrice('usd')" />
            </div>
            <div class="input-group">
              <label for="priceBs">Precio en Bs</label>
              <input type="number" id="priceBs" min="0" step="0.01" placeholder="12.50" oninput="syncInventoryPrice('bs')" />
            </div>
          </div>
          <div class="iva-row">
            <span>Aplica IVA (16%)</span>
            <div class="iva-options">
              <button type="button" id="ivaYes" class="toggle-btn iva-yes btn-iva-inactive" onclick="setInventoryIva(true)">✔</button>
              <button type="button" id="ivaNo" class="toggle-btn iva-no btn-iva-active-red" onclick="setInventoryIva(false)">✕</button>
            </div>
          </div>
        </div>
        <div class="inventory-right">
          <label>Vista previa</label>
          <div class="image-preview-card" id="imagePreviewCard" style="background-image: url('${appState.newProductImage || ''}')">
            <div class="image-preview-placeholder" style="display: ${appState.newProductImage ? 'none' : 'grid'}">Vista previa</div>
            <button type="button" class="image-remove-btn ${appState.newProductImage ? '' : 'hidden'}" id="removeImageBtn" onclick="removeProductImage()">Eliminar</button>
          </div>
          <input type="file" id="productImageFile" accept="image/*" onchange="previewProductImage(event)" />
          <div class="input-group stock-panel">
            <label for="nS">Stock</label>
            <input type="number" id="nS" placeholder="0" min="0" step="1" />
          </div>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="button--primary" id="saveInventoryButton">Guardar</button>
      </div>
    </div>
  `;
  document.getElementById('saveInventoryButton').addEventListener('click', saveNewP);
};
window.saveNewP = async () => {
  const fileInput = document.getElementById('productImageFile');
  const file = fileInput?.files?.[0];
  const existingImage = appState.newProductImage || '';
  const saveProduct = async (imageUrl) => {
    const name = document.getElementById('nN').value.trim();
    const usdValue = parseFloat(document.getElementById('priceUsd').value) || 0;
    const bsValue = parseFloat(document.getElementById('priceBs').value) || 0;
    const costUsdValue = parseFloat(document.getElementById('priceCostUsd').value) || 0;
    const costBsValue = parseFloat(document.getElementById('priceCostBs').value) || 0;
    const stock = parseInt(document.getElementById('nS').value, 10) || 0;
    const ivaEnabled = !!appState.inventoryIvaEnabled;
    const bcv = appState.settings.bcvRate || 1;
    let priceBs = 0;
    let priceUsd = usdValue || 0;
    let costUsd = costUsdValue || 0;
    let costBs = costBsValue || 0;

    if (usdValue > 0 && !bsValue) {
      priceBs = usdValue * bcv;
    } else if (bsValue > 0) {
      priceBs = bsValue;
      priceUsd = bsValue / bcv;
    }

    if (costUsdValue > 0 && !costBsValue) {
      costBs = costUsdValue * bcv;
    } else if (costBsValue > 0) {
      costBs = costBsValue;
      costUsd = costBsValue / bcv;
    }

    if (!name || priceBs <= 0) {
      showToast('Ingrese nombre y un precio válido.', true);
      return;
    }

    const imageValue = imageUrl || 'https://via.placeholder.com/150';
    const newProduct = {
      id: crypto.randomUUID(),
      name,
      priceBs: parseFloat(priceBs.toFixed(2)),
      priceUsd: parseFloat(priceUsd.toFixed(2)),
      costUsd: parseFloat(costUsd.toFixed(2)),
      costBs: parseFloat(costBs.toFixed(2)),
      aplicaIVA: ivaEnabled,
      ivaEnabled,
      stock,
      imageUrl: imageValue,
      image: imageValue,
      type: 'other'
    };
    appState.products.push(newProduct);
    saveProductToBackend(newProduct);
    saveData();
    showToast('Producto registrado correctamente.');
    renderInventoryMenu();
  };

  if (file && !existingImage) {
    await window.processProductImageFile(file, { target: 'newProduct' });
    const imageUrl = await uploadImageDataUrl(appState.newProductImage || '');
    await saveProduct(imageUrl);
  } else {
    const imageUrl = await uploadImageDataUrl(existingImage);
    await saveProduct(imageUrl);
  }
};
window.syncInventoryPrice = (field) => {
  const bcv = appState.settings.bcvRate || 1;
  const usdEl = document.getElementById('priceUsd');
  const bsEl = document.getElementById('priceBs');
  const costUsdEl = document.getElementById('priceCostUsd');
  const costBsEl = document.getElementById('priceCostBs');
  const usd = parseFloat(usdEl.value) || 0;
  const bs = parseFloat(bsEl.value) || 0;
  const costUsd = parseFloat(costUsdEl.value) || 0;
  const costBs = parseFloat(costBsEl.value) || 0;

  if (field === 'usd') {
    if (usd > 0) bsEl.value = (usd * bcv).toFixed(2);
    else bsEl.value = '';
  } else if (field === 'bs') {
    if (bs > 0) usdEl.value = (bs / bcv).toFixed(2);
    else usdEl.value = '';
  } else if (field === 'costUsd') {
    if (costUsd > 0) costBsEl.value = (costUsd * bcv).toFixed(2);
    else costBsEl.value = '';
  } else if (field === 'costBs') {
    if (costBs > 0) costUsdEl.value = (costBs / bcv).toFixed(2);
    else costUsdEl.value = '';
  }
};

window.setInventoryIva = (enabled) => {
  appState.inventoryIvaEnabled = enabled;
  const yesBtn = document.getElementById('ivaYes');
  const noBtn = document.getElementById('ivaNo');
  if (yesBtn && noBtn) {
    if (enabled) {
      yesBtn.classList.add('btn-iva-active-green');
      yesBtn.classList.remove('btn-iva-inactive');
      noBtn.classList.add('btn-iva-inactive');
      noBtn.classList.remove('btn-iva-active-red');
    } else {
      noBtn.classList.add('btn-iva-active-red');
      noBtn.classList.remove('btn-iva-inactive');
      yesBtn.classList.add('btn-iva-inactive');
      yesBtn.classList.remove('btn-iva-active-green');
    }
  }
};
window.previewProductImage = async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  await window.processProductImageFile(file, { target: 'newProduct' });
};
window.removeProductImage = () => {
  const fileInput = document.getElementById('productImageFile');
  const previewCard = document.getElementById('imagePreviewCard');
  const placeholder = previewCard?.querySelector('.image-preview-placeholder');
  const removeBtn = document.getElementById('removeImageBtn');
  appState.newProductImage = '';
  if (fileInput) fileInput.value = '';
  if (previewCard) {
    previewCard.style.backgroundImage = '';
    previewCard.classList.remove('has-image');
  }
  if (placeholder) placeholder.style.display = 'grid';
  if (removeBtn) removeBtn.classList.add('hidden');
};

window.ensureProductEditDraft = (id) => {
  appState.productEditDrafts = appState.productEditDrafts || {};
  if (!appState.productEditDrafts[id]) {
    const source = appState.products.find(p => p.id === id);
    if (source) {
      appState.productEditDrafts[id] = { ...source };
    }
  }
  return appState.productEditDrafts[id];
};

window.toggleProductEditor = (id) => {
  if (appState.productEditOpen === id) {
    appState.productEditOpen = null;
  } else {
    appState.productEditOpen = id;
    ensureProductEditDraft(id);
  }
  modP(document.getElementById('inventorySearch')?.value || '');
};

window.cancelProductEdit = (id) => {
  if (appState.productEditDrafts) delete appState.productEditDrafts[id];
  appState.productEditOpen = null;
  modP(document.getElementById('inventorySearch')?.value || '');
};

window.syncProductDraftPrices = (id, field, value) => {
  const draft = ensureProductEditDraft(id);
  if (!draft) return;
  const bcv = appState.settings.bcvRate || 1;
  const numeric = parseFloat(value);
  if (field === 'priceUsd') {
    draft.priceUsd = value;
    draft.priceBs = value === '' || Number.isNaN(numeric) ? '' : Number((numeric * bcv).toFixed(2));
  } else if (field === 'priceBs') {
    draft.priceBs = value;
    draft.priceUsd = value === '' || Number.isNaN(numeric) ? '' : Number((numeric / bcv).toFixed(4));
  } else if (field === 'costUsd') {
    draft.costUsd = value;
    draft.costBs = value === '' || Number.isNaN(numeric) ? '' : Number((numeric * bcv).toFixed(2));
  } else if (field === 'costBs') {
    draft.costBs = value;
    draft.costUsd = value === '' || Number.isNaN(numeric) ? '' : Number((numeric / bcv).toFixed(4));
  }
  const modal = document.getElementById('productEditModal');
  if (!modal) return;
  const priceUsdInput = modal.querySelector('#editPriceUsd');
  const priceBsInput = modal.querySelector('#editPriceBs');
  const costUsdInput = modal.querySelector('#editCostUsd');
  const costBsInput = modal.querySelector('#editCostBs');
  if (field === 'priceUsd' && priceBsInput) priceBsInput.value = draft.priceBs;
  if (field === 'priceBs' && priceUsdInput) priceUsdInput.value = draft.priceUsd;
  if (field === 'costUsd' && costBsInput) costBsInput.value = draft.costBs;
  if (field === 'costBs' && costUsdInput) costUsdInput.value = draft.costUsd;
};

window.saveProductEdit = async (id) => {
  const product = appState.products.find(p => p.id === id);
  const draft = appState.productEditDrafts?.[id];
  if (!product || !draft) return;
  product.name = draft.name || product.name;
  if (product.type !== 'bottle') {
    product.stock = parseInt(draft.stock, 10) || 0;
  }
  product.priceBs = parseFloat(draft.priceBs) || 0;
  product.priceUsd = parseFloat(draft.priceUsd) || 0;
  product.costUsd = parseFloat(draft.costUsd) || 0;
  product.costBs = parseFloat(draft.costBs) || 0;
  product.aplicaIVA = !!draft.aplicaIVA || !!draft.ivaEnabled;
  product.ivaEnabled = !!draft.aplicaIVA || !!draft.ivaEnabled;
  let imageValue = draft.imageUrl || product.imageUrl || 'https://via.placeholder.com/150';
  if (imageValue.startsWith('data:')) {
    imageValue = await uploadImageDataUrl(imageValue);
  }
  product.imageUrl = imageValue;
  product.image = imageValue;
  saveData();
  updateProductOnBackend(product);
  showToast('Producto guardado correctamente.');
  appState.productEditOpen = null;
  delete appState.productEditDrafts[id];
  modP(document.getElementById('inventorySearch')?.value || '');
};

window.handleProductImageChange = async (event, id) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const dataUrl = await window.resizeImageFile(file, 400, 0.7);
  const uploadedUrl = await uploadImageDataUrl(dataUrl);
  const draft = ensureProductEditDraft(id);
  if (!draft) return;
  draft.imageUrl = uploadedUrl || dataUrl;
  renderProductEditModal();
};

window.onProductDraftChange = (id, field, value) => {
  if (field === 'priceUsd' || field === 'priceBs' || field === 'costUsd' || field === 'costBs') {
    window.syncProductDraftPrices(id, field, value);
    return;
  }
  const draft = ensureProductEditDraft(id);
  if (!draft) return;
  if (field === 'stock') {
    draft.stock = parseInt(value, 10) || 0;
  } else if (field === 'name') {
    draft.name = value;
  } else if (field === 'imageUrl') {
    draft.imageUrl = value;
  }
  renderProductEditModal();
};

window.toggleProductDraftIva = (id, enabled) => {
  const draft = ensureProductEditDraft(id);
  if (!draft) return;
  draft.aplicaIVA = enabled;
  draft.ivaEnabled = enabled;
  renderProductEditModal();
};

window.modP = (q = '') => {
  const prods = appState.products.filter(p => p.name.toLowerCase().includes(q.toLowerCase())).sort((a,b)=>a.name.localeCompare(b.name));
  elements.mainContent.innerHTML = `
    <div class="card-panel">
      <div class="section-header">
        <div>
          <h2>Modificar Productos</h2>
          <p class="section-subtitle">Actualiza stock y precio desde aquí.</p>
        </div>
      </div>
      <button type="button" class="button--secondary back-btn" onclick="renderInventoryMenu()">← Volver</button>
      <div class="input-group">
        <label for="inventorySearch">Buscar producto</label>
        <input type="text" id="inventorySearch" placeholder="Buscar..." value="${q}" oninput="modP(this.value)" />
      </div>
      <div class="product-grid">
        ${prods.map(p => {
          return `
          <div class="product-card" data-product-id="${p.id}">
            <div class="product-card-header" onclick="toggleProductEditor('${p.id}')">
              <div class="product-card-image" style="background-image: url('${p.imageUrl || 'https://via.placeholder.com/150'}')"></div>
              <div class="product-card-info">
                <strong>${p.name}</strong>
                <span>${p.type === 'bottle' ? 'Botellón' : 'Producto'}</span>
                <span>${p.type === 'bottle' ? 'Stock indefinido' : `${p.stock} uds`}</span>
              </div>
            </div>
          </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
  renderProductEditModal();
};
window.renderProductEditModal = () => {
  const modal = document.getElementById('productEditModal');
  if (!modal) return;
  if (!appState.productEditOpen) {
    modal.classList.add('hidden');
    modal.innerHTML = '';
    return;
  }
  const product = appState.products.find(p => p.id === appState.productEditOpen);
  if (!product) {
    modal.classList.add('hidden');
    modal.innerHTML = '';
    return;
  }
  const draft = ensureProductEditDraft(product.id);
  modal.classList.remove('hidden');
  modal.innerHTML = `
    <div class="product-edit-modal-card">
      <div class="overlay-header">
        <strong>Editar producto</strong>
        <button type="button" class="close-overlay" onclick="cancelProductEdit('${product.id}')">✕</button>
      </div>
      <div class="product-edit-panel">
        <div class="edit-row">
          <div class="input-group">
            <label>Nombre</label>
            <input type="text" value="${draft.name}" oninput="onProductDraftChange('${product.id}','name', this.value)" />
          </div>
          ${product.type === 'bottle' ? `
            <div class="input-group">
              <label>Stock</label>
              <div class="static-text">Indefinido</div>
            </div>
          ` : `
            <div class="input-group">
              <label>Stock</label>
              <input type="number" min="0" value="${draft.stock}" oninput="onProductDraftChange('${product.id}','stock', this.value)" />
            </div>
          `}
        </div>
        <div class="edit-row">
          <div class="input-group">
            <label>Precio Costo USD</label>
            <input id="editCostUsd" type="number" min="0" step="0.01" value="${draft.costUsd || ''}" oninput="onProductDraftChange('${product.id}','costUsd', this.value)" />
          </div>
          <div class="input-group iva-card compact-iva">
            <span>Activar IVA</span>
            <div class="iva-options">
              <button type="button" class="toggle-btn iva-yes ${draft.ivaEnabled ? 'active' : ''}" onclick="toggleProductDraftIva('${product.id}', true)">✔</button>
              <button type="button" class="toggle-btn iva-no ${!draft.ivaEnabled ? 'active' : ''}" onclick="toggleProductDraftIva('${product.id}', false)">✕</button>
            </div>
            <div class="iva-status">${draft.ivaEnabled ? 'IVA activado' : 'IVA desactivado'}</div>
          </div>
          <div class="input-group">
            <label>Precio Costo Bs</label>
            <input id="editCostBs" type="number" min="0" step="0.01" value="${draft.costBs || ''}" oninput="onProductDraftChange('${product.id}','costBs', this.value)" />
          </div>
        </div>
        <div class="edit-row">
          <div class="input-group">
            <label>Precio en USD</label>
            <input id="editPriceUsd" type="number" min="0" step="0.01" value="${draft.priceUsd || ''}" oninput="onProductDraftChange('${product.id}','priceUsd', this.value)" />
          </div>
          <div class="input-group">
            <label>Precio en Bs</label>
            <input id="editPriceBs" type="number" min="0" step="0.01" value="${draft.priceBs || ''}" oninput="onProductDraftChange('${product.id}','priceBs', this.value)" />
          </div>
        </div>
        <div class="edit-row image-edit-row">
          <div class="image-edit-preview" style="background-image: url('${draft.imageUrl || 'https://via.placeholder.com/150'}')">
            <button type="button" class="image-remove-btn ${draft.imageUrl ? '' : 'hidden'}" onclick="onProductDraftChange('${product.id}','imageUrl','')">Eliminar</button>
          </div>
          <div class="input-group file-input-group">
            <label>Actualizar imagen</label>
            <input type="file" accept="image/*" onchange="handleProductImageChange(event, '${product.id}')" />
          </div>
        </div>
        <div class="edit-actions">
          <button type="button" class="button--secondary danger" onclick="cancelProductEdit('${product.id}')">Cancelar</button>
          <button type="button" class="button--primary" onclick="saveProductEdit('${product.id}')">Guardar</button>
        </div>
      </div>
    </div>
  `;
};

window.updInv = (id, f, v) => {
  const p = appState.products.find(x => x.id === id);
  if (p) {
    if (f === 'p') p.priceBs = parseFloat(v) || 0;
    else p.stock = parseInt(v, 10) || 0;
    saveData();
    showToast('Actualizado');
  }
};
window.calculateInventoryTotals = (products) => {
  const totals = products.reduce((acc, product) => {
    const qty = product.type === 'bottle' ? 0 : Number(product.stock || 0);
    const lineBase = product.priceBs * qty;
    const lineIva = productHasIva(product) ? lineBase * 0.16 : 0;
    acc.subtotal += lineBase;
    acc.ivaTotal += lineIva;
    return acc;
  }, { subtotal: 0, ivaTotal: 0 });
  totals.total = totals.subtotal + totals.ivaTotal;
  return totals;
};

window.formatBs = (value) => {
  return Number(value || 0).toFixed(2);
};

window.updateInventoryQuantity = (productId, value) => {
  const product = appState.products.find(p => p.id === productId);
  if (!product || product.type === 'bottle') return;
  product.stock = Math.max(0, parseInt(value, 10) || 0);
  saveData();
  revP(document.getElementById('reviewSearch')?.value || '');
};

window.revP = (q = '') => {
  const prods = appState.products.filter(p => p.name.toLowerCase().includes(q.toLowerCase())).sort((a,b)=>a.name.localeCompare(b.name));
  const totals = calculateInventoryTotals(prods);
  elements.mainContent.innerHTML = `
    <div class="card-panel">
      <div class="section-header">
        <div>
          <h2>Revisar Inventario</h2>
          <p class="section-subtitle">Consulta precios, stock y detalles.</p>
        </div>
      </div>
      <button type="button" class="button--secondary back-btn" onclick="renderInventoryMenu()">← Volver</button>
      <div class="input-group">
        <label for="reviewSearch">Buscar</label>
        <input type="text" id="reviewSearch" placeholder="Buscar..." value="${q}" oninput="revP(this.value)" />
      </div>
      <div class="inventory-table-wrap">
        <table class="inventory-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Precio Unitario</th>
              <th>Cantidad</th>
              <th>IVA (16%)</th>
              <th>Impuesto</th>
              <th>Precio Final</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            ${prods.map((p, index) => {
              const qty = p.type === 'bottle' ? 0 : Number(p.stock || 0);
              const hasIva = productHasIva(p);
              const unitIva = hasIva ? p.priceBs * 0.16 : 0;
              const unitFinal = p.priceBs + unitIva;
              return `
                <tr data-product-id="${p.id}" class="${index % 2 === 0 ? 'zebra' : ''} ${p.isDeleted ? 'pending-delete' : ''}">
                  <td class="product-cell">
                    <strong>${p.name}</strong>
                    <span class="product-meta">${p.type === 'bottle' ? 'Botellón' : 'Producto'}</span>
                  </td>
                  <td>${formatBs(p.priceBs)} Bs</td>
                  <td>
                    ${p.type === 'bottle' ? `
                      <div class="static-text">Indefinido</div>
                    ` : `
                      <input type="number" min="0" class="table-qty-input" value="${qty}" ${p.isDeleted ? 'disabled' : ''} oninput="updateInventoryQuantity('${p.id}', this.value)" />
                    `}
                  </td>
                  <td>${hasIva ? 'Sí' : 'No'}</td>
                  <td>${formatBs(unitIva)} Bs</td>
                  <td>${formatBs(unitFinal)} Bs</td>
                  <td>
                    ${p.type !== 'bottle' ? (p.isDeleted ? `<button type="button" class="icon-btn secondary" onclick="undoDeleteInventoryProduct('${p.id}')">↩</button>` : `<button type="button" class="icon-btn danger" onclick="deleteInventoryProduct('${p.id}')">🗑</button>`) : '<span></span>'}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

      <button type="button" class="button--primary" onclick="saveInventoryChanges()">Guardar Cambios</button>
    </div>
  `;
  renderDeletionConfirmationModal();
}
window.saveBot = () => {
  appState.prices.small = parseFloat(document.getElementById('bS').value) || 0;
  appState.prices.medium = parseFloat(document.getElementById('bM').value) || 0;
  appState.prices.regular = parseFloat(document.getElementById('bR').value) || 0;
  ['small','medium','regular'].forEach(id => { const p = appState.products.find(x=>x.id===id); if(p) p.priceBs = appState.prices[id]; });
  saveData(); showToast('Precios actualizados correctamente.');
};

function getDaySummary(d) {
  const s = (d.sales||[]).reduce((a,x)=>a+(x.total||0),0);
  const iva = (d.sales||[]).reduce((a,x)=>a+(x.montoIVA||0),0);
  const e = (d.expenses||[]).reduce((a,x)=>a+(x.amount||0),0);
  return { totalSales: s, ivaCollected: iva, totalExpense: e, netGain: s-e };
}
function showToast(m, err=false) { elements.toast.textContent = m; elements.toast.style.background = err?'#fee2e2':'#ecfdf5'; elements.toast.classList.remove('hidden'); setTimeout(()=>elements.toast.classList.add('hidden'), 2000); }

window.onload = initializeApp;
