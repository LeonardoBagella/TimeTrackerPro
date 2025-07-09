
import { useAuth } from '@/context/AuthContext';
import LoginPage from '@/components/LoginPage';
import Dashboard from '@/components/Dashboard';
import { ProjectProvider } from '@/context/ProjectContext';

const Index = () => {
  const { user } = useAuth();

  return user ? (
    <ProjectProvider>
      <Dashboard />
    </ProjectProvider>
  ) : (
    <LoginPage />
  );
};

export default Index;
