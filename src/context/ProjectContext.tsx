import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  totalHours?: number;
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
      const { data, error } = await (supabase as any)
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching projects:', error);
        return;
      }

      // Calculate total hours for each project
      const projectsWithHours = await Promise.all(
        (data || []).map(async (project: any) => {
          const { data: entries } = await (supabase as any)
            .from('time_entries')
            .select('hours')
            .eq('project_id', project.id);
          
          const totalHours = entries?.reduce((sum: number, entry: any) => sum + Number(entry.hours), 0) || 0;
          
          return {
            ...project,
            totalHours
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
      
      setTimeEntries(prev => [data, ...prev]);
      
      // Update project total hours
      setProjects(prev => prev.map(project => 
        project.id === entryData.project_id
          ? { ...project, totalHours: (project.totalHours || 0) + Number(entryData.hours) }
          : project
      ));
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