const STORAGE_KEY = 'nocturnals-dashboard-v1';
const DATA_FILE_URL = './data.json';
const GITHUB_TOKEN_KEY = 'github-token';
const GITHUB_OWNER = 'ierwin013';
const GITHUB_REPO = 'Nocturnals-Dashboard';
const GITHUB_DATA_PATH = 'data.json';

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
  pulls: 84,
  contacts: 76,
  attachments: 19,
  lender: 13,
};

let state;
const ui = {
  headerSubtitle: document.getElementById('headerSubtitle'),
  dateInput: document.getElementById('dateInput'),
  topStats: document.getElementById('topStats'),
  goalsList: document.getElementById('goalsList'),
  rosterBody: document.getElementById('rosterBody'),
  prevDayBtn: document.getElementById('prevDayBtn'),
  nextDayBtn: document.getElementById('nextDayBtn'),
  addOriginatorBtn: document.getElementById('addOriginatorBtn'),
  addTeamRecordBtn: document.getElementById('addTeamRecordBtn'),
  editGoalsBtn: document.getElementById('editGoalsBtn'),
  logEffortBtn: document.getElementById('logEffortBtn'),
  openGitHubSetupBtn: document.getElementById('openGitHubSetupBtn'),
  syncStatus: document.getElementById('syncStatus'),
  teamRecordsBody: document.getElementById('teamRecordsBody'),
  originatorDialog: document.getElementById('originatorDialog'),
  originatorForm: document.getElementById('originatorForm'),
  originatorDialogTitle: document.getElementById('originatorDialogTitle'),
  goalsDialog: document.getElementById('goalsDialog'),
  goalsForm: document.getElementById('goalsForm'),
  logEffortDialog: document.getElementById('logEffortDialog'),
  logEffortForm: document.getElementById('logEffortForm'),
  logEffortOriginator: document.getElementById('logEffortOriginator'),
  teamRecordDialog: document.getElementById('teamRecordDialog'),
  teamRecordForm: document.getElementById('teamRecordForm'),
  teamRecordDialogTitle: document.getElementById('teamRecordDialogTitle'),
  githubSetupDialog: document.getElementById('githubSetupDialog'),
  githubSetupForm: document.getElementById('githubSetupForm'),
  githubTokenInput: document.getElementById('githubTokenInput'),
  githubRememberToken: document.getElementById('githubRememberToken'),
  githubSetupMessage: document.getElementById('githubSetupMessage'),
  clearGitHubTokenBtn: document.getElementById('clearGitHubTokenBtn'),
};

let editOriginatorId = null;
let editTeamRecordId = null;

// Initialize on page load
(async () => {
  state = await loadState();
  bindEvents();
  initializeDate();
  refreshGitHubSyncStatus();
  render();
  // Refresh data every 5 seconds to show updates from other users
  setInterval(refreshData, 5000);
})();

async function loadState() {
  const today = getTodayISO();
  const fallback = {
    currentDate: today,
    goals: { ...DEFAULT_GOALS },
    originators: DEFAULT_ORIGINATORS,
    metricsByDate: {},
    teamRecords: [],
  };

  try {
    // Try to load from data.json first (shared data)
    const response = await fetch(DATA_FILE_URL);
    if (response.ok) {
      const parsed = await response.json();
      const originators =
        Array.isArray(parsed.originators) && parsed.originators.length ? parsed.originators : DEFAULT_ORIGINATORS;
      const teamRecords = Array.isArray(parsed.teamRecords)
        ? parsed.teamRecords.map(normalizeTeamRecord).filter(Boolean)
        : [];
      return {
        currentDate: today,
        goals: normalizeGoals(parsed.goals, originators.length),
        originators,
        metricsByDate: parsed.metricsByDate && typeof parsed.metricsByDate === 'object' ? parsed.metricsByDate : {},
        teamRecords,
      };
    }
  } catch (err) {
    console.log('data.json not found or error loading, using defaults');
  }

  // Fallback to localStorage if data.json doesn't exist
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const originators =
        Array.isArray(parsed.originators) && parsed.originators.length ? parsed.originators : DEFAULT_ORIGINATORS;
      const teamRecords = Array.isArray(parsed.teamRecords)
        ? parsed.teamRecords.map(normalizeTeamRecord).filter(Boolean)
        : [];
      return {
        currentDate: today,
        goals: normalizeGoals(parsed.goals, originators.length),
        originators,
        metricsByDate: parsed.metricsByDate && typeof parsed.metricsByDate === 'object' ? parsed.metricsByDate : {},
        teamRecords,
      };
    }
  } catch (err) {
    console.log('localStorage error');
  }

  return fallback;
}

async function saveState(options = {}) {
  const { syncToGitHub = true } = options;
  // Save to localStorage for quick access
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

  if (!syncToGitHub) return false;

  // Save to data.json for shared access (requires GitHub API)
  try {
    return await saveToGitHub();
  } catch (err) {
    console.log('Could not save to GitHub, data saved locally only:', err);
    setStatusMessage(ui.syncStatus, 'Shared sync could not reach GitHub. Local changes are still saved in this browser.', 'error');
    return false;
  }
}

async function saveToGitHub() {
  const token = getGitHubToken();
  if (!token) {
    setStatusMessage(
      ui.syncStatus,
      'Shared sync is off. Open Shared Sync and add an authorized GitHub token to publish updates for everyone.',
      'warning'
    );
    return false;
  }

  const content = toBase64(JSON.stringify(getSharedStateSnapshot(), null, 2));

  try {
    // Get current file SHA
    const getResponse = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_DATA_PATH}`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    let sha = null;
    if (getResponse.ok) {
      const data = await getResponse.json();
      sha = data.sha;
    } else if (getResponse.status !== 404) {
      throw new Error(await readGitHubError(getResponse));
    }

    // Update or create file
    const putResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_DATA_PATH}`,
      {
      method: 'PUT',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        message: `Update dashboard data - ${new Date().toISOString()}`,
        content,
        ...(sha && { sha }),
      }),
      }
    );

    if (!putResponse.ok) {
      throw new Error(await readGitHubError(putResponse));
    }
    setStatusMessage(ui.syncStatus, `Shared data saved to GitHub at ${formatTime(new Date())}.`, 'ready');
    setStatusMessage(ui.githubSetupMessage, 'Token saved. Future stat updates will publish to data.json for all visitors.', 'ready');
    return true;
  } catch (err) {
    console.log('GitHub save error:', err);
    setStatusMessage(
      ui.syncStatus,
      'GitHub rejected the shared save. Re-open Shared Sync and check that your token can write repository contents.',
      'error'
    );
    setStatusMessage(ui.githubSetupMessage, err.message || 'GitHub rejected the token.', 'error');
    return false;
  }
}

async function refreshData() {
  try {
    const response = await fetch(DATA_FILE_URL + '?t=' + Date.now()); // Cache bust
    if (response.ok) {
      const latest = await response.json();
      // Update state without losing current date or local changes
      state.originators = latest.originators || state.originators;
      state.goals = latest.goals || state.goals;
      state.metricsByDate = latest.metricsByDate || state.metricsByDate;
      state.teamRecords = latest.teamRecords || state.teamRecords;
      render();
    }
  } catch (err) {
    // Silently fail on refresh errors
  }
}

function getTodayISO() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

function initializeDate() {
  if (!ui.dateInput.value) {
    ui.dateInput.value = state.currentDate;
  }
  state.currentDate = ui.dateInput.value;
}

function bindEvents() {
  ui.prevDayBtn.addEventListener('click', () => changeDate(-1));
  ui.nextDayBtn.addEventListener('click', () => changeDate(1));
  ui.dateInput.addEventListener('change', () => {
    if (!ui.dateInput.value) return;
    state.currentDate = ui.dateInput.value;
    saveState({ syncToGitHub: false });
    render();
  });
  ui.addOriginatorBtn.addEventListener('click', openAddOriginatorDialog);
  ui.addTeamRecordBtn.addEventListener('click', openAddTeamRecordDialog);
  ui.editGoalsBtn.addEventListener('click', openGoalsDialog);
  ui.logEffortBtn.addEventListener('click', openLogEffortDialog);
  ui.openGitHubSetupBtn.addEventListener('click', openGitHubSetupDialog);
  ui.githubSetupForm.addEventListener('submit', saveGitHubTokenFromDialog);
  ui.clearGitHubTokenBtn.addEventListener('click', clearStoredGitHubToken);

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
    state.goals.pulls = clamp(toNumber(formData.get('pulls')));
    state.goals.contacts = clamp(toNumber(formData.get('contacts')));
    state.goals.attachments = clamp(toNumber(formData.get('attachments')));
    state.goals.lender = clamp(toNumber(formData.get('lender')));
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

  ui.teamRecordForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(ui.teamRecordForm);
    const originatorName = String(formData.get('originatorName') || '').trim();
    const recordBroke = String(formData.get('recordBroke') || '').trim();
    const recordNumber = clamp(toNumber(formData.get('recordNumber')));
    if (!originatorName || !recordBroke) return;

    if (editTeamRecordId) {
      const target = state.teamRecords.find((record) => record.id === editTeamRecordId);
      if (target) {
        target.originatorName = originatorName;
        target.recordBroke = recordBroke;
        target.recordNumber = recordNumber;
      }
    } else {
      const id = `r-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      state.teamRecords.push({ id, originatorName, recordBroke, recordNumber });
    }

    saveState();
    render();
    ui.teamRecordDialog.close();
  });
}

function changeDate(delta) {
  const date = parseISODate(state.currentDate);
  date.setDate(date.getDate() + delta);
  state.currentDate = toISODate(date);
  saveState({ syncToGitHub: false });
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
  let pullersWithLeads = 0;

  state.originators.forEach((originator) => {
    if (!metrics[originator.id]) metrics[originator.id] = emptyMetrics();
    const personMetrics = metrics[originator.id];
    const pulls = clamp(personMetrics.pulls);
    totalPulls += pulls;
    totalContacts += clamp(personMetrics.contacts);
    totalAgents += clamp(personMetrics.agents);
    totalLender += clamp(personMetrics.lender);
    if (pulls > 0) pullersWithLeads += 1;
  });

  const avgLeads = pullersWithLeads === 0 ? 0 : totalPulls / pullersWithLeads;
  const contactToLead = totalPulls === 0 ? 0 : (totalContacts / totalPulls) * 100;
  const contactToAttachment = totalContacts === 0 ? 0 : (totalAgents / totalContacts) * 100;
  const sentToLender = totalContacts === 0 ? 0 : (totalLender / totalContacts) * 100;

  return {
    totals: { totalPulls, totalContacts, totalAgents, totalLender },
    values: { avgLeads, contactToLead, contactToAttachment, sentToLender },
  };
}

function render() {
  const calculated = calculate();
  renderHeader();
  renderTopStats(calculated.values);
  renderGoals(calculated.totals);
  renderRoster(calculated.totals);
  renderTeamRecords();
  renderLogEffortSelect();
}

function renderHeader() {
  const date = parseISODate(state.currentDate);
  const full = date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  ui.headerSubtitle.textContent = `Individual Daily Stats for ${full}.`;
  ui.dateInput.value = state.currentDate;
}

function renderTopStats(values) {
  const cards = [
    {
      title: 'Average Leads Pulled',
      value: `${values.avgLeads.toFixed(1)}`,
      caption: `${state.originators.length || 0} team members tracked`,
    },
    {
      title: 'Contact to Lead %',
      value: `${Math.round(values.contactToLead)}%`,
      caption: 'Contacts compared to leads pulled',
    },
    {
      title: 'Contact to Attachment %',
      value: `${Math.round(values.contactToAttachment)}%`,
      caption: 'Attachments compared to contacts',
    },
    {
      title: 'Sent to Lender %',
      value: `${Math.round(values.sentToLender)}%`,
      caption: 'Sent to lender compared to contacts',
    },
  ];

  ui.topStats.innerHTML = cards
    .map((card) => {
      return `
      <article class="card stat-card">
        <p class="stat-title">${card.title}</p>
        <p class="stat-value">${card.value}</p>
        <p class="goal-text">${card.caption}</p>
      </article>`;
    })
    .join('');
}

function renderGoals(totals) {
  const goals = [
    {
      title: 'Leads Pulled',
      value: totals.totalPulls,
      goal: state.goals.pulls,
    },
    {
      title: 'Contacts',
      value: totals.totalContacts,
      goal: state.goals.contacts,
    },
    {
      title: 'Attachments',
      value: totals.totalAgents,
      goal: state.goals.attachments,
    },
    {
      title: 'Sent to Lender',
      value: totals.totalLender,
      goal: state.goals.lender,
    },
  ];

  ui.goalsList.innerHTML = goals
    .map((goal) => {
      return `
      <section class="goal-item">
        <h3>${goal.title}</h3>
        <p class="goal-line"><strong>${goal.goal}</strong> goal</p>
      </section>`;
    })
    .join('');
}

function renderRoster(totals) {
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

  ui.rosterBody.insertAdjacentHTML(
    'beforeend',
    `
      <tr class="team-total-row">
        <td><strong>Team Totals</strong></td>
        <td><strong>${totals.totalPulls}</strong></td>
        <td><strong>${totals.totalContacts}</strong></td>
        <td><strong>${totals.totalAgents}</strong></td>
        <td><strong>${totals.totalLender}</strong></td>
        <td></td>
      </tr>`
  );

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

  ui.rosterBody.querySelectorAll('input[data-metric]').forEach((input) => {
    input.addEventListener('change', () => {
      const row = input.closest('tr');
      const id = row?.dataset.id;
      const metric = input.dataset.metric;
      if (!id || !metric) return;
      updateMetricValue(id, metric, input.value);
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
    <input class="metric-input" type="number" min="0" step="1" inputmode="numeric" data-metric="${metric}" value="${clamp(value)}" aria-label="${metric}" />
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

function updateMetricValue(originatorId, metric, rawValue) {
  const metrics = getDateMetrics(state.currentDate);
  if (!metrics[originatorId]) metrics[originatorId] = emptyMetrics();
  metrics[originatorId][metric] = clamp(toNumber(rawValue));
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
  ui.goalsForm.pulls.value = state.goals.pulls;
  ui.goalsForm.contacts.value = state.goals.contacts;
  ui.goalsForm.attachments.value = state.goals.attachments;
  ui.goalsForm.lender.value = state.goals.lender;
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

function openAddTeamRecordDialog() {
  editTeamRecordId = null;
  ui.teamRecordDialogTitle.textContent = 'Add Team Record';
  ui.teamRecordForm.reset();
  ui.teamRecordDialog.showModal();
}

function openEditTeamRecordDialog(id) {
  const teamRecord = state.teamRecords.find((record) => record.id === id);
  if (!teamRecord) return;
  editTeamRecordId = id;
  ui.teamRecordDialogTitle.textContent = 'Edit Team Record';
  ui.teamRecordForm.originatorName.value = teamRecord.originatorName;
  ui.teamRecordForm.recordBroke.value = teamRecord.recordBroke;
  ui.teamRecordForm.recordNumber.value = clamp(teamRecord.recordNumber);
  ui.teamRecordDialog.showModal();
}

function renderTeamRecords() {
  if (!state.teamRecords.length) {
    ui.teamRecordsBody.innerHTML = '<tr><td colspan="4" class="empty-row">No team records yet.</td></tr>';
    return;
  }

  ui.teamRecordsBody.innerHTML = state.teamRecords
    .map((record) => {
      return `
      <tr data-id="${record.id}">
        <td>${escapeHtml(record.originatorName)}</td>
        <td>${escapeHtml(record.recordBroke)}</td>
        <td>${clamp(record.recordNumber)}</td>
        <td>
          <button class="icon-btn" type="button" data-action="edit-team-record" aria-label="Edit ${escapeHtml(record.originatorName)} record">✎</button>
          <button class="icon-btn" type="button" data-action="remove-team-record" aria-label="Remove ${escapeHtml(record.originatorName)} record">✕</button>
        </td>
      </tr>`;
    })
    .join('');

  ui.teamRecordsBody.querySelectorAll('button[data-action="edit-team-record"]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.closest('tr')?.dataset.id;
      if (id) openEditTeamRecordDialog(id);
    });
  });

  ui.teamRecordsBody.querySelectorAll('button[data-action="remove-team-record"]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.closest('tr')?.dataset.id;
      if (id) removeTeamRecord(id);
    });
  });
}

function removeTeamRecord(id) {
  const target = state.teamRecords.find((record) => record.id === id);
  if (!target) return;
  if (!window.confirm(`Remove ${target.originatorName}'s "${target.recordBroke}" record?`)) return;
  state.teamRecords = state.teamRecords.filter((record) => record.id !== id);
  saveState();
  render();
}

function clamp(value) {
  return Math.max(0, Number.isFinite(value) ? Math.floor(value) : 0);
}

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function escapeHtml(input) {
  return String(input)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeGoals(rawGoals, originatorCount) {
  const source = rawGoals && typeof rawGoals === 'object' ? rawGoals : {};
  const pulls = hasNumber(source.pulls) ? clamp(source.pulls) : DEFAULT_GOALS.pulls;
  const contacts = hasNumber(source.contacts) ? clamp(source.contacts) : DEFAULT_GOALS.contacts;
  const attachments = hasNumber(source.attachments) ? clamp(source.attachments) : DEFAULT_GOALS.attachments;
  const lender = hasNumber(source.lender) ? clamp(source.lender) : DEFAULT_GOALS.lender;

  return { pulls, contacts, attachments, lender };
}

function hasNumber(value) {
  return Number.isFinite(Number(value));
}

function normalizeTeamRecord(rawRecord) {
  if (!rawRecord || typeof rawRecord !== 'object') return null;
  const originatorName = String(rawRecord.originatorName || '').trim();
  const recordBroke = String(rawRecord.recordBroke || '').trim();
  if (!originatorName || !recordBroke) return null;
  const id = String(rawRecord.id || `r-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`);
  return {
    id,
    originatorName,
    recordBroke,
    recordNumber: clamp(toNumber(rawRecord.recordNumber)),
  };
}

function getSharedStateSnapshot() {
  return {
    goals: state.goals,
    originators: state.originators,
    metricsByDate: state.metricsByDate,
    teamRecords: state.teamRecords,
  };
}

function getGitHubToken() {
  return sessionStorage.getItem(GITHUB_TOKEN_KEY) || localStorage.getItem(GITHUB_TOKEN_KEY) || '';
}

function refreshGitHubSyncStatus() {
  if (getGitHubToken()) {
    setStatusMessage(ui.syncStatus, 'Shared sync is ready. Stat changes will update data.json for everyone.', 'ready');
    return;
  }

  setStatusMessage(
    ui.syncStatus,
    'Shared sync is off until an authorized maintainer adds a GitHub token.',
    'warning'
  );
}

function openGitHubSetupDialog() {
  ui.githubSetupForm.reset();
  ui.githubRememberToken.checked = Boolean(localStorage.getItem(GITHUB_TOKEN_KEY));
  if (getGitHubToken()) {
    setStatusMessage(
      ui.githubSetupMessage,
      'A token is already stored on this device. Paste a new one to replace it, or remove it below.',
      'ready'
    );
  } else {
    setStatusMessage(
      ui.githubSetupMessage,
      'Paste a fine-grained token with repository Contents read/write access to enable shared saves.',
      'warning'
    );
  }
  ui.githubSetupDialog.showModal();
}

async function saveGitHubTokenFromDialog(event) {
  event.preventDefault();
  const token = String(ui.githubTokenInput.value || '').trim();
  if (!token) {
    setStatusMessage(ui.githubSetupMessage, 'Enter a GitHub token before saving.', 'error');
    return;
  }

  setStatusMessage(ui.githubSetupMessage, 'Checking token access to this repository…', 'warning');

  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error(await readGitHubError(response));
    }

    if (ui.githubRememberToken.checked) {
      localStorage.setItem(GITHUB_TOKEN_KEY, token);
      sessionStorage.removeItem(GITHUB_TOKEN_KEY);
    } else {
      sessionStorage.setItem(GITHUB_TOKEN_KEY, token);
      localStorage.removeItem(GITHUB_TOKEN_KEY);
    }

    ui.githubTokenInput.value = '';
    refreshGitHubSyncStatus();
    setStatusMessage(ui.githubSetupMessage, 'Token saved. Future stat changes can publish shared updates.', 'ready');
    ui.githubSetupDialog.close();
  } catch (err) {
    setStatusMessage(ui.githubSetupMessage, err.message || 'GitHub could not validate that token.', 'error');
  }
}

function clearStoredGitHubToken() {
  sessionStorage.removeItem(GITHUB_TOKEN_KEY);
  localStorage.removeItem(GITHUB_TOKEN_KEY);
  ui.githubTokenInput.value = '';
  refreshGitHubSyncStatus();
  setStatusMessage(ui.githubSetupMessage, 'Stored GitHub token removed from this browser.', 'warning');
}

function setStatusMessage(element, message, tone) {
  element.textContent = message;
  element.className = `status-note${tone ? ` status-${tone}` : ''}`;
}

async function readGitHubError(response) {
  try {
    const payload = await response.json();
    if (payload && typeof payload.message === 'string' && payload.message.trim()) {
      return payload.message.trim();
    }
  } catch (err) {
    // Ignore JSON parsing failures and fall back to status text.
  }

  return `GitHub API error: ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function toBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}
