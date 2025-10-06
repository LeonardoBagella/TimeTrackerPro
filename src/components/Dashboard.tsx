
import React, { useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useProjects } from '@/context/ProjectContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LogOut, Plus, Clock, Trash2, Calendar, AlertTriangle } from 'lucide-react';
import AddProjectDialog from './AddProjectDialog';
import AddTimeDialog from './AddTimeDialog';
import { calculateMissedEntries } from '@/utils/timeCalculations';
import { startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { projects, timeEntries, deleteProject, deleteTimeEntry, isLoading } = useProjects();
  const [showAddProject, setShowAddProject] = useState(false);
  const [showAddTime, setShowAddTime] = useState(false);
  const [prefilledDate, setPrefilledDate] = useState<string | undefined>(undefined);

  // Filter time entries for current month
  const currentMonthStart = startOfMonth(new Date());
  const currentMonthEnd = endOfMonth(new Date());
  
  const currentMonthEntries = useMemo(() => {
    return timeEntries.filter(entry => {
      const entryDate = parseISO(entry.date);
      return isWithinInterval(entryDate, { start: currentMonthStart, end: currentMonthEnd });
    });
  }, [timeEntries, currentMonthStart, currentMonthEnd]);

  // Calculate hours for current month only
  const totalUserHours = useMemo(() => {
    return currentMonthEntries.reduce((sum, entry) => sum + Number(entry.hours), 0);
  }, [currentMonthEntries]);

  const totalProjectHours = useMemo(() => {
    return projects.reduce((sum, project) => sum + (project.totalHours || 0), 0);
  }, [projects]);

  const recentEntries = timeEntries
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const missedEntries = useMemo(() => calculateMissedEntries(timeEntries), [timeEntries]);

  const handleMissedEntryClick = (date: string) => {
    setPrefilledDate(date);
    setShowAddTime(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                TimeTracker Pro
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Welcome, {user?.email?.split('@')[0]}</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={signOut}
                className="hover:bg-red-50 hover:border-red-200 hover:text-red-600"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <Button 
            onClick={() => setShowAddProject(true)}
            className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Project
          </Button>
          
          <Button 
            onClick={() => setShowAddTime(true)}
            variant="outline"
            className="border-border hover:bg-secondary hover:border-primary/20"
            disabled={projects.length === 0}
          >
            <Clock className="w-4 h-4 mr-2" />
            Log Time
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Total Projects</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{projects.length}</div>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Ore Mese Corrente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-accent-foreground">
                {totalUserHours.toFixed(1)}
              </div>
              <p className="text-xs text-gray-500 mt-1">Ore rendicontate questo mese</p>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Time Entries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary/80">{timeEntries.length}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Projects */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Plus className="w-5 h-5 mr-2 text-primary" />
                Projects
              </CardTitle>
              <CardDescription>Manage your active projects</CardDescription>
            </CardHeader>
            <CardContent>
              {projects.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Plus className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No projects yet. Add your first project to get started!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {projects.map((project) => (
                    <div key={project.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: project.color }}
                        />
                        <div>
                          <h3 className="font-medium text-gray-900">{project.name}</h3>
                          <p className="text-sm text-gray-500">{project.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="flex flex-col">
                          <Badge variant="secondary" className="bg-primary/10 text-primary mb-1">
                            {(project.userHours || 0).toFixed(1)}h / {(project.totalHours || 0).toFixed(1)}h
                          </Badge>
                          <span className="text-xs text-gray-500">Tue ore / Totali</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteProject(project.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Time Entries */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-accent-foreground" />
                Recent Entries
              </CardTitle>
              <CardDescription>Your latest time logs</CardDescription>
            </CardHeader>
            <CardContent>
              {recentEntries.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No time entries yet. Start logging your hours!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentEntries.map((entry) => {
                    const project = projects.find(p => p.id === entry.project_id);
                    return (
                      <div key={entry.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="flex items-center space-x-3">
                          <div 
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: project?.color || '#gray' }}
                          />
                          <div>
                            <h3 className="font-medium text-gray-900">{project?.name}</h3>
                            <p className="text-sm text-gray-500">{entry.description}</p>
                            <p className="text-xs text-gray-400">{new Date(entry.date).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Badge variant="secondary" className="bg-accent/20 text-accent-foreground">
                            {entry.hours}h
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteTimeEntry(entry.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Possible Missed Entries */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2 text-yellow-600" />
                Possible Missed Entries
              </CardTitle>
              <CardDescription>Working days with less than 8 hours logged</CardDescription>
            </CardHeader>
            <CardContent>
              {missedEntries.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Great! No missed entries in the last month.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {missedEntries.slice(0, 10).map((entry) => (
                    <div 
                      key={entry.date} 
                      className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors cursor-pointer"
                      onClick={() => handleMissedEntryClick(entry.date)}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                        <div>
                          <h4 className="font-medium text-gray-900">{entry.formattedDate}</h4>
                          <p className="text-sm text-gray-500">
                            {entry.totalHours > 0 ? `${entry.totalHours}h logged` : 'No hours logged'}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300">
                        Missing {8 - entry.totalHours}h
                      </Badge>
                    </div>
                  ))}
                  {missedEntries.length > 10 && (
                    <p className="text-sm text-gray-500 text-center pt-2">
                      And {missedEntries.length - 10} more days...
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AddProjectDialog open={showAddProject} onOpenChange={setShowAddProject} />
      <AddTimeDialog 
        open={showAddTime} 
        onOpenChange={(open) => {
          setShowAddTime(open);
          if (!open) setPrefilledDate(undefined);
        }}
        prefilledDate={prefilledDate}
      />
    </div>
  );
};

export default Dashboard;
