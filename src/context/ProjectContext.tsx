
import React, { createContext, useContext, useState, useEffect } from 'react';

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  totalHours: number;
}

export interface TimeEntry {
  id: string;
  projectId: string;
  hours: number;
  description: string;
  date: string;
}

interface ProjectContextType {
  projects: Project[];
  timeEntries: TimeEntry[];
  addProject: (project: Omit<Project, 'id' | 'totalHours'>) => void;
  addTimeEntry: (entry: Omit<TimeEntry, 'id'>) => void;
  deleteProject: (id: string) => void;
  deleteTimeEntry: (id: string) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const useProjects = () => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProjects must be used within a ProjectProvider');
  }
  return context;
};

const defaultProjects: Project[] = [
  {
    id: '1',
    name: 'Website Redesign',
    description: 'Complete overhaul of company website',
    color: '#3b82f6',
    totalHours: 0
  },
  {
    id: '2',
    name: 'Mobile App Development',
    description: 'React Native app for iOS and Android',
    color: '#8b5cf6',
    totalHours: 0
  }
];

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [projects, setProjects] = useState<Project[]>(defaultProjects);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);

  useEffect(() => {
    const savedProjects = localStorage.getItem('timetracker_projects');
    const savedEntries = localStorage.getItem('timetracker_entries');
    
    if (savedProjects) {
      setProjects(JSON.parse(savedProjects));
    }
    if (savedEntries) {
      setTimeEntries(JSON.parse(savedEntries));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('timetracker_projects', JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem('timetracker_entries', JSON.stringify(timeEntries));
    
    // Update project total hours
    setProjects(prev => prev.map(project => ({
      ...project,
      totalHours: timeEntries
        .filter(entry => entry.projectId === project.id)
        .reduce((total, entry) => total + entry.hours, 0)
    })));
  }, [timeEntries]);

  const addProject = (projectData: Omit<Project, 'id' | 'totalHours'>) => {
    const newProject: Project = {
      ...projectData,
      id: Date.now().toString(),
      totalHours: 0
    };
    setProjects(prev => [...prev, newProject]);
  };

  const addTimeEntry = (entryData: Omit<TimeEntry, 'id'>) => {
    const newEntry: TimeEntry = {
      ...entryData,
      id: Date.now().toString()
    };
    setTimeEntries(prev => [...prev, newEntry]);
  };

  const deleteProject = (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    setTimeEntries(prev => prev.filter(e => e.projectId !== id));
  };

  const deleteTimeEntry = (id: string) => {
    setTimeEntries(prev => prev.filter(e => e.id !== id));
  };

  return (
    <ProjectContext.Provider value={{
      projects,
      timeEntries,
      addProject,
      addTimeEntry,
      deleteProject,
      deleteTimeEntry
    }}>
      {children}
    </ProjectContext.Provider>
  );
};
