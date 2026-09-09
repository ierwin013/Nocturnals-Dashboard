const STORAGE_KEY = 'nocturnals-dashboard-v1';

const DEFAULT_ORIGINATORS = [
  { id: 'paula', name: 'Paula', initials: 'PA', subtitle: '' },
  { id: 'peyton', name: 'Peyton', initials: 'PE', subtitle: '' },
  { id: 'henry', name: 'Henry', initials: 'HE', subtitle: '' },
  { id: 'dakota', name: 'Dakota', initials: 'DA', subtitle: '' },
  { id: 'evan', name: 'Evan', initials: 'EV', subtitle: '' },
  { id: 'jared', name: 'Jared', initials: 'JA', subtitle: '' },
  { id: 'ian', name: 'Ian', initials: 'IA', subtitle: '' },
];

const DEFAULT_GOALS = {
  avgLeads: 12,
  contactToLead: 90,
  contactToAgent: 25,
  sentToLender: 70,
};

const state = loadState();
const ui = {
  headerSubtitle: document.getElementById('headerSubtitle'),
  dateLabel: document.getElementById('dateLabel'),
  topStats: document.getElementById('topStats'),
  goalsList: document.getElementById('goalsList'),
  rosterBody: document.getElementById('rosterBody'),
  prevDayBtn: document.getElementById('prevDayBtn'),
  nextDayBtn: document.getElementById('nextDayBtn'),
  addOriginatorBtn: document.getElementById('addOriginatorBtn'),
  editGoalsBtn: document.getElementById('editGoalsBtn'),
  exportBtn: document.getElementById('exportBtn'),
  importBtn: document.getElementById('importBtn'),
  importInput: document.getElementById('importInput'),
  logEffortBtn: document.getElementById('logEffortBtn'),
  originatorDialog: document.getElementById('originatorDialog'),
  originatorForm: document.getElementById('originatorForm'),
  originatorDialogTitle: document.getElementById('originatorDialogTitle'),
  goalsDialog: document.getElementById('goalsDialog'),
  goalsForm: document.getElementById('goalsForm'),
  logEffortDialog: document.getElementById('logEffortDialog'),
  logEffortForm: document.getElementById('logEffortForm'),
  logEffortOriginator: document.getElementById('logEffortOriginator'),
};

let editOriginatorId = null;

bindEvents();
render();

function loadState() {
  const today = '2026-09-08';
  const fallback = {
    currentDate: today,
    goals: { ...DEFAULT_GOALS },
    originators: DEFAULT_ORIGINATORS,
    metricsByDate: {},
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      currentDate: parsed.currentDate || today,
      goals: { ...DEFAULT_GOALS, ...(parsed.goals || {}) },
      originators:
        Array.isArray(parsed.originators) && parsed.originators.length
          ? parsed.originators
          : DEFAULT_ORIGINATORS,
      metricsByDate: parsed.metricsByDate && typeof parsed.metricsByDate === 'object' ? parsed.metricsByDate : {},
    };
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function bindEvents() {
  ui.prevDayBtn.addEventListener('click', () => changeDate(-1));
  ui.nextDayBtn.addEventListener('click', () => changeDate(1));
  ui.addOriginatorBtn.addEventListener('click', openAddOriginatorDialog);
  ui.editGoalsBtn.addEventListener('click', openGoalsDialog);
  ui.exportBtn.addEventListener('click', exportData);
  ui.importBtn.addEventListener('click', () => ui.importInput.click());
  ui.importInput.addEventListener('change', importData);
  ui.logEffortBtn.addEventListener('click', openLogEffortDialog);

  ui.originatorForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(ui.originatorForm);
    const name = String(formData.get('name') || '').trim();
    const initials = String(formData.get('initials') || '').trim().toUpperCase();
    const subtitle = String(formData.get('subtitle') || '').trim();
    if (!name || !initials) return;

    if (editOriginatorId) {
      const target = state.originators.find((originator) => originator.id === editOriginatorId);
      if (target) {
        target.name = name;
        target.initials = initials;
        target.subtitle = subtitle;
      }
    } else {
      const id = `o-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      state.originators.push({ id, name, initials, subtitle });
    }

    saveState();
    render();
    ui.originatorDialog.close();
  });

  ui.goalsForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(ui.goalsForm);
    state.goals.avgLeads = toNumber(formData.get('avgLeads'));
    state.goals.contactToLead = toNumber(formData.get('contactToLead'));
    state.goals.contactToAgent = toNumber(formData.get('contactToAgent'));
    state.goals.sentToLender = toNumber(formData.get('sentToLender'));
    saveState();
    render();
    ui.goalsDialog.close();
  });

  ui.logEffortForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(ui.logEffortForm);
    const id = String(formData.get('originator') || '');
    const metrics = getDateMetrics(state.currentDate);
    if (!metrics[id]) metrics[id] = emptyMetrics();
    metrics[id].pulls = clamp(toNumber(formData.get('pulls')));
    metrics[id].contacts = clamp(toNumber(formData.get('contacts')));
    metrics[id].agents = clamp(toNumber(formData.get('agents')));
    metrics[id].lender = clamp(toNumber(formData.get('lender')));
    saveState();
    render();
    ui.logEffortDialog.close();
  });
}

function changeDate(delta) {
  const date = parseISODate(state.currentDate);
  date.setDate(date.getDate() + delta);
  state.currentDate = toISODate(date);
  saveState();
  render();
}

function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseISODate(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function getDateMetrics(dateKey) {
  if (!state.metricsByDate[dateKey]) {
    state.metricsByDate[dateKey] = {};
  }
  return state.metricsByDate[dateKey];
}

function emptyMetrics() {
  return { pulls: 0, contacts: 0, agents: 0, lender: 0 };
}

function calculate() {
  const metrics = getDateMetrics(state.currentDate);
  let totalPulls = 0;
  let totalContacts = 0;
  let totalAgents = 0;
  let totalLender = 0;

  state.originators.forEach((originator) => {
    if (!metrics[originator.id]) metrics[originator.id] = emptyMetrics();
    const personMetrics = metrics[originator.id];
    totalPulls += clamp(personMetrics.pulls);
    totalContacts += clamp(personMetrics.contacts);
    totalAgents += clamp(personMetrics.agents);
    totalLender += clamp(personMetrics.lender);
  });

  const count = state.originators.length || 1;
  const avgLeads = totalPulls / count;
  const contactToLead = totalPulls === 0 ? 0 : (totalContacts / totalPulls) * 100;
  const contactToAgent = totalContacts === 0 ? 0 : (totalAgents / totalContacts) * 100;
  const sentToLender = totalAgents === 0 ? 0 : (totalLender / totalAgents) * 100;

  return {
    totals: { totalPulls, totalContacts, totalAgents, totalLender },
    values: { avgLeads, contactToLead, contactToAgent, sentToLender },
  };
}

function render() {
  const calculated = calculate();
  renderHeader();
  renderTopStats(calculated.values);
  renderGoals(calculated.values);
  renderRoster();
  renderLogEffortSelect();
  saveState();
}

function renderHeader() {
  const date = parseISODate(state.currentDate);
  const full = date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  const short = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  ui.headerSubtitle.textContent = `Individual Daily Stats for ${full}.`;
  ui.dateLabel.textContent = short;
}

function renderTopStats(values) {
  const cards = [
    {
      title: 'Average Leads Pulled',
      value: `${values.avgLeads.toFixed(1)}`,
      goal: state.goals.avgLeads,
      goalLabel: `${state.goals.avgLeads}`,
      raw: values.avgLeads,
    },
    {
      title: 'Contact to Lead %',
      value: `${Math.round(values.contactToLead)}%`,
      goal: state.goals.contactToLead,
      goalLabel: `${state.goals.contactToLead}%`,
      raw: values.contactToLead,
    },
    {
      title: 'Contact to Agent %',
      value: `${Math.round(values.contactToAgent)}%`,
      goal: state.goals.contactToAgent,
      goalLabel: `${state.goals.contactToAgent}%`,
      raw: values.contactToAgent,
    },
    {
      title: 'Sent to Lender %',
      value: `${Math.round(values.sentToLender)}%`,
      goal: state.goals.sentToLender,
      goalLabel: `${state.goals.sentToLender}%`,
      raw: values.sentToLender,
    },
  ];

  ui.topStats.innerHTML = cards
    .map((card) => {
      const pct = goalProgress(card.raw, card.goal);
      return `
      <article class="card stat-card">
        <p class="stat-title">${card.title}</p>
        <p class="stat-value">${card.value}</p>
        <p class="goal-text">Goal: ${card.goalLabel}</p>
        <p class="goal-text">${Math.round(pct)}% of goal</p>
        <div class="progress" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100">
          <span style="width:${Math.min(pct, 100)}%"></span>
        </div>
      </article>`;
    })
    .join('');
}

function renderGoals(values) {
  const goals = [
    {
      title: 'Average Leads Pulled',
      value: `${values.avgLeads.toFixed(1)}`,
      goal: `${state.goals.avgLeads}`,
      raw: values.avgLeads,
      goalRaw: state.goals.avgLeads,
      suffix: '',
    },
    {
      title: 'Contact to Lead %',
      value: `${Math.round(values.contactToLead)}`,
      goal: `${state.goals.contactToLead}`,
      raw: values.contactToLead,
      goalRaw: state.goals.contactToLead,
      suffix: '%',
    },
    {
      title: 'Contact to Agent %',
      value: `${Math.round(values.contactToAgent)}`,
      goal: `${state.goals.contactToAgent}`,
      raw: values.contactToAgent,
      goalRaw: state.goals.contactToAgent,
      suffix: '%',
    },
    {
      title: 'Sent to Lender %',
      value: `${Math.round(values.sentToLender)}`,
      goal: `${state.goals.sentToLender}`,
      raw: values.sentToLender,
      goalRaw: state.goals.sentToLender,
      suffix: '%',
    },
  ];

  ui.goalsList.innerHTML = goals
    .map((goal) => {
      const pct = goalProgress(goal.raw, goal.goalRaw);
      return `
      <section class="goal-item">
        <h3>${goal.title}</h3>
        <p class="goal-line">${goal.value}${goal.suffix} / Goal ${goal.goal}${goal.suffix}</p>
        <div class="progress"><span style="width:${Math.min(pct, 100)}%"></span></div>
      </section>`;
    })
    .join('');
}

function renderRoster() {
  const metrics = getDateMetrics(state.currentDate);
  ui.rosterBody.innerHTML = state.originators
    .map((originator) => {
      const personMetrics = metrics[originator.id] || emptyMetrics();
      return `
      <tr data-id="${originator.id}">
        <td>
          <div class="originator">
            <span class="avatar">${escapeHtml(originator.initials || '--')}</span>
            <div>
              <div class="name">${escapeHtml(originator.name)}</div>
              ${originator.subtitle ? `<div class="subtitle-mini">${escapeHtml(originator.subtitle)}</div>` : ''}
            </div>
          </div>
        </td>
        <td>${renderStepper('pulls', personMetrics.pulls)}</td>
        <td>${renderStepper('contacts', personMetrics.contacts)}</td>
        <td>${renderStepper('agents', personMetrics.agents)}</td>
        <td>${renderStepper('lender', personMetrics.lender)}</td>
        <td>
          <button class="icon-btn" type="button" data-action="edit" aria-label="Edit ${escapeHtml(originator.name)}">✎</button>
          <button class="icon-btn" type="button" data-action="remove" aria-label="Remove ${escapeHtml(originator.name)}">✕</button>
        </td>
      </tr>`;
    })
    .join('');

  ui.rosterBody.querySelectorAll('button[data-metric]').forEach((button) => {
    button.addEventListener('click', () => {
      const row = button.closest('tr');
      const id = row?.dataset.id;
      const metric = button.dataset.metric;
      const delta = Number(button.dataset.delta);
      if (!id || !metric || Number.isNaN(delta)) return;
      updateMetric(id, metric, delta);
    });
  });

  ui.rosterBody.querySelectorAll('button[data-action="edit"]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.closest('tr')?.dataset.id;
      if (id) openEditOriginatorDialog(id);
    });
  });

  ui.rosterBody.querySelectorAll('button[data-action="remove"]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.closest('tr')?.dataset.id;
      if (id) removeOriginator(id);
    });
  });
}

function renderStepper(metric, value) {
  return `
  <div class="stepper">
    <button type="button" class="step-btn" data-metric="${metric}" data-delta="-1">−</button>
    <span class="metric">${clamp(value)}</span>
    <button type="button" class="step-btn" data-metric="${metric}" data-delta="1">+</button>
  </div>`;
}

function updateMetric(originatorId, metric, delta) {
  const metrics = getDateMetrics(state.currentDate);
  if (!metrics[originatorId]) metrics[originatorId] = emptyMetrics();
  metrics[originatorId][metric] = clamp((metrics[originatorId][metric] || 0) + delta);
  saveState();
  render();
}

function openAddOriginatorDialog() {
  editOriginatorId = null;
  ui.originatorDialogTitle.textContent = 'Add Originator';
  ui.originatorForm.reset();
  ui.originatorDialog.showModal();
}

function openEditOriginatorDialog(id) {
  const originator = state.originators.find((item) => item.id === id);
  if (!originator) return;
  editOriginatorId = id;
  ui.originatorDialogTitle.textContent = 'Edit Originator';
  ui.originatorForm.name.value = originator.name;
  ui.originatorForm.initials.value = originator.initials;
  ui.originatorForm.subtitle.value = originator.subtitle || '';
  ui.originatorDialog.showModal();
}

function removeOriginator(id) {
  const target = state.originators.find((originator) => originator.id === id);
  if (!target) return;
  if (!window.confirm(`Remove ${target.name}?`)) return;

  state.originators = state.originators.filter((originator) => originator.id !== id);
  Object.values(state.metricsByDate).forEach((metrics) => {
    if (metrics && typeof metrics === 'object') delete metrics[id];
  });

  saveState();
  render();
}

function openGoalsDialog() {
  ui.goalsForm.avgLeads.value = state.goals.avgLeads;
  ui.goalsForm.contactToLead.value = state.goals.contactToLead;
  ui.goalsForm.contactToAgent.value = state.goals.contactToAgent;
  ui.goalsForm.sentToLender.value = state.goals.sentToLender;
  ui.goalsDialog.showModal();
}

function renderLogEffortSelect() {
  ui.logEffortOriginator.innerHTML = state.originators
    .map((originator) => `<option value="${originator.id}">${escapeHtml(originator.name)}</option>`)
    .join('');
}

function openLogEffortDialog() {
  if (!state.originators.length) {
    alert('Add an originator first.');
    return;
  }

  const selectedId = ui.logEffortOriginator.value || state.originators[0].id;
  const metrics = getDateMetrics(state.currentDate);
  const values = metrics[selectedId] || emptyMetrics();

  ui.logEffortForm.originator.value = selectedId;
  ui.logEffortForm.pulls.value = values.pulls;
  ui.logEffortForm.contacts.value = values.contacts;
  ui.logEffortForm.agents.value = values.agents;
  ui.logEffortForm.lender.value = values.lender;

  ui.logEffortOriginator.onchange = () => {
    const current = getDateMetrics(state.currentDate)[ui.logEffortOriginator.value] || emptyMetrics();
    ui.logEffortForm.pulls.value = current.pulls;
    ui.logEffortForm.contacts.value = current.contacts;
    ui.logEffortForm.agents.value = current.agents;
    ui.logEffortForm.lender.value = current.lender;
  };

  ui.logEffortDialog.showModal();
}

function goalProgress(value, goal) {
  if (!goal || goal <= 0) return 0;
  return Math.max(0, (value / goal) * 100);
}

function clamp(value) {
  return Math.max(0, Number.isFinite(value) ? Math.floor(value) : 0);
}

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `nocturnals-backup-${state.currentDate}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importData(event) {
  const [file] = event.target.files || [];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || '{}'));
      if (!parsed || typeof parsed !== 'object') throw new Error('Invalid data');
      if (!Array.isArray(parsed.originators) || typeof parsed.metricsByDate !== 'object') {
        throw new Error('Invalid schema');
      }
      state.currentDate = typeof parsed.currentDate === 'string' ? parsed.currentDate : state.currentDate;
      state.goals = { ...DEFAULT_GOALS, ...(parsed.goals || {}) };
      state.originators = parsed.originators;
      state.metricsByDate = parsed.metricsByDate;
      saveState();
      render();
      alert('Dashboard data imported.');
    } catch {
      alert('Could not import file.');
    } finally {
      ui.importInput.value = '';
    }
  };
  reader.readAsText(file);
}

function escapeHtml(input) {
  return String(input)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
