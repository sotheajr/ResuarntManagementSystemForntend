import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { t } from '../../translations/common';
import {
  Loader2,
  AlertCircle,
  X,
  Trash2,
  Shield,
  ShieldCheck,
  ShieldOff,
  Plus,
  Save,
  Pencil,
  CheckCircle2,
  Lock,
} from 'lucide-react';

import * as rolesAPI from '../../services/roleService';

// Module definition matrix with unique granular permissions (e.g., view_users, create_users, etc.)
const MODULES = [
  { id: 'users', label: 'Users', actions: ['view', 'create', 'update', 'delete'] },
  { id: 'roles', label: 'Roles', actions: ['view', 'create', 'update', 'delete'] },
  { id: 'categories', label: 'Categories', actions: ['view', 'create', 'update', 'delete'] },
  { id: 'sub_categories', label: 'Sub Categories', actions: ['view', 'create', 'update', 'delete'] },
  { id: 'menu', label: 'Menu', actions: ['view', 'create', 'update', 'delete'] },
  { id: 'tables', label: 'Tables', actions: ['view', 'create', 'update', 'delete'] },
  { id: 'customers', label: 'Customers', actions: ['view', 'create', 'update', 'delete'] },
  { id: 'orders', label: 'Orders', actions: ['view', 'create', 'update', 'delete'] },
  { id: 'payments', label: 'Payments', actions: ['view', 'create', 'update', 'delete'] },
  { id: 'reservations', label: 'Reservations', actions: ['view', 'create', 'update', 'delete'] },
  { id: 'reports', label: 'Reports', actions: ['view', 'create', 'update', 'delete'] },
  { id: 'inventory', label: 'Inventory', actions: ['view', 'create', 'update', 'delete'] },
  { id: 'suppliers', label: 'Suppliers', actions: ['view', 'create', 'update', 'delete'] },
  { id: 'purchases', label: 'Purchases', actions: ['view', 'create', 'update', 'delete'] },
  { id: 'partners', label: 'Partners', actions: ['view', 'create', 'update', 'delete'] },
  { id: 'attendances', label: 'Attendances', actions: ['view', 'create', 'update', 'delete'] },
];

const SPECIAL_ACTIONS = ['seat_guest', 'print_receipt', 'manage_permissions'];

// Generate PERMISSION_GROUPS from MODULES + Special Actions
const PERMISSION_GROUPS = MODULES.map((m) => ({
  name: m.label,
  table: m.id,
  actions: m.actions,
  permissions: m.actions.map((act) => `${act}_${m.id}`),
})).concat([
  {
    name: 'Special Actions',
    table: 'special',
    actions: SPECIAL_ACTIONS,
    permissions: SPECIAL_ACTIONS,
  },
]);

const PERMISSION_LABELS = {
  view_users: 'View Users',
  create_users: 'Create Users',
  update_users: 'Update Users',
  delete_users: 'Delete Users',
  view_roles: 'View Roles',
  create_roles: 'Create Roles',
  update_roles: 'Update Roles',
  delete_roles: 'Delete Roles',
  view_categories: 'View Categories',
  create_categories: 'Create Categories',
  update_categories: 'Update Categories',
  delete_categories: 'Delete Categories',
  view_sub_categories: 'View Sub Categories',
  create_sub_categories: 'Create Sub Categories',
  update_sub_categories: 'Update Sub Categories',
  delete_sub_categories: 'Delete Sub Categories',
  view_menu: 'View Menu',
  create_menu: 'Create Menu',
  update_menu: 'Update Menu',
  delete_menu: 'Delete Menu',
  view_tables: 'View Tables',
  create_tables: 'Create Tables',
  update_tables: 'Update Tables',
  delete_tables: 'Delete Tables',
  view_customers: 'View Customers',
  create_customers: 'Create Customers',
  update_customers: 'Update Customers',
  delete_customers: 'Delete Customers',
  view_orders: 'View Orders',
  create_orders: 'Create Orders',
  update_orders: 'Update Orders',
  delete_orders: 'Delete Orders',
  view_payments: 'View Payments',
  create_payments: 'Create Payments',
  update_payments: 'Update Payments',
  delete_payments: 'Delete Payments',
  view_reservations: 'View Reservations',
  create_reservations: 'Create Reservations',
  update_reservations: 'Update Reservations',
  delete_reservations: 'Delete Reservations',
  view_reports: 'View Reports',
  create_reports: 'Create Reports',
  update_reports: 'Update Reports',
  delete_reports: 'Delete Reports',
  view_inventory: 'View Inventory',
  create_inventory: 'Create Inventory',
  update_inventory: 'Update Inventory',
  delete_inventory: 'Delete Inventory',
  view_suppliers: 'View Suppliers',
  create_suppliers: 'Create Suppliers',
  update_suppliers: 'Update Suppliers',
  delete_suppliers: 'Delete Suppliers',
  view_purchases: 'View Purchases',
  create_purchases: 'Create Purchases',
  update_purchases: 'Update Purchases',
  delete_purchases: 'Delete Purchases',
  view_partners: 'View Partners',
  create_partners: 'Create Partners',
  update_partners: 'Update Partners',
  delete_partners: 'Delete Partners',
  view_attendances: 'View Attendances',
  create_attendances: 'Create Attendances',
  update_attendances: 'Update Attendances',
  delete_attendances: 'Delete Attendances',
  seat_guest: 'Seat Guest',
  print_receipt: 'Print Receipt',
  manage_permissions: 'Manage Permissions',
};



const RolesManagement = () => {
  const { language } = useLanguage();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Selected role for permissions editing
  const [selectedRole, setSelectedRole] = useState(null);
  const [permissionsState, setPermissionsState] = useState({});
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [permissionsChanged, setPermissionsChanged] = useState(false);

  // Create role modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState(null);

  // Edit role name modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [editRoleName, setEditRoleName] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState(null);

  // ============================================================
  // CRITICAL: Safely convert Oracle can_access to boolean
  // Oracle returns "0"/"1" as STRINGS (not numbers/booleans).
  // JavaScript Boolean("0") returns TRUE because "0" is a non-empty string!
  // This function handles all possible formats from Oracle + yajra/oci8.
  // ============================================================
  const toBoolean = (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true';
    return false;
  };

  // Fetch roles on mount
  const fetchRoles = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await rolesAPI.getRolesWithPermissions();
      const roleData = response.data?.data?.data || response.data?.data || response.data || [];
      const rolesList = Array.isArray(roleData) ? roleData : [];
      setRoles(rolesList);

      // If we had a selected role, refresh its permissions
      if (selectedRole) {
        const updated = rolesList.find((r) => (r.role_id || r.id) === (selectedRole.role_id || selectedRole.id));
        if (updated) {
          setSelectedRole(updated);
          buildPermissionsState(updated);
        }
      }
    } catch (err) {
      console.error('Failed to fetch roles:', err);
      setError(err.response?.data?.message || t('Failed to load roles.', language));
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  // Clear success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // ============================================================
  // Find the most recent permission entry for a given name.
  // If duplicates exist (multiple rows with same permission_name
  // for the same role), we pick the one with the HIGHEST
  // permission_id to get the most up-to-date can_access value.
  // ============================================================
  const findPermissionByName = (perms, permName) => {
    const matches = perms.filter(
      (p) => (p.permission_name || p.PERMISSION_NAME) === permName
    );
    if (matches.length === 0) return null;
    // Pick the entry with the highest permission_id (most recent)
    return matches.reduce((best, curr) => {
      const bestId = best.permission_id || best.PERMISSION_ID || 0;
      const currId = curr.permission_id || curr.PERMISSION_ID || 0;
      return currId > bestId ? curr : best;
    });
  };

  // ============================================================
  // Build permissions state from a role object
  // Matches by permission_name (not permission_id) to avoid
  // duplicate ID issues across different roles.
  // Uses toBoolean() to correctly handle Oracle "0"/"1" strings.
  // ============================================================
  const buildPermissionsState = (role) => {
    const isSuperAdmin = (role.role_id === 1 || role.id === 1 || role.role_name === 'Admin');
    const state = {};
    const perms = role.permissions || [];

    // Collect all known permission names
    const allPerms = new Set();
    PERMISSION_GROUPS.forEach((group) => group.permissions.forEach((p) => allPerms.add(p)));

    // Set each permission's access state by matching permission_name
    allPerms.forEach((permName) => {
      if (isSuperAdmin) {
        state[permName] = true;
      } else {
        const found = findPermissionByName(perms, permName);
        state[permName] = found ? toBoolean(found.can_access ?? found.CAN_ACCESS) : false;
      }
    });

    setPermissionsState(state);
    setPermissionsChanged(false);
  };

  // Handle selecting a role to edit its permissions
  const handleSelectRole = (role) => {
    setSelectedRole(role);
    buildPermissionsState(role);
  };

  // Toggle a single permission
  const handleTogglePermission = (permName) => {
    if (selectedRole && (selectedRole.role_id === 1 || selectedRole.id === 1 || selectedRole.role_name === 'Admin')) {
      return;
    }
    setPermissionsState((prev) => {
      const updated = { ...prev, [permName]: !prev[permName] };
      return updated;
    });
    setPermissionsChanged(true);
  };

  // Toggle all permissions in a group
  const handleToggleGroup = (groupPerms, enable) => {
    if (selectedRole && (selectedRole.role_id === 1 || selectedRole.id === 1 || selectedRole.role_name === 'Admin')) {
      return;
    }
    setPermissionsState((prev) => {
      const updated = { ...prev };
      groupPerms.forEach((p) => {
        updated[p] = enable;
      });
      return updated;
    });
    setPermissionsChanged(true);
  };

  // ============================================================
  // Save permissions for the selected role
  // Sends exact permission_name + can_access pairs to the backend.
  // After saving, updates local state immediately (does NOT rely
  // on backend response which may return stale Oracle data).
  // ============================================================
  const handleSavePermissions = async () => {
    if (!selectedRole) return;
    setSavingPermissions(true);

    try {
      // Build payload using the exact current permissionsState
      const payload = Object.entries(permissionsState).map(([permission_name, can_access]) => ({
        permission_name,
        can_access: Boolean(can_access),
      }));

      const roleId = selectedRole.role_id || selectedRole.id;
      await rolesAPI.updateRolePermissions(roleId, payload);

      // Immediately clear unsaved-changes flag on success
      setPermissionsChanged(false);
      setSuccessMessage(`${t('Permissions updated for', language)} "${selectedRole.role_name}" ${t('successfully', language)}`);

      // Build the exact permissions array from our current state (not from backend response)
      const savedPermissions = Object.entries(permissionsState).map(([permission_name, can_access]) => ({
        permission_name,
        can_access: Boolean(can_access),
      }));

      // Update selectedRole's permissions in place with our exact saved values
      const updatedRole = {
        ...selectedRole,
        permissions: savedPermissions,
      };
      setSelectedRole(updatedRole);

      // Update the role in the roles list too so the progress bar refreshes accurately
      setRoles((prev) =>
        prev.map((r) => {
          const rId = r.role_id || r.id;
          if (rId === roleId) {
            return { ...r, permissions: savedPermissions };
          }
          return r;
        })
      );

      // Background-refresh roles list (for role names, etc.) but preserve our exact permissions
      try {
        const response = await rolesAPI.getRolesWithPermissions();
        const refreshedData = response.data?.data?.data || response.data?.data || response.data || [];
        const refreshedList = Array.isArray(refreshedData) ? refreshedData : [];
        setRoles(refreshedList);
        // Override the selected role's permissions with our exact saved values
        const found = refreshedList.find((r) => (r.role_id || r.id) === roleId);
        if (found) {
          setSelectedRole({ ...found, permissions: savedPermissions });
        }
      } catch {
        // Silently ignore background refresh errors; local state is already correct
      }
    } catch (err) {
      console.error('Failed to save permissions:', err);
      setError(err.response?.data?.message || t('Failed to save permissions.', language));
    } finally {
      setSavingPermissions(false);
    }
  };

  // Create a new role
  const handleCreateRole = async (e) => {
    e.preventDefault();
    setCreateError(null);
    if (!newRoleName.trim()) {
      setCreateError(t('Role name is required', language));
      return;
    }
    setCreateSubmitting(true);
    try {
      await rolesAPI.createRole({ role_name: newRoleName.trim() });
      setNewRoleName('');
      setShowCreateModal(false);
      setSuccessMessage(`${t('Role created successfully!', language)}`);
      await fetchRoles();
    } catch (err) {
      console.error('Failed to create role:', err);
      setCreateError(err.response?.data?.message || t('Failed to create role.', language));
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Open edit role modal
  const handleOpenEditRole = (role, e) => {
    e.stopPropagation();
    setEditingRole(role);
    setEditRoleName(role.role_name || '');
    setEditError(null);
    setShowEditModal(true);
  };

  // Update role name
  const handleUpdateRole = async (e) => {
    e.preventDefault();
    setEditError(null);
    if (!editRoleName.trim()) {
      setEditError(t('Role name is required', language));
      return;
    }
    setEditSubmitting(true);
    try {
      const roleId = editingRole.role_id || editingRole.id;
      await rolesAPI.updateRole(roleId, { role_name: editRoleName.trim() });
      setShowEditModal(false);
      setEditingRole(null);
      setSuccessMessage(`${t('Role renamed to', language)} "${editRoleName.trim()}" ${t('successfully', language)}`);
      await fetchRoles();
    } catch (err) {
      console.error('Failed to update role:', err);
      setEditError(err.response?.data?.message || t('Failed to update role.', language));
    } finally {
      setEditSubmitting(false);
    }
  };

  // Delete a role
  const handleDeleteRole = async (role, e) => {
    e.stopPropagation();
    if (role.role_id === 1 || role.id === 1) {
      setError(t('Cannot delete the Admin role.', language));
      return;
    }
    if (!window.confirm(`${t('Are you sure you want to delete', language)} "${role.role_name}"? ${t('Users in this role will be reassigned to Cashier.', language)}`)) {
      return;
    }
    try {
      const roleId = role.role_id || role.id;
      await rolesAPI.deleteRole(roleId);
      setSuccessMessage(`${t('Role deleted successfully!', language)}`);
      if (selectedRole && (selectedRole.role_id || selectedRole.id) === roleId) {
        setSelectedRole(null);
        setPermissionsState({});
      }
      await fetchRoles();
    } catch (err) {
      console.error('Failed to delete role:', err);
      setError(err.response?.data?.message || t('Failed to delete role.', language));
    }
  };

  // ============================================================
  // Count how many permissions are enabled for a role.
  // Deduplicates by permission_name — if multiple rows share the
  // same permission_name (from a previous bug), picks the one
  // with the highest permission_id and uses its can_access value.
  // Prevents duplicate rows from inflating the enabled count.
  // ============================================================
  const countEnabledPermissions = (role) => {
    const perms = role.permissions || [];
    // Group by permission_name, pick latest entry (highest permission_id)
    const latestPerms = {};
    perms.forEach((p) => {
      const name = p.permission_name || p.PERMISSION_NAME;
      if (!name) return;
      const existing = latestPerms[name];
      const existingId = existing ? (existing.permission_id || existing.PERMISSION_ID || 0) : 0;
      const currentId = p.permission_id || p.PERMISSION_ID || 0;
      if (!existing || currentId > existingId) {
        latestPerms[name] = p;
      }
    });
    // Count how many of the latest entries have can_access == true
    return Object.values(latestPerms).filter((p) => toBoolean(p.can_access ?? p.CAN_ACCESS)).length;
  };

  const isDefaultRole = (role) => {
    const id = role.role_id || role.id;
    return id <= 3;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('Roles & Permissions', language)}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('Manage roles and configure their permissions', language)}
          </p>
        </div>
        <button
          onClick={() => {
            setNewRoleName('');
            setCreateError(null);
            setShowCreateModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm shadow-sm"
        >
          <Plus className="w-4 h-4" />
          {t('Create New Role', language)}
        </button>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          {successMessage}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Layout: Left (Roles List) + Right (Permissions Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ==================== LEFT PANEL: Roles List ==================== */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-600" />
                {t('All Roles', language)}
              </h2>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
              </div>
            ) : roles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <ShieldOff className="w-10 h-10 text-gray-300 mb-3" />
                <p className="text-sm text-gray-500">{t('No roles found', language)}</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {roles.map((role) => {
                  const roleId = role.role_id || role.id;
                  const isSelected = selectedRole && (selectedRole.role_id || selectedRole.id) === roleId;
                  const isDefault = isDefaultRole(role);
                  const enabledCount = countEnabledPermissions(role);
                  const totalPerms = PERMISSION_GROUPS.reduce((sum, g) => sum + g.permissions.length, 0);

                  return (
                    <div
                      key={roleId}
                      onClick={() => handleSelectRole(role)}
                      className={`px-5 py-4 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-50 border-l-4 border-l-blue-600'
                          : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-gray-900 truncate">
                              {role.role_name}
                            </h3>
                            {isDefault && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500 uppercase tracking-wider">
                                {t('Default', language)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <div className="w-full max-w-[120px] h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-600 rounded-full transition-all"
                                style={{ width: `${(enabledCount / totalPerms) * 100}%` }}
                              />
                            </div>
                            <span className="text-[11px] text-gray-400">
                              {enabledCount}/{totalPerms}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 ml-2 flex-shrink-0">
                          <button
                            onClick={(e) => handleOpenEditRole(role, e)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title={t('Edit role name', language)}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {!isDefault && (
                            <button
                              onClick={(e) => handleDeleteRole(role, e)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title={t('Delete role', language)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ==================== RIGHT PANEL: Permissions Grid ==================== */}
        <div className="lg:col-span-2">
          {!selectedRole ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm h-full min-h-[400px] flex flex-col items-center justify-center text-center px-6">
              <ShieldCheck className="w-16 h-16 text-gray-200 mb-4" />
              <h3 className="text-lg font-medium text-gray-800 mb-1">{t('Select a Role', language)}</h3>
              <p className="text-sm text-gray-500 max-w-sm">
                {t('Click on a role from the left panel to view and configure its permissions.', language)}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">
                    {t('Permissions for', language)} <span className="text-blue-600">{selectedRole.role_name}</span>
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {selectedRole.role_id === 1 || selectedRole.id === 1 || selectedRole.role_name === 'Admin'
                      ? t('Admin Role has full system permissions (Protected / Read-Only)', language)
                      : t('Toggle checkboxes to grant or revoke permissions', language)}
                  </p>
                </div>
                {permissionsChanged && !(selectedRole.role_id === 1 || selectedRole.id === 1 || selectedRole.role_name === 'Admin') && (
                  <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full font-medium">
                    {t('Unsaved changes', language)}
                  </span>
                )}
              </div>

              {/* Admin Info Banner */}
              {(selectedRole.role_id === 1 || selectedRole.id === 1 || selectedRole.role_name === 'Admin') && (
                <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2.5 text-amber-800 text-sm">
                  <Lock className="w-4 h-4 flex-shrink-0 text-amber-600" />
                  <span>{t('🔒 Admin Role has full system permissions (Protected / Read-Only)', language)}</span>
                </div>
              )}

              {/* Permissions Grid */}
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {PERMISSION_GROUPS.map((group) => {
                    const isAdmin = selectedRole.role_id === 1 || selectedRole.id === 1 || selectedRole.role_name === 'Admin';
                    const allEnabled = group.permissions.every((p) => isAdmin || permissionsState[p]);
                    const someEnabled = group.permissions.some((p) => isAdmin || permissionsState[p]);

                    return (
                      <div
                        key={group.name}
                        className="border border-gray-200 rounded-xl overflow-hidden"
                      >
                        {/* Group Header */}
                        <div
                          className={`flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200 transition-colors ${
                            isAdmin ? 'cursor-default' : 'cursor-pointer hover:bg-gray-100'
                          }`}
                          onClick={() => !isAdmin && handleToggleGroup(group.permissions, !allEnabled)}
                        >
                          <span className="text-sm font-semibold text-gray-700">
                            {t(group.name, language)}
                          </span>
                          <span
                            className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                              allEnabled
                                ? 'bg-green-100 text-green-700'
                                : someEnabled
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {allEnabled ? t('All', language) : someEnabled ? t('Partial', language) : t('None', language)}
                          </span>
                        </div>

                        {/* Permission Items */}
                        <div className="px-4 py-2 space-y-1">
                          {group.permissions.map((permName) => (
                            <label
                              key={permName}
                              className={`flex items-center gap-3 py-1.5 rounded-lg px-2 -mx-2 transition-colors ${
                                isAdmin ? 'cursor-not-allowed opacity-90' : 'cursor-pointer group hover:bg-gray-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isAdmin ? true : (permissionsState[permName] || false)}
                                disabled={isAdmin}
                                onChange={() => !isAdmin && handleTogglePermission(permName)}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                              />
                              <span className={`text-sm text-gray-700 ${!isAdmin ? 'group-hover:text-gray-900' : ''}`}>
                                {t(PERMISSION_LABELS[permName] || permName.replace(/_/g, ' '), language)}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Save Button */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  {selectedRole.role_id === 1 || selectedRole.id === 1 || selectedRole.role_name === 'Admin'
                    ? t('Super Admin permissions are permanently active and cannot be modified.', language)
                    : t('Click group headers to toggle all permissions in that group', language)}
                </p>
                {!(selectedRole.role_id === 1 || selectedRole.id === 1 || selectedRole.role_name === 'Admin') && (
                  <button
                    onClick={handleSavePermissions}
                    disabled={!permissionsChanged || savingPermissions}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    {savingPermissions ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('Saving', language)}
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        {t('Save Permissions', language)}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ==================== CREATE ROLE MODAL ==================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{t('Create New Role', language)}</h2>
                <p className="text-sm text-gray-500 mt-0.5">{t('Add a new role to the system', language)}</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateRole} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t('Role Name', language)} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder={t('e.g. Manager, Chef, Host', language)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  required
                  maxLength={30}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  {t('Cancel', language)}
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('Creating...', language)}
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      {t('Create Role', language)}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== EDIT ROLE NAME MODAL ==================== */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setShowEditModal(false); setEditingRole(null); }} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{t('Edit Role Name', language)}</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {t('Rename', language)} <span className="font-medium text-gray-700">{editingRole?.role_name}</span>
                </p>
              </div>
              <button
                onClick={() => { setShowEditModal(false); setEditingRole(null); }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {editError}
              </div>
            )}

            <form onSubmit={handleUpdateRole} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t('Role Name', language)} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editRoleName}
                  onChange={(e) => setEditRoleName(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  required
                  maxLength={30}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditingRole(null); }}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  {t('Cancel', language)}
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('Saving', language)}
                    </>
                  ) : (
                    <>
                      <Pencil className="w-5 h-5" />
                      {t('Save Name', language)}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RolesManagement;
