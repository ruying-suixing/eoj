import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';

const ProblemList = lazy(() => import('./pages/ProblemList'));
const Home = lazy(() => import('./pages/Home'));
const ProblemDetail = lazy(() => import('./pages/ProblemDetail'));
const Submissions = lazy(() => import('./pages/Submissions'));
const SubmissionDetail = lazy(() => import('./pages/SubmissionDetail'));
const Rankings = lazy(() => import('./pages/Rankings'));
const Profile = lazy(() => import('./pages/Profile'));
const Favorites = lazy(() => import('./pages/Favorites'));
const Login = lazy(() => import('./pages/Login'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const Admin = lazy(() => import('./pages/Admin'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Contests = lazy(() => import('./pages/Contests'));
const ContestDetail = lazy(() => import('./pages/ContestDetail'));
const Tickets = lazy(() => import('./pages/Tickets'));
const CreateTicket = lazy(() => import('./pages/CreateTicket'));
const TicketDetail = lazy(() => import('./pages/TicketDetail'));
const ProblemLists = lazy(() => import('./pages/ProblemLists'));
const ProblemListDetail = lazy(() => import('./pages/ProblemListDetail'));
const CreateProblemList = lazy(() => import('./pages/CreateProblemList'));
const CreateContest = lazy(() => import('./pages/CreateContest'));
const Solutions = lazy(() => import('./pages/Solutions'));
const SolutionDetail = lazy(() => import('./pages/SolutionDetail'));
const Discussions = lazy(() => import('./pages/Discussions'));
const DiscussionDetail = lazy(() => import('./pages/DiscussionDetail'));
const GlobalSolutions = lazy(() => import('./pages/GlobalSolutions'));
const GlobalDiscussions = lazy(() => import('./pages/GlobalDiscussions'));
const MyFiles = lazy(() => import('./pages/MyFiles'));
import { useAuthStore } from './store/auth';
import './styles/global.css';
import './styles/components.css';

function App() {
  const { fetchUser, token } = useAuthStore();

  useEffect(() => {
    if (token) {
      fetchUser();
    }
  }, []);

  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Layout>
          <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Loading...</p></div>}>
            <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/problems" element={<ProblemList />} />
            <Route path="/problems/:slug" element={<ProblemDetail />} />
            <Route path="/submissions" element={<Submissions />} />
            <Route path="/submissions/:id" element={<SubmissionDetail />} />
            <Route path="/rankings" element={<Rankings />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/users/:username" element={<Profile />} />
            <Route path="/favorites" element={<Favorites />} />
            <Route path="/login" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/contests" element={<Contests />} />
            <Route path="/contests/new" element={<CreateContest />} />
            <Route path="/contests/:id/edit" element={<CreateContest />} />
            <Route path="/contests/:id" element={<ContestDetail />} />
            <Route path="/tickets" element={<Tickets />} />
            <Route path="/tickets/new" element={<CreateTicket />} />
            <Route path="/tickets/:id" element={<TicketDetail />} />
            <Route path="/lists" element={<ProblemLists />} />
            <Route path="/lists/new" element={<CreateProblemList />} />
            <Route path="/lists/:id" element={<ProblemListDetail />} />
            <Route path="/solutions/all" element={<GlobalSolutions />} />
            <Route path="/solutions/:id" element={<SolutionDetail />} />
            <Route path="/solutions" element={<Solutions />} />
            <Route path="/discussions/all" element={<GlobalDiscussions />} />
            <Route path="/discussions/:id" element={<DiscussionDetail />} />
            <Route path="/discussions" element={<Discussions />} />
            <Route path="/my-files" element={<MyFiles />} />
            <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </Layout>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
