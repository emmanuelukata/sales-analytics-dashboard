/**
 * Sales Analytics Dashboard - Pure Vanilla JavaScript
 * Zero external libraries, zero backend, persistent LocalStorage engine.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'sales_dashboard_records_v1';

  // Available categories & channels
  const CATEGORIES = ['Software', 'Subscription', 'Services', 'Consulting', 'Hardware'];
  const CHANNELS = ['Direct Web', 'Enterprise Sales', 'Partner Referral', 'In-App Upgrade'];
  const CATEGORY_COLORS = {
    'Software': '#3b82f6',
    'Subscription': '#10b981',
    'Services': '#8b5cf6',
    'Consulting': '#f59e0b',
    'Hardware': '#06b6d4'
  };

  // State
  let salesData = [];
  let currentPeriod = 30; // days, or 'all'
  let currentStatus = 'ALL';
  let searchTerm = '';
  let sortColumn = 'date';
  let sortDirection = 'desc'; // 'asc' | 'desc'
  let currentPage = 1;
  const rowsPerPage = 8;

  // Chart hover states
  let hoveredTrendPoint = null;
  let hoveredCategoryIndex = -1;

  // ==========================================================================
  // Sample Data Generation
  // ==========================================================================
  function generateDefaultSales() {
    const products = [
      { name: 'Enterprise Cloud Suite', category: 'Software', min: 1400, max: 3200 },
      { name: 'Team Pro Subscription', category: 'Subscription', min: 180, max: 480 },
      { name: 'Developer Workspace License', category: 'Software', min: 250, max: 650 },
      { name: 'Cloud Architecture Audit', category: 'Consulting', min: 900, max: 2100 },
      { name: 'Dedicated Support Retainer', category: 'Services', min: 500, max: 1500 },
      { name: 'Security Token Bundle', category: 'Hardware', min: 120, max: 350 },
      { name: 'API Rate Limit Booster', category: 'Subscription', min: 89, max: 220 },
      { name: 'Custom Implementation Sprint', category: 'Services', min: 1800, max: 4200 },
      { name: 'IoT Edge Gateway Box', category: 'Hardware', min: 380, max: 820 },
      { name: 'Compliance & GDPR Advisory', category: 'Consulting', min: 750, max: 1600 }
    ];

    const customerNames = [
      'Acme Global Corp', 'Starlight Technologies', 'Nexus Financial', 'Quantum Dynamics',
      'Hyperion Media', 'Apex Logistics', 'BluePeak Software', 'Vanguard Health',
      'Beacon Retailers', 'Aura Labs Inc', 'Pacific Capital', 'Summit Robotics',
      'Horizon Media', 'Pulse BioTech', 'Ironclad Systems', 'Helios Energy',
      'Orbit eCommerce', 'Vertex Cloud Ltd', 'Silverline Capital', 'Krypton Interactive'
    ];

    const results = [];
    const now = new Date();

    // Generate 75 realistic sales records spread over the last 90 days
    for (let i = 1; i <= 75; i++) {
      const prod = products[Math.floor(Math.random() * products.length)];
      const customer = customerNames[Math.floor(Math.random() * customerNames.length)];
      const channel = CHANNELS[Math.floor(Math.random() * CHANNELS.length)];

      // Days ago (higher density in recent weeks)
      const dayOffset = Math.floor(Math.pow(Math.random(), 1.25) * 88);
      const saleDate = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);

      // Amount with cents
      const rawAmt = prod.min + Math.random() * (prod.max - prod.min);
      const amount = Math.round(rawAmt * 100) / 100;

      // Status probabilities: 84% Completed, 10% Pending, 6% Refunded
      const randStatus = Math.random();
      let status = 'Completed';
      if (randStatus > 0.94) {
        status = 'Refunded';
      } else if (randStatus > 0.84) {
        status = 'Pending';
      }

      const idNumber = 1000 + i;
      results.push({
        id: 'ORD-' + idNumber,
        customer: customer,
        product: prod.name,
        category: prod.category,
        channel: channel,
        amount: amount,
        date: saleDate.toISOString().slice(0, 10),
        status: status
      });
    }

    // Sort descending by date initially
    results.sort((a, b) => new Date(b.date) - new Date(a.date));
    return results;
  }

  // ==========================================================================
  // Storage Management
  // ==========================================================================
  function loadData() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          salesData = parsed;
          return;
        }
      }
    } catch (e) {
      console.warn('Could not read from localStorage, using fallback data.', e);
    }

    // Generate and save initial data
    salesData = generateDefaultSales();
    saveData();
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(salesData));
      const statusEl = document.getElementById('storage-status');
      if (statusEl) {
        statusEl.textContent = 'Saved Locally (' + salesData.length + ' records)';
      }
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  }

  // ==========================================================================
  // Filtering & Aggregation Logic
  // ==========================================================================
  function getFilteredByTimeframe(dataList, periodDays) {
    if (periodDays === 'all') return [...dataList];
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - parseInt(periodDays, 10));

    return dataList.filter(item => {
      const itemDate = new Date(item.date + 'T00:00:00');
      return itemDate >= cutoff;
    });
  }

  function getPriorPeriodData(periodDays) {
    if (periodDays === 'all') return [];
    const days = parseInt(periodDays, 10);
    const endCutoff = new Date();
    endCutoff.setHours(0, 0, 0, 0);
    endCutoff.setDate(endCutoff.getDate() - days);

    const startCutoff = new Date(endCutoff);
    startCutoff.setDate(startCutoff.getDate() - days);

    return salesData.filter(item => {
      const itemDate = new Date(item.date + 'T00:00:00');
      return itemDate >= startCutoff && itemDate < endCutoff;
    });
  }

  function formatCurrency(val) {
    return '$' + Number(val || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function formatCompactCurrency(val) {
    const num = Number(val || 0);
    if (num >= 1000000) return '$' + (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return '$' + (num / 1000).toFixed(1) + 'k';
    return '$' + num.toFixed(0);
  }

  // ==========================================================================
  // Dashboard Metrics & Rendering
  // ==========================================================================
  function updateDashboard() {
    const timeframeData = getFilteredByTimeframe(salesData, currentPeriod);
    const priorPeriodData = getPriorPeriodData(currentPeriod);

    // Filtered by status for calculations
    const completedSales = timeframeData.filter(d => d.status === 'Completed');
    const refundedSales = timeframeData.filter(d => d.status === 'Refunded');
    const pendingSales = timeframeData.filter(d => d.status === 'Pending');

    const totalRevenue = completedSales.reduce((acc, curr) => acc + curr.amount, 0);
    const totalOrders = completedSales.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const netProfitEst = totalRevenue * 0.68;
    const completionRate = timeframeData.length > 0 
      ? Math.round((completedSales.length / timeframeData.length) * 100) 
      : 100;

    // Prior calculations for comparison trends
    const priorCompleted = priorPeriodData.filter(d => d.status === 'Completed');
    const priorRevenue = priorCompleted.reduce((acc, curr) => acc + curr.amount, 0);
    const priorOrders = priorCompleted.length;
    const priorAvgOrder = priorOrders > 0 ? priorRevenue / priorOrders : 0;

    // Revenue Delta
    const revDelta = priorRevenue > 0 ? ((totalRevenue - priorRevenue) / priorRevenue) * 100 : 0;
    const orderDelta = priorOrders > 0 ? ((totalOrders - priorOrders) / priorOrders) * 100 : 0;
    const aovDelta = priorAvgOrder > 0 ? ((avgOrderValue - priorAvgOrder) / priorAvgOrder) * 100 : 0;

    // Render KPI Cards
    document.getElementById('kpi-total-revenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('kpi-total-orders').textContent = totalOrders.toLocaleString();
    document.getElementById('kpi-avg-order').textContent = formatCurrency(avgOrderValue);
    document.getElementById('kpi-net-profit').textContent = formatCurrency(netProfitEst);
    document.getElementById('kpi-completion-rate').textContent = completionRate + '%';
    document.getElementById('kpi-refund-caption').textContent = refundedSales.length + ' refunds, ' + pendingSales.length + ' pending';

    renderTrendBadge('kpi-revenue-trend', revDelta);
    renderTrendBadge('kpi-orders-trend', orderDelta);
    renderTrendBadge('kpi-aov-trend', aovDelta);
    renderTrendBadge('kpi-profit-trend', revDelta);

    // Update status counts on filter pills
    document.getElementById('count-all').textContent = timeframeData.length;
    document.getElementById('count-completed').textContent = completedSales.length;
    document.getElementById('count-pending').textContent = pendingSales.length;
    document.getElementById('count-refunded').textContent = refundedSales.length;

    // Render Visual Charts
    renderTrendChart(completedSales);
    renderCategoryDonut(completedSales);
    renderChannelBreakdown(completedSales);
    renderTopProducts(completedSales);

    // Render Ledger Table
    renderTable();
  }

  function renderTrendBadge(elementId, delta) {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (currentPeriod === 'all') {
      el.textContent = 'All Time';
      el.className = 'trend-badge neutral';
      return;
    }

    const sign = delta >= 0 ? '+' : '';
    el.textContent = sign + delta.toFixed(1) + '%';
    if (delta > 0) {
      el.className = 'trend-badge positive';
    } else if (delta < 0) {
      el.className = 'trend-badge negative';
    } else {
      el.className = 'trend-badge neutral';
    }
  }

  // ==========================================================================
  // Pure Canvas Chart 1: Revenue & Orders Over Time
  // ==========================================================================
  let trendChartDataPoints = [];

  function renderTrendChart(completedSales) {
    const canvas = document.getElementById('revenueTrendCanvas');
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || (canvas.parentElement ? canvas.parentElement.clientWidth : 600);
    const height = rect.height || 280;

    // Responsive buffer size
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const ctx = canvas.getContext('2d');
    ctx.resetTransform();
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    // Group sales by date
    const dailyMap = {};
    const daysToShow = currentPeriod === 'all' ? 60 : Math.min(parseInt(currentPeriod, 10), 90);
    const now = new Date();

    for (let i = daysToShow - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().slice(0, 10);
      dailyMap[dateStr] = { date: dateStr, revenue: 0, count: 0 };
    }

    completedSales.forEach(item => {
      if (dailyMap[item.date]) {
        dailyMap[item.date].revenue += item.amount;
        dailyMap[item.date].count += 1;
      }
    });

    const dataArray = Object.values(dailyMap);
    trendChartDataPoints = [];

    if (dataArray.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No completed sales in this timeframe', width / 2, height / 2);
      return;
    }

    const maxRev = Math.max(...dataArray.map(d => d.revenue), 500);
    const padLeft = 60;
    const padRight = 20;
    const padTop = 24;
    const padBottom = 34;

    const chartWidth = Math.max(10, width - padLeft - padRight);
    const chartHeight = Math.max(10, height - padTop - padBottom);

    // Draw horizontal grid lines & Y-Axis labels
    const gridRows = 4;
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#1e293b';
    ctx.fillStyle = '#64748b';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';

    for (let i = 0; i <= gridRows; i++) {
      const yVal = padTop + (chartHeight / gridRows) * i;
      const amountVal = maxRev - (maxRev / gridRows) * i;

      ctx.beginPath();
      ctx.moveTo(padLeft, yVal);
      ctx.lineTo(width - padRight, yVal);
      ctx.stroke();

      ctx.fillText(formatCompactCurrency(amountVal), padLeft - 10, yVal + 4);
    }

    // Calculate (x, y) coordinates for data points
    const stepX = chartWidth / (dataArray.length - 1 || 1);
    dataArray.forEach((item, index) => {
      const x = padLeft + index * stepX;
      const normalizedY = (item.revenue / maxRev);
      const y = padTop + chartHeight - (normalizedY * chartHeight);
      trendChartDataPoints.push({
        x: x,
        y: y,
        raw: item
      });
    });

    // Draw Smooth Area Gradient
    if (trendChartDataPoints.length > 1) {
      const gradient = ctx.createLinearGradient(0, padTop, 0, height - padBottom);
      gradient.addColorStop(0, 'rgba(59, 130, 246, 0.35)');
      gradient.addColorStop(1, 'rgba(59, 130, 246, 0.00)');

      ctx.beginPath();
      ctx.moveTo(trendChartDataPoints[0].x, height - padBottom);
      trendChartDataPoints.forEach(pt => ctx.lineTo(pt.x, pt.y));
      ctx.lineTo(trendChartDataPoints[trendChartDataPoints.length - 1].x, height - padBottom);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      // Draw Main Line
      ctx.beginPath();
      ctx.moveTo(trendChartDataPoints[0].x, trendChartDataPoints[0].y);
      for (let i = 1; i < trendChartDataPoints.length; i++) {
        ctx.lineTo(trendChartDataPoints[i].x, trendChartDataPoints[i].y);
      }
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // Draw X-Axis Date Labels (sample 5 to 7 dates)
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    const labelStep = Math.max(1, Math.floor(dataArray.length / 6));
    dataArray.forEach((item, idx) => {
      if (idx % labelStep === 0 || idx === dataArray.length - 1) {
        const pt = trendChartDataPoints[idx];
        const dateObj = new Date(item.date + 'T00:00:00');
        const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        ctx.fillText(formattedDate, pt.x, height - padBottom + 18);
      }
    });

    // Draw interactive hover point if mouse is over
    if (hoveredTrendPoint) {
      // Vertical guide line
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.moveTo(hoveredTrendPoint.x, padTop);
      ctx.lineTo(hoveredTrendPoint.x, height - padBottom);
      ctx.stroke();
      ctx.setLineDash([]);

      // Outer halo
      ctx.beginPath();
      ctx.arc(hoveredTrendPoint.x, hoveredTrendPoint.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#3b82f6';
      ctx.fill();

      // Inner center dot
      ctx.beginPath();
      ctx.arc(hoveredTrendPoint.x, hoveredTrendPoint.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
  }

  // Handle canvas mouse move for interactive tooltips
  function setupTrendChartInteractivity() {
    const canvas = document.getElementById('revenueTrendCanvas');
    const tooltip = document.getElementById('chart-tooltip');
    if (!canvas || !tooltip) return;

    canvas.addEventListener('mousemove', (e) => {
      if (trendChartDataPoints.length === 0) return;
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;

      // Find nearest X point
      let closest = null;
      let minDistance = Infinity;

      trendChartDataPoints.forEach(pt => {
        const dist = Math.abs(pt.x - mouseX);
        if (dist < minDistance) {
          minDistance = dist;
          closest = pt;
        }
      });

      if (closest && minDistance < 40) {
        hoveredTrendPoint = closest;
        renderTrendChart(getFilteredByTimeframe(salesData, currentPeriod).filter(d => d.status === 'Completed'));

        // Show HTML Tooltip
        const raw = closest.raw;
        const dObj = new Date(raw.date + 'T00:00:00');
        const dateLabel = dObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

        tooltip.innerHTML = `
          <div style="font-weight:700; color:#f8fafc; margin-bottom:4px;">${dateLabel}</div>
          <div style="color:#60a5fa; font-weight:600; font-size:13px;">${formatCurrency(raw.revenue)}</div>
          <div style="color:#94a3b8; font-size:11px; margin-top:2px;">${raw.count} completed order${raw.count === 1 ? '' : 's'}</div>
        `;
        tooltip.style.left = closest.x + 'px';
        tooltip.style.top = (closest.y - 10) + 'px';
        tooltip.style.display = 'block';
      } else {
        hoveredTrendPoint = null;
        tooltip.style.display = 'none';
        renderTrendChart(getFilteredByTimeframe(salesData, currentPeriod).filter(d => d.status === 'Completed'));
      }
    });

    canvas.addEventListener('mouseleave', () => {
      hoveredTrendPoint = null;
      tooltip.style.display = 'none';
      renderTrendChart(getFilteredByTimeframe(salesData, currentPeriod).filter(d => d.status === 'Completed'));
    });
  }

  // ==========================================================================
  // Pure Canvas Chart 2: Category Donut Chart
  // ==========================================================================
  let donutSlices = [];

  function renderCategoryDonut(completedSales) {
    const canvas = document.getElementById('categoryDonutCanvas');
    const legendContainer = document.getElementById('category-legend');
    const centerAmountEl = document.getElementById('donut-center-amount');
    if (!canvas || !legendContainer) return;

    // Aggregate by category
    const catTotals = {};
    CATEGORIES.forEach(cat => catTotals[cat] = 0);
    let totalCatRevenue = 0;

    completedSales.forEach(item => {
      const cat = item.category || 'Software';
      catTotals[cat] = (catTotals[cat] || 0) + item.amount;
      totalCatRevenue += item.amount;
    });

    if (centerAmountEl) {
      centerAmountEl.textContent = formatCompactCurrency(totalCatRevenue);
    }

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 180;
    const height = rect.height || 180;

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const ctx = canvas.getContext('2d');
    ctx.resetTransform();
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const outerRadius = Math.min(centerX, centerY) - 8;
    const innerRadius = outerRadius * 0.68;

    donutSlices = [];
    let startAngle = -Math.PI / 2;

    const categoriesWithRevenue = CATEGORIES.map(cat => ({
      name: cat,
      amount: catTotals[cat],
      color: CATEGORY_COLORS[cat] || '#3b82f6',
      percent: totalCatRevenue > 0 ? (catTotals[cat] / totalCatRevenue) * 100 : 0
    })).filter(c => c.amount > 0);

    // If completely empty
    if (categoriesWithRevenue.length === 0) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
      ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2, true);
      ctx.fillStyle = '#1e293b';
      ctx.fill();
      legendContainer.innerHTML = '<div style="color:#64748b; font-size:12px; text-align:center;">No category data</div>';
      return;
    }

    categoriesWithRevenue.forEach((catObj, idx) => {
      const sliceAngle = (catObj.amount / totalCatRevenue) * (Math.PI * 2);
      const endAngle = startAngle + sliceAngle;
      const isHovered = hoveredCategoryIndex === idx;

      donutSlices.push({
        index: idx,
        name: catObj.name,
        amount: catObj.amount,
        startAngle: startAngle,
        endAngle: endAngle,
        color: catObj.color
      });

      // Render Donut slice
      ctx.beginPath();
      const currentOuter = isHovered ? outerRadius + 4 : outerRadius;
      ctx.arc(centerX, centerY, currentOuter, startAngle, endAngle);
      ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = catObj.color;
      ctx.fill();

      // Border separator
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#111827';
      ctx.stroke();

      startAngle = endAngle;
    });

    // Render HTML Legends below donut
    legendContainer.innerHTML = categoriesWithRevenue.map((cat, idx) => `
      <div class="legend-row ${hoveredCategoryIndex === idx ? 'hovered' : ''}" data-cat-idx="${idx}">
        <div class="legend-label-col">
          <span class="legend-color-dot" style="background-color: ${cat.color};"></span>
          <span>${cat.name}</span>
        </div>
        <div class="legend-value-col">
          ${formatCompactCurrency(cat.amount)}
          <span class="legend-percent">${cat.percent.toFixed(1)}%</span>
        </div>
      </div>
    `).join('');
  }

  // ==========================================================================
  // Secondary Visuals: Channel Distribution & Top Products
  // ==========================================================================
  function renderChannelBreakdown(completedSales) {
    const container = document.getElementById('channel-bars-list');
    if (!container) return;

    const channelMap = {};
    CHANNELS.forEach(c => channelMap[c] = { name: c, amount: 0, count: 0 });

    let maxChannelAmount = 0;
    completedSales.forEach(item => {
      const ch = channelMap[item.channel] || channelMap['Direct Web'];
      ch.amount += item.amount;
      ch.count += 1;
      if (ch.amount > maxChannelAmount) maxChannelAmount = ch.amount;
    });

    const channelList = Object.values(channelMap).sort((a, b) => b.amount - a.amount);

    container.innerHTML = channelList.map(ch => {
      const pct = maxChannelAmount > 0 ? (ch.amount / maxChannelAmount) * 100 : 0;
      return `
        <div class="channel-item">
          <div class="channel-item-header">
            <span class="channel-name">${ch.name}</span>
            <span class="channel-metrics">${formatCurrency(ch.amount)} <span style="color:#64748b; font-weight:normal; font-size:11px;">(${ch.count} orders)</span></span>
          </div>
          <div class="channel-progress-track">
            <div class="channel-progress-fill" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderTopProducts(completedSales) {
    const tableBody = document.getElementById('top-products-body');
    if (!tableBody) return;

    const prodMap = {};
    completedSales.forEach(item => {
      if (!prodMap[item.product]) {
        prodMap[item.product] = {
          name: item.product,
          category: item.category,
          units: 0,
          revenue: 0
        };
      }
      prodMap[item.product].units += 1;
      prodMap[item.product].revenue += item.amount;
    });

    const topList = Object.values(prodMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    if (topList.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="4" class="empty-state">No product sales in this timeframe</td></tr>`;
      return;
    }

    tableBody.innerHTML = topList.map(prod => `
      <tr>
        <td class="product-name-cell">${escapeHTML(prod.name)}</td>
        <td><span class="badge-category">${escapeHTML(prod.category)}</span></td>
        <td>${prod.units}</td>
        <td style="font-weight:600; color:#f8fafc;">${formatCurrency(prod.revenue)}</td>
      </tr>
    `).join('');
  }

  // ==========================================================================
  // Orders & Transactions Ledger (Search, Sort, Pagination, Actions)
  // ==========================================================================
  function getTableData() {
    let list = getFilteredByTimeframe(salesData, currentPeriod);

    // Filter by Status
    if (currentStatus !== 'ALL') {
      list = list.filter(item => item.status === currentStatus);
    }

    // Filter by Search Query
    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(item =>
        item.id.toLowerCase().includes(q) ||
        item.customer.toLowerCase().includes(q) ||
        item.product.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.channel.toLowerCase().includes(q)
      );
    }

    // Sort
    list.sort((a, b) => {
      let valA = a[sortColumn];
      let valB = b[sortColumn];

      if (sortColumn === 'amount') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }
      if (sortColumn === 'date') {
        const dateA = new Date(valA).getTime();
        const dateB = new Date(valB).getTime();
        return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      }

      valA = (valA || '').toString().toLowerCase();
      valB = (valB || '').toString().toLowerCase();
      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }

  function renderTable() {
    const tbody = document.getElementById('orders-table-body');
    const paginationInfo = document.getElementById('table-pagination-info');
    const pagesContainer = document.getElementById('pagination-pages');
    const prevBtn = document.getElementById('btn-page-prev');
    const nextBtn = document.getElementById('btn-page-next');
    if (!tbody) return;

    const data = getTableData();
    const totalEntries = data.length;
    const totalPages = Math.max(1, Math.ceil(totalEntries / rowsPerPage));

    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, totalEntries);
    const pageItems = data.slice(startIndex, endIndex);

    if (pageItems.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No matching transactions found.</td></tr>`;
    } else {
      tbody.innerHTML = pageItems.map(item => {
        let statusBadgeClass = 'status-completed';
        if (item.status === 'Pending') statusBadgeClass = 'status-pending';
        if (item.status === 'Refunded') statusBadgeClass = 'status-refunded';

        return `
          <tr>
            <td><span class="order-id-badge">${escapeHTML(item.id)}</span></td>
            <td><div class="customer-name">${escapeHTML(item.customer)}</div></td>
            <td>
              <div>${escapeHTML(item.product)}</div>
              <span class="product-subtext">${escapeHTML(item.category)}</span>
            </td>
            <td>${formatDisplayDate(item.date)}</td>
            <td><span class="channel-tag">${escapeHTML(item.channel)}</span></td>
            <td class="text-right amount-col">${formatCurrency(item.amount)}</td>
            <td><span class="status-pill ${statusBadgeClass}">${escapeHTML(item.status)}</span></td>
            <td class="text-center">
              <div class="action-btn-group">
                <button class="btn-icon-action btn-edit-order" data-id="${item.id}" title="Edit Order">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </button>
                <button class="btn-icon-action btn-icon-delete btn-delete-order" data-id="${item.id}" title="Delete Order">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    // Pagination info text
    const displayStart = totalEntries === 0 ? 0 : startIndex + 1;
    paginationInfo.textContent = `Showing ${displayStart} to ${endIndex} of ${totalEntries} entries`;

    // Pagination buttons state
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages || totalEntries === 0;

    // Render page number pill buttons
    let pagesHTML = '';
    for (let p = 1; p <= totalPages; p++) {
      if (totalPages > 6 && Math.abs(p - currentPage) > 2 && p !== 1 && p !== totalPages) {
        if (p === 2 || p === totalPages - 1) {
          pagesHTML += `<span style="color:#64748b; padding:4px;">...</span>`;
        }
        continue;
      }
      pagesHTML += `
        <button class="page-num ${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</button>
      `;
    }
    pagesContainer.innerHTML = pagesHTML;
  }

  function formatDisplayDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return dateStr;
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ==========================================================================
  // Modal & Form Handling
  // ==========================================================================
  const modalOverlay = document.getElementById('sale-modal');
  const saleForm = document.getElementById('sale-form');

  function openSaleModal(orderToEdit = null) {
    saleForm.reset();
    if (orderToEdit) {
      document.getElementById('modal-title').textContent = 'Edit Sale Order';
      document.getElementById('form-order-id').value = orderToEdit.id;
      document.getElementById('form-customer').value = orderToEdit.customer;
      document.getElementById('form-product').value = orderToEdit.product;
      document.getElementById('form-category').value = orderToEdit.category;
      document.getElementById('form-channel').value = orderToEdit.channel;
      document.getElementById('form-amount').value = orderToEdit.amount;
      document.getElementById('form-date').value = orderToEdit.date;
      document.getElementById('form-status').value = orderToEdit.status;
    } else {
      document.getElementById('modal-title').textContent = 'Record New Transaction';
      document.getElementById('form-order-id').value = '';
      document.getElementById('form-date').value = new Date().toISOString().slice(0, 10);
      document.getElementById('form-status').value = 'Completed';
    }
    modalOverlay.classList.add('open');
  }

  function closeSaleModal() {
    modalOverlay.classList.remove('open');
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    const existingId = document.getElementById('form-order-id').value;
    const customer = document.getElementById('form-customer').value.trim();
    const product = document.getElementById('form-product').value.trim();
    const category = document.getElementById('form-category').value;
    const channel = document.getElementById('form-channel').value;
    const amount = parseFloat(document.getElementById('form-amount').value);
    const date = document.getElementById('form-date').value;
    const status = document.getElementById('form-status').value;

    if (!customer || !product || isNaN(amount) || !date) {
      alert('Please fill out all required fields.');
      return;
    }

    if (existingId) {
      // Update existing
      const targetIndex = salesData.findIndex(s => s.id === existingId);
      if (targetIndex !== -1) {
        salesData[targetIndex] = {
          id: existingId,
          customer,
          product,
          category,
          channel,
          amount,
          date,
          status
        };
      }
    } else {
      // Create new
      const newId = 'ORD-' + (Math.floor(1000 + Math.random() * 9000));
      salesData.unshift({
        id: newId,
        customer,
        product,
        category,
        channel,
        amount,
        date,
        status
      });
    }

    saveData();
    closeSaleModal();
    updateDashboard();
  }

  function deleteOrder(orderId) {
    if (confirm(`Are you sure you want to delete order ${orderId}?`)) {
      salesData = salesData.filter(s => s.id !== orderId);
      saveData();
      updateDashboard();
    }
  }

  // ==========================================================================
  // Export to CSV
  // ==========================================================================
  function exportToCSV() {
    const dataToExport = getFilteredByTimeframe(salesData, currentPeriod);
    if (dataToExport.length === 0) {
      alert('No sales data available to export.');
      return;
    }

    const headers = ['Order ID', 'Customer', 'Product', 'Category', 'Channel', 'Amount', 'Date', 'Status'];
    const rows = dataToExport.map(item => [
      `"${item.id}"`,
      `"${item.customer.replace(/"/g, '""')}"`,
      `"${item.product.replace(/"/g, '""')}"`,
      `"${item.category}"`,
      `"${item.channel}"`,
      item.amount.toFixed(2),
      `"${item.date}"`,
      `"${item.status}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sales_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ==========================================================================
  // Event Listeners Setup
  // ==========================================================================
  function setupEventListeners() {
    // Nav items active state
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        navItems.forEach(n => n.classList.remove('active'));
        item.classList.add('active');
      });
    });

    // Timeframe filters
    const filterBtns = document.querySelectorAll('#timeframe-filters .filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentPeriod = btn.getAttribute('data-period');
        currentPage = 1;
        updateDashboard();
      });
    });

    // Status filter pills
    const statusPillBtns = document.querySelectorAll('#status-filters .pill-btn');
    statusPillBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        statusPillBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentStatus = btn.getAttribute('data-status');
        currentPage = 1;
        renderTable();
      });
    });

    // Search input
    const searchInput = document.getElementById('table-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchTerm = e.target.value;
        currentPage = 1;
        renderTable();
      });
    }

    // Table sorting
    const tableHeaders = document.querySelectorAll('.data-table th[data-sort]');
    tableHeaders.forEach(th => {
      th.addEventListener('click', () => {
        const column = th.getAttribute('data-sort');
        if (sortColumn === column) {
          sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          sortColumn = column;
          sortDirection = 'asc';
        }

        tableHeaders.forEach(h => {
          const indicator = h.querySelector('.sort-indicator');
          if (indicator) indicator.textContent = '';
        });

        const activeIndicator = th.querySelector('.sort-indicator');
        if (activeIndicator) {
          activeIndicator.textContent = sortDirection === 'asc' ? ' ▲' : ' ▼';
        }

        renderTable();
      });
    });

    // Table Actions (Edit & Delete delegation)
    const tableBody = document.getElementById('orders-table-body');
    if (tableBody) {
      tableBody.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.btn-edit-order');
        if (editBtn) {
          const id = editBtn.getAttribute('data-id');
          const order = salesData.find(s => s.id === id);
          if (order) openSaleModal(order);
          return;
        }

        const deleteBtn = e.target.closest('.btn-delete-order');
        if (deleteBtn) {
          const id = deleteBtn.getAttribute('data-id');
          deleteOrder(id);
        }
      });
    }

    // Pagination buttons
    document.getElementById('btn-page-prev').addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderTable();
      }
    });

    document.getElementById('btn-page-next').addEventListener('click', () => {
      currentPage++;
      renderTable();
    });

    const pagesContainer = document.getElementById('pagination-pages');
    pagesContainer.addEventListener('click', (e) => {
      const pageBtn = e.target.closest('.page-num');
      if (pageBtn) {
        currentPage = parseInt(pageBtn.getAttribute('data-page'), 10);
        renderTable();
      }
    });

    // Donut hover interaction on legend items
    const legendContainer = document.getElementById('category-legend');
    if (legendContainer) {
      legendContainer.addEventListener('mouseover', (e) => {
        const row = e.target.closest('.legend-row');
        if (row) {
          hoveredCategoryIndex = parseInt(row.getAttribute('data-cat-idx'), 10);
          const completed = getFilteredByTimeframe(salesData, currentPeriod).filter(d => d.status === 'Completed');
          renderCategoryDonut(completed);
        }
      });
      legendContainer.addEventListener('mouseleave', () => {
        hoveredCategoryIndex = -1;
        const completed = getFilteredByTimeframe(salesData, currentPeriod).filter(d => d.status === 'Completed');
        renderCategoryDonut(completed);
      });
    }

    // Record sale modal trigger & close
    document.getElementById('btn-open-modal').addEventListener('click', () => openSaleModal());
    document.getElementById('btn-close-modal').addEventListener('click', closeSaleModal);
    document.getElementById('btn-cancel-modal').addEventListener('click', closeSaleModal);
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeSaleModal();
    });

    // Form submit
    saleForm.addEventListener('submit', handleFormSubmit);

    // Export CSV
    document.getElementById('btn-export-csv').addEventListener('click', exportToCSV);

    // Reset Demo Data
    document.getElementById('btn-seed-data').addEventListener('click', () => {
      if (confirm('Reset to standard realistic sales dataset? Any custom entries will be replaced.')) {
        salesData = generateDefaultSales();
        saveData();
        updateDashboard();
      }
    });

    // Window Resize Observer for Canvas Charts
    window.addEventListener('resize', () => {
      const completed = getFilteredByTimeframe(salesData, currentPeriod).filter(d => d.status === 'Completed');
      renderTrendChart(completed);
      renderCategoryDonut(completed);
    });

    // ResizeObserver on main container if available
    if (window.ResizeObserver) {
      const container = document.querySelector('.canvas-container');
      if (container) {
        const ro = new ResizeObserver(() => {
          const completed = getFilteredByTimeframe(salesData, currentPeriod).filter(d => d.status === 'Completed');
          renderTrendChart(completed);
        });
        ro.observe(container);
      }
    }

    setupTrendChartInteractivity();
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================
  function init() {
    loadData();
    setupEventListeners();
    updateDashboard();
  }

  // Bootstrap when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
