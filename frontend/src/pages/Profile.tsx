import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { DIFFICULTY_COLORS } from '../constants';
import { Trophy, Target, Clock, Calendar, UserX, Swords, Edit3, Key, X, Check } from 'lucide-react';
import { t } from '../i18n';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import './Profile.css';

export default function Profile() {
  const { username } = useParams<{ username?: string }>();
  const { user: currentUser, fetchUser } = useAuthStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allSubmissions, setAllSubmissions] = useState<any[]>([]);
  const [contests, setContests] = useState<any[]>([]);

  // Edit profile state
  const [editing, setEditing] = useState(false);
  const [editAvatar, setEditAvatar] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Change password state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const profileUser = data?.user;
  useDocumentTitle(profileUser?.username ? `${profileUser.username}'s Profile` : t('profile.title'));

  const isOwnProfile = !username || username === currentUser?.username;

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (isOwnProfile) {
          const profileData = await api.getUserProfile();
          setData(profileData);
        } else if (username) {
          const userData = await api.getUserByUsername(username);
          setData(userData);
        }
      } catch (err: any) {
        setError(err.message || t('profile.notFound'));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [username, isOwnProfile]);

  useEffect(() => {
    const fetchExtraData = async () => {
      // Fetch all submissions for language stats
      try {
        const subData = isOwnProfile
          ? await api.getUserSubmissions({ page: 1, pageSize: 1000 })
          : await api.getSubmissions({ user_id: String(data?.user?.id), pageSize: 1000 });
        setAllSubmissions(subData.submissions);
      } catch {
        // ignore
      }
      // Fetch user's contest history (contests they joined)
      try {
        const contestData = await api.getUserContests();
        setContests(contestData.contests);
      } catch {
        // ignore
      }
    };
    if (data?.user) fetchExtraData();
  }, [data?.user]);

  if (loading) {
    return <LoadingSpinner message={t('profile.loadingProfile')} />;
  }

  if (error || !data) {
    return <EmptyState icon={UserX} title={error || t('profile.notFound')} />;
  }

  const { user, stats } = data;
  const solvedProblems = data.solved_problems || [];
  const recentSubmissions = data.recent_submissions || [];
  const startEditing = () => {
    setEditAvatar(user.avatar_url || '');
    setEditBio(user.bio || '');
    setEditError('');
    setEditing(true);
  };

  const handleSaveProfile = async () => {
    setEditSaving(true);
    setEditError('');
    try {
      const result = await api.updateProfile({ avatar_url: editAvatar, bio: editBio });
      setData({ ...data, user: result.user });
      await fetchUser();
      setEditing(false);
    } catch (e: any) {
      setEditError(e.message || t('common.error'));
    } finally {
      setEditSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    if (!oldPassword || !newPassword) {
      setPasswordError(t('login.usernameRequired'));
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError(t('login.passwordTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('login.passwordMismatch'));
      return;
    }
    setPasswordSaving(true);
    try {
      await api.changePassword(oldPassword, newPassword);
      setShowPasswordModal(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      setPasswordError(e.message || t('common.error'));
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="profile-page">
      <div className="profile-header">
        {isOwnProfile && !editing && (
          <div className="profile-actions">
            <button className="btn btn-secondary btn-sm" onClick={startEditing}>
              <Edit3 size={14} />
              {t('profile.editProfile')}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowPasswordModal(true)}>
              <Key size={14} />
              {t('profile.changePassword')}
            </button>
          </div>
        )}

        {editing ? (
          <div className="profile-edit-form">
            <div className="form-group">
              <label>{t('profile.avatarUrl')}</label>
              <input
                type="text"
                className="form-input"
                value={editAvatar}
                onChange={(e) => setEditAvatar(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="form-group">
              <label>{t('profile.bio')}</label>
              <textarea
                className="form-textarea"
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                placeholder={t('profile.bioPlaceholder')}
                maxLength={500}
                rows={3}
              />
              <div className="char-count">{editBio.length}/500</div>
            </div>
            {editError && <div className="form-error">{editError}</div>}
            <div className="form-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>
                <X size={14} />
                {t('common.cancel')}
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleSaveProfile} disabled={editSaving}>
                <Check size={14} />
                {editSaving ? t('common.loading') : t('common.save')}
              </button>
            </div>
          </div>
        ) : (
          <div className="profile-info">
            {user.avatar_url && (
              <img src={user.avatar_url} alt={user.username} className="profile-avatar" />
            )}
            <div className="profile-text">
              <h1 className="profile-username">{user.username}</h1>
              {user.bio && <p className="profile-bio">{user.bio}</p>}
              <div className="profile-meta">
                <span className="meta-item">
                  <Calendar size={14} />
                  {t('profile.joined')} {new Date(user.created_at).toLocaleDateString()}
                </span>
                {user.role === 'admin' && (
                  <span className="badge admin-badge">{t('common.admin')}</span>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="stats-grid">
          <div className="stat-card">
            <Trophy size={24} className="stat-icon solved" />
            <div className="stat-content">
              <div className="stat-value">{stats.solved_count}</div>
              <div className="stat-label">{t('profile.accepted')}</div>
            </div>
          </div>
          <div className="stat-card">
            <Target size={24} className="stat-icon attempted" />
            <div className="stat-content">
              <div className="stat-value">{stats.attempted_count || stats.solved_count}</div>
              <div className="stat-label">{t('profile.attempted')}</div>
            </div>
          </div>
          <div className="stat-card">
            <Clock size={24} className="stat-icon submissions" />
            <div className="stat-content">
              <div className="stat-value">{stats.total_submissions}</div>
              <div className="stat-label">{t('profile.totalSubmissions')}</div>
            </div>
          </div>
        </div>
      </div>

      {solvedProblems.length > 0 && (
        <div className="difficulty-distribution">
          <h2 className="section-title">{t('profile.difficultyDistribution')}</h2>
          <div className="difficulty-bars">
            {['easy', 'medium', 'hard'].map((diff) => {
              const label = diff === 'easy' ? t('problemList.easy') : diff === 'medium' ? t('problemList.medium') : t('problemList.hard');
              const count = solvedProblems.filter((p: any) => p.difficulty?.toLowerCase() === diff || p.difficulty === label).length;
              const percentage = solvedProblems.length > 0 ? Math.round((count / solvedProblems.length) * 100) : 0;
              return (
                <div key={diff} className="difficulty-bar-item">
                  <div className="difficulty-bar-header">
                    <span className="difficulty-bar-label" style={{ color: DIFFICULTY_COLORS[label] || DIFFICULTY_COLORS[diff] }}>{label}</span>
                    <span className="difficulty-bar-count">{count} ({percentage}%)</span>
                  </div>
                  <div className="difficulty-bar-track">
                    <div
                      className="difficulty-bar-fill"
                      style={{
                        width: `${percentage}%`,
                        background: DIFFICULTY_COLORS[label] || DIFFICULTY_COLORS[diff],
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(allSubmissions.length > 0 || (solvedProblems.length > 0 && recentSubmissions.length > 0)) && (
        <div className="language-distribution">
          <h2 className="section-title">{t('profile.languageStats')}</h2>
          <div className="language-bars">
            {(() => {
              const langCounts: Record<string, number> = {};
              const submissionsSource = allSubmissions.length > 0 ? allSubmissions : recentSubmissions;
              submissionsSource.forEach((s: any) => {
                if (s.status === 'accepted') {
                  langCounts[s.language] = (langCounts[s.language] || 0) + 1;
                }
              });
              const total = Object.values(langCounts).reduce((a, b) => a + b, 0) || 1;
              return Object.entries(langCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([lang, count]) => {
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={lang} className="language-bar-item">
                      <div className="language-bar-header">
                        <span className="language-bar-label">{lang}</span>
                        <span className="language-bar-count">{count} ({pct}%)</span>
                      </div>
                      <div className="difficulty-bar-track">
                        <div className="difficulty-bar-fill" style={{ width: `${pct}%`, background: 'var(--accent)' }} />
                      </div>
                    </div>
                  );
                });
            })()}
          </div>
        </div>
      )}

      {solvedProblems.length > 0 && (
        <div className="solved-section">
          <h2 className="section-title">{t('profile.solvedProblems')} ({solvedProblems.length})</h2>
          <div className="problems-grid">
            {solvedProblems.map((problem: any) => (
              <Link
                key={problem.id}
                to={`/problems/${problem.slug}`}
                className="problem-card solved"
              >
                <div className="problem-card-header">
                  <span className="problem-id">#{problem.id}</span>
                  <span
                    className="difficulty-badge"
                    style={{
                      color: DIFFICULTY_COLORS[problem.difficulty],
                      borderColor: DIFFICULTY_COLORS[problem.difficulty],
                      background: `${DIFFICULTY_COLORS[problem.difficulty]}15`,
                    }}
                  >
                    {problem.difficulty}
                  </span>
                </div>
                <div className="problem-card-title">{problem.title}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {contests.length > 0 && (
        <div className="contest-history-section">
          <h2 className="section-title">{t('profile.contestHistory')}</h2>
          <div className="contest-history-list">
            {contests.map((contest: any) => {
              const now = Date.now();
              const start = new Date(contest.start_time).getTime();
              const end = new Date(contest.end_time).getTime();
              let statusLabel: string;
              let statusClass: string;
              if (now < start) {
                statusLabel = t('contests.upcoming');
                statusClass = 'badge badge-info';
              } else if (now >= start && now <= end) {
                statusLabel = t('contests.running');
                statusClass = 'badge badge-success';
              } else {
                statusLabel = t('contests.ended');
                statusClass = 'badge badge-ended';
              }
              return (
                <Link key={contest.id} to={`/contests/${contest.id}`} className="contest-history-item">
                  <div className="contest-history-info">
                    <div className="contest-history-title">
                      <Swords size={16} />
                      {contest.title}
                    </div>
                    <div className="contest-history-meta">
                      <span><Calendar size={12} /> {new Date(contest.start_time).toLocaleDateString()} - {new Date(contest.end_time).toLocaleDateString()}</span>
                      <span>{contest.participant_count ?? 0} {t('contests.participants')}</span>
                    </div>
                  </div>
                  <span className={statusClass}>{statusLabel}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {recentSubmissions.length > 0 && (
        <div className="submissions-section">
          <div className="section-header">
            <h2 className="section-title">{t('profile.recentSubmissions')}</h2>
            <Link to="/submissions" className="view-all-link">{t('profile.viewAll')}</Link>
          </div>
          <div className="submissions-list">
            {recentSubmissions.map((sub: any) => (
              <Link
                key={sub.id}
                to={`/submissions/${sub.id}`}
                className="submission-item"
              >
                <div className="submission-info">
                  <div className="submission-problem">{sub.title}</div>
                  <div className="submission-meta">
                    <span>{sub.language}</span>
                    <span>{new Date(sub.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <StatusBadge status={sub.status} />
              </Link>
            ))}
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('profile.changePassword')}</h2>
              <button className="modal-close" onClick={() => setShowPasswordModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>{t('profile.oldPassword')}</label>
                <input
                  type="password"
                  className="form-input"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>{t('profile.newPassword')}</label>
                <input
                  type="password"
                  className="form-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('login.passwordTooShort')}
                />
              </div>
              <div className="form-group">
                <label>{t('login.confirmPassword')}</label>
                <input
                  type="password"
                  className="form-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              {passwordError && <div className="form-error">{passwordError}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPasswordModal(false)}>
                {t('common.cancel')}
              </button>
              <button className="btn btn-primary" onClick={handleChangePassword} disabled={passwordSaving}>
                {passwordSaving ? t('common.loading') : t('profile.changePassword')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
