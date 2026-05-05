const appState = {
  roles: {
    employee: { pin: '1234', label: 'Panel Empleado' },
    admin: { pin: '3121', label: 'Panel Administrativo' }
  },
  prices: {
    small: 70,
    medium: 130,
    regular: 260
  },
  currentRole: null,
  currentDayId: null,
  selectedBottle: 'small',
  selectedPayment: 'cash',
  selectedSizes: {},
  salesData: null,
  adminDayIndex: 0
};

async function sendSalesReport(payload) {
  try {
    const response = await fetch('http://localhost:3000/send-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

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
  toast: document.getElementById('toast')
};

const STORAGE_KEYS = {
  prices: 'aqua_prices',
  days: 'aqua_days',
  currentSession: 'aqua_session'
};

async function initializeApp() {
  await loadStorage();
  bindEvents();
  renderLogin();
  window.addEventListener('beforeunload', saveData);
}

async function loadStorage() {
  let storage = null;

  if (window.electronAPI?.loadData) {
    try {
      storage = await window.electronAPI.loadData();
    } catch (error) {
      console.error('Electron storage load failed:', error);
    }
  }

  if (!storage && typeof localStorage !== 'undefined') {
    const prices = localStorage.getItem(STORAGE_KEYS.prices);
    const days = localStorage.getItem(STORAGE_KEYS.days);
    const session = localStorage.getItem(STORAGE_KEYS.currentSession);

    storage = {
      prices: prices ? JSON.parse(prices) : undefined,
      days: days ? JSON.parse(days) : undefined,
      session: session ? JSON.parse(session) : undefined
    };
  }

  if (storage?.prices) appState.prices = storage.prices;
  if (storage?.days) appState.salesData = storage.days;
  else appState.salesData = [];

  if (storage?.session) {
    appState.currentRole = storage.session.role;
    appState.currentDayId = storage.session.currentDayId;
    if (storage.session.role) showAppShell();
  }
}

function saveData() {
  if (window.electronAPI?.saveData) {
    window.electronAPI.saveData({
      prices: appState.prices,
      days: appState.salesData,
      session: { role: appState.currentRole, currentDayId: appState.currentDayId }
    }).catch(error => console.error('Electron save failed:', error));
  }

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.prices, JSON.stringify(appState.prices));
    localStorage.setItem(STORAGE_KEYS.days, JSON.stringify(appState.salesData));
    localStorage.setItem(
      STORAGE_KEYS.currentSession,
      JSON.stringify({ role: appState.currentRole, currentDayId: appState.currentDayId })
    );
  }
}

function bindEvents() {
  elements.loginButton.addEventListener('click', handleLogin);
  elements.logoutButton.addEventListener('click', handleLogout);
  elements.hamburgerButton.addEventListener('click', toggleSidebar);
  elements.loginPin.addEventListener('keydown', event => {
    if (event.key === 'Enter') handleLogin();
  });
}

function toggleSidebar() {
  elements.sidebar.classList.toggle('open');
}

function handleLogin() {
  const pin = elements.loginPin.value.trim();
  if (pin === appState.roles.employee.pin) {
    appState.currentRole = 'employee';
    appState.currentDayId = null;
    saveData();
    showAppShell();
  } else if (pin === appState.roles.admin.pin) {
    appState.currentRole = 'admin';
    appState.currentDayId = null;
    saveData();
    showAppShell();
  } else {
    elements.loginError.textContent = 'PIN incorrecto. Intenta con 1234.';
  }
}

function handleLogout() {
  appState.currentRole = null;
  appState.currentDayId = null;
  saveData();
  renderLogin();
}

function renderLogin() {
  elements.hero.classList.remove('hidden');
  elements.appShell.classList.add('hidden');
  elements.loginError.textContent = '';
  elements.loginPin.value = '';
}

function showAppShell() {
  elements.hero.classList.add('hidden');
  elements.appShell.classList.remove('hidden');
  elements.sidebarRole.textContent = appState.roles[appState.currentRole].label;
  renderSidebar();
  if (appState.currentRole === 'employee') renderEmployeeContent('openDay');
  else renderAdminContent('dailyLog');
}

function renderSidebar() {
  elements.sidebarMenu.innerHTML = '';
  let menuItems;
  
  if (appState.currentRole === 'employee') {
    if (appState.currentDayId) {
      menuItems = [
        { key: 'registerSales', label: 'Registrar Ventas' },
        { key: 'registerExpenses', label: 'Registrar Gastos' },
        { key: 'closeDay', label: 'Cerrar Día' }
      ];
    } else {
      menuItems = [
        { key: 'openDay', label: 'Abrir Día' }
      ];
    }
  } else {
    menuItems = [
      { key: 'dailyLog', label: 'Registro del Día' },
      { key: 'modifyPrices', label: 'Modificar Precios' },
      { key: 'weeklyGraph', label: 'Gráfica Semanal' }
    ];
  }

  menuItems.forEach(item => {
    const button = document.createElement('button');
    button.textContent = item.label;
    button.dataset.key = item.key;
    button.addEventListener('click', () => {
      if (appState.currentRole === 'employee') renderEmployeeContent(item.key);
      else renderAdminContent(item.key);
      setActiveSidebarButton(item.key);
    });
    elements.sidebarMenu.appendChild(button);
  });
  setActiveSidebarButton(menuItems[0].key);
}

function setActiveSidebarButton(key) {
  [...elements.sidebarMenu.children].forEach(btn => {
    btn.classList.toggle('active', btn.dataset.key === key);
  });
}

function renderEmployeeContent(section) {
  switch (section) {
    case 'openDay': return renderOpenDay();
    case 'registerSales': return renderRegisterSales();
    case 'registerExpenses': return renderRegisterExpenses();
    case 'closeDay': return renderCloseDay();
    default: renderOpenDay();
  }
}

function renderAdminContent(section) {
  switch (section) {
    case 'dailyLog': return renderDailyLog();
    case 'modifyPrices': return renderModifyPrices();
    case 'weeklyGraph': return renderWeeklyGraph();
    default: renderDailyLog();
  }
}

function getCurrentDay() {
  if (!appState.currentDayId) return null;
  return appState.salesData.find(day => day.id === appState.currentDayId) || null;
}

function formatDateLabel(date) {
  return new Intl.DateTimeFormat('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(date);
}

function todayId() {
  return new Date().toISOString();
}

function openNewDay() {
  const id = todayId();
  const newDay = {
    id,
    date: new Date().toISOString(),
    sales: [],
    expenses: []
  };
  appState.salesData.push(newDay);
  appState.currentDayId = id;
  saveData();
  showToast('Día abierto exitosamente.');
  renderSidebar();
  renderEmployeeContent('openDay');
}

function renderOpenDay() {
  const currentDay = getCurrentDay();
  if (!currentDay) {
    elements.mainContent.innerHTML = `
      <div class="card-panel">
        <div class="section-header">
          <div>
            <h2>Bienvenido</h2>
            <p class="section-subtitle">Para comenzar a registrar ventas y gastos, primero debe abrir el día.</p>
          </div>
        </div>
        <div class="button-group">
          <button class="primary-btn" id="openDayButton">Abrir Día</button>
        </div>
      </div>
    `;
    document.getElementById('openDayButton').addEventListener('click', () => {
      openNewDay();
    });
    return;
  }

  const sizeCounts = getSizeCounts(currentDay);
  const paymentMethods = getPaymentMethodStats(currentDay);
  elements.mainContent.innerHTML = `
    <div class="section-header">
      <div>
        <h2>Resumen del Día</h2>
        <p class="section-subtitle">Dashboard diario con botellas y métodos de pago.</p>
      </div>
    </div>
    <div class="card-panel">
      <h3>Botellas por Tamaño</h3>
      <div class="summary-grid">
        <div class="stat-card"><h3>Pequeño</h3><p>${sizeCounts.small}</p></div>
        <div class="stat-card"><h3>Mediano</h3><p>${sizeCounts.medium}</p></div>
        <div class="stat-card"><h3>Normal</h3><p>${sizeCounts.regular}</p></div>
      </div>
    </div>
    <div class="card-panel">
      <h3>Métodos de Pago</h3>
      <div class="summary-grid">
        <div class="stat-card"><h3>Efectivo</h3><p>${paymentMethods.Efectivo}</p></div>
        <div class="stat-card"><h3>Pago Móvil</h3><p>${paymentMethods['Pago Móvil']}</p></div>
        <div class="stat-card"><h3>Efectivo + Pago Móvil</h3><p>${paymentMethods['Efectivo + Pago Móvil']}</p></div>
      </div>
    </div>
  `;
}

function renderRegisterSales() {
  if (!getCurrentDay()) {
    renderOpenDay();
    return;
  }
  appState.selectedPayment = 'cash';
  appState.selectedSizes = appState.selectedSizes || {};
  elements.mainContent.innerHTML = `
    <div class="section-header">
      <div>
        <h2>Registrar Venta</h2>
        <p class="section-subtitle">Selecciona uno o más tamaños y define la cantidad de cada uno.</p>
      </div>
    </div>
    <div class="grid-3" id="bottleOptions"></div>
    <div class="card-panel">
      <div id="salesSummary" class="section-subtitle" style="margin-bottom: 18px;">Seleccione al menos un tamaño.</div>
      <button class="primary-btn" id="continuePayment">Continuar a Método de Pago</button>
    </div>
  `;

  renderBottleOptions();
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
    const selected = appState.selectedSizes[option.key] > 0;
    return `
      <div class="tile ${selected ? 'selected' : ''}" data-key="${option.key}">
        <p class="tile-title">${option.label}</p>
        <p class="tile-price">${option.price} Bs</p>
        ${selected ? `
          <div class="input-group" style="margin-top: 18px;">
            <label>Cantidad</label>
            <input type="number" class="size-quantity" data-size="${option.key}" min="1" value="${appState.selectedSizes[option.key]}" />
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  container.querySelectorAll('.tile').forEach(tile => {
    tile.addEventListener('click', () => {
      const size = tile.dataset.key;
      if (appState.selectedSizes[size]) {
        delete appState.selectedSizes[size];
      } else {
        appState.selectedSizes[size] = 1;
      }
      renderBottleOptions();
      updateSaleSummary();
      bindQuantityInputs();
    });
  });

  bindQuantityInputs();
}

function bindQuantityInputs() {
  document.querySelectorAll('.size-quantity').forEach(input => {
    input.addEventListener('input', event => {
      const size = event.target.dataset.size;
      const value = parseInt(event.target.value, 10);
      if (value > 0) {
        appState.selectedSizes[size] = value;
      } else {
        delete appState.selectedSizes[size];
      }
      updateSaleSummary();
      renderBottleOptions();
    });
  });
}

function updateSaleSummary() {
  const summary = getSaleSelectionSummary();
  const summaryEl = document.getElementById('salesSummary');
  if (!summaryEl) return;
  if (summary.totalAmount === 0) {
    summaryEl.textContent = 'Seleccione al menos un tamaño.';
    return;
  }
  summaryEl.innerHTML = `
    <strong>Total Botellas:</strong> ${summary.totalQuantity} / <strong>Total:</strong> ${summary.totalAmount.toFixed(2)} Bs
  `;
}

function getSaleSelectionSummary() {
  const bottleList = [
    { key: 'small', price: appState.prices.small },
    { key: 'medium', price: appState.prices.medium },
    { key: 'regular', price: appState.prices.regular }
  ];
  const selectedSizes = appState.selectedSizes || {};
  let totalQuantity = 0;
  let totalAmount = 0;
  bottleList.forEach(bottle => {
    const qty = selectedSizes[bottle.key] || 0;
    totalQuantity += qty;
    totalAmount += qty * bottle.price;
  });
  return { totalQuantity, totalAmount };
}

function renderPaymentMethod() {
  const currentDay = getCurrentDay();
  if (!currentDay) {
    showToast('Abra el día antes de registrar una venta.', true);
    renderOpenDay();
    return;
  }
  const summary = getSaleSelectionSummary();
  if (summary.totalQuantity === 0) {
    showToast('Seleccione al menos un tamaño para continuar.', true);
    return;
  }
  appState.selectedPayment = 'cash';
  elements.mainContent.innerHTML = `
    <div class="section-header">
      <div>
        <h2>Método de Pago</h2>
        <p class="section-subtitle">Confirme el pago y registre la venta.</p>
      </div>
    </div>
    <div class="card-panel">
      <div class="summary-grid">
        <div class="stat-card"><h3>Total Botellas</h3><p>${summary.totalQuantity}</p></div>
        <div class="stat-card"><h3>Total Venta</h3><p>${summary.totalAmount.toFixed(2)} Bs</p></div>
      </div>
      <div class="section-header" style="margin-top: 18px;">
        <div>
          <h3 class="section-subtitle">Tamaños seleccionados</h3>
          <p>${formatSelectedSizesPreview()}</p>
        </div>
      </div>
      <div class="button-group" id="paymentOptions">
        <button type="button" class="small-btn active" data-method="cash">Efectivo</button>
        <button type="button" class="small-btn" data-method="mobile">Pago Móvil</button>
        <button type="button" class="small-btn" data-method="both">Efectivo + Pago Móvil</button>
      </div>
      <div class="input-group" id="cashContainer">
        <label for="cashAmount">Monto efectivo</label>
        <input type="number" id="cashAmount" min="0" step="0.01" value="${summary.totalAmount.toFixed(2)}" />
      </div>
      <div class="input-group hidden" id="mobileContainer">
        <label for="mobileAmount">Monto pago móvil</label>
        <input type="number" id="mobileAmount" min="0" step="0.01" value="${summary.totalAmount.toFixed(2)}" />
      </div>
      <div class="input-group hidden" id="referenceContainer">
        <label for="mobileReference">Referencia (máx. 4 dígitos)</label>
        <input type="text" id="mobileReference" maxlength="4" placeholder="1234" />
      </div>
      <button class="primary-btn" id="registerSaleButton">Registrar Venta</button>
    </div>
  `;
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
  document.querySelectorAll('#paymentOptions button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.method === method);
  });
  document.getElementById('cashContainer').classList.toggle('hidden', appState.selectedPayment === 'mobile');
  document.getElementById('mobileContainer').classList.toggle('hidden', appState.selectedPayment === 'cash');
  document.getElementById('referenceContainer').classList.toggle('hidden', appState.selectedPayment === 'cash');
  if (appState.selectedPayment === 'cash') {
    document.getElementById('cashAmount').value = (getSaleSelectionSummary().totalAmount).toFixed(2);
    document.getElementById('mobileAmount').value = '0';
  } else if (appState.selectedPayment === 'mobile') {
    document.getElementById('cashAmount').value = '0';
    document.getElementById('mobileAmount').value = (getSaleSelectionSummary().totalAmount).toFixed(2);
  } else {
    document.getElementById('cashAmount').value = '0';
    document.getElementById('mobileAmount').value = (getSaleSelectionSummary().totalAmount).toFixed(2);
  }
}

function updatePaymentFields() {
  document.getElementById('cashContainer').classList.toggle('hidden', appState.selectedPayment === 'mobile');
  document.getElementById('mobileContainer').classList.toggle('hidden', appState.selectedPayment === 'cash');
  document.getElementById('referenceContainer').classList.toggle('hidden', appState.selectedPayment === 'cash');
  if (appState.selectedPayment === 'cash') {
    document.getElementById('cashAmount').value = (appState.prices[appState.selectedBottle] * appState.salesQuantity).toFixed(2);
    document.getElementById('mobileAmount').value = '0';
  } else if (appState.selectedPayment === 'mobile') {
    document.getElementById('cashAmount').value = '0';
    document.getElementById('mobileAmount').value = (appState.prices[appState.selectedBottle] * appState.salesQuantity).toFixed(2);
  } else {
    document.getElementById('cashAmount').value = '0';
    document.getElementById('mobileAmount').value = (appState.prices[appState.selectedBottle] * appState.salesQuantity).toFixed(2);
  }
}

function registerSale() {
  const currentDay = getCurrentDay();
  if (!currentDay) {
    showToast('Debe abrir el día antes de registrar ventas.', true);
    return;
  }

  let cashAmount = parseFloat(document.getElementById('cashAmount').value);
  let mobileAmount = parseFloat(document.getElementById('mobileAmount').value);
  const reference = document.getElementById('mobileReference').value.trim();
  const summary = getSaleSelectionSummary();
  const expectedTotal = summary.totalAmount;

  cashAmount = isNaN(cashAmount) ? 0 : cashAmount;
  mobileAmount = isNaN(mobileAmount) ? 0 : mobileAmount;

  if (appState.selectedPayment === 'cash' && cashAmount <= 0) {
    cashAmount = expectedTotal;
  }

  if (appState.selectedPayment === 'mobile' && mobileAmount <= 0) {
    mobileAmount = expectedTotal;
  }

  let total = cashAmount + mobileAmount;

  if (appState.selectedPayment === 'mobile' || appState.selectedPayment === 'both') {
    if (!reference || reference.length !== 4 || !/^[0-9]+$/.test(reference)) {
      showToast('Referencia móvil debe tener 4 dígitos.', true);
      return;
    }
  }

  if (Math.abs(total - expectedTotal) > 0.01) {
    showToast(`El total debe ser ${expectedTotal.toFixed(2)} Bs.`, true);
    return;
  }

  const sale = {
    id: crypto.randomUUID(),
    time: new Date().toISOString(),
    sizes: { ...appState.selectedSizes },
    paymentMethod: appState.selectedPayment === 'mobile' ? 'Pago Móvil' : appState.selectedPayment === 'cash' ? 'Efectivo' : 'Efectivo + Pago Móvil',
    cashAmount,
    mobileAmount,
    reference: reference || '-',
    total: total
  };
  currentDay.sales.push(sale);
  appState.selectedSizes = {};
  saveData();
  showToast('Venta registrada correctamente.');
  renderOpenDay();
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
        <p class="section-subtitle">Anote el motivo y el monto del gasto.</p>
      </div>
    </div>
    <div class="card-panel">
      <div class="input-group">
        <label for="expenseReason">Motivo</label>
        <input type="text" id="expenseReason" placeholder="Ej. Refacción del surtidor" />
      </div>
      <div class="input-group">
        <label for="expenseAmount">Monto</label>
        <input type="number" id="expenseAmount" min="0" step="0.01" placeholder="0.00" />
      </div>
      <button class="primary-btn" id="registerExpenseButton">Registrar Gasto</button>
    </div>
  `;
  document.getElementById('registerExpenseButton').addEventListener('click', () => {
    const reason = document.getElementById('expenseReason').value.trim();
    const amount = parseFloat(document.getElementById('expenseAmount').value) || 0;
    if (!reason || amount <= 0) {
      showToast('Ingrese un motivo y un monto válido.', true);
      return;
    }
    const currentDay = getCurrentDay();
    currentDay.expenses.push({ id: crypto.randomUUID(), time: new Date().toISOString(), reason, amount });
    saveData();
    showToast('Gasto registrado correctamente.');
    renderOpenDay();
  });
}

function renderCloseDay() {
  if (!getCurrentDay()) {
    renderOpenDay();
    return;
  }
  elements.mainContent.innerHTML = `
    <div class="section-header">
      <div>
        <h2>Cerrar Día</h2>
        <p class="section-subtitle">Ingrese su contraseña para cerrar el día y cerrar sesión.</p>
      </div>
    </div>
    <div class="card-panel">
      <div class="input-group">
        <label for="closePassword">Contraseña</label>
        <input type="password" id="closePassword" placeholder="Su PIN" />
      </div>
      <button class="primary-btn" id="confirmCloseDay">Cerrar Día</button>
    </div>
  `;
  document.getElementById('confirmCloseDay').addEventListener('click', () => {
    const password = document.getElementById('closePassword').value.trim();
    if (password !== appState.roles.employee.pin) {
      showToast('Contraseña incorrecta para cerrar el día.', true);
      return;
    }
    appState.currentDayId = null;
    saveData();
    showToast('Día cerrado correctamente.');
    handleLogout();
  });
}

function renderDailyLog() {
  const days = [...appState.salesData].sort((a, b) => b.id.localeCompare(a.id));
  if (days.length === 0) {
    elements.mainContent.innerHTML = `
      <div class="card-panel">
        <div class="section-header">
          <div>
            <h2>Registro del Día</h2>
            <p class="section-subtitle">Aún no hay días registrados.</p>
          </div>
        </div>
      </div>
    `;
    return;
  }
  appState.adminDayIndex = Math.min(appState.adminDayIndex, days.length - 1);
  const selectedDay = days[appState.adminDayIndex];
  const summary = getDaySummary(selectedDay);
  const sizeTotals = getSizeCounts(selectedDay);
  const paymentTotals = getPaymentMethodStats(selectedDay);
  elements.mainContent.innerHTML = `
    <div class="card-panel">
      <div class="section-header">
        <div>
          <h2>Registro del Día</h2>
          <p class="section-subtitle">Resumen de ventas y gastos registrados.</p>
        </div>
      </div>
      <div class="input-group">
        <label for="daySelect">Seleccione un día</label>
        <select id="daySelect">${days.map((day, index) => {
          const daySummary = getDaySummary(day);
          return `
            <option value="${index}" ${index === appState.adminDayIndex ? 'selected' : ''}>
              ${formatDateLabel(new Date(day.date))} ${new Date(day.date).toLocaleTimeString('es-ES')} - Ganancia: ${daySummary.netGain.toFixed(2)} Bs
            </option>
          `;
        }).join('')}</select>
      </div>
    </div>
    <div class="summary-grid">
      <div class="stat-card"><h3>Total de Días</h3><p>${days.length}</p></div>
      <div class="stat-card"><h3>Ventas Totales</h3><p>${summary.totalSales.toFixed(2)} Bs</p></div>
      <div class="stat-card"><h3>Ganancia Total</h3><p>${summary.netGain.toFixed(2)} Bs</p></div>
    </div>
    <div class="card-panel">
      <h3>Resumen del ${formatDateLabel(new Date(selectedDay.date))}</h3>
      <div class="summary-grid">
        <div class="stat-card"><h3>Ventas</h3><p>${summary.totalSales.toFixed(2)} Bs</p></div>
        <div class="stat-card"><h3>Gastos</h3><p>${summary.totalExpense.toFixed(2)} Bs</p></div>
        <div class="stat-card"><h3>Ganancia Neta</h3><p>${summary.netGain.toFixed(2)} Bs</p></div>
      </div>
    </div>
    <div class="card-panel">
      <h3>Botellas por Tamaño</h3>
      <div class="summary-grid">
        <div class="stat-card"><h3>Pequeño</h3><p>${sizeTotals.small}</p></div>
        <div class="stat-card"><h3>Mediano</h3><p>${sizeTotals.medium}</p></div>
        <div class="stat-card"><h3>Normal</h3><p>${sizeTotals.regular}</p></div>
      </div>
    </div>
    <div class="card-panel">
      <h3>Métodos de Pago</h3>
      <div class="summary-grid">
        <div class="stat-card"><h3>Efectivo</h3><p>${paymentTotals.Efectivo}</p></div>
        <div class="stat-card"><h3>Pago Móvil</h3><p>${paymentTotals['Pago Móvil']}</p></div>
        <div class="stat-card"><h3>Efectivo + Pago Móvil</h3><p>${paymentTotals['Efectivo + Pago Móvil']}</p></div>
      </div>
    </div>
    <div class="card-panel">
      <div style="overflow-x:auto;">
        <table class="table-panel">
          <thead>
            <tr><th>Hora</th><th>Tamaño</th><th>Cantidad</th><th>Método de Pago</th><th>Referencia</th><th>Monto</th></tr>
          </thead>
          <tbody>${selectedDay.sales.map(sale => `
            <tr>
              <td>${new Date(sale.time).toLocaleTimeString('es-ES')}</td>
              <td>${translateSaleSizes(sale)}</td>
              <td>${getSaleQuantity(sale)}</td>
              <td>${sale.paymentMethod}</td>
              <td>${sale.reference}</td>
              <td>${sale.total.toFixed(2)} Bs</td>
            </tr>
          `).join('')}</tbody>
        </table>
      </div>
      <div style="margin-top: 24px; overflow-x:auto;">
        <table class="table-panel">
          <thead><tr><th>Hora</th><th>Motivo</th><th>Monto</th></tr></thead>
          <tbody>${selectedDay.expenses.map(expense => `
            <tr>
              <td>${new Date(expense.time).toLocaleTimeString('es-ES')}</td>
              <td>${expense.reason}</td>
              <td>${expense.amount.toFixed(2)} Bs</td>
            </tr>
          `).join('')}</tbody>
        </table>
      </div>
    </div>
  `;
  document.getElementById('daySelect').addEventListener('change', event => {
    appState.adminDayIndex = Number(event.target.value);
    renderDailyLog();
  });
  
  const deleteButton = document.createElement('button');
  deleteButton.textContent = 'Eliminar Día';
  deleteButton.className = 'secondary-btn';
  deleteButton.style.background = '#fee2e2';
  deleteButton.style.color = '#991b1b';
  deleteButton.style.marginTop = '16px';
  deleteButton.addEventListener('click', () => {
    if (confirm(`¿Está seguro de que desea eliminar el día ${formatDateLabel(new Date(selectedDay.date))}? Esta acción no se puede deshacer.`)) {
      appState.salesData = appState.salesData.filter(day => day.id !== selectedDay.id);
      saveData();
      showToast('Día eliminado correctamente.');
      renderDailyLog();
    }
  });
  document.querySelector('.card-panel').appendChild(deleteButton);
}

function translateSize(key) {
  return key === 'small' ? 'Pequeño' : key === 'medium' ? 'Mediano' : 'Normal';
}

function getDaySummary(day) {
  const totalSales = day.sales.reduce((sum, sale) => sum + sale.total, 0);
  const totalExpense = day.expenses.reduce((sum, item) => sum + item.amount, 0);
  return {
    totalSales,
    totalExpense,
    netGain: totalSales - totalExpense,
    totalBottles: day.sales.reduce((sum, sale) => sum + getSaleQuantity(sale), 0)
  };
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

function getPaymentMethodStats(day) {
  return day.sales.reduce((counts, sale) => {
    const method = sale.paymentMethod || 'Efectivo';
    counts[method] = (counts[method] || 0) + 1;
    return counts;
  }, { 'Efectivo': 0, 'Pago Móvil': 0, 'Efectivo + Pago Móvil': 0 });
}

function translateSaleSizes(sale) {
  if (sale.sizes) {
    return Object.entries(sale.sizes)
      .filter(([, qty]) => qty > 0)
      .map(([size, qty]) => `${qty}x ${translateSize(size)}`)
      .join(', ');
  }
  return `${sale.quantity || 0}x ${translateSize(sale.size)}`;
}

function getSaleQuantity(sale) {
  if (sale.sizes) {
    return Object.values(sale.sizes).reduce((sum, qty) => sum + qty, 0);
  }
  return sale.quantity || 0;
}

function renderModifyPrices() {
  elements.mainContent.innerHTML = `
    <div class="section-header">
      <div>
        <h2>Modificar Precios</h2>
        <p class="section-subtitle">Actualice el precio de cada tamaño de botella.</p>
      </div>
    </div>
    <div class="card-panel">
      <div class="input-group">
        <label for="priceSmall">Pequeño</label>
        <input type="number" id="priceSmall" min="0" step="0.01" value="${appState.prices.small}" />
      </div>
      <div class="input-group">
        <label for="priceMedium">Mediano</label>
        <input type="number" id="priceMedium" min="0" step="0.01" value="${appState.prices.medium}" />
      </div>
      <div class="input-group">
        <label for="priceRegular">Normal</label>
        <input type="number" id="priceRegular" min="0" step="0.01" value="${appState.prices.regular}" />
      </div>
      <button class="primary-btn" id="savePricesButton">Guardar Precios</button>
    </div>
  `;
  document.getElementById('savePricesButton').addEventListener('click', () => {
    const small = parseFloat(document.getElementById('priceSmall').value) || 0;
    const medium = parseFloat(document.getElementById('priceMedium').value) || 0;
    const regular = parseFloat(document.getElementById('priceRegular').value) || 0;
    if (small <= 0 || medium <= 0 || regular <= 0) {
      showToast('Ingrese precios válidos para todos los tamaños.', true);
      return;
    }
    appState.prices = { small, medium, regular };
    saveData();
    showToast('Precios actualizados correctamente.');
    renderModifyPrices();
  });
}

function renderWeeklyGraph() {
  const summaryByDay = buildWeeklySummary();
  if (summaryByDay.length === 0) {
    elements.mainContent.innerHTML = `
      <div class="card-panel">
        <div class="section-header">
          <div>
            <h2>Gráfica Semanal</h2>
            <p class="section-subtitle">Ventas registradas por día de la semana.</p>
          </div>
        </div>
        <p>No hay datos suficientes para mostrar la gráfica.</p>
      </div>
    `;
    return;
  }
  elements.mainContent.innerHTML = `
    <div class="section-header">
      <div>
        <h2>Gráfica Semanal</h2>
        <p class="section-subtitle">Ventas registradas por día de la semana.</p>
      </div>
    </div>
    <div class="card-panel">
      <div class="chart-bars">
        ${summaryByDay.map(item => `
          <div class="chart-bar">
            <span class="chart-value">${item.value.toFixed(2)} Bs</span>
            <div class="chart-rect" style="height: ${item.height}%" title="${item.value.toFixed(2)} Bs"></div>
            <span class="chart-label">${item.label}</span>
            <span class="chart-detail">${item.totalBottles} botellas</span>
            <span class="chart-breakdown">${item.sizeBreakdown}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function buildWeeklySummary() {
  const sortedDays = [...appState.salesData].sort((a, b) => new Date(a.date) - new Date(b.date));
  const lastSeven = sortedDays.slice(-7);
  const maxTotal = Math.max(...lastSeven.map(day => day.sales.reduce((sum, sale) => sum + sale.total, 0)), 1);

  return lastSeven.map(day => {
    const total = day.sales.reduce((sum, sale) => sum + sale.total, 0);
    const sizeCounts = day.sales.reduce((counts, sale) => {
      const sizes = sale.sizes || {};
      Object.entries(sizes).forEach(([size, qty]) => {
        counts[size] = (counts[size] || 0) + qty;
      });
      return counts;
    }, { small: 0, medium: 0, regular: 0 });
    const totalBottles = Object.values(sizeCounts).reduce((sum, qty) => sum + qty, 0);
    const sizeBreakdown = [
      sizeCounts.small ? `${sizeCounts.small}xP` : null,
      sizeCounts.medium ? `${sizeCounts.medium}xM` : null,
      sizeCounts.regular ? `${sizeCounts.regular}xN` : null
    ].filter(Boolean).join(' • ');

    return {
      label: formatDayShort(new Date(day.date)),
      height: Math.max((total / maxTotal) * 100, 10),
      value: total,
      totalBottles,
      sizeBreakdown: sizeBreakdown || '0 botellas'
    };
  });
}

function formatDayShort(date) {
  return new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric' }).format(date);
}

function showToast(message, isError = false) {
  elements.toast.textContent = message;
  elements.toast.classList.toggle('hidden', false);
  elements.toast.style.borderColor = isError ? '#fecdd3' : 'rgba(22, 163, 74, 0.18)';
  elements.toast.style.background = isError ? '#fef2f2' : '#ecfdf5';
  elements.toast.style.color = isError ? '#991b1b' : 'var(--success)';
  setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, 2600);
}

function getTotalGain() {
  return appState.salesData.reduce((sum, day) => {
    const sales = day.sales.reduce((s, sale) => s + sale.total, 0);
    const expenses = day.expenses.reduce((s, expense) => s + expense.amount, 0);
    return sum + (sales - expenses);
  }, 0);
}

function renderDatabase() {
  elements.mainContent.innerHTML = `
    <div class="section-header">
      <div>
        <h2>Base de Datos</h2>
        <p class="section-subtitle">Exportar e importar datos de la aplicación</p>
      </div>
    </div>
    <div class="card-panel">
      <h3>Exportar Datos</h3>
      <p style="color: var(--muted); margin-bottom: 16px;">Descargue toda la información (ventas, gastos, precios) en formato JSON</p>
      <button class="primary-btn" id="exportButton">Descargar Base de Datos</button>
    </div>
    <div class="card-panel">
      <h3>Importar Datos</h3>
      <p style="color: var(--muted); margin-bottom: 16px;">Cargue un archivo JSON previamente exportado para restaurar datos</p>
      <input type="file" id="importFile" accept=".json" style="padding: 10px; margin-bottom: 16px; border: 1px solid #e6ebf5; border-radius: 8px; width: 100%; cursor: pointer;" />
      <button class="primary-btn" id="importButton">Importar Base de Datos</button>
    </div>
    <div class="card-panel">
      <h3>Información del Sistema</h3>
      <div style="background: rgba(79, 114, 255, 0.08); padding: 14px; border-radius: 12px;">
        <p><strong>Total de Días:</strong> ${appState.salesData.length}</p>
        <p><strong>Total de Ventas:</strong> ${appState.salesData.reduce((sum, day) => sum + day.sales.length, 0)}</p>
        <p><strong>Total de Gastos:</strong> ${appState.salesData.reduce((sum, day) => sum + day.expenses.length, 0)}</p>
        <p><strong>Ganancia Total:</strong> ${getTotalGain().toFixed(2)} Bs</p>
      </div>
    </div>
  `;
  
  document.getElementById('exportButton').addEventListener('click', exportDatabase);
  document.getElementById('importButton').addEventListener('click', importDatabase);
}

function exportDatabase() {
  const dataToExport = {
    timestamp: new Date().toISOString(),
    prices: appState.prices,
    salesData: appState.salesData
  };
  
  const dataStr = JSON.stringify(dataToExport, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `aquamanager-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast('Base de datos exportada correctamente.');
}

function importDatabase() {
  const fileInput = document.getElementById('importFile');
  const file = fileInput.files[0];
  
  if (!file) {
    showToast('Seleccione un archivo para importar.', true);
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      
      if (imported.prices && imported.salesData) {
        if (confirm('¿Está seguro de que desea importar estos datos? Se reemplazarán los datos actuales.')) {
          appState.prices = imported.prices;
          appState.salesData = imported.salesData;
          saveData();
          showToast('Base de datos importada correctamente.');
          renderDatabase();
        }
      } else {
        showToast('Archivo inválido. Por favor, use un archivo exportado de Ronatug.', true);
      }
    } catch (error) {
      showToast('Error al leer el archivo: ' + error.message, true);
    }
  };
  reader.readAsText(file);
}

initializeApp();
