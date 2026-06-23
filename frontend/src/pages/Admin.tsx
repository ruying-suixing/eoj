import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth';
import { useToastStore } from '../store/toast';
import { useSettingsStore } from '../store/settings';
import { DIFFICULTIES, DIFFICULTY_COLORS } from '../constants';
import {
  Plus, FileText, Save, Users, Shield, User,
  BarChart3, ClipboardList, Send, TrendingUp,
  Search, Trash2, Edit3, X, ChevronLeft, ChevronRight,
  ChevronDown, ChevronUp, Swords, Ticket, BookOpen, Database, Megaphone, Settings, FolderOpen, Image, File
} from 'lucide-react';
import { t } from '../i18n';
import { usePermissions } from '../hooks/usePermissions';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import './Admin.css';

type TabType = 'dashboard' | 'problem' | 'problem-management' | 'testcase' | 'users' | 'contests' | 'tickets' | 'lists' | 'announcement' | 'settings' | 'uploads' | 'sql';

export default function Admin() {
  const { user } = useAuthStore();
  const perms = usePermissions();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  useDocumentTitle(t('admin.title'));
  const [saving, setSaving] = useState(false);
  const [userList, setUserList] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [userPagination, setUserPagination] = useState<any>(null);

  // Dashboard stats
  const [stats, setStats] = useState<{ users: number; problems: number; submissions: number; today_submissions: number } | null>(null);

  // Problem management
  const [adminProblems, setAdminProblems] = useState<any[]>([]);
  const [problemPagination, setProblemPagination] = useState<any>(null);
  const [problemSearch, setProblemSearch] = useState('');
  const [problemPage, setProblemPage] = useState(1);
  const [editingProblem, setEditingProblem] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});

  // Create problem form
  const [problemForm, setProblemForm] = useState({
    title: '',
    slug: '',
    description: '',
    input_format: '',
    output_format: '',
    time_limit: 1000,
    memory_limit: 256,
    tags: [] as string[],
    difficulty: 'Easy',
    is_public: true,
    judge_type: 'default' as 'default' | 'spj',
    spj_language: 'cpp' as string,
  });

  const [spjCode, setSpjCode] = useState('');

  const [tagInput, setTagInput] = useState('');
  const [testcaseSearch, setTestcaseSearch] = useState('');
  const [selectedTestcaseProblem, setSelectedTestcaseProblem] = useState<any>(null);
  const [existingTestcases, setExistingTestcases] = useState<any[]>([]);
  const [testcases, setTestcases] = useState([{ input: '', expected_output: '', is_sample: false, score: 10 }]);

  // New states for enhancements
  const [pendingProblemId, setPendingProblemId] = useState<number | null>(null);
  const [testcaseSearchResults, setTestcaseSearchResults] = useState<any[]>([]);
  const [expandedTestcases, setExpandedTestcases] = useState<Set<number>>(new Set());
  const [selectedProblemJudgeType, setSelectedProblemJudgeType] = useState<string>('default');
  const testcaseSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Contest management
  const [adminContests, setAdminContests] = useState<any[]>([]);
  const [contestPagination, setContestPagination] = useState<any>(null);
  const [contestPage, setContestPage] = useState(1);

  // Ticket management
  const [adminTickets, setAdminTickets] = useState<any[]>([]);
  const [ticketPagination, setTicketPagination] = useState<any>(null);
  const [ticketPage, setTicketPage] = useState(1);
  const [ticketStatusFilter, setTicketStatusFilter] = useState('');

  // List management
  const [adminLists, setAdminLists] = useState<any[]>([]);
  const [listPagination, setListPagination] = useState<any>(null);
  const [listPage, setListPage] = useState(1);

  // SQL Editor
  const [sqlMode, setSqlMode] = useState<'command' | 'visual'>('visual');
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM users LIMIT 10');
  const [sqlResult, setSqlResult] = useState<any>(null);
  const [sqlError, setSqlError] = useState('');
  const [sqlExecuting, setSqlExecuting] = useState(false);
  const [sqlPassword, setSqlPassword] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pendingDeleteAction, setPendingDeleteAction] = useState<(() => void) | null>(null);

  // Visual editor state
  const [sqlTables, setSqlTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [tableSchema, setTableSchema] = useState<any[]>([]);
  const [tableData, setTableData] = useState<any[]>([]);
  const [tablePagination, setTablePagination] = useState<any>(null);
  const [tablePage, setTablePage] = useState(1);
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [addingRow, setAddingRow] = useState(false);
  const [newRowData, setNewRowData] = useState<Record<string, any>>({});

  // Permission editing
  const [editingPermissions, setEditingPermissions] = useState<number | null>(null);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);

  // Announcement editing
  const [announcementContent, setAnnouncementContent] = useState('');
  const [announcementSaving, setAnnouncementSaving] = useState(false);
  const [announcementLoaded, setAnnouncementLoaded] = useState(false);

  // Site settings
  const [settingsRegistrationOpen, setSettingsRegistrationOpen] = useState(true);
  const [settingsEmailRequired, setSettingsEmailRequired] = useState(false);
  const [settingsEmailSuffixes, setSettingsEmailSuffixes] = useState('');
  const [settingsUploadEnabled, setSettingsUploadEnabled] = useState(true);
  const [settingsImageUploadEnabled, setSettingsImageUploadEnabled] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Upload management
  const [adminUploads, setAdminUploads] = useState<any[]>([]);
  const [uploadPagination, setUploadPagination] = useState<any>(null);
  const [uploadPage, setUploadPage] = useState(1);
  const [uploadTypeFilter, setUploadTypeFilter] = useState('');

  // Fetch dashboard stats
  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchStats();
    }
  }, [activeTab]);

  // Fetch user list
  useEffect(() => {
    if (activeTab === 'users') {
      fetchUserList();
    }
  }, [activeTab, userPage, userSearch]);

  // Fetch admin problems
  useEffect(() => {
    if (activeTab === 'problem-management') {
      fetchAdminProblems();
    }
  }, [activeTab, problemPage, problemSearch]);

  useEffect(() => {
    if (activeTab === 'contests') fetchAdminContests();
  }, [activeTab, contestPage]);

  useEffect(() => {
    if (activeTab === 'tickets') fetchAdminTickets();
  }, [activeTab, ticketPage, ticketStatusFilter]);

  useEffect(() => {
    if (activeTab === 'lists') fetchAdminLists();
  }, [activeTab, listPage]);

  useEffect(() => {
    if (activeTab === 'uploads') fetchAdminUploads();
  }, [activeTab, uploadPage, uploadTypeFilter]);

  useEffect(() => {
    if (activeTab === 'sql' && sqlMode === 'visual') {
      fetchSqlTables();
    }
  }, [activeTab, sqlMode]);

  useEffect(() => {
    if (activeTab === 'announcement' && !announcementLoaded) {
      fetchAnnouncement();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'settings' && !settingsLoaded) {
      fetchSiteSettings();
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedTable) fetchTableData();
  }, [selectedTable, tablePage]);

  const fetchStats = async () => {
    try {
      const data = await api.getAdminStats();
      setStats(data);
    } catch (e) {
      console.error('Failed to fetch stats:', e);
    }
  };

  const fetchAnnouncement = async () => {
    try {
      const data = await api.getSettings();
      setAnnouncementContent(data.announcement || '');
      setAnnouncementLoaded(true);
    } catch (e) {
      console.error('Failed to fetch announcement:', e);
    }
  };

  const handleSaveAnnouncement = async () => {
    setAnnouncementSaving(true);
    try {
      await api.updateSettings({ announcement: announcementContent });
      useToastStore().addToast('success', t('admin.announcementSaved'));
    } catch (e: any) {
      useToastStore().addToast('error', e.message || t('common.error'));
    } finally {
      setAnnouncementSaving(false);
    }
  };

  const fetchSiteSettings = async () => {
    try {
      const data = await api.getSettings();
      setSettingsRegistrationOpen(data.registration_open !== 'false');
      setSettingsEmailRequired(data.email_required === 'true');
      setSettingsEmailSuffixes(data.email_suffixes || '');
      setSettingsUploadEnabled(data.upload_enabled !== 'false');
      setSettingsImageUploadEnabled(data.image_upload_enabled !== 'false');
      setSettingsLoaded(true);
    } catch (e) {
      console.error('Failed to fetch site settings:', e);
    }
  };

  const fetchSettings = useSettingsStore((s) => s.fetchSettings);

  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    try {
      await api.updateSettings({
        registration_open: String(settingsRegistrationOpen),
        email_required: String(settingsEmailRequired),
        email_suffixes: settingsEmailSuffixes,
        upload_enabled: String(settingsUploadEnabled),
        image_upload_enabled: String(settingsImageUploadEnabled),
      });
      // Force refresh settings cache after saving
      await fetchSettings(true);
      useToastStore().addToast('success', t('admin.settingsSaved'));
    } catch (e: any) {
      useToastStore().addToast('error', e.message || t('common.error'));
    } finally {
      setSettingsSaving(false);
    }
  };

  const fetchUserList = async () => {
    try {
      const data = await api.getUserList({
        page: userPage,
        pageSize: 20,
        search: userSearch || undefined,
      });
      setUserList(data.users);
      setUserPagination(data.pagination);
    } catch (e) {
      console.error('Failed to fetch users:', e);
    }
  };

  const fetchAdminProblems = async () => {
    try {
      const data = await api.getAdminProblems({
        page: problemPage,
        pageSize: 10,
        search: problemSearch || undefined,
      });
      setAdminProblems(data.problems);
      setProblemPagination(data.pagination);
    } catch (e) {
      console.error('Failed to fetch admin problems:', e);
    }
  };

  const fetchAdminContests = async () => {
    try {
      const data = await api.getAdminContests({ page: contestPage, pageSize: 10 });
      setAdminContests(data.contests);
      setContestPagination(data.pagination);
    } catch (e) { console.error('Failed to fetch contests:', e); }
  };

  const fetchAdminTickets = async () => {
    try {
      const data = await api.getAdminTickets({ page: ticketPage, pageSize: 10, status: ticketStatusFilter || undefined });
      setAdminTickets(data.tickets);
      setTicketPagination(data.pagination);
    } catch (e) { console.error('Failed to fetch tickets:', e); }
  };

  const fetchAdminLists = async () => {
    try {
      const data = await api.getAdminLists({ page: listPage, pageSize: 10 });
      setAdminLists(data.lists);
      setListPagination(data.pagination);
    } catch (e) { console.error('Failed to fetch lists:', e); }
  };

  const fetchAdminUploads = async () => {
    try {
      const data = await api.getUploads({ page: uploadPage, pageSize: 10, type: uploadTypeFilter || undefined });
      setAdminUploads(data.uploads);
      setUploadPagination(data.pagination);
    } catch (e) { console.error('Failed to fetch uploads:', e); }
  };

  const handleDeleteUpload = async (id: number) => {
    if (!window.confirm(t('common.deleteConfirm'))) return;
    try {
      await api.deleteUpload(id);
      useToastStore().addToast('success', t('common.deleteSuccess'));
      fetchAdminUploads();
    } catch (e: any) {
      useToastStore().addToast('error', e.message || t('common.error'));
    }
  };

  const handleExecuteSql = async () => {
    setSqlExecuting(true);
    setSqlError('');
    setSqlResult(null);
    try {
      const upperQuery = sqlQuery.trim().toUpperCase();
      const needsPassword = upperQuery.startsWith('DELETE');
      const data = await api.executeSql(sqlQuery, needsPassword ? sqlPassword : undefined);
      setSqlResult(data);
      if (needsPassword) setSqlPassword('');
    } catch (e: any) {
      setSqlError(e.message || t('common.error'));
    } finally {
      setSqlExecuting(false);
    }
  };

  const fetchSqlTables = async () => {
    try {
      const data = await api.getSqlTables();
      setSqlTables(data.tables);
      if (data.tables.length > 0 && !selectedTable) {
        setSelectedTable(data.tables[0]);
      }
    } catch (e) { console.error('Failed to fetch tables:', e); }
  };

  const fetchTableData = async () => {
    if (!selectedTable) return;
    try {
      const data = await api.getTableData(selectedTable, { page: tablePage, pageSize: 20 });
      setTableData(data.rows);
      setTablePagination(data.pagination);
      // Also fetch schema
      const schemaData = await api.getTableSchema(selectedTable);
      setTableSchema(schemaData.schema);
    } catch (e: any) {
      console.error('Failed to fetch table data:', e);
    }
  };

  const handleCellEdit = (rowIdx: number, col: string, value: any) => {
    setEditingCell({ row: rowIdx, col });
    setEditingValue(value === null ? '' : String(value));
  };

  const handleCellSave = async (rowIdx: number) => {
    if (!selectedTable || !editingCell) return;
    const row = tableData[rowIdx];
    // Find primary key(s) from schema
    const pkCols = tableSchema.filter((s: any) => s.pk === 1).map((s: any) => s.name);
    const where: Record<string, any> = {};
    for (const pk of pkCols) {
      where[pk] = row[pk];
    }
    if (Object.keys(where).length === 0) {
      // No PK, use all original values
      for (const s of tableSchema) {
        where[s.name] = row[s.name];
      }
    }
    try {
      await api.updateTableRow(selectedTable, { [editingCell.col]: editingValue }, where);
      setEditingCell(null);
      fetchTableData();
    } catch (e: any) {
      setSqlError(e.message || t('common.error'));
    }
  };

  const handleAddRow = async () => {
    if (!selectedTable) return;
    try {
      await api.insertTableRow(selectedTable, newRowData);
      setAddingRow(false);
      setNewRowData({});
      fetchTableData();
    } catch (e: any) {
      setSqlError(e.message || t('common.error'));
    }
  };

  const handleDeleteRow = (row: any) => {
    const pkCols = tableSchema.filter((s: any) => s.pk === 1).map((s: any) => s.name);
    const where: Record<string, any> = {};
    for (const pk of pkCols) {
      where[pk] = row[pk];
    }
    if (Object.keys(where).length === 0) {
      for (const s of tableSchema) {
        where[s.name] = row[s.name];
      }
    }
    setPendingDeleteAction(() => async () => {
      try {
        await api.deleteTableRow(selectedTable, where, sqlPassword);
        setSqlPassword('');
        setShowPasswordModal(false);
        setPendingDeleteAction(null);
        fetchTableData();
      } catch (e: any) {
        setSqlError(e.message || t('common.error'));
        setShowPasswordModal(false);
      }
    });
    setShowPasswordModal(true);
  };

  const confirmDeleteWithPassword = () => {
    if (pendingDeleteAction) {
      pendingDeleteAction();
    }
  };

  const handleRoleChange = async (userId: number, newRole: string) => {
    try {
      await api.updateUserRole(userId, newRole);
      useToastStore().addToast('success', t('admin.roleUpdated'));
      fetchUserList();
    } catch (e: any) {
      useToastStore().addToast('error', e.message || t('common.error'));
    }
  };

  const handleEditPermissions = (userId: number, currentPermissions: string[]) => {
    setEditingPermissions(userId);
    setUserPermissions(currentPermissions || []);
  };

  const handleSavePermissions = async (userId: number) => {
    try {
      await api.updateUserPermissions(userId, userPermissions);
      setEditingPermissions(null);
      useToastStore().addToast('success', t('admin.permissionsUpdated'));
      fetchUserList();
    } catch (e: any) {
      console.error('Failed to update permissions:', e);
      useToastStore().addToast('error', e.message || t('common.error'));
    }
  };

  const togglePermission = (perm: string) => {
    setUserPermissions(prev =>
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !problemForm.tags.includes(tagInput.trim())) {
      setProblemForm({ ...problemForm, tags: [...problemForm.tags, tagInput.trim()] });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setProblemForm({ ...problemForm, tags: problemForm.tags.filter((t) => t !== tag) });
  };

  const handleCreateProblem = async () => {
    if (!problemForm.title || !problemForm.slug || !problemForm.description) {
      useToastStore().addToast('error', t('admin.titleRequired'));
      return;
    }
    setSaving(true);
    try {
      const data: any = { ...problemForm };
      if (problemForm.judge_type === 'spj') {
        data.spj_code = spjCode;
      }
      const result = await api.createProblem(data);
      useToastStore().addToast('success', t('admin.problemCreated'));
      // Switch to testcase tab with the new problem selected
      const newProblem = { id: result.id, title: problemForm.title, slug: problemForm.slug, difficulty: problemForm.difficulty, judge_type: problemForm.judge_type };
      setSelectedTestcaseProblem(newProblem);
      setSelectedProblemJudgeType(problemForm.judge_type);
      setActiveTab('testcase');
    } catch (e: any) {
      useToastStore().addToast('error', e.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleAddTestcaseRow = () => {
    setTestcases([...testcases, { input: '', expected_output: '', is_sample: false, score: 10 }]);
  };

  const handleSaveTestcases = async () => {
    if (!selectedTestcaseProblem) {
      useToastStore().addToast('error', t('admin.selectProblemFirst'));
      return;
    }
    const isSpj = selectedProblemJudgeType === 'spj';
    const validTestcases = testcases.filter((tc) => {
      if (isSpj) {
        return tc.input;
      }
      return tc.input && tc.expected_output;
    });
    if (validTestcases.length === 0) {
      useToastStore().addToast('error', t('admin.atLeastOneTestcase'));
      return;
    }
    setSaving(true);
    try {
      await api.addTestcases(selectedTestcaseProblem.id, validTestcases);
      useToastStore().addToast('success', t('admin.testcaseAdded'));
      setTestcases([{ input: '', expected_output: '', is_sample: false, score: 10 }]);
      // Refresh existing testcases
      const data = await api.getProblemTestcases(selectedTestcaseProblem.id);
      setExistingTestcases(data.testcases);
    } catch (e: any) {
      useToastStore().addToast('error', e.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleSelectTestcaseProblem = async (problem: any) => {
    setSelectedTestcaseProblem(problem);
    setSelectedProblemJudgeType(problem.judge_type || 'default');
    setTestcaseSearch('');
    // Fetch existing testcases from GitHub via API
    try {
      const data = await api.getProblemTestcases(problem.id);
      setExistingTestcases(data.testcases);
    } catch (e) {
      console.error('Failed to fetch testcases:', e);
      setExistingTestcases([]);
    }
  };

  const handleDeleteTestcase = async (index: number) => {
    if (!selectedTestcaseProblem) return;
    if (!window.confirm(t('admin.deleteTestcaseConfirm'))) return;
    try {
      await api.deleteTestcase(selectedTestcaseProblem.id, index);
      useToastStore().addToast('success', t('admin.testcaseDeleted'));
      // Refresh testcases
      const data = await api.getProblemTestcases(selectedTestcaseProblem.id);
      setExistingTestcases(data.testcases);
    } catch (e: any) {
      useToastStore().addToast('error', e.message || t('common.error'));
    }
  };

  const handleDeleteProblem = async (id: number) => {
    if (!window.confirm(t('admin.deleteConfirm'))) {
      return;
    }
    try {
      await api.deleteProblem(id);
      useToastStore().addToast('success', t('admin.problemDeleted'));
      fetchAdminProblems();
    } catch (e: any) {
      useToastStore().addToast('error', e.message || t('common.error'));
    }
  };

  const handleEditProblem = (problem: any) => {
    setEditingProblem(problem.id);
    setEditForm({
      title: problem.title || '',
      description: problem.description || '',
      input_format: problem.input_format || '',
      output_format: problem.output_format || '',
      time_limit: problem.time_limit || 1000,
      memory_limit: problem.memory_limit || 256,
      difficulty: problem.difficulty || 'Easy',
      is_public: !!problem.is_public,
    });
  };

  const handleSaveEdit = async (id: number) => {
    try {
      await api.updateProblem(id, editForm);
      useToastStore().addToast('success', t('admin.problemUpdated'));
      setEditingProblem(null);
      setEditForm({});
      fetchAdminProblems();
    } catch (e: any) {
      useToastStore().addToast('error', e.message || t('common.error'));
    }
  };

  const handleCancelEdit = () => {
    setEditingProblem(null);
    setEditForm({});
  };

  // Handle pending problem from "Manage Testcases" button
  useEffect(() => {
    if (activeTab === 'testcase' && pendingProblemId !== null) {
      const problem = adminProblems.find((p: any) => p.id === pendingProblemId);
      if (problem) {
        handleSelectTestcaseProblem(problem);
      }
      setPendingProblemId(null);
    }
  }, [activeTab, pendingProblemId]);

  // Toggle testcase expand/collapse
  const toggleTestcaseExpand = (index: number) => {
    setExpandedTestcases(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  // Debounced testcase search from backend API
  const handleTestcaseSearchChange = useCallback((value: string) => {
    setTestcaseSearch(value);
    setSelectedTestcaseProblem(null);
    if (testcaseSearchTimerRef.current) {
      clearTimeout(testcaseSearchTimerRef.current);
    }
    if (!value.trim()) {
      setTestcaseSearchResults([]);
      return;
    }
    testcaseSearchTimerRef.current = setTimeout(async () => {
      try {
        const data = await api.getAdminProblems({ search: value, pageSize: 10 });
        setTestcaseSearchResults(data.problems);
      } catch (e) {
        console.error('Failed to search problems:', e);
        setTestcaseSearchResults([]);
      }
    }, 300);
  }, []);

  if (!user || (!perms.hasAllPermissions && !perms.canManageContests && !perms.canManageProblems && !perms.canManageLists && !perms.canManageTickets && !perms.canManageUploads)) {
    return (
      <div className="empty-page">
        <h2>{t('admin.accessDenied')}</h2>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <h1>{t('admin.title')}</h1>

      <div className="admin-tabs">
        <button
          className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <BarChart3 size={16} /> {t('admin.dashboard')}
        </button>
        {perms.canManageProblems && (
          <button
            className={`tab-btn ${activeTab === 'problem' ? 'active' : ''}`}
            onClick={() => setActiveTab('problem')}
          >
            <Plus size={16} /> {t('admin.createProblem')}
          </button>
        )}
        {perms.canManageProblems && (
          <button
            className={`tab-btn ${activeTab === 'problem-management' ? 'active' : ''}`}
            onClick={() => setActiveTab('problem-management')}
          >
            <FileText size={16} /> {t('admin.problemManagement')}
          </button>
        )}
        {perms.canManageProblems && (
          <button
            className={`tab-btn ${activeTab === 'testcase' ? 'active' : ''}`}
            onClick={() => setActiveTab('testcase')}
          >
            <ClipboardList size={16} /> {t('admin.addTestcases')}
          </button>
        )}
        {perms.hasAllPermissions && (
          <button
            className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <Users size={16} /> {t('admin.userManagement')}
          </button>
        )}
        {perms.canManageContests && (
          <button
            className={`tab-btn ${activeTab === 'contests' ? 'active' : ''}`}
            onClick={() => setActiveTab('contests')}
          >
            <Swords size={16} /> {t('admin.contestManagement')}
          </button>
        )}
        {perms.canManageTickets && (
          <button
            className={`tab-btn ${activeTab === 'tickets' ? 'active' : ''}`}
            onClick={() => setActiveTab('tickets')}
          >
            <Ticket size={16} /> {t('admin.ticketManagement')}
          </button>
        )}
        {perms.canManageLists && (
          <button
            className={`tab-btn ${activeTab === 'lists' ? 'active' : ''}`}
            onClick={() => setActiveTab('lists')}
          >
            <BookOpen size={16} /> {t('admin.listManagement')}
          </button>
        )}
        {perms.hasAllPermissions && (
          <button
            className={`tab-btn ${activeTab === 'announcement' ? 'active' : ''}`}
            onClick={() => setActiveTab('announcement')}
          >
            <Megaphone size={16} /> {t('admin.announcementManagement')}
          </button>
        )}
        {perms.hasAllPermissions && (
          <button
            className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={16} /> {t('admin.siteSettings')}
          </button>
        )}
        {perms.canManageUploads && (
          <button
            className={`tab-btn ${activeTab === 'uploads' ? 'active' : ''}`}
            onClick={() => setActiveTab('uploads')}
          >
            <FolderOpen size={16} /> {t('admin.uploadManagement')}
          </button>
        )}
        {perms.isSuperAdmin && (
          <button
            className={`tab-btn ${activeTab === 'sql' ? 'active' : ''}`}
            onClick={() => setActiveTab('sql')}
          >
            <Database size={16} /> {t('admin.sqlEditor')}
          </button>
        )}
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="dashboard-stats">
          <div className="stat-card">
            <div className="stat-icon-wrapper blue">
              <Users size={24} />
            </div>
            <div className="stat-info">
              <div className="stat-number">{stats?.users ?? '-'}</div>
              <div className="stat-label">{t('admin.totalUsers')}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrapper green">
              <FileText size={24} />
            </div>
            <div className="stat-info">
              <div className="stat-number">{stats?.problems ?? '-'}</div>
              <div className="stat-label">{t('admin.totalProblems')}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrapper purple">
              <Send size={24} />
            </div>
            <div className="stat-info">
              <div className="stat-number">{stats?.submissions ?? '-'}</div>
              <div className="stat-label">{t('admin.totalSubmissions')}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrapper orange">
              <TrendingUp size={24} />
            </div>
            <div className="stat-info">
              <div className="stat-number">{stats?.today_submissions ?? '-'}</div>
              <div className="stat-label">{t('admin.todaySubmissions')}</div>
            </div>
          </div>
        </div>
      )}

      {/* Create Problem Tab */}
      {activeTab === 'problem' && (
        <div className="admin-form">
          <div className="form-group">
            <label>{t('admin.problemTitle')}</label>
            <input
              type="text"
              value={problemForm.title}
              onChange={(e) => setProblemForm({ ...problemForm, title: e.target.value })}
              placeholder="e.g., Two Sum"
            />
          </div>
          <div className="form-group">
            <label>{t('admin.slug')}</label>
            <input
              type="text"
              value={problemForm.slug}
              onChange={(e) => setProblemForm({ ...problemForm, slug: e.target.value })}
              placeholder="e.g., two-sum"
            />
          </div>
          <div className="form-group">
            <label>{t('admin.description')}</label>
            <textarea
              rows={8}
              value={problemForm.description}
              onChange={(e) => setProblemForm({ ...problemForm, description: e.target.value })}
              placeholder="Problem description in Markdown..."
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>{t('admin.inputFormat')}</label>
              <textarea
                rows={3}
                value={problemForm.input_format}
                onChange={(e) => setProblemForm({ ...problemForm, input_format: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>{t('admin.outputFormat')}</label>
              <textarea
                rows={3}
                value={problemForm.output_format}
                onChange={(e) => setProblemForm({ ...problemForm, output_format: e.target.value })}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>{t('admin.timeLimit')}</label>
              <input
                type="number"
                value={problemForm.time_limit}
                onChange={(e) => setProblemForm({ ...problemForm, time_limit: parseInt(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label>{t('admin.memoryLimit')}</label>
              <input
                type="number"
                value={problemForm.memory_limit}
                onChange={(e) => setProblemForm({ ...problemForm, memory_limit: parseInt(e.target.value) })}
              />
            </div>
          </div>
          <div className="form-group">
            <label>{t('admin.difficulty')}</label>
            <select
              value={problemForm.difficulty || 'Easy'}
              onChange={(e) => setProblemForm({ ...problemForm, difficulty: e.target.value })}
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>{t('admin.judgeType')}</label>
            <select
              value={problemForm.judge_type}
              onChange={(e) => setProblemForm({ ...problemForm, judge_type: e.target.value as 'default' | 'spj' })}
            >
              <option value="default">{t('admin.defaultJudge')}</option>
              <option value="spj">{t('admin.specialJudge')}</option>
            </select>
          </div>
          {problemForm.judge_type === 'spj' && (
            <>
              <div className="form-group">
                <label>{t('admin.spjLanguage')}</label>
                <select
                  value={problemForm.spj_language}
                  onChange={(e) => setProblemForm({ ...problemForm, spj_language: e.target.value })}
                >
                  <option value="cpp">C++</option>
                  <option value="c">C</option>
                  <option value="python">Python</option>
                  <option value="java">Java</option>
                  <option value="javascript">JavaScript</option>
                  <option value="go">Go</option>
                  <option value="rust">Rust</option>
                </select>
              </div>
              <div className="form-group">
                <label>{t('admin.spjCode')}</label>
                <textarea
                  rows={15}
                  value={spjCode}
                  onChange={(e) => setSpjCode(e.target.value)}
                  placeholder={t('admin.spjHint')}
                  style={{ fontFamily: 'monospace', fontSize: '13px' }}
                />
                <small style={{ color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                  {t('admin.spjHint')}
                </small>
              </div>
            </>
          )}
          <div className="form-group">
            <label>{t('admin.tags')}</label>
            <div className="tag-input-row">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                placeholder={t('admin.tagPlaceholder')}
              />
              <button className="btn btn-secondary btn-sm" onClick={handleAddTag}>{t('common.add')}</button>
            </div>
            <div className="tag-list">
              {problemForm.tags.map((tag) => (
                <span key={tag} className="tag-chip active" onClick={() => handleRemoveTag(tag)}>
                  {tag} ×
                </span>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={problemForm.is_public}
                onChange={(e) => setProblemForm({ ...problemForm, is_public: e.target.checked })}
              />
              {t('admin.public')}
            </label>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleCreateProblem}
            disabled={saving}
          >
            <Save size={16} />
            {saving ? t('admin.creating') : t('admin.createProblemButton')}
          </button>
        </div>
      )}

      {/* Problem Management Tab */}
      {activeTab === 'problem-management' && (
        <div className="admin-form">
          <div className="admin-search">
            <Search size={16} />
            <input
              type="text"
              placeholder={t('admin.searchProblems')}
              value={problemSearch}
              onChange={(e) => {
                setProblemSearch(e.target.value);
                setProblemPage(1);
              }}
            />
          </div>

          <div className="problem-management-table">
            <div className="pm-table-header">
              <span className="pm-col pm-col-id">{t('common.id')}</span>
              <span className="pm-col pm-col-title">{t('admin.problemTitle')}</span>
              <span className="pm-col pm-col-difficulty">{t('admin.difficulty')}</span>
              <span className="pm-col pm-col-testcase-count">{t('admin.testcaseCount')}</span>
              <span className="pm-col pm-col-public">{t('admin.public')}</span>
              <span className="pm-col pm-col-actions">{t('common.actions')}</span>
            </div>
            {adminProblems.length === 0 ? (
              <div className="pm-empty">{t('admin.noProblems')}</div>
            ) : (
              adminProblems.map((p: any) => (
                <div key={p.id} className="pm-table-row">
                  {editingProblem === p.id ? (
                    <div className="edit-form">
                      <div className="form-group">
                        <label>{t('admin.problemTitle')}</label>
                        <input
                          type="text"
                          value={editForm.title}
                          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>{t('admin.description')}</label>
                        <textarea
                          rows={4}
                          value={editForm.description}
                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        />
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>{t('admin.timeLimit')}</label>
                          <input
                            type="number"
                            value={editForm.time_limit}
                            onChange={(e) => setEditForm({ ...editForm, time_limit: parseInt(e.target.value) })}
                          />
                        </div>
                        <div className="form-group">
                          <label>{t('admin.memoryLimit')}</label>
                          <input
                            type="number"
                            value={editForm.memory_limit}
                            onChange={(e) => setEditForm({ ...editForm, memory_limit: parseInt(e.target.value) })}
                          />
                        </div>
                      </div>
                      <div className="form-group">
                        <label>{t('admin.difficulty')}</label>
                        <select
                          value={editForm.difficulty}
                          onChange={(e) => setEditForm({ ...editForm, difficulty: e.target.value })}
                        >
                          {DIFFICULTIES.map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={editForm.is_public}
                            onChange={(e) => setEditForm({ ...editForm, is_public: e.target.checked })}
                          />
                          {t('admin.public')}
                        </label>
                      </div>
                      <div className="form-actions">
                        <button className="btn btn-primary btn-sm" onClick={() => handleSaveEdit(p.id)}>
                          <Save size={14} /> {t('admin.save')}
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={handleCancelEdit}>
                          <X size={14} /> {t('admin.cancel')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="pm-col pm-col-id">{p.id}</span>
                      <span className="pm-col pm-col-title">{p.title}</span>
                      <span className="pm-col pm-col-difficulty">
                        <span
                          className="difficulty-badge"
                          style={{ color: DIFFICULTY_COLORS[p.difficulty] || '#8b8fa3' }}
                        >
                          {p.difficulty || 'N/A'}
                        </span>
                      </span>
                      <span className="pm-col pm-col-testcase-count">
                        <span className={p.testcase_count === 0 ? 'testcase-count-zero' : ''}>
                          {p.testcase_count ?? 0}
                        </span>
                      </span>
                      <span className="pm-col pm-col-public">
                        {p.is_public ? '✓' : '✗'}
                      </span>
                      <span className="pm-col pm-col-actions">
                        <div className="problem-row-actions">
                          <button
                            className="manage-testcases-btn"
                            onClick={() => {
                              setPendingProblemId(p.id);
                              setActiveTab('testcase');
                            }}
                          >
                            <FileText size={14} /> {t('admin.manageTestcases')}
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleEditProblem(p)}
                          >
                            <Edit3 size={14} /> {t('common.edit')}
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeleteProblem(p.id)}
                          >
                            <Trash2 size={14} /> {t('common.delete')}
                          </button>
                        </div>
                      </span>
                    </>
                  )}
                </div>
              ))
            )}
          </div>

          {problemPagination && problemPagination.totalPages > 1 && (
            <div className="pm-pagination">
              <button
                className="btn btn-secondary btn-sm"
                disabled={problemPage <= 1}
                onClick={() => setProblemPage(problemPage - 1)}
              >
                <ChevronLeft size={14} />
              </button>
              <span className="pm-page-info">
                {t('common.page').replace('{0}', String(problemPagination.page)).replace('{1}', String(problemPagination.totalPages))}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                disabled={problemPage >= problemPagination.totalPages}
                onClick={() => setProblemPage(problemPage + 1)}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Add Testcases Tab */}
      {activeTab === 'testcase' && (
        <div className="admin-form">
          <div className="form-group">
            <label>{t('admin.selectProblem')}</label>
            <div className="testcase-problem-select">
              <input
                type="text"
                placeholder={t('admin.searchProblem')}
                value={testcaseSearch}
                onChange={(e) => handleTestcaseSearchChange(e.target.value)}
              />
              {testcaseSearch && !selectedTestcaseProblem && (
                <div className="testcase-search-dropdown">
                  {testcaseSearchResults.length === 0 ? (
                    <div className="testcase-search-item" style={{ color: 'var(--text-muted)', cursor: 'default' }}>
                      {t('common.noData')}
                    </div>
                  ) : (
                    testcaseSearchResults.map((p: any) => (
                      <div
                        key={p.id}
                        className="testcase-search-item"
                        onClick={() => {
                          handleSelectTestcaseProblem(p);
                          setTestcaseSearch('');
                          setTestcaseSearchResults([]);
                        }}
                      >
                        <span>{p.title}</span>
                        <span className="pm-col pm-col-difficulty">
                          <span className="difficulty-badge" style={{ color: DIFFICULTY_COLORS[p.difficulty] || '#8b8fa3' }}>
                            {p.difficulty}
                          </span>
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
              {selectedTestcaseProblem && (
                <div className="selected-problem-info">
                  <span>{selectedTestcaseProblem.title} (ID: {selectedTestcaseProblem.id})</span>
                  <button className="btn btn-secondary btn-sm" onClick={() => setSelectedTestcaseProblem(null)}>
                    <X size={14} /> {t('admin.change')}
                  </button>
                </div>
              )}
            </div>
          </div>

          {selectedTestcaseProblem && (
            <>
              <div className="testcase-existing">
                <h3>{t('admin.existingTestcases')}</h3>
                {existingTestcases.length === 0 ? (
                  <p className="testcase-empty">{t('admin.noTestcaseData')}</p>
                ) : (
                  <>
                    <div className="testcase-stats">
                      <span>{t('admin.totalTestcases').replace('{0}', String(existingTestcases.length))}</span>
                      <span>{t('admin.sampleCount').replace('{0}', String(existingTestcases.filter((tc: any) => tc.is_sample).length))}</span>
                      <span>{t('admin.hiddenCount').replace('{0}', String(existingTestcases.filter((tc: any) => !tc.is_sample).length))}</span>
                      <span>{t('admin.totalScore').replace('{0}', String(existingTestcases.reduce((sum: number, tc: any) => sum + (tc.score || 0), 0)))}</span>
                    </div>
                    <div className="testcase-list">
                      {existingTestcases.map((tc: any, idx: number) => (
                        <div key={idx} className="testcase-item">
                          <div
                            className="testcase-summary-row"
                            onClick={() => toggleTestcaseExpand(idx)}
                            title={expandedTestcases.has(idx) ? t('admin.clickToCollapse') : t('admin.clickToExpand')}
                          >
                            <span className="testcase-index">#{idx + 1}</span>
                            <span className={`testcase-type-badge ${tc.is_sample ? 'sample' : 'hidden'}`}>
                              {tc.is_sample ? t('admin.sample') : t('admin.hidden')}
                            </span>
                            <span className="testcase-score">{t('admin.score')}: {tc.score}</span>
                            <span className="testcase-expand-icon">
                              {expandedTestcases.has(idx) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </span>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={(e) => { e.stopPropagation(); handleDeleteTestcase(idx); }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                          {expandedTestcases.has(idx) && (
                            <div className="testcase-detail">
                              <div className="testcase-item-body">
                                <div className="testcase-io">
                                  <label>{t('admin.input')}:</label>
                                  <pre>{tc.input}</pre>
                                </div>
                                <div className="testcase-io">
                                  <label>{t('common.output')}:</label>
                                  <pre>{tc.expected_output}</pre>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="testcase-new">
                <h3>{t('admin.addNewTestcases')}</h3>
                {testcases.map((tc, idx) => (
                  <div key={idx} className="testcase-form-row">
                    <div className="form-group">
                      <label>{t('admin.input')}</label>
                      <textarea
                        rows={3}
                        value={tc.input}
                        onChange={(e) => {
                          const updated = [...testcases];
                          updated[idx] = { ...updated[idx], input: e.target.value };
                          setTestcases(updated);
                        }}
                      />
                    </div>
                    <div className="form-group">
                      <label>{t('admin.expectedOutput')}</label>
                      <textarea
                        rows={3}
                        value={tc.expected_output}
                        onChange={(e) => {
                          const updated = [...testcases];
                          updated[idx] = { ...updated[idx], expected_output: e.target.value };
                          setTestcases(updated);
                        }}
                        placeholder={selectedProblemJudgeType === 'spj' ? t('admin.spjOptional') : undefined}
                      />
                    </div>
                    <div className="form-group small">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={tc.is_sample}
                          onChange={(e) => {
                            const updated = [...testcases];
                            updated[idx] = { ...updated[idx], is_sample: e.target.checked };
                            setTestcases(updated);
                          }}
                        />
                        {t('admin.sample')}
                      </label>
                    </div>
                    <div className="form-group small">
                      <label>{t('admin.score')}</label>
                      <input
                        type="number"
                        value={tc.score}
                        onChange={(e) => {
                          const updated = [...testcases];
                          updated[idx] = { ...updated[idx], score: parseInt(e.target.value) };
                          setTestcases(updated);
                        }}
                      />
                    </div>
                  </div>
                ))}
                <div className="form-actions">
                  <button className="btn btn-secondary" onClick={handleAddTestcaseRow}>
                    <Plus size={14} /> {t('admin.addTestcase')}
                  </button>
                  <button className="btn btn-primary" onClick={handleSaveTestcases} disabled={saving}>
                    <Save size={16} />
                    {saving ? t('admin.saving') : t('admin.saveTestcases')}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* User Management Tab */}
      {activeTab === 'users' && (
        <div className="admin-form">
          <h2>{t('admin.userManagement')}</h2>
          <div className="user-search">
            <Search size={16} />
            <input
              type="text"
              placeholder={t('admin.searchUsers')}
              value={userSearch}
              onChange={(e) => {
                setUserSearch(e.target.value);
                setUserPage(1);
              }}
            />
          </div>
          <div className="user-list">
            {userList.map((u) => (
              <div key={u.id} className="user-item">
                <div className="user-info">
                  <span className="user-name">{u.username}</span>
                  <span className="user-role-badge" style={{ color: u.role === 'admin' ? '#ef4444' : '#3b82f6' }}>
                    {u.role === 'admin' ? <Shield size={14} /> : <User size={14} />}
                    {u.role}
                  </span>
                  {u.created_at && (
                    <span className="user-date">
                      {t('admin.joined')} {new Date(u.created_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div className="user-actions">
                  {u.id === 1 ? (
                    <span style={{fontSize:'12px',color:'var(--text-muted)'}}>{t('admin.superAdmin')}</span>
                  ) : u.role !== 'admin' ? (
                    <button className="btn btn-secondary btn-sm" onClick={() => handleRoleChange(u.id, 'admin')}>
                      {t('admin.makeAdmin')}
                    </button>
                  ) : (
                    <button className="btn btn-secondary btn-sm" onClick={() => handleRoleChange(u.id, 'user')}>
                      {t('admin.revokeAdmin')}
                    </button>
                  )}
                </div>
                {u.id !== 1 && (
                  <div className="user-permissions">
                    {editingPermissions === u.id ? (
                      <div className="permission-editor">
                        {['contest_admin', 'problem_admin', 'list_admin', 'ticket_admin', 'upload_admin'].map(perm => (
                          <label key={perm} className="permission-checkbox">
                            <input
                              type="checkbox"
                              checked={userPermissions.includes(perm)}
                              onChange={() => togglePermission(perm)}
                            />
                            <span className="perm-label">{perm.replace('_admin', '')}</span>
                          </label>
                        ))}
                        <button className="btn btn-primary btn-xs" onClick={() => handleSavePermissions(u.id)}>
                          {t('admin.save')}
                        </button>
                        <button className="btn btn-secondary btn-xs" onClick={() => setEditingPermissions(null)}>
                          {t('common.cancel')}
                        </button>
                      </div>
                    ) : (
                      <div className="permission-tags">
                        {u.permissions && JSON.parse(u.permissions).length > 0 ? (
                          JSON.parse(u.permissions).map((perm: string) => (
                            <span key={perm} className="perm-tag">{perm.replace('_admin', '')}</span>
                          ))
                        ) : (
                          <span style={{fontSize:'12px',color:'var(--text-muted)'}}>{u.role === 'admin' ? t('admin.allPermissions') : t('admin.noPermissions')}</span>
                        )}
                        <button className="btn btn-secondary btn-xs" onClick={() => handleEditPermissions(u.id, u.permissions ? JSON.parse(u.permissions) : [])}>
                          {t('admin.editPermissions')}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          {userPagination && userPagination.totalPages > 1 && (
            <div className="pm-pagination">
              <button
                className="btn btn-secondary btn-sm"
                disabled={userPage <= 1}
                onClick={() => setUserPage(userPage - 1)}
              >
                <ChevronLeft size={14} />
              </button>
              <span className="pm-page-info">
                {t('common.page').replace('{0}', String(userPagination.page)).replace('{1}', String(userPagination.totalPages))}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                disabled={userPage >= userPagination.totalPages}
                onClick={() => setUserPage(userPage + 1)}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Contest Management Tab */}
      {activeTab === 'contests' && (
        <div className="admin-form">
          <h2>{t('admin.contestManagement')}</h2>
          <div className="admin-table-container">
            <div className="pm-table-header">
              <span className="pm-col pm-col-id">ID</span>
              <span className="pm-col pm-col-title">{t('contests.title')}</span>
              <span className="pm-col" style={{width:'100px'}}>{t('contests.status')}</span>
              <span className="pm-col" style={{width:'160px'}}>{t('contests.startTime')}</span>
              <span className="pm-col" style={{width:'80px'}}>{t('contests.participants')}</span>
            </div>
            {adminContests.length === 0 ? (
              <div className="pm-empty">{t('common.noData')}</div>
            ) : (
              adminContests.map((c: any) => (
                <div key={c.id} className="pm-table-row">
                  <span className="pm-col pm-col-id">{c.id}</span>
                  <span className="pm-col pm-col-title">{c.title}</span>
                  <span className="pm-col" style={{width:'100px'}}>
                    <span className={`badge ${c.status === 'running' ? 'badge-success' : c.status === 'upcoming' ? 'badge-info' : 'badge-ended'}`}>
                      {c.status}
                    </span>
                  </span>
                  <span className="pm-col" style={{width:'160px', fontSize:'12px', color:'var(--text-secondary)'}}>
                    {c.start_time ? new Date(c.start_time).toLocaleString() : '-'}
                  </span>
                  <span className="pm-col" style={{width:'80px'}}>{c.participant_count ?? 0}</span>
                </div>
              ))
            )}
          </div>
          {contestPagination && contestPagination.totalPages > 1 && (
            <div className="pm-pagination">
              <button className="btn btn-secondary btn-sm" disabled={contestPage <= 1} onClick={() => setContestPage(contestPage - 1)}>
                <ChevronLeft size={14} />
              </button>
              <span className="pm-page-info">{contestPage} / {contestPagination.totalPages}</span>
              <button className="btn btn-secondary btn-sm" disabled={contestPage >= contestPagination.totalPages} onClick={() => setContestPage(contestPage + 1)}>
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Ticket Management Tab */}
      {activeTab === 'tickets' && (
        <div className="admin-form">
          <h2>{t('admin.ticketManagement')}</h2>
          <div className="filter-bar" style={{marginBottom:'12px'}}>
            <select className="filter-select" value={ticketStatusFilter} onChange={(e) => { setTicketStatusFilter(e.target.value); setTicketPage(1); }}>
              <option value="">{t('tickets.allStatus')}</option>
              <option value="open">{t('tickets.open')}</option>
              <option value="in_progress">{t('tickets.inProgress')}</option>
              <option value="resolved">{t('tickets.resolved')}</option>
              <option value="closed">{t('tickets.closed')}</option>
            </select>
          </div>
          <div className="admin-table-container">
            <div className="pm-table-header">
              <span className="pm-col pm-col-id">ID</span>
              <span className="pm-col pm-col-title">{t('tickets.title')}</span>
              <span className="pm-col" style={{width:'80px'}}>{t('tickets.category')}</span>
              <span className="pm-col" style={{width:'80px'}}>{t('tickets.status')}</span>
              <span className="pm-col" style={{width:'80px'}}>{t('tickets.priority')}</span>
              <span className="pm-col" style={{width:'100px'}}>{t('admin.user')}</span>
            </div>
            {adminTickets.length === 0 ? (
              <div className="pm-empty">{t('common.noData')}</div>
            ) : (
              adminTickets.map((tk: any) => (
                <div key={tk.id} className="pm-table-row">
                  <span className="pm-col pm-col-id">{tk.id}</span>
                  <span className="pm-col pm-col-title">{tk.title}</span>
                  <span className="pm-col" style={{width:'80px'}}>
                    <span className={`badge ${tk.category === 'bug' ? 'badge-error' : tk.category === 'suggestion' ? 'badge-info' : 'badge-warning'}`}>
                      {tk.category}
                    </span>
                  </span>
                  <span className="pm-col" style={{width:'80px'}}>
                    <span className={`badge ${tk.status === 'open' ? 'badge-warning' : tk.status === 'in_progress' ? 'badge-info' : tk.status === 'resolved' ? 'badge-success' : 'badge-ended'}`}>
                      {tk.status}
                    </span>
                  </span>
                  <span className="pm-col" style={{width:'80px'}}>{tk.priority}</span>
                  <span className="pm-col" style={{width:'100px'}}>{tk.username}</span>
                </div>
              ))
            )}
          </div>
          {ticketPagination && ticketPagination.totalPages > 1 && (
            <div className="pm-pagination">
              <button className="btn btn-secondary btn-sm" disabled={ticketPage <= 1} onClick={() => setTicketPage(ticketPage - 1)}>
                <ChevronLeft size={14} />
              </button>
              <span className="pm-page-info">{ticketPage} / {ticketPagination.totalPages}</span>
              <button className="btn btn-secondary btn-sm" disabled={ticketPage >= ticketPagination.totalPages} onClick={() => setTicketPage(ticketPage + 1)}>
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* List Management Tab */}
      {activeTab === 'lists' && (
        <div className="admin-form">
          <h2>{t('admin.listManagement')}</h2>
          <div className="admin-table-container">
            <div className="pm-table-header">
              <span className="pm-col pm-col-id">ID</span>
              <span className="pm-col pm-col-title">{t('lists.title')}</span>
              <span className="pm-col" style={{width:'80px'}}>{t('admin.user')}</span>
              <span className="pm-col" style={{width:'80px'}}>{t('lists.problemCount')}</span>
              <span className="pm-col" style={{width:'80px'}}>{t('admin.public')}</span>
            </div>
            {adminLists.length === 0 ? (
              <div className="pm-empty">{t('common.noData')}</div>
            ) : (
              adminLists.map((l: any) => (
                <div key={l.id} className="pm-table-row">
                  <span className="pm-col pm-col-id">{l.id}</span>
                  <span className="pm-col pm-col-title">{l.title}</span>
                  <span className="pm-col" style={{width:'80px'}}>{l.username}</span>
                  <span className="pm-col" style={{width:'80px'}}>{l.problem_count ?? 0}</span>
                  <span className="pm-col" style={{width:'80px'}}>{l.is_public ? '✓' : '✗'}</span>
                </div>
              ))
            )}
          </div>
          {listPagination && listPagination.totalPages > 1 && (
            <div className="pm-pagination">
              <button className="btn btn-secondary btn-sm" disabled={listPage <= 1} onClick={() => setListPage(listPage - 1)}>
                <ChevronLeft size={14} />
              </button>
              <span className="pm-page-info">{listPage} / {listPagination.totalPages}</span>
              <button className="btn btn-secondary btn-sm" disabled={listPage >= listPagination.totalPages} onClick={() => setListPage(listPage + 1)}>
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Announcement Management Tab */}
      {activeTab === 'announcement' && (
        <div className="admin-form">
          <h2>{t('admin.announcementManagement')}</h2>
          <p style={{fontSize:'13px',color:'var(--text-secondary)',marginBottom:'16px'}}>
            {t('admin.announcementHint')}
          </p>
          <div className="form-group">
            <label>{t('admin.announcementContent')}</label>
            <textarea
              rows={8}
              value={announcementContent}
              onChange={(e) => setAnnouncementContent(e.target.value)}
              placeholder={t('admin.announcementPlaceholder')}
              style={{ fontFamily: 'monospace', fontSize: '13px' }}
            />
          </div>
          {announcementContent && (
            <div className="form-group">
              <label>{t('admin.announcementPreview')}</label>
              <div
                className="announcement-preview"
                dangerouslySetInnerHTML={{ __html: announcementContent }}
              />
            </div>
          )}
          <div className="form-actions">
            <button
              className="btn btn-primary"
              onClick={handleSaveAnnouncement}
              disabled={announcementSaving}
            >
              <Save size={16} />
              {announcementSaving ? t('admin.saving') : t('common.save')}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setAnnouncementContent('')}
            >
              {t('admin.announcementClear')}
            </button>
          </div>
        </div>
      )}

      {/* Site Settings Tab */}
      {activeTab === 'settings' && (
        <div className="admin-form">
          <h2>{t('admin.siteSettings')}</h2>

          <div className="form-group">
            <label style={{display:'flex',alignItems:'center',gap:'8px',cursor:'pointer'}}>
              <input
                type="checkbox"
                checked={settingsRegistrationOpen}
                onChange={(e) => setSettingsRegistrationOpen(e.target.checked)}
              />
              {t('admin.registrationOpen')}
            </label>
            <p style={{fontSize:'13px',color:'var(--text-secondary)',marginTop:'4px'}}>
              {t('admin.registrationOpenHint')}
            </p>
          </div>

          <div className="form-group">
            <label style={{display:'flex',alignItems:'center',gap:'8px',cursor:'pointer'}}>
              <input
                type="checkbox"
                checked={settingsEmailRequired}
                onChange={(e) => setSettingsEmailRequired(e.target.checked)}
              />
              {t('admin.emailRequired')}
            </label>
            <p style={{fontSize:'13px',color:'var(--text-secondary)',marginTop:'4px'}}>
              {t('admin.emailRequiredHint')}
            </p>
          </div>

          <div className="form-group">
            <label>{t('admin.emailSuffixes')}</label>
            <input
              type="text"
              value={settingsEmailSuffixes}
              onChange={(e) => setSettingsEmailSuffixes(e.target.value)}
              placeholder={t('admin.emailSuffixesPlaceholder')}
            />
            <p style={{fontSize:'13px',color:'var(--text-secondary)',marginTop:'4px'}}>
              {t('admin.emailSuffixesHint')}
            </p>
          </div>

          <div className="form-group">
            <label style={{display:'flex',alignItems:'center',gap:'8px',cursor:'pointer'}}>
              <input
                type="checkbox"
                checked={settingsImageUploadEnabled}
                onChange={(e) => setSettingsImageUploadEnabled(e.target.checked)}
              />
              {t('common.imageUploadEnabled')}
            </label>
            <p style={{fontSize:'13px',color:'var(--text-secondary)',marginTop:'4px'}}>
              {t('common.imageUploadEnabledHint')}
            </p>
          </div>

          <div className="form-group">
            <label style={{display:'flex',alignItems:'center',gap:'8px',cursor:'pointer'}}>
              <input
                type="checkbox"
                checked={settingsUploadEnabled}
                onChange={(e) => setSettingsUploadEnabled(e.target.checked)}
              />
              {t('common.uploadEnabled')}
            </label>
            <p style={{fontSize:'13px',color:'var(--text-secondary)',marginTop:'4px'}}>
              {t('common.uploadEnabledHint')}
            </p>
          </div>

          <div className="form-actions">
            <button
              className="btn btn-primary"
              onClick={handleSaveSettings}
              disabled={settingsSaving}
            >
              <Save size={16} />
              {settingsSaving ? t('admin.saving') : t('common.save')}
            </button>
          </div>
        </div>
      )}

      {/* Upload Management Tab */}
      {activeTab === 'uploads' && (
        <div className="admin-form">
          <h2>{t('admin.uploadManagement')}</h2>
          <div className="filter-bar" style={{marginBottom:'12px'}}>
            <select className="filter-select" value={uploadTypeFilter} onChange={(e) => { setUploadTypeFilter(e.target.value); setUploadPage(1); }}>
              <option value="">{t('common.all')}</option>
              <option value="image">{t('common.image')}</option>
              <option value="file">{t('common.file')}</option>
            </select>
          </div>
          <div className="admin-table-container">
            <div className="pm-table-header">
              <span className="pm-col pm-col-id">ID</span>
              <span className="pm-col pm-col-title">{t('common.fileName')}</span>
              <span className="pm-col" style={{width:'80px'}}>{t('common.fileType')}</span>
              <span className="pm-col" style={{width:'80px'}}>{t('common.fileSize')}</span>
              <span className="pm-col" style={{width:'100px'}}>{t('common.uploadedBy')}</span>
              <span className="pm-col" style={{width:'140px'}}>{t('common.uploadTime')}</span>
              <span className="pm-col" style={{width:'80px'}}>{t('common.actions')}</span>
            </div>
            {adminUploads.length === 0 ? (
              <div className="pm-empty">{t('common.noFiles')}</div>
            ) : (
              adminUploads.map((u: any) => (
                <div key={u.id} className="pm-table-row">
                  <span className="pm-col pm-col-id">{u.id}</span>
                  <span className="pm-col pm-col-title" style={{display:'flex',alignItems:'center',gap:'6px'}}>
                    {u.file_type === 'image' ? <Image size={14} style={{color:'var(--accent)'}} /> : <File size={14} style={{color:'var(--text-secondary)'}} />}
                    <a href={u.url} target="_blank" rel="noopener noreferrer" style={{color:'var(--accent)',textDecoration:'none'}}>
                      {u.original_name}
                    </a>
                  </span>
                  <span className="pm-col" style={{width:'80px'}}>
                    <span className={`badge ${u.file_type === 'image' ? 'badge-info' : 'badge-warning'}`}>
                      {u.file_type === 'image' ? t('common.image') : t('common.file')}
                    </span>
                  </span>
                  <span className="pm-col" style={{width:'80px',fontSize:'12px',color:'var(--text-secondary)'}}>
                    {u.size_bytes < 1024 ? `${u.size_bytes}B` : u.size_bytes < 1048576 ? `${(u.size_bytes / 1024).toFixed(1)}KB` : `${(u.size_bytes / 1048576).toFixed(1)}MB`}
                  </span>
                  <span className="pm-col" style={{width:'100px',fontSize:'12px'}}>{u.username || `User#${u.user_id}`}</span>
                  <span className="pm-col" style={{width:'140px',fontSize:'12px',color:'var(--text-secondary)'}}>
                    {u.created_at ? new Date(u.created_at).toLocaleString() : '-'}
                  </span>
                  <span className="pm-col" style={{width:'80px'}}>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteUpload(u.id)}>
                      <Trash2 size={14} /> {t('common.delete')}
                    </button>
                  </span>
                </div>
              ))
            )}
          </div>
          {uploadPagination && uploadPagination.totalPages > 1 && (
            <div className="pm-pagination">
              <button className="btn btn-secondary btn-sm" disabled={uploadPage <= 1} onClick={() => setUploadPage(uploadPage - 1)}>
                <ChevronLeft size={14} />
              </button>
              <span className="pm-page-info">{uploadPage} / {uploadPagination.totalPages}</span>
              <button className="btn btn-secondary btn-sm" disabled={uploadPage >= uploadPagination.totalPages} onClick={() => setUploadPage(uploadPage + 1)}>
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* SQL Editor Tab */}
      {activeTab === 'sql' && (
        <div className="admin-form">
          <h2>{t('admin.sqlEditor')}</h2>
          <div className="sql-mode-tabs">
            <button
              className={`sql-mode-btn ${sqlMode === 'visual' ? 'active' : ''}`}
              onClick={() => setSqlMode('visual')}
            >
              {t('admin.visualEditor')}
            </button>
            <button
              className={`sql-mode-btn ${sqlMode === 'command' ? 'active' : ''}`}
              onClick={() => setSqlMode('command')}
            >
              {t('admin.sqlCommand')}
            </button>
          </div>

          {sqlMode === 'command' ? (
            <>
              <p style={{fontSize:'13px',color:'var(--text-secondary)',marginBottom:'12px'}}>
                {t('admin.sqlWarning')}
              </p>
              <div className="form-group">
                <textarea
                  className="sql-editor-textarea"
                  value={sqlQuery}
                  onChange={(e) => setSqlQuery(e.target.value)}
                  rows={8}
                  placeholder="SELECT * FROM users LIMIT 10"
                  spellCheck={false}
                />
              </div>
              {sqlQuery.trim().toUpperCase().startsWith('DELETE') && (
                <div className="form-group">
                  <label>{t('admin.deletePassword')}</label>
                  <input
                    type="password"
                    className="form-input"
                    value={sqlPassword}
                    onChange={(e) => setSqlPassword(e.target.value)}
                    placeholder={t('admin.enterPassword')}
                  />
                </div>
              )}
              <div className="form-actions">
                <button
                  className="btn btn-primary"
                  onClick={handleExecuteSql}
                  disabled={sqlExecuting || !sqlQuery.trim()}
                >
                  <Send size={14} /> {sqlExecuting ? t('common.loading') : t('admin.executeSql')}
                </button>
              </div>
              {sqlError && <div className="message error" style={{marginTop:'12px'}}>{sqlError}</div>}
              {sqlResult && (
                <div className="sql-result-container">
                  {sqlResult.results && sqlResult.results.length > 0 ? (
                    <div className="sql-result-table-wrapper">
                      <table className="sql-result-table">
                        <thead>
                          <tr>{Object.keys(sqlResult.results[0]).map((key) => <th key={key}>{key}</th>)}</tr>
                        </thead>
                        <tbody>
                          {sqlResult.results.map((row: any, idx: number) => (
                            <tr key={idx}>
                              {Object.values(row).map((val: any, i: number) => (
                                <td key={i}>{val === null ? <em>NULL</em> : String(val)}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : sqlResult.meta ? (
                    <div className="message success" style={{marginTop:'12px'}}>
                      {t('admin.rowsAffected')}: {sqlResult.meta.changes ?? 0}
                    </div>
                  ) : (
                    <div className="message success" style={{marginTop:'12px'}}>{t('admin.queryExecuted')}</div>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="visual-editor-toolbar">
                <div className="form-group" style={{marginBottom:0}}>
                  <select
                    className="filter-select"
                    value={selectedTable}
                    onChange={(e) => { setSelectedTable(e.target.value); setTablePage(1); setAddingRow(false); }}
                  >
                    <option value="">{t('admin.selectTable')}</option>
                    {sqlTables.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                {selectedTable && (
                  <button className="btn btn-primary btn-sm" onClick={() => { setAddingRow(true); setNewRowData({}); }}>
                    <Plus size={14} /> {t('admin.addRow')}
                  </button>
                )}
              </div>

              {sqlError && <div className="message error" style={{marginTop:'12px'}}>{sqlError}</div>}

              {selectedTable && tableData.length >= 0 && tableSchema.length > 0 && (
                <div className="sql-visual-table-wrapper">
                  <table className="sql-result-table editable">
                    <thead>
                      <tr>
                        {tableSchema.map((col: any) => (
                          <th key={col.name}>
                            {col.name}
                            <span className="col-type">{col.type}</span>
                            {col.pk === 1 && <span className="pk-badge">PK</span>}
                          </th>
                        ))}
                        <th className="action-col">{t('admin.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {addingRow && (
                        <tr className="new-row">
                          {tableSchema.map((col: any) => (
                            <td key={col.name}>
                              {col.pk === 1 && col.type === 'INTEGER' ? (
                                <span className="auto-text">AUTO</span>
                              ) : (
                                <input
                                  type="text"
                                  className="cell-input"
                                  value={newRowData[col.name] ?? ''}
                                  onChange={(e) => setNewRowData({ ...newRowData, [col.name]: e.target.value })}
                                  placeholder={col.type}
                                />
                              )}
                            </td>
                          ))}
                          <td className="action-col">
                            <button className="btn btn-primary btn-xs" onClick={handleAddRow}>
                              {t('admin.saveRow')}
                            </button>
                            <button className="btn btn-secondary btn-xs" onClick={() => setAddingRow(false)}>
                              {t('common.cancel')}
                            </button>
                          </td>
                        </tr>
                      )}
                      {tableData.map((row: any, rowIdx: number) => (
                        <tr key={rowIdx}>
                          {tableSchema.map((col: any) => (
                            <td
                              key={col.name}
                              onDoubleClick={() => handleCellEdit(rowIdx, col.name, row[col.name])}
                              className={editingCell?.row === rowIdx && editingCell?.col === col.name ? 'editing' : ''}
                              title={row[col.name] === null ? 'NULL' : String(row[col.name])}
                            >
                              {editingCell?.row === rowIdx && editingCell?.col === col.name ? (
                                <input
                                  type="text"
                                  className="cell-input"
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(e.target.value)}
                                  onBlur={() => handleCellSave(rowIdx)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') handleCellSave(rowIdx); if (e.key === 'Escape') setEditingCell(null); }}
                                  autoFocus
                                />
                              ) : (
                                <span className={`cell-value ${row[col.name] === null ? 'null-value' : ''}`}>
                                  {row[col.name] === null ? 'NULL' : String(row[col.name]).substring(0, 100)}
                                </span>
                              )}
                            </td>
                          ))}
                          <td className="action-col">
                            <button
                              className="btn btn-danger btn-xs"
                              onClick={() => handleDeleteRow(row)}
                            >
                              {t('admin.deleteRow')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {tablePagination && tablePagination.totalPages > 1 && (
                <div className="pm-pagination">
                  <button className="btn btn-secondary btn-sm" disabled={tablePage <= 1} onClick={() => setTablePage(tablePage - 1)}>
                    <ChevronLeft size={14} />
                  </button>
                  <span className="pm-page-info">{tablePage} / {tablePagination.totalPages}</span>
                  <button className="btn btn-secondary btn-sm" disabled={tablePage >= tablePagination.totalPages} onClick={() => setTablePage(tablePage + 1)}>
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </>
          )}

          {/* Password Confirmation Modal */}
          {showPasswordModal && (
            <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3>{t('admin.confirmDelete')}</h3>
                <p style={{color:'var(--text-secondary)',fontSize:'14px',marginBottom:'16px'}}>
                  {t('admin.deleteConfirmMsg')}
                </p>
                <div className="form-group">
                  <input
                    type="password"
                    className="form-input"
                    value={sqlPassword}
                    onChange={(e) => setSqlPassword(e.target.value)}
                    placeholder={t('admin.enterPassword')}
                    autoFocus
                  />
                </div>
                <div className="modal-actions">
                  <button className="btn btn-secondary" onClick={() => { setShowPasswordModal(false); setSqlPassword(''); }}>
                    {t('common.cancel')}
                  </button>
                  <button className="btn btn-danger" onClick={confirmDeleteWithPassword} disabled={!sqlPassword}>
                    {t('admin.confirmDelete')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
