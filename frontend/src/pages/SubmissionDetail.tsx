import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { ChevronRight, Clock, MemoryStick, Code2, ChevronDown, ChevronUp, FileQuestion, RefreshCw, AlertCircle } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { useThemeStore } from '../store/theme';
import { t } from '../i18n';
import './SubmissionDetail.css';

const getLangExtension = (lang: string) => {
  switch (lang) {
    case 'python': return python();
    case 'cpp': case 'c': return cpp();
    case 'java': return java();
    case 'javascript': return javascript();
    default: return python();
  }
};

export default function SubmissionDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const { theme } = useThemeStore();
  const [submission, setSubmission] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedTestCases, setExpandedTestCases] = useState<number[]>([]);

  // Polling cleanup refs (Bug 2 fix)
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (pollingRef.current) clearTimeout(pollingRef.current);
    };
  }, []);

  const fetchSubmission = async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await api.getSubmission(parseInt(id));
      if (!isMountedRef.current) return;
      setSubmission(data.submission);

      if (data.submission.status === 'pending' || data.submission.status === 'running') {
        pollingRef.current = setTimeout(fetchSubmission, 1500);
      }
    } catch (e) {
      if (!isMountedRef.current) return;
      setLoadError(t('submissionDetail.loadError'));
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmission();
  }, [id]);

  const toggleTestCase = (index: number) => {
    setExpandedTestCases(prev =>
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  if (!user) {
    return (
      <div className="empty-page">
        <h2>{t('submissionDetail.pleaseLogin')}</h2>
      </div>
    );
  }

  if (loading) {
    return <LoadingSpinner message={t('submissionDetail.loadingSubmission')} />;
  }

  if (loadError) {
    return (
      <div className="submission-detail-page">
        <div className="error-banner">
          <AlertCircle size={16} />
          <span>{loadError}</span>
          <button className="btn btn-secondary btn-sm" onClick={fetchSubmission}>
            <RefreshCw size={14} /> {t('common.retry')}
          </button>
        </div>
      </div>
    );
  }

  if (!submission) {
    return <EmptyState icon={FileQuestion} title={t('submissionDetail.notFound')} />;
  }

  let details: any[] = [];
  try {
    details = JSON.parse(submission.details || '[]');
  } catch {}

  return (
    <div className="submission-detail-page">
      <div className="breadcrumb">
        <Link to="/submissions">{t('submissions.title')}</Link>
        <ChevronRight size={14} />
        <span>#{submission.id}</span>
      </div>

      <div className="submission-header">
        <h1>{t('submissionDetail.title')} #{submission.id}</h1>
        <StatusBadge status={submission.status} />
      </div>

      <div className="submission-info-grid">
        {submission.username && (
          <div className="info-card">
            <label>{t('submissionDetail.user')}</label>
            <Link to={`/users/${submission.username}`}>{submission.username}</Link>
          </div>
        )}
        <div className="info-card">
          <label>{t('submissionDetail.problem')}</label>
          <Link to={`/problems/${submission.problem_slug}`}>{submission.problem_title}</Link>
        </div>
        <div className="info-card">
          <label>{t('submissionDetail.language')}</label>
          <span>{submission.language}</span>
        </div>
        <div className="info-card">
          <label>{t('submissionDetail.score')}</label>
          <span className="score-value">{submission.score || 0}</span>
        </div>
        <div className="info-card">
          <label><Clock size={14} /> {t('submissionDetail.time')}</label>
          <span>{submission.time_used ? `${submission.time_used}ms` : '-'}</span>
        </div>
        <div className="info-card">
          <label><MemoryStick size={14} /> {t('submissionDetail.memory')}</label>
          <span>{submission.memory_used ? `${submission.memory_used}KB` : '-'}</span>
        </div>
        <div className="info-card">
          <label>{t('submissionDetail.submitted')}</label>
          <span>{new Date(submission.created_at).toLocaleString()}</span>
        </div>
      </div>

      {details.length > 0 && (
        <div className="testcase-results">
          <h2>{t('submissionDetail.testResults')}</h2>
          <div className="testcase-list">
            {details.map((tc: any, idx: number) => {
              const isExpanded = expandedTestCases.includes(idx);
              return (
                <div
                  key={idx}
                  className={`testcase-item ${tc.status === 'accepted' ? 'passed' : 'failed'}`}
                >
                  <div className="tc-header" onClick={() => toggleTestCase(idx)}>
                    <div className="tc-header-left">
                      <span className="tc-name">{t('submissionDetail.testcase')} {idx + 1}</span>
                      <StatusBadge status={tc.status} />
                    </div>
                    <div className="tc-details">
                      {tc.time_used && <span>{t('submissions.time')}: {tc.time_used}ms</span>}
                      {tc.memory_used && <span>{t('submissions.memory')}: {tc.memory_used}KB</span>}
                      {tc.score !== undefined && <span>{t('submissions.score')}: {tc.score}</span>}
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="tc-content">
                      {tc.input && (
                        <div className="tc-section">
                          <label>{t('submissionDetail.input')}</label>
                          <pre>{tc.input}</pre>
                        </div>
                      )}
                      {tc.expected_output && (
                        <div className="tc-section">
                          <label>{t('submissionDetail.expected')}</label>
                          <pre>{tc.expected_output}</pre>
                        </div>
                      )}
                      {tc.actual_output && (
                        <div className="tc-section">
                          <label>{t('submissionDetail.actual')}</label>
                          <pre>{tc.actual_output}</pre>
                        </div>
                      )}
                      {tc.error_output && (
                        <div className="tc-section error">
                          <label>{t('submissionDetail.error')}</label>
                          <pre>{tc.error_output}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="source-code-section">
        <h2><Code2 size={18} /> {t('submissionDetail.sourceCode')}</h2>
        <div className="source-code-editor">
          <CodeMirror
            value={submission.source_code}
            height="auto"
            theme={theme === 'dark' ? oneDark : undefined}
            extensions={[getLangExtension(submission.language)]}
            readOnly={true}
            basicSetup={{ lineNumbers: true, foldGutter: false }}
          />
        </div>
      </div>
    </div>
  );
}
