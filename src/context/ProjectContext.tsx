import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { startOfMonth, endOfMonth } from 'date-fns';

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  budget?: number;
  totalHours?: number;
  userHours?: number;
  created_at?: string;
  updated_at?: string;
}

export interface TimeEntry {
  id: string;
  project_id: string;
  hours: number;
  description: string;
  date: string;
  created_at?: string;
  updated_at?: string;
}

interface ProjectContextType {
  projects: Project[];
  timeEntries: TimeEntry[];
  addProject: (project: Omit<Project, 'id' | 'totalHours'>) => Promise<void>;
  addTimeEntry: (entry: Omit<TimeEntry, 'id'>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  deleteTimeEntry: (id: string) => Promise<void>;
  isLoading: boolean;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const useProjects = () => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProjects must be used within a ProjectProvider');
  }
  return context;
};

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProjects();
      fetchTimeEntries();
    } else {
      setProjects([]);
      setTimeEntries([]);
    }
  }, [user]);

  const fetchProjects = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Fetch projects in user's organization (filtered by RLS)
      const { data, error } = await (supabase as any)
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching projects:', error);
        setIsLoading(false);
        return;
      }

      // Filter only projects where user is a member
      const { data: memberData } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', user.id);

      const projectIds = new Set(memberData?.map(m => m.project_id) || []);
      const userProjects = (data || []).filter((p: any) => projectIds.has(p.id));

      // Calculate total hours for each project (current month only)
      const currentMonthStart = startOfMonth(new Date()).toISOString();
      const currentMonthEnd = endOfMonth(new Date()).toISOString();
      
      const projectsWithHours = await Promise.all(
        userProjects.map(async (project: any) => {
          // Get time entries for current month only (all users in organization)
          const { data: allEntries } = await (supabase as any)
            .from('time_entries')
            .select('hours, user_id')
            .eq('project_id', project.id)
            .gte('date', currentMonthStart)
            .lte('date', currentMonthEnd);
          
          const totalHours = allEntries?.reduce((sum: number, entry: any) => sum + Number(entry.hours), 0) || 0;
          
          // Get user's time entries for the project (current month)
          const userHours = allEntries
            ?.filter((entry: any) => entry.user_id === user.id)
            .reduce((sum: number, entry: any) => sum + Number(entry.hours), 0) || 0;
          
          return {
            ...project,
            totalHours,
            userHours
          };
        })
      );

      setProjects(projectsWithHours);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTimeEntries = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await (supabase as any)
        .from('time_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching time entries:', error);
        return;
      }
      
      setTimeEntries(data || []);
    } catch (error) {
      console.error('Error fetching time entries:', error);
    }
  };

  const addProject = async (projectData: Omit<Project, 'id' | 'totalHours'>) => {
    if (!user) return;
    
    try {
      const { data, error } = await (supabase as any)
        .from('projects')
        .insert([
          {
            ...projectData,
            user_id: user.id
          }
        ])
        .select()
        .single();

      if (error) {
        console.error('Error adding project:', error);
        return;
      }
      
      const newProject = { ...data, totalHours: 0 };
      setProjects(prev => [newProject, ...prev]);
    } catch (error) {
      console.error('Error adding project:', error);
    }
  };

  const addTimeEntry = async (entryData: Omit<TimeEntry, 'id'>) => {
    if (!user) return;
    
    try {
      const { data, error } = await (supabase as any)
        .from('time_entries')
        .insert([
          {
            ...entryData,
            user_id: user.id
          }
        ])
        .select()
        .single();

      if (error) {
        console.error('Error adding time entry:', error);
        return;
      }
      
      // Refresh all data to update totals
      await fetchProjects();
      await fetchTimeEntries();
    } catch (error) {
      console.error('Error adding time entry:', error);
    }
  };

  const deleteProject = async (id: string) => {
    if (!user) return;
    
    try {
      // Delete time entries first
      await (supabase as any)
        .from('time_entries')
        .delete()
        .eq('project_id', id);

      // Then delete project
      const { error } = await (supabase as any)
        .from('projects')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting project:', error);
        return;
      }
      
      setProjects(prev => prev.filter(p => p.id !== id));
      setTimeEntries(prev => prev.filter(e => e.project_id !== id));
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  const deleteTimeEntry = async (id: string) => {
    if (!user) return;
    
    try {
      const entryToDelete = timeEntries.find(e => e.id === id);
      
      const { error } = await (supabase as any)
        .from('time_entries')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting time entry:', error);
        return;
      }
      
      setTimeEntries(prev => prev.filter(e => e.id !== id));
      
      // Update project total hours
      if (entryToDelete) {
        setProjects(prev => prev.map(project => 
          project.id === entryToDelete.project_id
            ? { ...project, totalHours: (project.totalHours || 0) - Number(entryToDelete.hours) }
            : project
        ));
      }
    } catch (error) {
      console.error('Error deleting time entry:', error);
    }
  };

  return (
    <ProjectContext.Provider value={{
      projects,
      timeEntries,
      addProject,
      addTimeEntry,
      deleteProject,
      deleteTimeEntry,
      isLoading
    }}>
      {children}
    </ProjectContext.Provider>
  );
};