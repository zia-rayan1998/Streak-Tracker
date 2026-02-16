/**
 * Popup Script - Main Logic
 * Handles all UI interactions and data fetching
 */

const supabase = globalThis.supabaseClient;

// DOM Elements
const screens = {
  loading: document.getElementById('loadingScreen'),
  auth: document.getElementById('authScreen'),
  profileSetup: document.getElementById('profileSetupScreen'),
  dashboard: document.getElementById('dashboardScreen')
};

const modals = {
  createGroup: document.getElementById('createGroupModal'),
  joinGroup: document.getElementById('joinGroupModal')
};

// Current user state
let currentUser = null;
let currentProfile = null;

/**
 * Initialize popup on load
 */
document.addEventListener('DOMContentLoaded', async () => {
  await initializeApp();
  setupEventListeners();
});

/**
 * Main initialization function
 */
async function initializeApp() {
  try {
    showScreen('loading');

    // Check for existing session
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) throw error;

    if (session) {
      currentUser = session.user;
      await loadUserProfile();
    } else {
      showScreen('auth');
    }
  } catch (error) {
    console.error('Initialization error:', error);
    showScreen('auth');
  }
}

/**
 * Load user profile and determine next screen
 */
async function loadUserProfile() {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    currentProfile = profile;

    if (!profile || !profile.leetcode_username || !profile.gfg_username) {
      showScreen('profileSetup');
    } else {
      await loadDashboard();
    }
  } catch (error) {
    console.error('Profile load error:', error);
    showError('profileError', 'Failed to load profile');
  }
}

/**
 * Load dashboard with all data
 */
async function loadDashboard() {
  try {
    showScreen('dashboard');

    // Set user email
    document.getElementById('userEmail').textContent = currentUser.email;

    // Load today's activity
    await loadTodayActivity();

    // Load groups
    await loadGroups();
  } catch (error) {
    console.error('Dashboard load error:', error);
    showError('dashboardError', 'Failed to load dashboard');
  }
}

/**
 * Load today's activity status
 */
async function loadTodayActivity() {
  try {
    const today = new Date().toISOString().split('T')[0];

    const { data: activity, error } = await supabase
      .from('daily_activity')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('date', today)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    // Update UI
    const leetcodeStatus = document.getElementById('leetcodeStatus');
    const gfgStatus = document.getElementById('gfgStatus');

    if (activity) {
      leetcodeStatus.textContent = activity.leetcode_completed ? '✅' : '❌';
      gfgStatus.textContent = activity.gfg_completed ? '✅' : '❌';
    } else {
      leetcodeStatus.textContent = '⏳';
      gfgStatus.textContent = '⏳';
    }
  } catch (error) {
    console.error('Activity load error:', error);
  }
}

/**
 * Load all groups user belongs to
 */
async function loadGroups() {
  try {
    // Fetch groups user is a member of
    const { data: memberships, error: membershipsError } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', currentUser.id);

    if (membershipsError) throw membershipsError;

    if (!memberships || memberships.length === 0) {
      document.getElementById('groupsList').innerHTML = '';
      document.getElementById('noGroups').classList.remove('hidden');
      return;
    }

    document.getElementById('noGroups').classList.add('hidden');

    const groupIds = memberships.map(m => m.group_id);

    // Fetch group details
    const { data: groups, error: groupsError } = await supabase
      .from('groups')
      .select('*')
      .in('id', groupIds);

    if (groupsError) throw groupsError;

    // Render groups
    const groupsList = document.getElementById('groupsList');
    groupsList.innerHTML = '';

    for (const group of groups) {
      const groupCard = await createGroupCard(group);
      groupsList.appendChild(groupCard);
    }
  } catch (error) {
    console.error('Groups load error:', error);
    showError('dashboardError', 'Failed to load groups');
  }
}

/**
 * Create group card HTML element
 */
async function createGroupCard(group) {
  const card = document.createElement('div');
  card.className = 'group-card';

  // Fetch group members
  const { data: members, error } = await supabase
    .from('group_members')
    .select(`
      user_id,
      profiles:user_id (
        leetcode_username,
        gfg_username
      )
    `)
    .eq('group_id', group.id);

  if (error) {
    console.error('Failed to load members:', error);
  }

  // Fetch today's activity for members
  const today = new Date().toISOString().split('T')[0];
  const memberIds = members?.map(m => m.user_id) || [];

  const { data: activities } = await supabase
    .from('daily_activity')
    .select('*')
    .in('user_id', memberIds)
    .eq('date', today);

  // Create activity map
  const activityMap = {};
  activities?.forEach(activity => {
    activityMap[activity.user_id] = activity;
  });

  // Build members HTML
  let membersHTML = '';
  members?.forEach(member => {
    const activity = activityMap[member.user_id];
    const username = member.profiles?.leetcode_username || member.profiles?.gfg_username || 'User';
    
    let status = '⏳';
    if (activity) {
      const platformRule = group.platform_rule.toLowerCase();
      if (platformRule === 'both') {
        status = (activity.leetcode_completed && activity.gfg_completed) ? '✅' : '❌';
      } else if (platformRule === 'leetcode') {
        status = activity.leetcode_completed ? '✅' : '❌';
      } else if (platformRule === 'gfg') {
        status = activity.gfg_completed ? '✅' : '❌';
      }
    }

    membersHTML += `
      <div class="member-item">
        <span class="member-name">${username}</span>
        <span class="member-status">${status}</span>
      </div>
    `;
  });

  card.innerHTML = `
    <div class="group-header">
      <div>
        <h4>${group.name}</h4>
        <div class="group-meta">
          <span class="badge">${group.type}</span>
          <span class="badge">${group.platform_rule}</span>
        </div>
      </div>
    </div>
    <div class="group-stats">
      <div class="stat">
        <span class="stat-label">Current Streak</span>
        <span class="stat-value">${group.current_streak || 0} days</span>
      </div>
      <div class="stat">
        <span class="stat-label">Highest Streak</span>
        <span class="stat-value">${group.highest_streak || 0} days</span>
      </div>
    </div>
    <div class="group-members">
      <div class="members-header">Members</div>
      ${membersHTML}
    </div>
  `;

  return card;
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
  // Auth form switching
  document.getElementById('showSignup').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('signupForm').classList.remove('hidden');
    clearError('authError');
  });

  document.getElementById('showLogin').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('signupForm').classList.add('hidden');
    document.getElementById('loginForm').classList.remove('hidden');
    clearError('authError');
  });

  // Login
  document.getElementById('loginBtn').addEventListener('click', handleLogin);

  // Signup
  document.getElementById('signupBtn').addEventListener('click', handleSignup);

  // Profile setup
  document.getElementById('profileSetupForm').addEventListener('submit', handleProfileSetup);

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);

  // Create group
  document.getElementById('createGroupBtn').addEventListener('click', () => {
    modals.createGroup.classList.remove('hidden');
    clearError('createGroupError');
  });

  document.getElementById('closeCreateModal').addEventListener('click', () => {
    modals.createGroup.classList.add('hidden');
  });

  document.getElementById('createGroupForm').addEventListener('submit', handleCreateGroup);

  // Join group
  document.getElementById('joinGroupBtn').addEventListener('click', () => {
    modals.joinGroup.classList.remove('hidden');
    clearError('joinGroupError');
  });

  document.getElementById('closeJoinModal').addEventListener('click', () => {
    modals.joinGroup.classList.add('hidden');
  });

  document.getElementById('joinGroupForm').addEventListener('submit', handleJoinGroup);

  // Close modals on outside click
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
      e.target.classList.add('hidden');
    }
  });
}

/**
 * Handle login
 */
async function handleLogin() {
  try {
    clearError('authError');

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
      showError('authError', 'Please enter email and password');
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    currentUser = data.user;
    await loadUserProfile();
  } catch (error) {
    console.error('Login error:', error);
    showError('authError', error.message || 'Login failed');
  }
}

/**
 * Handle signup
 */
async function handleSignup() {
  try {
    clearError('authError');

    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;

    if (!email || !password) {
      showError('authError', 'Please enter email and password');
      return;
    }

    if (password.length < 6) {
      showError('authError', 'Password must be at least 6 characters');
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });

    if (error) throw error;

    if (data.user) {
      currentUser = data.user;
      showScreen('profileSetup');
    }
  } catch (error) {
    console.error('Signup error:', error);
    showError('authError', error.message || 'Signup failed');
  }
}

/**
 * Handle profile setup
 */
async function handleProfileSetup(e) {
  e.preventDefault();

  try {
    clearError('profileError');

    const leetcodeUsername = document.getElementById('leetcodeUsername').value.trim();
    const gfgUsername = document.getElementById('gfgUsername').value.trim();

    if (!leetcodeUsername || !gfgUsername) {
      showError('profileError', 'Please enter both usernames');
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: currentUser.id,
        leetcode_username: leetcodeUsername,
        gfg_username: gfgUsername,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;

    await loadDashboard();
  } catch (error) {
    console.error('Profile setup error:', error);
    showError('profileError', error.message || 'Failed to save profiles');
  }
}

/**
 * Handle logout
 */
async function handleLogout() {
  try {
    await supabase.auth.signOut();
    currentUser = null;
    currentProfile = null;
    showScreen('auth');
  } catch (error) {
    console.error('Logout error:', error);
  }
}

/**
 * Handle create group
 */
async function handleCreateGroup(e) {
  e.preventDefault();

  try {
    clearError('createGroupError');

    const name = document.getElementById('groupName').value.trim();
    const type = document.getElementById('groupType').value;
    const platformRule = document.getElementById('platformRule').value;
    const deadlineTime = document.getElementById('deadlineTime').value;

    if (!name) {
      showError('createGroupError', 'Please enter group name');
      return;
    }

    // Generate invite code
    const inviteCode = generateInviteCode();

    // Create group
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .insert({
        name,
        type,
        platform_rule: platformRule,
        deadline_time: deadlineTime,
        invite_code: inviteCode,
        created_by: currentUser.id,
        current_streak: 0,
        highest_streak: 0
      })
      .select()
      .single();

    if (groupError) throw groupError;

    // Add creator as member
    const { error: memberError } = await supabase
      .from('group_members')
      .insert({
        group_id: group.id,
        user_id: currentUser.id,
        joined_at: new Date().toISOString()
      });

    if (memberError) throw memberError;

    // Close modal and reload groups
    modals.createGroup.classList.add('hidden');
    document.getElementById('createGroupForm').reset();
    await loadGroups();

    // Show invite code
    alert(`Group created! Invite code: ${inviteCode}`);
  } catch (error) {
    console.error('Create group error:', error);
    showError('createGroupError', error.message || 'Failed to create group');
  }
}

/**
 * Handle join group
 */
async function handleJoinGroup(e) {
  e.preventDefault();

  try {
    clearError('joinGroupError');

    const inviteCode = document.getElementById('inviteCode').value.trim().toUpperCase();

    if (!inviteCode) {
      showError('joinGroupError', 'Please enter invite code');
      return;
    }

    // Find group by invite code
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('*')
      .eq('invite_code', inviteCode)
      .single();

    if (groupError || !group) {
      showError('joinGroupError', 'Invalid invite code');
      return;
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', group.id)
      .eq('user_id', currentUser.id)
      .single();

    if (existing) {
      showError('joinGroupError', 'You are already a member of this group');
      return;
    }

    // Add as member
    const { error: memberError } = await supabase
      .from('group_members')
      .insert({
        group_id: group.id,
        user_id: currentUser.id,
        joined_at: new Date().toISOString()
      });

    if (memberError) throw memberError;

    // Close modal and reload groups
    modals.joinGroup.classList.add('hidden');
    document.getElementById('joinGroupForm').reset();
    await loadGroups();
  } catch (error) {
    console.error('Join group error:', error);
    showError('joinGroupError', error.message || 'Failed to join group');
  }
}

/**
 * Utility functions
 */

function showScreen(screenName) {
  Object.values(screens).forEach(screen => screen.classList.add('hidden'));
  screens[screenName].classList.remove('hidden');
}

function showError(elementId, message) {
  const errorElement = document.getElementById(elementId);
  errorElement.textContent = message;
  errorElement.classList.remove('hidden');
}

function clearError(elementId) {
  const errorElement = document.getElementById(elementId);
  errorElement.textContent = '';
  errorElement.classList.add('hidden');
}

function generateInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}